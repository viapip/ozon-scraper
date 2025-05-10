import { config } from './config/index.js'
import { createLogger } from './utils/logger'
import { SchedulerService } from './infrastructure/scheduler/index.js'
import { OzonService } from './api/ozon/index.js'
import { TelegramService } from './api/telegram/index.js'
import { ProductService } from './domain/products/index.js'
import { UserService } from './domain/users/index.js'
import { AnalyticsService } from './domain/analytics/index.js'
import { readCookiesFromFile } from './utils/helpers.js'
import { ReportService } from './utils/report.js'

import type { CommandHandlerDependencies } from './api/telegram/commands.js'
import type { Product, ProductAnalytics } from './types/index.js'

const logger = createLogger('App')

/**
 * Main application class
 */
export class App {
  private analyticsService: AnalyticsService
  private ozonService: OzonService
  private productService: ProductService
  private reportService: ReportService
  private scheduler: SchedulerService
  private telegramService: TelegramService
  private userService: UserService

  private initialized = false

  /**
   * Initialize all application services
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    logger.info('Initializing application services')

    // Initialize domain services
    this.productService = new ProductService()
    this.userService = new UserService()
    this.analyticsService = new AnalyticsService(this.productService)
    this.reportService = new ReportService()

    logger.info('Domain services initialized')

    // Check or create admin user
    const adminUser = await this.userService.getUser(config.telegram.adminChatId)
    if (!adminUser) {
      await this.userService.createUser(config.telegram.adminChatId)
      await this.userService.setActive(config.telegram.adminChatId, true)
      logger.info('Admin user created and activated')
    }

    // Initialize API services
    const cookies = await readCookiesFromFile('.cookies')
    this.ozonService = new OzonService({ cookies })

    // Create Telegram bot dependencies
    const telegramDependencies: CommandHandlerDependencies = {
      addUser: async (chatId: string) => {
        logger.info(`Creating user ${chatId}`)
        await this.userService.createUser(chatId)
      },

      clearUserProducts: async (chatId: string) => {
        logger.info(`Clearing user products for chat ${chatId}`)
        await this.userService.updateUserProducts(chatId, [])
      },

      getProducts: async (chatId: string) => {
        const userProducts = await this.userService.getUserProducts(chatId)
        const products = await this.productService.getProductsByIds(userProducts)

        return this.getAnalyticsForProducts(products)
      },

      getReport: (chatId: string) => {
        if (chatId !== config.telegram.adminChatId) {
          return '� -B0 :><0=40 4>ABC?=0 B>;L:> 4;O 04<8=8AB@0B>@0'
        }

        return this.reportService.getFormattedReport()
      },

      getUser: async (chatId: string) => {
        return this.userService.getUser(chatId)
      },

      setActive: async (chatId: string, isActive: boolean) => {
        logger.info(`Setting active status for user ${chatId} to ${isActive}`)
        await this.userService.setActive(chatId, isActive)
      },

      setFavoriteList: async (chatId: string, url: string) => {
        logger.info(`Adding favorite list for user ${chatId}`)
        await this.ozonService.init()
        const listId = await this.ozonService.getFavoriteListId(url)
        await this.userService.setFavoriteList(chatId, listId)
        await this.ozonService.close()

        return listId
      },
    }

    // Initialize Telegram service
    this.telegramService = new TelegramService({
      botToken: config.telegram.botToken,
      commandDependencies: telegramDependencies,
    })

    await this.telegramService.init()
    logger.info('Telegram service initialized')

    // Initialize scheduler
    this.scheduler = new SchedulerService(
      this.checkProductsHandler.bind(this),
      {
        baseIntervalMinutes: config.scheduler.checkInterval,
        executeImmediately: true,
      },
    )

    this.initialized = true
    logger.info('Application services initialized')
  }

  /**
   * Start the application
   */
  start(): void {
    if (!this.initialized) {
      throw new Error('Application not initialized')
    }

    logger.info('Starting application')
    this.scheduler.start()
    logger.info('Application started')
  }

  /**
   * Handler for checking products on schedule
   */
  private async checkProductsHandler(): Promise<void> {
    try {
      const users = await this.userService.getAllUsers()
      logger.info(`Found users: ${users.length}`)

      await this.ozonService.init()
      let totalProducts = 0
      let hasErrors = false

      for (const user of users) {
        const { chatId, favoriteListId, isActive } = user

        if (!favoriteListId || !isActive) {
          logger.debug(`Skipping user ${chatId}: favoriteListId=${favoriteListId}, isActive=${isActive}`)
          continue
        }

        try {
          const url = this.getUrlForList(favoriteListId, config.telegram.adminChatId === chatId)
          const products = await this.ozonService.getProducts(url)
          logger.info(`Found ${products.length} products for user ${chatId}`)

          totalProducts += products.length

          // Update product list for user
          await this.userService.updateUserProducts(
            chatId,
            products.map((product) => {
              return product.id
            }),
          )

          // Get analytics and filter for changes
          const analyticsArray = await this.getAnalyticsForProducts(products)
          const changedProducts = analyticsArray.filter((analytics) => {
            return analytics.priceDiffPercent < 0
              || analytics.becameAvailable
              || analytics.becameUnavailable
          },
          )

          logger.info(`Changed products for user ${chatId}: ${changedProducts.length}`)

          // Record statistics
          for (const product of changedProducts) {
            if (product.priceDiffPercent < 0) {
              this.reportService.recordPriceDrop()
            }
            if (product.becameAvailable || product.becameUnavailable) {
              this.reportService.recordAvailabilityChange()
            }
          }

          // Send notifications if there are changes
          if (changedProducts.length > 0) {
            await this.telegramService.sendAnalytics(chatId, changedProducts)
          }
        }
        catch (error) {
          hasErrors = true
          logger.error(`Error during products check for user ${chatId}:`, error)
        }
      }

      this.reportService.recordCheck(!hasErrors, totalProducts)
    }
    catch (error) {
      this.reportService.recordCheck(false, 0)
      logger.error('Error during products check:', error)
    }
    finally {
      await this.ozonService.close()
    }
  }

  /**
   * Get URL for a favorite list
   */
  private getUrlForList(listId: string, isAdmin: boolean): string {
    if (isAdmin) {
      return `https://www.ozon.ru/my/favorites/list?list=${listId}`
    }

    return `https://www.ozon.ru/my/favorites/shared?list=${listId}`
  }

  /**
   * Get analytics for a list of products
   */
  private async getAnalyticsForProducts(products: Product[]): Promise<ProductAnalytics[]> {
    const analyticsArray: ProductAnalytics[] = []

    for (const product of products) {
      await this.productService.saveProduct(product)

      try {
        const analytics = await this.analyticsService.getPriceAnalytics(product.id)
        analyticsArray.push(analytics)
      }
      catch {
        logger.warn(`No price history for product ${product.id} (${product.name})`)
      }
    }

    return analyticsArray
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    logger.info('Stopping application')

    if (this.scheduler) {
      this.scheduler.stop()
    }

    if (this.telegramService) {
      await this.telegramService.stop()
    }

    if (this.productService) {
      await this.productService.close()
    }

    if (this.userService) {
      await this.userService.close()
    }

    if (this.ozonService) {
      await this.ozonService.close()
    }

    this.initialized = false
    logger.info('Application stopped')
  }
}
