'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { formatQuantity } from '../../lib/format'

export interface UsageItem {
  id: string
  /** "Monthly active users", "Storage". */
  label: string
  used: number
  /** null is unlimited on this plan. */
  limit: number | null
  /** "GB", "seats" — printed after the figures. */
  unit?: string
  /** Replace the default number formatting. */
  format?: (value: number) => string
  hint?: string
}

export interface UsageMeterProps {
  items: UsageItem[]
  title?: string
  /** When the counts reset — "Resets on 1 Oct". */
  period?: ReactNode
  /** Fraction at which a row starts warning. */
  warnAt?: number
  onUpgrade?: () => void
  upgradeLabel?: string
  layout?: 'list' | 'grid'
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * Plan entitlements against what has been used this billing period.
 *
 * `RateLimitMeter` is a rolling window with a countdown — calls per hour. This
 * is the other quota every SaaS has: seats, projects, storage, monthly active
 * users — counted over a billing period, some of them unlimited, some of them
 * already over and being billed as overage.
 *
 * Over the limit is its own state, not a bar at 100%: the bar is full, the
 * figure says how far over, and the row says so in words. Unlimited rows have no
 * bar at all — an empty track reads as "none used", which is not the same fact.
 */
export function UsageMeter({
  items,
  title = 'Usage',
  period,
  warnAt = 0.8,
  onUpgrade,
  upgradeLabel = 'Upgrade plan',
  layout = 'list',
  headingLevel: Heading = 'h2',
  className,
}: UsageMeterProps) {
  const pressing = items.filter((item) => item.limit !== null && item.used / Math.max(1, item.limit) >= warnAt)

  return (
    <Surface variant="card" className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <Heading className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">{title}</Heading>
        {period && (
          <Text size="caption" weight="semibold" tone="faint">
            {period}
          </Text>
        )}
      </div>

      <ul className={cn('grid gap-x-8 gap-y-5 p-5', layout === 'grid' && 'sm:grid-cols-2')}>
        {items.map((item) => (
          <UsageRow key={item.id} item={item} warnAt={warnAt} />
        ))}
      </ul>

      {onUpgrade && pressing.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-5 py-3">
          <Text size="caption" weight="semibold" tone="soft" leading="normal">
            {pressing.length === 1
              ? `${pressing[0]!.label} is close to the plan limit.`
              : `${pressing.length} limits are close to the plan limit.`}
          </Text>
          <Button size="sm" onClick={onUpgrade}>
            {upgradeLabel}
          </Button>
        </div>
      )}
    </Surface>
  )
}

function UsageRow({ item, warnAt }: { item: UsageItem; warnAt: number }) {
  const format = item.format ?? formatQuantity
  const unit = item.unit ? ` ${item.unit}` : ''

  if (item.limit === null) {
    return (
      <li className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Text size="label" weight="semibold">
            {item.label}
          </Text>
          <Tag size="sm" tone="accent">
            Unlimited
          </Tag>
        </div>
        <Text size="caption" tone="faint" tabular>
          {format(item.used)}
          {unit} used{item.hint ? ` · ${item.hint}` : ''}
        </Text>
      </li>
    )
  }

  const fraction = item.limit === 0 ? 1 : item.used / item.limit
  const over = item.used > item.limit
  const warning = !over && fraction >= warnAt

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Text size="label" weight="semibold">
          {item.label}
        </Text>
        <Text size="caption" weight="bold" tone={over ? 'danger' : 'soft'} tabular className="shrink-0">
          {format(item.used)} / {format(item.limit)}
          {unit}
        </Text>
      </div>
      <div
        role="progressbar"
        aria-label={item.label}
        aria-valuemin={0}
        aria-valuemax={item.limit}
        aria-valuenow={Math.min(item.used, item.limit)}
        aria-valuetext={`${format(item.used)} of ${format(item.limit)}${unit}${over ? ', over the limit' : ''}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-track"
      >
        <div
          className={cn(
            'h-full origin-left rounded-full transition-[transform,background-color] duration-[var(--duration-slow)]',
            over ? 'bg-danger' : warning ? 'bg-warning' : 'bg-accent-strong',
          )}
          style={{ transform: `scaleX(${Math.min(1, fraction)})` }}
        />
      </div>
      {(over || warning || item.hint) && (
        <Text size="caption" tone={over ? 'danger' : 'faint'} leading="normal">
          {over
            ? `${format(item.used - item.limit)}${unit} over the limit`
            : warning
              ? `${Math.round(fraction * 100)}% used`
              : item.hint}
        </Text>
      )}
    </li>
  )
}
