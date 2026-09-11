'use client'

import { useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { VisuallyHidden } from '../VisuallyHidden'
import { BillingToggle, type BillingPeriod } from '../BillingToggle'
import { PricingCard, type PricingFeature } from '../PricingCard'
import { formatPrice } from '../../lib/format'

export interface PricingPlan {
  id: string
  name: string
  description?: string
  /** Price per month when billed monthly. null is a custom plan. */
  monthly: number | null
  /** Price per month when billed yearly. null is a custom plan. */
  yearly: number | null
  features: (string | PricingFeature)[]
  featuresTitle?: string
  featured?: boolean
  badge?: string
  /** Defaults to "Get started", or "Contact sales" for a custom plan. */
  ctaLabel?: string
}

export interface PricingTableProps {
  plans: PricingPlan[]
  currency?: string
  /** Controlled period. Omit to let the table own it. */
  period?: BillingPeriod
  defaultPeriod?: BillingPeriod
  onPeriodChange?: (period: BillingPeriod) => void
  onSelect?: (planId: string, period: BillingPeriod) => void
  /** The plan the account is on — its button becomes a disabled "Current plan". */
  currentPlanId?: string
  /** "/month", "/seat/month". */
  unit?: string
  showToggle?: boolean
  className?: string
}

/**
 * A row of plans behind a monthly/yearly switch.
 *
 * The saving on the toggle is computed from the plans, not typed in — the
 * "Save 20%" that marketing wrote in March is wrong by June. Yearly prices are
 * shown per month with the monthly figure struck through and the annual total
 * underneath, because the annual total is what actually leaves the account and
 * hiding it is how a refund request starts.
 *
 * Switching period is announced once, politely: every figure on the table just
 * changed, and without it nothing tells a screen reader user that it did.
 */
export function PricingTable({
  plans,
  currency = '$',
  period: controlled,
  defaultPeriod = 'monthly',
  onPeriodChange,
  onSelect,
  currentPlanId,
  unit = '/month',
  showToggle = true,
  className,
}: PricingTableProps) {
  const [uncontrolled, setUncontrolled] = useState<BillingPeriod>(defaultPeriod)
  const period = controlled ?? uncontrolled

  const setPeriod = (next: BillingPeriod) => {
    if (controlled === undefined) setUncontrolled(next)
    onPeriodChange?.(next)
  }

  const bestSaving = plans.reduce((best, plan) => {
    if (!plan.monthly || plan.yearly == null) return best
    return Math.max(best, Math.round((1 - plan.yearly / plan.monthly) * 100))
  }, 0)

  return (
    <div className={cn('flex flex-col items-center gap-10', className)}>
      {showToggle && (
        <BillingToggle
          value={period}
          onValueChange={setPeriod}
          savings={bestSaving > 0 ? `Save up to ${bestSaving}%` : undefined}
        />
      )}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          Showing {period} prices
        </span>
      </VisuallyHidden>

      <ul
        className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-[repeat(var(--plans),minmax(0,1fr))]"
        style={{ '--plans': plans.length } as CSSProperties}
      >
        {plans.map((plan) => {
          const price = period === 'yearly' ? plan.yearly : plan.monthly
          const custom = price == null
          const current = plan.id === currentPlanId

          const caption = custom
            ? 'Tailored to your organisation'
            : price === 0
              ? 'Free forever'
              : period === 'yearly'
                ? `Billed ${formatPrice(price * 12, currency)} yearly`
                : 'Billed monthly'

          return (
            <li key={plan.id} className="pt-3">
              <PricingCard
                name={plan.name}
                description={plan.description}
                price={price}
                currency={currency}
                period={unit}
                compareAt={period === 'yearly' ? plan.monthly : undefined}
                priceCaption={caption}
                features={plan.features}
                featuresTitle={plan.featuresTitle}
                featured={plan.featured}
                badge={plan.badge}
                current={current}
                action={
                  <Button
                    variant={current ? 'muted' : plan.featured ? 'accent' : 'outline'}
                    disabled={current}
                    onClick={() => onSelect?.(plan.id, period)}
                  >
                    {current ? 'Current plan' : (plan.ctaLabel ?? (custom ? 'Contact sales' : 'Get started'))}
                  </Button>
                }
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
