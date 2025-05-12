import type { Page } from 'playwright'

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

interface CookieParams {
  domain?: string
  expires?: number
  httpOnly?: boolean
  name: string
  path?: string
  sameSite?: 'Lax' | 'None' | 'Strict'
  secure?: boolean
  value: string
}

interface Point {
  x: number
  y: number
}

/**
 * Delay execution for a specified time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms)
  })
}

/**
 * Get a random delay value between min and max
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Creates a natural cubic bezier curve path between two points
 * @param start - Starting position {x, y}
 * @param end - Ending position {x, y}
 * @param controlPointsCount - Number of control points to use (default 2)
 * @param randomness - How much randomness to add (0-1, default 0.5)
 * @returns Array of points along the path
 */
export function createBezierPath(
  start: Point,
  end: Point,
  controlPointsCount = 2,
  randomness = 0.5,
): Point[] {
  // Generate random control points between start and end
  const controlPoints: Point[] = []

  // Helper function to get a point with variance
  const getPointWithVariance = (t: number, varianceFactor: number) => {
    // Linear interpolation between start and end
    const linearX = start.x + (end.x - start.x) * t
    const linearY = start.y + (end.y - start.y) * t

    // Add some randomness to the control points
    // The randomness is proportional to the distance between start and end
    const distance = Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2,
    )
    const maxVariance = distance * varianceFactor

    // We use different factors for x and y to avoid perfectly straight lines
    const xVariance = (Math.random() * 2 - 1) * maxVariance
    const yVariance = (Math.random() * 2 - 1) * maxVariance

    return {
      x: linearX + xVariance,
      y: linearY + yVariance,
    }
  }

  // Create control points
  for (let i = 0; i < controlPointsCount; i++) {
    // Use a non-linear distribution to create more natural curves
    // Early points closer to start, later points closer to end
    let t
    if (controlPointsCount === 1) {
      t = 0.5 // Middle point if only one control point
    }
    else {
      // This creates a more natural curve that's faster at the beginning and end
      // and slower in the middle (like human mouse movement)
      t = (i + 1) / (controlPointsCount + 1)

      // Apply an ease-in-out curve to t
      t = t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t
    }

    controlPoints.push(getPointWithVariance(t, randomness))
  }

  // Number of points to generate along the path
  // More points = smoother curve but more data
  const numPoints = Math.max(10, Math.floor(
    Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2,
    ) / 10,
  ))

  const points: Point[] = []

  // Function to calculate a point on a cubic bezier curve
  const calculateBezierPoint = (t: number): Point => {
    // For cases with any number of control points
    const allPoints = [
      start,
      ...controlPoints,
      end,
    ]

    // Apply De Casteljau's algorithm to compute point on Bezier curve
    let currentPoints = [...allPoints]

    for (let i = 1; i < allPoints.length; i++) {
      const newPoints = []
      for (let j = 0; j < currentPoints.length - 1; j++) {
        const p0 = currentPoints[j]
        const p1 = currentPoints[j + 1]

        newPoints.push({
          x: (1 - t) * p0.x + t * p1.x,
          y: (1 - t) * p0.y + t * p1.y,
        })
      }
      currentPoints = newPoints
      if (newPoints.length === 1) {
        break
      }
    }

    return currentPoints[0]
  }

  // Generate points along the curve
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints

    // Apply subtle easing function for natural acceleration/deceleration
    let easedT
    if (t < 0.2) {
      // Slow start (ease in)
      easedT = t * t * 5
    }
    else if (t > 0.8) {
      // Slow end (ease out)
      const reversedT = 1 - t
      easedT = 1 - reversedT * reversedT * 5
    }
    else {
      // Middle section - mostly linear with slight ease
      easedT = t
    }

    points.push(calculateBezierPoint(easedT))
  }

  return points
}

/**
 * Creates a multi-segment path for more complex mouse movements
 * Simulates the way humans sometimes move in segments rather than single curves
 */
