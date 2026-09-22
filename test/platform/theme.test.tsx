import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ACCENT_PRESETS,
  BASE_BACKGROUNDS,
  BASE_CONTRAST,
  BASE_PRESETS,
  BASE_TOKENS,
  DEFAULT_THEME,
  FONT_PRESETS,
  RADIUS_PRESETS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  STYLE_PRESETS,
  THEME_PRESETS,
  ThemeScope,
  applyAccent,
  applyMode,
  applyTheme,
  contrastRatio,
  currentTheme,
  deriveBase,
  fontStylesheetUrl,
  loadFont,
  onThemeChange,
  parseTheme,
  resetTheme,
  resolveBase,
  resolveTheme,
  restoreTheme,
  saveTheme,
  serializeTheme,
  themeToCss,
  type BaseFamily,
  type BaseTokens,
  type ThemeConfig,
} from 'klyvui'

/**
 * The theme engine: the contrast it promises for every base colour it can
 * derive, the rule that the default theme is exactly today's stylesheet, and
 * the three ways a theme leaves the engine — inline on the root or a section,
 * as pasted CSS, and as a share string.
 */

const ROOT = join(__dirname, '..', '..')
const TOKENS_CSS = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')
const TAILWIND_THEME = readFileSync(join(ROOT, 'node_modules', 'tailwindcss', 'theme.css'), 'utf8')

/* ------------------------------------------------------------------ helpers */

const HEX = /^#[0-9a-f]{6}$/

function checkMode(colors: BaseTokens, where: string) {
  const floor = (hex: string) => Math.min(...BASE_BACKGROUNDS.map((background) => contrastRatio(hex, colors[background])))
  const onSurface = (hex: string) => contrastRatio(hex, colors.surface)

  for (const token of BASE_TOKENS) {
    if (token !== 'scrim') expect(colors[token], `${where} ${token}`).toMatch(HEX)
  }
  expect(floor(colors.ink), `${where} ink`).toBeGreaterThanOrEqual(BASE_CONTRAST.ink)
  expect(floor(colors['ink-soft']), `${where} ink-soft`).toBeGreaterThanOrEqual(BASE_CONTRAST.text)
  expect(floor(colors['ink-faint']), `${where} ink-faint`).toBeGreaterThanOrEqual(BASE_CONTRAST.text)
  expect(floor(colors['ink-soft']), `${where} soft over faint`).toBeGreaterThan(floor(colors['ink-faint']))
  expect(contrastRatio(colors['ink-inverse'], colors.ink), `${where} inverse`).toBeGreaterThanOrEqual(BASE_CONTRAST.inverse)

  const line = onSurface(colors.line)
  const strong = onSurface(colors['line-strong'])
  expect(line, `${where} line`).toBeGreaterThanOrEqual(BASE_CONTRAST.line[0])
  expect(line, `${where} line`).toBeLessThanOrEqual(BASE_CONTRAST.line[1])
  expect(strong, `${where} line-strong`).toBeGreaterThanOrEqual(BASE_CONTRAST.lineStrong[0])
  expect(strong, `${where} line-strong`).toBeLessThanOrEqual(BASE_CONTRAST.lineStrong[1])
  expect(strong, `${where} line-strong over line`).toBeGreaterThan(line)
  expect(onSurface(colors.track), `${where} track`).toBeGreaterThanOrEqual(BASE_CONTRAST.track)
}

function checkFamily(family: BaseFamily, where: string) {
  checkMode(family.light, `${where} light`)
  checkMode(family.dark, `${where} dark`)
}

/** `--name: value;` pairs from a CSS block, values whitespace-normalised. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>()
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].replace(/\s+/g, ' ').trim())
  }
  return out
}

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return ''
  return css.slice(start, css.indexOf('}', start) + 1)
}

const themeBlock = TOKENS_CSS.slice(TOKENS_CSS.indexOf('@theme {'), TOKENS_CSS.indexOf('\n}\n', TOKENS_CSS.indexOf('@theme {')))
const darkMedia = block(TOKENS_CSS, ":root:not([data-theme='light'])")
const darkAttribute = block(TOKENS_CSS, ":root[data-theme='dark']")

/** The value a hooked token takes when no theme is applied. */
function fallback(value: string | undefined, hook: string): string | undefined {
  const match = value?.match(new RegExp(`^var\\(${hook},\\s*(.+)\\)$`))
  return match?.[1]
}

