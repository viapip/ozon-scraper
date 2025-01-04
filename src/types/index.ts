export interface OzonConfig {
  // favoriteListUrl: string
  cookies: string
  userAgent: string
}

export interface Product {
  id: string
  name: string
  url: string
  price: number
  timestamp: number
}

export interface PriceHistory {
  productId: string
  price: number
  timestamp: number
}

export interface ProductAnalytics {
  minPrice: PriceHistory
  maxPrice: PriceHistory
  current: Product
  priceDiffPercent: number
}

export interface ProductListUrl {
  url: string
  timestamp: number
  chatId: string
}
export interface UserProduct {
  id: string
  url: string
  addedAt: number
  name?: string
  lastCheckedAt?: number
  // Можно добавить дополнительные поля
}

export interface UserProductAnalytics extends ProductAnalytics {
  chatId: string
}

export interface User {
  chatId: string
  favoriteListUrl?: string
  createdAt: number
  lastActivityAt: number
}
