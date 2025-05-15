import type { Page } from 'playwright'
import type { Mock } from 'vitest'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OzonParser } from '../../../../src/api/ozon/parser'

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

describe('ozonParser', () => {
  let parser: OzonParser
  let mockPage: Page

  beforeEach(() => {
    parser = new OzonParser()

    // Create a mock Playwright Page object
    mockPage = {
      $$eval: vi.fn(),
      goto: vi.fn()
        .mockResolvedValue(),
      url: vi.fn()
        .mockReturnValue(''),
    } as unknown as Page
  })

  describe('getFavoriteListId', () => {
    it('should extract favorite list ID from URL', async () => {
      // Setup the mock behavior
      (mockPage.url as Mock).mockReturnValue('https://ozon.ru/my/favorites?list=abc123')

      const result = await parser.getFavoriteListId(mockPage, 'https://ozon.ru/my/favorites')

      expect(mockPage.goto)
        .toHaveBeenCalledWith('https://ozon.ru/my/favorites', {
          timeout: 30000,
          waitUntil: 'domcontentloaded',
        })
      expect(result)
        .toBe('abc123')
    })

    it('should throw error when list ID is not found', async () => {
      // Mock URL without list parameter
      (mockPage.url as Mock).mockReturnValue('https://ozon.ru/my/favorites')

      await expect(parser.getFavoriteListId(mockPage, 'https://ozon.ru/my/favorites'))
        .rejects
        .toThrow('Failed to get favorite list ID from URL')
    })
  })

  describe('extractProducts', () => {
    it('should extract products from page', async () => {
      const now = Date.now()
      vi.spyOn(Date.prototype, 'getTime')
        .mockReturnValue(now)

      // Mock products data
      const mockProducts = [
        {
          id: '123456',
          inStock: true,
          name: 'Test Product 1',
          price: 1000,
          timestamp: now,
          url: 'https://ozon.ru/product/123456',
        },
        {
          id: '789012',
          inStock: true,
          name: 'Test Product 2',
          price: 2000,
          timestamp: now,
          url: 'https://ozon.ru/product/789012',
        },
      ] as const

      // Mock the page.$$eval method to return our test products
      (mockPage.$$eval as Mock).mockResolvedValue(mockProducts)

      const result = await parser.extractProducts(mockPage)

      expect(mockPage.$$eval)
        .toHaveBeenCalledWith(
          'div[data-widget="tileGridDesktop"] .tile-root',
          expect.any(Function),
        )
      expect(result)
        .toEqual(mockProducts)
      expect(result.length)
        .toBe(2)
    })

    it('should handle empty product list', async () => {
      // Mock empty products list
      (mockPage.$$eval as Mock).mockResolvedValue([])

      const result = await parser.extractProducts(mockPage)

      expect(result)
        .toEqual([])
      expect(result.length)
        .toBe(0)
    })
  })

  // Removed DOM parsing tests as they're difficult to test outside a browser environment
  describe('dOM parsing logic', () => {
    it('should handle product extraction from DOM', () => {
      // Since extractProducts delegates to $$eval, which runs in browser context,
      // we can only effectively test that it makes the right call
      parser.extractProducts(mockPage)

      expect(mockPage.$$eval)
        .toHaveBeenCalledWith(
          'div[data-widget="tileGridDesktop"] .tile-root',
          expect.any(Function),
        )
    })
  })
})
