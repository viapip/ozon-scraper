/**
 * Format a price as a string with currency symbol
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
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
 * Format a date and time as a string with seconds
 */
export function formatDateTimeWithSeconds(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
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
export function validateUrl(url: string): boolean {
  return (/(?:https?:\/\/)?(?:www\.)?ozon\.ru\/t\/.+/).test(url)
}
