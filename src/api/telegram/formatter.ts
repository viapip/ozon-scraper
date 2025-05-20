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
    const { id, name, price: currentPrice, url } = analytics.current
    const { price: minPrice } = analytics.minPrice
    const { price: maxPrice } = analytics.maxPrice
    const { price: medianPrice } = analytics.medianPrice

    const trend = this.getPriceTrendSymbol(analytics.discountFromMedianPercent)
    const priceChangeFormatted = this.formatPriceChange(analytics.discountFromMedianPercent)

    // Extract product name, providing a fallback for empty names
    const [rawProductName] = name.split(',')
    const productName = rawProductName?.trim()
      ? rawProductName
      : 'Товар без названия' // Fallback name: "Product without a name"

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

    // Add product ID in case name is missing (helps with identification)
    const productIdDisplay = !rawProductName?.trim() ? `(ID: ${id})` : ''

    return `
${statusIndicator}<b>${productName}</b> ${productIdDisplay}
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
      '*🔍 Добро пожаловать в OZON-TRACKER!*',
      '',
      'Я помогу вам отслеживать цены на товары в Ozon и уведомлять о выгодных предложениях.',
      '',
      `Ваш ID: \`${userId}\``,
      '',
      '*Для начала работы:*',
      '1. Требуется активация от существующего пользователя',
      '2. Попросите активного пользователя ввести:',
      `   \`${activateCommand}\``,
      '',
      '*После активации вы сможете:*',
      '• Отслеживать цены товаров из избранного Ozon',
      '• Получать уведомления о снижении цен',
      '• Настраивать частоту и порог уведомлений',
      '• Анализировать историю цен',
      '',
      'Подробная помощь доступна по команде /help',
    ].join('\n')
  }

  /**
   * Format a user activation success message
   */
  formatActivationSuccessMessage(): string {
    return [
      '✅ *Ваш аккаунт успешно активирован!*',
      '',
      '*Как начать отслеживание цен:*',
      '1. Сохраните интересующие товары в список избранного на Ozon',
      '2. Нажмите кнопку "Поделиться" со списком',
      '3. Скопируйте короткую ссылку (формат: ozon.ru/t/XXXXXX)',
      '4. Отправьте команду `/addlist [ссылка]`',
      '',
      '*Основные команды:*',
      '📋 */getall* - Показать отслеживаемые товары',
      '📊 */report* - Получить отчет с аналитикой',
      '🔔 */setthreshold 10* - Установить порог скидки (10%)',
      '⏱ */setfrequency daily* - Настроить частоту уведомлений',
      '❌ */stop* - Остановить отслеживание',
      '',
      '*Настройка уведомлений:*',
      'Выберите частоту через */setfrequency*:',
      '• immediate - мгновенные уведомления',
      '• daily - раз в день',
      '• weekly - раз в неделю',
      '• custom 12 - задать интервал в часах',
      '',
      '*Пример:* `/addlist https://ozon.ru/t/QweRtY`',
      '',
      '⚠️ Используйте только короткие ссылки из "Поделиться"!',
      'Подробная помощь: /help',
    ].join('\n')
  }

  /**
   * Format help message
   */
  formatHelpMessage(): string {
    return [
      '🔍 *OZON-TRACKER* - Ваш помощник по отслеживанию цен',
      '',
      '*Основные команды:*',
      '/start - Регистрация в системе',
      '/addlist URL - Добавить список избранного из Ozon',
      '/getall - Посмотреть отслеживаемые товары',
      '/stop - Остановить отслеживание товаров',
      '/report - Получить отчет о товарах',
      '',
      '*Настройка уведомлений:*',
      '/setthreshold ЧИСЛО - Установить порог скидки в процентах (0-100)',
      'Пример: `/setthreshold 10` - уведомлять при скидке от 10%',
      '',
      '/setfrequency ТИП [ЧАСЫ] - Настроить частоту уведомлений:',
      '• immediate - мгновенные уведомления',
      '• daily - не чаще раза в день',
      '• weekly - не чаще раза в неделю',
      '• custom ЧАСЫ - указать интервал в часах',
      'Пример: `/setfrequency custom 12`',
      '',
      '*Важно:* Вы всегда получите уведомление, если:',
      '• Товар стал доступен/недоступен',
      '• Скидка увеличилась с момента последнего уведомления',
      '',
      '*Дополнительно:*',
      '/getid - Узнать свой ID в Telegram',
      '/activate ID - Активировать другого пользователя',
      '',
      '*Советы:*',
      '• Оптимальный порог скидки: 15-30%',
      '• Для минимума уведомлений используйте weekly',
      '• Скидка рассчитывается относительно медианной цены',
      '• Регулярно проверяйте отчеты командой /report',
    ].join('\n')
  }
}
