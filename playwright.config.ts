import { defineConfig, devices } from '@playwright/test'

/**
 * The browser suite: the checks jsdom cannot make.
 *
 * Colour contrast needs real layout and real computed colours, which is exactly
 * why the axe suite in `test/` switches that rule off — and why this one
 * exists. It drives the documentation site, so every component is measured as
 * it actually renders, in both themes and under several accents.
 *
 * It reuses a dev server if one is already up, so running it next to `npm run
 * dev` costs nothing.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    // A screenshot of a moving page is a coin toss, and every animated
    // component here has a still state by house rule.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
