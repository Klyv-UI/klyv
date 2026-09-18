'use client'

/**
 * The theme engine: accent, base colour, radius, font and style.
 *
 * The accent was always themeable, and everything here follows the rules it set.
 * A theme is five choices, not a list of colours: every value the stylesheet
 * reads is derived from them, and every derived text colour is stepped until it
 * holds its contrast, so no combination a picker can produce is unreadable.
 *
 * It works in three places. `applyTheme` writes inline custom properties on the
 * root or on one element. `themeToCss` prints the same properties as a block of
 * CSS to paste, for apps that want no runtime at all. And `serializeTheme`
 * packs a theme into a short string for a share link.
 *
 * The stylesheet does the rest. Each neutral in tokens.css reads a
 * `--base-light-*` or `--base-dark-*` hook, each shadow a `--style-*` hook, and
 * each radius is multiplied by `--radius-scale`. Nothing defines those by
 * default, so an untouched page renders exactly the literal values in the file.
 */

import { contrastRatio } from '../lib/contrast'
import { hexToOklch, oklchToHex, oklchToRgb, type Oklch } from '../lib/oklch'
import { ACCENT_PRESETS, applyAccent, currentAccent, deriveAccent, onAccentChange, type AccentFamily } from './accent'
import { currentMode, resolveMode, type ResolvedMode } from './mode'

/* ------------------------------------------------------------------ types */

export type BaseId = 'sage' | 'neutral' | 'zinc' | 'slate' | 'stone' | 'gray' | 'mauve' | 'olive' | 'sand' | 'tinted'
export type RadiusId = 'none' | 'sm' | 'md' | 'default' | 'lg' | 'xl'
export type FontId =
  | 'plus-jakarta'
  | 'inter'
  | 'geist'
  | 'dm-sans'
  | 'manrope'
  | 'figtree'
  | 'ibm-plex-sans'
  | 'space-grotesk'
  | 'outfit'
  | 'system'
  | 'newsreader'
export type StyleId = 'soft' | 'flat' | 'outline' | 'elevated'

export interface ThemeConfig {
  /** The accent, as a hex colour. Its three relatives are derived by deriveAccent. */
  accent: string
  /** A named neutral family, or an OKLCH hue and chroma to derive one from. */
  base: BaseId | { hue: number; chroma: number }
  /** A named radius step, or a multiplier on every radius token (1 is the default). */
  radius: RadiusId | number
  /** A named font, or any CSS font-family stack. */
  font: FontId | { family: string }
  /** How depth is drawn: shadows, lines, or both. */
  style: StyleId
}

/** The neutral tokens a base colour sets, without their `--color-` prefix. */
export const BASE_TOKENS = [
  'canvas',
  'shell',
  'app',
  'surface',
  'surface-muted',
  'surface-sunken',
  'line',
  'line-strong',
  'track',
  'ink',
  'ink-soft',
  'ink-faint',
  'ink-inverse',
  'scrim',
] as const
export type BaseToken = (typeof BASE_TOKENS)[number]
export type BaseTokens = Record<BaseToken, string>

export interface BaseFamily {
  light: BaseTokens
  dark: BaseTokens
  /** The `r, g, b` shadows are tinted with on a light page, and the deeper one for the window. */
  shadowTint: { light: string; window: string }
}

/** The elevation tokens a style sets, without their `--shadow-` prefix. */
export const SHADOW_TOKENS = ['card', 'tile', 'float', 'window'] as const
export type ShadowToken = (typeof SHADOW_TOKENS)[number]
export type ShadowSet = Record<ShadowToken, string>

export interface BasePreset {
  id: BaseId
  name: string
  /** OKLCH hue, or `accent` when the base takes the accent's hue. */
  hue: number | 'accent'
  /** OKLCH chroma of the canvas. The rest of the family scales from it. */
  chroma: number
}

export interface RadiusPreset {
  id: RadiusId
  name: string
  scale: number
}

export interface FontPreset {
  id: FontId
  name: string
  /** The CSS font-family stack written to `--font-sans`. */
  stack: string
  /** The Google Fonts family, when the font is served there. */
  googleFamily?: string
  /** The weights the components use that the family offers. */
  weights: number[]
}

export interface StylePreset {
  id: StyleId
  name: string
  description: string
}

export interface ThemePreset {
  id: string
  name: string
  description: string
  theme: ThemeConfig
}

/** Everything a theme resolves to, for one mode. */
export interface ThemeModeTokens {
  colors: BaseTokens
  shadows: ShadowSet
}

/** Every value a theme writes, resolved. A customiser can preview from this without applying it. */
export interface ResolvedTheme {
  config: ThemeConfig
  accent: AccentFamily
  light: ThemeModeTokens
  dark: ThemeModeTokens
  radiusScale: number
  fontStack: string
}

/* ------------------------------------------------------------------ presets */

/**
 * Today's neutrals, copied from tokens.css rather than derived. A derivation
 * that came within a rounding error of them would still be a different theme,
 * and the default has to be the one the dashboard was measured from.
 */
