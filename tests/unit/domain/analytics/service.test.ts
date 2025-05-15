import type { Product, ProductAnalytics } from '~/types'

import { AnalyticsService } from '~/domain/analytics/service'
import { ProductService } from '~/domain/products/service'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createProductFixture, createProductHistoryScenarioFixture } from '../../../fixtures/products'

// Mock ProductService
vi.mock('~/domain/products/service', () => {
  return {
    ProductService: vi.fn(() => {
      return {
        getProduct: vi.fn(),
        getProductHistoryByPeriod: vi.fn(),
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

describe('analyticsService', () => {
  let analyticsService: AnalyticsService
  let mockProductService: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockProductService = new ProductService()
    analyticsService = new AnalyticsService(mockProductService)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getPriceAnalytics', () => {
    it('should calculate correct analytics for a product with history', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: true,
        price: 1000,
        timestamp: Date.now(),
      })

      // Generate price history with varied prices
      const history = createProductHistoryScenarioFixture(productId)

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue(history)

      const result = await analyticsService.getPriceAnalytics(productId)

      expect(mockProductService.getProduct)
        .toHaveBeenCalledWith(productId)
      expect(mockProductService.getProductHistoryByPeriod)
        .toHaveBeenCalledWith(productId, 3)

      // Check the structure and values of the analytics
      expect(result)
        .toEqual({
          becameAvailable: false,
          becameUnavailable: false,
          cameBackInStock: false,
          current: product,
          discountFromMedianPercent: -17, // (1000 - 1200) / 1200 * 100 = -16.67, rounded to -17
          maxPrice: history[3], // Price: 1500
          medianPrice: expect.objectContaining({ price: 1200 }), // The median price in our scenario
          minPrice: history[0], // Price: 1000
          neverInStock: false,
          wasEverInStock: true,
        })
    })

    it('should detect when a product becomes available', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: true,
        price: 1000,
        timestamp: Date.now(),
      })

      const history = [
        { inStock: true, price: 1000, productId, timestamp: Date.now() },
        { inStock: false, price: 1000, productId, timestamp: Date.now() - 86400000 }, // Out of stock yesterday
      ]

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue(history)

      const result = await analyticsService.getPriceAnalytics(productId)

      expect(result.becameAvailable)
        .toBe(true)
      expect(result.becameUnavailable)
        .toBe(false)
    })

    it('should detect when a product becomes unavailable', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: false, // Currently out of stock
        price: 1000,
        timestamp: Date.now(),
      })

      const history = [
        { inStock: false, price: 1000, productId, timestamp: Date.now() },
        { inStock: true, price: 1000, productId, timestamp: Date.now() - 86400000 }, // Was in stock yesterday
      ]

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue(history)

      const result = await analyticsService.getPriceAnalytics(productId)

      expect(result.becameAvailable)
        .toBe(false)
      expect(result.becameUnavailable)
        .toBe(true)
    })

    it('should detect products that have never been in stock', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: false, // Currently out of stock
        price: 0,
        timestamp: Date.now(),
      })

      const history = [
        { inStock: false, price: 0, productId, timestamp: Date.now() },
        { inStock: false, price: 0, productId, timestamp: Date.now() - 86400000 }, // Was never in stock
      ]

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue(history)

      const result = await analyticsService.getPriceAnalytics(productId)

      expect(result.wasEverInStock)
        .toBe(false)
      expect(result.neverInStock)
        .toBe(true)
      expect(result.discountFromMedianPercent)
        .toBe(0) // No discount for unavailable products
    })

    it('should detect products that came back in stock', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: true, // Currently in stock
        price: 1200,
        timestamp: Date.now(),
      })

      const history = [
        { inStock: true, price: 1200, productId, timestamp: Date.now() },
        { inStock: false, price: 0, productId, timestamp: Date.now() - 86400000 }, // Was out of stock yesterday
        { inStock: true, price: 1000, productId, timestamp: Date.now() - (2 * 86400000) }, // Was in stock before
      ]

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue(history)

      const result = await analyticsService.getPriceAnalytics(productId)

      expect(result.becameAvailable)
        .toBe(true)
      expect(result.wasEverInStock)
        .toBe(true)
      expect(result.cameBackInStock)
        .toBe(true)
    })

    it('should handle products with no price history', async () => {
      const productId = 'test123'
      const product = createProductFixture({
        id: productId,
        inStock: true,
        price: 1000,
        timestamp: Date.now(),
      })

      mockProductService.getProduct.mockResolvedValue(product)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue([])

      const result = await analyticsService.getPriceAnalytics(productId)

      // Should create a synthetic history from the current product
      expect(result.minPrice)
        .toEqual(expect.objectContaining({
          inStock: true,
          price: 1000,
          productId,
        }))
      expect(result.maxPrice)
        .toEqual(expect.objectContaining({
          inStock: true,
          price: 1000,
          productId,
        }))
      expect(result.medianPrice)
        .toEqual(expect.objectContaining({
          inStock: true,
          price: 1000,
          productId,
        }))
      expect(result.discountFromMedianPercent)
        .toBe(0) // No change when comparing to itself
    })

    it('should throw an error when product is not found', async () => {
      mockProductService.getProduct.mockResolvedValue(null)
      mockProductService.getProductHistoryByPeriod.mockResolvedValue([])

      await expect(analyticsService.getPriceAnalytics('nonexistent')).rejects.toThrow('Product not found')
    })
  })

  describe('getProductsAnalytics', () => {
    it('should get analytics for multiple products', async () => {
      const productIds = ['product1', 'product2']

      // Mock individual analytics calls
      const analyticsSpy = vi.spyOn(analyticsService, 'getPriceAnalytics')
      const mockAnalytics1 = { discountFromMedianPercent: -10, id: 'product1' } as any as ProductAnalytics
      const mockAnalytics2 = { discountFromMedianPercent: 5, id: 'product2' } as any as ProductAnalytics

      analyticsSpy
        .mockResolvedValueOnce(mockAnalytics1)
        .mockResolvedValueOnce(mockAnalytics2)

      const result = await analyticsService.getProductsAnalytics(productIds)

      expect(analyticsSpy)
        .toHaveBeenCalledTimes(2)
      expect(analyticsSpy)
        .toHaveBeenCalledWith('product1')
      expect(analyticsSpy)
        .toHaveBeenCalledWith('product2')
      expect(result)
        .toEqual([mockAnalytics1, mockAnalytics2])
    })

    it('should return empty array when an error occurs', async () => {
      const productIds = ['product1', 'product2']

      // Mock analytics call to throw an error
      const analyticsSpy = vi.spyOn(analyticsService, 'getPriceAnalytics')
      analyticsSpy.mockRejectedValue(new Error('Test error'))

      const result = await analyticsService.getProductsAnalytics(productIds)

      expect(analyticsSpy)
        .toHaveBeenCalledWith('product1')
      expect(result)
        .toEqual([])
    })
  })

  describe('summarizeAnalytics', () => {
    it('should correctly summarize product analytics', () => {
      const mockAnalytics: ProductAnalytics[] = [
        // Product 1: In stock, price decreased
        {
          becameAvailable: false,
          becameUnavailable: false,
          current: { id: 'product1', inStock: true, price: 900 } as Product,
          discountFromMedianPercent: -10,
        } as ProductAnalytics,

        // Product 2: In stock, price increased
        {
          becameAvailable: true,
          becameUnavailable: false,
          current: { id: 'product2', inStock: true, price: 1100 } as Product,
          discountFromMedianPercent: 10,
        } as ProductAnalytics,

        // Product 3: Out of stock
        {
          becameAvailable: false,
          becameUnavailable: true,
          current: { id: 'product3', inStock: false, price: 1000 } as Product,
          discountFromMedianPercent: 0,
        } as ProductAnalytics,

        // Product 4: In stock, price unchanged
        {
          becameAvailable: false,
          becameUnavailable: false,
          current: { id: 'product4', inStock: true, price: 1000 } as Product,
          discountFromMedianPercent: 0,
        } as ProductAnalytics,
      ]

      const summary = analyticsService.summarizeAnalytics(mockAnalytics)

      expect(summary)
        .toEqual({
          availableProducts: 3,
          averagePriceChange: 0, // Average of -10 and 10 is 0
          newlyAvailableCount: 1,
          newlyUnavailableCount: 1,
          priceDecreasedCount: 1,
          priceIncreasedCount: 1,
          priceUnchangedCount: 2,
          totalProducts: 4,
          unavailableProducts: 1,
        })
    })

    it('should handle empty analytics list', () => {
      const summary = analyticsService.summarizeAnalytics([])

      expect(summary)
        .toEqual({
          availableProducts: 0,
          averagePriceChange: 0,
          newlyAvailableCount: 0,
          newlyUnavailableCount: 0,
          priceDecreasedCount: 0,
          priceIncreasedCount: 0,
          priceUnchangedCount: 0,
          totalProducts: 0,
          unavailableProducts: 0,
        })
    })
  })

  describe('findExtremePrice', () => {
    it('should find minimum price from history', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: true, price: 800, productId: 'test', timestamp: 2 },
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.findExtremePrice(history, 'min')

      expect(result)
        .toEqual(history[1]) // Price 800
    })

    it('should find maximum price from history', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: true, price: 800, productId: 'test', timestamp: 2 },
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.findExtremePrice(history, 'max')

      expect(result)
        .toEqual(history[2]) // Price 1200
    })

    it('should skip out-of-stock items for min/max price', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: false, price: 500, productId: 'test', timestamp: 2 }, // Out of stock, but has price, should still be considered
        { inStock: false, price: 0, productId: 'test', timestamp: 4 }, // Out of stock with price 0, should be skipped
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const minResult = analyticsService.findExtremePrice(history, 'min')
      // @ts-expect-error: Accessing private method for testing
      const maxResult = analyticsService.findExtremePrice(history, 'max')

      expect(minResult)
        .toEqual(history[1]) // Price 500 (now considered because it has a valid price)
      expect(maxResult)
        .toEqual(history[3]) // Price 1200
    })

    it('should skip any zero prices for min/max calculation', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: true, price: 0, productId: 'test', timestamp: 2 }, // Zero price should be skipped even if in stock
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const minResult = analyticsService.findExtremePrice(history, 'min')

      expect(minResult)
        .toEqual(history[0]) // Price 1000, not picking up the zero price
    })
  })

  describe('calculateMedianPrice', () => {
    it('should calculate median price for odd number of items', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: true, price: 800, productId: 'test', timestamp: 2 },
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateMedianPrice(history)

      expect(result)
        .toEqual(history[0]) // Price 1000 (middle value)
    })

    it('should calculate median price for even number of items', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: true, price: 800, productId: 'test', timestamp: 2 },
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
        { inStock: true, price: 1500, productId: 'test', timestamp: 4 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateMedianPrice(history)

      // For even number of items, we take the lower of the two middle values
      // After sorting: [800, 1000, 1200, 1500]
      // Middle values are 1000 and 1200, we take 1000
      expect(result.price)
        .toBe(1000)
    })

    it('should skip out-of-stock items for median calculation', () => {
      const history = [
        { inStock: true, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: false, price: 500, productId: 'test', timestamp: 2 }, // Out of stock, should be skipped
        { inStock: true, price: 1200, productId: 'test', timestamp: 3 },
        { inStock: true, price: 1500, productId: 'test', timestamp: 4 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateMedianPrice(history)

      // After filtering out-of-stock items and sorting: [1000, 1200, 1500]
      // Median is 1200
      expect(result.price)
        .toBe(1200)
    })

    it('should return first element when all items are out of stock', () => {
      const history = [
        { inStock: false, price: 1000, productId: 'test', timestamp: 1 },
        { inStock: false, price: 800, productId: 'test', timestamp: 2 },
      ]

      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateMedianPrice(history)

      expect(result)
        .toEqual(history[0])
    })
  })

  describe('calculateDiscountFromMedian', () => {
    it('should calculate discount percentage correctly', () => {
      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateDiscountFromMedian(900, 1000)

      // (900 - 1000) / 1000 * 100 = -10%
      expect(result)
        .toBe(-10)
    })

    it('should calculate price increase percentage correctly', () => {
      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateDiscountFromMedian(1100, 1000)

      // (1100 - 1000) / 1000 * 100 = 10%
      expect(result)
        .toBe(10)
    })

    it('should handle zero median price gracefully', () => {
      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateDiscountFromMedian(1000, 0)

      expect(result)
        .toBe(0)
    })

    it('should round the percentage to nearest integer', () => {
      // @ts-expect-error: Accessing private method for testing
      const result = analyticsService.calculateDiscountFromMedian(1234, 1000)

      // (1234 - 1000) / 1000 * 100 = 23.4%, rounded to 23
      expect(result)
        .toBe(23)
    })
  })
})
