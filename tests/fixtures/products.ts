import type { PriceHistory, Product } from '~/types'

/**
 * Sample product fixture for testing
 */
export function createProductFixture(override: Partial<Product> = {}): Product {
  const now = Date.now()

  return {
    id: `product-${now}`,
    inStock: true,
    name: 'Test Product',
    price: 1000,
    timestamp: now,
    url: 'https://example.com/product/123',
    ...override,
  }
}

/**
 * Create multiple product fixtures
 */
export function createProductsFixture(count: number, overrideBase: Partial<Product> = {}): Product[] {
  return Array.from({ length: count })
    .map((_, index) => {
      return createProductFixture({
        id: `product-${index + 1}`,
        name: `Test Product ${index + 1}`,
        price: 1000 + (index * 100),
        ...overrideBase,
      })
    },
    )
}

/**
 * Create a price history fixture
 */
export function createPriceHistoryFixture(productId: string, daysBack = 0, override: Partial<PriceHistory> = {}): PriceHistory {
  const timestamp = Date.now() - (daysBack * 24 * 60 * 60 * 1000)

  return {
    inStock: true,
    price: 1000 - (daysBack * 10), // Price decreases as we go back in time
    productId,
    timestamp,
    ...override,
  }
}

/**
 * Create a price history array for a product spanning multiple days
 */
export function createPriceHistoryArrayFixture(productId: string, days = 30): PriceHistory[] {
  return Array.from({ length: days })
    .map((_, index) => {
      return createPriceHistoryFixture(productId, index)
    },
    )
}

/**
 * Create a scenario where a product has price fluctuations and availability changes
 */
export function createProductHistoryScenarioFixture(productId: string): PriceHistory[] {
  const now = Date.now()
  const dayInMs = 24 * 60 * 60 * 1000

  return [
    // Today
    { inStock: true, price: 1000, productId, timestamp: now },
    // 2 days ago - price drop
    { inStock: true, price: 1200, productId, timestamp: now - (2 * dayInMs) },
    // 5 days ago - same price
    { inStock: true, price: 1200, productId, timestamp: now - (5 * dayInMs) },
    // 10 days ago - higher price
    { inStock: true, price: 1500, productId, timestamp: now - (10 * dayInMs) },
    // 15 days ago - out of stock
    { inStock: false, price: 1500, productId, timestamp: now - (15 * dayInMs) },
    // 20 days ago - in stock, different price
    { inStock: true, price: 1400, productId, timestamp: now - (20 * dayInMs) },
    // 30 days ago - initial price
    { inStock: true, price: 1300, productId, timestamp: now - (30 * dayInMs) },
  ]
}
