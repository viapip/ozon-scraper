import { createLogger } from '../../utils/logger'
import { fromMinutes, getRandomDelay } from '../../utils/dates'

const logger = createLogger('SchedulerService')

export interface SchedulerOptions {
  baseIntervalMinutes: number
  executeImmediately?: boolean
  maxDeviationMinutes?: number
  randomizeInterval?: boolean
}

/**
 * Service for scheduling recurring tasks
 */
export class SchedulerService {
  private callback: () => Promise<void>
  private interval: NodeJS.Timeout | null = null
  private isRunning = false
  private options: Required<SchedulerOptions>

  constructor(callback: () => Promise<void>, options: SchedulerOptions) {
    this.callback = callback
    this.options = {
      baseIntervalMinutes: options.baseIntervalMinutes,
      executeImmediately: options.executeImmediately ?? false,
      maxDeviationMinutes: options.maxDeviationMinutes ?? 5,
      randomizeInterval: options.randomizeInterval ?? true,
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running')

      return
    }

    this.isRunning = true
    logger.info('Scheduler started')

    if (this.options.executeImmediately) {
      this.checkNow()
        .catch((error) => {
          logger.error('Error during immediate check:', error)
        })
    }
    else {
      this.scheduleNext()
    }
  }

  /**
   * Execute the callback immediately
   */
  async checkNow(): Promise<void> {
    logger.info('Running immediate check')
    try {
      await this.callback()

      // Schedule the next check if running
      if (this.isRunning) {
        this.scheduleNext()
      }
    }
    catch (error) {
      logger.error('Error during immediate check:', error)
      throw error
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.interval) {
      clearTimeout(this.interval)
      this.interval = null
    }
    this.isRunning = false
    logger.info('Scheduler stopped')
  }

  /**
   * Check if the scheduler is running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Schedule the next execution
   */
  private scheduleNext(): void {
    // Base interval in milliseconds
    const baseInterval = fromMinutes(this.options.baseIntervalMinutes)

    // Calculate next interval with optional randomization
    let nextInterval = baseInterval

    if (this.options.randomizeInterval) {
      const maxDeviation = fromMinutes(this.options.maxDeviationMinutes)
      const deviation = getRandomDelay(-maxDeviation, maxDeviation)
      nextInterval = baseInterval + deviation
    }

    const nextMinutes = Math.round(nextInterval / 1000 / 60)
    logger.info(`Next check scheduled in ${nextMinutes} minutes`)

    this.interval = setTimeout(async () => {
      try {
        await this.callback()
      }
      catch (error) {
        logger.error('Error during scheduled check:', error)
      }
      finally {
        if (this.isRunning) {
          this.scheduleNext()
        }
      }
    }, nextInterval)
  }
}
