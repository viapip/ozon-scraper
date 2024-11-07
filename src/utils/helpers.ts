import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
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

const ALLOWED_COOKIES = ['__Secure-access-token', '__Secure-refresh-token', '__Secure-user-id']

export function parseCookieString(cookieString: string) {
  const lines = cookieString.split('\n')
  const cookies: CookieParams[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      continue
    }

    const [name, value] = trimmedLine.split('=')
      .map(part => part.trim())

    if (name && ALLOWED_COOKIES.includes(name)) {
      cookies.push({
        name,
        value: value || '',
        domain: '.ozon.ru',
        path: '/',
        secure: true,
        sameSite: 'Lax',
      })
    }
  }

  return cookies
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

export async function saveCookiesToFile(filePath: string, cookies: { name: string, value: string, domain?: string }[]) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const filteredCookies = cookies.filter(cookie => ALLOWED_COOKIES.includes(cookie.name))

    const cookieStrings = filteredCookies.map(cookie => `${cookie.name}=${cookie.value}`)

    await fs.writeFile(fullPath, cookieStrings.join('\n'), 'utf8')
  }
  catch (error) {
    throw new Error(`Ошибка сохранения cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
