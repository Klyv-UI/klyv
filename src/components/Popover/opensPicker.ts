import type { KeyboardEvent } from 'react'

/**
 * The keys that open a picker from its field, as a native select does. The
 * field is read-only and opened on click, and a click is not what Enter or
 * Space send to an input — so from the keyboard it could not be opened at all,
 * and Enter submitted the surrounding form instead.
 */
export function opensPicker(event: KeyboardEvent<HTMLInputElement>): boolean {
  const opens = event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp'
  if (opens) event.preventDefault()
  return opens
}