export function createMultiSegmentPath(
  start: Point,
  end: Point,
  complexity = 0.5, // 0-1, how complex should the path be
): Point[] {
  // Determine if we should use multiple segments based on:
  // 1. Distance between points (longer distances more likely to have multiple segments)
  // 2. Random factor influenced by complexity
  const distance = Math.sqrt(
    (end.x - start.x) ** 2 + (end.y - start.y) ** 2,
  )

  // For very short movements, just use a single bezier
  if (distance < 100 || Math.random() > complexity) {
    return createBezierPath(start, end, 2, 0.3 + Math.random() * 0.4)
  }

  // Decide how many segments to use (more for complex movements)
  const segmentCount = 1 + Math.floor(Math.random() * 3 * complexity)

  // Create intermediate waypoints
  const waypoints: Point[] = [start]

  for (let i = 1; i <= segmentCount; i++) {
    if (i === segmentCount) {
      waypoints.push(end)
    }
    else {
      // Create a waypoint that's in the general direction toward the target
      // but with some randomness
      const t = i / segmentCount

      // Base position through linear interpolation
      const baseX = start.x + (end.x - start.x) * t
      const baseY = start.y + (end.y - start.y) * t

      // Add randomness, more for higher complexity
      const randomFactor = distance * 0.2 * complexity
      const randomX = (Math.random() * 2 - 1) * randomFactor
      const randomY = (Math.random() * 2 - 1) * randomFactor

      waypoints.push({
        x: baseX + randomX,
        y: baseY + randomY,
      })
    }
  }

  // Create bezier paths between each pair of waypoints and join them
  let fullPath: Point[] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = createBezierPath(
      waypoints[i],
      waypoints[i + 1],
      1 + Math.floor(Math.random() * 2),
      0.2 + Math.random() * 0.3,
    )

    // Avoid duplicate points where segments join
    if (i > 0 && fullPath.length > 0) {
      segment.shift()
    }

    fullPath = fullPath.concat(segment)
  }

  return fullPath
}

/**
 * Simulates human-like mouse movement between two points on a page
 */
export async function moveMouseHumanLike(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options: {
    complexity?: number // 0-1, how complex/random the movement should be
    speedFactor?: number // Speed multiplier: >1 faster, <1 slower
  } = {},
): Promise<void> {
  const {
    complexity = 0.5,
    speedFactor = 1,
  } = options

  // Create a path for the mouse to follow
  const path = createMultiSegmentPath(
    { x: startX, y: startY },
    { x: endX, y: endY },
    complexity,
  )

  // Move the mouse through each point
  for (let i = 0; i < path.length; i++) {
    const point = path[i]

    // Calculate delay - movement should be quick in the middle, slower at start/end
    // This creates a natural acceleration/deceleration effect
    let delayMs

    if (i === 0 || i === path.length - 1) {
      // Longer delay at start and end
      delayMs = getRandomDelay(20, 40)
    }
    else {
      const normalizedPosition = i / path.length

      // Quadratic function to make movement faster in middle, slower at ends
      // - At start (t=0): slow
      // - At middle (t=0.5): fast
      // - At end (t=1): slow
      const speedModifier = 4 * normalizedPosition * (1 - normalizedPosition)

      // Base speed (increases with mouse travel distance)
      const baseDelay = 8 + Math.floor(Math.random() * 5)

      // Apply speed modifiers
      delayMs = baseDelay * (2 - speedModifier) / speedFactor
    }

    // Move mouse to the current point
    await page.mouse.move(point.x, point.y)

    // Wait for the calculated delay
    if (i < path.length - 1) {
      await delay(delayMs)
    }
  }
}

/**
 * Performs a human-like mouse hover over an element
 */
