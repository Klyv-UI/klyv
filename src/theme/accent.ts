'use client'

/**
 * Runtime accent theming.
 *
 * The library is built so that one hue does all the emphasis work — every
 * button, pill, focus ring, meter fill and chart series resolves back to
 * `--color-accent` and its three relatives. That makes retheming a matter of
 * writing four custom properties rather than editing a stylesheet, which is
 * the whole reason the tokens were arranged this way in the first place.
 *
 * The three relatives are *derived*, not chosen. Asking anyone to pick four
 * colours that work together is how a theme system produces unreadable
 * buttons; deriving them from one hue means every accent in the picker — and
 * every accent a consumer invents — is guaranteed to hold its contrast.
 */

import { contrastRatio, hexToRgb } from '../lib/contrast'

// Re-exported because this has always been part of the theme's public surface.
export { contrastRatio } from '../lib/contrast'

export interface AccentFamily {
  /** The hue itself. Logos, active pills, primary actions, badges. */
  accent: string
  /** Hover, filled meters, focus ring. */
  strong: string
  /** Tinted backgrounds, on a light page. */
  soft: string
  /** The same tinted background, on a dark one. */
  softDark: string
  /** Text and glyphs sitting *on* the accent. */
  ink: string
}

export interface AccentPreset {
  id: string
  name: string
  hex: string
}

/** The shipped palette. The first is the one the dashboard was measured from. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'volt', name: 'Volt', hex: '#c8f24e' },
  { id: 'ultraviolet', name: 'Ultraviolet', hex: '#8b5cf6' },
  { id: 'signal', name: 'Signal', hex: '#22d3ee' },
  { id: 'ember', name: 'Ember', hex: '#fb923c' },
  { id: 'flamingo', name: 'Flamingo', hex: '#f472b6' },
  { id: 'kelp', name: 'Kelp', hex: '#10b981' },
  { id: 'cobalt', name: 'Cobalt', hex: '#3b82f6' },
  { id: 'saffron', name: 'Saffron', hex: '#facc15' },
  { id: 'coral', name: 'Coral', hex: '#f43f5e' },
  { id: 'graphite', name: 'Graphite', hex: '#64748b' },
]

/* ------------------------------------------------------------------ maths */

interface Hsl {
  h: number
  s: number
  l: number
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: lightness }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue: number
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
  else if (max === green) hue = ((blue - red) / delta + 2) / 6
  else hue = ((red - green) / delta + 4) / 6

  return { h: hue, s: saturation, l: lightness }
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255)

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }

  return rgbToHex(channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255)
}

/* ------------------------------------------------------------ derivation */

/**
 * The other three colours, from one.
 *
 * `strong` moves *away* from the middle rather than always darkening: a pale
 * accent gets darker on hover and a deep one gets lighter, so the emphasis
 * step is visible either way. `soft` is pinned bright regardless of the input,
 * because it is a background that text has to sit on, and `softDark` is its
 * counterpart for a dark page. And `ink` is chosen by contrast against both the
 * accent and `strong` — the pair a label actually sits on as a button hovers —
 * which is why a violet gets a label it can carry and a lime gets near-black
 * without anybody configuring either.
 */
export function deriveAccent(hex: string): AccentFamily {
  const [r, g, b] = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)

  const soft = hslToHex({ h, s: Math.min(0.9, Math.max(0.25, s * 0.85)), l: 0.9 })

  // The same wash for a dark page. A 90%-light tint on a near-black surface is
  // a glare rather than a background, so the dark theme gets its own value
  // instead of reusing one and hoping.
  const softDark = hslToHex({ h, s: Math.min(0.7, Math.max(0.2, s * 0.6)), l: 0.19 })

  // The label colour is chosen by contrast, not by a luminance cut-off. A fixed
  // threshold (this used 0.45) hands white labels to bright oranges and greens,
  // where they read at barely 2:1. Preference order: the tinted near-black,
  // which looks deliberate; then white; then whichever of pure black or pure
  // white is stronger.
  //
  // That last step is a guarantee, not a hope — for any colour at all, one of
  // the two reaches at least 4.58:1, because the two ratios cross at a
  // luminance of 0.179.
  const tinted = hslToHex({ h, s: Math.min(0.6, s), l: 0.09 })
  const ink =
    contrastRatio(tinted, hex) >= 4.5
      ? tinted
      : contrastRatio('#ffffff', hex) >= 4.5
        ? '#ffffff'
        : contrastRatio('#000000', hex) >= contrastRatio('#ffffff', hex)
          ? '#000000'
          : '#ffffff'

  // `strong` is the emphasis step, and it is derived *after* the label, because
  // the label has to survive it: `bg-accent text-accent-ink hover:bg-accent-strong`
  // keeps the text while the fill moves underneath it. The step heads toward the
  // middle — a pale accent darkens, a deep one lightens — which for a mid-tone
  // accent walks the fill across the luminance where black and white trade
  // places and strands the label at 3.3:1. So it walks back toward the accent
  // until the label clears 4.5 again, which always terminates: at the accent
  // itself the label is the one chosen for it.
  // The walk is steered by the label, not by the accent: a dark label wants a
  // lighter fill and a light one wants a darker fill, so stepping that way
  // always converges rather than stalling a hair short at the accent's own
  // lightness.
  const saturated = Math.min(1, s * 1.05)
  const inkIsDark = contrastRatio(ink, '#ffffff') > contrastRatio(ink, '#000000')
  const rescue = inkIsDark ? 0.01 : -0.01
  let strongL = l > 0.5 ? Math.max(0.12, l - 0.07) : Math.min(0.92, l + 0.09)
  let strong = hslToHex({ h, s: saturated, l: strongL })
  while (contrastRatio(ink, strong) < 4.5 && strongL > 0.02 && strongL < 0.98) {
    strongL += rescue
    strong = hslToHex({ h, s: saturated, l: strongL })
  }

  // A lightness step that had to be given up leaves a hover nobody can see, so
  // what is left of it becomes saturation instead — but only while that keeps
  // the label, since saturation moves luminance too.
  if (Math.abs(strongL - l) < 0.03) {
    const vivid = hslToHex({ h, s: Math.min(1, Math.max(s * 1.3, s + 0.18)), l: strongL })
    if (contrastRatio(ink, vivid) >= 4.5) strong = vivid
  }

  return { accent: hex, strong, soft, softDark, ink }
}

