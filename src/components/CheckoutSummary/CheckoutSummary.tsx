'use client'

import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { InlineMessage } from '../InlineMessage'
import { formatPrice } from '../../lib/format'

export interface CheckoutLine {
  id: string
  label: string
  description?: string
  /** Positive for a charge, negative for a credit (a proration, a balance). */
  amount: number
}

export interface AppliedPromo {
  code: string
  /** "20% off for 3 months". */
  label?: string
  /** How much it takes off, as a positive number. */
  amount: number
}

export interface CheckoutSummaryProps {
  lines: CheckoutLine[]
  currency?: string
  /** Fraction applied after discounts — 0.2 for 20% VAT. */
  taxRate?: number
  taxLabel?: string
  /** Validate a code. Resolve with the promo, or with an error message. */
  onApplyPromo?: (code: string) => Promise<AppliedPromo | string>
  /** What happens after today — "Then $468 / month from 1 Oct". */
  recurring?: ReactNode
  /** The payment provider's card element goes here. */
  children?: ReactNode
  /** Usually the Pay button. */
  action?: ReactNode
  /** Small print under the action. */
  note?: ReactNode
  title?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * The order summary beside a checkout: what is being bought, a promo code, tax,
 * and what is due today — plus what will be charged after today, which is the
 * line missing from most checkouts and the one that decides whether the
 * customer is surprised next month.
 *
 * It deliberately does not collect card details. Card entry belongs to the
 * payment provider's own hosted field, which keeps the number out of this
 * page entirely; `children` is where that field is mounted.
 */
export function CheckoutSummary({
  lines,
  currency = '$',
  taxRate,
  taxLabel = 'Tax',
  onApplyPromo,
  recurring,
  children,
  action,
  note,
  title = 'Order summary',
  headingLevel: Heading = 'h2',
  className,
}: CheckoutSummaryProps) {
  const promoId = useId()
  const [code, setCode] = useState('')
  const [promo, setPromo] = useState<AppliedPromo | null>(null)
  const [error, setError] = useState<string>()
  const [checking, setChecking] = useState(false)

  const money = (value: number) => (value < 0 ? `−${formatPrice(round(-value), currency)}` : formatPrice(round(value), currency))

  const subtotal = round(lines.reduce((sum, line) => sum + line.amount, 0))
  const discount = promo ? Math.min(promo.amount, Math.max(0, subtotal)) : 0
  const taxable = Math.max(0, subtotal - discount)
  const tax = taxRate ? round(taxable * taxRate) : 0
  const total = round(taxable + tax)

  const apply = async (event: FormEvent) => {
    event.preventDefault()
    if (!onApplyPromo || !code.trim()) return
    setChecking(true)
    setError(undefined)
    try {
      const result = await onApplyPromo(code.trim())
      if (typeof result === 'string') setError(result)
      else {
        setPromo(result)
        setCode('')
      }
    } finally {
      setChecking(false)
    }
  }

  const row = (label: ReactNode, value: string, tone: 'default' | 'soft' | 'success' = 'soft') => (
    <div className="flex items-baseline justify-between gap-4">
      <Text as="span" size="label" weight="semibold" tone={tone === 'success' ? 'success' : 'soft'}>
        {label}
      </Text>
      <Text as="span" size="label" weight="bold" tone={tone === 'success' ? 'success' : 'default'} tabular>
        {value}
      </Text>
    </div>
  )

  return (
    <Surface variant="card" padding="lg" className={cn('gap-5', className)}>
      <Heading className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">{title}</Heading>

      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col gap-0.5">
              <Text as="span" size="body">
                {line.label}
              </Text>
              {line.description && (
                <Text as="span" size="caption" tone="faint">
                  {line.description}
                </Text>
              )}
            </span>
            <Text as="span" size="body" tabular className="shrink-0">
              {money(line.amount)}
            </Text>
          </li>
        ))}
      </ul>

      {onApplyPromo && !promo && (
        <form onSubmit={(event) => void apply(event)} className="flex flex-col gap-1.5" noValidate>
          <label htmlFor={promoId} className="text-[12px] font-semibold text-ink-soft">
            Promo code
          </label>
          <div className="flex gap-2">
            <Input
              id={promoId}
              inputSize="sm"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              invalid={Boolean(error)}
              autoComplete="off"
              containerClassName="flex-1"
            />
            <Button type="submit" size="sm" variant="outline" loading={checking} disabled={!code.trim()}>
              Apply
            </Button>
          </div>
          {error && (
            <InlineMessage tone="danger" live>
              {error}
            </InlineMessage>
          )}
        </form>
      )}

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        {row('Subtotal', money(subtotal))}
        {promo && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <Text as="span" size="label" weight="semibold" tone="success">
                {promo.code}
                {promo.label ? ` · ${promo.label}` : ''}
              </Text>
              <button
                type="button"
                onClick={() => setPromo(null)}
                className="rounded-full text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                Remove
              </button>
            </span>
            <Text as="span" size="label" weight="bold" tone="success" tabular>
              {money(-discount)}
            </Text>
          </div>
        )}
        {taxRate !== undefined && row(`${taxLabel} (${Math.round(taxRate * 1000) / 10}%)`, money(tax))}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <Text as="span" size="heading">
            Due today
          </Text>
          <Text as="span" size="title" tabular aria-live="polite">
            {money(total)}
          </Text>
        </div>
        {recurring && (
          <Text size="caption" weight="semibold" tone="faint" leading="normal">
            {recurring}
          </Text>
        )}
      </div>

      {children && <div className="flex flex-col gap-3">{children}</div>}
      {action && <div className="flex flex-col [&>*]:w-full">{action}</div>}
      {note && (
        <Text size="caption" tone="faint" leading="normal" className="text-center">
          {note}
        </Text>
      )}
    </Surface>
  )
}