export async function hoverElementHumanLike(
  page: Page,
  selector: string,
  options: {
    complexity?: number
    speedFactor?: number
  } = {},
): Promise<boolean> {
  try {
    // First make sure the element is visible
    await page.waitForSelector(selector, { state: 'visible', timeout: 2000 })

    // Get current mouse position
    const mousePosition = await page.evaluate(() => {
      return {
        x: (window as any)._mouseX || 0,
        y: (window as any)._mouseY || 0,
      }
    })

    // Get element's position and dimensions
    const boundingBox = await page.locator(selector)
      .boundingBox()
    if (!boundingBox) {
      return false
    }

    // Calculate a random point within the element
    const targetX = boundingBox.x + boundingBox.width * (0.3 + Math.random() * 0.4)
    const targetY = boundingBox.y + boundingBox.height * (0.3 + Math.random() * 0.4)

    // Move to the element
    await moveMouseHumanLike(
      page,
      mousePosition.x,
      mousePosition.y,
      targetX,
      targetY,
      options,
    )

    // Update mouse position in the document for future references
    await page.evaluate(({ x, y }) => {
      (window as any)._mouseX = x
      ;(window as any)._mouseY = y
    }, { x: targetX, y: targetY })

    // Small random delay after hovering
    await delay(getRandomDelay(100, 300))

    return true
  }
  catch {
    return false
  }
}

/**
 * Performs a human-like click on an element with natural mouse movement
 */
export async function clickElementHumanLike(
  page: Page,
  selector: string,
  options: {
    complexity?: number
    speedFactor?: number
    doubleClick?: boolean
  } = {},
): Promise<boolean> {
  const {
    doubleClick = false,
  } = options

  try {
    // First hover over the element
    const hoverSuccess = await hoverElementHumanLike(page, selector, options)
    if (!hoverSuccess) {
      return false
    }

    // Random pre-click delay (humans often pause briefly before clicking)
    await delay(getRandomDelay(50, 150))

    // Click with varying delay between mousedown and mouseup
    await page.mouse.down()

    // Add a small delay between mousedown and mouseup (humans aren't instantaneous)
    await delay(getRandomDelay(20, 80))

    await page.mouse.up()

    // For double click
    if (doubleClick) {
      await delay(getRandomDelay(60, 120))
      await page.mouse.down()
      await delay(getRandomDelay(20, 50))
      await page.mouse.up()
    }

    // Random post-click delay
    await delay(getRandomDelay(150, 300))

    return true
  }
  catch {
    return false
  }
}
// Calculate the easing function (quadratic ease-in-out)
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}
/**
 * Performs a human-like scroll with natural acceleration and deceleration
 */
export async function scrollHumanLike(
  page: Page,
  direction: 'down' | 'up',
  distance: number,
  options: {
    stepSize?: number // Pixels per step
    speedFactor?: number // >1 faster, <1 slower
  } = {},
): Promise<void> {
  const {
    speedFactor = 1,
    stepSize = 120,
  } = options

  // Adjust distance for direction
  const actualDistance = direction === 'up' ? -distance : distance

  // Number of scroll steps (more steps = smoother scroll)
  const steps = Math.max(5, Math.floor(Math.abs(actualDistance) / stepSize))

  // Perform the scrolling animation
  for (let i = 1; i <= steps; i++) {
    // Calculate the progress (0 to 1)
    const progress = i / steps

    // Apply easing to make movement more natural
    const easedProgress = easeInOut(progress)

    // Calculate how much to scroll in this step
    const currentStep = Math.round(actualDistance * (easedProgress - easeInOut((i - 1) / steps)))

    // Execute the scroll
    await page.mouse.wheel(0, currentStep)

    // Add delay between steps (faster in the middle of the scroll)
    const baseDelay = 16 // ~60fps
    const adjustedDelay = baseDelay * (
      // Slower at start and end, faster in the middle
      1 + 2 * (progress < 0.2 || progress > 0.8 ? 1 : 0.5)
    ) / speedFactor

    await delay(adjustedDelay)
  }

  // Occasional small "adjustment" scroll that humans often do
  if (Math.random() > 0.7) {
    await delay(getRandomDelay(200, 500))
    // Small adjustment (less than 5% of original scroll)
    const adjustment = Math.round((Math.random() * 2 - 1) * Math.abs(actualDistance) * 0.03)
    await page.mouse.wheel(0, adjustment)
  }
}