const SAGE: BaseFamily = {
  light: {
    canvas: '#f4f7f0',
    shell: '#ffffff',
    app: '#f6f7f4',
    surface: '#ffffff',
    'surface-muted': '#f4f5f5',
    'surface-sunken': '#fafafa',
    line: '#eeefee',
    'line-strong': '#e3e5e3',
    track: '#edefea',
    ink: '#17191c',
    'ink-soft': '#5c6165',
    'ink-faint': '#6a7075',
    'ink-inverse': '#ffffff',
    scrim: 'rgba(20, 24, 18, 0.28)',
  },
  dark: {
    canvas: '#0b0d0a',
    shell: '#121511',
    app: '#101310',
    surface: '#161a14',
    'surface-muted': '#1e231b',
    'surface-sunken': '#12160f',
    line: '#262c22',
    'line-strong': '#333a2d',
    track: '#232820',
    ink: '#edf0e8',
    'ink-soft': '#a3aa9b',
    'ink-faint': '#868d80',
    'ink-inverse': '#0b0d0a',
    scrim: 'rgba(0, 0, 0, 0.62)',
  },
  shadowTint: { light: '20, 27, 15', window: '31, 44, 20' },
}

export const BASE_PRESETS: BasePreset[] = [
  { id: 'sage', name: 'Sage', hue: 126, chroma: 0.0098 },
  { id: 'neutral', name: 'Neutral', hue: 0, chroma: 0 },
  { id: 'zinc', name: 'Zinc', hue: 286, chroma: 0.004 },
  { id: 'slate', name: 'Slate', hue: 257, chroma: 0.01 },
  { id: 'stone', name: 'Stone', hue: 60, chroma: 0.005 },
  { id: 'gray', name: 'Gray', hue: 265, chroma: 0.007 },
  { id: 'mauve', name: 'Mauve', hue: 315, chroma: 0.01 },
  { id: 'olive', name: 'Olive', hue: 118, chroma: 0.01 },
  { id: 'sand', name: 'Sand', hue: 80, chroma: 0.014 },
  { id: 'tinted', name: 'Tinted', hue: 'accent', chroma: 0.016 },
]

export const RADIUS_PRESETS: RadiusPreset[] = [
  { id: 'none', name: 'None', scale: 0 },
  { id: 'sm', name: 'Small', scale: 0.5 },
  { id: 'md', name: 'Medium', scale: 0.75 },
  { id: 'default', name: 'Default', scale: 1 },
  { id: 'lg', name: 'Large', scale: 1.25 },
  { id: 'xl', name: 'Extra large', scale: 1.5 },
]

const SANS_TAIL = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const SANS_WEIGHTS = [400, 500, 600, 700, 800]

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    stack: `'Plus Jakarta Sans', ${SANS_TAIL}`,
    googleFamily: 'Plus Jakarta Sans',
    weights: SANS_WEIGHTS,
  },
  { id: 'inter', name: 'Inter', stack: `'Inter', ${SANS_TAIL}`, googleFamily: 'Inter', weights: SANS_WEIGHTS },
  { id: 'geist', name: 'Geist', stack: `'Geist', ${SANS_TAIL}`, googleFamily: 'Geist', weights: SANS_WEIGHTS },
  { id: 'dm-sans', name: 'DM Sans', stack: `'DM Sans', ${SANS_TAIL}`, googleFamily: 'DM Sans', weights: SANS_WEIGHTS },
  { id: 'manrope', name: 'Manrope', stack: `'Manrope', ${SANS_TAIL}`, googleFamily: 'Manrope', weights: SANS_WEIGHTS },
  { id: 'figtree', name: 'Figtree', stack: `'Figtree', ${SANS_TAIL}`, googleFamily: 'Figtree', weights: SANS_WEIGHTS },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    stack: `'IBM Plex Sans', ${SANS_TAIL}`,
    googleFamily: 'IBM Plex Sans',
    weights: [400, 500, 600, 700],
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    stack: `'Space Grotesk', ${SANS_TAIL}`,
    googleFamily: 'Space Grotesk',
    weights: [400, 500, 600, 700],
  },
  { id: 'outfit', name: 'Outfit', stack: `'Outfit', ${SANS_TAIL}`, googleFamily: 'Outfit', weights: SANS_WEIGHTS },
  { id: 'system', name: 'System', stack: SANS_TAIL, weights: SANS_WEIGHTS },
  {
    id: 'newsreader',
    name: 'Newsreader',
    stack: "'Newsreader', ui-serif, Georgia, Cambria, 'Times New Roman', serif",
    googleFamily: 'Newsreader',
    weights: SANS_WEIGHTS,
  },
]

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'soft', name: 'Soft', description: 'Hairlines and a light shadow. The default.' },
  { id: 'flat', name: 'Flat', description: 'No shadows. Slightly firmer lines carry the structure.' },
  { id: 'outline', name: 'Outline', description: 'No shadows, and strong lines around everything.' },
  { id: 'elevated', name: 'Elevated', description: 'Deeper shadows, softer lines.' },
]

