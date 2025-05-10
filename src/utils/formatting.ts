/**
 * Format a price as a string with currency symbol
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} �`
}

/**
 * Format a date as a string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format a timestamp as a date string
 */
export function formatTimestamp(timestamp: number): string {
  return formatDate(new Date(timestamp))
}

/**
 * Validate a URL format
 */
export function validateUrl(url?: string): boolean {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)

    return parsed.hostname.includes('ozon.ru')
  }
  catch {
    return false
  }
}
