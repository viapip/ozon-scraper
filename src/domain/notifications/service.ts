import type { ProductAnalytics, User } from '../../types/index'

import { createLogger } from '../../utils/logger'

const logger = createLogger('NotificationRulesService')

/**
 * Service for determining when notifications should be sent based on user preferences
 */
export class NotificationRulesService {
  /**
   * Check if a notification should be sent for a product
   *
   * Rules:
   * 1. Always notify for availability changes
   * 2. If discount increased since last notification, always notify
   * 3. Otherwise, check notification frequency settings
   */
  shouldSendNotification(
    user: User,
    productId: string,
    analytics: ProductAnalytics,
  ): boolean {
    // Always notify for availability changes
    if (analytics.becameAvailable || analytics.becameUnavailable) {
      logger.debug(`Always sending notification for availability change - product ${productId}`)

      return true
    }

    // Get last notification data
    const lastNotification = user.lastNotifications?.[productId]

    // First notification for this product
    if (!lastNotification) {
      logger.debug(`First notification for product ${productId}`)

      return true
    }

    // Check for discount increase
    const currentDiscount = -analytics.discountFromMedianPercent
    const lastDiscount = lastNotification.discountPercent

    if (currentDiscount > lastDiscount) {
      logger.debug(`Sending notification for increased discount - product ${productId}`)

      return true
    }

    // Check notification frequency
    const frequency = user.notificationFrequency || { type: 'daily' }
    const hoursSinceLastNotification
      = (Date.now() - lastNotification.timestamp) / (1000 * 60 * 60)

    let shouldSend = false

    switch (frequency.type) {
      case 'custom':
        shouldSend = hoursSinceLastNotification >= (frequency.hoursBetweenNotifications || 24)
        break
      case 'daily':
        shouldSend = hoursSinceLastNotification >= 24
        break
      case 'immediate':
        shouldSend = true
        break
      case 'weekly':
        shouldSend = hoursSinceLastNotification >= 24 * 7
        break
      default:
        shouldSend = hoursSinceLastNotification >= 24
    }

    logger.debug(`Notification frequency check for product ${productId}: ${shouldSend} (type: ${frequency.type}, hours since last: ${hoursSinceLastNotification.toFixed(2)})`)

    return shouldSend
  }
}
