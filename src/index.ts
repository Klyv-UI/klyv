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
  BASE_BACKGROUNDS,
  BASE_CONTRAST,
  BASE_PRESETS,
  BASE_TOKENS,
  DEFAULT_THEME,
  FONT_PRESETS,
  MAX_BASE_CHROMA,
  RADIUS_PRESETS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  STYLE_PRESETS,
  THEME_PRESETS,
  applyAccent,
  applyMode,
  applyTheme,
  contrastRatio,
  currentAccent,
  currentMode,
  currentTheme,
  deriveAccent,
  deriveBase,
  fontStylesheetUrl,
  loadFont,
  onAccentChange,
  onModeChange,
  onThemeChange,
  parseTheme,
  resetTheme,
  resolveBase,
  resolveMode,
  resolveTheme,
  restoreAccent,
  restoreMode,
  restoreTheme,
  saveAccent,
  saveMode,
  saveTheme,
  savedMode,
  serializeTheme,
  systemMode,
  themeToCss,
  watchSystemMode,
} from './theme'
export type {
  AccentFamily,
  AccentPreset,
  BaseFamily,
  BaseId,
  BasePreset,
  BaseToken,
  BaseTokens,
  FontId,
  FontPreset,
  RadiusId,
  RadiusPreset,
  ResolvedMode,
  ResolvedTheme,
  ShadowSet,
  ShadowToken,
  StyleId,
  StylePreset,
  ThemeConfig,
  ThemeMode,
  ThemeModeTokens,
  ThemePreset,
} from './theme'
