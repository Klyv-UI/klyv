import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Text, type TextSize } from '../Text'

export type MetricSize = 'sm' | 'md' | 'lg'
export type MetricTrend = 'up' | 'down' | 'flat'

const VALUE_SIZE: Record<MetricSize, TextSize> = { sm: 'stat', md: 'title', lg: 'display' }

export interface MetricProps {
  /** What the figure measures. Omit inside a container that already names it. */
  label?: string
  /** The figure itself, already formatted. */
  value: ReactNode
  /** Change since the last period, e.g. "+12%". */
  delta?: string
  /** Direction of the delta. Drives the badge tone and the announced text. */
  trend?: MetricTrend
  /** Line under the figure — a comparison, a period. */
  caption?: string
  size?: MetricSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A label, a figure and an optional change, always in that order and at the
 * same ranks — which is what makes a row of metrics scannable.
 */
export function Metric({
  label,
  value,
  delta,
  trend = 'flat',
  caption,
  size = 'md',
  className,
}: MetricProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <Text size="label" tone="faint">
          {label}
        </Text>
      )}
      <div className="flex flex-wrap items-baseline gap-2">
        <Text as="span" size={VALUE_SIZE[size]} tabular>
          {value}
        </Text>
        {delta && (
          <Badge tone={trend === 'flat' ? 'neutral' : 'accent'}>
            <span aria-hidden="true">{trend === 'up' ? '+' : trend === 'down' ? '-' : ''}</span>
            {delta}
            <span className="sr-only">
              {trend === 'up' ? ' increase' : trend === 'down' ? ' decrease' : ''}
            </span>
          </Badge>
        )}
      </div>
      {caption && (
        <Text size="caption" tone="faint">
          {caption}
        </Text>
      )}
    </div>
  )
}
