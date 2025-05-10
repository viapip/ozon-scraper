import { Telegraf } from 'telegraf'

import { formatPrice, validateUrl } from '../utils/helpers'

import type { ProductAnalytics, User } from '../types/index'
import type { Context } from 'telegraf'
import { createLogger } from '../utils/logger'

const logger = createLogger('BotService')

export interface TelegramBotDependencies {
  addUser: (chatId: string) => Promise<void>
  clearUserProducts: (chatId: string) => Promise<void>
  getProducts: (chatId: string) => Promise<ProductAnalytics[]>
  getReport: (chatId: string) => string
  getUser: (chatId: string) => Promise<null | User>
  setActive: (chatId: string, isActive: boolean) => Promise<void>
  setFavoriteList: (chatId: string, url: string) => Promise<string>
  stop: (chatId: string) => Promise<void>
}

export class TelegramBot {
  private batchSize: number
  private bot: Telegraf
  private dependencies: TelegramBotDependencies
  private isRunning = false

  static readonly ITEM_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━'

  constructor(
    token: string,
    dependencies: TelegramBotDependencies,
    batchSize?: number,
  ) {
    logger.info('Bot service constructor')
    if (!token) {
      throw new Error('Telegram bot token is required')
    }

    this.bot = new Telegraf(token)

    this.batchSize = batchSize || 10
    this.dependencies = dependencies
  }

  async canActivate(ctx: Context) {
    try {
      if (!ctx.chat) {
        throw new Error('Chat not found')
      }

      const user = await this.dependencies.getUser(ctx.chat.id.toString())

      return Boolean(user) && user?.isActive
    }
    catch (error) {
      logger.error('Failed to check if user exists:', error)

      await ctx.reply('User not found')

      return false
    }
  }

