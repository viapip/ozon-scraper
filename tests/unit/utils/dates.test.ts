import { formatTimeString, fromHours, fromMinutes, getRandomDelay, getTodayDateString } from '~/utils/dates'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('date utilities', () => {
  describe('fromMinutes', () => {
    it('should convert minutes to milliseconds', () => {
      expect(fromMinutes(1))
        .toBe(60 * 1000) // 1 minute = 60,000 ms
      expect(fromMinutes(5))
        .toBe(5 * 60 * 1000) // 5 minutes = 300,000 ms
      expect(fromMinutes(0))
        .toBe(0)
      expect(fromMinutes(0.5))
        .toBe(30 * 1000) // 0.5 minutes = 30,000 ms
    })
  })

  describe('fromHours', () => {
    it('should convert hours to milliseconds', () => {
      expect(fromHours(1))
        .toBe(60 * 60 * 1000) // 1 hour = 3,600,000 ms
      expect(fromHours(2))
        .toBe(2 * 60 * 60 * 1000) // 2 hours = 7,200,000 ms
      expect(fromHours(0))
        .toBe(0)
      expect(fromHours(0.5))
        .toBe(30 * 60 * 1000) // 0.5 hours = 1,800,000 ms
    })
  })

  describe('getRandomDelay', () => {
    beforeEach(() => {
      // Mock Math.random to return predictable values
      vi.spyOn(Math, 'random')
        .mockImplementation(() => {
          return 0.5
        })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should generate random delay within specified range', () => {
      // With Math.random() = 0.5, we should get the middle of the range
      expect(getRandomDelay(100, 200))
        .toBe(150) // 100 + 0.5 * (200 - 100 + 1) floored = 150
      expect(getRandomDelay(0, 100))
        .toBe(50) // 0 + 0.5 * (100 - 0 + 1) floored = 50

      // Test other random values
      vi.mocked(Math.random)
        .mockImplementation(() => {
          return 0
        })
      expect(getRandomDelay(100, 200))
        .toBe(100) // Min value

      vi.mocked(Math.random)
        .mockImplementation(() => {
          return 0.999
        })
      expect(getRandomDelay(100, 200))
        .toBe(200) // Max value (floored from 200.999)
    })
  })

  describe('getTodayDateString', () => {
    it('should format today\'s date as YYYY-MM-DD', () => {
      // Mock Date to return a specific date
      const mockDate = new Date(2023, 5, 15) // June 15, 2023
      vi.spyOn(globalThis, 'Date')
        .mockImplementation(() => {
          return mockDate as any
        })

      expect(getTodayDateString())
        .toBe('2023-06-15')

      vi.restoreAllMocks()
    })

    it('should pad month and day with leading zeros', () => {
      // Test with single-digit month and day
      const mockDate = new Date(2023, 0, 5) // January 5, 2023
      vi.spyOn(globalThis, 'Date')
        .mockImplementation(() => {
          return mockDate as any
        })

      expect(getTodayDateString())
        .toBe('2023-01-05')

      vi.restoreAllMocks()
    })
  })

  describe('formatTimeString', () => {
    it('should format time as HH:MM:SS', () => {
      const date = new Date(2023, 0, 1, 14, 30, 45) // 14:30:45
      expect(formatTimeString(date))
        .toBe('14:30:45')
    })

    it('should pad hours, minutes, and seconds with leading zeros', () => {
      const date = new Date(2023, 0, 1, 9, 5, 7) // 9:05:07
      expect(formatTimeString(date))
        .toBe('09:05:07')
    })

    it('should use current time when no date is provided', () => {
      // Mock current date
      const mockDate = new Date(2023, 0, 1, 12, 0, 0) // 12:00:00
      vi.spyOn(globalThis, 'Date')
        .mockImplementation(() => {
          return mockDate as any
        })

      expect(formatTimeString())
        .toBe('12:00:00')

      vi.restoreAllMocks()
    })
  })
})
