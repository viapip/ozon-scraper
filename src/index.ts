import process from 'node:process'
import { createLogger } from './utils/logger'
import { App } from './app'

const logger = createLogger('Main')

/**
 * Main entry point for the application
 */
async function main() {
  let app: App | null = null

  try {
    logger.info('Starting Ozon price tracker')

    // Create and initialize application
    app = new App()
    await app.init()

    // Start application
    app.start()

    // Set up cleanup handlers
    const cleanup = async () => {
      logger.info('Shutting down application')
      if (app) {
        await app.stop()
      }
      process.exit(0)
    }

    // Handle termination signals
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    logger.info('Application initialization completed')
  }
  catch (error) {
    logger.error('Critical application error:', error)

    // Attempt to clean up if app was initialized
    if (app) {
      try {
        await app.stop()
      }
      catch (cleanupError) {
        logger.error('Error during cleanup:', cleanupError)
      }
    }

    process.exit(1)
  }
}

// Start the application
main()
