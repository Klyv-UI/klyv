'use client'

import { useCallback, useRef, useState, type KeyboardEvent } from 'react'

/**
 * Arrow-key movement through a vertical list where exactly one item is in the
 * tab order — the workspace list, the account menu.
 *
 * The active index is clamped on read rather than reset on change, so filtering
 * a list down to two items never leaves focus pointing at the ninth.
 */
export function useRovingFocus(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [rawActive, setActive] = useState(0)
  const active = count === 0 ? -1 : Math.min(rawActive, count - 1)

  const focus = useCallback(
    (index: number) => {
      if (count === 0) return
      const next = (index + count) % count
      setActive(next)
      // The list usually lives in a popover that is parked off-screen until it
      // has been measured; focusing must not scroll anything towards it.
      refs.current[next]?.focus({ preventScroll: true })
    },
    [count],
  )

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => focus(active + 1),
      ArrowUp: () => focus(active - 1),
      Home: () => focus(0),
      End: () => focus(count - 1),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const register = (index: number) => (node: HTMLElement | null) => {
    refs.current[index] = node
  }

  return { active, setActive, focus, onKeyDown, register }
}
