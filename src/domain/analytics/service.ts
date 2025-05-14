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

      // Get previous state to check for changes
      const prevHistoryItem = historyItems.length > 1 ? historyItems[1] : historyItems[0]

      // Availability change detection
      const becameAvailable = !prevHistoryItem.inStock && product.inStock
      const becameUnavailable = prevHistoryItem.inStock && !product.inStock

      // Calculate discount from median price
      const discountFromMedianPercent = this.calculateDiscountFromMedian(
        product.price,
        medianPriceItem.price,
      )

      return {
        becameAvailable,
        becameUnavailable,
        current: product,
        discountFromMedianPercent,
        maxPrice: maxPriceItem,
        medianPrice: medianPriceItem,
        minPrice: minPriceItem,
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
   */
  private findExtremePrice(history: PriceHistory[], type: 'max' | 'min'): PriceHistory {
    return history.reduce((extreme, current) => {
      // Skip items where product is not available (price is 0)
      if (!extreme.inStock || !current.inStock) {
        return current.inStock ? current : extreme
      }

      const comparison = type === 'min'
        ? current.price < extreme.price
        : current.price > extreme.price

      return comparison ? current : extreme
    }, history[0])
  }

  /**
   * Calculate median price from history
   */
  private calculateMedianPrice(history: PriceHistory[]): PriceHistory {
    // Filter out unavailable items (price === 0)
    const availableItems = history.filter((item) => {
      return item.inStock && item.price > 0
    })

    if (availableItems.length === 0) {
      return history[0] // Return first element if no available items
    }

    // Sort by price
    const sortedItems = [...availableItems].sort((a, b) => {
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
   */
  private calculateDiscountFromMedian(currentPrice: number, medianPrice: number): number {
    if (medianPrice === 0) {
      return 0
    }

    return Math.round(((currentPrice - medianPrice) / medianPrice) * 100)
  }
}
