/**
 * Format a price as a string with currency symbol
 * @param price - The price to format
 * @param inStock - Optional flag indicating if the product is in stock (defaults to true)
 */
export function formatPrice(price: number, inStock?: boolean): string {
  if (inStock === false && price === 0) {
    return 'Нет в наличии'
  }

  return `${price.toLocaleString('ru-RU')} ₽`
}

/**
 * Format a price or status based on availability
 * @param price - The price to format
 * @param inStock - Whether the product is in stock
 * @param wasEverInStock - Whether the product was ever in stock
 */
export function formatPriceOrStatus(price: number, inStock: boolean, wasEverInStock?: boolean): string {
  if (!inStock) {
    // Product is not in stock
    if (wasEverInStock === false) {
      return 'Товар никогда не был в наличии'
    }

    return 'Нет в наличии'
  }

  return formatPrice(price)
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
