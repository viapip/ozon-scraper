export interface OzonConfig {
  // favoriteListUrl: string
  cookies: string
  userAgent: string
}

export interface Product {
  id: string
  inStock: boolean
  name: string
  price: number
  timestamp: number
  url: string
}

export interface PriceHistory {
  inStock: boolean
  price: number
  productId: string
  timestamp: number
}

export interface ProductAnalytics {
  becameAvailable: boolean
  becameUnavailable: boolean
  current: Product
  discountFromMedianPercent: number
  maxPrice: PriceHistory
  medianPrice: PriceHistory
  minPrice: PriceHistory
}

export interface ProductListUrl {
  chatId: string
  timestamp: number
  url: string
}

export interface UserProductAnalytics extends ProductAnalytics {
  chatId: string
}

export interface User {
  chatId: string
  createdAt: number
  favoriteListId?: string
  isActive: boolean
  lastActivityAt: number
  notificationThreshold?: number
  products: string[]
}
