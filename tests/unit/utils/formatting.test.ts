import { formatDate, formatDateTimeWithSeconds, formatPrice, formatPriceOrStatus, formatTimestamp, validateUrl } from '~/utils/formatting'
import { describe, expect, it } from 'vitest'

describe('formatting utilities', () => {
  describe('formatPrice', () => {
    it('should format price with Russian locale and ruble symbol', () => {
      // Use regular expressions to match the format, as exact string matching
      // can be sensitive to invisible space characters in different locales
      expect(formatPrice(1000))
        .toMatch(/^1\s0{3}\s₽$/)
      expect(formatPrice(1234567.89))
        .toMatch(/^1\s234\s567[,.]89\s₽$/)
      expect(formatPrice(0))
        .toMatch(/^0\s₽$/)
    })

    it('should handle out-of-stock products', () => {
      expect(formatPrice(0, false))
        .toBe('Нет в наличии')
      expect(formatPrice(1000, false))
        .toMatch(/^1\s0{3}\s₽$/) // Should show price if non-zero, even if out of stock
    })
  })

  describe('formatPriceOrStatus', () => {
    it('should format price for in-stock products', () => {
      expect(formatPriceOrStatus(1000, true))
        .toMatch(/^1\s0{3}\s₽$/)
    })

    it('should show unavailable message for out-of-stock products', () => {
      expect(formatPriceOrStatus(0, false))
        .toBe('Нет в наличии')
    })

    it('should show special message for never-in-stock products', () => {
      expect(formatPriceOrStatus(0, false, false))
        .toBe('Товар никогда не был в наличии')
    })
  })

  describe('formatDate', () => {
    it('should format date in Russian format (DD.MM.YYYY)', () => {
      const date = new Date(2023, 0, 15) // January 15, 2023
      expect(formatDate(date))
        .toBe('15.01.2023')
    })

    it('should pad single digit days and months with zeros', () => {
      const date = new Date(2023, 5, 5) // June 5, 2023
      expect(formatDate(date))
        .toBe('05.06.2023')
    })
  })

  describe('formatDateTimeWithSeconds', () => {
    it('should format date and time with seconds in Russian format', () => {
      // Note: This test can be affected by timezone settings
      // Mock a specific date and time
      const date = new Date(2023, 0, 15, 14, 30, 45) // January 15, 2023, 14:30:45
      const formatted = formatDateTimeWithSeconds(date)

      // We can't predict the exact output due to locale formatting on different systems,
      // so we check for the presence of expected components
      expect(formatted)
        .toContain('15')
      expect(formatted)
        .toContain('01')
      expect(formatted)
        .toContain('2023')
      expect(formatted)
        .toMatch(/14\D30/) // Time parts with non-digit separator
      expect(formatted)
        .toMatch(/30\D45/) // Seconds part with non-digit separator
    })
  })

  describe('formatTimestamp', () => {
    it('should convert timestamp to formatted date string', () => {
      // January 15, 2023 UTC
      const timestamp = 1673740800000
      expect(formatTimestamp(timestamp))
        .toMatch(/15\D01\D2023/)
    })

    it('should handle current timestamp', () => {
      const now = Date.now()
      const today = new Date()
      const expectedMonth = String(today.getMonth() + 1)
        .padStart(2, '0')
      const expectedDay = String(today.getDate())
        .padStart(2, '0')
      const expectedYear = today.getFullYear()

      expect(formatTimestamp(now))
        .toMatch(new RegExp(`${expectedDay}[^\\d]${expectedMonth}[^\\d]${expectedYear}`))
    })
  })

  describe('validateUrl', () => {
    it('should validate Ozon product URLs', () => {
      // Valid URLs
      expect(validateUrl('https://ozon.ru/t/product-page'))
        .toBe(true)
      expect(validateUrl('http://ozon.ru/t/something-here'))
        .toBe(true)
      expect(validateUrl('ozon.ru/t/123-abc'))
        .toBe(true)
      expect(validateUrl('www.ozon.ru/t/abc123'))
        .toBe(true)

      // Invalid URLs
      expect(validateUrl('https://example.com'))
        .toBe(false)
      expect(validateUrl('https://ozon.ru/product/123'))
        .toBe(false) // Missing /t/ path
      expect(validateUrl('https://ozon.ru/'))
        .toBe(false)
      expect(validateUrl('not-a-url'))
        .toBe(false)
    })
  })
})
