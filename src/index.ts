/**
 * Klyv — the public API.
 *
 * Everything a consumer needs comes from this one entry point: the components,
 * the class merger they are built on, the token registry, and the runtime
 * theming call that repaints the whole set from a single hue.
 */
export * from './components'

export { cn } from './lib/cn'
export type { IconComponent, ControlSize } from './lib/types'

export { tokenGroups, resolveToken } from './tokens'
export type { TokenEntry, TokenGroup } from './tokens'

export {
  ACCENT_PRESETS,
  applyAccent,
  applyMode,
  contrastRatio,
  currentAccent,
  currentMode,
  deriveAccent,
  onAccentChange,
  onModeChange,
  resolveMode,
  restoreAccent,
  restoreMode,
  saveAccent,
  saveMode,
  savedMode,
  systemMode,
  watchSystemMode,
} from './theme'
export type { AccentFamily, AccentPreset, ResolvedMode, ThemeMode } from './theme'
