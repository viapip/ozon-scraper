import type { ProductAnalytics } from '../../types/index'

import { formatPrice, formatPriceOrStatus } from '../../utils/formatting'

/**
 * Formats messages for Telegram
 */
export class TelegramFormatter {
  static readonly ITEM_SEPARATOR = ''

  /**
   * Format multiple analytics messages as a single message
   */
  formatMessage(messages: string[], index: number): string {
    return index === 0
      ? `${TelegramFormatter.ITEM_SEPARATOR}\n${messages.join('')}`
      : messages.join('')
  }

  /**
   * Format price change as a percentage
   */
  formatPriceChange(change: number): string {
    const absChange = Math.abs(change)
    if (change === 0) {
      return '0%'
    }

    return change > 0 ? `+${absChange}%` : `-${absChange}%`
  }

  /**
   * Format a product analytics message
   */
  formatAnalyticsMessage(analytics: ProductAnalytics): string {
    const { name, price: currentPrice, url } = analytics.current
    const { price: minPrice } = analytics.minPrice
    const { price: maxPrice } = analytics.maxPrice
    const { price: medianPrice } = analytics.medianPrice

    const trend = this.getPriceTrendSymbol(analytics.discountFromMedianPercent)
    const priceChangeFormatted = this.formatPriceChange(analytics.discountFromMedianPercent)
    const [productName] = name.split(',')

    // Status indicators
    let statusIndicator = ''
    let priceDisplay = ''
    let trendDisplay = ''
    let additionalInfo = ''

    const { becameAvailable, becameUnavailable, cameBackInStock, current, wasEverInStock } = analytics
    // Check if product is in stock
    if (!current.inStock) {
      // Product is not in stock
      statusIndicator = '🚫' // Always show unavailable indicator

      // Use the new formatting function for price display
      priceDisplay = `<b>${formatPriceOrStatus(currentPrice, false, wasEverInStock)}</b>`

      trendDisplay = '' // Don't show trend for unavailable products
    }
    else {
      // Product is in stock
      priceDisplay = `<b>${formatPrice(currentPrice)}</b>`
      trendDisplay = `<code>${trend} ${priceChangeFormatted}</code> от медианы`

      // Special case for products that came back in stock
      if (cameBackInStock) {
        statusIndicator = '🔄' // Product came back in stock
        additionalInfo = '<i>Товар снова в наличии!</i>'
      }
      else if (becameAvailable && !wasEverInStock) {
        statusIndicator = '🆕' // Product available for the first time
        additionalInfo = '<i>Товар впервые в наличии!</i>'
      }
      else if (becameAvailable) {
        statusIndicator = '📦' // Recently became available
      }
    }

    // Handle status change indicators (append to existing indicators)
    if (becameUnavailable) {
      statusIndicator += '🚫' // Recently became unavailable
    }
    else if (becameAvailable && !statusIndicator.includes('📦')
      && !statusIndicator.includes('🔄') && !statusIndicator.includes('🆕')) {
      statusIndicator += '📦' // Recently became available
    }

    // Only show history statistics if the product was ever in stock
    const historyStats = wasEverInStock || current.inStock
      ? `📉 Min/Med/Max: <code>${formatPrice(minPrice, true)}/${formatPrice(medianPrice, true)}/${formatPrice(maxPrice, true)}</code>`
      : ''

    return `
${statusIndicator}<b>${productName}</b>
💰 ${priceDisplay} 
${additionalInfo ? `${additionalInfo}\n` : ''}${current.inStock ? `📊 ${trendDisplay}\n` : ''}${historyStats}
<a href="${url}">Открыть в Ozon →</a>
${TelegramFormatter.ITEM_SEPARATOR}`
  }

  /**
   * Get a symbol representing price trend direction
   */
  private getPriceTrendSymbol(priceDiff: number): string {
    if (priceDiff === 0) {
      return '→'
    }

    return priceDiff > 0 ? '↑' : '↓'
  }

  /**
   * Format a welcome message for a new user
   */
  formatWelcomeMessage(userId: string): string {
    const activateCommand = `/activate ${userId}`

    return [
      '*Добро пожаловать в бота Ozon*',
      '',
      `Ваш ID: \`${userId}\``,
      '',
      '*Последний шаг:*',
      'Для доступа к функциям бота требуется активация.',
      '',
      '*Попросите активного пользователя ввести команду:*',
      `\`${activateCommand}\``,
    ].join('\n')
  }

  /**
   * Format a user activation success message
   */
  formatActivationSuccessMessage(): string {
    return [
      '✅ *Ваш аккаунт успешно активирован!*',
      '',
      '➡️ Чтобы добавить список товаров для отслеживания:',
      '',
      '1. Откройте страницу товара на OZON',
      '2. Найдите в список избранных товаров',
      '3. Нажмите кнопку "Поделиться"',
      '4. Скопируйте короткую ссылку (формат: ozon.ru/t/XXXXXX)',
      '5. Используйте команду /addlist',
      '',
      '*Доступные команды:*',
      '',
      '➡️ */addlist* - Добавить список избранного для отслеживания',
      '➡ */getall* - Показать все отслеживаемые товары',
      '❌ */stop* - Остановить отслеживание всех товаров, для возобновления добавьте список снова',
      'ℹ️ */getid* - Показать ваш ID',
      '➡️ */setthreshold* - Установить порог скидки для уведомлений (например, /setthreshold 10)',
      '',
      '*Пример добавления списка:*',
      '`/addlist https://ozon.ru/t/QweRtY`',
      '',
      '⚠️ Важно: Используйте только короткие ссылки из кнопки "Поделиться"',
      '✓ Правильно: ozon.ru/t/QweRtY',
      '✗ Неправильно: ozon.ru/product/...',
    ].join('\n')
  }
}
