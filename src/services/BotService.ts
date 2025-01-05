import { createConsola } from 'consola'
import { Telegraf } from 'telegraf'

import { formatPrice, validateUrl } from '../utils/helpers.js'

import type { ProductAnalytics, User } from '../types/index.js'
import type { Context } from 'telegraf'

const logger = createConsola()
  .withTag('BotService')

export interface BotServiceDependencies {
  getProducts: (chatId: string) => Promise<ProductAnalytics[]>
  clearUserProducts: (chatId: string) => Promise<void>
  addUser: (chatId: string) => Promise<void>
  setFavoriteList: (chatId: string, url: string) => Promise<string>
  stop: (chatId: string) => Promise<void>
  getUser: (chatId: string) => Promise<User | null>
  setActive: (chatId: string, isActive: boolean) => Promise<void>
}

export class BotService {
  private bot: Telegraf
  private isRunning = false
  private batchSize: number
  private dependencies: BotServiceDependencies

  static readonly ITEM_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━'

  constructor(
    token: string,
    dependencies: BotServiceDependencies,
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

  async isUserExists(ctx: Context) {
    try {
      if (!ctx.chat) {
        throw new Error('Chat not found')
      }

      const user = await this.dependencies.getUser(ctx.chat.id.toString())

      return Boolean(user)
    }
    catch (error) {
      logger.error('Failed to check if user exists:', error)

      await ctx.reply('User not found')

      return false
    }
  }

  async initCommands(): Promise<void> {
    this.bot.command('getid', (ctx) => {
      const chatId = ctx.chat.id
      ctx.reply(`Your current chatId: ${chatId}`)
    })

    this.bot.command('getall', async (ctx) => {
      if (!await this.isUserExists(ctx)) {
        return
      }

      const products = await this.dependencies.getProducts(ctx.chat.id.toString())
      if (products.length === 0) {
        ctx.reply('No products found')

        return
      }

      await this.sendNotifications([ctx.chat.id.toString()], products, this.batchSize)
    })

    this.bot.command('addlist', async (ctx) => {
      if (!await this.isUserExists(ctx)) {
        return
      }

      const [, url] = ctx.message.text.split(' ')
      if (!validateUrl(url)) {
        ctx.reply('Invalid URL, example: https://ozon.ru/t/QweRtY', {
          link_preview_options: {
            is_disabled: true,
          },
        })

        return
      }

      const listId = await this.dependencies.setFavoriteList(ctx.chat.id.toString(), url)
      ctx.reply(`Favorite list added: ${listId} \n\n For check: https://www.ozon.ru/my/favorites/shared?list=${listId}`)
    })

    this.bot.command('adduser', async (ctx) => {
      if (!await this.isUserExists(ctx)) {
        return
      }

      const [, userId] = ctx.message.text.split(' ')
      if (!userId) {
        ctx.reply('User not specified')

        return
      }
      const user = await this.dependencies.getUser(userId)

      if (!user) {
        ctx.reply('User not found')

        return
      }

      try {
        await this.dependencies.setActive(userId, true)
        await this.bot.telegram.sendMessage(userId, '🎉 You are updated status to active')
        ctx.reply(`User ${userId} updated status to active`)
      }
      catch (error) {
        logger.error(`Failed to add user ${userId}:`, error)
        ctx.reply('Failed to add user')
      }
    })

    this.bot.command('stop', async (ctx) => {
      if (!await this.isUserExists(ctx)) {
        return
      }

      await this.dependencies.stop(ctx.chat.id.toString())
      ctx.reply('🛑 Stopped')
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

      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    catch (error) {
      logger.error('Failed to initialize Telegram bot:', error)
      throw error
    }
  }

  async sendAnalytics(chatId: string, analyticsArray: ProductAnalytics[] | null): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bot is not running, skipping message')

      return
    }

    if (!analyticsArray) {
      logger.warn('No analytics data to send')
      this.bot.telegram.sendMessage(chatId, 'No data to send')

      return
    }

    if (analyticsArray.length === 0) {
      logger.warn('No price changes to send')
      this.bot.telegram.sendMessage(chatId, 'Prices did not change')

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
      const formattedMessages = batch.map(msg => this.formatAnalyticsMessage(msg))
      const messageText = this.formatMessage(formattedMessages, i)

      await this.sendTelegramMessage(chatId, messageText)
    }
  }

  private async sendTelegramMessage(chatId: string, text: string) {
    await this.bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
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
    const { name, url, price: currentPrice } = analytics.current
    const { price: minPrice } = analytics.minPrice
    const { price: maxPrice } = analytics.maxPrice

    const trend = this.getPriceTrendSymbol(analytics.priceDiffPercent)
    const priceChangeFormatted = this.formatPriceChange(analytics.priceDiffPercent)
    const [productName, ..._args] = name.split(',')

    return `
<b>${productName}</b>
💵 <b>${formatPrice(currentPrice)}</b> 
📈 <code>${trend} ${priceChangeFormatted}</code>
ℹ️ Min/Max: <code>${formatPrice(minPrice)}/${formatPrice(maxPrice)}</code>
<a href="${url}">Открыть в Ozon ➜</a>
${BotService.ITEM_SEPARATOR}`
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
