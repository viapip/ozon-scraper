import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { formatTimeString, getTodayDateString } from './dates.js'

/**
 * Sleep for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms)
  })
}

/**
 * Format a price value
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    currency: 'RUB',
    style: 'currency',
  })
    .format(price)
}

/**
 * Get a random delay value between min and max
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Check if a URL is a valid Ozon shared list URL
 */
export function validateUrl(url?: string): boolean {
  if (!url) {
    return false
  }

  return (/(?:https?:\/\/)?(?:www\.)?ozon\.ru\/t\/.+/).test(url)
}

/**
 * Check if a product is available based on price
 */
export function isProductAvailable(price: number): boolean {
  return price !== -1
}

/**
 * Create a directory if it doesn't exist
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  }
  catch {
    // Ignore if directory already exists
  }
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = ''): string {
  return `${prefix}${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 15)}`
}

/**
 * Create a filename with timestamp
 */
export function createTimestampedFilename(baseName: string, extension: string): string {
  const date = getTodayDateString()
  const time = formatTimeString()
    .replace(/:/g, '-')

  return `${baseName}_${date}_${time}.${extension}`
}

/**
 * Save JSON data to a file
 */
export async function saveJsonToFile(filePath: string, data: any): Promise<void> {
  const dirPath = path.dirname(filePath)
  await ensureDirectoryExists(dirPath)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * Load JSON data from a file
 */
export async function loadJsonFromFile<T>(filePath: string): Promise<null | T> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const content = await fs.readFile(fullPath, 'utf8')

    return JSON.parse(content) as T
  }
  catch {
    return null
  }
}

/**
 * Group an array of objects by a key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item)
    result[key] = result[key] || []
    result[key].push(item)

    return result
  }, {} as Record<string, T[]>)
}

interface CookieParams {
  domain?: string
  expires?: number
  httpOnly?: boolean
  name: string
  path?: string
  sameSite?: 'Lax' | 'None' | 'Strict'
  secure?: boolean
  value: string
}

/**
 * Parse a cookie string into cookie objects
 */
export function parseCookieString(cookieString: string): CookieParams[] {
  return cookieString
    .split('\n')
    .filter((line) => {
      return line.trim()
    })
    .map((line) => {
      const parts = line.split(';')
        .map((part) => {
          return part.trim()
        })
      const [nameValue, ...attributes] = parts
      const [name, value] = nameValue.split('=')

      const cookie: CookieParams = {
        domain: '',
        name,
        path: '/',
        sameSite: 'None',
        secure: false,
        value: value || '',
      }

      for (const attr of attributes) {
        const [key, val] = attr.split('=')
          .map((s) => {
            return s.toLowerCase()
              .trim()
          })
        if (key === 'domain') {
          cookie.domain = val
        }
        if (key === 'path') {
          cookie.path = val
        }
        if (key === 'secure') {
          cookie.secure = true
        }
        if (key === 'samesite') {
          cookie.sameSite = val as CookieParams['sameSite']
        }
      }

      return cookie
    })
}

/**
 * Read cookies from a file
 */
export async function readCookiesFromFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    return await fs.readFile(fullPath, 'utf8')
  }
  catch (error) {
    throw new Error(`Ошибка чтения файла cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Save cookies to a file
 */
export async function saveCookiesToFile(path: string, cookies: any[]): Promise<void> {
  const cookieString = cookies
    .map((cookie) => {
      const { domain, name, path: cookiePath, sameSite, secure, value } = cookie
      const parts = [
        `${name}=${value}`,
        domain && `domain=${domain}`,
        cookiePath && `path=${cookiePath}`,
        secure && 'secure',
        sameSite && `samesite=${sameSite}`,
      ].filter(Boolean)

      return parts.join('; ')
    })
    .join('\n')

  await fs.writeFile(path, cookieString, 'utf8')
}
