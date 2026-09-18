'use client'

import { forwardRef, useRef, type HTMLAttributes } from 'react'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { applyTheme, currentTheme, onModeChange, onThemeChange, type ThemeConfig } from '../../theme'

export interface ThemeScopeProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What differs inside this section: any of `accent`, `base`, `radius`, `font`
   * and `style`. Everything left out follows the page's theme, and keeps
   * following it when the page's theme changes.
   */
  theme: Partial<ThemeConfig>
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * A section on a theme of its own: a marketing block on a different accent, a
 * preview pane in a theme customiser, an embedded widget that has to match its
 * host.
 *
 * It exists because a scoped theme cannot lean on the stylesheet the way the
 * page does. The page writes both modes once and lets tokens.css pick; those
 * rules run on :root and never see a <div>'s properties, so a scope gets the
 * resolved values for the mode in force and has to be written again whenever
 * the mode flips — or whenever the page's own theme changes underneath the
 * parts it inherits. This component owns those three subscriptions so no
 * caller has to remember them.
 *
 * It sets text colour and font on itself but paints no background; give it
 * one (`bg-app`, `bg-surface`) when the base colour should show.
 */
export const ThemeScope = forwardRef<HTMLDivElement, ThemeScopeProps>(function ThemeScope(
  { theme, children, ...rest },
  ref,
) {
  const node = useRef<HTMLDivElement | null>(null)
  // The prop is usually an object literal, new on every render; its content is
  // what decides whether anything needs writing again.
  const key = JSON.stringify(theme)

  useIsomorphicLayoutEffect(() => {
    const element = node.current
    if (!element) return
    const partial = JSON.parse(key) as Partial<ThemeConfig>
    const apply = () => {
      applyTheme({ ...currentTheme(), ...partial }, element)
    }
    apply()

    const offMode = onModeChange(apply)
    const offTheme = onThemeChange(apply)
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
    query?.addEventListener('change', apply)
    return () => {
      offMode()
      offTheme()
      query?.removeEventListener('change', apply)
    }
  }, [key])

  return (
    <div
      {...rest}
      ref={(element) => {
        node.current = element
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      data-theme-scope=""
    >
      {children}
    </div>
  )
})
