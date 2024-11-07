import process from 'node:process'

import { createConsola } from 'consola'
import dotenv from 'dotenv'

import { AnalyticsService } from './services/AnalyticsService.js'
import { BotService } from './services/BotService.js'
import { OzonService } from './services/OzonService.js'
import { ProductService } from './services/ProductService.js'
import { SchedulerService } from './services/SchedulerService.js'
import { readCookiesFromFile } from './utils/helpers.js'

import type { Product, ProductAnalytics } from './types/index.js'

const logger = createConsola()
dotenv.config()

interface AppConfig {
  ozon: {
    favoriteListUrl: string
    userAgent: string
  }
  telegram: {
    botToken: string
    chatIds: string
  }
}

function validateConfig(): AppConfig {
  const config: AppConfig = {
    ozon: {
      favoriteListUrl: process.env.OZON_FAVORITES_URL || '',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatIds: process.env.TELEGRAM_CHAT_IDS || '',
    },
  }

  if (!config.ozon.favoriteListUrl) {
    throw new Error('OZON_FAVORITES_URL is required in environment variables')
  }
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables')
  }
  if (!config.telegram.chatIds) {
    throw new Error('TELEGRAM_CHAT_IDS is required in environment variables')
  }

  return config
}

class AppServices {
  constructor(
    public readonly productService: ProductService,
    public readonly analyticsService: AnalyticsService,
    public readonly botService: BotService,
    public readonly scheduler: SchedulerService,
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
  logger.info('Product services initialized')

  const botService = new BotService(config.telegram.botToken, config.telegram.chatIds)

  const checkProductsHandler = createCheckProductsHandler(
    productService,
    analyticsService,
    botService,
    config,
  )

  const scheduler = new SchedulerService(checkProductsHandler)

  await botService.init(async () => {
    const products = await productService.getAllProducts()

    return getAnalyticsProducts(products, productService, analyticsService)
  })

  return new AppServices(productService, analyticsService, botService, scheduler)
}

function createCheckProductsHandler(
  productService: ProductService,
  analyticsService: AnalyticsService,
  botService: BotService,
  config: AppConfig,
) {
  return async () => {
    try {
      const cookies = await readCookiesFromFile('.cookies')
      const ozonService = new OzonService({
        favoriteListUrl: config.ozon.favoriteListUrl,
        cookies,
        userAgent: config.ozon.userAgent,
      })

      await ozonService.init()
      const products = await ozonService.getProducts()
      logger.info(`Found products: ${products.length}`)

      const analyticsArray = await getAnalyticsProducts(products, productService, analyticsService)
      const discountedProducts = analyticsArray.filter(analytics => analytics.priceDiffPercent < 0)

      logger.info(`Discounted products: ${discountedProducts.length}`)

      if (discountedProducts.length > 0) {
        await botService.sendAnalytics(discountedProducts)
      }

      await ozonService.close()
    }
    catch (error) {
      logger.error('Error during products check:', error)
      // throw error
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
  try {
    const config = validateConfig()
    const services = await initializeServices(config)

    services.scheduler.start()
    await services.scheduler.checkNow() // Initial check

    const cleanup = async () => {
      await services.cleanup()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
  catch (error) {
    logger.error('Critical error:', error)
    process.exit(1)
  }
}

main()
