import { consola } from 'consola'
import { subMonths } from 'date-fns'

import { StorageService } from './StorageService.js'

import type { PriceHistory, Product } from '../types/index.js'

const logger = consola.withTag('ProductService')
export class ProductService {
  private static readonly PRODUCT_PREFIX = 'product:'
  private static readonly HISTORY_PREFIX = 'history:'
  private readonly storageService: StorageService<Product | PriceHistory>

  constructor() {
    this.storageService = new StorageService<Product | PriceHistory >('db/products')
  }

  async getProduct(productId: string): Promise<Product | null> {
    return await this.storageService.getItem(`product:${productId}`) as Product | null
  }

  async getAllProducts(): Promise<Product[]> {
    const keys = await this.storageService.getAllKeys(ProductService.PRODUCT_PREFIX)
    logger.info(`Found ${keys.length} products`)
    const products = await Promise.all(keys.map(async key => await this.storageService.getItem(key)))

    return products as Product[]
  }

  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    const products = await this.getAllProducts()

    return products.filter(product => productIds.includes(product.id))
  }

  async saveProduct(product: Product): Promise<void> {
    const priceHistory: PriceHistory = {
      productId: product.id,
      price: product.price,
      timestamp: product.timestamp,
      inStock: product.inStock,
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
    const threeMonthsAgo = subMonths(new Date(), 3)
    await this.storageService.clearOldItems(`${ProductService.HISTORY_PREFIX}${productId}`, threeMonthsAgo)
  }

  async getAllProductsIDs(): Promise<string[]> {
    return this.storageService.getAllKeys(ProductService.PRODUCT_PREFIX)
  }

  async clearUnavailableProducts(currentProducts: string[]): Promise<void> {
    const products = await this.getAllProductsIDs()
    for (const product of products) {
      if (!currentProducts.includes(product)) {
        await this.storageService.deleteItem(`${ProductService.PRODUCT_PREFIX}${product}`)
        await this.storageService.deleteItem(`${ProductService.HISTORY_PREFIX}${product}`)
      }
    }
  }

  async close(): Promise<void> {
    await this.storageService.close()
  }
}
