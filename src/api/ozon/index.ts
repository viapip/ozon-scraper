import type { Product } from '../../types/index'

import { createLogger } from '../../utils/logger'
import { OzonBrowser } from './browser'
import { OzonParser } from './parser'

const logger = createLogger('OzonService')

export interface OzonServiceOptions {
  cookies: string
}

export class OzonService {
  private browser: OzonBrowser
  private initialized = false
  private parser: OzonParser

  constructor(options: OzonServiceOptions) {
    this.browser = new OzonBrowser(options.cookies)
    this.parser = new OzonParser()
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    logger.info('Initializing Ozon service')
    await this.browser.init()
    this.initialized = true
    logger.info('Ozon service initialized')
  }

  /**
   * Get the favorite list ID from a URL
   */
  async getFavoriteListId(favoriteListUrl: string): Promise<string> {
    if (!this.initialized) {
      await this.init()
    }

    const page = this.browser.getPage()

    return this.parser.getFavoriteListId(page, favoriteListUrl)
  }

  /**
   * Get products from a favorite list URL
   */
  async getProducts(favoriteListUrl: string): Promise<Product[]> {
    if (!this.initialized) {
      await this.init()
    }

    try {
      const page = this.browser.getPage()

      logger.info(`Navigating to favorite list: ${favoriteListUrl}`)
      await page.goto(favoriteListUrl, {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      })

      await this.browser.handleAccessRestriction(page)

      logger.info('Waiting for main content to load...')
      await page.waitForSelector('[data-widget="searchResultsV2"]', {
        state: 'visible',
        timeout: 30000,
      })

      // Simulate human behavior
      await this.browser.simulateHumanBehavior(page)

      logger.info('Scrolling page...')
      await this.browser.smoothScrollToBottom(page)

      // Extract products
      const products = await this.parser.extractProducts(page)
      logger.info(`Extracted ${products.length} products`)

      // Save cookies
      await this.browser.saveCookies()

      return products
    }
    catch (error) {
      logger.error('Error loading page:', error)

      try {
        const _page = this.browser.getPage()
        await this.browser.takeScreenshot('reports/error-screenshot.png')
        await this.browser.savePageHtml('reports/error-page.html')
      }
      catch (screenshotError) {
        logger.error('Failed to take error screenshot:', screenshotError)
      }

      throw error
    }
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.browser.close()
      this.initialized = false
      logger.info('Ozon service closed')
    }
  }
}

// Export the service
export default OzonService
