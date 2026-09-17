import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ACCENT_PRESETS } from '../src/theme/accent'

/**
 * Colour contrast, measured where colour actually exists.
 *
 * The jsdom suite switches this rule off because jsdom does no layout and
 * cannot know what colour anything is — it says as much in its own comments.
 * This is the suite that was promised there: a real browser, real computed
 * colours, both themes, and the accents the library ships.
 *
 * `scrollable-region-focusable` rides along for the same reason: whether a
 * region scrolls is a question about layout, so jsdom can never answer it.
 */
const LAYOUT_RULES = ['color-contrast', 'scrollable-region-focusable']

const PAGES = [
  { path: '/', name: 'landing' },
  { path: '/getting-started', name: 'getting started' },
  { path: '/components', name: 'catalogue' },
  { path: '/components/button', name: 'Button' },
  { path: '/components/data-table', name: 'DataTable' },
  { path: '/components/bar-list', name: 'BarList' },
  { path: '/components/code-block', name: 'CodeBlock' },
  { path: '/blocks', name: 'blocks index' },
  { path: '/blocks/login', name: 'login block' },
  { path: '/blocks/dashboard', name: 'dashboard block' },
  { path: '/tokens', name: 'tokens' },
  { path: '/foundations', name: 'foundations' },
  { path: '/agents', name: 'agents' },
]

const MODES = ['light', 'dark'] as const

/** The extremes of the shipped ramp: a bright yellow-green, a violet, an
 *  orange, a yellow and a grey. If the ink rule holds, it holds for these. */
const EXTREMES = ['volt', 'ultraviolet', 'ember', 'saffron', 'graphite']
const PRESETS = ACCENT_PRESETS.filter((preset) => EXTREMES.includes(preset.id))

/** Loads a page already wearing a theme, the way a returning visitor would. */
async function open(
  page: Page,
  path: string,
  { mode, accent }: { mode: (typeof MODES)[number]; accent?: string },
) {
  await page.addInitScript(
    (theme: { mode: string; accent?: string }) => {
      window.localStorage.setItem('klyv:mode', theme.mode)
      if (theme.accent) window.localStorage.setItem('klyv:accent', theme.accent)
    },
    { mode, accent },
  )
  await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' })
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

/** Every failing element, named well enough to find without opening a report. */
async function failures(page: Page) {
  const results = await new AxeBuilder({ page }).withRules(LAYOUT_RULES).analyze()
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      rule: violation.id,
      target: node.target.join(' '),
      detail: (node.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 160),
    })),
  )
}

test.describe('every page clears contrast in both themes', () => {
  for (const { path, name } of PAGES) {
    for (const mode of MODES) {
      test(`${name} — ${mode}`, async ({ page }) => {
        await open(page, path, { mode })
        expect(await failures(page)).toEqual([])
      })
    }
  }
})

test.describe('the accent stays readable in every preset', () => {
  for (const preset of PRESETS) {
    for (const mode of MODES) {
      test(`${preset.name} — ${mode}`, async ({ page }) => {
        // Button is where the accent meets text most directly; the landing page
        // puts it on charts, chips, a full-bleed card and the hero highlight.
        await open(page, '/components/button', { mode, accent: preset.hex })
        expect(await failures(page), `${preset.name} on the Button page`).toEqual([])

        await open(page, '/', { mode, accent: preset.hex })
        expect(await failures(page), `${preset.name} on the landing page`).toEqual([])
      })
    }
  }
})
