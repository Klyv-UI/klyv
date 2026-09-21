// Captures the product itself, feature by feature, for the marketing images.
//
// Nothing here is mocked. Each capture drives the running site with Playwright
// — drops a logo, pulls a card apart, runs a benchmark, hovers a star — and
// photographs the result at twice its CSS size, so it is still sharp when a
// slide places it inside a 3840 x 2160 frame.
//
// Usage, with the site running (npm run dev):
//   node marketing/capture.mjs            # against http://localhost:5173
//   BASE=http://localhost:53310 node marketing/capture.mjs
//
// Then `node marketing/render.mjs` lays the captures out as the final images.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'captures')
const BASE = process.env.BASE ?? 'http://localhost:5173'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

/** A fresh page, so no accent or state leaks from one capture into the next. */
async function open(path, { width = 1600, height = 1000, dark = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
  })
  const page = await context.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { page, context }
}

const shot = (target, name) => target.screenshot({ path: join(OUT, `${name}.png`), animations: 'allow' })

/** Bring a section into view and wait for anything lazy in it to mount. */
async function reveal(page, selector, settle = 1800) {
  await page.locator(selector).scrollIntoViewIfNeeded()
  await page.waitForTimeout(settle)
}

const captures = {
  // The hero, light and dark: the statement over the running fluid.
  async hero() {
    for (const dark of [false, true]) {
      const { page, context } = await open('/', { dark })
      await page.waitForTimeout(4000)
      await shot(page, dark ? 'hero-dark' : 'hero-light')
      await context.close()
    }
  },

  // The product-screens window, on its observability tab.
  async toolkit() {
    const { page, context } = await open('/', { dark: true })
    await reveal(page, '#toolkit', 2500)
    await shot(page.locator('#toolkit [class*="radius-window"]').first(), 'toolkit')
    await context.close()
  },

  // A logo dropped on the page: the site repainted in its colour.
  async brand() {
    const { page, context } = await open('/')
    await reveal(page, '#make-it-yours')
    await page.getByRole('button', { name: 'Quillo' }).click()
    await page.waitForTimeout(2500)
    await shot(page.locator('#make-it-yours > div').first(), 'brand')
    await context.close()
  },

  // The same working card in four accents, for the one-colour slide.
  async accents() {
    for (const name of ['Volt', 'Ultraviolet', 'Signal', 'Coral']) {
      const { page, context } = await open('/')
      await page.locator(`[aria-label="Accent colour"] button[title="${name}"]`).first().click()
      await page.waitForTimeout(600)
      await reveal(page, '#anatomy', 1500)
      await shot(page.locator('#anatomy .anatomy-stage'), `accent-${name.toLowerCase()}`)
      await context.close()
    }
  },

  // The exploded view, all the way apart.
  async anatomy() {
    const { page, context } = await open('/', { dark: true })
    await reveal(page, '#anatomy')
    await page.evaluate(() => {
      const range = document.querySelector('#anatomy-explode')
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(range, '100')
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.waitForTimeout(900)
    await shot(page.locator('#anatomy .anatomy-stage'), 'anatomy')
    await context.close()
  },

  // The kit builder, weighing the observability kit.
  async kit() {
    const { page, context } = await open('/')
    await reveal(page, '#kit', 3500)
    await shot(page.locator('#kit h2').locator('xpath=ancestor::section[1]').locator('div.grid').last(), 'kit')
    await context.close()
  },

  // A pasted spreadsheet, as components.
  async data() {
    const { page, context } = await open('/')
    await reveal(page, '#your-data', 2500)
    await shot(page.locator('#your-data div.grid').first(), 'data')
    await context.close()
  },

  // The atlas close enough that the tiles are running.
  async atlas() {
    const { page, context } = await open('/atlas', { width: 1800, height: 1100 })
    await page.waitForTimeout(1200)
    for (let index = 0; index < 5; index++) {
      await page.getByTitle('Zoom in').click()
      await page.waitForTimeout(150)
    }
    await page.waitForTimeout(5000)
    await shot(page.locator('.touch-none').first(), 'atlas')
    await page.getByTitle('Fit the width of the library').click()
    await page.waitForTimeout(1200)
    await shot(page.locator('.touch-none').first(), 'atlas-overview')
    await context.close()
  },

  // The constellation, with Text lit: 248 components fanning out.
  async constellation() {
    const { page, context } = await open('/atlas', { width: 1800, height: 1100, dark: true })
    await page.getByText('Constellation', { exact: true }).click()
    await page.waitForTimeout(7000)
    const frame = page.locator('canvas').first()
    await shot(frame, 'constellation')
    const box = await frame.boundingBox()
    // Find Text by sweeping the top of the ring until its card appears.
    outer: for (let y = box.y + 40; y < box.y + box.height * 0.35; y += 3) {
      for (let x = box.x + box.width * 0.4; x < box.x + box.width * 0.6; x += 3) {
        await page.mouse.move(x, y)
        const name = await page.locator('div.pointer-events-none span.font-mono').first().textContent({ timeout: 50 }).catch(() => null)
        if (name === 'Text') break outer
      }
    }
    await page.waitForTimeout(400)
    // The hover card says what the slide already says; the picture reads cleaner without it.
    await page.addStyleTag({ content: 'canvas ~ div.pointer-events-none { display: none !important }' })
    await page.waitForTimeout(200)
    await shot(page.locator('canvas').first().locator('xpath=..'), 'constellation-text')
    await context.close()
  },

  // A black hole in the middle of a working dashboard.
  async horizon() {
    const { page, context } = await open('/components/event-horizon', { dark: true })
    await page.waitForTimeout(2500)
    const field = page.locator('[aria-label="A singularity falling through a dashboard"]').locator('xpath=..')
    const box = await field.boundingBox()
    await page.mouse.move(box.x + box.width * 0.36, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.46, { steps: 12 })
    await page.waitForTimeout(1500)
    await shot(field, 'horizon')
    await page.mouse.up()
    await context.close()
  },

  // A shadcn file, rewritten, with the report of what it could not do.
  async migrate() {
    const { page, context } = await open('/migrate', { width: 1600, height: 1300 })
    await shot(page.locator('main'), 'migrate')
    await context.close()
  },

  // X-ray on a real block: pointing at an input names it and its parents.
  async xray() {
    const { page, context } = await open('/blocks/login')
    await page.getByRole('button', { name: 'X-ray this screen' }).click()
    await page.waitForTimeout(400)
    const input = page.locator('main input').first()
    await input.scrollIntoViewIfNeeded()
    const box = await input.boundingBox()
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.waitForTimeout(500)
    await shot(page, 'xray')
    await context.close()
  },

  // A benchmark run on this machine: 250 StatCards, measured.
  async proving() {
    const { page, context } = await open('/proving-ground', { width: 1600, height: 1000 })
    await page.getByRole('button', { name: 'StatCard', exact: true }).first().click()
    await page.getByRole('button', { name: /^Run it/ }).click()
    await page.waitForSelector('text=Done — the numbers are below.', { timeout: 60000 })
    await page.evaluate(() => window.scrollTo(0, 250))
    await page.waitForTimeout(400)
    await shot(page, 'proving-wall')
    await page.locator('h2:has-text("measured here")').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -40))
    await page.waitForTimeout(400)
    await shot(page, 'proving-results')
    await context.close()
  },
}


