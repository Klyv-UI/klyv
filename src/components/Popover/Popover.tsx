'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Surface } from '../Surface'
import { Portal } from '../Portal'
import { usePopoverPosition, type PopoverAlign, type PopoverPlacement } from './usePopoverPosition'

export type { PopoverPlacement, PopoverAlign }

export interface PopoverProps {
  /** The element the panel is anchored to. Rendered inline. */
  trigger: ReactNode
  /** The panel contents. */
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Gap between anchor and panel, in pixels. */
  offset?: number
  /** Close when the pointer goes down outside. */
  dismissOnOutsideClick?: boolean
  /** Accessible name for the panel. */
  label?: string
  /** Applied to the panel Surface. */
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A floating panel anchored to a trigger, mounted through a Portal so no
 * ancestor overflow can clip it. It owns open state, outside-click and Escape,
 * plus flip-and-clamp positioning.
 *
 * Menu, Tooltip, HoverCard and Select all build on this rather than each
 * reimplementing the same three behaviours.
 */
export function Popover({
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
  placement = 'bottom',
  align = 'start',
  offset = 8,
  dismissOnOutsideClick = true,
  label,
  className,
}: PopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const open = controlledOpen ?? uncontrolled
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }
  // The document listeners below outlive the render that attached them. They
  // call through this, so a guard in a parent's handler (Select's `disabled`)
  // is read as it is now rather than as it was when the panel opened.
  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  // Escape and the layer come from the shared stack: Escape closes this panel
  // and nothing behind it, and a panel opened inside a Modal sits above it
  // instead of under its scrim.
  const { zIndex, isTop } = useOverlayLayer({ open, onDismiss: () => setOpen(false), kind: 'popover' })

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    panelRef as React.RefObject<HTMLElement>,
    open,
    placement,
    align,
    offset,
  )

  useEffect(() => {
    // Only the front layer closes on an outside press. A panel opened from
    // inside this one is portalled elsewhere in the body, so a click in it is
    // "outside" as far as this panel's DOM is concerned — and used to close both.
    if (!open || !isTop || !dismissOnOutsideClick) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpenRef.current(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, isTop, dismissOnOutsideClick])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const anchor = anchorRef.current

    // Focus goes back to the trigger when the panel closes with focus inside
    // it — choosing a menu item, pressing Escape. Without this the focused
    // item is removed from the page, focus falls to <body>, and inside a Modal
    // the next Tab walks straight out of the focus trap. Focus that has already
    // moved somewhere deliberate (a click on another control) is left alone.
    return () => {
      const active = document.activeElement
      const lost = !active || active === document.body || (panel?.contains(active) ?? false)
      if (!lost || !anchor?.isConnected) return
      const target = anchor.querySelector<HTMLElement>(FOCUSABLE) ?? anchor
      target.focus()
    }
  }, [open])

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </span>
      {open && (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              zIndex,
            }}
            className={cn(position ? 'opacity-100' : 'opacity-0', 'transition-opacity duration-100')}
          >
            <Surface
              variant="floating"
              className={cn('border border-line', className)}
            >
              {children}
            </Surface>
          </div>
        </Portal>
      )}
    </>
  )
}