export const DEFAULT_THEME: ThemeConfig = Object.freeze({
  accent: ACCENT_PRESETS[0].hex,
  base: 'sage',
  radius: 'default',
  font: 'plus-jakarta',
  style: 'soft',
}) as ThemeConfig

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'klyv', name: 'Klyv', description: 'Volt on sage. The library as it ships.', theme: DEFAULT_THEME },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Cobalt on slate, tight corners and ruled lines, for dense data.',
    theme: { accent: '#3b82f6', base: 'slate', radius: 'sm', font: 'ibm-plex-sans', style: 'outline' },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Ultraviolet on zinc with round corners and lifted cards.',
    theme: { accent: '#8b5cf6', base: 'zinc', radius: 'lg', font: 'geist', style: 'elevated' },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Coral on warm sand, set in a serif, flat as a page.',
    theme: { accent: '#f43f5e', base: 'sand', radius: 'md', font: 'newsreader', style: 'flat' },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Kelp on pure neutral, square corners and hard lines.',
    theme: { accent: '#10b981', base: 'neutral', radius: 'none', font: 'space-grotesk', style: 'outline' },
  },
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Flamingo on mauve, the roundest corners, soft shadows.',
    theme: { accent: '#f472b6', base: 'mauve', radius: 'xl', font: 'outfit', style: 'soft' },
  },
  {
    id: 'harbor',
    name: 'Harbor',
    description: 'Signal cyan on slate with lifted surfaces.',
    theme: { accent: '#22d3ee', base: 'slate', radius: 'default', font: 'inter', style: 'elevated' },
  },
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Saffron on olive, large corners, in Figtree.',
    theme: { accent: '#facc15', base: 'olive', radius: 'lg', font: 'figtree', style: 'soft' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Slate-grey accent on a base tinted to match. Quiet and flat.',
    theme: { accent: '#64748b', base: 'tinted', radius: 'md', font: 'manrope', style: 'flat' },
  },
]

/**
 * Every radius token and its value at scale 1. tokens.css multiplies each by
 * `--radius-scale`; a scoped theme cannot reach that multiplication (it runs
 * on :root), so it writes these products on its own element instead.
 */
export const RADIUS_TOKENS: Readonly<Record<string, string>> = {
  '--radius-glyph': '12px',
  '--radius-tile': '14px',
  '--radius-field': '16px',
  '--radius-card': '20px',
  '--radius-banner': '24px',
  '--radius-window': '32px',
  '--radius-hair': '1.5px',
  '--radius-2': '2px',
  '--radius-3': '3px',
  '--radius-4': '4px',
  '--radius-5': '5px',
  '--radius-6': '6px',
  '--radius-7': '7px',
  '--radius-8': '8px',
  '--radius-9': '9px',
  '--radius-10': '10px',
  '--radius-11': '11px',
  '--radius-13': '13px',
  '--radius-18': '18px',
  '--radius': '0.25rem',
  '--radius-xs': '0.125rem',
  '--radius-sm': '0.25rem',
  '--radius-md': '0.375rem',
  '--radius-lg': '0.5rem',
  '--radius-xl': '0.75rem',
  '--radius-2xl': '1rem',
  '--radius-3xl': '1.5rem',
  '--radius-4xl': '2rem',
}

/* ------------------------------------------------------------ base colour */

/**
 * What deriveBase guarantees, measured on the hex it returns.
 *
 * `text` holds for ink-soft and ink-faint against every background token —
 * surface, shell, canvas, app, surface-muted and surface-sunken — in both
 * modes, with ink-soft always the stronger of the two. The line bounds are
 * against `surface`: visible, and still a hairline. The literal sage values
 * meet every one of these too; the test checks both.
 */
export const BASE_CONTRAST = {
  ink: 12,
  text: 4.5,
  inverse: 12,
  line: [1.1, 1.6],
  lineStrong: [1.2, 2.2],
  track: 1.08,
} as const

/** The backgrounds text has to hold its contrast on. */
export const BASE_BACKGROUNDS: readonly BaseToken[] = ['surface', 'shell', 'canvas', 'app', 'surface-muted', 'surface-sunken']

/** Above this, a "neutral" stops being one. Wilder chromas are clamped to it. */
export const MAX_BASE_CHROMA = 0.05

type Step = readonly [lightness: number, chroma: number]
type Template = Record<Exclude<BaseToken, 'scrim'>, Step>

// Lightness in OKLCH, and chroma as a multiple of the base chroma. Fitted to the
// sage tokens, so a derived base has the same stack of planes and the same
// weight of text — it differs in hue, not in structure.
const LIGHT: Template = {
  canvas: [0.972, 1],
  shell: [1, 0],
  app: [0.975, 0.45],
  surface: [1, 0],
  'surface-muted': [0.969, 0.3],
  'surface-sunken': [0.985, 0.15],
  line: [0.951, 0.35],
  'line-strong': [0.92, 0.45],
  track: [0.949, 0.7],
  ink: [0.21, 0.7],
  'ink-soft': [0.49, 0.9],
  'ink-faint': [0.54, 1],
  'ink-inverse': [1, 0],
}

const DARK: Template = {
  canvas: [0.155, 0.7],
  shell: [0.191, 0.9],
  app: [0.182, 0.8],
  surface: [0.211, 1.25],
  'surface-muted': [0.248, 1.6],
  'surface-sunken': [0.193, 1.4],
  line: [0.284, 1.9],
  'line-strong': [0.338, 2.3],
  track: [0.269, 1.6],
  ink: [0.951, 1.1],
  'ink-soft': [0.728, 2.1],
  'ink-faint': [0.634, 2],
  'ink-inverse': [0.155, 0.7],
}

const STEP = 0.004

/**
 * Walks lightness one way until `ok` holds, and returns the hex it stopped on.
 * It always stops: the walk ends at black or white, and every target below is
 * met there against backgrounds as light (or as dark) as the template makes them.
 */
