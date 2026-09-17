import { useSyncExternalStore } from 'react'
import {
  currentAccent,
  currentMode,
  onAccentChange,
  onModeChange,
  watchSystemMode,
  type ThemeMode,
} from 'klyv'

/**
 * The applied accent and mode, as React state that every picker shares.
 *
 * Each picker used to keep its own copy, so choosing a hue in the hero left
 * the theming section and the header describing the previous one. The
 * document is the source of truth; these read it, and re-read it whenever the
 * library announces a change.
 */
export function useAccent(): string {
  return useSyncExternalStore(onAccentChange, currentAccent, () => '#c8f24e')
}

// One system-preference listener for the whole page, however many toggles are
// mounted: it re-derives the accent's wash when the machine flips while the
// page is following it.
function subscribeMode(listener: () => void) {
  const stopMode = onModeChange(listener)
  const stopSystem = watchSystemMode(listener)
  return () => {
    stopMode()
    stopSystem()
  }
}

export function useMode(): ThemeMode {
  return useSyncExternalStore(subscribeMode, currentMode, () => 'system')
}
