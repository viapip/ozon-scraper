import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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