  async initCommands(): Promise<void> {
    this.bot.command('start', async (ctx) => {
      const userId = ctx.chat.id
      await this.dependencies.addUser(userId.toString())

      const activateCommand = `/activate ${userId}`

      const welcomeMessage = [
        '*Добро пожаловать в бота* 🤖',
        '',
        `Ваш ID: \`${userId}\``,
        '',
        '*Последний шаг:*',
        'Для доступа к функциям бота требуется активация.',
        '',
        '*Попросите активного пользователя ввести команду:*',
        `\`${activateCommand}\``,
      ].join('\n')

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
      })
    })

    this.bot.command('getid', (ctx) => {
      const chatId = ctx.chat.id
      ctx.reply(`Ваш текущий ID: ${chatId}`)
    })

    this.bot.command('getall', async (ctx) => {
      if (!await this.canActivate(ctx)) {
        ctx.reply('Ваш аккаунт еще не активирован')

        return
      }

      const products = await this.dependencies.getProducts(ctx.chat.id.toString())
      if (products.length === 0) {
        ctx.reply('Товары не найдены')

        return
      }

      await this.sendNotifications([ctx.chat.id.toString()], products, this.batchSize)
    })

    this.bot.command('addlist', async (ctx) => {
      if (!await this.canActivate(ctx)) {
        return
      }

      const [, url] = ctx.message.text.split(' ')
      if (!validateUrl(url)) {
        ctx.reply('Неверный формат ссылки. Пример: https://ozon.ru/t/QweRtY', {
          link_preview_options: {
            is_disabled: true,
          },
        })

        return
      }

      const listId = await this.dependencies.setFavoriteList(ctx.chat.id.toString(), url)
      ctx.reply(`Список избранного добавлен: ${listId} \n\nДля проверки: https://www.ozon.ru/my/favorites/shared?list=${listId}`)
    })

    this.bot.command('activate', async (ctx) => {
      if (!await this.canActivate(ctx)) {
        await ctx.reply('❌ У вас нет прав для активации пользователей')

        return
      }

      const [, userId] = ctx.message.text.split(' ')
      if (!userId) {
        await ctx.reply('⚠️ Укажите ID пользователя.\nПример: /activate 123456789')

        return
      }

      const user = await this.dependencies.getUser(userId)
      if (!user) {
        await ctx.reply('❌ Пользователь не найден. Проверьте ID и попробуйте снова')

        return
      }

      try {
        await this.dependencies.setActive(userId, true)

        // Сообщение для активированного пользователя
        const activatedUserMessage = [
          '🎉 *Ваш аккаунт успешно активирован!*',
          '',
          '📝 Чтобы добавить список товаров для отслеживания:',
          '',
          '1. Откройте страницу товара на OZON',
          '2. Зайдите в список избранных товаров',
          '3. Нажмите кнопку "Поделиться"',
          '4. Скопируйте короткую ссылку (формат: ozon.ru/t/XXXXXX)',
          '5. Используйте команду /addlist',
          '',
          '*Доступные команды:*',
          '',
          '📋 */addlist* - Добавить список избранного для отслеживания',
          '🔍 */getall* - Показать все отслеживаемые товары',
          '⏹️ */stop* - Остановить отслеживание всех товаров, для возобновления добавьте список снова',
          '🆔 */getid* - Показать ваш ID',
          '',
          '*Пример добавления списка:*',
          '`/addlist https://ozon.ru/t/QweRtY`',
          '',
          '❗️ Важно: Используйте только короткие ссылки из кнопки "Поделиться"',
          '✅ Правильно: ozon.ru/t/QweRtY',
          '❌ Неправильно: ozon.ru/product/...',
        ].join('\n')

        await this.bot.telegram.sendMessage(userId, activatedUserMessage, {
          parse_mode: 'Markdown',
        })

        // Сообщение для активирующего пользователя
        await ctx.reply(`✅ Готово! Пользователь ${userId} успешно активирован`)
      }
      catch (error) {
        logger.error(`Failed to activate user ${userId}:`, error)
        await ctx.reply('❌ Не удалось активировать пользователя. Попробуйте позже')
      }
    })

    this.bot.command('stop', async (ctx) => {
      if (!await this.canActivate(ctx)) {
        ctx.reply('У вас нет прав для остановки отслеживания')

        return
      }

      await this.dependencies.stop(ctx.chat.id.toString())
      ctx.reply('🛑 Отслеживание остановлено')
    })

    this.bot.command('report', async (ctx) => {
      const chatId = ctx.chat.id.toString()

      const report = this.dependencies.getReport(chatId)
      await ctx.reply(report)
    })
  }

  async init(): Promise<void> {
    try {
      logger.info('Starting Telegram bot')

      await this.initCommands()

      this.bot.launch(() => {
        this.isRunning = true
        logger.info('Telegram bot started')
      })
        .catch((error) => {
          logger.error('Failed to start Telegram bot:', error)
          this.isRunning = false
        })

      await new Promise((resolve) => {
        return setTimeout(resolve, 2000)
      })
    }
    catch (error) {
      logger.error('Failed to initialize Telegram bot:', error)
      throw error
    }
  }

  async sendAnalytics(chatId: string, analyticsArray: ProductAnalytics[]): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bot is not running, skipping message')

      return
    }

    await this.sendNotifications([chatId], analyticsArray, this.batchSize)
  }

  async sendNotifications(chatIds: string[], messages: ProductAnalytics[], batchSize: number) {
    for (const chatId of chatIds) {
      try {
        await this.sendBatchedMessages(chatId, messages, batchSize)
      }
      catch (error) {
        logger.error(`Failed to send message to chat ${chatId}:`, error)
      }
    }
  }

  private async sendBatchedMessages(chatId: string, messages: ProductAnalytics[], batchSize: number) {
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      const formattedMessages = batch.map((msg) => {
        return this.formatAnalyticsMessage(msg)
      })
      const messageText = this.formatMessage(formattedMessages, i)

      await this.sendTelegramMessage(chatId, messageText)
    }
  }

  async sendTelegramMessage(chatId: string, text: string) {
    await this.bot.telegram.sendMessage(chatId, text, {
      link_preview_options: { is_disabled: true },
      parse_mode: 'HTML',
    })
  }

  formatMessage(messages: string[], index: number): string {
    const separator = '━━━━━━━━━━━━━━━━━━━━━━'

    return index === 0
      ? `${separator}
      ${messages.join('')}`
      : messages.join('')
  }

  formatPriceChange(change: number): string {
    const absChange = Math.abs(change)
    if (change === 0) {
      return '0%'
    }

    return change > 0 ? `+${absChange}%` : `-${absChange}%`
  }

  private formatAnalyticsMessage(analytics: ProductAnalytics): string {
    const { name, price: currentPrice, url } = analytics.current
    const { price: minPrice } = analytics.minPrice
    const { price: maxPrice } = analytics.maxPrice

    const trend = this.getPriceTrendSymbol(analytics.priceDiffPercent)
    const priceChangeFormatted = this.formatPriceChange(analytics.priceDiffPercent)
    const [productName, ..._args] = name.split(',')

    let inStockText = ``
    if (analytics.becameAvailable) {
      inStockText = '🔔'
    }
    else if (analytics.becameUnavailable) {
      inStockText = '🚫'
    }

    return `
${inStockText}<b>${productName}</b>
💵 <b>${formatPrice(currentPrice)}</b> 
📈 <code>${trend} ${priceChangeFormatted}</code>
ℹ️ Min/Max: <code>${formatPrice(minPrice)}/${formatPrice(maxPrice)}</code>
<a href="${url}">Открыть в Ozon ➜</a>
${TelegramBot.ITEM_SEPARATOR}`
  }

  private getPriceTrendSymbol(priceDiff: number): string {
    if (priceDiff === 0) {
      return '→'
    }

    return priceDiff > 0 ? '↗' : '↘'
  }

  async stop(): Promise<void> {
    if (this.isRunning) {
      this.bot.stop()
      this.isRunning = false
      logger.info('Telegram bot stopped')
    }
  }

  isReady(): boolean {
    return this.isRunning
  }
}
