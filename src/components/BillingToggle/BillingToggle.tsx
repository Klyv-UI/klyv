'use client'

import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { SegmentedControl } from '../SegmentedControl'

export type BillingPeriod = 'monthly' | 'yearly'

export interface BillingToggleProps {
  value: BillingPeriod
  onValueChange: (value: BillingPeriod) => void
  /** The reason to switch — "Save 20%". Shown beside the control, never inside it. */
  savings?: string
  monthlyLabel?: string
  yearlyLabel?: string
  /** Accessible name for the control. */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Monthly or yearly — the switch above every pricing table.
 *
 * A `SegmentedControl` with the saving pinned beside it. The saving is outside
 * the segments on purpose: inside, it changes the width of one option and the
 * track jumps as prices load; outside, it is also read as its own sentence
 * rather than run into the word "Yearly".
 */
export function BillingToggle({
  value,
  onValueChange,
  savings,
  monthlyLabel = 'Monthly',
  yearlyLabel = 'Yearly',
  label = 'Billing period',
  size = 'md',
  className,
}: BillingToggleProps) {
  return (
    <div className={cn('inline-flex flex-wrap items-center gap-2.5', className)}>
      <SegmentedControl
        label={label}
        size={size}
        value={value}
        onValueChange={onValueChange}
        options={[
          { value: 'monthly', label: monthlyLabel },
          { value: 'yearly', label: yearlyLabel },
        ]}
      />
      {savings && (
        <Badge tone={value === 'yearly' ? 'accent' : 'neutral'} className="transition-colors">
          {savings}
        </Badge>
      )}
    </div>
  )
}
