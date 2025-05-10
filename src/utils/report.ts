import { createLogger } from '../utils/logger'
import { formatDate } from './formatting'

const logger = createLogger('ReportService')

export interface ApplicationStats {
  failedChecks: number
  lastCheckTime: Date | null
  startTime: Date
  totalAvailabilityChanges: number
  totalChecks: number
  totalPriceDrops: number
  totalProductsTracked: number
}

/**
 * Service for tracking and reporting application statistics
 */
export class ReportService {
  private stats: ApplicationStats

  constructor() {
    logger.debug('Initializing report service')

    this.stats = {
      failedChecks: 0,
      lastCheckTime: null,
      startTime: new Date(),
      totalAvailabilityChanges: 0,
      totalChecks: 0,
      totalPriceDrops: 0,
      totalProductsTracked: 0,
    }
  }

  /**
   * Record a product check operation
   */
  public recordCheck(success: boolean, productsCount: number): void {
    this.stats.totalChecks++
    if (!success) {
      this.stats.failedChecks++
    }
    this.stats.lastCheckTime = new Date()
    this.stats.totalProductsTracked = productsCount
  }

  /**
   * Record a price drop
   */
  public recordPriceDrop(): void {
    this.stats.totalPriceDrops++
  }

  /**
   * Record an availability change
   */
  public recordAvailabilityChange(): void {
    this.stats.totalAvailabilityChanges++
  }

  /**
   * Get the current statistics
   */
  public getStats(): ApplicationStats {
    return { ...this.stats }
  }

  /**
   * Get a formatted report string
   */
  public getFormattedReport(): string {
    const uptime = this.getUptime()
    const successRate = this.getSuccessRate()

    return `📊 Application Statistics Report

🕒 Uptime: ${uptime}
📈 Total Checks: ${this.stats.totalChecks}
❌ Failed Checks: ${this.stats.failedChecks}
✅ Success Rate: ${successRate}%
🏷️ Products Tracked: ${this.stats.totalProductsTracked}
💰 Total Price Drops: ${this.stats.totalPriceDrops}
📦 Availability Changes: ${this.stats.totalAvailabilityChanges}
🕐 Last Check: ${this.stats.lastCheckTime ? formatDate(this.stats.lastCheckTime) : 'Never'}`
  }

  /**
   * Calculate uptime as a formatted string
   */
  private getUptime(): string {
    const now = new Date()
    const diff = now.getTime() - this.stats.startTime.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${days}d ${hours}h ${minutes}m`
  }

  /**
   * Calculate success rate as a percentage
   */
  private getSuccessRate(): number {
    if (this.stats.totalChecks === 0) {
      return 100
    }

    return Number(((1 - this.stats.failedChecks / this.stats.totalChecks) * 100).toFixed(1))
  }
}