function walk(start: Oklch, direction: 1 | -1, ok: (hex: string) => boolean): string {
  let l = start.l
  let hex = oklchToHex(start)
  while (!ok(hex) && l > 0 && l < 1) {
    l = Math.min(1, Math.max(0, l + direction * STEP))
    hex = oklchToHex({ ...start, l })
  }
  return hex
}

function rgbString(color: Oklch): string {
  return oklchToRgb(color).join(', ')
}

function deriveMode(hue: number, chroma: number, mode: ResolvedMode): BaseTokens {
  const template = mode === 'light' ? LIGHT : DARK
  const at = (token: keyof Template): Oklch => ({ l: template[token][0], c: chroma * template[token][1], h: hue })
  // Text gets darker on a light page and lighter on a dark one; lines move the same way.
  const away: 1 | -1 = mode === 'light' ? -1 : 1

  const set = {} as BaseTokens
  for (const token of ['canvas', 'shell', 'app', 'surface', 'surface-muted', 'surface-sunken'] as const) {
    set[token] = oklchToHex(at(token))
  }

  const floor = (hex: string) => Math.min(...BASE_BACKGROUNDS.map((background) => contrastRatio(hex, set[background])))
  set.ink = walk(at('ink'), away, (hex) => floor(hex) >= BASE_CONTRAST.ink)
  set['ink-faint'] = walk(at('ink-faint'), away, (hex) => floor(hex) >= BASE_CONTRAST.text)
  const faint = floor(set['ink-faint'])
  set['ink-soft'] = walk(at('ink-soft'), away, (hex) => floor(hex) >= Math.max(BASE_CONTRAST.text, faint * 1.15))

  // Lines have a ceiling as well as a floor, so they walk whichever way they
  // are out of bounds: a hairline that reads as a rule is as wrong as one
  // nobody can see.
  const onSurface = (hex: string) => contrastRatio(hex, set.surface)
  const bounded = (token: 'line' | 'line-strong', [min, max]: readonly [number, number]) => {
    const start = at(token)
    const hex = oklchToHex(start)
    if (onSurface(hex) > max) return walk(start, away === 1 ? -1 : 1, (candidate) => onSurface(candidate) <= max)
    return walk(start, away, (candidate) => onSurface(candidate) >= min)
  }
  set.line = bounded('line', BASE_CONTRAST.line)
  const lineRatio = onSurface(set.line)
  set['line-strong'] = walk(at('line-strong'), away, (hex) => {
    const ratio = onSurface(hex)
    return ratio >= BASE_CONTRAST.lineStrong[0] && ratio >= lineRatio + 0.08
  })
  set.track = walk(at('track'), away, (hex) => onSurface(hex) >= BASE_CONTRAST.track)

  set['ink-inverse'] = mode === 'light' ? set.shell : set.canvas
  set.scrim =
    mode === 'light'
      ? `rgba(${rgbString({ l: 0.22, c: Math.min(0.03, chroma * 1.2), h: hue })}, 0.28)`
      : 'rgba(0, 0, 0, 0.62)'
  return set
}

/**
 * A full neutral family, light and dark, from one hue and chroma in OKLCH.
 *
 * Lightness comes from a template fitted to the sage tokens; hue and chroma
 * come from the arguments. Then every text colour is stepped darker (or, in
 * dark mode, lighter) until it clears its target on every background, and
 * the lines are stepped into their band — so the guarantee is measured on the
 * hex that ships, not assumed from the template. See BASE_CONTRAST.
 */
export function deriveBase(hue: number, chroma: number): BaseFamily {
  const h = ((hue % 360) + 360) % 360
  const c = Math.min(MAX_BASE_CHROMA, Math.max(0, Number.isFinite(chroma) ? chroma : 0))
  return {
    light: deriveMode(h, c, 'light'),
    dark: deriveMode(h, c, 'dark'),
    shadowTint: {
      light: rgbString({ l: 0.22, c: Math.min(0.03, c * 1.4), h }),
      window: rgbString({ l: 0.3, c: Math.min(0.05, c * 2.2), h }),
    },
  }
}

/** The hue and chroma a `tinted` base takes from an accent. */
function tintOf(accent: string): { hue: number; chroma: number } {
  const { h, c } = hexToOklch(accent)
  const tinted = BASE_PRESETS.find((preset) => preset.id === 'tinted')!
  return { hue: h, chroma: Math.min(tinted.chroma, c * 0.1) }
}

/** The neutral family for a base setting. `sage` is the literal default; everything else is derived. */
export function resolveBase(base: ThemeConfig['base'], accent: string = DEFAULT_THEME.accent): BaseFamily {
  if (typeof base === 'object') return deriveBase(base.hue, base.chroma)
  if (base === 'sage') return SAGE
  if (base === 'tinted') {
    const { hue, chroma } = tintOf(accent)
    return deriveBase(hue, chroma)
  }
  const preset = BASE_PRESETS.find((entry) => entry.id === base)
  return preset && typeof preset.hue === 'number' ? deriveBase(preset.hue, preset.chroma) : SAGE
}

/* ------------------------------------------------------------------ style */

// Written as a real shadow rather than `none`: Tailwind composes the shadow
// utilities into a comma list with the ring and inset shadows, and `none` is
// not valid inside a list.
const NO_SHADOW = '0 0 #0000'

