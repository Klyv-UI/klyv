'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Button } from '../Button'
import { Field } from '../Field'
import { InlineMessage } from '../InlineMessage'
import { RadioGroup } from '../RadioGroup'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { CheckIcon } from '../internal/icons'

export type CancellationFlowOfferKind = 'pause' | 'discount' | 'downgrade'

export interface CancellationFlowReason {
  value: string
  label: string
  /** The retention offer that answers this reason, if any. */
  offer?: CancellationFlowOfferKind
}

export interface CancellationFlowOffer {
  /** “Pause for up to 3 months”. */
  title: string
  /** What the offer does, in plain terms, including when it ends. */
  description: string
  /** Label for accepting it. */
  actionLabel: string
}

export interface CancellationFlowFeedback {
  /** The chosen reason’s value, or null when none was given. */
  reason: string | null
  /** Anything written in the free-text box. */
  details: string
}

export interface CancellationFlowProps {
  /** The plan being cancelled. */
  planName: string
  /** When paid access ends if the cancellation goes through. */
  accessEndsAt: Date
  /** What stops working — named features and data, not “premium features”. */
  losses: string[]
  /** Reasons offered on the first step, each optionally paired with an offer. */
  reasons?: CancellationFlowReason[]
  /** Copy for each offer the product can make. An offer without copy is never shown. */
  offers?: Partial<Record<CancellationFlowOfferKind, CancellationFlowOffer>>
  /** Called when an offer is taken instead of cancelling. */
  onAcceptOffer?: (offer: CancellationFlowOfferKind, feedback: CancellationFlowFeedback) => void | Promise<void>
  /** Called on the final confirmation. A rejected promise shows its message. */
  onCancel: (feedback: CancellationFlowFeedback) => void | Promise<void>
  /** Leave the flow without changing anything. */
  onKeep?: () => void
  /** Merged last, so it wins. */
  className?: string
}

type Step = 'reason' | 'offer' | 'confirm' | 'cancelled' | 'retained'

const DEFAULT_REASONS: CancellationFlowReason[] = [
  { value: 'price', label: 'It costs too much', offer: 'discount' },
  { value: 'break', label: 'I only need it part of the year', offer: 'pause' },
  { value: 'features', label: 'I don’t use enough of it', offer: 'downgrade' },
  { value: 'switching', label: 'I’m moving to another product' },
  { value: 'other', label: 'Something else' },
]

/**
 * Cancelling a subscription in a few honest steps: why, perhaps an offer that
 * answers that reason, and a confirmation that says what is lost and when.
 *
 * The offer is chosen by the reason — a discount for “too expensive”, a pause
 * for “only part of the year” — because a generic 20%-off wall answers nobody.
 * The way through is never hidden: no reason is required, every step has a
 * plainly labelled “continue cancelling” with the same weight as the offer, and
 * the final step states the end-of-access date before the button is pressed.
 * Dark patterns here win a month of revenue and lose the customer for good.
 */
