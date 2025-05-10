import type { ProductAnalytics, User } from '../../types'

/**
 * Report types for different report formats
 */
export enum ReportType {
  Full = 'full',
  Summary = 'summary',
  Prices = 'prices',
  Availability = 'availability',
}

/**
 * Summary of analytics for a batch of products
 */
export interface AnalyticsSummary {
  availableProducts: number
  averagePriceChange: number
  newlyAvailableCount: number
  newlyUnavailableCount: number
  priceDecreasedCount: number
  priceIncreasedCount: number
  priceUnchangedCount: number
  totalProducts: number
  unavailableProducts: number
}

/**
 * User report options
 */
export interface ReportOptions {
  format?: 'json' | 'text'
  includeUnavailable?: boolean
  type: ReportType
}

/**
 * User report data
 */
export interface UserReport {
  analytics: ProductAnalytics[]
  summary: AnalyticsSummary
  timestamp: number
  user: User
}
