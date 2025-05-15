import type { PriceHistory, ProductAnalytics } from '../../types'
import type { ProductService } from '../products/service'
import type { AnalyticsSummary } from './types'

import { createLogger } from '../../utils/logger'

const logger = createLogger('AnalyticsService')

/**
 * Service for analyzing product price history and generating insights
 */
export class AnalyticsService {
  constructor(private productService: ProductService) {}

  /**
   * Check if a product was ever in stock based on its price history
   */
  private wasEverInStock(history: PriceHistory[]): boolean {
    // Check if any history item has inStock=true
    return history.some((item) => {
      return item.inStock
    })
  }

  /**
   * Get price analytics for a product
   */
  async getPriceAnalytics(productId: string): Promise<ProductAnalytics> {
    try {
      const [history, product] = await Promise.all([
        this.productService.getProductHistoryByPeriod(productId, 3),
        this.productService.getProduct(productId),
      ])

      if (!product) {
        throw new Error(`Product not found: ${productId}`)
      }

      // If no history is available, use the current product as the only history point
      const historyItems = history.length > 0
        ? history
        : [
            {
              inStock: product.inStock,
              price: product.price,
              productId: product.id,
              timestamp: product.timestamp,
            },
          ]

      const minPriceItem = this.findExtremePrice(historyItems, 'min')
      const maxPriceItem = this.findExtremePrice(historyItems, 'max')
      const medianPriceItem = this.calculateMedianPrice(historyItems)

      // Check if product was ever in stock
      const wasEverInStock = this.wasEverInStock(historyItems)

      // Get previous state to check for changes
      const prevHistoryItem = historyItems.length > 1 ? historyItems[1] : historyItems[0]

      // Availability change detection
      const becameAvailable = !prevHistoryItem.inStock && product.inStock

      // Special case for products that come back in stock after being unavailable
      const cameBackInStock = becameAvailable && wasEverInStock

      const becameUnavailable = prevHistoryItem.inStock && !product.inStock

      // Calculate discount from median price
      // For out-of-stock products (price 0), we set discount to 0
      const discountFromMedianPercent = (!product.inStock && product.price === 0)
        ? 0
        : this.calculateDiscountFromMedian(
            product.price,
            medianPriceItem.price,
          )

      // Determine if product was never in stock
      const neverInStock = !wasEverInStock && !product.inStock

      return {
        becameAvailable,
        becameUnavailable,
        cameBackInStock,
        current: product,
        discountFromMedianPercent,
        maxPrice: maxPriceItem,
        medianPrice: medianPriceItem,
        minPrice: minPriceItem,
        neverInStock,
        // Include edge case fields
        wasEverInStock,
      }
    }
    catch (error) {
      logger.error(`Failed to get price analytics for product ${productId}:`, error)
      throw error
    }
  }

  /**
   * Get analytics for multiple products
   */
  async getProductsAnalytics(productIds: string[]): Promise<ProductAnalytics[]> {
    const analyticsPromises = productIds.map((id) => {
      return this.getPriceAnalytics(id)
    })
    try {
      return await Promise.all(analyticsPromises)
    }
    catch (error) {
      logger.error('Failed to get analytics for multiple products:', error)

      return []
    }
  }

  /**
   * Generate a summary of analytics data
   */
  summarizeAnalytics(analytics: ProductAnalytics[]): AnalyticsSummary {
    const totalProducts = analytics.length
    const availableProducts = analytics.filter((a) => {
      return a.current.inStock
    }).length
    const unavailableProducts = totalProducts - availableProducts

    const priceIncreasedCount = analytics.filter((a) => {
      return a.discountFromMedianPercent > 0
    }).length
    const priceDecreasedCount = analytics.filter((a) => {
      return a.discountFromMedianPercent < 0
    }).length
    const priceUnchangedCount = analytics.filter((a) => {
      return a.discountFromMedianPercent === 0
    }).length

    const newlyAvailableCount = analytics.filter((a) => {
      return a.becameAvailable
    }).length
    const newlyUnavailableCount = analytics.filter((a) => {
      return a.becameUnavailable
    }).length

    // Calculate average price change for available products
    const availableAnalytics = analytics.filter((a) => {
      return a.current.inStock && a.discountFromMedianPercent !== 0
    })
    let averagePriceChange = 0

    if (availableAnalytics.length > 0) {
      const totalChange = availableAnalytics.reduce((sum, a) => {
        return sum + a.discountFromMedianPercent
      }, 0)
      averagePriceChange = Math.round(totalChange / availableAnalytics.length)
    }

    return {
      availableProducts,
      averagePriceChange,
      newlyAvailableCount,
      newlyUnavailableCount,
      priceDecreasedCount,
      priceIncreasedCount,
      priceUnchangedCount,
      totalProducts,
      unavailableProducts,
    }
  }

  /**
   * Find the minimum or maximum price in history
   * Ignores entries with price 0 and inStock:false
   */
  private findExtremePrice(history: PriceHistory[], type: 'max' | 'min'): PriceHistory {
    // Filter out unavailable items with price 0 AND items where price is 0 regardless of stock status
    // We want to ignore ALL zero prices for min/max calculation
    const validPriceItems = history.filter((item) => {
      return item.price > 0
    })

    // If no items available after filtering, return first history item
    if (validPriceItems.length === 0) {
      return history[0]
    }

    return validPriceItems.reduce((extreme, current) => {
      const comparison = type === 'min'
        ? current.price < extreme.price
        : current.price > extreme.price

      return comparison ? current : extreme
    }, validPriceItems[0])
  }

  /**
   * Calculate median price from history
   * Excludes all entries with price 0 from calculations
   */
  private calculateMedianPrice(history: PriceHistory[]): PriceHistory {
    // For median calculation, we'll use only items with prices > 0
    const validPriceItems = history.filter((item) => {
      return item.price > 0
    })

    // If no valid items found after filtering, return the first history item
    if (validPriceItems.length === 0) {
      return history[0]
    }

    // Sort by price
    const sortedItems = [...validPriceItems].sort((a, b) => {
      return a.price - b.price
    })

    // Get median element
    const medianIndex = Math.floor(sortedItems.length / 2)

    return sortedItems.length % 2 === 0
      ? sortedItems[medianIndex - 1]
      : sortedItems[medianIndex]
  }

  /**
   * Calculate price change as percentage
   */
  private calculatePriceChange(currentPrice: number, originalPrice: number): number {
    if (originalPrice === 0) {
      return 0
    }

    return Math.round(((currentPrice - originalPrice) / originalPrice) * 100)
  }

  /**
   * Calculate discount from median price as percentage
   * Returns 0 for out-of-stock products with price 0
   */
  private calculateDiscountFromMedian(currentPrice: number, medianPrice: number): number {
    // If either price is invalid, return 0
    if (medianPrice === 0 || currentPrice === 0) {
      return 0
    }

    return Math.round(((currentPrice - medianPrice) / medianPrice) * 100)
  }
}
