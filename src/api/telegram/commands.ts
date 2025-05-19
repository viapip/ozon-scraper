import type { Context, MiddlewareFn } from 'telegraf'

import type { NotificationFrequency, ProductAnalytics, User } from '../../types'

import { validateUrl } from '../../utils/formatting'
import { createLogger } from '../../utils/logger'
import { TelegramFormatter } from './formatter'

const logger = createLogger('TelegramCommands')

export interface CommandHandlerDependencies {
  addUser: (chatId: string) => Promise<void>
  clearUserProducts: (chatId: string) => Promise<void>
  getProducts: (chatId: string) => Promise<ProductAnalytics[]>
  getReport: (chatId: string) => string
  getUser: (chatId: string) => Promise<null | User>
  setActive: (chatId: string, isActive: boolean) => Promise<void>
  setFavoriteList: (chatId: string, url: string) => Promise<string>
  setNotificationFrequency: (chatId: string, frequency: NotificationFrequency) => Promise<void>
  setNotificationThreshold: (chatId: string, threshold: number) => Promise<void>
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
   * Check if a user is activated
   * @param ctx - The Telegraf context
   * @param showMessage - Whether to show an error message if not activated
   */
  async isUserActivated(ctx: Context, showMessage = true): Promise<boolean> {
    try {
      if (!ctx.chat) {
        throw new Error('Chat not found')
      }

      const user = await this.dependencies.getUser(ctx.chat.id.toString())
      const isActivated = Boolean(user) && Boolean(user?.isActive)

      if (!isActivated && showMessage) {
        await ctx.reply('Ваш аккаунт еще не активирован')
      }

      return isActivated
    }
    catch (error) {
      logger.error('Failed to check if user exists:', error)
      if (showMessage) {
        await ctx.reply('Пользователь не найден')
      }

      return false
    }
  }

  /**
   * Creates a middleware that checks if a user is activated
   * @param skipCommands - Array of commands to skip activation check for (e.g., ['start', 'getid'])
   */
  createActivationCheckMiddleware(skipCommands: string[] = ['start', 'getid']): MiddlewareFn<Context> {
    return async (ctx, next) => {
      // Skip activation check for specified commands
      if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text || ''

        // Check if this is a command that should skip the activation check
        if (text.startsWith('/')) {
          const command = text.split(' ')[0].substring(1) // Remove leading slash and get command name
          if (skipCommands.includes(command)) {
            return next()
          }
        }
      }

      // For all other commands, check if user is activated
      if (await this.isUserActivated(ctx)) {
        return next()
      }

      // If we get here, the user is not activated and we've already shown a message
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
   * Handle the /setthreshold command
   */
  async handleSetThreshold(ctx: Context): Promise<void> {
    if (!ctx.chat || !ctx.message || !('text' in ctx.message)) {
      return
    }

    const [, thresholdStr] = ctx.message.text.split(' ')
    const threshold = Number.parseInt(thresholdStr, 10)

    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      await ctx.reply('Пожалуйста, укажите корректное значение от 0 до 100.\nПример: /setthreshold 10')

      return
    }

    const chatId = ctx.chat.id.toString()
    try {
      await this.dependencies.setNotificationThreshold(chatId, threshold)
      await ctx.reply(`Порог уведомлений установлен на ${threshold}%. Вы будете получать уведомления только при скидке от медианы более ${threshold}%.`)
    }
    catch (error) {
      logger.error(`Failed to set notification threshold for user ${chatId}:`, error)
      await ctx.reply('Не удалось установить порог уведомлений. Пожалуйста, попробуйте снова позже.')
    }
  }

  /**
   * Handle the /setfrequency command
   */
  async handleSetFrequency(ctx: Context): Promise<void> {
    if (!ctx.chat || !ctx.message || !('text' in ctx.message)) {
      return
    }

    const chatId = String(ctx.chat.id)
    const message = ctx.message.text || ''

    // Parse frequency type and optional hours
    const parts = message.split(' ')
    if (parts.length < 2) {
      await ctx.reply('Неверный формат команды. Пример: /setfrequency daily')

      return
    }

    const type = parts[1] as 'custom' | 'daily' | 'immediate' | 'weekly'
    if (![
      'custom',
      'daily',
      'immediate',
      'weekly',
    ].includes(type)) {
      await ctx.reply('Неверный тип частоты. Доступные варианты: immediate, daily, weekly, custom')

      return
    }

    const frequency: NotificationFrequency = { type }

    // Handle custom frequency with hours
    if (type === 'custom' && parts.length > 2) {
      const hours = Number.parseInt(parts[2], 10)
      if (!Number.isNaN(hours) && hours > 0) {
        frequency.hoursBetweenNotifications = hours
      }
      else {
        await ctx.reply('Неверное значение часов для частоты. Пример: /setfrequency custom 12')

        return
      }
    }

    try {
      // Update user settings
      await this.dependencies.setNotificationFrequency(chatId, frequency)

      // Reply with confirmation
      let replyMessage = ''
      switch (type) {
        case 'custom':
          replyMessage = `Уведомления будут приходить не чаще раза в ${frequency.hoursBetweenNotifications} часов, если скидка не увеличилась.`
          break
        case 'daily':
          replyMessage = 'Уведомления будут приходить не чаще раза в день, если скидка не увеличилась.'
          break
        case 'immediate':
          replyMessage = 'Уведомления будут приходить сразу при любых изменениях.'
          break
        case 'weekly':
          replyMessage = 'Уведомления будут приходить не чаще раза в неделю, если скидка не увеличилась.'
          break
      }

      await ctx.reply(replyMessage)
    }
    catch (error) {
      logger.error('Error handling set notification frequency:', error)
      await ctx.reply('Произошла ошибка при установке частоты уведомлений.')
    }
  }

  /**
   * Handle the /help command
   */
  async handleHelp(ctx: Context): Promise<void> {
    try {
      const helpMessage = this.formatter.formatHelpMessage()
      await ctx.reply(helpMessage, {
        parse_mode: 'Markdown',
      })
    }
    catch (error) {
      logger.error('Error handling help command:', error)
      await ctx.reply('Произошла ошибка при выполнении команды помощи.')
    }
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