Object.assign(captures, {
  // The palette half of "make it yours", so the slide does not repeat its own headline.
  async brandPalette() {
    const { page, context } = await open('/')
    await reveal(page, '#make-it-yours')
    await page.getByRole('button', { name: 'Quillo' }).click()
    await page.waitForTimeout(2500)
    await shot(page.locator('#make-it-yours h2').locator('xpath=ancestor::div[contains(@class,"grid")][1]').locator(':scope > div').nth(1), 'brand-palette')
    await context.close()
  },

  // The atlas flown to the charts, where every running tile is a chart.
  async atlasCharts() {
    const { page, context } = await open('/atlas', { width: 1800, height: 1100 })
    await page.getByLabel('Find a component on the atlas').fill('AreaChart')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    // Clear the search so nothing is dimmed, then pan so the Charts block fills
    // the frame rather than starting at its left edge.
    await page.getByLabel('Find a component on the atlas').fill('')
    // The wheel pans the atlas (tiles keep their own presses, so a drag that
    // starts on one would not move it).
    const frame = await page.locator('.touch-none').first().boundingBox()
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.wheel(760, 260)
    await page.waitForTimeout(6000)
    await page.addStyleTag({ content: '[data-controls]{display:none!important}' })
    await page.waitForTimeout(300)
    // A clip rather than an element shot: a frame full of running charts is
    // never still enough for Playwright's stability wait.
    const box = await page.locator('.touch-none').first().boundingBox()
    await page.screenshot({ path: join(OUT, 'atlas-charts.png'), clip: box, timeout: 60000 })
    await context.close()
  },

  // Migrate: just the two panes, before and after.
  async migrateCode() {
    const { page, context } = await open('/migrate', { width: 1600, height: 1300 })
    await shot(page.locator('main .grid').first(), 'migrate-code')
    await context.close()
  },

  // X-ray: just the screen, with the label on the input.
  async xrayScreen() {
    const { page, context } = await open('/blocks/login', { width: 1500, height: 1100 })
    await page.getByRole('button', { name: 'X-ray this screen' }).click()
    const input = page.locator('main input').first()
    await input.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, 120))
    await page.waitForTimeout(300)
    const box = await input.boundingBox()
    await page.mouse.move(box.x + 30, box.y + box.height / 2)
    await page.waitForTimeout(500)
    const frame = page.locator('main .cursor-crosshair').first()
    const area = await frame.boundingBox()
    await page.screenshot({ path: join(OUT, 'xray-screen.png'), clip: { x: area.x + area.width * 0.2, y: box.y - 170, width: area.width * 0.6, height: 620 } })
    await context.close()
  },

  // Proving ground: the numbers and the frame chart, readable.
  async provingNumbers() {
    const { page, context } = await open('/proving-ground', { width: 1600, height: 1000 })
    await page.getByRole('button', { name: 'StatCard', exact: true }).first().click()
    await page.getByRole('button', { name: /^Run it/ }).click()
    await page.waitForSelector('text=Done — the numbers are below.', { timeout: 60000 })
    await shot(page.locator('section', { has: page.locator('h2:has-text("measured here")') }), 'proving-numbers')
    await context.close()
  },

  // Kit builder: the weighing card alone.
  async kitCard() {
    const { page, context } = await open('/')
    await reveal(page, '#kit', 3500)
    await shot(page.locator('#kit ul[aria-label="In the kit"]').locator('xpath=..'), 'kit-card')
    await context.close()
  },
})

const only = process.argv.slice(2)
for (const [name, capture] of Object.entries(captures)) {
  if (only.length && !only.includes(name)) continue
  process.stdout.write(`capturing ${name}… `)
  try {
    await capture()
    console.log('ok')
  } catch (error) {
    console.log(`failed: ${String(error.message).split('\n')[0]}`)
  }
}

await browser.close()
