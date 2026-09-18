'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EMAIL_PATTERN } from '../../lib/format'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { InlineMessage } from '../InlineMessage'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Text } from '../Text'

export type NewsletterSignupVariant = 'inline' | 'card'

/** What the subscription call reports back. */
export type NewsletterSignupOutcome = 'subscribed' | 'already-subscribed'

export interface NewsletterSignupPayload {
  email: string
  /** Whether the consent box was ticked. Always true when `consentLabel` is set, since it is required. */
  consent: boolean
}

export interface NewsletterSignupProps {
  /** Subscribe the address. Resolve with 'already-subscribed' to say so; reject to show the error message. */
  onSubscribe: (payload: NewsletterSignupPayload) => Promise<NewsletterSignupOutcome | void> | NewsletterSignupOutcome | void
  /** inline is a single row for footers and articles; card adds a heading and description. */
  variant?: NewsletterSignupVariant
  /** Card heading. */
  title?: string
  /** Card description — what arrives and how often. */
  description?: ReactNode
  /** When set, a required consent checkbox with this label is shown. */
  consentLabel?: ReactNode
  /** Label on the submit button. */
  submitLabel?: string
  placeholder?: string
  /** A line under the field — the unsubscribe promise, a privacy link. */
  footnote?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

type Phase = { name: 'idle' } | { name: 'submitting' } | { name: 'done'; outcome: NewsletterSignupOutcome; email: string } | { name: 'error'; message: string }

/**
 * An email capture that tells the truth about what happened.
 *
 * “Thanks!” after every submit hides the three outcomes that matter: the
 * address was already on the list, the request failed, or a confirmation
 * email is now waiting. Each gets its own words here, and the success state
 * says to check the inbox, because double opt-in means nothing arrives until
 * that link is clicked.
 *
 * Validation runs on submit, not on every keystroke — an address is not wrong
 * while it is still being typed. Consent, when asked for, is a real required
 * checkbox and never pre-ticked. A honeypot field, hidden from sight and from
 * assistive technology and out of the tab order, catches form-filling bots:
 * when it has a value the form pretends to succeed without calling
 * `onSubscribe`.
 */
export function NewsletterSignup({
  onSubscribe,
  variant = 'card',
  title = 'Get the newsletter',
  description,
  consentLabel,
  submitLabel = 'Subscribe',
  placeholder = 'you@example.com',
  footnote,
  className,
}: NewsletterSignupProps) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({})
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const trap = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)

  // The form, and the button that had focus, are gone once it succeeds; focus follows to the message.
  useEffect(() => {
    if (phase.name === 'done') confirmation.current?.focus()
  }, [phase.name])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (phase.name === 'submitting') return
    const address = email.trim()
    const next = {
      email: !address ? 'Enter your email address.' : EMAIL_PATTERN.test(address) ? undefined : 'That doesn’t look like an email address.',
      consent: consentLabel && !consent ? 'Tick the box to agree before subscribing.' : undefined,
    }
    setErrors(next)
    if (next.email || next.consent) {
      if (next.email) field.current?.focus()
      return
    }
    if (trap.current?.value) {
      setPhase({ name: 'done', outcome: 'subscribed', email: address })
      return
    }
    setPhase({ name: 'submitting' })
    try {
      const outcome = await onSubscribe({ email: address, consent: consentLabel ? consent : false })
      setPhase({ name: 'done', outcome: outcome || 'subscribed', email: address })
    } catch (reason) {
      setPhase({ name: 'error', message: reason instanceof Error ? reason.message : 'Something went wrong. Try again in a moment.' })
    }
  }

  const reset = () => {
    setPhase({ name: 'idle' })
    setEmail('')
    setConsent(false)
    window.setTimeout(() => field.current?.focus())
  }

  const card = variant === 'card'
  const emailError = errors.email
  const describedBy = [emailError && `${id}-error`, footnote && `${id}-note`].filter(Boolean).join(' ') || undefined

  const body =
    phase.name === 'done' ? (
      <div ref={confirmation} tabIndex={-1} role="status" className="flex flex-col items-start gap-2 outline-none">
        <Text size={card ? 'heading' : 'body'} weight="bold">
          {phase.outcome === 'subscribed' ? 'Check your inbox' : 'You’re already subscribed'}
        </Text>
        <Text size="label" tone="soft" leading="normal">
          {phase.outcome === 'subscribed'
            ? `We sent a confirmation link to ${phase.email}. Your subscription starts once you click it.`
            : `${phase.email} is already on the list, so there is nothing more to do.`}
        </Text>
        <Button variant="ghost" size="sm" onClick={reset} className="-ml-3">
          Use a different email
        </Button>
      </div>
    ) : (
      <form noValidate onSubmit={submit} className="flex flex-col gap-3" aria-label={card ? undefined : title}>
        <div className={cn('flex gap-2', card ? 'flex-col sm:flex-row' : 'flex-row')}>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-email`} className={cn('text-[12px] font-bold text-ink', !card && 'sr-only')}>
              Email address
            </label>
            <Input
              ref={field}
              id={`${id}-email`}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder={placeholder}
              value={email}
              invalid={Boolean(emailError)}
              aria-describedby={describedBy}
              onChange={(change) => {
                setEmail(change.target.value)
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
              }}
            />
          </div>
          <Button type="submit" loading={phase.name === 'submitting'} className={cn('shrink-0', card && 'sm:self-end')}>
            {submitLabel}
          </Button>
        </div>

        {/* The honeypot: people never see or reach it, bots fill in every field they find. */}
        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={`${id}-trap`}>Company website</label>
          <input ref={trap} id={`${id}-trap`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        {emailError && (
          <InlineMessage tone="danger" id={`${id}-error`}>
            {emailError}
          </InlineMessage>
        )}

        {consentLabel && (
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2.5 text-[12px] leading-normal text-ink-soft">
              <Checkbox
                boxSize="sm"
                className="mt-0.5"
                checked={consent}
                required
                invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
                onChange={(change) => {
                  setConsent(change.target.checked)
                  if (errors.consent) setErrors((current) => ({ ...current, consent: undefined }))
                }}
              />
              <span>{consentLabel}</span>
            </label>
            {errors.consent && (
              <InlineMessage tone="danger" id={`${id}-consent-error`}>
                {errors.consent}
              </InlineMessage>
            )}
          </div>
        )}

        {phase.name === 'error' && (
          <InlineMessage tone="danger" live>
            {phase.message}
          </InlineMessage>
        )}

        {footnote && (
          <Text as="p" id={`${id}-note`} size="caption" tone="faint" leading="normal">
            {footnote}
          </Text>
        )}
      </form>
    )

  if (!card) return <div className={cn('relative w-full max-w-md', className)}>{body}</div>

  return (
    <Surface variant="card" className={cn('relative flex w-full max-w-md flex-col gap-4 p-5', className)}>
      <div className="flex flex-col gap-1.5">
        <Text as="h3" size="subtitle" weight="extrabold">
          {title}
        </Text>
        {description && (
          <Text size="label" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>
      {body}
    </Surface>
  )
}
