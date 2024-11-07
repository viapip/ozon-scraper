export interface OzonConfig {
  favoriteListUrl: string
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
