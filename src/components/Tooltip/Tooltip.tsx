'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Portal } from '../Portal'
import { usePopoverPosition, type PopoverAlign, type PopoverPlacement } from '../Popover/usePopoverPosition'

export interface TooltipProps {
  /** The element the tip describes. */
  children: ReactNode
  /** Tip text. Keep it to a short phrase. */
  content: ReactNode
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Delay before showing, in milliseconds. Hiding is immediate. */
  delay?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A short description shown on hover or focus. It is wired with
 * aria-describedby rather than aria-label, so it supplements the control name
 * instead of replacing it — a tooltip must never be the only label.
 *
 * It appears on keyboard focus as well as hover, and dismisses on Escape.
 */
export function Tooltip({
  children,
  content,
  placement = 'top',
  align = 'center',
  delay = 250,
  disabled = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const id = useId()

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    tipRef as React.RefObject<HTMLElement>,
    open,
    placement,
    align,
    6,
  )

  const show = () => {
    if (disabled) return
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    window.clearTimeout(timerRef.current)
    setOpen(false)
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!open) return
    // Capture phase, and marked handled: a tooltip inside a Modal is in front of
    // it, so Escape dismisses the tooltip and the overlay stack, seeing the
    // press already handled, leaves the Modal open. In the bubble phase this
    // ran after the stack had already closed the dialog.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      hide()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  return (
    <>
      <span
        ref={anchorRef}
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {open && (
        <Portal>
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              zIndex: 'var(--z-tooltip)' as unknown as number,
            }}
            className={cn(
              'pointer-events-none max-w-[240px] rounded-[var(--radius-10)] bg-ink px-2.5 py-1.5',
              'text-[11px] font-semibold leading-tight text-ink-inverse shadow-[var(--shadow-float)]',
              position ? 'opacity-100' : 'opacity-0',
              className,
            )}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  )
}
