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
  cameBackInStock: boolean // Product became available after being unavailable
  current: Product
  discountFromMedianPercent: number
  maxPrice: PriceHistory
  medianPrice: PriceHistory
  minPrice: PriceHistory
  neverInStock: boolean // Product was never in stock
  // New fields for edge cases
  wasEverInStock: boolean // Product was available at some point in history
}

export interface ProductListUrl {
  chatId: string
  timestamp: number
  url: string
}

export interface UserProductAnalytics extends ProductAnalytics {
  chatId: string
}

export interface NotificationFrequency {
  hoursBetweenNotifications?: number // For custom frequency
  type: 'custom' | 'daily' | 'immediate' | 'weekly'
}

export interface LastNotification {
  discountPercent: number
  timestamp: number
}

export interface User {
  chatId: string
  createdAt: number
  favoriteListId?: string
  isActive: boolean
  lastActivityAt: number
  lastNotifications?: Record<string, LastNotification> // productId -> notification data
  notificationFrequency?: NotificationFrequency
  notificationThreshold?: number
  products: string[]
}
