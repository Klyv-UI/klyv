'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { Text } from '../Text'

export type FeatureBeaconCorner = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start'

const CORNERS: Record<FeatureBeaconCorner, string> = {
  'top-end': '-right-1.5 -top-1.5',
  'top-start': '-left-1.5 -top-1.5',
  'bottom-end': '-bottom-1.5 -right-1.5',
  'bottom-start': '-bottom-1.5 -left-1.5',
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export interface FeatureBeaconProps {
  /** The new element the beacon is attached to. It stays fully usable on its own. */
  children: ReactNode
  /** Name of the feature — the popover's heading and part of the beacon's accessible name. */
  title: string
  /** One or two sentences on what it does and why it helps. */
  description: ReactNode
  /** Label on the acknowledging button. */
  dismissLabel?: string
  /** Optional extra link or action, placed before the dismiss button. */
  action?: ReactNode
  /** Whether the feature has already been acknowledged. When true only the children render. */
  dismissed?: boolean
  /** Called on "Got it". Persist it — a beacon that comes back on every visit is noise. */
  onDismiss?: () => void
  /** Accessible name for the beacon button. Defaults to "New: {title}". */
  label?: string
  /** Which corner of the children the dot sits on. */
  corner?: FeatureBeaconCorner
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the popover panel. */
  className?: string
}

/**
 * A pulsing dot on something new, which explains itself when pressed.
 *
 * A tour takes over the screen to point at five things; a beacon points at one
 * and waits. The reader opens it when they are curious, reads two lines, and
 * acknowledges it — and that acknowledgement goes to a callback, because only
 * the app knows where "seen" should be stored and for whom.
 *
 * The dot is a real button with a name, not decoration, so a keyboard or screen
 * reader user finds the news too. Its pulse is motion-safe only: under reduced
 * motion it is a still dot with a halo. After "Got it" the beacon goes, and
 * focus moves to the feature itself rather than falling to the page.
 */
export function FeatureBeacon({
  children,
  title,
  description,
  dismissLabel = 'Got it',
  action,
  dismissed: controlledDismissed,
  onDismiss,
  label,
  corner = 'top-end',
  placement = 'bottom',
  align = 'start',
  className,
}: FeatureBeaconProps) {
  const [internalDismissed, setInternalDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const refocus = useRef(false)
  const dismissed = controlledDismissed ?? internalDismissed

  const acknowledge = () => {
    refocus.current = true
    setOpen(false)
    setInternalDismissed(true)
    onDismiss?.()
  }

  useEffect(() => {
    if (!dismissed || !refocus.current) return
    refocus.current = false
    wrapperRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [dismissed])

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      {children}
      {!dismissed && (
        <span className={cn('absolute z-[var(--z-raised)]', CORNERS[corner])}>
          <Popover
            open={open}
            onOpenChange={setOpen}
            placement={placement}
            align={align}
            label={title}
            initialFocus="[data-beacon-dismiss]"
            className={cn('w-[260px] gap-3 p-4', className)}
            trigger={
              <button
                type="button"
                aria-label={label ?? `New: ${title}`}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="relative inline-flex size-4 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-accent-strong opacity-60 motion-safe:animate-ping motion-reduce:scale-125 motion-reduce:opacity-40"
                />
                <span
                  aria-hidden="true"
                  className="relative size-2.5 rounded-full bg-accent-strong ring-2 ring-[var(--color-shell)]"
                />
              </button>
            }
          >
            <div className="flex flex-col gap-1.5">
              <Text size="micro" tone="accent" className="uppercase tracking-wider">
                New
              </Text>
              <Text size="body" weight="bold">
                {title}
              </Text>
              <Text size="label" tone="soft" leading="normal">
                {description}
              </Text>
            </div>
            <div className="flex items-center justify-end gap-2">
              {action}
              <Button size="sm" data-beacon-dismiss="" onClick={acknowledge}>
                {dismissLabel}
              </Button>
            </div>
          </Popover>
        </span>
      )}
    </span>
  )
}
