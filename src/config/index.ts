import dotenv from 'dotenv'
import path from 'node:path'
import process from 'node:process'

import type { AppConfig, LogConfig } from './types'

// Initialize dotenv at import time to ensure environment variables are loaded
dotenv.config()

/**
 * Loads environment variables with validation
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    database: {
      path: getEnv('DATABASE_PATH', path.join(process.cwd(), 'db')),
    },
    log: getLogConfig(),
    ozon: {
      userAgent: getEnv('OZON_USER_AGENT', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'),
    },
    scheduler: {
      checkInterval: getEnvAsNumber('SCHEDULER_CHECK_INTERVAL', 30),
    },
    security: {
      cookieEncryptionEnabled: getEnvAsBoolean('COOKIE_ENCRYPTION_ENABLED', false),
      cookieEncryptionKey: getEnv('COOKIE_ENCRYPTION_KEY'),
    },
    telegram: {
      adminChatId: getEnvRequired('TELEGRAM_ADMIN_CHAT_ID'),
      botToken: getEnvRequired('TELEGRAM_BOT_TOKEN'),
    },
  }

  validateConfig(config)

  return config
}

/**
 * Get a configuration value from environment variables
 */
function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || ''
}

/**
 * Get a required configuration value from environment variables
 * @throws Error if the value is not set
 */
function getEnvRequired(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is required in environment variables`)
  }

  return value
}

/**
 * Get an environment variable as a boolean
 */
function getEnvAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) {
    return defaultValue
  }

  return value.toLowerCase() === 'true'
}

/**
 * Get an environment variable as a number
 */
function getEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) {
    return defaultValue
  }

  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    console.warn(`${key} environment variable is not a valid number. Using default value: ${defaultValue}`)

    return defaultValue
  }

  return parsed
}

/**
 * Get log configuration from environment variables
 */
function getLogConfig(): LogConfig {
  return {
    filePath: getEnv('LOG_FILE_PATH', path.join(process.cwd(), 'reports', 'logs')),
    level: getEnv('LOG_LEVEL', 'info'),
  }
}

/**
 * Validate the application configuration
 * @throws Error if the configuration is invalid
 */
function validateConfig(config: AppConfig): void {
  // Security validation
  if (config.security.cookieEncryptionEnabled && !config.security.cookieEncryptionKey) {
    console.warn('Cookie encryption is enabled but no encryption key was provided. Using a default key (not recommended for production).')
    config.security.cookieEncryptionKey = 'default-development-key-change-in-production'
  }

  // Scheduler validation
  if (config.scheduler.checkInterval < 5) {
    console.warn(`Scheduler check interval (${config.scheduler.checkInterval}) is too low. Setting to minimum value of 5 minutes.`)
    config.scheduler.checkInterval = 5
  }
}

/**
 * Export the loaded configuration
 */
export const config = loadConfig()

/**
 * Export types for use in other modules
 */
export * from './types'
