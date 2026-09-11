'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface FocusTrapProps {
  /** Content that keeps focus while the trap is active. */
  children: ReactNode
  /** Turn the trap off without unmounting the subtree. */
  active?: boolean
  /** Return focus to whatever was focused before the trap opened. */
  restoreFocus?: boolean
  /** Move focus inside on mount. */
  autoFocus?: boolean
  /** Merged last, so it wins. */
  className?: string
  /** Inline styles for the wrapper element. */
  style?: React.CSSProperties
}

/**
 * Keeps Tab inside its subtree and restores focus when it closes. Extracted so
 * every dialog, drawer and sheet gets identical, correct behaviour instead of
 * each reimplementing it.
 */
export function FocusTrap({
  children,
  active = true,
  restoreFocus = true,
  autoFocus = true,
  className,
  style,
}: FocusTrapProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    previousRef.current = document.activeElement as HTMLElement | null

    const root = rootRef.current
    if (autoFocus && root) {
      const first = root.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? root).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !rootRef.current) return
      const items = [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => node.offsetParent !== null,
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement

      if (event.shiftKey && (current === first || !rootRef.current.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (restoreFocus) previousRef.current?.focus?.()
    }
  }, [active, autoFocus, restoreFocus])

  return (
    <div ref={rootRef} tabIndex={-1} className={className} style={style}>
      {children}
    </div>
  )
}
