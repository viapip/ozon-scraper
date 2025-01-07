import consola from 'consola'

import type { ProductService } from './ProductService.js'
import type { PriceHistory, ProductAnalytics } from '../types/index.js'

// const logger = consola.withTag('AnalyticsService')
export class AnalyticsService {
  constructor(private productService: ProductService) {}

  async getPriceAnalytics(productId: string): Promise<ProductAnalytics> {
    const [history, product] = await Promise.all([
      this.productService.getProductHistoryByPeriod(productId, 3),
      this.productService.getProduct(productId),
    ])

    if (!product) {
      throw new Error(`Product not found: ${productId}`)
    }

    const minPriceItem = this.findExtremePrice(history, 'min')
    const maxPriceItem = this.findExtremePrice(history, 'max')
    const prevHistoryItem = history[history.length - 2] || product
    const becameAvailable = !prevHistoryItem.inStock && product.inStock
    const becameUnavailable = prevHistoryItem.inStock && !product.inStock

    // fix infinite price change when product is not available
    const prevPrice = prevHistoryItem.price === 0 ? product.price : prevHistoryItem.price

    const priceDiffPercent = product.price && this.calculatePriceChange(product.price, prevPrice)

    return {
      minPrice: minPriceItem,
      maxPrice: maxPriceItem,
      current: product,
      priceDiffPercent,
      becameAvailable,
      becameUnavailable,
    }
  }

  private findExtremePrice(history: PriceHistory[], type: 'min' | 'max'): PriceHistory {
    return history.reduce((extreme, current) => {
      // fix for min price when product is not available
      if (!extreme.inStock || !current.inStock) {
        return current.inStock ? current : extreme
      }

      const comparison = type === 'min'
        ? current.price < extreme.price
        : current.price > extreme.price

      return comparison ? current : extreme
    }, history[0])
  }

  private calculatePriceChange(currentPrice: number, originalPrice: number): number {
    return Math.round(((currentPrice - originalPrice) / originalPrice) * 100)
  }
}
