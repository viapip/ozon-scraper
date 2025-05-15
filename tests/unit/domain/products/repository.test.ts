import type { PriceHistory, Product } from '~/types'

import { ProductRepository } from '~/domain/products/repository'
import { LevelDBStorage } from '~/infrastructure/storage/leveldb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock LevelDBStorage
vi.mock('~/infrastructure/storage/leveldb', () => {
  return {
    LevelDBStorage: vi.fn(() => {
      return {
        clearOldItems: vi.fn(),
        close: vi.fn(),
        deleteItem: vi.fn(),
        getAllItems: vi.fn(),
        getAllKeys: vi.fn(),
        getItem: vi.fn(),
        saveItem: vi.fn(),
      }
    }),
  }
})

// Mock the logger
vi.mock('~/utils/logger', () => {
  return {
    createLogger: () => {
      return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      }
    },
  }
})

// Mock date-fns
vi.mock('date-fns', () => {
  return {
    subMonths: vi.fn((date, months) => {
      const result = new Date(date)
      result.setMonth(result.getMonth() - months)

      return result
    }),
  }
})

describe('productRepository', () => {
  let productRepository: ProductRepository
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = new LevelDBStorage('products')
    productRepository = new ProductRepository()
    // @ts-expect-error: Accessing private property for testing
    productRepository.storage = mockStorage
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getProduct', () => {
    it('should return a product when found', async () => {
      const mockProduct: Product = {
        id: 'test123',
        inStock: true,
        name: 'Test Product',
        price: 1000,
        timestamp: Date.now(),
        url: 'https://example.com/product/123',
      }

      mockStorage.getItem.mockResolvedValue(mockProduct)

      const result = await productRepository.getProduct('test123')

      expect(mockStorage.getItem)
        .toHaveBeenCalledWith('product:test123')
      expect(result)
        .toEqual(mockProduct)
    })

    it('should return null when product is not found', async () => {
      mockStorage.getItem.mockResolvedValue(null)

      const result = await productRepository.getProduct('nonexistent')

      expect(mockStorage.getItem)
        .toHaveBeenCalledWith('product:nonexistent')
      expect(result)
        .toBeNull()
    })
  })

  describe('getAllProducts', () => {
    it('should return all products', async () => {
      const mockProducts: Product[] = [
        {
          id: 'test1',
          inStock: true,
          name: 'Test Product 1',
          price: 1000,
          timestamp: Date.now(),
          url: 'https://example.com/product/1',
        },
        {
          id: 'test2',
          inStock: false,
          name: 'Test Product 2',
          price: 2000,
          timestamp: Date.now(),
          url: 'https://example.com/product/2',
        },
      ]

      mockStorage.getAllItems.mockResolvedValue(mockProducts)

      const result = await productRepository.getAllProducts()

      expect(mockStorage.getAllItems)
        .toHaveBeenCalledWith('product:')
      expect(result)
        .toEqual(mockProducts)
      expect(result.length)
        .toBe(2)
    })
  })

  describe('saveProduct', () => {
    it('should save a product', async () => {
      const mockProduct: Product = {
        id: 'test123',
        inStock: true,
        name: 'Test Product',
        price: 1000,
        timestamp: Date.now(),
        url: 'https://example.com/product/123',
      }

      await productRepository.saveProduct(mockProduct)

      expect(mockStorage.saveItem)
        .toHaveBeenCalledWith('product:test123', mockProduct)
    })
  })

  describe('savePriceHistory', () => {
    it('should save price history for a product', async () => {
      const timestamp = Date.now()
      const mockHistory: PriceHistory = {
        inStock: true,
        price: 1000,
        productId: 'test123',
        timestamp,
      }

      await productRepository.savePriceHistory('test123', mockHistory)

      expect(mockStorage.saveItem)
        .toHaveBeenCalledWith(`history:test123:${timestamp}`, mockHistory)
    })
  })

  describe('getProductHistoryByPeriod', () => {
    it('should return price history filtered by period', async () => {
      const now = Date.now()
      const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000

      const mockHistory: PriceHistory[] = [
        { inStock: true, price: 1000, productId: 'test123', timestamp: now },
        { inStock: true, price: 1200, productId: 'test123', timestamp: now - 30 * 24 * 60 * 60 * 1000 },
        { inStock: true, price: 1500, productId: 'test123', timestamp: threeMonthsAgo - 1000 }, // Just outside the 3 month period
      ]

      mockStorage.getAllItems.mockResolvedValue(mockHistory)

      const result = await productRepository.getProductHistoryByPeriod('test123', 3)

      expect(mockStorage.getAllItems)
        .toHaveBeenCalledWith('history:test123:')
      // Only the first two items should be included (within 3 months)
      expect(result.length)
        .toBe(2)
      // Should be sorted by timestamp (newest first)
      expect(result[0].timestamp)
        .toBe(now)
      expect(result[1].timestamp)
        .toBe(now - 30 * 24 * 60 * 60 * 1000)
    })
  })

  describe('getAllProductIds', () => {
    it('should return all product IDs', async () => {
      mockStorage.getAllKeys.mockResolvedValue([
        'product:test1',
        'product:test2',
        'product:test3',
      ])

      const result = await productRepository.getAllProductIds()

      expect(mockStorage.getAllKeys)
        .toHaveBeenCalledWith('product:')
      expect(result)
        .toEqual([
          'test1',
          'test2',
          'test3',
        ])
      expect(result.length)
        .toBe(3)
    })
  })

  describe('deleteProduct', () => {
    it('should delete a product and its history', async () => {
      mockStorage.getAllKeys.mockResolvedValue(['history:test123:1629480000000', 'history:test123:1629490000000'])

      await productRepository.deleteProduct('test123')

      expect(mockStorage.deleteItem)
        .toHaveBeenCalledWith('product:test123')
      expect(mockStorage.getAllKeys)
        .toHaveBeenCalledWith('history:test123:')
      expect(mockStorage.deleteItem)
        .toHaveBeenCalledTimes(3) // Once for product, twice for history entries
      expect(mockStorage.deleteItem)
        .toHaveBeenNthCalledWith(1, 'product:test123')
      expect(mockStorage.deleteItem)
        .toHaveBeenNthCalledWith(2, 'history:test123:1629480000000')
      expect(mockStorage.deleteItem)
        .toHaveBeenNthCalledWith(3, 'history:test123:1629490000000')
    })
  })

  describe('clearOldHistory', () => {
    it('should clear old history for a product', async () => {
      const _cutoffDate = new Date()

      await productRepository.clearOldHistory('test123', 3)

      expect(mockStorage.clearOldItems)
        .toHaveBeenCalledWith('history:test123', expect.any(Date))
    })
  })

  describe('close', () => {
    it('should close the storage connection', async () => {
      await productRepository.close()

      expect(mockStorage.close)
        .toHaveBeenCalled()
    })
  })
})