/**
 * Simulates human typing with realistic timing and occasional typos
 */
export async function typeHumanLike(
  page: Page,
  text: string,
  options: {
    selector?: string // Optional selector to focus first
    typoRate?: number // 0-1, chance of making typos
    speedWPM?: number // Words per minute typing speed
  } = {},
): Promise<void> {
  const {
    selector,
    speedWPM = 250, // Slightly faster than average typing speed
    typoRate = 0.03, // 3% typo rate by default
  } = options

  // Focus the element if a selector is provided
  if (selector) {
    await clickElementHumanLike(page, selector)
  }

  // Calculate base typing interval from WPM
  // 5 chars = 1 word, 60 seconds / WPM = mins per word, divided by 5 = mins per char
  const baseDelayMs = (60 * 1000) / speedWPM / 5

  // Characters that are commonly mistyped
  const typoMap = new Map([
    [
      'a',
      [
        's',
        'q',
        'z',
      ],
    ],
    [
      'b',
      [
        'v',
        'g',
        'h',
        'n',
      ],
    ],
    [
      'c',
      [
        'x',
        'd',
        'v',
      ],
    ],
    [
      'd',
      [
        's',
        'e',
        'f',
        'c',
      ],
    ],
    [
      'e',
      [
        'w',
        's',
        'd',
        'r',
      ],
    ],
    [
      'f',
      [
        'd',
        'g',
        'r',
        't',
      ],
    ],
    [
      'g',
      [
        'f',
        'h',
        't',
        'y',
      ],
    ],
    [
      'h',
      [
        'g',
        'j',
        'y',
        'u',
      ],
    ],
    [
      'i',
      [
        'u',
        'o',
        'j',
        'k',
      ],
    ],
    [
      'j',
      [
        'h',
        'k',
        'u',
        'i',
      ],
    ],
    [
      'k',
      [
        'j',
        'l',
        'i',
        'o',
      ],
    ],
    [
      'l',
      [
        'k',
        'o',
        'p',
      ],
    ],
    [
      'm',
      [
        'n',
        'j',
        'k',
      ],
    ],
    [
      'n',
      [
        'b',
        'm',
        'h',
        'j',
      ],
    ],
    [
      'o',
      [
        'i',
        'p',
        'k',
        'l',
      ],
    ],
    ['p', ['o', 'l']],
    ['q', ['w', 'a']],
    [
      'r',
      [
        'e',
        't',
        'd',
        'f',
      ],
    ],
    [
      's',
      [
        'a',
        'd',
        'w',
        'e',
      ],
    ],
    [
      't',
      [
        'r',
        'y',
        'f',
        'g',
      ],
    ],
    [
      'u',
      [
        'y',
        'i',
        'h',
        'j',
      ],
    ],
    [
      'v',
      [
        'c',
        'b',
        'f',
        'g',
      ],
    ],
    [
      'w',
      [
        'q',
        'e',
        'a',
        's',
      ],
    ],
    [
      'x',
      [
        'z',
        'c',
        's',
        'd',
      ],
    ],
    [
      'y',
      [
        't',
        'u',
        'g',
        'h',
      ],
    ],
    ['z', ['a', 'x']],
    ['0', ['9', '-']],
    ['1', ['2', 'q']],
    [
      '2',
      [
        '1',
        '3',
        'q',
        'w',
      ],
    ],
    [
      '3',
      [
        '2',
        '4',
        'w',
        'e',
      ],
    ],
    [
      '4',
      [
        '3',
        '5',
        'e',
        'r',
      ],
    ],
    [
      '5',
      [
        '4',
        '6',
        'r',
        't',
      ],
    ],
    [
      '6',
      [
        '5',
        '7',
        't',
        'y',
      ],
    ],
    [
      '7',
      [
        '6',
        '8',
        'y',
        'u',
      ],
    ],
    [
      '8',
      [
        '7',
        '9',
        'u',
        'i',
      ],
    ],
    [
      '9',
      [
        '8',
        '0',
        'i',
        'o',
      ],
    ],
  ])

  // Process each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    // Decide if we're going to make a typo
    const makeTypo = Math.random() < typoRate

    // Only make typos on letters or numbers
    if (makeTypo && typoMap.has(char.toLowerCase())) {
      // Get the possible typo characters
      const possibleTypos = typoMap.get(char.toLowerCase())!

      // Pick a random typo
      const typo = possibleTypos[Math.floor(Math.random() * possibleTypos.length)]

      // Type the typo
      await page.keyboard.press(typo)

      // Wait a bit before fixing
      await delay(getRandomDelay(200, 400))

      // Fix the typo by pressing backspace
      await page.keyboard.press('Backspace')
      await delay(getRandomDelay(100, 200))
    }

    // Type the correct character
    await page.keyboard.press(char)

    // Variable delay between keystrokes
    let delayMs = baseDelayMs

    // Add realistic timing variations
    // 1. Faster for common combinations
    const fastCombos = [
      'th',
      'he',
      'in',
      'er',
      'an',
      'on',
      'at',
      'es',
      'or',
      'en',
    ]
    if (i < text.length - 1) {
      const combo = text.substr(i, 2)
        .toLowerCase()
      if (fastCombos.includes(combo)) {
        delayMs *= 0.7
      }
    }

    // 2. Slower after punctuation
    if ('.!?,;:'.includes(char)) {
      delayMs *= 2
    }

    // 3. Add some natural variability (±30%)
    delayMs *= 0.7 + Math.random() * 0.6

    // Delay between keystrokes
    if (i < text.length - 1) {
      await delay(delayMs)
    }

    // Occasional longer pauses (like a human thinking)
    if (Math.random() < 0.02) {
      await delay(getRandomDelay(500, 1200))
    }
  }
}