function shadowsFor(style: StyleId, tint: BaseFamily['shadowTint']): { light: ShadowSet; dark: ShadowSet } {
  const t = tint.light
  const w = tint.window
  if (style === 'flat' || style === 'outline') {
    const none = { card: NO_SHADOW, tile: NO_SHADOW, float: NO_SHADOW, window: NO_SHADOW }
    return { light: none, dark: none }
  }
  if (style === 'elevated') {
    return {
      light: {
        card: `0 1px 3px rgba(${t}, 0.06), 0 14px 32px -12px rgba(${t}, 0.16)`,
        tile: `0 1px 3px rgba(${t}, 0.08), 0 2px 6px -2px rgba(${t}, 0.06)`,
        float: `0 12px 32px -8px rgba(${t}, 0.22), 0 2px 6px rgba(${t}, 0.08)`,
        window: `0 50px 110px -30px rgba(${w}, 0.4)`,
      },
      dark: {
        card: '0 1px 3px rgba(0, 0, 0, 0.5), 0 14px 32px -12px rgba(0, 0, 0, 0.8)',
        tile: '0 1px 3px rgba(0, 0, 0, 0.55), 0 2px 6px -2px rgba(0, 0, 0, 0.4)',
        float: '0 12px 32px -8px rgba(0, 0, 0, 0.75), 0 2px 6px rgba(0, 0, 0, 0.5)',
        window: '0 50px 110px -30px rgba(0, 0, 0, 0.92)',
      },
    }
  }
  return {
    light: {
      card: `0 1px 2px rgba(${t}, 0.04), 0 8px 24px -12px rgba(${t}, 0.08)`,
      tile: `0 1px 2px rgba(${t}, 0.05)`,
      float: `0 4px 16px -4px rgba(${t}, 0.14), 0 1px 3px rgba(${t}, 0.06)`,
      window: `0 40px 90px -30px rgba(${w}, 0.28)`,
    },
    dark: {
      card: '0 1px 2px rgba(0, 0, 0, 0.45), 0 8px 24px -12px rgba(0, 0, 0, 0.65)',
      tile: '0 1px 2px rgba(0, 0, 0, 0.45)',
      float: '0 4px 16px -4px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.45)',
      window: '0 40px 90px -30px rgba(0, 0, 0, 0.85)',
    },
  }
}

/**
 * Moves the two line tokens for a style. The step between `line` and
 * `line-strong` is the unit, so a style means the same thing on any base:
 * flat firms both by half a step, outline by a whole one, and elevated eases
 * `line` back toward the surface — never so far it falls under the floor.
 */
function linesFor(style: StyleId, colors: BaseTokens): BaseTokens {
  if (style === 'soft') return colors
  const line = hexToOklch(colors.line)
  const strong = hexToOklch(colors['line-strong'])
  const step = strong.l - line.l
  const shift = (color: Oklch, by: number) => oklchToHex({ ...color, l: color.l + by })

  if (style === 'elevated') {
    const away: 1 | -1 = step < 0 ? -1 : 1
    const eased = { ...line, l: line.l - step * 0.4 }
    return {
      ...colors,
      line: walk(eased, away, (hex) => contrastRatio(hex, colors.surface) >= 1.08),
      'line-strong': shift(strong, -step * 0.3),
    }
  }
  const by = style === 'flat' ? 0.5 : 1
  return { ...colors, line: shift(line, step * by), 'line-strong': shift(strong, step * by) }
}

