import type { Browser, BrowserContext, Page } from 'playwright'

import fs from 'node:fs'
import { chromium } from 'playwright'

// import type { CookieManager } from './cookies'
import { config } from '../../config/index'
import {
  clickElementHumanLike,
  delay,
  getRandomDelay,
  moveMouseHumanLike,
  parseCookieString,
  saveCookiesToFile,
  scrollHumanLike,
} from '../../utils/browser-helpers'
import { createLogger } from '../../utils/logger'
import { withRetry } from '../../utils/retry'

const logger = createLogger('OzonBrowser')

/**
 * Browser profile interface for Ozon tracking
 */
export interface BrowserProfile {
  deviceMemory: number
  hardwareConcurrency: number
  languages: string[]
  oscpu: string
  platform: string
  pluginCount: number
  timezone: string
  userAgent: string
  viewport: {
    width: number
    height: number
  }
  webgl: {
    vendor: string
    renderer: string
  }
}

/**
 * Persistent Linux browser profile
 * This single persistent profile emulates one consistent user
 */
const persistentProfile: BrowserProfile = {
  deviceMemory: 16,
  hardwareConcurrency: 12,
  languages: [
    'ru-RU',
    'ru',
    'en-US',
    'en',
  ],
  oscpu: 'Linux x86_64',
  platform: 'Linux x86_64',
  pluginCount: 3,
  timezone: 'Europe/Moscow',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  viewport: { height: 1080, width: 1920 },
  webgl: {
    renderer: 'Mesa DRI Intel(R) HD Graphics (SKL GT2)',
    vendor: 'Intel Open Source Technology Center',
  },
}

/**
 * The profile ID that we consistently use
 */
