import { createLogger } from '../../utils/logger'
import { TelegramFormatter } from './formatter'
import { validateUrl } from '../../utils/formatting'

import type { Context } from 'telegraf'
import type { ProductAnalytics, User } from '../../types'

const logger = createLogger('TelegramCommands')

export interface CommandHandlerDependencies {
  addUser: (chatId: string) => Promise<void>
  clearUserProducts: (chatId: string) => Promise<void>
  getProducts: (chatId: string) => Promise<ProductAnalytics[]>
  getReport: (chatId: string) => string
  getUser: (chatId: string) => Promise<null | User>
  setActive: (chatId: string, isActive: boolean) => Promise<void>
  setFavoriteList: (chatId: string, url: string) => Promise<string>
}

/**
 * Handles Telegram bot commands
 */
export class TelegramCommandHandler {
  private dependencies: CommandHandlerDependencies
  private formatter: TelegramFormatter
  constructor(dependencies: CommandHandlerDependencies) {
    this.dependencies = dependencies
    this.formatter = new TelegramFormatter()
  }

  /**
   * Check if a user can activate others (is activated themselves)
   */
  async canActivate(ctx: Context): Promise<boolean> {
    try {
      if (!ctx.chat) {
        throw new Error('Chat not found')
      }

      const user = await this.dependencies.getUser(ctx.chat.id.toString())

      return Boolean(user) && Boolean(user?.isActive)
    }
    catch (error) {
      logger.error('Failed to check if user exists:', error)
      await ctx.reply('Пользователь не найден')

      return false
    }
  }

  /**
   * Handle the /start command
   */
  async handleStart(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    const userId = ctx.chat.id.toString()
    await this.dependencies.addUser(userId)

    const welcomeMessage = this.formatter.formatWelcomeMessage(userId)
    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
    })
  }

  /**
   * Handle the /getid command
   */
  async handleGetId(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    const chatId = ctx.chat.id
    await ctx.reply(`Ваш текущий ID: ${chatId}`)
  }

  /**
   * Handle the /getall command
   */
  async handleGetAll(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    if (!await this.canActivate(ctx)) {
      await ctx.reply('Ваш аккаунт еще не активирован')

      return
    }

    const chatId = ctx.chat.id.toString()
    const products = await this.dependencies.getProducts(chatId)

    if (products.length === 0) {
      await ctx.reply('Товары не найдены')

      return
    }

    await this.sendProductAnalytics(ctx, chatId, products)
  }

  /**
   * Handle the /addlist command
   */
  async handleAddList(ctx: Context): Promise<void> {
    if (!ctx.chat || !ctx.message || !('text' in ctx.message)) {
      return
    }

    if (!await this.canActivate(ctx)) {
      return
    }

    const [, url] = ctx.message.text.split(' ')
    if (!validateUrl(url)) {
      await ctx.reply('Неверный формат ссылки. Пример: https://ozon.ru/t/QweRtY', {
        link_preview_options: {
          is_disabled: true,
        },
      })

      return
    }

    const chatId = ctx.chat.id.toString()
    try {
      const listId = await this.dependencies.setFavoriteList(chatId, url)
      await ctx.reply(`Список избранного добавлен: ${listId} \n\nДля проверки: https://www.ozon.ru/my/favorites/shared?list=${listId}`)
    }
    catch (error) {
      logger.error(`Failed to add favorite list for user ${chatId}:`, error)
      await ctx.reply('Не удалось добавить список избранного. Пожалуйста, проверьте ссылку и попробуйте снова.')
    }
  }

  /**
   * Handle the /activate command
   */
  async handleActivate(ctx: Context): Promise<void> {
    if (!ctx.chat || !ctx.message || !('text' in ctx.message)) {
      return
    }

    if (!await this.canActivate(ctx)) {
      await ctx.reply('У вас нет прав для активации пользователей')

      return
    }

    const [, userId] = ctx.message.text.split(' ')
    if (!userId) {
      await ctx.reply('Укажите ID пользователя.\nПример: /activate 123456789')

      return
    }

    const user = await this.dependencies.getUser(userId)
    if (!user) {
      await ctx.reply('Пользователь не найден. Проверьте ID и попробуйте снова')

      return
    }

    try {
      await this.dependencies.setActive(userId, true)

      // Send message to activated user
      const activationMessage = this.formatter.formatActivationSuccessMessage()
      await ctx.telegram.sendMessage(userId, activationMessage, {
        parse_mode: 'Markdown',
      })

      // Send confirmation to activating user
      await ctx.reply(`Готово! Пользователь ${userId} успешно активирован`)
    }
    catch (error) {
      logger.error(`Failed to activate user ${userId}:`, error)
      await ctx.reply('Не удалось активировать пользователя. Попробуйте позже')
    }
  }

  /**
   * Handle the /stop command
   */
  async handleStop(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    if (!await this.canActivate(ctx)) {
      await ctx.reply('У вас нет прав для остановки отслеживания')

      return
    }

    await this.dependencies.clearUserProducts(ctx.chat.id.toString())
    await ctx.reply('Отслеживание остановлено')
  }

  /**
   * Handle the /report command
   */
  async handleReport(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    const chatId = ctx.chat.id.toString()
    const report = this.dependencies.getReport(chatId)
    await ctx.reply(report)
  }

  /**
   * Send product analytics to a user
   */
  async sendProductAnalytics(ctx: Context, chatId: string, analytics: ProductAnalytics[], batchSize = 10): Promise<void> {
    try {
      for (let i = 0; i < analytics.length; i += batchSize) {
        const batch = analytics.slice(i, i + batchSize)
        const formattedMessages = batch.map((msg) => {
          return this.formatter.formatAnalyticsMessage(msg)
        })
        const messageText = this.formatter.formatMessage(formattedMessages, i)

        await ctx.telegram.sendMessage(chatId, messageText, {
          link_preview_options: { is_disabled: true },
          parse_mode: 'HTML',
        })
      }
    }
    catch (error) {
      logger.error(`Failed to send product analytics to ${chatId}:`, error)
    }
  }
}
