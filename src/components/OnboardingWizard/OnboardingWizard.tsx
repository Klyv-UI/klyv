'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { InlineMessage } from '../InlineMessage'
import { Stepper } from '../Stepper'

export interface WizardStep {
  id: string
  title: string
  description?: ReactNode
  /** The step's fields. Owned by the caller, so their state survives Back. */
  content: ReactNode
  /** Return a message to stay on the step; nothing to move on. May be async. */
  validate?: () => string | undefined | Promise<string | undefined>
  /** Offer Skip. */
  optional?: boolean
}

export interface OnboardingWizardProps {
  steps: WizardStep[]
  onComplete: () => void | Promise<void>
  onStepChange?: (index: number) => void
  finishLabel?: string
  /** Heading over the whole flow — "Set up your workspace". */
  title?: string
  className?: string
}

/**
 * The multi-step setup flow after sign-up: workspace name, team size, invite
 * people, pick a template.
 *
 * Each step validates before moving on, and says why it will not, in place.
 * Completed steps can be revisited from the stepper, but future ones cannot —
 * jumping ahead past a required answer is how half-configured workspaces are
 * made. On every move, focus goes to the new step's heading, so a screen
 * reader hears where it now is instead of staying on a button that has just
 * changed meaning.
 */
export function OnboardingWizard({
  steps,
  onComplete,
  onStepChange,
  finishLabel = 'Finish',
  title,
  className,
}: OnboardingWizardProps) {
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  const step = steps[index]
  const last = index === steps.length - 1

  useEffect(() => {
    if (!moved.current) return
    headingRef.current?.focus({ preventScroll: true })
  }, [index])

  const go = (next: number) => {
    moved.current = true
    setError(undefined)
    setIndex(next)
    onStepChange?.(next)
  }

  const advance = async (skip = false) => {
    if (!step) return
    setBusy(true)
    try {
      const message = skip ? undefined : await step.validate?.()
      if (message) {
        setError(message)
        return
      }
      if (last) await onComplete()
      else go(index + 1)
    } finally {
      setBusy(false)
    }
  }

  if (!step) return null

  return (
    <Surface variant="card" className={cn('overflow-hidden', className)}>
      <div className="flex flex-col gap-5 border-b border-line p-5 sm:p-6">
        {title && (
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            {title}
          </Text>
        )}
        <Stepper
          label="Setup steps"
          current={index}
          steps={steps.map((item) => ({ id: item.id, label: item.title }))}
          onStepSelect={(target) => target < index && go(target)}
        />
      </div>

      <form
        className="flex flex-col gap-5 p-5 sm:p-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void advance()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Text as="span" size="caption" weight="bold" tone="faint" tabular>
            Step {index + 1} of {steps.length}
          </Text>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-ink outline-none"
          >
            {step.title}
          </h2>
          {step.description && (
            <Text size="body" weight="medium" tone="soft" leading="normal">
              {step.description}
            </Text>
          )}
        </div>

        <div className="flex flex-col gap-4">{step.content}</div>

        {error && (
          <InlineMessage tone="danger" live>
            {error}
          </InlineMessage>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {index > 0 && (
            <Button variant="ghost" onClick={() => go(index - 1)} disabled={busy}>
              Back
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {step.optional && !last && (
              <Button variant="outline" onClick={() => void advance(true)} disabled={busy}>
                Skip
              </Button>
            )}
            <Button type="submit" loading={busy}>
              {last ? finishLabel : 'Continue'}
            </Button>
          </div>
        </div>
      </form>
    </Surface>
  )
}
