import type { PriceHistory, Product } from '~/types'

import { ProductRepository } from '~/domain/products/repository'
import { ProductService } from '~/domain/products/service'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the ProductRepository
vi.mock('~/domain/products/repository', () => {
  return {
    ProductRepository: vi.fn(() => {
      return {
        clearOldHistory: vi.fn(),
        close: vi.fn(),
        deleteProduct: vi.fn(),
        getAllProductIds: vi.fn(),
        getAllProducts: vi.fn(),
        getProduct: vi.fn(),
        getProductHistoryByPeriod: vi.fn(),
        getProductsByIds: vi.fn(),
        savePriceHistory: vi.fn(),
        saveProduct: vi.fn(),
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

describe('productService', () => {
  let productService: ProductService
  let mockRepository: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Get a reference to the mocked repository instance
    mockRepository = new ProductRepository()
    productService = new ProductService()
    // @ts-expect-error: Accessing private property for testing
    productService.repository = mockRepository
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

      mockRepository.getProduct.mockResolvedValue(mockProduct)

      const result = await productService.getProduct('test123')

      expect(mockRepository.getProduct)
        .toHaveBeenCalledWith('test123')
      expect(result)
        .toEqual(mockProduct)
    })

    it('should return null when product is not found', async () => {
      mockRepository.getProduct.mockResolvedValue(null)

      const result = await productService.getProduct('nonexistent')

      expect(mockRepository.getProduct)
        .toHaveBeenCalledWith('nonexistent')
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

      mockRepository.getAllProducts.mockResolvedValue(mockProducts)

      const result = await productService.getAllProducts()

      expect(mockRepository.getAllProducts)
        .toHaveBeenCalled()
      expect(result)
        .toEqual(mockProducts)
      expect(result.length)
        .toBe(2)
    })

    it('should return empty array when no products exist', async () => {
      mockRepository.getAllProducts.mockResolvedValue([])

      const result = await productService.getAllProducts()

      expect(mockRepository.getAllProducts)
        .toHaveBeenCalled()
      expect(result)
        .toEqual([])
      expect(result.length)
        .toBe(0)
    })
  })

  describe('saveProduct', () => {
    it('should save a product and its price history', async () => {
      const timestamp = Date.now()
      const mockProduct: Product = {
        id: 'test123',
        inStock: true,
        name: 'Test Product',
        price: 1000,
        timestamp,
        url: 'https://example.com/product/123',
      }

      const expectedPriceHistory: PriceHistory = {
        inStock: true,
        price: 1000,
        productId: 'test123',
        timestamp,
      }

      await productService.saveProduct(mockProduct)

      expect(mockRepository.saveProduct)
        .toHaveBeenCalledWith(mockProduct)
      expect(mockRepository.savePriceHistory)
        .toHaveBeenCalledWith('test123', expectedPriceHistory)
    })

    it('should throw an error when save fails', async () => {
      const mockProduct: Product = {
        id: 'test123',
        inStock: true,
        name: 'Test Product',
        price: 1000,
        timestamp: Date.now(),
        url: 'https://example.com/product/123',
      }

      const mockError = new Error('Database error')
      mockRepository.saveProduct.mockRejectedValue(mockError)

      await expect(productService.saveProduct(mockProduct)).rejects.toThrow(mockError)
      expect(mockRepository.saveProduct)
        .toHaveBeenCalledWith(mockProduct)
      expect(mockRepository.savePriceHistory).not.toHaveBeenCalled()
    })
  })

  describe('getProductHistoryByPeriod', () => {
    it('should return price history for a product', async () => {
      const now = Date.now()
      const mockHistory: PriceHistory[] = [
        { inStock: true, price: 1000, productId: 'test123', timestamp: now },
        { inStock: true, price: 1200, productId: 'test123', timestamp: now - 86400000 },
        { inStock: true, price: 1500, productId: 'test123', timestamp: now - 172800000 },
      ]

      mockRepository.getProductHistoryByPeriod.mockResolvedValue(mockHistory)

      const result = await productService.getProductHistoryByPeriod('test123', 1)

      expect(mockRepository.getProductHistoryByPeriod)
        .toHaveBeenCalledWith('test123', 1)
      expect(result)
        .toEqual(mockHistory)
      expect(result.length)
        .toBe(3)
    })

    it('should return empty array when no history exists', async () => {
      mockRepository.getProductHistoryByPeriod.mockResolvedValue([])

      const result = await productService.getProductHistoryByPeriod('test123', 1)

      expect(mockRepository.getProductHistoryByPeriod)
        .toHaveBeenCalledWith('test123', 1)
      expect(result)
        .toEqual([])
    })

    it('should return empty array when an error occurs', async () => {
      mockRepository.getProductHistoryByPeriod.mockRejectedValue(new Error('Database error'))

      const result = await productService.getProductHistoryByPeriod('test123', 1)

      expect(mockRepository.getProductHistoryByPeriod)
        .toHaveBeenCalledWith('test123', 1)
      expect(result)
        .toEqual([])
    })
  })

  describe('clearUnavailableProducts', () => {
    it('should remove products that are not in the current list', async () => {
      const allProductIds = [
        'product1',
        'product2',
        'product3',
      ]
      const currentProductIds = ['product1', 'product3']

      mockRepository.getAllProductIds.mockResolvedValue(allProductIds)

      await productService.clearUnavailableProducts(currentProductIds)

      expect(mockRepository.getAllProductIds)
        .toHaveBeenCalled()
      expect(mockRepository.deleteProduct)
        .toHaveBeenCalledTimes(1)
      expect(mockRepository.deleteProduct)
        .toHaveBeenCalledWith('product2')
    })

    it('should not remove any products if all are in the current list', async () => {
      const allProductIds = ['product1', 'product2']
      const currentProductIds = ['product1', 'product2']

      mockRepository.getAllProductIds.mockResolvedValue(allProductIds)

      await productService.clearUnavailableProducts(currentProductIds)

      expect(mockRepository.getAllProductIds)
        .toHaveBeenCalled()
      expect(mockRepository.deleteProduct).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('should close the repository connection', async () => {
      await productService.close()

      expect(mockRepository.close)
        .toHaveBeenCalled()
    })
  })
})
