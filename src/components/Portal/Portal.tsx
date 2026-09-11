'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  children: ReactNode
  /** Where to mount. Defaults to document.body. */
  container?: Element | null
}

/**
 * Renders children outside the current DOM position, so an overlay is never
 * clipped by an ancestor overflow or trapped under a stacking context.
 *
 * It mounts synchronously rather than waiting for an effect. That matters:
 * anything that measures the portalled node — Popover, Tooltip, HoverCard,
 * Combobox — runs its measurement in an effect immediately after this renders,
 * and a deferred mount would leave every one of them measuring a node that is
 * not in the document yet.
 *
 * `document` is checked rather than assumed, so a server render produces
 * nothing instead of throwing.
 */
export function Portal({ children, container }: PortalProps) {
  const target = container ?? (typeof document === 'undefined' ? null : document.body)
  if (!target) return null
  return createPortal(children, target)
}
