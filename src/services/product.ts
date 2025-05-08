import { subMonths } from 'date-fns'

import { createLogger } from '../utils/logger.js'

import { StorageService } from './storage.js'

import type { PriceHistory, Product } from '../types/index.js'

const logger = createLogger('ProductService')
export class ProductService {
  private static readonly HISTORY_PREFIX = 'history:'
  private static readonly PRODUCT_PREFIX = 'product:'

  private readonly storageService: StorageService<PriceHistory | Product>

  constructor() {
    this.storageService = new StorageService<PriceHistory | Product >('db/products')
  }

  async getProduct(productId: string): Promise<null | Product> {
    return await this.storageService.getItem(`product:${productId}`) as null | Product
  }

  async getAllProducts(): Promise<Product[]> {
    // Retrieve all product keys and fetch their corresponding items
    const keys = await this.storageService.getAllKeys(ProductService.PRODUCT_PREFIX)
    logger.info(`Found ${keys.length} products`)
    const products = await Promise.all(keys.map(async (key) => {
      return await this.storageService.getItem(key)
    }))

    return products as Product[]
  }

  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    const products = await this.getAllProducts()

    return products.filter((product) => {
      return productIds.includes(product.id)
    })
  }

  async saveProduct(product: Product): Promise<void> {
    const priceHistory: PriceHistory = {
      inStock: product.inStock,
      price: product.price,
      productId: product.id,
      timestamp: product.timestamp,
    }

    try {
      await this.saveProductIfNotExists(product)
      await this.savePriceHistory(product.id, priceHistory)
    }
    catch (error) {
      logger.error('Failed to save product:', error)
      throw error
    }
  }

  private async saveProductIfNotExists(product: Product): Promise<void> {
    const productKey = this.getProductKey(product.id)

    await this.storageService.saveItem(productKey, product)
  }

  private async savePriceHistory(productId: string, history: PriceHistory): Promise<void> {
    const historyKey = this.getHistoryKey(productId, history.timestamp)
    await this.storageService.saveItem(historyKey, history)
  }

  private getProductKey(productId: string): string {
    return `${ProductService.PRODUCT_PREFIX}${productId}`
  }

  private getHistoryKey(productId: string, timestamp: number): string {
    return `${ProductService.HISTORY_PREFIX}${productId}:${timestamp}`
  }

  async getProductHistoryByPeriod(productId: string, period: number): Promise<PriceHistory[]> {
    const history: PriceHistory[] = []

    const cutoffDate = subMonths(new Date(), period)

    // Retrieve all history keys for the specific product
    const keys = await this.storageService.getAllKeys(`${ProductService.HISTORY_PREFIX}${productId}:`)
    for (const key of keys) {
      const historyItem = await this.storageService.getItem(key)
      if (historyItem?.timestamp && historyItem.timestamp > cutoffDate.getTime()) {
        history.push(historyItem as PriceHistory)
      }
    }

    if (history.length === 0) {
      throw new Error(`No price history found for product ${productId}`)
    }

    return history
  }

  async clearOldHistory(productId: string): Promise<void> {
    // Remove price history older than 3 months
    const threeMonthsAgo = subMonths(new Date(), 3)
    await this.storageService.clearOldItems(`${ProductService.HISTORY_PREFIX}${productId}`, threeMonthsAgo)
  }

  async getAllProductsIDs(): Promise<string[]> {
    return this.storageService.getAllKeys(ProductService.PRODUCT_PREFIX)
  }

  async clearUnavailableProducts(currentProducts: string[]): Promise<void> {
    // Remove products and their history that are no longer in the current list
    const products = await this.getAllProductsIDs()
    for (const product of products) {
      if (!currentProducts.includes(product)) {
        await this.storageService.deleteItem(`${ProductService.PRODUCT_PREFIX}${product}`)
        await this.storageService.deleteItem(`${ProductService.HISTORY_PREFIX}${product}`)
      }
    }
  }

  async close(): Promise<void> {
    // Close the storage service connection
    await this.storageService.close()
  }
}
