/**
 * Convert minutes to milliseconds
 */
export function fromMinutes(minutes: number): number {
  return minutes * 60 * 1000
}

/**
 * Convert hours to milliseconds
 */
export function fromHours(hours: number): number {
  return hours * 60 * 60 * 1000
}

/**
 * Generate a random delay in milliseconds
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Get today's date as a string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1)
    .padStart(2, '0')
  const day = String(date.getDate())
    .padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Format a date as a time string (HH:MM:SS)
 */
export function formatTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours())
    .padStart(2, '0')
  const minutes = String(date.getMinutes())
    .padStart(2, '0')
  const seconds = String(date.getSeconds())
    .padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
}
