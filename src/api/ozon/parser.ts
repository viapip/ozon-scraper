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

    return await page.$$eval('.widget-search-result-container .tile-root', (elements) => {
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

          // Match prices in rubles (e.g., 1 000 � or 500�)
          return (/^\d[\d\s]*�$/).test(text)
        })

        // Parse price, handling potential formatting
        const priceText = priceElements[0]?.textContent || '0 �'
        const price = Number.parseFloat(priceText.replace(/[^\d.]/g, ''))

        // Determine stock status (not in stock if price is 0 and "Similar" text exists)
        let inStock = true
        if (price === 0 && item.textContent?.includes('>E>685')) {
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
