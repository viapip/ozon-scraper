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
      await ctx.reply('User not found')

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
    await ctx.reply(`0H B5:CI89 ID: ${chatId}`)
  }

  /**
   * Handle the /getall command
   */
  async handleGetAll(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return
    }

    if (!await this.canActivate(ctx)) {
      await ctx.reply('0H 0::0C=B 5I5 =5 0:B828@>20=')

      return
    }

    const chatId = ctx.chat.id.toString()
    const products = await this.dependencies.getProducts(chatId)

    if (products.length === 0) {
      await ctx.reply('">20@K =5 =0945=K')

      return
    }

    await this.sendProductAnalytics(chatId, products)
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
      await ctx.reply('525@=K9 D>@<0B AAK;:8. @8<5@: https://ozon.ru/t/QweRtY', {
        link_preview_options: {
          is_disabled: true,
        },
      })

      return
    }

    const chatId = ctx.chat.id.toString()
    try {
      const listId = await this.dependencies.setFavoriteList(chatId, url)
      await ctx.reply(`!?8A>: 871@0==>3> 4>102;5=: ${listId} \n\n;O ?@>25@:8: https://www.ozon.ru/my/favorites/shared?list=${listId}`)
    }
    catch (error) {
      logger.error(`Failed to add favorite list for user ${chatId}:`, error)
      await ctx.reply('5 C40;>AL 4>1028BL A?8A>: 871@0==>3>. >60;C9AB0, ?@>25@LB5 AAK;:C 8 ?>?@>1C9B5 A=>20.')
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
      await ctx.reply('L # 20A =5B ?@02 4;O 0:B820F88 ?>;L7>20B5;59')

      return
    }

    const [, userId] = ctx.message.text.split(' ')
    if (!userId) {
      await ctx.reply('� #:068B5 ID ?>;L7>20B5;O.\n@8<5@: /activate 123456789')

      return
    }

    const user = await this.dependencies.getUser(userId)
    if (!user) {
      await ctx.reply('L >;L7>20B5;L =5 =0945=. @>25@LB5 ID 8 ?>?@>1C9B5 A=>20')

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
      await ctx.reply(` >B>2>! >;L7>20B5;L ${userId} CA?5H=> 0:B828@>20=`)
    }
    catch (error) {
      logger.error(`Failed to activate user ${userId}:`, error)
      await ctx.reply('L 5 C40;>AL 0:B828@>20BL ?>;L7>20B5;O. >?@>1C9B5 ?>765')
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
      await ctx.reply('# 20A =5B ?@02 4;O >AB0=>2:8 >BA;56820=8O')

      return
    }

    await this.dependencies.clearUserProducts(ctx.chat.id.toString())
    await ctx.reply('=� BA;56820=85 >AB0=>2;5=>')
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
  async sendProductAnalytics(chatId: string, analytics: ProductAnalytics[], batchSize = 10): Promise<void> {
    try {
      for (let i = 0; i < analytics.length; i += batchSize) {
        const batch = analytics.slice(i, i + batchSize)
        const formattedMessages = batch.map((msg) => {
          return this.formatter.formatAnalyticsMessage(msg)
        })
        const messageText = this.formatter.formatMessage(formattedMessages, i)

        await this.sendMessage(chatId, messageText)
      }
    }
    catch (error) {
      logger.error(`Failed to send product analytics to ${chatId}:`, error)
    }
  }

  /**
   * Send a message to a user
   */
  private async sendMessage(chatId: string, text: string): Promise<void> {
    // This method will be called by the bot instance
  }
}
