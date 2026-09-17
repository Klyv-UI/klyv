'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatDate, formatPrice, plural } from '../../lib/format'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'
import { NumberInput } from '../NumberInput'
import { SegmentedControl } from '../SegmentedControl'
import { Surface } from '../Surface'
import { Text } from '../Text'

export type SeatSelectorCycle = 'monthly' | 'annual'

export interface SeatSelectorPrice {
  /** Price of one seat for one month, on monthly billing. */
  monthly: number
  /** Price of one seat for one year, on annual billing. */
  annual: number
}

export interface SeatSelectorProps {
  /** Seats currently paid for. The change is measured from here. */
  current: number
  /** Seats occupied by members. The count cannot go below this. */
  inUse: number
  /** The seat count being chosen. Omit to let the component manage it. */
  value?: number
  /** Starting count when uncontrolled. Defaults to `current`. */
  defaultValue?: number
  onValueChange?: (seats: number) => void
  /** Price of one seat on each cycle. */
  pricePerSeat: SeatSelectorPrice
  /** Billing cycle whose price applies. Omit to let the component manage it. */
  cycle?: SeatSelectorCycle
  defaultCycle?: SeatSelectorCycle
  onCycleChange?: (cycle: SeatSelectorCycle) => void
  /** When the current billing period ends — the next invoice date. */
  periodEnd: Date
  /** When it began. Defaults to one cycle before `periodEnd`. */
  periodStart?: Date
  /** The upper bound, for plans with a seat cap. */
  max?: number
  /** Currency symbol. */
  currency?: string
  /** Called with the new count. A promise shows the pending state. */
  onConfirm?: (seats: number, cycle: SeatSelectorCycle) => void | Promise<void>
  /** “Now”, for tests and previews. */
  now?: Date
  /** Merged last, so it wins. */
  className?: string
}

const DAY = 86_400_000

/**
 * The number of paid seats, with the money said out loud before anyone
 * commits to it.
 *
 * Seat changes are the billing screen people get wrong most often: they add
 * three seats and are surprised by a charge today, or remove three and expect a
 * refund. So the summary names the change (“+3 seats”), the new recurring
 * total, and exactly what is charged now — prorated for the days left in the
 * period, with the arithmetic shown. The count cannot go below the seats
 * already occupied, and the field says why instead of just refusing.
 */
export function SeatSelector({
  current,
  inUse,
  value: valueProp,
  defaultValue,
  onValueChange,
  pricePerSeat,
  cycle: cycleProp,
  defaultCycle = 'monthly',
  onCycleChange,
  periodEnd,
  periodStart,
  max,
  currency = '$',
  onConfirm,
  now = new Date(),
  className,
}: SeatSelectorProps) {
  const [ownValue, setOwnValue] = useState(defaultValue ?? current)
  const [ownCycle, setOwnCycle] = useState(defaultCycle)
  const [pending, setPending] = useState(false)
  const inputId = useId()
  const hintId = useId()

  const seats = valueProp ?? ownValue
  const cycle = cycleProp ?? ownCycle
  const setSeats = (next: number) => {
    if (valueProp === undefined) setOwnValue(next)
    onValueChange?.(next)
  }
  const setCycle = (next: SeatSelectorCycle) => {
    if (cycleProp === undefined) setOwnCycle(next)
    onCycleChange?.(next)
  }

  const price = pricePerSeat[cycle]
  const unit = cycle === 'monthly' ? 'month' : 'year'
  const start = periodStart ?? new Date(periodEnd.getFullYear() - (cycle === 'annual' ? 1 : 0), periodEnd.getMonth() - (cycle === 'monthly' ? 1 : 0), periodEnd.getDate())
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - start.getTime()) / DAY))
  const daysLeft = Math.min(totalDays, Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY)))

  const delta = seats - current
  const dueToday = delta > 0 ? Math.round(delta * price * (daysLeft / totalDays) * 100) / 100 : 0
  const saving = Math.round((1 - pricePerSeat.annual / (pricePerSeat.monthly * 12)) * 100)

  const change = delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${plural(Math.abs(delta), 'seat')}`

  const rows: { term: string; detail: string; note?: string }[] = [
    { term: 'Change', detail: change },
    {
      term: 'New total',
      detail: `${plural(seats, 'seat')} · ${formatPrice(seats * price, currency)}/${unit}`,
      note: `was ${formatPrice(current * price, currency)}/${unit}`,
    },
    {
      term: 'Due today',
      detail: formatPrice(dueToday, currency),
      note:
        delta > 0
          ? `${plural(delta, 'seat')} × ${formatPrice(price, currency)} × ${daysLeft}/${totalDays} days left in this period`
          : delta < 0
            ? `Removed seats stay usable until ${formatDate(periodEnd)}. No refund today; the next invoice is lower.`
            : undefined,
    },
  ]

  return (
    <Surface variant="card" padding="lg" className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-[12px] font-semibold text-ink-soft">
            Seats
          </label>
          <NumberInput
            id={inputId}
            value={seats}
            onValueChange={setSeats}
            min={inUse}
            max={max}
            aria-describedby={hintId}
            containerClassName="w-40"
          />
        </div>
        <SegmentedControl
          label="Billing cycle"
          size="sm"
          value={cycle}
          onValueChange={setCycle}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: saving > 0 ? `Annual · save ${saving}%` : 'Annual' },
          ]}
        />
      </div>

      <div className="-mt-2 flex flex-col gap-1">
        <Text id={hintId} size="caption" tone="faint" leading="normal">
          {`${plural(inUse, 'seat')} in use — remove members to go lower.`}
          {max !== undefined && ` Up to ${plural(max, 'seat')} on this plan.`}
        </Text>
        <Text size="caption" weight="semibold" tone="soft">
          {`${formatPrice(price, currency)} per seat per ${unit}`}
        </Text>
      </div>

      <p role="status" className="sr-only">
        {delta === 0 ? '' : `${change}, ${plural(seats, 'seat')} in total. Due today ${formatPrice(dueToday, currency)}.`}
      </p>
      <dl className="m-0 flex flex-col divide-y divide-line rounded-[var(--radius-tile)] bg-surface-sunken px-4">
        {rows.map((row) => (
          <div key={row.term} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-[12px] font-bold text-ink-soft">{row.term}</dt>
            <dd className="m-0 flex flex-col items-end gap-0.5 text-right">
              <Text as="span" size="stat" tabular>
                {row.detail}
              </Text>
              {row.note && (
                <Text as="span" size="caption" tone="faint" leading="normal" className="max-w-[36ch]">
                  {row.note}
                </Text>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {onConfirm && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InlineMessage>{`Renews ${formatDate(periodEnd)} at ${formatPrice(seats * price, currency)}/${unit}.`}</InlineMessage>
          <Button
            loading={pending}
            disabled={delta === 0}
            onClick={async () => {
              setPending(true)
              try {
                await onConfirm(seats, cycle)
              } finally {
                setPending(false)
              }
            }}
          >
            {delta > 0 && dueToday > 0 ? `Pay ${formatPrice(dueToday, currency)} and add seats` : 'Update seats'}
          </Button>
        </div>
      )}
    </Surface>
  )
}
