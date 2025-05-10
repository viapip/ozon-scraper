import { subMonths } from 'date-fns'

import type { PriceHistory, Product } from '../../types'

import { LevelDBStorage } from '../../infrastructure/storage/index'
import { createLogger } from '../../utils/logger'

const logger = createLogger('ProductRepository')

/**
 * Repository for managing product data storage
 */
export class ProductRepository {
  private static readonly HISTORY_PREFIX = 'history:'
  private static readonly PRODUCT_PREFIX = 'product:'
  private readonly storage

  constructor() {
    this.storage = new LevelDBStorage<PriceHistory | Product>('products')
  }

  /**
   * Get a product by ID
   */
  async getProduct(productId: string): Promise<null | Product> {
    return await this.storage.getItem(this.getProductKey(productId)) as null | Product
  }

  /**
   * Get all products
   */
  async getAllProducts(): Promise<Product[]> {
    logger.debug('Getting all products')
    const products = await this.storage.getAllItems(ProductRepository.PRODUCT_PREFIX)
    logger.info(`Found ${products.length} products`)

    return products as Product[]
  }

  /**
   * Get products by ID list
   */
  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    const productPromises = productIds.map((id) => {
      return this.getProduct(id)
    })
    const products = await Promise.all(productPromises)

    return products.filter(Boolean) as Product[]
  }

  /**
   * Save a product
   */
  async saveProduct(product: Product): Promise<void> {
    await this.storage.saveItem(this.getProductKey(product.id), product)
  }

  /**
   * Save price history for a product
   */
  async savePriceHistory(productId: string, history: PriceHistory): Promise<void> {
    await this.storage.saveItem(this.getHistoryKey(productId, history.timestamp), history)
  }

  /**
   * Get price history for a product within a specified period
   */
  async getProductHistoryByPeriod(productId: string, period: number): Promise<PriceHistory[]> {
    const history: PriceHistory[] = []
    const cutoffDate = subMonths(new Date(), period)

    // Retrieve all history keys for the specific product
    const historyItems = await this.storage.getAllItems(`${ProductRepository.HISTORY_PREFIX}${productId}:`) as PriceHistory[]

    for (const item of historyItems) {
      if (item.timestamp > cutoffDate.getTime()) {
        history.push(item)
      }
    }

    // Sort history by timestamp (newest first)
    return history.sort((a, b) => {
      return b.timestamp - a.timestamp
    })
  }

  /**
   * Clear old price history for a product
   */
  async clearOldHistory(productId: string, monthsToKeep = 3): Promise<void> {
    const cutoffDate = subMonths(new Date(), monthsToKeep)
    await this.storage.clearOldItems(`${ProductRepository.HISTORY_PREFIX}${productId}`, cutoffDate)
  }

  /**
   * Get all product IDs
   */
  async getAllProductIds(): Promise<string[]> {
    const keys = await this.storage.getAllKeys(ProductRepository.PRODUCT_PREFIX)

    return keys.map((key) => {
      return key.replace(ProductRepository.PRODUCT_PREFIX, '')
    })
  }

  /**
   * Delete a product and its history
   */
  async deleteProduct(productId: string): Promise<void> {
    await this.storage.deleteItem(this.getProductKey(productId))

    // Delete history
    const historyKeys = await this.storage.getAllKeys(`${ProductRepository.HISTORY_PREFIX}${productId}:`)
    for (const key of historyKeys) {
      await this.storage.deleteItem(key)
    }
  }

  /**
   * Close the repository connection
   */
  async close(): Promise<void> {
    await this.storage.close()
  }

  /**
   * Get a product key
   */
  private getProductKey(productId: string): string {
    return `${ProductRepository.PRODUCT_PREFIX}${productId}`
  }

  /**
   * Get a history key
   */
  private getHistoryKey(productId: string, timestamp: number): string {
    return `${ProductRepository.HISTORY_PREFIX}${productId}:${timestamp}`
  }
}
