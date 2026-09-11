'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
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

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    panelRef as React.RefObject<HTMLElement>,
    open,
    placement,
    align,
    offset,
  )

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!dismissOnOutsideClick) return
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, dismissOnOutsideClick])

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
              zIndex: 'var(--z-popover)' as unknown as number,
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