/* ------------------------------------------------------------------ contrast */

describe('deriveBase', () => {
  it('keeps every promise for every preset, against every accent for tinted', () => {
    for (const preset of BASE_PRESETS) {
      const accents = preset.id === 'tinted' ? ACCENT_PRESETS.map((accent) => accent.hex) : [DEFAULT_THEME.accent]
      for (const accent of accents) checkFamily(resolveBase(preset.id, accent), `${preset.id} ${accent}`)
    }
  })

  it('keeps them across a sweep of hues and chromas, including chromas past the clamp', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const chroma of [0, 0.004, 0.01, 0.02, 0.035, 0.05, 0.1, 0.3]) {
        checkFamily(deriveBase(hue, chroma), `h${hue} c${chroma}`)
      }
    }
  })

  it('keeps the line floor under every style', () => {
    for (const style of STYLE_PRESETS) {
      for (const base of BASE_PRESETS) {
        const resolved = resolveTheme({ base: base.id, style: style.id })
        for (const mode of ['light', 'dark'] as const) {
          const colors = resolved[mode].colors
          expect(contrastRatio(colors.line, colors.surface), `${style.id} ${base.id} ${mode}`).toBeGreaterThanOrEqual(1.08)
        }
      }
    }
  })

  it('differs from sage for a derived base, and shadows follow its hue', () => {
    const slate = resolveTheme({ base: 'slate' })
    expect(slate.light.colors.canvas).not.toBe('#f4f7f0')
    expect(slate.light.shadows.card).not.toContain('20, 27, 15')
  })
})

/* ------------------------------------------------------------------ defaults */

// tokens.css as it was before the theme engine, copied by hand. The default
// theme has to render these exact values.
const ORIGINAL = {
  light: {
    canvas: '#f4f7f0', shell: '#ffffff', app: '#f6f7f4', surface: '#ffffff', 'surface-muted': '#f4f5f5',
    'surface-sunken': '#fafafa', line: '#eeefee', 'line-strong': '#e3e5e3', track: '#edefea', ink: '#17191c',
    'ink-soft': '#5c6165', 'ink-faint': '#6a7075', 'ink-inverse': '#ffffff', scrim: 'rgba(20, 24, 18, 0.28)',
  },
  dark: {
    canvas: '#0b0d0a', shell: '#121511', app: '#101310', surface: '#161a14', 'surface-muted': '#1e231b',
    'surface-sunken': '#12160f', line: '#262c22', 'line-strong': '#333a2d', track: '#232820', ink: '#edf0e8',
    'ink-soft': '#a3aa9b', 'ink-faint': '#868d80', 'ink-inverse': '#0b0d0a', scrim: 'rgba(0, 0, 0, 0.62)',
  },
  shadows: {
    light: {
      card: '0 1px 2px rgba(20, 27, 15, 0.04), 0 8px 24px -12px rgba(20, 27, 15, 0.08)',
      tile: '0 1px 2px rgba(20, 27, 15, 0.05)',
      float: '0 4px 16px -4px rgba(20, 27, 15, 0.14), 0 1px 3px rgba(20, 27, 15, 0.06)',
      window: '0 40px 90px -30px rgba(31, 44, 20, 0.28)',
    },
    dark: {
      card: '0 1px 2px rgba(0, 0, 0, 0.45), 0 8px 24px -12px rgba(0, 0, 0, 0.65)',
      tile: '0 1px 2px rgba(0, 0, 0, 0.45)',
      float: '0 4px 16px -4px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.45)',
      window: '0 40px 90px -30px rgba(0, 0, 0, 0.85)',
    },
  },
  radii: { glyph: '12px', tile: '14px', field: '16px', card: '20px', banner: '24px', window: '32px' },
  font: "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
}