/* ------------------------------------------------------------ resolution */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function normaliseHex(value: string): string | null {
  const match = HEX.exec(value.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  return `#${digits.toLowerCase()}`
}

const isId = <T extends string>(list: { id: T }[], value: unknown): value is T =>
  typeof value === 'string' && list.some((entry) => entry.id === value)

/** A complete, valid theme from anything partial. Unknown values fall back to the default's. */
function normaliseTheme(input: Partial<ThemeConfig>): ThemeConfig {
  const accent = (typeof input.accent === 'string' && normaliseHex(input.accent)) || DEFAULT_THEME.accent

  let base: ThemeConfig['base'] = DEFAULT_THEME.base
  if (isId(BASE_PRESETS, input.base)) base = input.base
  else if (input.base && typeof input.base === 'object' && Number.isFinite(input.base.hue) && Number.isFinite(input.base.chroma)) {
    base = {
      hue: ((input.base.hue % 360) + 360) % 360,
      chroma: Math.min(MAX_BASE_CHROMA, Math.max(0, input.base.chroma)),
    }
  }

  let radius: ThemeConfig['radius'] = DEFAULT_THEME.radius
  if (isId(RADIUS_PRESETS, input.radius)) radius = input.radius
  else if (typeof input.radius === 'number' && Number.isFinite(input.radius)) radius = Math.min(3, Math.max(0, input.radius))

  let font: ThemeConfig['font'] = DEFAULT_THEME.font
  if (isId(FONT_PRESETS, input.font)) font = input.font
  else if (input.font && typeof input.font === 'object' && typeof input.font.family === 'string' && input.font.family.trim()) {
    font = { family: input.font.family.trim() }
  }

  const style = isId(STYLE_PRESETS, input.style) ? input.style : DEFAULT_THEME.style
  return { accent, base, radius, font, style }
}

function radiusScale(radius: ThemeConfig['radius']): number {
  return typeof radius === 'number' ? radius : (RADIUS_PRESETS.find((preset) => preset.id === radius)?.scale ?? 1)
}

function fontPreset(font: ThemeConfig['font']): FontPreset | undefined {
  return typeof font === 'string' ? FONT_PRESETS.find((preset) => preset.id === font) : undefined
}

function fontStack(font: ThemeConfig['font']): string {
  return typeof font === 'object' ? font.family : (fontPreset(font)?.stack ?? FONT_PRESETS[0].stack)
}

/** Every value a theme produces, in both modes. Partial themes are completed from the default. */
export function resolveTheme(config: Partial<ThemeConfig> = {}): ResolvedTheme {
  const theme = normaliseTheme({ ...DEFAULT_THEME, ...config })
  const base = resolveBase(theme.base, theme.accent)
  const shadows = shadowsFor(theme.style, base.shadowTint)
  return {
    config: theme,
    accent: deriveAccent(theme.accent),
    light: { colors: linesFor(theme.style, base.light), shadows: shadows.light },
    dark: { colors: linesFor(theme.style, base.dark), shadows: shadows.dark },
    radiusScale: radiusScale(theme.radius),
    fontStack: fontStack(theme.font),
  }
}

const DEFAULTS = resolveTheme(DEFAULT_THEME)

/* ------------------------------------------------------------ properties */

type Declarations = [property: string, value: string][]

/** The root hooks for one mode that differ from the defaults. */
function hooksFor(resolved: ResolvedTheme, mode: ResolvedMode): Declarations {
  const out: Declarations = []
  for (const token of BASE_TOKENS) {
    const value = resolved[mode].colors[token]
    if (value !== DEFAULTS[mode].colors[token]) out.push([`--base-${mode}-${token}`, value])
  }
  for (const token of SHADOW_TOKENS) {
    const value = resolved[mode].shadows[token]
    if (value !== DEFAULTS[mode].shadows[token]) out.push([`--style-${mode}-shadow-${token}`, value])
  }
  return out
}

/** Accent, radius and font — the part of a theme that is the same in both modes. */
function sharedFor(resolved: ResolvedTheme): Declarations {
  const out: Declarations = []
  if (resolved.config.accent !== DEFAULTS.config.accent) {
    out.push(
      ['--color-accent', resolved.accent.accent],
      ['--color-accent-strong', resolved.accent.strong],
      ['--color-accent-ink', resolved.accent.ink],
      ['--accent-soft-light', resolved.accent.soft],
    )
  }
  if (resolved.radiusScale !== 1) out.push(['--radius-scale', String(resolved.radiusScale)])
  if (resolved.fontStack !== DEFAULTS.fontStack) out.push(['--font-sans', resolved.fontStack])
  return out
}

/** Every inline property the engine can write on the root, so a new theme clears the last one's. */
const ROOT_PROPERTIES = [
  ...(['light', 'dark'] as const).flatMap((mode) => [
    ...BASE_TOKENS.map((token) => `--base-${mode}-${token}`),
    ...SHADOW_TOKENS.map((token) => `--style-${mode}-shadow-${token}`),
  ]),
  '--radius-scale',
  '--font-sans',
]

/** Every inline property the engine writes on a scoped element. */
const SCOPED_PROPERTIES = [
  ...BASE_TOKENS.map((token) => `--color-${token}`),
  '--color-focus',
  ...SHADOW_TOKENS.flatMap((token) => [`--shadow-${token}`, `--style-shadow-${token}`]),
  ...Object.keys(RADIUS_TOKENS),
  '--radius-scale',
  '--font-sans',
]

const ACCENT_PROPERTIES = [
  '--color-accent',
  '--color-accent-strong',
  '--color-accent-ink',
  '--color-accent-soft',
  '--accent-soft-light',
  '--accent-soft-dark',
]

function writeRoot(node: HTMLElement, resolved: ResolvedTheme) {
  const wanted = new Map([...hooksFor(resolved, 'light'), ...hooksFor(resolved, 'dark')])
  const shared = sharedFor(resolved)
  for (const [property, value] of shared) if (property === '--radius-scale' || property === '--font-sans') wanted.set(property, value)
  for (const property of ROOT_PROPERTIES) {
    const value = wanted.get(property)
    if (value === undefined) node.style.removeProperty(property)
    else node.style.setProperty(property, value)
  }
}

/**
 * A scoped element gets resolved tokens, not hooks. The hooks are read by rules
 * on :root, and a custom property is resolved where it is declared, so a hook
 * set on a <section> would never reach the tokens its children read. The same
 * goes for the radius products and for `font-family`, which the body resolved
 * long before this element existed.
 */
function writeScoped(node: HTMLElement, resolved: ResolvedTheme) {
  const tokens = resolved[resolveMode(currentMode())]
  const scale = resolved.radiusScale
  for (const token of BASE_TOKENS) node.style.setProperty(`--color-${token}`, tokens.colors[token])
  node.style.setProperty('--color-focus', 'var(--color-ink)')
  for (const token of SHADOW_TOKENS) {
    node.style.setProperty(`--shadow-${token}`, tokens.shadows[token])
    node.style.setProperty(`--style-shadow-${token}`, tokens.shadows[token])
  }
  for (const [property, value] of Object.entries(RADIUS_TOKENS)) {
    node.style.setProperty(property, `calc(${value} * ${scale})`)
  }
  node.style.setProperty('--radius-scale', String(scale))
  node.style.setProperty('--font-sans', resolved.fontStack)
  node.style.fontFamily = 'var(--font-sans)'
  node.style.color = 'var(--color-ink)'
}

/* ------------------------------------------------------------ application */

const THEME_EVENT = 'klyv:themechange'
const STORAGE_KEY = 'klyv:theme'
const LEGACY_ACCENT_KEY = 'klyv:accent'

let rootTheme: ThemeConfig = DEFAULT_THEME
const scopedThemes = new WeakMap<HTMLElement, ThemeConfig>()
// Set while applyTheme calls applyAccent, so onThemeChange reports the theme
// change once rather than once for the accent and again for the theme.
let applying = false

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement
}

