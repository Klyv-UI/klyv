'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { formatPrice, formatQuantity } from '../../lib/format'
import { BillingToggle, type BillingPeriod } from '../BillingToggle'
import { NumberInput } from '../NumberInput'
import { Slider } from '../Slider'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface UsagePricingCalculatorTier {
  /** Last billable unit in this tier, counted after any included units. Omit on the final, open-ended tier. */
  upTo?: number
  /** Price per unit (or per `unitSize` units) within the tier. */
  unitPrice: number
  /** Charged once when usage reaches this tier. */
  flatFee?: number
}

export interface UsagePricingCalculatorDimension {
  id: string
  /** “Seats”, “API calls”. */
  label: string
  /** Plural unit shown after figures — “seats”, “GB”. */
  unit: string
  min?: number
  max: number
  step?: number
  defaultValue?: number
  /** Units bundled with the base price before any charge applies. */
  included?: number
  /** Prices are per this many units — 1000 for “per 1k calls”. */
  unitSize?: number
  /** graduated charges each unit at its own tier’s rate; volume charges every unit at the rate of the tier the total lands in. */
  model?: 'graduated' | 'volume'
  tiers: UsagePricingCalculatorTier[]
  /** Beyond this, a quote replaces the list price. */
  salesThreshold?: number
  /** A short line under the label. */
  description?: string
}

export type UsagePricingCalculatorValue = Record<string, number>

export interface UsagePricingCalculatorProps {
  dimensions: UsagePricingCalculatorDimension[]
  /** Controlled usage, by dimension id. */
  value?: UsagePricingCalculatorValue
  /** Starting usage when uncontrolled. Falls back to each dimension’s defaultValue. */
  defaultValue?: UsagePricingCalculatorValue
  onValueChange?: (value: UsagePricingCalculatorValue) => void
  /** A flat monthly platform fee. */
  basePrice?: number
  /** Share taken off when billed annually — 0.2 for 20%. */
  annualDiscount?: number
  /** Starting billing period. */
  defaultPeriod?: BillingPeriod
  currency?: string
  /** Shown in place of the total when any dimension passes its sales threshold — a link or button to contact sales. */
  salesAction?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/** Monthly cost of `quantity` units of one dimension. */
function costOf(dimension: UsagePricingCalculatorDimension, quantity: number): number {
  const size = dimension.unitSize ?? 1
  const billable = Math.max(0, quantity - (dimension.included ?? 0))
  if (billable === 0) return 0
  const units = billable / size
  const tiers = dimension.tiers

  if (dimension.model === 'volume') {
    const tier = tiers.find((entry) => entry.upTo === undefined || billable <= entry.upTo) ?? tiers[tiers.length - 1]
    return units * tier.unitPrice + (tier.flatFee ?? 0)
  }

  let cost = 0
  let floor = 0
  for (const tier of tiers) {
    const ceiling = tier.upTo ?? Infinity
    if (billable <= floor) break
    const inTier = Math.min(billable, ceiling) - floor
    cost += (inTier / size) * tier.unitPrice + (tier.flatFee ?? 0)
    floor = ceiling
  }
  return cost
}

const round = (amount: number) => Math.round(amount * 100) / 100

/**
 * A price estimate for usage-based plans, worked out in front of the reader.
 *
 * Tiered pricing tables are accurate and nearly unreadable: nobody can multiply
 * their way through graduated tiers in their head. Here each metered dimension
 * gets a slider for exploring and a number field for the figure they actually
 * know, and the breakdown beside it shows what each dimension contributes, so a
 * surprising total can be traced to its cause.
 *
 * Past a dimension’s sales threshold the list price stops being the real one,
 * so the total gives way to a prompt to talk to sales instead of quoting a
 * number that would never be charged. The total is announced a moment after
 * the reader stops adjusting, not on every step of a slider.
 */
export function UsagePricingCalculator({
  dimensions,
  value: controlled,
  defaultValue,
  onValueChange,
  basePrice = 0,
  annualDiscount = 0.2,
  defaultPeriod = 'monthly',
  currency = '$',
  salesAction,
  className,
}: UsagePricingCalculatorProps) {
  const id = useId()
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod)
  const [uncontrolled, setUncontrolled] = useState<UsagePricingCalculatorValue>(() =>
    Object.fromEntries(dimensions.map((dimension) => [dimension.id, defaultValue?.[dimension.id] ?? dimension.defaultValue ?? dimension.min ?? 0])),
  )
  const value = controlled ?? uncontrolled

  const set = (dimensionId: string, quantity: number) => {
    const next = { ...value, [dimensionId]: quantity }
    if (!controlled) setUncontrolled(next)
    onValueChange?.(next)
  }

