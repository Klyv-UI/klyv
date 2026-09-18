import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Sparkline, type SparklineTone } from '../Sparkline'
import { TrendDelta, type TrendDeltaFormat } from '../TrendDelta'

export interface KpiStripItem {
  /** Stable key. Defaults to the label. */
  id?: string
  /** What is measured, such as “Net revenue”. */
  label: string
  /** The figure, already formatted — “$48.2k”, “2.4%”, “312 ms”. */
  value: ReactNode
  /** Change against the previous period. Its sign sets the arrow. */
  delta?: number
  /** How the delta is written. */
  deltaFormat?: TrendDeltaFormat
  /** Unit after a number delta. */
  deltaUnit?: string
  /** Down is good for this metric, so a fall is shown in the positive tone. */
  inverse?: boolean
  /** Recent values, oldest first, drawn as a sparkline under the figure. */
  trend?: number[]
  /** Small print under the figure, such as a target. */
  hint?: string
}

export interface KpiStripProps {
  /** The metrics, in reading order. */
  items: KpiStripItem[]
  /** Names the strip for assistive tech, such as “Last 30 days”. */
  label: string
  /** The comparison every delta is against, read with each one. */
  comparison?: string
  /** Smallest width an item takes before the row wraps, in pixels. */
  minItemWidth?: number
  /** Draw the strip as a card rather than bare on the page. */
  framed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A row of headline figures, divided by hairlines rather than boxed into cards.
 *
 * Five cards side by side read as five separate things; one strip reads as one
 * period seen five ways, which is what a summary row is. Each item is a label,
 * a figure, and a TrendDelta against the previous period, with the comparison
 * spoken once per delta so no figure is heard without its baseline.
 *
 * The dividers survive wrapping. Every item draws its own left and top rule,
 * and the strip hides the one pixel of each that lands on its outer edge, so a
 * narrow screen gets a tidy grid instead of rules dangling at line starts.
 * Metrics where down is good — churn, latency, refunds — set `inverse`.
 */
export function KpiStrip({ items, label, comparison, minItemWidth = 168, framed = false, className }: KpiStripProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        'overflow-hidden',
        framed && 'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <dl className="-ml-px -mt-px flex flex-wrap">
        {items.map((item) => {
          const tone: SparklineTone =
            item.delta === undefined || item.delta === 0
              ? 'neutral'
              : (item.delta > 0) !== Boolean(item.inverse)
                ? 'success'
                : 'danger'
          return (
            <div
              key={item.id ?? item.label}
              className="flex min-w-0 flex-1 flex-col gap-1.5 border-l border-t border-line px-5 py-4"
              style={{ flexBasis: minItemWidth }}
            >
              <dt className="truncate text-[12px] font-semibold text-ink-soft">{item.label}</dt>
              <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular-nums">
                  {item.value}
                </span>
                {item.delta !== undefined && (
                  <TrendDelta
                    value={item.delta}
                    format={item.deltaFormat}
                    unit={item.deltaUnit}
                    inverse={item.inverse}
                    context={comparison}
                    showContext={false}
                  />
                )}
              </dd>
              {item.trend && item.trend.length > 1 && (
                <dd>
                  <Sparkline
                    values={item.trend}
                    label={`${item.label} trend`}
                    tone={tone}
                    width={120}
                    height={24}
                    area
                  />
                </dd>
              )}
              {item.hint && <dd className="text-[11px] font-medium text-ink-faint">{item.hint}</dd>}
            </div>
          )
        })}
      </dl>
      {comparison && (
        <p aria-hidden="true" className="border-t border-line px-5 py-2 text-[11px] font-medium text-ink-faint">
          Changes {comparison}
        </p>
      )}
    </section>
  )
}