/**
 * The theme on the page. The accent is read back off the document, so a call
 * to applyAccent made outside the theme engine still shows up here.
 */
export function currentTheme(): ThemeConfig {
  const accent = normaliseHex(currentAccent())
  return accent ? { ...rootTheme, accent } : rootTheme
}

/**
 * Puts a theme on the page, or on one element.
 *
 * Partial themes merge with the one in force: on the root, the page's; on an
 * element, whatever was last applied to it, or the page's. The accent goes
 * through applyAccent, so everything that follows it keeps working.
 *
 * On the root both modes are written at once and the stylesheet picks one, so
 * a switch between light and dark needs nothing reapplied. A scoped element
 * gets the values for the mode in force, and has to be reapplied when the mode
 * changes — ThemeScope does that for you.
 *
 * Returns the complete theme that was applied.
 */
export function applyTheme(config: Partial<ThemeConfig>, target?: HTMLElement): ThemeConfig {
  const root = rootElement()
  const node = target ?? root
  const scoped = Boolean(node && node !== root)
  const previous = (scoped && node && scopedThemes.get(node)) || currentTheme()
  const theme = normaliseTheme({ ...previous, ...config })

  if (!node) {
    rootTheme = theme
    return theme
  }

  const resolved = resolveTheme(theme)
  applying = true
  try {
    applyAccent(theme.accent, node)
  } finally {
    applying = false
  }

  if (scoped) {
    writeScoped(node, resolved)
    scopedThemes.set(node, theme)
    return theme
  }

  writeRoot(node, resolved)
  rootTheme = theme
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
  return theme
}

/**
 * Back to the default. On the root that is the stylesheet's own values, with
 * every inline property the engine wrote removed. On an element it removes the
 * scope entirely, so the element goes back to following the page.
 */
export function resetTheme(target?: HTMLElement): ThemeConfig {
  const root = rootElement()
  const node = target ?? root
  if (!node) {
    rootTheme = DEFAULT_THEME
    return DEFAULT_THEME
  }

  if (node !== root) {
    for (const property of [...SCOPED_PROPERTIES, ...ACCENT_PROPERTIES]) node.style.removeProperty(property)
    node.style.removeProperty('font-family')
    node.style.removeProperty('color')
    scopedThemes.delete(node)
    return currentTheme()
  }

  const theme = applyTheme(DEFAULT_THEME)
  // The default accent's values are the stylesheet's; leaving them inline
  // would only be noise in the inspector.
  for (const property of ACCENT_PROPERTIES) node.style.removeProperty(property)
  return theme
}

/**
 * Calls back whenever the page's theme changes — through applyTheme, or
 * through applyAccent on its own. Returns the unsubscribe function.
 */
export function onThemeChange(listener: (theme: ThemeConfig) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => listener((event as CustomEvent<ThemeConfig>).detail)
  window.addEventListener(THEME_EVENT, handler)
  const offAccent = onAccentChange(() => {
    if (!applying) listener(currentTheme())
  })
  return () => {
    window.removeEventListener(THEME_EVENT, handler)
    offAccent()
  }
}

/** Remember a theme across reloads. Defaults to the one on the page. */
export function saveTheme(theme: Partial<ThemeConfig> = currentTheme()): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeTheme(theme))
  } catch {
    // Private mode, or storage disabled. The theme still applies for this session.
  }
}

/**
 * Re-apply the saved theme. Call it once, before the first paint.
 *
 * An accent saved by saveAccent, from before there was a theme, is folded in
 * and moved to the theme's key, so upgrading keeps a reader's colour.
 * Returns the theme applied, or null when nothing was saved.
 */
export function restoreTheme(): ThemeConfig | null {
  try {
    const saved = parseTheme(window.localStorage.getItem(STORAGE_KEY) ?? '')
    const legacy = normaliseHex(window.localStorage.getItem(LEGACY_ACCENT_KEY) ?? '')
    if (!saved && !legacy) return null

    const theme = applyTheme({ ...(saved ?? {}), ...(legacy ? { accent: legacy } : {}) })
    if (legacy) {
      window.localStorage.setItem(STORAGE_KEY, serializeTheme(theme))
      window.localStorage.removeItem(LEGACY_ACCENT_KEY)
    }
    return theme
  } catch {
    // Nothing saved, or no storage. The tokens' own values stand.
    return null
  }
}

/* ------------------------------------------------------------------ fonts */

/**
 * The Google Fonts stylesheet for a font, or null for one that is not served
 * there (the system stack, or a custom family). The library never loads it on
 * its own; link it yourself, or call loadFont.
 */
