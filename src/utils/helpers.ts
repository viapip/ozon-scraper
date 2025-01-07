import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

export function validateUrl(url: string): boolean {
  return (/(?:https?:\/\/)?(?:www\.)?ozon\.ru\/t\/.+/).test(url)
}

export function isProductAvailable(price: number): boolean {
  return price !== -1
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  })
    .format(price)
}

interface CookieParams {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

// const ALLOWED_COOKIES = ['__Secure-access-token', '__Secure-refresh-token', '__Secure-user-id']

export function parseCookieString(cookieString: string): CookieParams[] {
  return cookieString
    .split('\n')
    .filter(line => line.trim())
    .map((line) => {
      const parts = line.split(';')
        .map(part => part.trim())
      const [nameValue, ...attributes] = parts
      const [name, value] = nameValue.split('=')

      const cookie: CookieParams = {
        name,
        value: value || '',
        domain: '',
        path: '/',
        secure: false,
        sameSite: 'None',
      }

      for (const attr of attributes) {
        const [key, val] = attr.split('=')
          .map(s => s.toLowerCase()
            .trim())
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

export function fromMinutes(minutes: number): number {
  return minutes * 60 * 1000
}

export async function readCookiesFromFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const content = await fs.readFile(fullPath, 'utf8')

    return content
  }
  catch (error) {
    throw new Error(`Ошибка чтения файла cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function saveCookiesToFile(path: string, cookies: any[]): Promise<void> {
  const cookieString = cookies
    .map((cookie) => {
      const { name, value, domain, path: cookiePath, secure, sameSite } = cookie
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
