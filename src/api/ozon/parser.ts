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

        // Construct full URL and extract product ID
        const url = window.location.origin + mainProductLink?.getAttribute('href') || ''
        const id = url.match(/\/product\/([^/?]+)/)?.[1] || ''

        // Improved product name extraction with multiple fallback strategies
        let productName = ''

        // Strategy 1: Try to get name from span in mainProductLink (original method)
        const nameElement = mainProductLink?.querySelector('span')
        if (nameElement?.textContent?.trim()) {
          productName = nameElement.textContent.trim()
        }

        // Strategy 2: If no name found, try to look for product title in the item
        if (!productName) {
          // Look for elements that might contain product titles (common class names or attributes)
          const possibleTitleElements = Array.from(item.querySelectorAll(
            '[class*="title"], [class*="name"], [data-widget*="webTitle"], h3, h4, h5, .tsBody500Medium',
          ))

          // Find the first element with text content
          for (const el of possibleTitleElements) {
            if (el.textContent?.trim()) {
              productName = el.textContent.trim()
              break
            }
          }
        }

        // Strategy 3: If still no name, try to get any text from the main product link
        if (!productName && mainProductLink?.textContent?.trim()) {
          productName = mainProductLink.textContent.trim()
        }

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
          name: productName || `Товар ${id}`, // Default name with ID if all extraction methods fail
          price,
          timestamp: new Date()
            .getTime(),
          url,
        }
      })
    })
  }
}