export function fontStylesheetUrl(font: FontId | FontPreset | ThemeConfig['font']): string | null {
  const preset = typeof font === 'object' && 'id' in font ? font : fontPreset(font as ThemeConfig['font'])
  if (!preset?.googleFamily) return null
  const family = preset.googleFamily.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${preset.weights.join(';')}&display=swap`
}

/**
 * Adds the font's stylesheet to the document head, once. Opt-in: nothing in
 * the library calls it, because a network request is the app's decision.
 * Returns the link element, or null when there is nothing to load.
 */
export function loadFont(font: FontId | FontPreset | ThemeConfig['font']): HTMLLinkElement | null {
  const url = fontStylesheetUrl(font)
  if (!url || typeof document === 'undefined') return null
  const existing = [...document.head.querySelectorAll<HTMLLinkElement>('link[data-klyv-font]')].find(
    (link) => link.href === url,
  )
  if (existing) return existing
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.dataset.klyvFont = ''
  document.head.appendChild(link)
  return link
}

/* ------------------------------------------------------------------ export */

/**
 * The theme as CSS to paste into a stylesheet — no runtime needed.
 *
 * It sets only what differs from the default, through the same hooks
 * applyTheme writes, so it works whichever order it lands in relative to the
 * library's own stylesheet. The blocks mirror tokens.css: light values on
 * :root, dark ones under the media query and under the explicit attribute.
 */
export function themeToCss(config: Partial<ThemeConfig>): string {
  const resolved = resolveTheme(config)
  const theme = resolved.config
  const light = [...sharedFor(resolved), ...hooksFor(resolved, 'light')]
  const dark = hooksFor(resolved, 'dark')
  if (theme.accent !== DEFAULTS.config.accent) dark.unshift(['--accent-soft-dark', resolved.accent.softDark])

  const block = (selector: string, declarations: Declarations, indent = '') =>
    [
      `${indent}${selector} {`,
      ...declarations.map(([property, value]) => `${indent}  ${property}: ${value};`),
      `${indent}}`,
    ].join('\n')

  const lines = [`/* Klyv theme ${serializeTheme(theme)}, from themeToCss(). */`]
  const url = fontStylesheetUrl(theme.font)
  if (url) lines.push(`/* The font is not bundled. Load it in your <head>, or with:\n   @import url('${url}'); */`)
  if (light.length === 0 && dark.length === 0) {
    lines.push('/* This is the default theme: nothing to override. */')
    return `${lines.join('\n')}\n`
  }
  if (light.length) lines.push(block(':root', light))
  if (dark.length) {
    lines.push(
      `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme='light'])", dark, '  ')}\n}`,
      block(":root[data-theme='dark']", dark),
    )
  }
  return `${lines.join('\n\n')}\n`
}

/* ------------------------------------------------------------ share links */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

/**
 * A theme as a short URL-safe string, for a share link:
 * `accent.base.radius.font.style`, e.g. `8b5cf6.zinc.lg.geist.elevated`.
 * A custom base is `h<hue>c<chroma × 10⁴>`, a custom radius `x<scale × 100>`,
 * and a custom font `f` followed by its stack in base64url.
 */
export function serializeTheme(config: Partial<ThemeConfig>): string {
  const theme = normaliseTheme({ ...DEFAULT_THEME, ...config })
  const base = typeof theme.base === 'object' ? `h${Math.round(theme.base.hue)}c${Math.round(theme.base.chroma * 1e4)}` : theme.base
  const radius = typeof theme.radius === 'number' ? `x${Math.round(theme.radius * 100)}` : theme.radius
  const font = typeof theme.font === 'object' ? `f${toBase64Url(theme.font.family)}` : theme.font
  return [theme.accent.slice(1), base, radius, font, theme.style].join('.')
}

/** The theme a serializeTheme string describes, or null if it is not one. */
export function parseTheme(input: string): ThemeConfig | null {
  const parts = input.trim().split('.')
  if (parts.length !== 5) return null
  const [accentPart, basePart, radiusPart, fontPart, stylePart] = parts

  const accent = /^[0-9a-f]{6}$/i.test(accentPart) ? `#${accentPart.toLowerCase()}` : null

  let base: ThemeConfig['base'] | null = null
  const custom = /^h(\d{1,3})c(\d{1,4})$/.exec(basePart)
  if (isId(BASE_PRESETS, basePart)) base = basePart
  else if (custom) base = { hue: Number(custom[1]) % 360, chroma: Math.min(MAX_BASE_CHROMA, Number(custom[2]) / 1e4) }

  let radius: ThemeConfig['radius'] | null = null
  const scale = /^x(\d{1,3})$/.exec(radiusPart)
  if (isId(RADIUS_PRESETS, radiusPart)) radius = radiusPart
  else if (scale) radius = Math.min(3, Number(scale[1]) / 100)

  let font: ThemeConfig['font'] | null = null
  if (isId(FONT_PRESETS, fontPart)) font = fontPart
  else if (/^f[A-Za-z0-9_-]+$/.test(fontPart)) {
    try {
      const family = fromBase64Url(fontPart.slice(1)).trim()
      if (family) font = { family }
    } catch {
      font = null
    }
  }

  const style = isId(STYLE_PRESETS, stylePart) ? stylePart : null
  if (!accent || base === null || radius === null || !font || !style) return null
  return { accent, base, radius, font, style }
}