/* ------------------------------------------------------------ application */

/** Whether the page is currently rendering dark, explicitly or by preference. */
function prefersDark(): boolean {
  if (typeof document === 'undefined') return false
  const explicit = document.documentElement.dataset.theme
  if (explicit === 'dark') return true
  if (explicit === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

const STORAGE_KEY = 'klyv:accent'
const ACCENT_EVENT = 'klyv:accentchange'

/**
 * Calls back whenever the document's accent changes, from anywhere.
 * Returns the unsubscribe function.
 */
export function onAccentChange(listener: (family: AccentFamily) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => listener((event as CustomEvent<AccentFamily>).detail)
  window.addEventListener(ACCENT_EVENT, handler)
  return () => window.removeEventListener(ACCENT_EVENT, handler)
}

/**
 * Writes the family onto an element as inline custom properties.
 *
 * Inline styles outrank the `:root` rule the tokens are defined in, so this
 * overrides them without a stylesheet edit, a rebuild, or a class on the body.
 * Passing an element rather than always using the root is what makes a scoped
 * theme — one section on a different accent — possible at all.
 */
export function applyAccent(hex: string, target?: HTMLElement): AccentFamily {
  const family = deriveAccent(hex)
  const node = target ?? (typeof document === 'undefined' ? null : document.documentElement)
  if (!node) return family

  node.style.setProperty('--color-accent', family.accent)
  node.style.setProperty('--color-accent-strong', family.strong)
  node.style.setProperty('--color-accent-ink', family.ink)

  // The wash is the one value that differs between light and dark.
  if (node === document.documentElement) {
    // On the root, both washes are written and the stylesheet picks one, so the
    // page follows the theme by itself. Writing the resolved wash inline — as
    // this used to — outranked the stylesheet's dark block: when the system
    // flipped to dark without an app-level listener, the light wash stayed,
    // and text on selected rows and accent tags fell to about 1.1:1.
    node.style.removeProperty('--color-accent-soft')
    node.style.setProperty('--accent-soft-light', family.soft)
    node.style.setProperty('--accent-soft-dark', family.softDark)
  } else {
    // A scoped accent cannot use the pair: the stylesheet resolves
    // `--color-accent-soft` on :root, which never sees this element's
    // properties. It takes the wash for the theme in force, and is re-applied
    // on a mode change like before.
    node.style.setProperty('--color-accent-soft', prefersDark() ? family.softDark : family.soft)
  }

  // Announce root-level changes, so every control showing the accent can
  // follow — not only the one that made the change. Scoped accents stay quiet:
  // they recolour one subtree and nothing global has changed.
  if (typeof window !== 'undefined' && node === document.documentElement) {
    window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: family }))
  }
  return family
}

/** The accent currently in force, read back off the document. */
export function currentAccent(): string {
  if (typeof document === 'undefined') return ACCENT_PRESETS[0].hex
  const inline = document.documentElement.style.getPropertyValue('--color-accent').trim()
  if (inline) return inline
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
    ACCENT_PRESETS[0].hex
}

/** Remember a choice across reloads. */
export function saveAccent(hex: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, hex)
  } catch {
    // Private mode, or storage disabled. The accent still applies for this session.
  }
}

/**
 * Re-apply the saved accent. Call it once, before the first paint, so a
 * remembered theme never flashes the default first.
 */
export function restoreAccent(): void {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) applyAccent(saved)
  } catch {
    // Nothing saved, or no storage. The tokens' own values stand.
  }
}
