/**
 * Retry utility with exponential backoff for handling transient failures
 *
 * This module provides a flexible retry mechanism that implements exponential
 * backoff, jitter, and configurable retry conditions to make requests more resilient
 * against temporary failures and rate limiting.
 */

import { createLogger } from './logger'

const logger = createLogger('RetryUtility')

export interface RetryOptions {
  /** Backoff factor (how quickly the delay increases) */
  backoffFactor?: number
  /** Initial delay in milliseconds before the first retry */
  initialDelayMs?: number
  /** Add random jitter to delay to prevent synchronized retries */
  jitter?: boolean
  /** Whether to log retry attempts (default: true) */
  logging?: boolean
  /** Maximum delay in milliseconds between retries */
  maxDelayMs?: number
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Function to execute before each retry attempt */
  onRetry?: (error: any, attempt: number, delay: number) => Promise<void> | void
  /** Function to determine if an error is retryable */
  retryableErrors?: (error: any) => boolean
}

export const defaultRetryOptions: RetryOptions = {
  backoffFactor: 2,
  initialDelayMs: 1000,
  jitter: true,
  logging: true,
  maxDelayMs: 30000,
  maxRetries: 3,
  onRetry: async (error, attempt, delay) => {
    logger.info('onRetry', error, attempt, delay)
    // Default onRetry handler is empty
  },
  retryableErrors: (error: any) => {
    // By default, retry on network errors, 429 Too Many Requests, and 5xx server errors
    if (error?.message?.includes('net::ERR')) {
      return true
    }

    if (error?.response?.status) {
      const { status } = error.response

      return status === 429 || (status >= 500 && status < 600)
    }

    // Check for strings indicating temporary issues
    const retryableErrorMessages = [
      'timeout',
      'econnreset',
      'econnrefused',
      'epipe',
      'etimedout',
      'socket hang up',
      'network error',
      'too many requests',
      'server error',
      'limit exceeded',
      'доступ ограничен',
      'access restricted',
      'retry',
    ]

    const errorMessage = (error?.message || '').toLowerCase()

    return retryableErrorMessages.some((msg) => {
      return errorMessage.includes(msg)
    })
  },
}

/**
 * Calculate delay for the next retry attempt with exponential backoff
 */
function calculateBackoff(attempt: number, options: Required<RetryOptions>): number {
  // Calculate exponential backoff
  const exponentialDelay = Math.min(
    options.maxDelayMs,
    options.initialDelayMs * options.backoffFactor ** attempt,
  )

  // Add jitter if enabled (±30% variation)
  if (options.jitter) {
    const jitterFactor = 0.7 + Math.random() * 0.6 // Random value between 0.7 and 1.3

    return Math.floor(exponentialDelay * jitterFactor)
  }

  return exponentialDelay
}

/**
 * Delay execution for the specified time
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms)
  })
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry (must return a Promise)
 * @param options Retry configuration options
 * @returns Result of the function if successful
 * @throws Last error encountered if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  // Merge provided options with defaults
  const retryOptions = {
    ...defaultRetryOptions,
    ...options,
    backoffFactor: options.backoffFactor || defaultRetryOptions.backoffFactor!,
    initialDelayMs: options.initialDelayMs || defaultRetryOptions.initialDelayMs!,
    jitter: options.jitter !== undefined ? options.jitter : defaultRetryOptions.jitter!,
    logging: options.logging !== undefined ? options.logging : defaultRetryOptions.logging!,
    maxDelayMs: options.maxDelayMs || defaultRetryOptions.maxDelayMs!,
    maxRetries: options.maxRetries || defaultRetryOptions.maxRetries!,
    onRetry: options.onRetry || defaultRetryOptions.onRetry!,
    retryableErrors: options.retryableErrors || defaultRetryOptions.retryableErrors!,
  }

  let lastError: any
  let attempt = 0

  while (attempt <= retryOptions.maxRetries) {
    try {
      // Execute the function
      return await fn()
    }
    catch (error) {
      lastError = error
      attempt++

      // Check if we've exhausted all retry attempts
      if (attempt > retryOptions.maxRetries) {
        if (retryOptions.logging) {
          logger.error(`All retry attempts failed (${retryOptions.maxRetries}). Giving up.`, {
            error: lastError?.message || lastError,
          })
        }
        throw error
      }

      // Check if the error is retryable
      if (!retryOptions.retryableErrors(error)) {
        if (retryOptions.logging) {
          logger.warn(`Non-retryable error encountered. Not retrying.`, {
            error: lastError?.message || lastError,
          })
        }
        throw error
      }

      // Calculate the delay for this retry
      const delayMs = calculateBackoff(attempt - 1, retryOptions)

      // Log the retry attempt
      if (retryOptions.logging) {
        logger.info(`Retry attempt ${attempt}/${retryOptions.maxRetries} after ${delayMs}ms`, {
          error: lastError?.message || lastError,
        })
      }

      // Execute the onRetry handler
      await retryOptions.onRetry(error, attempt, delayMs)

      // Wait before the next retry
      await delay(delayMs)
    }
  }

  // This should never be reached due to the throw in the loop,
  // but TypeScript needs it for type checking
  throw lastError
}

/**
 * Create a retryable version of a function
 *
 * @param fn Function to make retryable
 * @param options Retry configuration options
 * @returns A new function that will retry the original function according to options
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {},
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    return withRetry(() => {
      return fn(...args)
    }, options) as ReturnType<T>
  }
}

/**
 * Retry decorator for class methods
 *
 * @param options Retry configuration options
 * @returns Method decorator that adds retry behavior to the decorated method
 *
 * @example
 * class ApiClient {
 *   @retry({ maxRetries: 3 })
 *   async fetchData() {
 *     // This method will automatically retry on failure
 *   }
 * }
 */
export function retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      return withRetry(() => {
        return originalMethod.apply(this, args)
      }, options)
    }

    return descriptor
  }
}
