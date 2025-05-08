import process from 'node:process'

import dotenv from 'dotenv'

import { createLogger } from '../utils/logger.js'

const logger = createLogger('ConfigService')

// Initialize dotenv at import time to ensure environment variables are loaded
dotenv.config()

export interface OzonConfig {
  userAgent: string
}

export interface SchedulerConfig {
  checkInterval: number
}

export interface TelegramConfig {
  adminChatId: string
  botToken: string
}

export interface SecurityConfig {
  cookieEncryptionEnabled: boolean
  cookieEncryptionKey?: string
}

export interface AppConfig {
  ozon: OzonConfig
  scheduler: SchedulerConfig
  security: SecurityConfig
  telegram: TelegramConfig
}

export class ConfigService {
  // eslint-disable-next-line no-use-before-define
  private static instance: ConfigService
  private config: AppConfig

  private constructor() {
    this.config = this.loadConfig()
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService()
    }

    return ConfigService.instance
  }

  public getConfig(): AppConfig {
    return this.config
  }

  private loadConfig(): AppConfig {
    logger.debug('Loading application configuration')

    const config: AppConfig = {
      ozon: {
        userAgent: process.env.OZON_USER_AGENT
          || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      scheduler: {
        checkInterval: Number(process.env.SCHEDULER_CHECK_INTERVAL) || 30,
      },
      security: {
        cookieEncryptionEnabled: process.env.COOKIE_ENCRYPTION_ENABLED === 'true',
        cookieEncryptionKey: process.env.COOKIE_ENCRYPTION_KEY,
      },
      telegram: {
        adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      },
    }

    this.validateConfig(config)

    return config
  }

  private validateConfig(config: AppConfig): void {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables')
    }
    if (!config.telegram.adminChatId) {
      throw new Error('TELEGRAM_ADMIN_CHAT_ID is required in environment variables')
    }

    // If cookie encryption is enabled, we need an encryption key
    if (config.security.cookieEncryptionEnabled && !config.security.cookieEncryptionKey) {
      logger.warn('Cookie encryption is enabled but no encryption key was provided. Using a default key (not recommended for production).')
      config.security.cookieEncryptionKey = 'default-development-key-change-in-production'
    }

    logger.info('Application configuration validated successfully')
  }
}
