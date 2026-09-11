// Throwaway: what accent-derived colour stays readable on the terminal's
// physical near-black chrome, for every accent the library ships?
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const hexes = [...readFileSync('./src/theme/accent.ts', 'utf8').matchAll(/hex:\s*'(#[0-9a-fA-F]{6})'/g)].map(
  (m) => m[1],
)

const TERMINAL_BG = '#0b0d12'
// Only mixes of --color-accent, because that is the one this script can set
// directly; accent-strong is derived at runtime and would not follow.
const CANDIDATES = [
  'var(--color-accent)',
  'color-mix(in oklab, var(--color-accent) 85%, #ffffff)',
  'color-mix(in oklab, var(--color-accent) 75%, #ffffff)',
  'color-mix(in oklab, var(--color-accent) 65%, #ffffff)',
  'color-mix(in oklab, var(--color-accent) 55%, #ffffff)',
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')

const rows = await page.evaluate(
  ({ hexes, candidates, bg }) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const probe = document.createElement('span')
    document.body.appendChild(probe)
    const rgb = (value) => {
      probe.style.color = value
      const resolved = getComputedStyle(probe).color
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = resolved
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const lum = (c) =>
      c
        .map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0)
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }

    const ground = rgb(bg)
    const out = []
    for (const hex of hexes) {
      document.documentElement.style.setProperty('--color-accent', hex)
      const row = { hex, values: {} }
      for (const c of candidates) row.values[c] = +ratio(rgb(c), ground).toFixed(2)
      out.push(row)
    }
    probe.remove()
    return out
  },
  { hexes, candidates: CANDIDATES, bg: TERMINAL_BG },
)

console.log(`terminal ground ${TERMINAL_BG}, ${rows.length} accents\n`)
const width = Math.max(...CANDIDATES.map((c) => c.length))
for (const c of CANDIDATES) {
  const all = rows.map((r) => r.values[c])
  const worst = Math.min(...all)
  const at = rows.find((r) => r.values[c] === worst)?.hex
  console.log(`${c.padEnd(width)}  worst ${String(worst).padEnd(6)} at ${at} ${worst >= 4.5 ? ' PASS' : ''}`)
}

await browser.close()