  const yearly = period === 'yearly'
  const factor = yearly ? 1 - annualDiscount : 1
  const lines = dimensions.map((dimension) => {
    const quantity = value[dimension.id] ?? dimension.min ?? 0
    return { dimension, quantity, cost: round(costOf(dimension, quantity) * factor) }
  })
  const base = round(basePrice * factor)
  const monthly = round(base + lines.reduce((sum, line) => sum + line.cost, 0))
  const overLimit = lines.filter((line) => line.dimension.salesThreshold !== undefined && line.quantity > line.dimension.salesThreshold)

  const summary = overLimit.length
    ? `Usage above ${overLimit.map((line) => `${formatQuantity(line.dimension.salesThreshold ?? 0)} ${line.dimension.unit}`).join(' and ')} is priced by quote.`
    : `Estimated ${formatPrice(monthly, currency)} per month${yearly ? `, ${formatPrice(round(monthly * 12), currency)} billed yearly` : ''}.`

  const [announced, setAnnounced] = useState(summary)
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(summary), 700)
    return () => window.clearTimeout(timer)
  }, [summary])

  return (
    <Surface variant="card" className={cn('grid w-full overflow-hidden md:grid-cols-[1fr_300px]', className)}>
      <div className="flex flex-col gap-6 p-5">
        {lines.map(({ dimension, quantity }) => {
          const min = dimension.min ?? 0
          const labelId = `${id}-${dimension.id}-label`
          const over = dimension.salesThreshold !== undefined && quantity > dimension.salesThreshold
          return (
            <div key={dimension.id} className="flex flex-col gap-2.5">
              <div className="flex items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" id={labelId} size="body" weight="bold">
                    {dimension.label}
                  </Text>
                  {dimension.description && (
                    <Text as="span" size="caption" tone="faint">
                      {dimension.description}
                    </Text>
                  )}
                </div>
                <NumberInput
                  aria-labelledby={labelId}
                  inputSize="sm"
                  value={quantity}
                  onValueChange={(next) => set(dimension.id, next)}
                  min={min}
                  max={dimension.max}
                  step={dimension.step ?? 1}
                  suffix={dimension.unit}
                  containerClassName="w-44 shrink-0"
                />
              </div>
              <Slider
                aria-labelledby={labelId}
                aria-valuetext={`${formatQuantity(quantity)} ${dimension.unit}`}
                value={quantity}
                min={min}
                max={dimension.max}
                step={dimension.step ?? 1}
                onChange={(change) => set(dimension.id, Number(change.target.value))}
              />
              <div className="flex justify-between">
                <Text as="span" size="caption" tone="faint" tabular>
                  {formatQuantity(min)}
                </Text>
                {dimension.included ? (
                  <Text as="span" size="caption" tone={over ? 'danger' : 'faint'}>
                    {over ? 'Above list pricing' : `${formatQuantity(dimension.included)} included`}
                  </Text>
                ) : over ? (
                  <Text as="span" size="caption" tone="danger">
                    Above list pricing
                  </Text>
                ) : null}
                <Text as="span" size="caption" tone="faint" tabular>
                  {formatQuantity(dimension.max)}
                </Text>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-line bg-surface-sunken p-5 md:border-l md:border-t-0">
        <BillingToggle
          value={period}
          onValueChange={setPeriod}
          size="sm"
          savings={annualDiscount > 0 ? `−${Math.round(annualDiscount * 100)}%` : undefined}
        />
        <dl className="m-0 flex flex-col gap-2">
          {basePrice > 0 && (
            <div className="flex justify-between gap-3 text-[12px]">
              <dt className="text-ink-soft">Platform</dt>
              <dd className="m-0 font-bold tabular text-ink">{formatPrice(base, currency)}</dd>
            </div>
          )}
          {lines.map(({ dimension, quantity, cost }) => (
            <div key={dimension.id} className="flex justify-between gap-3 text-[12px]">
              <dt className="min-w-0 text-ink-soft">
                {dimension.label}
                <span className="block text-[11px] text-ink-faint">{`${formatQuantity(quantity)} ${dimension.unit}`}</span>
              </dt>
              <dd className="m-0 font-bold tabular text-ink">{formatPrice(cost, currency)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          {overLimit.length ? (
            <>
              <Text size="heading" weight="bold">
                Let’s talk
              </Text>
              <Text size="label" tone="soft" leading="normal">
                {summary} Volume discounts apply at this scale.
              </Text>
              {salesAction}
            </>
          ) : (
            <>
              <Text as="span" size="caption" tone="faint">
                {yearly ? 'Per month, billed yearly' : 'Estimated per month'}
              </Text>
              <Text as="span" size="display" weight="extrabold" tabular>
                {formatPrice(monthly, currency)}
              </Text>
              {yearly && (
                <Text as="span" size="caption" tone="soft" tabular>
                  {`${formatPrice(round(monthly * 12), currency)} per year`}
                </Text>
              )}
            </>
          )}
        </div>
        <p role="status" className="sr-only">
          {announced}
        </p>
      </div>
    </Surface>
  )
}
