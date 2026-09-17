'use client'

import { useEffect, useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from './layout-effect'

/**
 * One stack for every overlay on the page.
 *
 * Each overlay used to answer three questions on its own — is the page locked,
 * did Escape mean me, which layer am I on — and three independent answers do
 * not compose:
 *
 * - Scroll lock was saved and restored per component, so a dialog opened from
 *   inside another dialog restored `hidden` after the outer one had restored
 *   `''`, and the page could never scroll again.
 * - Escape was a `document` listener per component, so one press closed the
 *   whole stack: the select, the dialog behind it, and the drawer behind that.
 * - The layer was a fixed token, and `--z-popover` sat below `--z-overlay`, so
 *   a Select opened inside a Modal rendered behind it.
 *
 * The stack answers all three from one place: the last overlay to open is the
 * one Escape talks to, the one that sits highest, and the one whose close
 * restores scrolling.
 */

export type OverlayKind = 'dialog' | 'popover'

interface Layer {
  kind: OverlayKind
  zIndex: number
  dismissible: () => boolean
  dismiss: () => void
  /** Told whenever it becomes, or stops being, the front layer. */
  setTop: (top: boolean) => void
}

/** Open overlays, oldest first. The last entry is the one in front. */
const stack: Layer[] = []

/**
 * Where the layers start. Matches `--z-overlay`. Each layer opened while
 * another is up sits one above the highest, so stacking follows the order
 * things were opened in rather than a fixed guess about which kind of overlay
 * outranks which.
 */
export const OVERLAY_BASE_Z = 50

function announceTop() {
  const top = stack[stack.length - 1]
  for (const layer of stack) layer.setTop(layer === top)
}

/* -------------------------------------------------------------------------- */
/* Escape                                                                      */
/* -------------------------------------------------------------------------- */

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const top = stack[stack.length - 1]
  if (!top?.dismissible()) return

  // Only the front layer closes, and it marks the event handled, so nothing
  // else acting on the same press closes a second one. A control inside an
  // overlay that wants Escape for itself — a combobox closing its list — calls
  // `preventDefault()` first and this stands down.
  event.preventDefault()
  top.dismiss()
}

/* -------------------------------------------------------------------------- */
/* Scroll lock                                                                 */
/* -------------------------------------------------------------------------- */

let locks = 0
let restoreOverflow = ''

/**
 * Holds the page still while `active`, counted across every overlay.
 *
 * The count is what matters: the page is only released when the last thing
 * holding it lets go, and the value restored is the one the page had before
 * any overlay touched it — not whatever the previous overlay left behind.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    if (locks === 0) {
      restoreOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    locks += 1
    return () => {
      locks -= 1
      if (locks === 0) document.body.style.overflow = restoreOverflow
    }
  }, [active])
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                      */
/* -------------------------------------------------------------------------- */

export interface OverlayLayerOptions {
  /** Whether this overlay is on the page right now. */
  open: boolean
  /** Called when Escape reaches this layer — only ever while it is in front. */
  onDismiss?: () => void
  /** A dialog that forces a choice passes false: it stays put on Escape. */
  dismissible?: boolean
  /** `dialog` holds the page still; `popover` leaves it scrolling. */
  kind?: OverlayKind
}

export interface OverlayLayer {
  /** This layer's place in the stack. Apply it as a style, not a class. */
  zIndex: number
  /** True while nothing opened later is still up. Outside-click wants this. */
  isTop: boolean
}

/**
 * Registers an open overlay on the shared stack.
 *
 * The layer is claimed in a layout effect, so its z-index is in place before
 * the browser paints rather than a frame later.
 */
export function useOverlayLayer({
  open,
  onDismiss,
  dismissible = true,
  kind = 'dialog',
}: OverlayLayerOptions): OverlayLayer {
  const [layer, setLayer] = useState<OverlayLayer>({ zIndex: OVERLAY_BASE_Z, isTop: true })

  // Read at the moment Escape is pressed, so the stack calls the handler from
  // the latest render — not the one that happened to open the overlay.
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible

  useScrollLock(open && kind === 'dialog')

  useIsomorphicLayoutEffect(() => {
    if (!open) return

    const zIndex = stack.length ? Math.max(...stack.map((other) => other.zIndex)) + 1 : OVERLAY_BASE_Z
    const entry: Layer = {
      kind,
      zIndex,
      dismissible: () => dismissibleRef.current,
      dismiss: () => dismissRef.current?.(),
      setTop: (top) => setLayer((current) => (current.isTop === top ? current : { ...current, isTop: top })),
    }

    if (stack.length === 0) document.addEventListener('keydown', onDocumentKeyDown)
    stack.push(entry)
    announceTop()
    setLayer({ zIndex, isTop: true })

    return () => {
      const index = stack.indexOf(entry)
      if (index !== -1) stack.splice(index, 1)
      if (stack.length === 0) document.removeEventListener('keydown', onDocumentKeyDown)
      announceTop()
    }
  }, [open, kind])

  return layer
}

/** How many overlays are up. For tests; components should not need it. */
export function openOverlayCount() {
  return stack.length
}
