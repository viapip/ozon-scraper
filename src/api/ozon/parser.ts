import type { Page } from 'playwright'

import type { Product } from '../../types'

import { createLogger } from '../../utils/logger'

const logger = createLogger('OzonParser')

export class OzonParser {
  /**
   * Retrieve the shared favorite list ID from a given URL
   */
  async getFavoriteListId(page: Page, favoriteListUrl: string): Promise<string> {
    await page.goto(favoriteListUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    })

    const finalUrl = page.url()
    const url = new URL(finalUrl)

    const listId = url.searchParams.get('list')

    if (!listId) {
      throw new Error('Failed to get favorite list ID from URL')
    }

    return listId
  }

  /**
   * Extract product details from the page
   */
  async extractProducts(page: Page): Promise<Product[]> {
    logger.info('Extracting products from page')

    return await page.$$eval('div[data-widget="tileGridDesktop"] .tile-root', (elements) => {
      return elements.map((item) => {
      // Find all product links and use the last one (most specific)
        const productLinks = Array.from(item.querySelectorAll('a[href*="/product/"]'))
        const mainProductLink = productLinks[productLinks.length - 1] as HTMLAnchorElement

        const nameElement = mainProductLink?.querySelector('span')

        // Construct full URL and extract product ID
        const url = window.location.origin + mainProductLink?.getAttribute('href') || ''
        const id = url.match(/\/product\/([^/?]+)/)?.[1] || ''

        // Find price elements using a regex to match price format
        const allTextElements = Array.from(item.querySelectorAll('*'))
        const priceElements = allTextElements.filter((el) => {
          const text = el.textContent?.trim() || ''

          // Match prices in rubles (e.g., 1 000 ₽ or 500₽)
          return (/^\d[\d\s]*₽$/).test(text)
        })

        // Parse price, handling potential formatting
        const priceText = priceElements[0]?.textContent || '0 ₽'
        const price = Number.parseFloat(priceText.replace(/[^\d.]/g, ''))

        // Determine stock status using multiple indicators
        let inStock = true

        // Check for out-of-stock indicators
        const itemText = item.textContent || ''
        const outOfStockIndicators = [
          'Похожие', // "Similar" items shown
          'Нет в наличии', // "Out of stock"
          'Товар закончился', // "Product sold out"
          'Этот товар больше не продаётся', // "This product is no longer sold"
          'Товар временно недоступен', // "Product temporarily unavailable"
        ]

        // Product is considered out of stock if:
        // 1. Price is 0, OR
        // 2. Any out-of-stock indicators are present in the item text
        if (price === 0 || outOfStockIndicators.some((indicator) => {
          return itemText.includes(indicator)
        })) {
          inStock = false
        }

        return {
          id,
          inStock,
          name: nameElement?.textContent?.trim() || '',
          price,
          timestamp: new Date()
            .getTime(),
          url,
        }
      })
    })
  }
}
