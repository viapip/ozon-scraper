import type { Browser, BrowserContext, Page } from 'playwright'

import fs from 'node:fs'
import { chromium } from 'playwright'

import { config } from '../../config/index'
import { delay, getRandomDelay, saveCookiesToFile } from '../../utils/browser-helpers'
import { createLogger } from '../../utils/logger'

const logger = createLogger('OzonBrowser')

const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-site-isolation-trials',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--window-size=1920,1080',
  '--start-maximized',
  '--disable-notifications',
  '--disable-web-security',
]

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="128", "Not(A:Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

export class OzonBrowser {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private cookies: string
  private page: null | Page = null

  constructor(cookies: string) {
    this.cookies = cookies
  }

  /**
   * Initialize the browser and page
   */
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      // headless: false,
      args: BROWSER_ARGS,
    })

    this.context = await this.browser.newContext({
      deviceScaleFactor: 1,
      extraHTTPHeaders: BROWSER_HEADERS,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      locale: 'ru-RU',
      permissions: ['geolocation', 'notifications'],
      timezoneId: 'Europe/Moscow',
      userAgent: config.ozon.userAgent,
      viewport: { height: 1080, width: 1920 },
    })

    await this.applyAntiDetectionScripts(this.context)
    await this.loadCookies(this.context, this.cookies)

    this.page = await this.context.newPage()
    await this.preloadActions(this.page)
  }

  /**
   * Get the current page
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Page not initialized')
    }

    return this.page
  }

  /**
   * Save cookies to file
   */
  async saveCookies(): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized')
    }

    const cookies = await this.context.cookies()
    const relevantCookies = cookies.filter((cookie) => {
      return cookie.domain?.includes('ozon.ru')
        || cookie.domain?.includes('.ozon.ru')
    })

    logger.info(`Saving ${relevantCookies.length} cookies to file`)
    await saveCookiesToFile('.cookies', relevantCookies)
    logger.info('New cookies successfully saved to file')
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }
    await this.page.screenshot({ fullPage: true, path })
  }

  /**
   * Save the current page HTML
   */
  async savePageHtml(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }
    fs.writeFileSync(path, await this.page.content())
  }

  /**
   * Close and clean up browser resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close()
        this.page = null
      }
      if (this.context) {
        await this.context.close()
        this.context = null
      }
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }

      logger.info('OzonBrowser closed')
    }
    catch (error) {
      logger.error('Error during cleanup:', error)
    }
  }

  /**
   * Apply anti-detection scripts to the browser context
   */
  private async applyAntiDetectionScripts(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      // Prevent detection of automated browser by overriding key browser properties
      Object.defineProperty(navigator, 'webdriver', { get: () => {
        return null
      } })

      // Emulate browser plugins to appear more like a real browser
      const pluginArray = Array.from({ length: 3 }, () => {
        return {
          description: 'Chromium PDF Plugin',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Plugin',
        }
      })
      Object.defineProperty(navigator, 'plugins', { get: () => {
        return pluginArray
      } })

      // Set realistic language preferences
      Object.defineProperty(navigator, 'languages', { get: () => {
        return [
          'ru-RU',
          'ru',
          'en-US',
          'en',
        ]
      } })

      // Override permissions query to handle notifications more naturally
      const originalFunction = window.navigator.permissions.query
      window.navigator.permissions.query = async (parameters: PermissionDescriptor): Promise<PermissionStatus> => {
        // Special handling for notification permissions to appear more human-like
        if (parameters.name === 'notifications') {
          return Promise.resolve({
            addEventListener: () => {
              return null
            },
            dispatchEvent: () => {
              return true
            },
            name: parameters.name,
            onchange: null,
            removeEventListener: () => {
              return null
            },
            state: Notification.permission,
          } as PermissionStatus)
        }

        return originalFunction.call(window.navigator.permissions, parameters)
      }

      // Emulate WebGL rendering context to appear more like a real browser
      const { getParameter } = WebGLRenderingContext.prototype
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        // Spoof specific WebGL parameters to look like a real graphics setup
        if (parameter === 37445) {
          return 'Intel Open Source Technology Center'
        }
        if (parameter === 37446) {
          return 'Mesa DRI Intel(R) HD Graphics (SKL GT2)'
        }

        return getParameter.apply(this, [parameter])
      }
    })
  }

  /**
   * Load cookies into the browser context
   */
  private async loadCookies(context: BrowserContext, cookiesString: string): Promise<void> {
    try {
      const cookies = JSON.parse(cookiesString)
      const validCookies = cookies.map((cookie: any) => {
        return {
          ...cookie,
          domain: cookie.domain || '.ozon.ru',
          path: cookie.path || '/',
          sameSite: 'None' as const,
          secure: true,
        }
      })

      await context.addCookies(validCookies)
      logger.info(`Loaded ${validCookies.length} cookies`)
    }
    catch (error) {
      logger.error('Failed to load cookies:', error)
      // Continue with empty cookies
      logger.info('Continuing with empty cookies')
    }
  }

  /**
   * Preload pages to simulate natural browsing behavior
   */
  private async preloadActions(page: Page): Promise<void> {
    const urls = ['https://www.ozon.ru/']

    for (const url of urls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await delay(getRandomDelay(1000, 2000))
      await this.simulateHumanBehavior(page)
      await this.handleAccessRestriction(page)
    }
  }

  /**
   * Handle potential access restrictions or challenges on the page
   */
  async handleAccessRestriction(page: Page): Promise<void> {
    // Wait for challenge
    const challengeSelector = '.container'
    try {
      await page.waitForSelector(challengeSelector, { timeout: 10000 })

      // Click reload button
      const reloadButton = await page.$('#reload-button')
      if (reloadButton) {
        logger.info('Detected reload button, clicking...')
        await this.simulateHumanBehavior(page)
        await delay(getRandomDelay(1000, 2000))
        await reloadButton.click()
      }

      // Check for access restriction
      if ((await page.content()).includes('>ABC? >3@0=8G5=')) {
        logger.info('Access restricted, exiting...')
        throw new Error('Access restricted')
      }
    }
    catch {
      logger.debug('No challenge or restriction detected')
    }
  }

  /**
   * Simulate human-like interactions on the page
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    const actions = [
      async () => {
        // Randomly move mouse cursor across the screen
        const x = Math.random() * 1920
        const y = Math.random() * 1080
        await page.mouse.move(x, y, { steps: 50 })
      },
      async () => {
        // Simulate random scrolling to mimic human interaction
        await page.mouse.wheel(0, Math.random() * 500 - 250)
      },
      async () => {
        // Randomly hover over safe elements like links or buttons
        const safeElements = await page.$$('a, button')
        if (safeElements.length > 0) {
          const randomElement = safeElements[Math.floor(Math.random() * safeElements.length)]
          const box = await randomElement.boundingBox()
          if (box) {
            // Move to the center of the random element
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 })
          }
        }
      },
    ]

    // Perform 5 random human-like actions with random delays
    for (let i = 0; i < 5; i++) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)]
      await randomAction()
      await delay(getRandomDelay(500, 1500))
    }
  }

  /**
   * Smoothly scroll to the bottom of the page
   */
  async smoothScrollToBottom(page: Page): Promise<void> {
    const footerSelector = '[data-widget="footer"]'
    let isFooterVisible = false

    // Gradually scroll down until footer is visible
    while (!isFooterVisible) {
      // Random scroll step to simulate natural scrolling
      const scrollStep = Math.floor(Math.random() * (500 - 300 + 1)) + 300

      // Smoothly scroll by the random step
      await page.evaluate((step) => {
        window.scrollBy({
          behavior: 'smooth',
          top: step,
        })
      }, scrollStep)

      // Check if footer is now visible
      isFooterVisible = await page.evaluate((selector) => {
        const footer = document.querySelector(selector)
        if (!footer) {
          return false
        }

        const rect = footer.getBoundingClientRect()

        return rect.top <= window.innerHeight
      }, footerSelector)

      // Add random delay between scroll steps
      await delay(Math.floor(Math.random() * (1000 - 600 + 1)) + 200)
    }

    await delay(500)
  }
}
