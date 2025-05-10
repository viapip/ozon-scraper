import { createLogger } from '../../utils/logger'
import { ProductRepository } from './repository'
import type { PriceHistory, Product } from '../../types/index'

const logger = createLogger('ProductService')

/**
 * Service for managing products and price history
 */
export class ProductService {
  private repository: ProductRepository

  constructor() {
    this.repository = new ProductRepository()
  }

  /**
   * Get a product by ID
   */
  async getProduct(productId: string): Promise<null | Product> {
    return this.repository.getProduct(productId)
  }

  /**
   * Get all products
   */
  async getAllProducts(): Promise<Product[]> {
    return this.repository.getAllProducts()
  }

  /**
   * Get products by IDs
   */
  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    return this.repository.getProductsByIds(productIds)
  }

  /**
   * Save a product with its price history
   */
  async saveProduct(product: Product): Promise<void> {
    try {
      // Save the product
      await this.repository.saveProduct(product)

      // Create and save price history
      const priceHistory: PriceHistory = {
        inStock: product.inStock,
        price: product.price,
        productId: product.id,
        timestamp: product.timestamp,
      }

      await this.repository.savePriceHistory(product.id, priceHistory)
      logger.debug(`Saved product ${product.id} with price history`)
    }
    catch (error) {
      logger.error('Failed to save product:', error)
      throw error
    }
  }

  /**
   * Update multiple products at once
   */
  async updateProducts(products: Product[]): Promise<void> {
    logger.info(`Updating ${products.length} products`)
    for (const product of products) {
      await this.saveProduct(product)
    }
  }

  /**
   * Get price history for a product within a period
   */
  async getProductHistoryByPeriod(productId: string, period: number): Promise<PriceHistory[]> {
    try {
      const history = await this.repository.getProductHistoryByPeriod(productId, period)

      if (history.length === 0) {
        logger.warn(`No price history found for product ${productId}`)

        return []
      }

      return history
    }
    catch (error) {
      logger.error(`Failed to get price history for product ${productId}:`, error)

      return []
    }
  }

  /**
   * Clear old price history
   */
  async clearOldHistory(productId: string, monthsToKeep = 3): Promise<void> {
    await this.repository.clearOldHistory(productId, monthsToKeep)
  }

  /**
   * Get all product IDs
   */
  async getAllProductIds(): Promise<string[]> {
    return this.repository.getAllProductIds()
  }

  /**
   * Clear unavailable products that are no longer in the specified list
   */
  async clearUnavailableProducts(currentProductIds: string[]): Promise<void> {
    const allProductIds = await this.repository.getAllProductIds()
    const productsToRemove = allProductIds.filter((id) => {
      return !currentProductIds.includes(id)
    })

    if (productsToRemove.length > 0) {
      logger.info(`Removing ${productsToRemove.length} unavailable products`)

      for (const productId of productsToRemove) {
        await this.repository.deleteProduct(productId)
      }
    }
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.repository.close()
  }
}