const PROFILE_ID = 'persistent_linux_profile'

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
  private profile: BrowserProfile
  private sessionId: string
  constructor(cookies?: string) {
    this.cookies = cookies || ''

    // Select a browser profile to use for this session
    this.profile = persistentProfile

    // Generate a consistent session identifier for this browser instance
    this.sessionId = PROFILE_ID

    logger.info(`Browser session initialized with profile: ${this.profile.platform} - ${this.profile.viewport.width}x${this.profile.viewport.height}`)
  }

  /**
   * Initialize the browser and page
   */
  async init(): Promise<void> {
    try {
      // Use consistent user agent from the profile
      const userAgent = config.ozon.userAgent || this.profile.userAgent

      // Adjust browser launch arguments based on profile
      const customArgs = [...BROWSER_ARGS]

      // Add platform-specific arguments
      if (this.profile.platform === 'Win32') {
        customArgs.push('--font-render-hinting=medium')
      }
      else if (this.profile.platform.includes('Linux')) {
        customArgs.push('--force-device-scale-factor=1')
      }

      // Set window size based on viewport plus some standard chrome UI size
      customArgs.push(`--window-size=${this.profile.viewport.width},${this.profile.viewport.height + 80}`)

      // Launch the browser with customized arguments
      this.browser = await chromium.launch({
        args: customArgs,
        headless: config.ozon.headless,
      })

      // Create a new browser context with profile-specific settings
      this.context = await this.browser.newContext({
        deviceScaleFactor: 1,
        extraHTTPHeaders: BROWSER_HEADERS,
        hasTouch: this.profile.platform === 'iPhone', // Touch only for mobile profiles
        isMobile: this.profile.platform === 'iPhone', // Mobile only for mobile profiles
        javaScriptEnabled: true,
        locale: this.profile.languages[0] || 'ru-RU',
        permissions: ['geolocation', 'notifications'],
        timezoneId: this.profile.timezone,
        userAgent,
        viewport: this.profile.viewport,
      })

      // Store the session ID in localStorage for consistent fingerprinting
      await this.context.addInitScript((sessionId) => {
        try {
          // Use the same session ID for consistent fingerprinting across sessions
          localStorage.setItem('_session_id', sessionId)

          // Using persistent values for a consistent user profile
          if (!localStorage.getItem('_session_created')) {
            // Set a fixed creation date to appear as a returning user
            localStorage.setItem('_session_created', '1698432000000') // Fixed timestamp
            localStorage.setItem('_visits_count', '1')
            localStorage.setItem('_user_settings', JSON.stringify({
              fontSize: 'default', // Fixed preference
              notifications: 'enabled', // Fixed preference
              theme: 'light', // Fixed preference
            }))
          }
          else {
            // Increment visit count for returning "user"
            const visits = Number.parseInt(localStorage.getItem('_visits_count') || '1', 10)
            localStorage.setItem('_visits_count', (visits + 1).toString())
          }
        }
        catch {
          // Ignore errors in case localStorage is not available
        }
      }, this.sessionId)

      logger.info(`Browser context created with user agent: ${userAgent.substring(0, 60)}...`)

      // Apply anti-detection scripts with profile-specific values
      await this.applyAntiDetectionScripts(this.context)

      await this.loadCookies(this.context, this.cookies)

      // Create page and apply preload actions
      this.page = await this.context.newPage()

      // Execute some basic human-like patterns before proceeding
      await this.preloadActions()

      logger.info('Browser initialization completed successfully')
    }
    catch (error) {
      logger.error('Error during browser initialization:', error)
      await this.close()
      throw error
    }
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
   * Save cookies to cookie manager
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
    this.cookies = await saveCookiesToFile('.cookies', relevantCookies)
    logger.info('New cookies successfully saved to file')
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }
    await withRetry(
      async () => {
        return await this.page!.screenshot({ fullPage: true, path })
      },
      { initialDelayMs: 500, maxRetries: 2 },
    )
  }

  /**
   * Execute a task with retry capabilities
   * Allows retrying any Playwright operation with backoff
   */
  async executeWithRetry<T>(
    action: (page: Page) => Promise<T>,
    options: {
      maxRetries?: number
      initialDelayMs?: number
      description?: string
      simulateHuman?: boolean
      handleChallenge?: boolean
    } = {},
  ): Promise<T> {
    const {
      description = 'browser operation',
      handleChallenge = true,
      initialDelayMs = 1000,
      maxRetries = 3,
      simulateHuman = false,
    } = options

    if (!this.page) {
      throw new Error('Page not initialized')
    }

    const { page } = this

    return withRetry(
      async () => {
        // Execute the requested action
        const result = await action(page)

        // Handle any challenges that might have appeared
        if (handleChallenge) {
          await this.handleAccessRestriction(page)
        }

        // Simulate human behavior if requested
        if (simulateHuman) {
          await this.simulateHumanBehavior(page)
        }

        return result
      },
      {
        backoffFactor: 2,
        initialDelayMs,
        jitter: true,
        logging: true,
        maxDelayMs: 15000,
        maxRetries,
        onRetry: async (error, attempt, delayMs) => {
          logger.warn(`${description} failed (attempt ${attempt}). Retrying in ${delayMs}ms...`, { error })

          // Take a screenshot of the failed state if possible
          try {
            const timestamp = new Date()
              .toISOString()
              .replace(/[.:]/g, '-')
            await page.screenshot({
              path: `reports/operation-retry-${timestamp}-attempt-${attempt}.png`,
            })
          }
          catch {
            // Ignore screenshot errors
          }
        },
      },
    )
  }

  /**
   * Save the current page HTML
   */
  async savePageHtml(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }

    await this.executeWithRetry(
      async (page) => {
        const content = await page.content()
        fs.writeFileSync(path, content)
      },
      {
        description: 'save page HTML',
        initialDelayMs: 500,
        maxRetries: 2,
      },
    )
  }

  /**
   * Close and clean up browser resources
   */
  async close(): Promise<void> {
    try {
      // Save cookies to cookie manager before closing
      if (this.context) {
        try {
          await this.saveCookies()
        }
        catch (error) {
          logger.error('Error saving cookies before closing:', error)
        }
      }

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
    // Pass profile values to the init script
    await context.addInitScript((profile) => {
      // ============================================================
      // 1. EXPANDED WEBDRIVER PROPERTY MASKING
      // ============================================================

      // Hide standard automation properties
      const automationProperties = [
        'webdriver',
        'domAutomation',
        'domAutomationController',
        '__webdriverFunc',
        '__selenium_evaluate',
        '__selenium_unwrapped',
        '__fxdriver_evaluate',
        '__driver_evaluate',
        '__driver_unwrapped',
        '__webdriver_evaluate',
        '__webdriver_script_func',
        '__webdriver_script_fn',
        '__webdriver_unwrapped',
        '_selenium',
        'calledSelenium',
        '_Selenium_IDE_Recorder',
      ]

      for (const prop of automationProperties) {
        try {
          Object.defineProperty(navigator, prop, {
            configurable: true,
            enumerable: false,
            get: () => {
              return null
            },
            set: () => {
              return null
            },
          })
          Object.defineProperty(Object.getPrototypeOf(navigator), prop, {
            configurable: true,
            enumerable: false,
            get: () => {
              return null
            },
            set: () => {
              return null
            },
          })
          // Hide property from detection by hasOwnProperty
          delete (navigator as any)[prop]
          delete (Object.getPrototypeOf(navigator) as any)[prop]
        }
        catch {
          // Ignore errors for properties that can't be overridden
        }
      }

      // Modify navigator prototype to intercept property access attempts
      const navigatorHandler = {
        get(target: any, prop: string) {
          if (automationProperties.includes(prop)) {
            return
          }

          return target[prop]
        },
        has(target: any, prop: string) {
          if (automationProperties.includes(prop)) {
            return false
          }

          return prop in target
        },
      }

      try {
        // Create a proxy for the navigator object
        // This line might throw in some browsers, so it's wrapped in try/catch
        window.navigator = new Proxy(navigator, navigatorHandler)
      }
      catch {
        // Fallback to simpler approach if Proxy isn't fully supported
      }

      // ============================================================
      // 2. IMPROVED PLUGINS AND MIMETYPES EMULATION
      // ============================================================

      // Create varied realistic plugins
      const pluginData = [
        {
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 2,
          name: 'Chrome PDF Plugin',
        },
        {
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 2,
          name: 'Chrome PDF Viewer',
        },
        {
          description: 'Native Client',
          filename: 'internal-nacl-plugin',
          length: 2,
          name: 'Native Client',
        },
        {
          description: 'Chromium PDF Viewer',
          filename: 'internal-pdf-viewer',
          length: 5,
          name: 'Chromium PDF Viewer',
        },
      ]

      // Generate a random subset of plugins to appear more natural
      const randomPlugins = pluginData.slice(0, 2 + Math.floor(Math.random() * 3))

      // Define plugin object with proper prototypes
      class PluginClass {
        description: string
        filename: string
        length: number
        name: string

        constructor(data: any) {
          this.description = data.description
          this.filename = data.filename
          this.length = data.length
          this.name = data.name

          // Make this object appear as a proper Plugin
          Object.setPrototypeOf(this, Plugin.prototype)
        }

        item(index: number) {
          return (this as any)[index] || null
        }

        namedItem(name: string) {
          return (this as any)[name] || null
        }
      }

      // Create random selection of plugins
      const plugins = randomPlugins.map((data) => {
        return new PluginClass(data)
      })

      // Make plugins array-like with proper length
      Object.defineProperty(plugins, 'length', {
        configurable: false,
        enumerable: true,
        value: plugins.length,
        writable: false,
      })

      // Add array-like numeric indexing
      for (const [index, plugin] of plugins.entries()) {
        Object.defineProperty(plugins, index, {
          configurable: false,
          enumerable: true,
          value: plugin,
          writable: false,
        })
      }

      // Set prototype and methods to appear as PluginArray
      Object.setPrototypeOf(plugins, PluginArray.prototype)

      // Override navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        configurable: false,
        enumerable: true,
        get: () => {
          return plugins
        },
        set: () => {
          return null
        },
      })

      // Also create matching mimeTypes
      const mimeTypes = [
        { description: 'Portable Document Format', enabledPlugin: plugins[0], suffixes: 'pdf', type: 'application/pdf' },
        { description: 'Portable Document Format', enabledPlugin: plugins[0], suffixes: 'pdf', type: 'application/x-google-chrome-pdf' },
        { description: 'Native Client Executable', enabledPlugin: plugins[2], suffixes: '', type: 'application/x-nacl' },
        { description: 'Portable Native Client Executable', enabledPlugin: plugins[2], suffixes: '', type: 'application/x-pnacl' },
      ]

      // Create mimeTypes object with proper structure
      const mimeTypesArray = Object.create(MimeTypeArray.prototype)

      // Set length property
      Object.defineProperty(mimeTypesArray, 'length', {
        configurable: false,
        enumerable: true,
        value: mimeTypes.length,
        writable: false,
      })

      // Add mimeTypes to array with proper structure
      for (const [index, mime] of mimeTypes.entries()) {
        const mimeObj = Object.create(MimeType.prototype)
        for (const prop in mime) {
          Object.defineProperty(mimeObj, prop, {
            configurable: false,
            enumerable: true,
            value: (mime as any)[prop],
            writable: false,
          })
        }

        // Add to array by index
        Object.defineProperty(mimeTypesArray, index, {
          configurable: false,
          enumerable: true,
          value: mimeObj,
          writable: false,
        })

        // Also add by type name
        Object.defineProperty(mimeTypesArray, mime.type, {
          configurable: false,
          enumerable: false,
          value: mimeObj,
          writable: false,
        })
      }

      // Override navigator.mimeTypes
      Object.defineProperty(navigator, 'mimeTypes', {
        configurable: false,
        enumerable: true,
        get: () => {
          return mimeTypesArray
        },
        set: () => {
          return null
        },
      })

      // ============================================================
      // 3. EMULATE WINDOW.CHROME OBJECT
      // ============================================================

      // Create a realistic chrome object
      const chromeObj = {
        app: {
          getDetails: () => {
            return null
          },
          getIsInstalled: () => {
            return false
          },
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed',
          },
          installState: () => {
            return 'not_installed'
          },
          isInstalled: false,
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running',
          },
          runningState: () => {
            return 'cannot_run'
          },
        },
        csi: () => {
          return {
            onloadT: Date.now() % 100000, // Random-ish value
            pageT: Math.floor(Math.random() * 10000),
            startE: Date.now() % 100000,
            tran: Math.floor(Math.random() * 10),
          }
        },
        // Add random but realistic extension ID to make it look more real
        i18n: Math.random() > 0.5 ? {} : undefined,
        loadTimes: () => {
          return {
            commitLoadTime: Math.random() * 100,
            connectionInfo: [
              'http/1.1',
              'h2',
              'h3',
            ][Math.floor(Math.random() * 3)],
            finishDocumentLoadTime: Math.random() * 1000,
            finishLoadTime: Math.random() * 1500,
            firstPaintAfterLoadTime: Math.random() * 1200,
            firstPaintTime: Math.random() * 800,
            navigationType: [
              'Other',
              'Reload',
              'Forward_Back',
              'Other',
            ][Math.floor(Math.random() * 4)],
            npnNegotiatedProtocol: [
              'http/1.1',
              'h2',
              'h3',
            ][Math.floor(Math.random() * 3)],
            requestTime: Math.random() * 200,
            startLoadTime: Math.random() * 100,
            wasAlternateProtocolAvailable: Math.random() > 0.5,
            wasFetchedViaSpdy: Math.random() > 0.5,
            wasNpnNegotiated: Math.random() > 0.5,
          }
        },
        runtime: {
          connect: () => {
            return {}
          },
          id: undefined,
          OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update',
            INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update',
            UPDATE: 'update',
          },
          OnRestartRequiredReason: {
            APP_UPDATE: 'app_update',
            OS_UPDATE: 'os_update',
            PERIODIC: 'periodic',
          },
          PlatformArch: {
            ARM: 'arm',
            ARM64: 'arm64',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
          },
          PlatformNaclArch: {
            ARM: 'arm',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
          },
          PlatformOs: {
            ANDROID: 'android',
            CROS: 'cros',
            LINUX: 'linux',
            MAC: 'mac',
            OPENBSD: 'openbsd',
            WIN: 'win',
          },
          RequestUpdateCheckStatus: {
            NO_UPDATE: 'no_update',
            THROTTLED: 'throttled',
            UPDATE_AVAILABLE: 'update_available',
          },
          sendMessage: () => {
            return null
          },
        },
      }

      // Define window.chrome with the realistic object
      Object.defineProperty(window, 'chrome', {
        configurable: false,
        enumerable: true,
        value: chromeObj,
        writable: false,
      })

      // ============================================================
      // 4. OVERRIDE CANVAS AND WEBGL FINGERPRINTING
      // ============================================================

      // Override Canvas fingerprinting
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
      HTMLCanvasElement.prototype.toDataURL = function (type: string, quality: number) {
        const result = originalToDataURL.apply(this, [type, quality])

        // Check if this could be a fingerprinting attempt (small canvas, hidden or specific operations)
        const isSuspicious = this.width <= 20 || this.height <= 20
        // Check if canvas might be invisible
          || this.style.display === 'none'
          || this.style.visibility === 'hidden'
          || this.width === 0
          || this.height === 0

        if (isSuspicious) {
          // Add subtle noise to the result to prevent consistent fingerprinting
          // This still returns a valid image but with slight variations
          const dataPrefix = result.slice(0, result.indexOf(',') + 1)
          const dataContent = result.slice(result.indexOf(',') + 1)

          // Decode base64 data
          let decodedData
          try {
            decodedData = atob(dataContent)
          }
          catch {
            // If decoding fails, return original
            return result
          }

          // Apply subtle changes to every 50th byte
          let modifiedData = ''
          for (let i = 0; i < decodedData.length; i++) {
            if (i % 50 === 0 && i > 10) { // Skip first few bytes to keep header intact
              // Slightly modify the byte value (keep it valid)
              const originalByte = decodedData.charCodeAt(i)
              const modifiedByte = (originalByte + (Math.random() > 0.5 ? 1 : -1)) & 0xFF
              modifiedData += String.fromCharCode(modifiedByte)
            }
            else {
              modifiedData += decodedData[i]
            }
          }

          // Encode back to base64
          return dataPrefix + btoa(modifiedData)
        }

        return result
      }

      // Override getImageData to add noise to potential fingerprinting attempts
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData
      CanvasRenderingContext2D.prototype.getImageData = function (sx: number, sy: number, sw: number, sh: number) {
        const imageData = originalGetImageData.apply(this, [
          sx,
          sy,
          sw,
          sh,
        ])

        // Check if this might be a fingerprinting attempt
        const isSuspicious = sw < 20 || sh < 20

        if (isSuspicious) {
          // Add subtle noise to the image data
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Only modify if it's not transparent
            if (imageData.data[i + 3] > 0) {
              // Random small adjustments to RGB values
              for (let j = 0; j < 3; j++) {
                if (Math.random() > 0.92) { // Only change ~8% of pixels
                  const change = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
                  imageData.data[i + j] = Math.max(0, Math.min(255, imageData.data[i + j] + change))
                }
              }
            }
          }
        }

        return imageData
      }

      // More extensive WebGL fingerprinting protection
      // WebGL1 rendering context
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        // Spoof specific WebGL parameters based on the profile
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return profile.webgl.vendor
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return profile.webgl.renderer
        }

        // Add more parameter spoofing based on profile
        // VENDOR - simplify vendor name from the profile
        if (parameter === 7936) {
          return profile.webgl.vendor.split(' ')[0]
        }
        // RENDERER - use a simpler renderer name, consistent with the profile
        if (parameter === 7937) {
          // Extract the basic renderer info
          const rendererParts = profile.webgl.renderer.split(' ')
          // Use just the first couple parts to simplify it

          return rendererParts.slice(0, 2)
            .join(' ')
        }
        // VERSION - match the user agent browser
        if (parameter === 7938) {
          if (navigator.userAgent.includes('Firefox')) {
            return 'WebGL 1.0 (OpenGL ES 3.0 Firefox)'
          }
          else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
            return 'WebGL 1.0 (OpenGL ES 2.0 Safari)'
          }

          return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'
        }
        // SHADING_LANGUAGE_VERSION
        if (parameter === 35724) {
          // Match GLSL version to browser and platform
          if (navigator.userAgent.includes('Firefox')) {
            return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Firefox)'
          }
          else if (profile.platform === 'MacIntel') {
            return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Apple)'
          }

          return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'
        }

        // Return original for other parameters
        return originalGetParameter.apply(this, [parameter])
      }

      // WebGL2 rendering context (if available)
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter
        WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
          // Use the same values as WebGL1 for vendor and renderer
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return profile.webgl.vendor
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return profile.webgl.renderer
          }

          // VENDOR
          if (parameter === 7936) {
            return profile.webgl.vendor.split(' ')[0]
          }
          // RENDERER
          if (parameter === 7937) {
            const rendererParts = profile.webgl.renderer.split(' ')

            return rendererParts.slice(0, 2)
              .join(' ')
          }
          // VERSION - WebGL2 has a different version string
          if (parameter === 7938) {
            if (navigator.userAgent.includes('Firefox')) {
              return 'WebGL 2.0 (OpenGL ES 3.0 Firefox)'
            }
            else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
              return 'WebGL 2.0 (OpenGL ES 3.0 Safari)'
            }

            return 'WebGL 2.0 (OpenGL ES 3.0 Chromium)'
          }
          // SHADING_LANGUAGE_VERSION - WebGL2 has a different GLSL version
          if (parameter === 35724) {
            if (navigator.userAgent.includes('Firefox')) {
              return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Firefox)'
            }
            else if (profile.platform === 'MacIntel') {
              return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Apple)'
            }

            return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)'
          }

          // Return original for other parameters
          return originalGetParameter2.apply(this, [parameter])
        }
      }

      // ============================================================
      // 5. HARDWARE CONCURRENCY AND DEVICE MEMORY
      // ============================================================

      // Use the profile-specific hardware concurrency value
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        enumerable: true,
        get: () => {
          return profile.hardwareConcurrency
        },
        set: () => {
          return null
        },
      })

      // Override navigator.deviceMemory if it exists
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', {
          configurable: true,
          enumerable: true,
          get: () => {
            return profile.deviceMemory
          },
          set: () => {
            return null
          },
        })
      }

      // ============================================================
      // 6. LANGUAGES AND USER AGENT CONSISTENCY
      // ============================================================

      // Use the profile-specific language preferences
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        enumerable: true,
        get: () => {
          return [...profile.languages]
        },
        set: () => {
          return null
        },
      })

      // Set platform to match the profile
      if (profile.platform) {
        try {
          Object.defineProperty(navigator, 'platform', {
            configurable: true,
            enumerable: true,
            get: () => {
              return profile.platform
            },
            set: () => {
              return null
            },
          })
        }
        catch {
          // Some browsers might not allow overriding platform
        }
      }

      // Set oscpu for Firefox compatibility
      if (profile.oscpu && navigator.userAgent.includes('Firefox')) {
        try {
          Object.defineProperty(navigator, 'oscpu', {
            configurable: true,
            enumerable: true,
            get: () => {
              return profile.oscpu
            },
            set: () => {
              return null
            },
          })
        }
        catch {
          // Might not be available in all browsers
        }
      }

      // ============================================================
      // 7. PERMISSIONS AND NOTIFICATIONS
      // ============================================================

      // Override permissions query to handle notifications more naturally
      const originalPermissionsQuery = window.navigator.permissions.query
      window.navigator.permissions.query = async (parameters: PermissionDescriptor): Promise<PermissionStatus> => {
        const { name } = parameters

        // Special handling for common permission checks
        if (name === 'notifications' || name === 'push' || name === 'geolocation') {
          return Promise.resolve({
            addEventListener: () => {
              return null
            },
            dispatchEvent: () => {
              return true
            },
            name,
            onchange: null,
            removeEventListener: () => {
              return null
            },
            state: Notification.permission,
          } as PermissionStatus)
        }

        // Handle other permissions naturally
        return originalPermissionsQuery.call(window.navigator.permissions, parameters)
      }

      // ============================================================
      // 8. WINDOW AND SCREEN PROPERTIES
      // ============================================================

      // History length randomization (within reasonable bounds)
      Object.defineProperty(window.history, 'length', {
        get: () => {
          return Math.floor(Math.random() * 20) + 1
        },
      })

      // ============================================================
      // 9. EVENT HANDLING FOR FOCUS/BLUR
      // ============================================================

      // Create a more realistic window focus behavior
      let windowFocus = true
      const focusListeners: EventListenerOrEventListenerObject[] = []
      const blurListeners: EventListenerOrEventListenerObject[] = []

      // Override addEventListener for focus events
      const originalAddEventListener = window.addEventListener
      window.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) {
        if (type === 'focus') {
          focusListeners.push(listener)
          if (windowFocus) {
            setTimeout(() => {
              const event = new Event('focus')
              if (typeof listener === 'function') {
                listener(event)
              }
              else {
                listener.handleEvent(event)
              }
            }, 50)
          }
        }
        else if (type === 'blur') {
          blurListeners.push(listener)
          if (!windowFocus) {
            setTimeout(() => {
              const event = new Event('blur')
              if (typeof listener === 'function') {
                listener(event)
              }
              else {
                listener.handleEvent(event)
              }
            }, 50)
          }
        }
        else {
          return originalAddEventListener.apply(this, [
            type,
            listener,
            options,
          ])
        }
      }

      // Simulate occasional focus/blur events at random intervals
      // This creates a more realistic browsing session
      const simulateFocusEvents = () => {
        const interval = 20000 + Math.random() * 40000 // 20-60 seconds
        setTimeout(() => {
          // 20% chance to change focus state
          if (Math.random() < 0.2) {
            windowFocus = !windowFocus
            const event = new Event(windowFocus ? 'focus' : 'blur')
            const listeners = windowFocus ? focusListeners : blurListeners

            for (const listener of listeners) {
              try {
                if (typeof listener === 'function') {
                  listener(event)
                }
                else {
                  listener.handleEvent(event)
                }
              }
              catch {
                // Ignore errors in event handlers
              }
            }

            if (windowFocus) {
              document.dispatchEvent(new Event('visibilitychange'))
              Object.defineProperty(document, 'hidden', { value: false })
            }
            else {
              document.dispatchEvent(new Event('visibilitychange'))
              Object.defineProperty(document, 'hidden', { value: true })
            }
          }

          simulateFocusEvents()
        }, interval)
      }

      // Start the focus event simulation
      simulateFocusEvents()
    }, this.profile)
  }

  /**
   * Load cookies into the browser context
   */
  private async loadCookies(context: BrowserContext, cookiesString: string): Promise<void> {
    try {
      const cookies = parseCookieString(cookiesString)
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
   * Navigate to a URL with retry capabilities
   * Uses exponential backoff and jitter for retries
   */
  async navigateWithRetry(url: string, options: {
    waitUntil?: 'commit' | 'domcontentloaded' | 'load' | 'networkidle'
    maxRetries?: number
    simulateHuman?: boolean
    handleChallenge?: boolean
  } = {}): Promise<void> {
    const {
      handleChallenge = true,
      maxRetries = 3,
      simulateHuman = true,
      waitUntil = 'domcontentloaded',
    } = options

    if (!this.page) {
      throw new Error('Page not initialized')
    }

    const { page } = this

    await withRetry(
      async () => {
        // Perform the navigation
        await page.goto(url, { waitUntil })

        // Add a small delay
        await delay(getRandomDelay(1000, 2000))

        // Check for challenges/restrictions and handle them
        if (handleChallenge) {
          // This will throw if an unhandleable challenge is detected
          await this.handleAccessRestriction(page)
        }

        // Simulate human behavior if requested
        if (simulateHuman) {
          await this.simulateHumanBehavior(page)
        }
      },
      {
        backoffFactor: 2,
        initialDelayMs: 2000,
        jitter: true,
        logging: true,
        maxDelayMs: 20000,
        maxRetries,
        onRetry: async (error, attempt, delayMs) => {
          logger.warn(`Navigation to ${url} failed (attempt ${attempt}). Retrying in ${delayMs}ms...`)

          try {
            // Take a screenshot of the failed state if possible
            if (page) {
              const timestamp = new Date()
                .toISOString()
                .replace(/[.:]/g, '-')
              await page.screenshot({
                fullPage: true,
                path: `reports/retry-${timestamp}-attempt-${attempt}.png`,
              })
            }
          }
          catch {
            // Ignore screenshot errors
            logger.error('Failed to save screenshot:', error)
          }

          // Try to clear cookies and local storage before retry
          if (attempt > 1) {
            try {
              await page.evaluate(() => {
                localStorage.clear()
                sessionStorage.clear()
              })

              await this.context?.clearCookies()

              // Reload the current cookies
              // Load cookies from saved cookie string
              const { context, cookies } = this
              await this.loadCookies(context!, cookies)
            }
            catch {
              // Ignore cleanup errors
            }
          }
        },
      },
    )
  }

  /**
   * Preload pages to simulate natural browsing behavior
   */
  private async preloadActions(): Promise<void> {
    const urls = ['https://www.ozon.ru/']

    for (const url of urls) {
      await this.navigateWithRetry(url, {
        handleChallenge: true,
        maxRetries: 2,
        simulateHuman: true,
        waitUntil: 'domcontentloaded',
      })
    }
  }

  /**
   * Handle potential access restrictions or challenges on the page
   */
  async handleAccessRestriction(page: Page): Promise<void> {
    // Common challenge indicators
    const challengeSelectors = [
      '#reload-button', // Reload button on challenge page
      'h1:contains("Доступ ограничен")', // Access restricted message
      '[data-widget="webFab"]', // Ozon challenge widget
      '#fab_challenge', // Fab challenge container
    ]

    try {
      // Check if any challenge elements are present
      let challengeDetected = false

      for (const selector of challengeSelectors) {
        try {
          // Use a short timeout to quickly check for each element
          await page.waitForSelector(selector, { timeout: 1000 })
          challengeDetected = true
          logger.info(`Challenge detected - found selector: ${selector}`)
          break
        }
        catch {
          // Element not found, continue checking
        }
      }

      if (!challengeDetected) {
        // Check content for known challenge text patterns
        const pageContent = await page.content()
        const restrictionIndicators = [
          'Доступ ограничен',
          'Access denied',
          'Access restricted',
        ]

        for (const indicator of restrictionIndicators) {
          if (pageContent.includes(indicator)) {
            logger.info(`Challenge detected - found text: "${indicator}"`)
            challengeDetected = true
            break
          }
        }
      }

      if (challengeDetected) {
        // Try to take a screenshot and save HTML for analysis
        try {
          const timestamp = 'screenshot'
          await page.screenshot({ path: `reports/challenge-${timestamp}.png` })
          fs.writeFileSync(`reports/challenge-${timestamp}.html`, await page.content())
          logger.info(`Saved challenge screenshot and HTML with timestamp ${timestamp}`)
        }
        catch (error) {
          logger.error('Failed to save challenge evidence:', error)
        }

        // First simulate natural human behavior to appear less bot-like
        await this.simulateHumanBehavior(page)
        await delay(getRandomDelay(1000, 2000))

        // Look for the reload button and try to click it with human-like motion
        try {
          const reloadButtonExists = await clickElementHumanLike(page, '#reload-button', {
            complexity: 0.6,
            speedFactor: 0.8,
          })

          if (reloadButtonExists) {
            logger.info('Clicked reload button using human-like mouse movement')
            // Wait for page to reload or change
            await delay(getRandomDelay(2000, 3000))

            // Check if challenge is still present
            const stillRestricted = await page.evaluate(() => {
              return document.body.textContent?.includes('Доступ ограничен') || false
            })

            if (stillRestricted) {
              logger.warn('Access still restricted after clicking reload button')

              // Try again with more human behavior before giving up
              await this.simulateHumanBehavior(page)
              await delay(getRandomDelay(1500, 2500))

              const secondAttempt = await clickElementHumanLike(page, '#reload-button', {
                complexity: 0.7,
                speedFactor: 0.7,
              })

              if (secondAttempt) {
                logger.info('Second attempt to click reload button')
                await delay(getRandomDelay(2000, 3000))
              }

              // Final check
              const stillRestrictedAfterRetry = await page.evaluate(() => {
                return document.body.textContent?.includes('Доступ ограничен') || false
              })

              if (stillRestrictedAfterRetry) {
                logger.error('Access still restricted after multiple attempts, exiting...')
                throw new Error('Access restricted')
              }
            }
          }
          else {
            // If no reload button but challenge detected, try some other strategies

            // Check for captcha
            const captchaExists = await page.evaluate(() => {
              return (
                document.querySelector('iframe[src*="captcha"]') !== null
                || document.querySelector('iframe[src*="recaptcha"]') !== null
                || document.querySelector('.g-recaptcha') !== null
                || document.querySelector('div[class*="captcha"]') !== null
              )
            })

            if (captchaExists) {
              logger.warn('Captcha detected, cannot proceed automatically')
              // Mark this session as unsuccessful
              // if (this.context) {
              //   await this.cookieManager.updateSessionFromContext(this.context, false)
              // }
              throw new Error('Captcha detected')
            }

            // As a last resort, try to continue by simulating various human actions
            logger.info('No reload button found, trying to continue with human simulation')
            await this.simulateHumanBehavior(page)
            await delay(getRandomDelay(3000, 5000))

            // If we still detect restriction text, throw error
            if ((await page.content()).includes('Доступ ограничен')) {
              logger.error('Access still restricted after human simulation, exiting...')
              // Mark this session as unsuccessful
              // if (this.context) {
              //   await this.cookieManager.updateSessionFromContext(this.context, false)
              // }
              throw new Error('Access restricted')
            }
          }
        }
        catch (error: any) {
          if (error.message.includes('Captcha') || error.message.includes('Access restricted')) {
            throw error
          }

          logger.warn(`Error handling challenge: ${error.message}`)

          // If the error is not related to captcha or access restriction, we'll check
          // one last time if there's an access restriction
          if ((await page.content()).includes('Доступ ограничен')) {
            logger.error('Access restricted, failed to handle challenge')
            // Mark this session as unsuccessful
            // if (this.context) {
            //   await this.cookieManager.updateSessionFromContext(this.context, false)
            // }
            throw new Error('Access restricted')
          }
        }
      }
    }
    catch (error: any) {
      // If the error is from our explicit throws above, propagate it
      if (error.message.includes('Captcha') || error.message.includes('Access restricted')) {
        throw error
      }

      // Otherwise, it's probably just a timeout waiting for challenge selectors
      logger.debug('No challenge or restriction detected')
    }
  }

  /**
   * Simulate human-like interactions on the page
   */
  async simulateHumanBehavior(page: Page): Promise<void> {
    // Get current viewport size
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      return
    }

    const { height, width } = viewportSize

    // Define possible human-like actions with weighted probabilities
    const actions = [
      {
        action: async () => {
          // Focus on interactive elements that humans would likely interact with
          const interactiveSelectors = [
            'a',
            'button',
            'input',
            '.item-line',
            '.widget',
            'img',
            '.menu-item',
            '[role="button"]',
            '[role="tab"]',
            '.card',
            '.product-card',
            '.title',
            'h2',
            'h3',
          ]

          // Randomly select one of the selector types
          const randomSelector = interactiveSelectors[Math.floor(Math.random() * interactiveSelectors.length)]

          try {
            // Find all matching elements
            const elements = await page.$$(randomSelector)

            if (elements.length > 0) {
              // Select a random element from those available
              const randomElement = elements[Math.floor(Math.random() * elements.length)]
              const box = await randomElement.boundingBox()

              if (box && box.width > 0 && box.height > 0) {
                // Current position (for natural movement)
                const currentPosition = await page.evaluate(() => {
                  return {
                    x: (window as any)._mouseX || 0,
                    y: (window as any)._mouseY || 0,
                  }
                })

                // Target position (slightly randomized within the element)
                const targetX = box.x + box.width * (0.3 + Math.random() * 0.4)
                const targetY = box.y + box.height * (0.3 + Math.random() * 0.4)

                // Use advanced human-like motion
                await moveMouseHumanLike(
                  page,
                  currentPosition.x,
                  currentPosition.y,
                  targetX,
                  targetY,
                  {
                    complexity: 0.3 + Math.random() * 0.5,
                    speedFactor: 0.8 + Math.random() * 0.4,
                  },
                )

                // Update stored mouse position
                await page.evaluate(({ x, y }) => {
                  (window as any)._mouseX = x
                  ;(window as any)._mouseY = y
                }, { x: targetX, y: targetY })

                // Occasionally "think about" clicking but don't (humans look at things without clicking)
                if (Math.random() < 0.3) {
                  // Small pause as if considering the element
                  await delay(getRandomDelay(300, 800))
                }
              }
            }
          }
          catch {
            // Ignore errors - just move on to next action
            logger.debug('Error while moving to random element, continuing with other actions')
          }
        },
        // Move mouse to random elements on the page (most common action)
        probability: 0.35,
      },
      {
        action: async () => {
          // Determine scroll direction (down more common than up)
          const scrollDirection = Math.random() < 0.7 ? 'down' : 'up'

          // Randomize scroll distance (smaller for up, larger for down)
          const baseDistance = scrollDirection === 'down'
            ? getRandomDelay(300, 800)
            : getRandomDelay(100, 400)

          // Use advanced human-like scrolling
          await scrollHumanLike(
            page,
            scrollDirection,
            baseDistance,
            {
              speedFactor: 0.7 + Math.random() * 0.6,
              stepSize: 80 + Math.floor(Math.random() * 80), // Variable step sizes
            },
          )

          // Occasionally scroll a second time in the same direction
          if (Math.random() < 0.4) {
            await delay(getRandomDelay(200, 500))
            const secondDistance = baseDistance * (0.3 + Math.random() * 0.5)
            await scrollHumanLike(
              page,
              scrollDirection,
              secondDistance,
              { speedFactor: 0.9 + Math.random() * 0.3 },
            )
          }
        },
        // Scrolling (second most common action)
        probability: 0.30,
      },
      {
        action: async () => {
          // Current position
          const currentPosition = await page.evaluate(({ height: viewportHeight, width: viewportWidth }) => {
            return {
              x: (window as any)._mouseX || viewportWidth / 2,
              y: (window as any)._mouseY || viewportHeight / 2,
            }
          }, { height, width })

          // Target position - somewhere random on the screen but biased toward content areas
          // (avoid moving to extreme edges too often)
          const targetX = width * 0.1 + (width * 0.8 * Math.random())
          const targetY = height * 0.1 + (height * 0.8 * Math.random())

          // Use natural mouse movement
          await moveMouseHumanLike(
            page,
            currentPosition.x,
            currentPosition.y,
            targetX,
            targetY,
            {
              complexity: 0.3 + Math.random() * 0.3, // Less complex for idle movements
              speedFactor: 0.7 + Math.random() * 0.6, // Slightly slower for idle movements
            },
          )

          // Update stored mouse position
          await page.evaluate(({ x, y }) => {
            (window as any)._mouseX = x
            ;(window as any)._mouseY = y
          }, { x: targetX, y: targetY })
        },
        // Random mouse movements (third most common)
        probability: 0.20,
      },
      {
        action: async () => {
          // Humans sometimes pause to read or think - just do nothing for a while
          const pauseTime = getRandomDelay(800, 2500)
          await delay(pauseTime)

          // Minor mouse jitters during idle periods (unconscious tiny movements)
          if (Math.random() < 0.6) {
            const currentPosition = await page.evaluate(({ height: viewportHeight, width: viewportWidth }) => {
              return {
                x: (window as any)._mouseX || viewportWidth / 2,
                y: (window as any)._mouseY || viewportHeight / 2,
              }
            }, { height, width })

            // Very small movement (jitter)
            const jitterX = currentPosition.x + (Math.random() * 10 - 5)
            const jitterY = currentPosition.y + (Math.random() * 10 - 5)

            await page.mouse.move(jitterX, jitterY)

            // Update stored mouse position
            await page.evaluate(({ x, y }) => {
              (window as any)._mouseX = x
              ;(window as any)._mouseY = y
            }, { x: jitterX, y: jitterY })
          }
        },
        // Pause/idle (least common but realistic)
        probability: 0.15,
      },
    ]

    // Normalize probabilities to ensure they sum to 1
    const totalProbability = actions.reduce((sum, action) => {
      return sum + action.probability
    }, 0)
    for (const action of actions) {
      action.probability /= totalProbability
    }

    // Calculate cumulative probabilities for weighted random selection
    const cumulativeProbabilities = []
    let cumulativeProbability = 0

    for (const action of actions) {
      cumulativeProbability += action.probability
      cumulativeProbabilities.push(cumulativeProbability)
    }

    // Perform a natural sequence of 5-8 human-like actions
    const actionCount = 5 + Math.floor(Math.random() * 4)

    for (let i = 0; i < actionCount; i++) {
      // Select a random action based on probabilities
      const rand = Math.random()
      let actionIndex = 0

      while (actionIndex < cumulativeProbabilities.length - 1
        && rand > cumulativeProbabilities[actionIndex]) {
        actionIndex++
      }

      // Execute the selected action
      await actions[actionIndex].action()

      // Natural delay between actions
      if (i < actionCount - 1) {
        await delay(getRandomDelay(600, 1800))
      }
    }

    // Initialize mouse position for future references if not set
    const hasMousePosition = await page.evaluate(() => {
      return typeof (window as any)._mouseX !== 'undefined'
    })

    if (!hasMousePosition) {
      await page.evaluate(({ h, w }) => {
        (window as any)._mouseX = w / 2
        ;(window as any)._mouseY = h / 2
      }, { h: height, w: width })
    }
  }

  /**
   * Smoothly scroll to the bottom of the page
   */
  async smoothScrollToBottom(page: Page): Promise<void> {
    const footerSelector = '[data-widget="footer"]'
    let isFooterVisible = false

    // Get viewport height for scroll calculations
    const viewportHeight = (await page.viewportSize())?.height || 1080

    // Find document height to calculate total scroll distance
    const documentHeight = await page.evaluate(() => {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight,
      )
    })

    // Gradually scroll down until footer is visible
    while (!isFooterVisible) {
      // Human-like scrolling with distance proportional to page size
      // but with reasonable pauses between major scrolls
      const scrollStep = getRandomDelay(
        // Shorter steps for content scanning
        Math.min(300, viewportHeight * 0.4),
        // Longer steps for quick browsing
        Math.min(800, viewportHeight * 0.7),
      )

      // Use our human-like scrolling function
      await scrollHumanLike(page, 'down', scrollStep, {
        // More variability in scrolling speed
        speedFactor: 0.8 + Math.random() * 0.5,
        // Step size is higher for smooth scrolling
        stepSize: 100 + Math.floor(Math.random() * 60),
      })

      // Check if footer is now visible
      isFooterVisible = await page.evaluate((selector) => {
        const footer = document.querySelector(selector)
        if (!footer) {
          return false
        }

        const rect = footer.getBoundingClientRect()

        return rect.top <= window.innerHeight
      }, footerSelector)

      // Occasionally pause to look at content (more human-like)
      if (Math.random() < 0.4 && !isFooterVisible) {
        await delay(getRandomDelay(800, 2000))

        // Humans often do small adjustment scrolls while reading
        if (Math.random() < 0.5) {
          const smallAdjustment = getRandomDelay(30, 80)
          // Sometimes scroll back up a bit
          if (Math.random() < 0.3) {
            await scrollHumanLike(page, 'up', smallAdjustment, { stepSize: 30 })
          }
          else {
            await scrollHumanLike(page, 'down', smallAdjustment, { stepSize: 30 })
          }
        }

        // Simulate mouse movement while reading
        if (Math.random() < 0.6) {
          const viewportSize = page.viewportSize()
          if (viewportSize) {
            const { height, width } = viewportSize

            // Get current mouse position
            const currentPosition = await page.evaluate(() => {
              return {
                x: (window as any)._mouseX || width / 2,
                y: (window as any)._mouseY || height / 2,
              }
            })

            // Move to some random content area (middle of the screen horizontally,
            // but in the current viewport vertically)
            const targetX = width * (0.2 + Math.random() * 0.6)
            const targetY = height * (0.3 + Math.random() * 0.4)

            await moveMouseHumanLike(
              page,
              currentPosition.x,
              currentPosition.y,
              targetX,
              targetY,
              { complexity: 0.3, speedFactor: 0.6 },
            )

            // Update stored mouse position
            await page.evaluate(({ x, y }) => {
              (window as any)._mouseX = x
              ;(window as any)._mouseY = y
            }, { x: targetX, y: targetY })
          }
        }
      }

      // Safety check - if we're already at the bottom of the page but no footer detected
      const currentScroll = await page.evaluate(() => {
        return Math.round(window.scrollY + window.innerHeight)
      })

      // If we're within 100px of the document height, consider the scrolling complete
      if (documentHeight - currentScroll < 100) {
        logger.debug('Reached bottom of page but footer not detected, stopping scroll')
        break
      }
    }

    // Final pause after reaching the bottom
    await delay(getRandomDelay(500, 1200))
  }
}
