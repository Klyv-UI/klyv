import { expect, test, type Page } from '@playwright/test'

/**
 * A visual baseline for the pages that should not move by accident.
 *
 * Deliberately a short list of stable screens rather than everything: a
 * snapshot of a page with a marquee, a rotating cube or a countdown on it is a
 * test that fails for no reason, and a suite people learn to ignore is worse
 * than no suite. Animations are frozen and the clock-driven components are
 * kept out.
 *
 * Baselines are per-platform — Playwright names them accordingly — so a run on
 * another operating system writes its own the first time.
 */
const SCREENS = [
  { path: '/getting-started', name: 'getting-started' },
  { path: '/components/button', name: 'button-page' },
  { path: '/blocks/login', name: 'login-block' },
  { path: '/foundations', name: 'foundations' },
]

const MODES = ['light', 'dark'] as const

async function open(page: Page, path: string, mode: (typeof MODES)[number]) {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem('klyv:mode', value)
  }, mode)
  await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' })
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

for (const { path, name } of SCREENS) {
  for (const mode of MODES) {
    test(`${name} — ${mode}`, async ({ page }) => {
      await open(page, path, mode)
      await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        // A hair of tolerance for font rasterising, nowhere near enough to
        // hide a layout or colour change.
        maxDiffPixelRatio: 0.01,
      })
    })
  }
}