/**
 * Parse cookie string to Cookie objects
 */
export function parseCookieString(cookieString: string): CookieParams[] {
  return cookieString
    .split('\n')
    .filter((line) => {
      return line.trim()
    })
    .map((line) => {
      const parts = line.split(';')
        .map((part) => {
          return part.trim()
        })
      const [nameValue, ...attributes] = parts
      const [name, value] = nameValue.split('=')

      const cookie: CookieParams = {
        domain: '',
        name,
        path: '/',
        sameSite: 'None',
        secure: false,
        value: value || '',
      }

      for (const attr of attributes) {
        const [key, val] = attr.split('=')
          .map((s) => {
            return s.toLowerCase()
              .trim()
          })
        if (key === 'domain') {
          cookie.domain = val
        }
        if (key === 'path') {
          cookie.path = val
        }
        if (key === 'secure') {
          cookie.secure = true
        }
        if (key === 'samesite') {
          cookie.sameSite = val as CookieParams['sameSite']
        }
      }

      return cookie
    })
}

/**
 * Save cookies to a file
 */
export async function saveCookiesToFile(path: string, cookies: any[]): Promise<string> {
  const cookieString = cookies
    .map((cookie) => {
      const { domain, name, path: cookiePath, sameSite, secure, value } = cookie
      const parts = [
        `${name}=${value}`,
        domain && `domain=${domain}`,
        cookiePath && `path=${cookiePath}`,
        secure && 'secure',
        sameSite && `samesite=${sameSite}`,
      ].filter(Boolean)

      return parts.join('; ')
    })
    .join('\n')

  await fs.writeFile(path, cookieString, 'utf8')

  return cookieString
}

/**
 * Read cookies from a file
 */
export async function readCookiesFromFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)

    return await fs.readFile(fullPath, 'utf8')
  }
  catch (error) {
    throw new Error(`Ошибка чтения файла cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
