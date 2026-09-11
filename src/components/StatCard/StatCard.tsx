'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconTile } from '../IconTile'
import { Meter } from '../Meter'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Metric, type MetricTrend } from '../Metric'
import type { IconComponent } from '../../lib/types'

export interface StatCardProps {
  /** Glyph identifying what the figure is about. */
  icon?: IconComponent
  /** Short name of the thing being measured. */
  title: string
  /** The headline figure, already formatted. */
  value: ReactNode
  /** Small line above the figure — a deadline, a period. */
  caption?: string
  /** Change since the last period. */
  delta?: string
  /** Direction of the change, which colours the delta. */
  trend?: MetricTrend
  /** Discrete progress under the figure — instalments paid, rewards earned. */
  meter?: { value: number; total: number; label: string }
  /** Overflow control or badge in the top-right. */
  action?: ReactNode
  /** Makes the whole tile activate. */
  onClick?: () => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The instalment and cashback tiles generalised: glyph, overflow, name, then a
 * figure and its progress. It is the one shape the dashboard repeats most, and
 * the reason Meter and Metric both exist.
 */
export function StatCard({
  icon,
  title,
  value,
  caption,
  delta,
  trend,
  meter,
  action,
  onClick,
  className,
}: StatCardProps) {
  return (
    <Surface
      as={onClick ? 'button' : 'div'}
      variant="tile"
      padding="sm"
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={cn('bg-surface text-left', className)}
    >
      <div className="flex items-start justify-between gap-2">
        {icon && <IconTile icon={icon} />}
        {action}
      </div>

      <Text className="mt-2.5" truncate>
        {title}
      </Text>

      <div className="mt-auto pt-4">
        {caption && (
          <Text size="caption" tone="faint">
            {caption}
          </Text>
        )}
        <Metric value={value} delta={delta} trend={trend} size="sm" className="gap-0" />
        {meter && (
          <Meter
            className="mt-2.5"
            value={meter.value}
            total={meter.total}
            label={meter.label}
          />
        )}
      </div>
    </Surface>
  )
}
