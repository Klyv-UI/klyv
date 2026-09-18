'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { ProgressRing } from '../ProgressRing'
import { SuccessMark } from '../SuccessMark'
import { Text } from '../Text'
import { CheckIcon, ChevronDownIcon } from '../internal/icons'

export interface ChecklistPopoverItem {
  id: string
  title: string
  /** One line on why the step matters. Hidden once done. */
  description?: string
  done: boolean
  /** Where the step is done. Rendered as a link. */
  href?: string
  /** Runs the step in place, for steps without a page of their own. */
  onAction?: () => void
  /** Label on the link or button — "Invite", "Connect". */
  actionLabel?: string
}

export interface ChecklistPopoverProps {
  /** The steps, in the order they are best done. Done state comes from the app, not from clicks here. */
  items: ChecklistPopoverItem[]
  /** Heading inside the panel. */
  title?: string
  /** Text on the trigger. */
  triggerLabel?: string
  /** Controlled open state. */
  open?: boolean
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** Headline once every step is done. */
  completeTitle?: string
  /** Supporting line once every step is done. */
  completeDescription?: ReactNode
  /** Offered once everything is done — hide the trigger for good. */
  onDismiss?: () => void
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the panel. */
  className?: string
}

const ACTION =
  'shrink-0 rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * An onboarding checklist that lives behind a small button instead of on the
 * home screen.
 *
 * A setup card is right for a new workspace and wrong a week later, when it
 * still takes a third of the dashboard for two optional steps. This keeps the
 * list one click away, with progress on the trigger itself — "3 of 5" and a
 * ring — so the reader always knows how much is left without opening it.
 *
 * Finished steps fold into one line that can be expanded, so what is left is
 * what is visible. When the last one is done the panel says so with a tick that
 * draws itself once — or simply appears, under reduced motion — rather than
 * confetti over someone's work.
 */
export function ChecklistPopover({
  items,
  title = 'Get set up',
  triggerLabel = 'Setup guide',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  completeTitle = 'You’re all set',
  completeDescription = 'Every step is done. You can find this guide again in Help.',
  onDismiss,
  placement = 'bottom',
  align = 'end',
  className,
}: ChecklistPopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const [showDone, setShowDone] = useState(false)
  const doneListId = useId()
  const open = controlledOpen ?? uncontrolled
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }

  const total = items.length
  const doneCount = items.filter((item) => item.done).length
  const complete = total > 0 && doneCount === total
  const remaining = items.filter((item) => !item.done)
  const finished = items.filter((item) => item.done)

  // Announce completion only when it happens, not when a finished list mounts.
  const wasComplete = useRef(complete)
  const [justCompleted, setJustCompleted] = useState(false)
  useEffect(() => {
    if (complete && !wasComplete.current) setJustCompleted(true)
    wasComplete.current = complete
  }, [complete])

  const radius = 7
  const circumference = 2 * Math.PI * radius

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      label={title}
      className={cn('w-[340px] gap-0 p-0', className)}
      trigger={
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface pl-2 pr-3.5 text-[12px] font-semibold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg width={18} height={18} viewBox="0 0 18 18" className="-rotate-90" aria-hidden="true">
            <circle cx="9" cy="9" r={radius} fill="none" strokeWidth="2.5" className="stroke-line-strong" />
            <circle
              cx="9"
              cy="9"
              r={radius}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (total ? doneCount / total : 0))}
              className="stroke-accent-strong transition-[stroke-dashoffset] duration-[var(--duration-slow)] motion-reduce:transition-none"
            />
          </svg>
          {triggerLabel}
          <span className="tabular-nums text-ink-faint">
            {doneCount}
            <span className="sr-only"> of </span>
            <span aria-hidden="true">/</span>
            {total}
          </span>
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-line p-4">
        <ProgressRing value={doneCount} max={total} label={`${title} progress`} size="sm">
          <Text as="span" size="micro" tabular>
            {doneCount}/{total}
          </Text>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <Text size="body" weight="bold">
            {complete ? completeTitle : title}
          </Text>
          <Text size="label" tone="soft" className="mt-1">
            {complete ? 'All steps done' : `${doneCount} of ${total} done`}
          </Text>
        </div>
      </div>

      {complete ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <SuccessMark size="md" label={justCompleted ? completeTitle : 'Complete'} />
          <Text size="label" tone="soft" leading="normal">
            {completeDescription}
          </Text>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={ACTION}>
              Hide this guide
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col p-2">
          {remaining.map((item, index) => (
            <li key={item.id} className="flex items-start gap-3 rounded-[var(--radius-glyph)] p-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                  index === 0 ? 'border-accent-strong text-ink' : 'border-line-strong text-ink-faint',
                )}
              >
                {items.indexOf(item) + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Text size="body" leading="tight">
                  {item.title}
                  <span className="sr-only">, not done</span>
                </Text>
                {item.description && (
                  <Text size="label" tone="soft" leading="normal" className="mt-0.5">
                    {item.description}
                  </Text>
                )}
              </div>
              {item.href ? (
                <a href={item.href} className={ACTION} aria-label={`${item.actionLabel ?? 'Start'}: ${item.title}`}>
                  {item.actionLabel ?? 'Start'}
                </a>
              ) : (
                item.onAction && (
                  <button type="button" onClick={item.onAction} className={ACTION} aria-label={`${item.actionLabel ?? 'Start'}: ${item.title}`}>
                    {item.actionLabel ?? 'Start'}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {finished.length > 0 && !complete && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            aria-expanded={showDone}
            aria-controls={doneListId}
            onClick={() => setShowDone((value) => !value)}
            className="flex w-full items-center gap-2 rounded-[var(--radius-glyph)] px-2.5 py-2 text-left text-[12px] font-semibold text-ink-soft hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong"
          >
            <ChevronDownIcon
              size={14}
              className={cn('transition-transform motion-reduce:transition-none', showDone && 'rotate-180')}
            />
            {showDone ? 'Hide' : 'Show'} {finished.length} completed
          </button>
          <ul id={doneListId} hidden={!showDone} className="flex flex-col">
            {finished.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-2.5 py-2">
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
                >
                  <CheckIcon size={11} strokeWidth={3} />
                </span>
                <Text size="label" tone="faint" className="line-through">
                  {item.title}
                  <span className="sr-only">, done</span>
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  )
}
