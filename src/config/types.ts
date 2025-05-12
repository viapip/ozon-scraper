/**
 * Configuration types for the application
 */

export interface OzonConfig {
  headless: boolean
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

export interface DatabaseConfig {
  path: string
}

export interface LogConfig {
  filePath?: string
  level: string
}

export interface AppConfig {
  database: DatabaseConfig
  log: LogConfig
  ozon: OzonConfig
  scheduler: SchedulerConfig
  security: SecurityConfig
  telegram: TelegramConfig
}
