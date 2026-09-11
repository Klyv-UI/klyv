'use client'

import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { CheckIcon } from '../internal/icons'

export interface StepperStep {
  id: string
  label: string
  hint?: string
}

export type StepStatus = 'complete' | 'current' | 'upcoming'

export interface StepperProps {
  /** The steps, in order. */
  steps: StepperStep[]
  /** Index of the current step, zero-based. */
  current: number
  orientation?: 'horizontal' | 'vertical'
  /** Let the user jump to a completed step. */
  onStepSelect?: (index: number) => void
  /** Accessible name for the sequence. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

function statusOf(index: number, current: number): StepStatus {
  if (index < current) return 'complete'
  if (index === current) return 'current'
  return 'upcoming'
}

/**
 * Progress through a multi-step flow. Each marker carries its state as text
 * for assistive tech, so completion is never conveyed by a tick alone.
 *
 * Completed steps can be revisited when `onStepSelect` is supplied; upcoming
 * ones never can, since a flow that lets you skip ahead is not a flow.
 */
export function Stepper({
  steps,
  current,
  orientation = 'horizontal',
  onStepSelect,
  label = 'Progress',
  className,
}: StepperProps) {
  return (
    <ol
      aria-label={label}
      className={cn(
        'flex list-none',
        orientation === 'horizontal' ? 'items-start' : 'flex-col',
        className,
      )}
    >
      {steps.map((step, index) => {
        const status = statusOf(index, current)
        const clickable = Boolean(onStepSelect) && status === 'complete'
        const marker = (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
              status === 'complete' && 'bg-accent-strong text-accent-ink',
              status === 'current' && 'bg-accent text-accent-ink ring-4 ring-accent-soft',
              status === 'upcoming' && 'border border-line-strong bg-surface text-ink-faint',
            )}
          >
            {status === 'complete' ? <CheckIcon size={14} /> : index + 1}
          </span>
        )

        return (
          <Fragment key={step.id}>
            <li
              aria-current={status === 'current' ? 'step' : undefined}
              className={cn(
                'flex min-w-0',
                orientation === 'horizontal' ? 'flex-col items-start gap-2' : 'gap-3',
              )}
            >
              <div className={cn('flex items-center gap-2.5', orientation === 'vertical' && 'flex-col self-stretch')}>
                {clickable ? (
                  <button type="button" onClick={() => onStepSelect?.(index)} className="rounded-full">
                    {marker}
                    <span className="sr-only">Go back to {step.label}</span>
                  </button>
                ) : (
                  marker
                )}
                {orientation === 'vertical' && index < steps.length - 1 && (
                  <span aria-hidden="true" className="w-px flex-1 bg-line-strong" />
                )}
              </div>
              <div className={cn('min-w-0', orientation === 'vertical' && 'pb-6')}>
                <Text size="caption" weight={status === 'upcoming' ? 'medium' : 'bold'} tone={status === 'upcoming' ? 'faint' : 'default'} truncate>
                  {step.label}
                </Text>
                {step.hint && (
                  <Text size="caption" tone="faint" truncate>
                    {step.hint}
                  </Text>
                )}
                <span className="sr-only">
                  {status === 'complete' ? 'Completed' : status === 'current' ? 'Current step' : 'Not started'}
                </span>
              </div>
            </li>
            {orientation === 'horizontal' && index < steps.length - 1 && (
              <li aria-hidden="true" className="mt-3.5 h-px min-w-6 flex-1 bg-line-strong" />
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}