describe('the default theme', () => {
  const light = declarations(themeBlock)

  it('falls back to the original neutrals in both modes, in both dark blocks', () => {
    for (const token of BASE_TOKENS) {
      expect(fallback(light.get(`--color-${token}`), `--base-light-${token}`), token).toBe(ORIGINAL.light[token])
      for (const dark of [darkMedia, darkAttribute]) {
        const value = declarations(dark).get(`--color-${token}`)
        expect(fallback(value, `--base-dark-${token}`), `dark ${token}`).toBe(ORIGINAL.dark[token])
      }
    }
  })

  it('falls back to the original shadows, and the hooks are unset by default', () => {
    for (const token of SHADOW_TOKENS) {
      expect(fallback(light.get(`--shadow-${token}`), `--style-shadow-${token}`)).toBe(ORIGINAL.shadows.light[token])
      for (const dark of [darkMedia, darkAttribute]) {
        const values = declarations(dark)
        expect(fallback(values.get(`--shadow-${token}`), `--style-shadow-${token}`)).toBe(ORIGINAL.shadows.dark[token])
        expect(values.get(`--style-shadow-${token}`)).toBe(`var(--style-dark-shadow-${token})`)
      }
    }
    // Nothing in the stylesheet sets a hook, so every fallback is what renders.
    expect(TOKENS_CSS).not.toMatch(/--(base-(light|dark)|style-(light|dark)-shadow)-[\w-]+\s*:/)
    expect(TOKENS_CSS).not.toMatch(/--radius-scale\s*:/)
  })

  it('gives every radius its original value at scale 1', () => {
    for (const [property, value] of Object.entries(RADIUS_TOKENS)) {
      expect(light.get(property), property).toBe(`calc(${value} * var(--radius-scale, 1))`)
    }
    for (const [name, value] of Object.entries(ORIGINAL.radii)) expect(RADIUS_TOKENS[`--radius-${name}`]).toBe(value)
    // Tailwind's own steps keep Tailwind's values.
    const tailwind = declarations(TAILWIND_THEME)
    for (const step of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']) {
      expect(RADIUS_TOKENS[`--radius-${step}`], step).toBe(tailwind.get(`--radius-${step}`))
    }
    expect(RADIUS_TOKENS['--radius']).toBe(tailwind.get('--radius'))
    // And every radius token in the stylesheet is on the scale.
    const inSheet = [...light.keys()].filter((property) => property.startsWith('--radius'))
    expect(inSheet.sort()).toEqual(Object.keys(RADIUS_TOKENS).sort())
  })

  it('keeps the fonts', () => {
    expect(light.get('--font-sans')).toBe(ORIGINAL.font)
    expect(FONT_PRESETS[0].stack).toBe(ORIGINAL.font)
    const unquote = (value = '') => value.replace(/"/g, "'")
    expect(unquote(light.get('--font-mono'))).toBe(unquote(declarations(TAILWIND_THEME).get('--font-mono')))
  })

  it('resolves DEFAULT_THEME to exactly those values', () => {
    const resolved = resolveTheme(DEFAULT_THEME)
    expect(resolved.light.colors).toEqual(ORIGINAL.light)
    expect(resolved.dark.colors).toEqual(ORIGINAL.dark)
    expect(resolved.light.shadows).toEqual(ORIGINAL.shadows.light)
    expect(resolved.dark.shadows).toEqual(ORIGINAL.shadows.dark)
    expect(resolved.radiusScale).toBe(1)
    expect(resolved.fontStack).toBe(ORIGINAL.font)
    expect(resolved.accent.accent).toBe('#c8f24e')
    expect(THEME_PRESETS[0]).toMatchObject({ id: 'klyv', theme: DEFAULT_THEME })
  })

  it('writes nothing but the accent when applied', () => {
    applyTheme(DEFAULT_THEME)
    const style = document.documentElement.style
    const written = Array.from({ length: style.length }, (_, index) => style.item(index))
    expect(written.filter((property) => !/accent/.test(property))).toEqual([])
  })
})

/* ------------------------------------------------------------------ runtime */

const root = () => document.documentElement

beforeEach(() => {
  resetTheme()
  root().removeAttribute('style')
  delete root().dataset.theme
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  delete root().dataset.theme
})

const LEDGER: ThemeConfig = THEME_PRESETS.find((preset) => preset.id === 'ledger')!.theme

describe('applyTheme on the root', () => {
  it('writes both modes as hooks, so a mode switch needs nothing reapplied', () => {
    const theme = applyTheme(LEDGER)
    const resolved = resolveTheme(LEDGER)
    const style = root().style
    expect(theme).toEqual(LEDGER)
    expect(style.getPropertyValue('--base-light-canvas')).toBe(resolved.light.colors.canvas)
    expect(style.getPropertyValue('--base-dark-ink-faint')).toBe(resolved.dark.colors['ink-faint'])
    expect(style.getPropertyValue('--style-light-shadow-card')).toBe('0 0 #0000')
    expect(style.getPropertyValue('--radius-scale')).toBe('0.5')
    expect(style.getPropertyValue('--font-sans')).toBe(FONT_PRESETS.find((font) => font.id === 'ibm-plex-sans')!.stack)
    expect(style.getPropertyValue('--color-accent')).toBe('#3b82f6')
    // Scoped-only properties never land on the root.
    expect(style.getPropertyValue('--color-canvas')).toBe('')

    applyMode('dark')
    expect(style.getPropertyValue('--base-light-canvas')).toBe(resolved.light.colors.canvas)
    expect(style.getPropertyValue('--base-dark-canvas')).toBe(resolved.dark.colors.canvas)
  })

  it('merges a partial theme with the one in force, and clears what it no longer needs', () => {
    applyTheme(LEDGER)
    const next = applyTheme({ radius: 'lg', style: 'soft' })
    expect(next).toEqual({ ...LEDGER, radius: 'lg', style: 'soft' })
    expect(currentTheme()).toEqual(next)
    expect(root().style.getPropertyValue('--radius-scale')).toBe('1.25')
    expect(root().style.getPropertyValue('--style-light-shadow-card')).not.toBe('0 0 #0000')

    applyTheme({ base: 'sage', radius: 'default', font: 'plus-jakarta', style: 'soft' })
    expect(root().style.getPropertyValue('--base-light-canvas')).toBe('')
    expect(root().style.getPropertyValue('--radius-scale')).toBe('')
    expect(root().style.getPropertyValue('--font-sans')).toBe('')
  })

  it('announces root changes once, and hears accents set outside the engine', () => {
    const seen: ThemeConfig[] = []
    const off = onThemeChange((theme) => seen.push(theme))
    applyTheme({ style: 'outline' })
    expect(seen).toHaveLength(1)
    expect(seen[0].style).toBe('outline')

    applyAccent('#f43f5e')
    expect(seen).toHaveLength(2)
    expect(seen[1]).toMatchObject({ accent: '#f43f5e', style: 'outline' })

    applyTheme({ radius: 'sm' }, document.createElement('div'))
    expect(seen).toHaveLength(2)
    off()
    applyTheme({ style: 'soft' })
    expect(seen).toHaveLength(2)
  })

  it('resets to the stylesheet', () => {
    applyTheme(LEDGER)
    expect(resetTheme()).toEqual(DEFAULT_THEME)
    expect(root().style.length).toBe(0)
  })
})

describe('applyTheme on a section', () => {
  it('writes resolved tokens for the mode in force, and leaves the root alone', () => {
    const section = document.createElement('section')
    const seen: ThemeConfig[] = []
    const off = onThemeChange((theme) => seen.push(theme))
    applyTheme({ base: 'mauve', radius: 0.5, style: 'elevated' }, section)
    off()

    const resolved = resolveTheme({ base: 'mauve', radius: 0.5, style: 'elevated' })
    expect(section.style.getPropertyValue('--color-canvas')).toBe(resolved.light.colors.canvas)
    expect(section.style.getPropertyValue('--color-focus')).toBe('var(--color-ink)')
    expect(section.style.getPropertyValue('--radius-card')).toBe('calc(20px * 0.5)')
    expect(section.style.getPropertyValue('--radius-10')).toBe('calc(10px * 0.5)')
    expect(section.style.getPropertyValue('--style-shadow-card')).toBe(resolved.light.shadows.card)
    expect(section.style.getPropertyValue('--shadow-card')).toBe(resolved.light.shadows.card)
    expect(section.style.getPropertyValue('--color-accent-soft')).not.toBe('')
    expect(root().style.getPropertyValue('--base-light-canvas')).toBe('')
    expect(seen).toHaveLength(0)

    // A mode change needs a reapply, which keeps the section's own theme.
    applyMode('dark')
    applyTheme({}, section)
    expect(section.style.getPropertyValue('--color-canvas')).toBe(resolved.dark.colors.canvas)
    expect(section.style.getPropertyValue('--radius-card')).toBe('calc(20px * 0.5)')

    resetTheme(section)
    expect(section.style.length).toBe(0)
  })

  it('ThemeScope applies itself and follows the mode', () => {
    const { container } = render(
      <ThemeScope theme={{ base: 'slate' }} className="p-2">
        inside
      </ThemeScope>,
    )
    const scope = container.firstElementChild as HTMLElement
    const slate = resolveTheme({ base: 'slate' })
    expect(scope.className).toBe('p-2')
    expect(scope.style.getPropertyValue('--color-surface')).toBe(slate.light.colors.surface)

    act(() => {
      applyMode('dark')
    })
    expect(scope.style.getPropertyValue('--color-surface')).toBe(slate.dark.colors.surface)

    // It inherits what it does not set from the page, and follows it.
    act(() => {
      applyTheme({ radius: 'none' })
    })
    expect(scope.style.getPropertyValue('--radius-card')).toBe('calc(20px * 0)')
    expect(scope.style.getPropertyValue('--color-surface')).toBe(slate.dark.colors.surface)
  })
})

describe('saving', () => {
  it('round-trips through storage', () => {
    applyTheme(LEDGER)
    saveTheme()
    resetTheme()
    expect(restoreTheme()).toEqual(LEDGER)
    expect(currentTheme()).toEqual(LEDGER)
  })

  it('migrates an accent saved before there was a theme', () => {
    window.localStorage.setItem('klyv:accent', '#f43f5e')
    expect(restoreTheme()).toEqual({ ...DEFAULT_THEME, accent: '#f43f5e' })
    expect(window.localStorage.getItem('klyv:accent')).toBeNull()
    expect(parseTheme(window.localStorage.getItem('klyv:theme')!)).toMatchObject({ accent: '#f43f5e' })
  })

  it('restores nothing when nothing was saved', () => {
    expect(restoreTheme()).toBeNull()
  })
})

/* ------------------------------------------------------------------ exports */

describe('themeToCss', () => {
  it('says so for the default theme, and sets nothing', () => {
    const css = themeToCss(DEFAULT_THEME)
    expect(css).toContain('nothing to override')
    expect(declarations(css).size).toBe(0)
  })

  it('mirrors tokens.css and sets exactly what applyTheme writes', () => {
    const inter = { ...LEDGER, font: 'inter' as const }
    const css = themeToCss(inter)
    const rootBlock = block(css, ':root')
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark) {'))
    expect(rootBlock).not.toBe('')
    expect(media).toContain(":root:not([data-theme='light']) {")
    const darkMediaBlock = declarations(block(css, ":root:not([data-theme='light'])"))
    const darkAttributeBlock = declarations(block(css, ":root[data-theme='dark']"))
    expect(darkMediaBlock).toEqual(darkAttributeBlock)
    expect([...darkMediaBlock.keys()].every((property) => /^--(base-dark|style-dark|accent-soft-dark)/.test(property))).toBe(true)

    // The font is suggested, never imported.
    expect(css).toContain("@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap')")
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('@import')

    // Every property the pasted CSS sets is one the runtime writes, with the same value.
    applyTheme(inter)
    const style = root().style
    const runtime = new Map(
      Array.from({ length: style.length }, (_, index) => style.item(index)).map((property) => [
        property,
        style.getPropertyValue(property).trim(),
      ]),
    )
    const pasted = new Map([...declarations(rootBlock), ...darkMediaBlock])
    expect(new Map([...pasted].sort())).toEqual(new Map([...runtime].sort()))
  })

  it('omits the dark blocks when only shared values change', () => {
    const css = themeToCss({ radius: 'sm' })
    expect(declarations(css)).toEqual(new Map([['--radius-scale', '0.5']]))
    expect(css).not.toContain('@media')
  })
})

describe('share strings', () => {
  it('round-trips every preset', () => {
    for (const preset of THEME_PRESETS) {
      const text = serializeTheme(preset.theme)
      expect(text).toMatch(/^[A-Za-z0-9._~-]+$/)
      expect(parseTheme(text)).toEqual(preset.theme)
    }
    expect(serializeTheme(DEFAULT_THEME)).toBe('c8f24e.sage.default.plus-jakarta.soft')
  })

  it('round-trips custom values', () => {
    const custom: ThemeConfig = {
      accent: '#123abc',
      base: { hue: 200, chroma: 0.0123 },
      radius: 0.8,
      font: { family: "'Söhne', system-ui, sans-serif" },
      style: 'elevated',
    }
    const text = serializeTheme(custom)
    expect(text).toMatch(/^[A-Za-z0-9._~-]+$/)
    expect(parseTheme(text)).toEqual(custom)
  })

  it('rejects anything that is not one', () => {
    for (const text of ['', 'nope', 'zzzzzz.sage.default.inter.soft', 'c8f24e.teal.default.inter.soft', 'c8f24e.sage.huge.inter.soft', 'c8f24e.sage.default.inter.glossy', 'c8f24e.sage.default.inter.soft.extra']) {
      expect(parseTheme(text), text).toBeNull()
    }
  })
})

describe('fonts', () => {
  it('builds Google Fonts URLs and never for the system stack', () => {
    expect(fontStylesheetUrl('dm-sans')).toBe('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap')
    expect(fontStylesheetUrl('system')).toBeNull()
    expect(fontStylesheetUrl({ family: 'Georgia, serif' })).toBeNull()
  })

  it('loads a font once, only when asked', () => {
    expect(document.head.querySelectorAll('link[data-klyv-font]')).toHaveLength(0)
    const first = loadFont('inter')
    const second = loadFont('inter')
    expect(first).toBe(second)
    expect(document.head.querySelectorAll('link[data-klyv-font]')).toHaveLength(1)
    first?.remove()
  })

  it('has the presets the customiser needs', () => {
    expect(RADIUS_PRESETS.map((preset) => [preset.id, preset.scale])).toEqual([
      ['none', 0], ['sm', 0.5], ['md', 0.75], ['default', 1], ['lg', 1.25], ['xl', 1.5],
    ])
    expect(BASE_PRESETS.map((preset) => preset.id)).toEqual([
      'sage', 'neutral', 'zinc', 'slate', 'stone', 'gray', 'mauve', 'olive', 'sand', 'tinted',
    ])
    expect(STYLE_PRESETS.map((preset) => preset.id)).toEqual(['soft', 'flat', 'outline', 'elevated'])
    expect(FONT_PRESETS.length).toBeGreaterThanOrEqual(11)
  })
})

/* ------------------------------------------------------------------ source */

describe('components', () => {
  it('hard-code no pixel radius', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(entry)) {
          const found = readFileSync(path, 'utf8').match(/\brounded(?:-[trblse]{1,2})?-\[\s*-?\d*\.?\d+px\s*\]/g)
          if (found) offenders.push(`${entry}: ${found.join(', ')}`)
        }
      }
    }
    walk(join(ROOT, 'src', 'components'))
    expect(offenders).toEqual([])
  })
})
