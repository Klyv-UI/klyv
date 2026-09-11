'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Progress } from '../Progress'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Collapse } from '../Collapse'
import { SuccessMark } from '../SuccessMark'
import { CheckIcon, ChevronDownIcon } from '../internal/icons'

export interface ChecklistStep {
  id: string
  title: string
  description?: ReactNode
  done: boolean
  /** What to do about it — usually a Button that opens the right screen. */
  action?: ReactNode
  optional?: boolean
}

export interface SetupChecklistProps {
  steps: ChecklistStep[]
  title?: string
  description?: ReactNode
  /** Hide the checklist for good. Offered at every stage, not only at the end. */
  onDismiss?: () => void
  completeTitle?: string
  completeDescription?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The "get set up" card on a new workspace's home screen.
 *
 * The next thing to do is open; everything else is one line. When a step is
 * completed elsewhere in the product the card moves on by itself — the steps are
 * props, so it reflects what is true rather than what was clicked here.
 *
 * Optional steps do not count against completion. A checklist stuck at 80%
 * because nobody wanted to connect Slack is a checklist people learn to ignore,
 * and one that can be dismissed at any point is one they do not resent.
 */
export function SetupChecklist({
  steps,
  title = 'Get started',
  description,
  onDismiss,
  completeTitle = 'You are all set',
  completeDescription = 'Everything on the list is done. You can hide this card now.',
  headingLevel: Heading = 'h2',
  className,
}: SetupChecklistProps) {
  const baseId = useId()
  const required = steps.filter((step) => !step.optional)
  const doneCount = required.filter((step) => step.done).length
  const complete = required.length > 0 && doneCount === required.length
  const nextId = steps.find((step) => !step.done)?.id

  const [openId, setOpenId] = useState<string | undefined>(nextId)

  // When the open step is finished elsewhere, move on to the next one.
  const openStepDone = steps.find((step) => step.id === openId)?.done
  useEffect(() => {
    if (openStepDone) setOpenId(nextId)
  }, [openStepDone, nextId])

  return (
    <Surface variant="card" className={cn('overflow-hidden', className)}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Heading className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">
              {complete ? completeTitle : title}
            </Heading>
            {(complete ? completeDescription : description) && (
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {complete ? completeDescription : description}
              </Text>
            )}
          </div>
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss} className="-mr-2 -mt-1">
              {complete ? 'Hide' : 'Dismiss'}
            </Button>
          )}
        </div>

        {!complete && (
          <div className="flex items-center gap-3">
            <Progress label="Setup progress" value={doneCount} max={required.length} size="sm" />
            <Text as="span" size="caption" weight="bold" tone="soft" tabular className="shrink-0">
              {doneCount} of {required.length}
            </Text>
          </div>
        )}
      </div>

      {complete ? (
        <div className="flex items-center gap-3 border-t border-line px-5 py-4">
          <SuccessMark size="sm" label="Setup complete" />
          <Text size="label" weight="semibold" tone="soft">
            {required.length} of {required.length} steps done
          </Text>
        </div>
      ) : (
        <ol className="border-t border-line">
          {steps.map((step, index) => {
            const open = step.id === openId
            const panelId = `${baseId}-${step.id}`
            const current = step.id === nextId

            return (
              <li key={step.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? undefined : step.id)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      step.done
                        ? 'bg-accent text-accent-ink'
                        : current
                          ? 'border-2 border-accent-strong text-ink'
                          : 'border border-line-strong text-ink-faint',
                    )}
                  >
                    {step.done ? <CheckIcon size={12} strokeWidth={3} /> : index + 1}
                  </span>
                  <Text
                    as="span"
                    size="body"
                    weight={step.done ? 'semibold' : 'bold'}
                    tone={step.done ? 'faint' : 'default'}
                    className={cn('flex-1', step.done && 'line-through decoration-ink-faint/60')}
                  >
                    {step.title}
                    <VisuallyHidden>{step.done ? ' — done' : ' — to do'}</VisuallyHidden>
                  </Text>
                  {step.optional && <Tag size="sm">Optional</Tag>}
                  <ChevronDownIcon
                    size={14}
                    className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')}
                  />
                </button>
                <Collapse open={open} id={panelId}>
                  <div className="flex flex-col items-start gap-3 pb-4 pl-14 pr-5">
                    {step.description && (
                      <Text size="caption" weight="medium" tone="soft" leading="normal">
                        {step.description}
                      </Text>
                    )}
                    {!step.done && step.action}
                  </div>
                </Collapse>
              </li>
            )
          })}
        </ol>
      )}
    </Surface>
  )
}
