'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Portal } from '../Portal'
import { usePopoverPosition, type PopoverAlign, type PopoverPlacement } from '../Popover/usePopoverPosition'

export interface HoverCardProps {
  /** The element that reveals the card. */
  children: ReactNode
  /** Card contents. Richer than a Tooltip: headings, avatars, actions. */
  content: ReactNode
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Delay before opening. */
  openDelay?: number
  /** Grace period before closing, so the pointer can travel to the card. */
  closeDelay?: number
  /** Accessible name for the card. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A rich preview on hover intent. Unlike Tooltip its content is interactive and
 * can be pointed at, which is why it has a close delay: without one, the card
 * vanishes the moment the pointer leaves the trigger to reach it.
 *
 * Everything inside must also be reachable another way — hover is not an
 * interaction a keyboard or touch user has.
 */
export function HoverCard({
  children,
  content,
  placement = 'bottom',
  align = 'start',
  openDelay = 300,
  closeDelay = 180,
  label,
  className,
}: HoverCardProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    cardRef as React.RefObject<HTMLElement>,
    open,
    placement,
    align,
    8,
  )

  const schedule = (next: boolean) => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(next), next ? openDelay : closeDelay)
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!open) return
    // Capture phase, and marked handled: a hover card inside a Modal is in front of
    // it, so Escape dismisses the card and the overlay stack, seeing the
    // press already handled, leaves the Modal open. In the bubble phase this
    // ran after the stack had already closed the dialog.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  return (
    <>
      <span
        ref={anchorRef}
        onPointerEnter={() => schedule(true)}
        onPointerLeave={() => schedule(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => schedule(false)}
        className="inline-flex"
      >
        {children}
      </span>
      {open && (
        <Portal>
          <div
            ref={cardRef}
            role="dialog"
            aria-label={label}
            onPointerEnter={() => window.clearTimeout(timerRef.current)}
            onPointerLeave={() => schedule(false)}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              zIndex: 'var(--z-tooltip)' as unknown as number,
            }}
            className={position ? 'opacity-100' : 'opacity-0'}
          >
            <Surface
              variant="floating"
              padding="md"
              className={cn('w-[260px] border border-line', className)}
            >
              {content}
            </Surface>
          </div>
        </Portal>
      )}
    </>
  )
}
