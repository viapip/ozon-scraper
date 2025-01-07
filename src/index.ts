import process from 'node:process'

import { createConsola } from 'consola'
import dotenv from 'dotenv'

import json from '../test-product.json'

import { AnalyticsService } from './services/AnalyticsService.js'
import { BotService } from './services/BotService.js'
import { OzonService } from './services/OzonService.js'
import { ProductService } from './services/ProductService.js'
import { ReportService } from './services/ReportService.js'
import { SchedulerService } from './services/SchedulerService.js'
import { UserService } from './services/UserService.js'
import { readCookiesFromFile } from './utils/helpers.js'

import type { BotServiceDependencies } from './services/BotService.js'
import type { Product, ProductAnalytics } from './types/index.js'

const logger = createConsola()
  .withTag('App')
dotenv.config()

interface AppConfig {
  ozon: {
    userAgent: string
  }
  telegram: {
    botToken: string
    adminChatId: string
  }
}

function validateConfig(): AppConfig {
  const config: AppConfig = {
    ozon: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    },
  }

  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables')
  }
  if (!config.telegram.adminChatId) {
    throw new Error('TELEGRAM_ADMIN_CHAT_ID is required in environment variables')
  }

  return config
}

class AppServices {
  constructor(
    public readonly productService: ProductService,
    public readonly analyticsService: AnalyticsService,
    public readonly botService: BotService,
    public readonly scheduler: SchedulerService,
    public readonly reportService: ReportService,
  ) {}

  async cleanup() {
    this.scheduler.stop()
    await this.botService.stop()
    await this.productService.close()
  }
}

async function initializeServices(config: AppConfig): Promise<AppServices> {
  const productService = new ProductService()
  const analyticsService = new AnalyticsService(productService)
  const userService = new UserService()
  const reportService = new ReportService()
  logger.info('Product services initialized')

  const adminUser = await userService.getUser(config.telegram.adminChatId)
  if (!adminUser) {
    await userService.createUser(config.telegram.adminChatId)
    logger.info('Admin user created')
  }

  const ozonService = new OzonService({
    cookies: await readCookiesFromFile('.cookies'),
    userAgent: config.ozon.userAgent,
  })

  const botDependencies: BotServiceDependencies = {
    getProducts: async (chatId: string) => {
      const userProducts = await userService.getUserProducts(chatId)
      const products = await productService.getProductsByIds(userProducts)

      return getAnalyticsProducts(products, productService, analyticsService)
    },

    clearUserProducts: async (chatId: string) => {
      logger.info(`Clearing user products for chat ${chatId}`)
    },

    addUser: async (chatId: string) => {
      logger.info('Starting bot')
      await userService.createUser(chatId)
    },

    setActive: async (chatId: string, isActive: boolean) => {
      logger.info(`Setting active status for chat ${chatId} to ${isActive}`)
      await userService.setActive(chatId, isActive)
    },

    getUser: async (chatId: string) => await userService.getUser(chatId),

    setFavoriteList: async (chatId: string, url: string) => {
      logger.info(`Adding favorite list for chat ${chatId}`)
      await ozonService.init()
      const listId = await ozonService.getFavoriteListId(url)
      await userService.setFavoriteList(chatId, listId)
      await ozonService.close()

      return listId
    },

    stop: async (chatId: string) => {
      logger.info('Cancelling bot')
      await userService.removeFavoriteList(chatId)
    },

    getReport: (chatId: string) => {
      if (chatId !== config.telegram.adminChatId) {
        return '⛔️ This command is only available for admin'
      }

      return reportService.getFormattedReport()
    },
  }

  const botService = new BotService(
    config.telegram.botToken,
    botDependencies,
  )

  const checkProductsHandler = createCheckProductsHandler(
    ozonService,
    productService,
    analyticsService,
    botService,
    userService,
    reportService,
    config,
  )

  const scheduler = new SchedulerService(checkProductsHandler)

  await botService.init()

  return new AppServices(
    productService,
    analyticsService,
    botService,
    scheduler,
    reportService,
  )
}

function getUrlList(listId: string, isAdmin: boolean): string {
  // if (isAdmin) {
  //   return `https://www.ozon.ru/my/favorites/list?list=${listId}`
  // }

  return `https://www.ozon.ru/my/favorites/shared?list=${listId}`
}

function createCheckProductsHandler(
  ozonService: OzonService,
  productService: ProductService,
  analyticsService: AnalyticsService,
  botService: BotService,
  userService: UserService,
  reportService: ReportService,
  config: AppConfig,
) {
  return async () => {
    try {
      const users = await userService.getAllUsers()
      logger.info(`Found users: ${users.length}`)

      await ozonService.init()
      let totalProducts = 0
      let hasErrors = false

      for (const user of users) {
        const { favoriteListId, chatId } = user
        logger.info(`User: ${chatId}`)

        if (!favoriteListId) {
          logger.info(`User ${chatId} has no favorite list`)
          continue
        }
        try {
          const url = getUrlList(favoriteListId, config.telegram.adminChatId === chatId)
          const products = await ozonService.getProducts(url)
          // logger.info(JSON.stringify(products, null, 2))
          // const products = json as Product[]
          logger.info(`Found products: ${products.length}`)

          totalProducts += products.length
          logger.info(`Found products: ${products.length}`)
          const analyticsArray = await getAnalyticsProducts(products, productService, analyticsService)

          await userService.updateUserProducts(chatId, products.map(product => product.id))

          const discountedProducts = analyticsArray.filter(analytics => analytics.priceDiffPercent < 0 || analytics.becameAvailable || analytics.becameUnavailable)

          logger.info(`Discounted products for ${chatId}: ${discountedProducts.length}`)

          if (discountedProducts.length > 0) {
            for (const product of discountedProducts) {
              if (product.priceDiffPercent < 0) {
                reportService.recordPriceDrop()
              }
              if (product.becameAvailable || product.becameUnavailable) {
                reportService.recordAvailabilityChange()
              }
            }
            await botService.sendAnalytics(chatId, discountedProducts)
          }
        }
        catch (error) {
          hasErrors = true
          logger.error(`Error during products check for ${chatId}:`, error)
          continue
        }
      }

      reportService.recordCheck(!hasErrors, totalProducts)
    }
    catch (error) {
      reportService.recordCheck(false, 0)
      logger.error('Error during products check:', error)
    }
    finally {
      if (ozonService) {
        await ozonService.close()
      }
    }
  }
}

async function getAnalyticsProducts(
  products: Product[],
  productService: ProductService,
  analyticsService: AnalyticsService,
): Promise<ProductAnalytics[]> {
  const analyticsArray: ProductAnalytics[] = []

  for (const product of products) {
    await productService.saveProduct(product)

    try {
      const analytics = await analyticsService.getPriceAnalytics(product.id)
      analyticsArray.push(analytics)
    }
    catch (error) {
      logger.warn(`No price history for ${product.name}`)
      logger.debug('Price history error:', error)
    }
  }

  return analyticsArray
}

async function main() {
  let services: AppServices | null = null
  let config: AppConfig | null = null
  try {
    config = validateConfig()
    services = await initializeServices(config)

    services.scheduler.start()
    await services.scheduler.checkNow() // Initial check

    const cleanup = async () => {
      if (services) {
        await services.cleanup()
      }
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
  catch (error) {
    if (services && config) {
      await services.botService.sendTelegramMessage(config.telegram.adminChatId, 'Critical error')
    }

    logger.error('Critical error:', error)
    process.exit(1)
  }
}

main()
