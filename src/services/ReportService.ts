import { createConsola } from 'consola'

// const logger = createConsola()
//   .withTag('ReportService')

export interface ApplicationStats {
  totalChecks: number
  failedChecks: number
  lastCheckTime: Date | null
  totalProductsTracked: number
  totalPriceDrops: number
  totalAvailabilityChanges: number
  startTime: Date
}

export class ReportService {
  private stats: ApplicationStats

  constructor() {
    this.stats = {
      totalChecks: 0,
      failedChecks: 0,
      lastCheckTime: null,
      totalProductsTracked: 0,
      totalPriceDrops: 0,
      totalAvailabilityChanges: 0,
      startTime: new Date(),
    }
  }

  public recordCheck(success: boolean, productsCount: number) {
    this.stats.totalChecks++
    if (!success) {
      this.stats.failedChecks++
    }
    this.stats.lastCheckTime = new Date()
    this.stats.totalProductsTracked = productsCount
  }

  public recordPriceDrop() {
    this.stats.totalPriceDrops++
  }

  public recordAvailabilityChange() {
    this.stats.totalAvailabilityChanges++
  }

  public getStats(): ApplicationStats {
    return { ...this.stats }
  }

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
🕐 Last Check: ${this.stats.lastCheckTime ? this.formatDate(this.stats.lastCheckTime) : 'Never'}`
  }

  private getUptime(): string {
    const now = new Date()
    const diff = now.getTime() - this.stats.startTime.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${days}d ${hours}h ${minutes}m`
  }

  private getSuccessRate(): number {
    if (this.stats.totalChecks === 0) {
      return 100
    }

    return Number(((1 - this.stats.failedChecks / this.stats.totalChecks) * 100).toFixed(1))
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}
