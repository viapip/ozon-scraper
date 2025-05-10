import fs from 'node:fs/promises'
import type { Cookie } from 'playwright'

/**
 * Delay execution for a specified time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms)
  })
}

/**
 * Get a random delay value between min and max
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Parse cookie string to Cookie objects
 */
export function parseCookieString(cookieString: string): Cookie[] {
  try {
    return JSON.parse(cookieString)
  }
  catch (error) {
    console.error('Failed to parse cookies:', error)

    return []
  }
}

/**
 * Save cookies to a file
 */
export async function saveCookiesToFile(filePath: string, cookies: Cookie[]): Promise<void> {
  try {
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2), 'utf8')
  }
  catch (error) {
    console.error('Failed to save cookies to file:', error)
  }
}
