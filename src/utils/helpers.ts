import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { formatTimeString, getTodayDateString } from './dates'

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
