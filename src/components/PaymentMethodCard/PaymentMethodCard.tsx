'use client'

import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'

/** Short wordmarks drawn as text — the library carries no card-network artwork. */
const BRAND_MARK: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
  unionpay: 'UP',
  jcb: 'JCB',
}

const BRAND_NAME: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  unionpay: 'UnionPay',
  jcb: 'JCB',
}

export interface PaymentMethodCardProps {
  /** Card network, lower-case — "visa", "mastercard". Anything else is shown as given. */
  brand: string
  last4: string
  expMonth: number
  expYear: number
  holder?: string
  isDefault?: boolean
  onMakeDefault?: () => void
  onEdit?: () => void
  onRemove?: () => void
  /** Days before expiry to start warning. */
  warnDays?: number
  now?: Date
  className?: string
}

/**
 * A saved card: which one, whether it still works, and what can be done with it.
 *
 * Expiry is worked out, not displayed. A card valid "until 09/26" works for
 * the whole of September, so it is compared against the last day of that month;
 * within the warning window it says so, and once expired it says that instead
 * — the cause of most failed renewals, visible before the renewal fails.
 *
 * The default card cannot be removed from here. Removing it leaves the
 * subscription with nothing to charge, so the control explains what to do
 * first rather than letting the next invoice fail.
 */
export function PaymentMethodCard({
  brand,
  last4,
  expMonth,
  expYear,
  holder,
  isDefault = false,
  onMakeDefault,
  onEdit,
  onRemove,
  warnDays = 60,
  now,
  className,
}: PaymentMethodCardProps) {
  const key = brand.toLowerCase()
  const name = BRAND_NAME[key] ?? brand
  const mark = BRAND_MARK[key] ?? brand.slice(0, 4).toUpperCase()

  const lastValid = new Date(expYear, expMonth, 0, 23, 59, 59)
  const msLeft = lastValid.getTime() - (now ?? new Date()).getTime()
  const expired = msLeft < 0
  const expiring = !expired && msLeft < warnDays * 86_400_000
  const expiry = `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`

  return (
    <Surface
      variant="tile"
      padding="md"
      className={cn(
        'flex-row flex-wrap items-center gap-x-3.5 gap-y-3 bg-surface',
        isDefault && 'border-line-strong',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-[var(--radius-7)] bg-ink text-[9px] font-extrabold tracking-[0.08em] text-ink-inverse"
      >
        {mark}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" size="body">
            {name} ending in <span className="tabular">{last4}</span>
          </Text>
          {isDefault && (
            <Tag size="sm" tone="accent">
              Default
            </Tag>
          )}
        </div>
        <Text as="span" size="caption" weight="semibold" tone={expired ? 'danger' : expiring ? 'default' : 'faint'}>
          {expired ? `Expired ${expiry}` : expiring ? `Expires soon · ${expiry}` : `Expires ${expiry}`}
          {holder && <span className="font-medium text-ink-faint"> · {holder}</span>}
        </Text>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {!isDefault && onMakeDefault && !expired && (
          <Button size="sm" variant="ghost" onClick={onMakeDefault}>
            Make default
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant={expired || expiring ? 'outline' : 'ghost'} onClick={onEdit}>
            {expired ? 'Replace' : 'Edit'}
          </Button>
        )}
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={isDefault}
            title={isDefault ? 'Make another card the default before removing this one' : undefined}
            className="hover:text-danger"
          >
            Remove
          </Button>
        )}
      </div>
    </Surface>
  )
}
