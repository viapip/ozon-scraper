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

      // Get previous state to check for changes
      const prevHistoryItem = historyItems.length > 1 ? historyItems[1] : historyItems[0]

      // Availability change detection
      const becameAvailable = !prevHistoryItem.inStock && product.inStock
      const becameUnavailable = prevHistoryItem.inStock && !product.inStock

      // Fix price change calculation when product was previously unavailable
      const prevPrice = prevHistoryItem.price === 0 ? product.price : prevHistoryItem.price
      const priceDiffPercent = product.price && this.calculatePriceChange(product.price, prevPrice)

      return {
        becameAvailable,
        becameUnavailable,
        current: product,
        maxPrice: maxPriceItem,
        minPrice: minPriceItem,
        priceDiffPercent,
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
      return a.priceDiffPercent > 0
    }).length
    const priceDecreasedCount = analytics.filter((a) => {
      return a.priceDiffPercent < 0
    }).length
    const priceUnchangedCount = analytics.filter((a) => {
      return a.priceDiffPercent === 0
    }).length

    const newlyAvailableCount = analytics.filter((a) => {
      return a.becameAvailable
    }).length
    const newlyUnavailableCount = analytics.filter((a) => {
      return a.becameUnavailable
    }).length

    // Calculate average price change for available products
    const availableAnalytics = analytics.filter((a) => {
      return a.current.inStock && a.priceDiffPercent !== 0
    })
    let averagePriceChange = 0

    if (availableAnalytics.length > 0) {
      const totalChange = availableAnalytics.reduce((sum, a) => {
        return sum + a.priceDiffPercent
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
   * Calculate price change as percentage
   */
  private calculatePriceChange(currentPrice: number, originalPrice: number): number {
    if (originalPrice === 0) {
      return 0
    }

    return Math.round(((currentPrice - originalPrice) / originalPrice) * 100)
  }
}
