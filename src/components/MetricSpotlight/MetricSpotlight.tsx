'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { CountUp } from '../CountUp'
import { Metric, type MetricTrend } from '../Metric'
import { Sparkline, type SparklineTone } from '../Sparkline'
import { Presence } from '../Presence'

export interface SpotlightMetric {
  id: string
  label: string
  /** Numeric value, so it can count up. */
  value: number
  /** Turn the value into display text. */
  format?: (value: number) => string
  delta?: string
  trend?: MetricTrend
  /** Series behind this metric, oldest first. */
  series: number[]
  tone?: SparklineTone
  caption?: string
}

export interface MetricSpotlightProps {
  metrics: SpotlightMetric[]
  /** Accessible name for the group. */
  label: string
  /** Selected metric id. Omit for uncontrolled. */
  value?: string
  /** Called when a metric is selected. */
  onValueChange?: (id: string) => void
  /** Rendered under the rail for the selected metric — usually a chart. */
  detail?: (metric: SpotlightMetric) => ReactNode
  /** Count the figures up when they first appear. */
  animate?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A rail of KPI tiles where selecting one drives a detail panel below.
 *
 * The problem it solves is the summary-then-detail dance that every analytics
 * screen reinvents: a row of numbers, and a chart that has to know which number
 * is selected. Here the rail owns the selection and hands the chosen metric to
 * a render prop, so the detail can be any chart in the library — or none.
 *
 * The tiles are radio buttons, not divs: arrow keys move between them and only
 * the selected one is a tab stop, which is the same model SegmentedControl uses.
 * Figures count up only on first paint, never on re-selection, so switching
 * tiles stays instant.
 */
export function MetricSpotlight({
  metrics,
  label,
  value,
  onValueChange,
  detail,
  animate = true,
  className,
}: MetricSpotlightProps) {
  const [uncontrolled, setUncontrolled] = useState(metrics[0]?.id)
  const selectedId = value ?? uncontrolled
  const selected = metrics.find((metric) => metric.id === selectedId) ?? metrics[0]

  const select = (id: string) => {
    if (value === undefined) setUncontrolled(id)
    onValueChange?.(id)
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = metrics[(index + step + metrics.length) % metrics.length]
    select(next.id)
    ;(event.currentTarget.parentElement?.children[
      (index + step + metrics.length) % metrics.length
    ]?.firstChild as HTMLElement | null)?.focus()
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric, index) => {
          const isSelected = metric.id === selected?.id
          const format = metric.format ?? ((next: number) => next.toLocaleString('en-US'))
          return (
            <div key={metric.id} className="min-w-0">
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(metric.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="w-full rounded-[var(--radius-card)] text-left"
              >
                <Surface
                  variant="card"
                  padding="lg"
                  className={cn(
                    'h-full gap-3 transition-all duration-[var(--duration-fast)]',
                    isSelected
                      ? 'border-accent-strong shadow-[var(--shadow-float)]'
                      : 'hover:border-line-strong',
                  )}
                >
                  <Metric
                    label={metric.label}
                    size="sm"
                    delta={metric.delta}
                    trend={metric.trend}
                    caption={metric.caption}
                    value={
                      animate ? <CountUp value={metric.value} format={format} /> : format(metric.value)
                    }
                  />
                  <Sparkline
                    values={metric.series}
                    label={`${metric.label} trend`}
                    tone={metric.tone ?? (isSelected ? 'accent' : 'neutral')}
                    area={isSelected}
                    showLast={isSelected}
                    width={220}
                    height={34}
                    className="w-full"
                  />
                </Surface>
              </button>
            </div>
          )
        })}
      </div>

      {detail && selected && (
        <Presence present key={selected.id} animation="fade" duration={180}>
          <Surface variant="card" padding="lg" className="gap-3">
            <Text size="heading">{selected.label}</Text>
            {detail(selected)}
          </Surface>
        </Presence>
      )}
    </div>
  )
}