export function CancellationFlow({
  planName,
  accessEndsAt,
  losses,
  reasons = DEFAULT_REASONS,
  offers = {},
  onAcceptOffer,
  onCancel,
  onKeep,
  className,
}: CancellationFlowProps) {
  const [step, setStep] = useState<Step>('reason')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const headingId = useId()

  const chosen = reasons.find((item) => item.value === reason)
  const offerKind = chosen?.offer && offers[chosen.offer] && onAcceptOffer ? chosen.offer : undefined
  const offer = offerKind ? offers[offerKind] : undefined
  const feedback: CancellationFlowFeedback = { reason: reason || null, details: details.trim() }
  const steps: Step[] = offer ? ['reason', 'offer', 'confirm'] : ['reason', 'confirm']
  const position = steps.indexOf(step)

  // Each step replaces the last, so focus goes to its heading — otherwise it is
  // left on a button that no longer exists.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const go = (next: Step) => {
    setError(null)
    setStep(next)
  }

  const run = async (action: () => void | Promise<void>, next: Step) => {
    setPending(true)
    setError(null)
    try {
      await action()
      setStep(next)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Nothing has changed.')
    } finally {
      setPending(false)
    }
  }

  const heading = (text: string) => (
    // A plain h2: Text does not forward refs, and focus has to land here.
    <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-[18px] font-extrabold leading-none tracking-[-0.02em] text-ink outline-none">
      {text}
    </h2>
  )

  const endDate = formatDate(accessEndsAt)

  return (
    <Surface as="section" aria-labelledby={headingId} variant="card" padding="lg" className={cn('flex flex-col gap-5', className)}>
      {position >= 0 && (
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          {`Step ${position + 1} of ${steps.length}`}
        </Text>
      )}

      {step === 'reason' && (
        <>
          <div className="-mt-3 flex flex-col gap-1.5">
            {heading(`Why are you cancelling ${planName}?`)}
            <Text size="body" weight="medium" tone="faint" leading="normal">
              Optional — it helps us fix the right thing.
            </Text>
          </div>
          <RadioGroup label="Main reason" variant="card" options={reasons} value={reason} onValueChange={setReason} />
          <Field label="Anything else? (optional)">
            <Textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            {onKeep && (
              <Button variant="ghost" onClick={onKeep}>
                Keep my subscription
              </Button>
            )}
            <Button variant="outline" onClick={() => go(offer ? 'offer' : 'confirm')}>
              Continue to cancel
            </Button>
          </div>
        </>
      )}

      {step === 'offer' && offer && offerKind && (
        <>
          <div className="-mt-3">{heading('Before you go')}</div>
          <Surface variant="tile" padding="lg" className="flex flex-col gap-2 border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)]">
            <Text as="h3" size="heading">
              {offer.title}
            </Text>
            <Text size="body" weight="medium" tone="soft" leading="normal">
              {offer.description}
            </Text>
          </Surface>
          {error && (
            <InlineMessage tone="danger" live>
              {error}
            </InlineMessage>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => go('reason')} disabled={pending}>
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => go('confirm')} disabled={pending}>
                No thanks, continue cancelling
              </Button>
              <Button loading={pending} onClick={() => void run(() => onAcceptOffer?.(offerKind, feedback), 'retained')}>
                {offer.actionLabel}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="-mt-3 flex flex-col gap-1.5">
            {heading(`Cancel ${planName}?`)}
            <Text size="body" weight="medium" tone="soft" leading="normal">
              {`You keep full access until ${endDate}. You won’t be charged again.`}
            </Text>
          </div>
          {losses.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-tile)] bg-surface-sunken p-4">
              <Text as="h3" size="label" weight="bold">
                {`After ${endDate} you lose`}
              </Text>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                {losses.map((loss) => (
                  <li key={loss}>
                    <Text as="span" size="body" weight="medium" tone="soft">
                      {loss}
                    </Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <InlineMessage tone="danger" live>
              {error}
            </InlineMessage>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => go(offer ? 'offer' : 'reason')} disabled={pending}>
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              {onKeep && (
                <Button variant="outline" onClick={onKeep} disabled={pending}>
                  Keep my subscription
                </Button>
              )}
              <Button
                loading={pending}
                onClick={() => void run(() => onCancel(feedback), 'cancelled')}
                className="bg-danger text-white hover:bg-danger/90"
              >
                Cancel subscription
              </Button>
            </div>
          </div>
        </>
      )}

      {(step === 'cancelled' || step === 'retained') && (
        <div className="flex flex-col items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-ink">
            <CheckIcon size={20} />
          </span>
          {heading(step === 'cancelled' ? 'Your subscription is cancelled' : 'Offer applied')}
          <Text size="body" weight="medium" tone="soft" leading="normal">
            {step === 'cancelled'
              ? `${planName} stays active until ${endDate}. You can resubscribe any time before then and nothing will be lost.`
              : `${offer?.title ?? 'Your offer'} is now on your account. Nothing else about ${planName} has changed.`}
          </Text>
        </div>
      )}
    </Surface>
  )
}
