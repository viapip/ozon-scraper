import fs from 'node:fs'

import { createConsola } from 'consola'
import { chromium } from 'playwright'

import { delay, getRandomDelay, parseCookieString, saveCookiesToFile } from '../utils/helpers.js'

import type { OzonConfig, Product } from '../types/index.js'
import type { Browser, BrowserContext, Page } from 'playwright'

const logger = createConsola()
  .withTag('OzonService')

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
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-User': '?1',
  'Sec-Fetch-Dest': 'document',
}

export class OzonService {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private config: OzonConfig

  constructor(config: OzonConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      // headless: false,
      args: BROWSER_ARGS,
    })

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      permissions: ['geolocation', 'notifications'],
      extraHTTPHeaders: BROWSER_HEADERS,
    })

    await this.context.addInitScript(() => {
      // Prevent detection of automated browser by overriding key browser properties
      // This helps bypass anti-bot mechanisms
      Object.defineProperty(navigator, 'webdriver', { get: () => null })

      // Emulate browser plugins to appear more like a real browser
      const pluginArray = Array.from({ length: 3 }, () => ({
        description: 'Chromium PDF Plugin',
        filename: 'internal-pdf-viewer',
        name: 'Chrome PDF Plugin',
        length: 1,
      }))
      Object.defineProperty(navigator, 'plugins', { get: () => pluginArray })

      // Set realistic language preferences
      Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] })

      // Override permissions query to handle notifications more naturally
      const originalFunction = window.navigator.permissions.query
      window.navigator.permissions.query = async (parameters: PermissionDescriptor): Promise<PermissionStatus> => {
        // Special handling for notification permissions to appear more human-like
        if (parameters.name === 'notifications') {
          return Promise.resolve({
            state: Notification.permission,
            name: parameters.name,
            onchange: null,
            addEventListener: () => {
              //
            },
            removeEventListener: () => {
              //
            },
            dispatchEvent: () => true,
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

    // Load and validate cookies, ensuring they have correct domain settings
    const parsedCookies = parseCookieString(this.config.cookies)
    const validCookies = parsedCookies.map(cookie => ({
      ...cookie,
      domain: cookie.domain || '.ozon.ru',
      path: cookie.path || '/',
      secure: true,
      sameSite: 'None' as const,
    }))

    await this.context.addCookies(validCookies)
    logger.info(`Loaded ${validCookies.length} cookies from file`)

    this.page = await this.context.newPage()

    await this.preloadActions(this.page)
  }

  // Retrieve the shared favorite list ID from a given URL
  async getFavoriteListId(favoriteListUrl: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }

    await this.page.goto(favoriteListUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const finalUrl = this.page.url()
    const url = new URL(finalUrl)

    const listId = url.searchParams.get('list')

    if (!listId) {
      throw new Error('Failed to get favorite list ID from URL')
    }

    return listId
  }

  // Fetch products from a given favorite list URL
  async getProducts(favoriteListUrl: string): Promise<Product[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    if (!this.page) {
      throw new Error('Page not initialized')
    }

    if (!this.context) {
      throw new Error('Context not initialized')
    }

    try {
      await this.page.goto(favoriteListUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })

      await this.handleAccessRestriction(this.page)

      logger.info('Waiting for main content to load...')
      await this.page.waitForSelector('[data-widget="searchResultsV2"]', {
        timeout: 30000,
        state: 'visible',
      })

      // Simulate human behavior
      await this.simulateHumanBehavior(this.page)

      logger.info('Scrolling page...')
      await this.smoothScrollToBottom(this.page)

      logger.info('Extracting products...')
      const products = await this.extractProducts(this.page)

      // Save all cookies after successful page load
      const cookies = await this.context.cookies()
      const relevantCookies = cookies.filter(cookie =>
        cookie.domain?.includes('ozon.ru')
        || cookie.domain?.includes('.ozon.ru'),
      )

      logger.info(`Saving ${relevantCookies.length} cookies to file`)
      await saveCookiesToFile('.cookies', relevantCookies)
      logger.info('New cookies successfully saved to file')

      return products
    }
    catch (error) {
      logger.error('Error loading page:', error)
      if (this.page) {
        await this.page.screenshot({ path: 'reports/error-screenshot.png', fullPage: true })
        fs.writeFileSync('reports/error-page.html', await this.page.content())
      }
      throw error
    }
  }

  // Preload pages to simulate natural browsing behavior
  private async preloadActions(page: Page): Promise<void> {
    const urls = ['https://www.ozon.ru/']

    for (const url of urls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await delay(getRandomDelay(1000, 2000))
      await this.simulateHumanBehavior(page)

      await this.handleAccessRestriction(page)
    }
  }

  // Handle potential access restrictions or challenges on the page
  private async handleAccessRestriction(page: Page): Promise<void> {
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
      if ((await page.content()).includes('Доступ ограничен')) {
        logger.info('Access restricted, exiting...')
        throw new Error('Access restricted')
      }
    }
    catch (error) {
      logger.warn('No challenge or restriction detected:', error)
    }
  }

  // Simulate human-like interactions on the page
  private async simulateHumanBehavior(page: Page): Promise<void> {
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

  // Extract product details from the page
  private async extractProducts(page: Page): Promise<Product[]> {
    return await page.$$eval('.widget-search-result-container .tile-root', elements => elements.map((item) => {
      // Find all product links and use the last one (most specific)
      const productLinks = Array.from(item.querySelectorAll('a[href*="/product/"]'))
      const mainProductLink = productLinks[productLinks.length - 1] as HTMLAnchorElement

      const nameElement = mainProductLink?.querySelector('span')

      // Construct full URL and extract product ID
      const url = window.location.origin + mainProductLink?.getAttribute('href') || ''
      const id = url.match(/\/product\/([^/?]+)/)?.[1] || ''

      // Find price elements using a regex to match price format
      const allTextElements = Array.from(item.querySelectorAll('*'))
      const priceElements = allTextElements.filter((el) => {
        const text = el.textContent?.trim() || ''

        // Match prices in rubles (e.g., 1 000 ₽ or 500₽)
        return (/^\d[\d\s]*₽$/).test(text)
      })

      // Parse price, handling potential formatting
      const priceText = priceElements[0]?.textContent || '0 ₽'
      const price = Number.parseFloat(priceText.replace(/[^\d.]/g, ''))

      // Determine stock status (not in stock if price is 0 and "Similar" text exists)
      let inStock = true
      if (price === 0 && item.textContent?.includes('Похожие')) {
        inStock = false
      }

      return {
        id,
        name: nameElement?.textContent?.trim() || '',
        url,
        price,
        inStock,
        timestamp: new Date()
          .getTime(),
      }
    }))
  }

  // Smoothly scroll to the bottom of the page
  private async smoothScrollToBottom(page: Page): Promise<void> {
    const footerSelector = '[data-widget="footer"]'
    let isFooterVisible = false

    // Gradually scroll down until footer is visible
    while (!isFooterVisible) {
      // Random scroll step to simulate natural scrolling
      const scrollStep = Math.floor(Math.random() * (500 - 300 + 1)) + 300

      // Smoothly scroll by the random step
      await page.evaluate((step) => {
        window.scrollBy({
          top: step,
          behavior: 'smooth',
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

  // Close and clean up browser resources
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

      logger.info('OzonService closed')
    }
    catch (error) {
      logger.error('Error during cleanup:', error)
    }
  }
}
