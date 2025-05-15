import { makeRetryable, retry, withRetry } from '~/utils/retry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the logger
vi.mock('~/utils/logger', () => {
  return {
    createLogger: () => {
      return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      }
    },
  }
})

describe('retry utilities', () => {
  // Mock setTimeout to avoid actually waiting during tests
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('withRetry', () => {
    it('should return function result on successful execution', async () => {
      const fn = vi.fn()
        .mockResolvedValue('success')

      const result = withRetry(fn)
      // Advance all timers to ensure the promise resolves
      await vi.runAllTimersAsync()

      expect(await result)
        .toBe('success')
      expect(fn)
        .toHaveBeenCalledTimes(1)
    })

    it('should retry on failure up to maxRetries', async () => {
      const error = new Error('Network error')
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      // Mock retryableErrors to always return true for our test
      const retryOptions = {
        initialDelayMs: 1, // Speed up tests
        logging: false,
        maxRetries: 3,
        retryableErrors: () => {
          return true
        }, // Force errors to be retryable
      }

      const result = withRetry(fn, retryOptions)

      // Advance timers to trigger retries
      await vi.runAllTimersAsync()

      expect(await result)
        .toBe('success')
      expect(fn)
        .toHaveBeenCalledTimes(3)
    })

    it('should call onRetry handler between retry attempts', async () => {
      const error = new Error('Network error')
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      const onRetry = vi.fn()

      const result = withRetry(fn, {
        initialDelayMs: 1, // Speed up tests
        logging: false,
        maxRetries: 2,
        onRetry,
        retryableErrors: () => {
          return true
        }, // Force errors to be retryable
      })

      // Advance timers to trigger retries
      await vi.runAllTimersAsync()

      expect(await result)
        .toBe('success')
      expect(onRetry)
        .toHaveBeenCalledTimes(1)
      expect(onRetry)
        .toHaveBeenCalledWith(error, 1, expect.any(Number))
    })

    it('should apply exponential backoff with each retry', async () => {
      const error = new Error('Network error')
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      // Mock setTimeout to capture the delay values
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const result = withRetry(fn, {
        backoffFactor: 2,
        initialDelayMs: 100,
        jitter: false, // Disable jitter for predictable delays
        logging: false,
        maxRetries: 3,
        retryableErrors: () => {
          return true
        }, // Force errors to be retryable
      })

      // Advance timers to trigger retries
      await vi.runAllTimersAsync()

      expect(await result)
        .toBe('success')

      // Check that setTimeout was called with increasing delays
      // First retry: 100ms
      // Second retry: 100ms * 2^1 = 200ms
      expect(setTimeoutSpy)
        .toHaveBeenCalledWith(expect.any(Function), 100)
      expect(setTimeoutSpy)
        .toHaveBeenCalledWith(expect.any(Function), 200)
    })
  })

  describe('makeRetryable', () => {
    it('should pass arguments correctly to the original function', async () => {
      const originalFn = vi.fn()
        .mockImplementation(
          async (a: number, b: string, c: boolean) => {
            return `${a}-${b}-${c}`
          },
        )

      const retryableFn = makeRetryable(originalFn, { logging: false })

      const result = await retryableFn(42, 'test', true)

      expect(result)
        .toBe('42-test-true')
      expect(originalFn)
        .toHaveBeenCalledWith(42, 'test', true)
    })
  })

  // The decorator tests are skipped as they're complex to test with TypeScript
  // experimental decorators
  describe('retry decorator', () => {
    it('should exist as a function', () => {
      expect(typeof retry)
        .toBe('function')
    })
  })
})
