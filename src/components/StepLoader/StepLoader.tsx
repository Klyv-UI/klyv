'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Collapse } from '../Collapse'
import { Spinner } from '../Spinner'
import { Text } from '../Text'
import { CheckIcon, ChevronDownIcon, CrossIcon } from '../internal/icons'

export type StepLoaderStatus = 'pending' | 'active' | 'done' | 'error'

export interface StepLoaderStep {
  id: string
  /** What the step does, in the reader’s words — “Installing dependencies”. */
  label: string
  status: StepLoaderStatus
  /** Secondary line — a count, a file, what is happening inside the step. */
  description?: ReactNode
  /** Why it failed. Shown under an errored step, beside the retry. */
  error?: string
}

export interface StepLoaderProps {
  steps: StepLoaderStep[]
  /** Heading for the whole process — “Deploying to production”. */
  title: string
  /** When the process started. The elapsed timer counts from here while a step is active. */
  startedAt?: Date | number
  /** Called with a step id when its retry is pressed. Without it, no retry is offered. */
  onRetry?: (id: string) => void
  /** Controlled: whether the step list is shown. */
  open?: boolean
  /** Whether the step list starts shown, when uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

function elapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`
}

const MARKS: Record<StepLoaderStatus, ReactNode> = {
  pending: <span className="size-2 rounded-full border-2 border-line-strong" />,
  active: <Spinner size="sm" />,
  done: <CheckIcon size={11} strokeWidth={3} />,
  error: <CrossIcon size={10} strokeWidth={3} />,
}

const WORDS: Record<StepLoaderStatus, string> = {
  pending: 'Waiting',
  active: 'In progress',
  done: 'Done',
  error: 'Failed',
}

/**
 * A background process shown as the steps it is made of — a deploy, an import,
 * a workspace being provisioned.
 *
 * A single spinner says “something is happening” for three minutes and then
 * either finishes or doesn’t. Naming the steps turns waiting into progress the
 * reader can follow, and when one fails it says which, with the reason and a
 * retry beside it rather than a generic error for the whole run.
 *
 * The header always carries the current step and the elapsed time, so the list
 * can be collapsed without losing the one line that matters. The current step
 * is announced politely as it changes — once per step, not once per second.
 */
export function StepLoader({
  steps,
  title,
  startedAt,
  onRetry,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  className,
}: StepLoaderProps) {
  const listId = useId()
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const toggle = () => {
    if (openProp === undefined) setOpenState(!open)
    onOpenChange?.(!open)
  }

  const activeIndex = steps.findIndex((step) => step.status === 'active')
  const failedIndex = steps.findIndex((step) => step.status === 'error')
  const doneCount = steps.filter((step) => step.status === 'done').length
  const running = activeIndex !== -1
  const finished = steps.length > 0 && doneCount === steps.length
  const focusIndex = failedIndex !== -1 ? failedIndex : activeIndex

  // The clock runs while a step is active and freezes the moment none is, so a
  // failed run says how long it took to fail.
  const start = startedAt === undefined ? undefined : new Date(startedAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const stopped = useRef<number | null>(null)
  useEffect(() => {
    if (start === undefined) return
    if (!running) {
      stopped.current ??= Date.now()
      setNow(stopped.current)
      return
    }
    stopped.current = null
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running, start])

  const headline = finished
    ? 'All steps complete'
    : focusIndex !== -1
      ? steps[focusIndex].label
      : doneCount === 0
        ? 'Waiting to start'
        : 'Paused'
  const announcement = finished
    ? `${title}: complete`
    : failedIndex !== -1
      ? `${title}: step ${failedIndex + 1} of ${steps.length} failed, ${steps[failedIndex].label}`
      : activeIndex !== -1
        ? `${title}: step ${activeIndex + 1} of ${steps.length}, ${steps[activeIndex].label}`
        : ''

  return (
    <section
      aria-label={title}
      className={cn('flex w-full flex-col rounded-[var(--radius-card)] border border-line bg-surface', className)}
    >
      <div className="flex items-center gap-3 p-4">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            failedIndex !== -1
              ? 'bg-danger text-ink-inverse'
              : finished
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-muted text-ink',
          )}
        >
          {failedIndex !== -1 ? (
            <CrossIcon size={13} strokeWidth={3} />
          ) : finished ? (
            <CheckIcon size={14} strokeWidth={3} />
          ) : running ? (
            <Spinner size="md" />
          ) : (
            <span className="size-2 rounded-full bg-ink-faint" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text size="body" weight="bold" truncate>
            {title}
          </Text>
          <Text size="caption" tone={failedIndex !== -1 ? 'danger' : 'soft'} truncate>
            {headline}
            {!finished && steps.length > 0 && ` · ${doneCount} of ${steps.length}`}
          </Text>
        </div>
        {start !== undefined && (
          <Text as="span" size="caption" weight="semibold" tone="faint" tabular>
            <span className="sr-only">Elapsed </span>
            {elapsed(now - start)}
          </Text>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggle}
          className="gap-1 px-2.5"
        >
          {open ? 'Hide steps' : 'Show steps'}
          <ChevronDownIcon
            size={14}
            className={cn(
              'transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </Button>
      </div>

      <Collapse open={open} id={listId}>
        <ol className="flex list-none flex-col border-t border-line px-4 py-3">
          {steps.map((step, index) => (
            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[9px] top-6 bottom-1 w-0.5 rounded-full',
                    step.status === 'done' ? 'bg-accent-strong' : 'bg-line',
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                  step.status === 'done' && 'bg-accent text-accent-ink',
                  step.status === 'error' && 'bg-danger text-ink-inverse',
                  step.status === 'active' && 'bg-surface-muted text-ink',
                )}
              >
                {MARKS[step.status]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Text
                  size="label"
                  weight={step.status === 'active' || step.status === 'error' ? 'bold' : 'medium'}
                  tone={step.status === 'pending' ? 'faint' : step.status === 'error' ? 'danger' : 'default'}
                  leading="tight"
                  aria-current={step.status === 'active' ? 'step' : undefined}
                >
                  {step.label}
                  <span className="sr-only">{`, ${WORDS[step.status]}`}</span>
                </Text>
                {step.description && (
                  <Text size="caption" tone="faint">
                    {step.description}
                  </Text>
                )}
                {step.status === 'error' && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {step.error && (
                      <Text size="caption" tone="soft" className="min-w-0 flex-1">
                        {step.error}
                      </Text>
                    )}
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={() => onRetry(step.id)}>
                        Retry step
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Collapse>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </section>
  )
}
