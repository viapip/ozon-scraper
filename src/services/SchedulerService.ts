import { createConsola } from 'consola'

import { getRandomDelay } from '../utils/helpers.js'

const logger = createConsola()
  .withTag('SchedulerService')

export class SchedulerService {
  private interval: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(private callback: () => Promise<void>) {}

  start(): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.scheduleNext()
  }

  async checkNow(): Promise<void> {
    logger.info('Running immediate check')
    try {
      await this.callback()
    }
    catch (error) {
      logger.error('Error during immediate check:', error)
      throw error
    }
  }

  private scheduleNext(): void {
    // Base interval - 1 hour
    const baseInterval = 3600000

    // Random deviation ±15 minutes
    const deviation = getRandomDelay(-900000, 900000)
    const nextInterval = baseInterval + deviation

    logger.info(`Next check scheduled in ${Math.round(nextInterval / 1000 / 60)} minutes`)

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

  stop(): void {
    if (this.interval) {
      clearTimeout(this.interval)
      this.interval = null
    }
    this.isRunning = false
  }
}
