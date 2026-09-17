'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'

export interface ToggletipProps {
  /** What the bubble explains. Can hold links and formatting. */
  children: ReactNode
  /** Names the button — “More about seats”. Say what it explains, not “Info”. */
  label: string
  /** Controlled open state. */
  open?: boolean
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Replaces the “i” glyph. */
  icon?: IconComponent
  size?: 'sm' | 'md'
  /** Applied to the bubble. */
  className?: string
}

const InfoIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 7.25v4M8 4.9v.1" />
  </svg>
)

/**
 * The small “i” beside a label that explains it — opened by a click, Enter or
 * Space, closed by the same, by Escape or by clicking away.
 *
 * It is not a Tooltip. A tooltip appears on hover and focus and describes the
 * control it sits on; it cannot hold a link, never appears on touch, and is gone
 * the moment the pointer leaves. A toggletip is a control in its own right whose
 * whole job is to reveal an explanation, so it waits to be asked and stays until
 * dismissed — which is what makes rich content inside it reachable at all.
 *
 * When it opens, the text of the bubble is written into a live region beside
 * the button. The bubble itself is portalled to the end of the document, far
 * from where a screen reader is; the live region is what makes opening it say
 * something. Focus stays on the button, because this is not a dialog to work in.
 */
export function Toggletip({
  children,
  label,
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  placement = 'top',
  align = 'center',
  icon: Icon = InfoIcon,
  size = 'sm',
  className,
}: ToggletipProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const [announcement, setAnnouncement] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const open = controlled ?? uncontrolled

  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }

  // Cleared first and filled a tick later, so reopening the same tip is a change
  // the live region notices and reads again.
  useEffect(() => {
    setAnnouncement('')
    if (!open) return
    const timer = window.setTimeout(() => setAnnouncement(bodyRef.current?.textContent ?? ''), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <span className="relative inline-flex align-middle">
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement={placement}
        align={align}
        offset={6}
        label={label}
        className={cn('max-w-[280px] px-3.5 py-3 text-[12px] font-medium leading-normal text-ink-soft [&_a]:font-semibold [&_a]:text-ink [&_a]:underline', className)}
        trigger={
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            className={cn(
              'inline-flex items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink',
              open && 'bg-surface-muted text-ink',
              size === 'sm' ? 'size-6' : 'size-8',
            )}
          >
            <Icon size={size === 'sm' ? 15 : 18} />
          </button>
        }
      >
        <div ref={bodyRef}>{children}</div>
      </Popover>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </span>
  )
}
