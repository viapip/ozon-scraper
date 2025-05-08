import process from 'node:process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { createConsola, LogLevels } from 'consola'
import { format } from 'date-fns'

/**
 * Creates and configures a structured logger
 */
export function createLogger(tag: string) {
  return createConsola({
    formatOptions: {
      colors: true,
      compact: false,
      date: true,
    },
    level: getLogLevel(),
  })
    .withTag(tag)
}

/**
 * Determines log level from environment or defaults to info
 */
function getLogLevel(): number {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()

  switch (envLevel) {
    case 'debug':
      return LogLevels.debug
    case 'error':
      return LogLevels.error
    case 'fatal':
      return LogLevels.fatal
    case 'info':
      return LogLevels.info
    case 'log':
      return LogLevels.log
    case 'silent':
      return LogLevels.silent
    case 'success':
      return LogLevels.success
    case 'trace':
      return LogLevels.trace
    case 'verbose':
      return LogLevels.verbose
    case 'warn':
      return LogLevels.warn
    default:
      return LogLevels.info
  }
}

/**
 * Logs application errors to a file
 */
export async function logErrorToFile(error: Error, context?: string): Promise<void> {
  try {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    const logDir = path.join(process.cwd(), 'reports', 'logs')

    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true })

    const logFile = path.join(logDir, 'errors.log')
    const logMessage = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.name}: ${error.message}\n${error.stack || 'No stack trace'}\n\n`

    await fs.appendFile(logFile, logMessage, 'utf8')
  }
  catch (fileError) {
    // Use console as fallback if file logging fails
    console.error('Failed to log error to file:', fileError)
    console.error('Original error:', error)
  }
}
