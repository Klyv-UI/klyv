import { useMemo, useSyncExternalStore } from 'react'
import {
  DEFAULT_THEME,
  currentTheme,
  fontStylesheetUrl,
  loadFont,
  onThemeChange,
  parseTheme,
  resetTheme,
  saveTheme,
  serializeTheme,
  applyTheme,
  type ThemeConfig,
} from 'klyv'

/**
 * The site's side of the theme engine: one way to change the theme, and the
 * copy of it the boot script in index.html reads before anything else runs.
 *
 * Every control on the site — the header's accent menu, the landing page's
 * swatches, the Themes page — goes through `setSiteTheme`, so a choice made in
 * one place is applied, saved and shown by all the others.
 */

/**
 * Where the resolved theme is kept for the boot script. saveTheme stores five
 * choices (`8b5cf6.zinc.lg.geist.elevated`), and turning a base colour into
 * its fourteen neutrals takes the engine's OKLCH maths — which the inline
 * script cannot carry. So the site stores the custom properties the engine
 * wrote, keyed to the string they came from, and the script writes them back
 * as they are.
 */
export const BOOT_KEY = 'klyv-site:theme-boot'

/** The inline properties applyTheme writes on the root. Nothing else is copied. */
const ROOT_PROPERTY = /^--(base-|style-|radius-scale$|font-sans$|color-accent|accent-soft-)/

interface BootSnapshot {
  /** The serializeTheme string these properties belong to. */
  theme: string
  props: [string, string][]
  /** The font stylesheet to link, when the font is not bundled. */
  font: string | null
}

/** Copies what the engine wrote on the root into storage, for index.html. */
export function writeBootSnapshot(): void {
  if (typeof document === 'undefined') return
  try {
    const theme = currentTheme()
    const serialized = serializeTheme(theme)
    if (serialized === serializeTheme(DEFAULT_THEME)) {
      window.localStorage.removeItem(BOOT_KEY)
      return
    }
    const style = document.documentElement.style
    const props: [string, string][] = []
    for (let index = 0; index < style.length; index += 1) {
      const property = style.item(index)
      if (ROOT_PROPERTY.test(property)) props.push([property, style.getPropertyValue(property).trim()])
    }
    const snapshot: BootSnapshot = { theme: serialized, props, font: fontStylesheetUrl(theme.font) }
    window.localStorage.setItem(BOOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage denied. restoreTheme still runs before React's first render.
  }
}

/**
 * Keeps the boot snapshot in step with the page's theme, however it changed.
 * Called once from main.tsx, after restoreTheme.
 */
export function installThemePersistence(): () => void {
  loadFont(currentTheme().font)
  writeBootSnapshot()
  return onThemeChange((theme) => {
    loadFont(theme.font)
    writeBootSnapshot()
  })
}

/** Applies a theme to the whole site and remembers it. Partial themes merge with the current one. */
export function setSiteTheme(config: Partial<ThemeConfig>): ThemeConfig {
  const theme = applyTheme(config)
  loadFont(theme.font)
  saveTheme(theme)
  // Only the root announces; the snapshot listener has already run. Written
  // again here so a save outside that listener's lifetime is still captured.
  writeBootSnapshot()
  return theme
}

/** Back to the library's own theme, on the whole site. */
export function resetSiteTheme(): ThemeConfig {
  const theme = resetTheme()
  saveTheme(theme)
  writeBootSnapshot()
  return theme
}

/** The accent alone — what the header menu and the landing swatches change. */
export function chooseAccent(hex: string): void {
  setSiteTheme({ accent: hex })
}

// A string snapshot: currentTheme() builds a new object on every call, which
// useSyncExternalStore would read as a change on every render.
const snapshot = () => serializeTheme(currentTheme())
const serverSnapshot = () => serializeTheme(DEFAULT_THEME)

/** The site's theme, as React state that follows every change. */
export function useSiteTheme(): ThemeConfig {
  const serialized = useSyncExternalStore(onThemeChange, snapshot, serverSnapshot)
  return useMemo(() => parseTheme(serialized) ?? DEFAULT_THEME, [serialized])
}
