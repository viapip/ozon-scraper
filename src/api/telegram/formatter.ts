import type { ProductAnalytics } from '../../types/index'

import { formatPrice } from '../../utils/formatting'

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

    const trend = this.getPriceTrendSymbol(analytics.priceDiffPercent)
    const priceChangeFormatted = this.formatPriceChange(analytics.priceDiffPercent)
    const [productName, ..._args] = name.split(',')

    let inStockText = ''
    if (analytics.becameAvailable) {
      inStockText = '📦'
    }
    else if (analytics.becameUnavailable) {
      inStockText = '🚫'
    }

    return `
${inStockText}<b>${productName}</b>
💰 <b>${formatPrice(currentPrice)}</b> 
📊 <code>${trend} ${priceChangeFormatted}</code>
📉 Min/Max: <code>${formatPrice(minPrice)}/${formatPrice(maxPrice)}</code>
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
