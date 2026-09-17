'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  children: ReactNode
  /** Where to mount. Defaults to document.body. */
  container?: Element | null
}

// Nothing ever changes, so nothing ever needs to be told.
const subscribe = () => () => {}
const onClient = () => true
const onServer = () => false

/**
 * Renders children outside the current DOM position, so an overlay is never
 * clipped by an ancestor overflow or trapped under a stacking context.
 *
 * Two timings matter, and they pull in opposite directions:
 *
 * - **Hydration has to match the server.** The server has no `document` and
 *   renders nothing, so the client's first pass must render nothing too. When
 *   this checked `typeof document` instead, the client portalled on its first
 *   pass, React saw markup the server never sent, and threw the entire page's
 *   server HTML away — which, with ToastProvider in a root layout, meant every
 *   server-rendered page.
 * - **Every other render has to be immediate.** Popover, Tooltip, HoverCard and
 *   Combobox measure the portalled node in an effect straight after it renders.
 *   Mounting in an effect of our own would leave all of them measuring a node
 *   that is not in the document yet.
 *
 * `useSyncExternalStore` gives both. It reads the server snapshot while
 * hydrating — so the first pass matches — and the client snapshot on every
 * other render, including the very first render of a plain client mount.
 */
export function Portal({ children, container }: PortalProps) {
  const client = useSyncExternalStore(subscribe, onClient, onServer)
  if (!client) return null
  const target = container ?? document.body
  return createPortal(children, target)
}
