import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Progress } from '../Progress'
import { type StatusDotTone } from '../StatusDot'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Alert } from '../Alert'
import { DescriptionList, type DescriptionItem } from '../DescriptionList'
import { StatusPill } from '../internal/StatusPill'
import { daysUntil, formatDate, plural } from '../../lib/format'

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'

const STATUS: Record<SubscriptionStatus, { label: string; tone: StatusDotTone }> = {
  active: { label: 'Active', tone: 'success' },
  trialing: { label: 'Trial', tone: 'accent' },
  past_due: { label: 'Past due', tone: 'danger' },
  canceled: { label: 'Canceled', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'warning' },
}

export interface PlanSummaryProps {
  plan: string
  /** Already formatted — "$49". */
  price?: string
  /** "per month", "per seat / month". */
  period?: string
  status: SubscriptionStatus
  /** Next charge, for an active plan. */
  renewsAt?: Date
  trialEndsAt?: Date
  /** When access stops, for a canceled plan. */
  endsAt?: Date
  seats?: { used: number; total: number }
  /** Extra key/value rows — billing email, payment method, tax ID. */
  details?: DescriptionItem[]
  /** Change plan, cancel, manage billing. */
  actions?: ReactNode
  /** The fix for a failed payment, shown inside the warning. */
  paymentAction?: ReactNode
  /** Fixed "now", for tests and stories. */
  now?: Date
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The top of a billing page: which plan, what state it is in, and what happens
 * next.
 *
 * "What happens next" is the part usually missing. Every status has exactly one
 * date that matters — the renewal, the end of the trial, the day access stops —
 * and this states it as a sentence rather than as a field called "Period end".
 * A failed payment is not a status badge; it is a warning with the fix inside
 * it, because it is the one state that costs the customer their access.
 */
export function PlanSummary({
  plan,
  price,
  period = 'per month',
  status,
  renewsAt,
  trialEndsAt,
  endsAt,
  seats,
  details,
  actions,
  paymentAction,
  now,
  headingLevel: Heading = 'h2',
  className,
}: PlanSummaryProps) {
  const reference = (now ?? new Date()).getTime()
  const meta = STATUS[status]

  let next: { text: string; urgent?: boolean } | undefined
  if (status === 'active' && renewsAt) next = { text: `Renews on ${formatDate(renewsAt)}` }
  if (status === 'trialing' && trialEndsAt) {
    const left = Math.max(0, daysUntil(trialEndsAt, reference))
    next = {
      text: left === 0 ? 'Trial ends today' : `Trial ends in ${plural(left, 'day')} · ${formatDate(trialEndsAt, false)}`,
      urgent: left <= 3,
    }
  }
  if (status === 'canceled' && endsAt) {
    next = daysUntil(endsAt, reference) > 0
      ? { text: `Access ends on ${formatDate(endsAt)}`, urgent: true }
      : { text: `Ended on ${formatDate(endsAt)}` }
  }
  if (status === 'paused') next = { text: 'Billing is paused. Nothing will be charged until you resume.' }

  return (
    <Surface variant="card" padding="lg" className={cn('gap-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Current plan
          </Text>
          <div className="flex flex-wrap items-center gap-2.5">
            <Heading className="text-[24px] font-extrabold leading-none tracking-[-0.03em] text-ink">{plan}</Heading>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          {next && (
            <Text size="label" weight="semibold" tone={next.urgent ? 'danger' : 'soft'}>
              {next.text}
            </Text>
          )}
        </div>
        {price && (
          <div className="flex flex-col items-end gap-1">
            <Text as="span" size="title" tabular>
              {price}
            </Text>
            <Text as="span" size="caption" tone="faint">
              {period}
            </Text>
          </div>
        )}
      </div>

      {status === 'past_due' && (
        <Alert tone="danger" title="Your last payment failed" action={paymentAction}>
          Update the payment method to keep access. We will retry automatically in the meantime.
        </Alert>
      )}

      {seats && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Text size="label" weight="semibold">
              Seats
            </Text>
            <Text size="caption" weight="bold" tone={seats.used >= seats.total ? 'danger' : 'soft'} tabular>
              {seats.used} of {seats.total} used
            </Text>
          </div>
          <Progress label="Seats used" value={seats.used} max={seats.total} size="sm" />
        </div>
      )}

      {details && details.length > 0 && <DescriptionList items={details} divided />}

      {actions && <div className="flex flex-wrap gap-2 border-t border-line pt-4">{actions}</div>}
    </Surface>
  )
}
