import { Telegraf } from 'telegraf'
import { createLogger } from '../../utils/logger'
import type { CommandHandlerDependencies } from './commands'
import { TelegramCommandHandler } from './commands'
import { TelegramFormatter } from './formatter'

import type { ProductAnalytics } from '../../types'

const logger = createLogger('TelegramService')

export interface TelegramServiceOptions {
  batchSize?: number
  botToken: string
  commandDependencies: CommandHandlerDependencies
}

/**
 * Service for interacting with the Telegram API
 */
export class TelegramService {
  private batchSize: number
  private bot: Telegraf
  private commandHandler: TelegramCommandHandler
  private formatter: TelegramFormatter
  private isRunning = false

  constructor(options: TelegramServiceOptions) {
    logger.info('Initializing Telegram service')

    if (!options.botToken) {
      throw new Error('Telegram bot token is required')
    }

    this.bot = new Telegraf(options.botToken)
    this.commandHandler = new TelegramCommandHandler(options.commandDependencies)
    this.formatter = new TelegramFormatter()
    this.batchSize = options.batchSize || 10
  }

  /**
   * Initialize the bot and register commands
   */
  async init(): Promise<void> {
    try {
      logger.info('Registering Telegram bot commands')

      // Set up command handlers
      this.bot.command('start', (ctx) => {
        return this.commandHandler.handleStart(ctx)
      })
      this.bot.command('getid', (ctx) => {
        return this.commandHandler.handleGetId(ctx)
      })
      this.bot.command('getall', (ctx) => {
        return this.commandHandler.handleGetAll(ctx)
      })
      this.bot.command('addlist', (ctx) => {
        return this.commandHandler.handleAddList(ctx)
      })
      this.bot.command('activate', (ctx) => {
        return this.commandHandler.handleActivate(ctx)
      })
      this.bot.command('stop', (ctx) => {
        return this.commandHandler.handleStop(ctx)
      })
      this.bot.command('report', (ctx) => {
        return this.commandHandler.handleReport(ctx)
      })

      // Inject the sendMessage method for the command handler
      Object.defineProperty(this.commandHandler, 'sendMessage', {
        value: async (chatId: string, text: string) => {
          return this.sendTelegramMessage(chatId, text)
        },
      })

      // Start the bot
      logger.info('Starting Telegram bot')
      this.bot.launch()
        .then(() => {
          this.isRunning = true
          logger.info('Telegram bot started')
        })
        .catch((error) => {
          logger.error('Failed to start Telegram bot:', error)
          this.isRunning = false
        })

      // Wait for bot to initialize
      await new Promise((resolve) => {
        return setTimeout(resolve, 2000)
      })
    }
    catch (error) {
      logger.error('Failed to initialize Telegram bot:', error)
      throw error
    }
  }

  /**
   * Send analytics to a user
   */
  async sendAnalytics(chatId: string, analytics: ProductAnalytics[]): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bot is not running, skipping message')

      return
    }

    try {
      for (let i = 0; i < analytics.length; i += this.batchSize) {
        const batch = analytics.slice(i, i + this.batchSize)
        const formattedMessages = batch.map((msg) => {
          return this.formatter.formatAnalyticsMessage(msg)
        })
        const messageText = this.formatter.formatMessage(formattedMessages, i)

        await this.sendTelegramMessage(chatId, messageText)
      }
    }
    catch (error) {
      logger.error(`Failed to send analytics to ${chatId}:`, error)
    }
  }

  /**
   * Send a message to multiple chat IDs
   */
  async sendNotifications(chatIds: string[], analytics: ProductAnalytics[]): Promise<void> {
    for (const chatId of chatIds) {
      await this.sendAnalytics(chatId, analytics)
    }
  }

  /**
   * Send a message to a chat
   */
  private async sendTelegramMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        link_preview_options: { is_disabled: true },
        parse_mode: 'HTML',
      })
    }
    catch (error) {
      logger.error(`Failed to send message to ${chatId}:`, error)
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (this.isRunning) {
      this.bot.stop()
      this.isRunning = false
      logger.info('Telegram bot stopped')
    }
  }

  /**
   * Check if the bot is running
   */
  isReady(): boolean {
    return this.isRunning
  }
}

export * from './commands.js'
// Export the service and types
export * from './formatter.js'
export default TelegramService
