'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Tooltip } from '../Tooltip'

export interface StatusInterval {
  /** Label for this slice — a date, an hour, a build number. */
  id: string
  /** Fraction of the interval that was healthy, 0 to 1. */
  uptime: number
  /** Shown in the tip. "2 incidents, 14 minutes" and so on. */
  detail?: string
  /** No data for this interval — drawn as a gap, never as an outage. */
  missing?: boolean
}

export interface StatusStripProps {
  intervals: StatusInterval[]
  /** Accessible name — which service this describes. */
  label: string
  /** Caption at each end of the strip. */
  from?: string
  /** Caption at the right-hand end of the strip. */
  to?: string
  /** Below this counts as degraded; below `down` counts as an outage. */
  degraded?: number
  /** Ratio at or above which an interval counts as down. */
  down?: number
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The uptime strip from a status page: one bar per interval, coloured by how
 * much of it was healthy.
 *
 * Missing data is drawn as its own state, not as an outage. Every status page
 * that conflates the two ends up claiming downtime for the week before it was
 * installed, and the distinction between "we were down" and "we were not
 * watching" is exactly the one a status page exists to make.
 *
 * Colour is never the only signal. Each bar carries its figure in a tooltip and
 * in a hidden table, and the summary states the period in words — so the strip
 * is readable at a glance and still answers precisely when asked.
 *
 * Bars are equal grid tracks rather than fixed widths, so ninety days compress
 * on a phone and stretch on a monitor without the caller choosing a breakpoint.
 */
export function StatusStrip({
  intervals,
  label,
  from,
  to,
  degraded = 0.995,
  down = 0.9,
  height = 34,
  className,
}: StatusStripProps) {
  const tableId = useId()

  const measured = intervals.filter((interval) => !interval.missing)
  const average =
    measured.length === 0
      ? null
      : measured.reduce((sum, interval) => sum + interval.uptime, 0) / measured.length

  const toneFor = (interval: StatusInterval) => {
    if (interval.missing) return { className: 'bg-line', text: 'no data' }
    if (interval.uptime < down) return { className: 'bg-danger', text: 'major outage' }
    if (interval.uptime < degraded) return { className: 'bg-warning', text: 'degraded' }
    return { className: 'bg-success', text: 'operational' }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Text size="caption" weight="bold">
          {label}
        </Text>
        {average !== null && (
          <Text size="caption" tone="faint" tabular>
            {(average * 100).toFixed(2)}% uptime
          </Text>
        )}
      </div>

      <div
        // Grid rather than flex: each bar is wrapped in a Tooltip anchor, and
        // a grid item stretches to its cell in both axes without the anchor
        // needing to carry any classes of its own.
        className="grid auto-cols-fr grid-flow-col gap-[3px]"
        style={{ height }}
        role="img"
        aria-label={`${label} uptime`}
        aria-describedby={tableId}
      >
        {intervals.map((interval) => {
          const tone = toneFor(interval)
          return (
            <Tooltip
              key={interval.id}
              content={
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold">{interval.id}</span>
                  <span>
                    {interval.missing
                      ? 'No data'
                      : `${(interval.uptime * 100).toFixed(2)}% — ${tone.text}`}
                  </span>
                  {interval.detail && <span>{interval.detail}</span>}
                </span>
              }
            >
              <span
                className={cn(
                  'block h-full w-full rounded-[2px] transition-opacity hover:opacity-70',
                  tone.className,
                  interval.missing && 'opacity-60',
                )}
              />
            </Tooltip>
          )
        })}
      </div>

      {(from || to) && (
        <div className="flex items-center justify-between gap-3">
          <Text size="micro" tone="faint">
            {from}
          </Text>
          <Text size="micro" tone="faint">
            {to}
          </Text>
        </div>
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label} uptime by interval</caption>
          <tbody>
            {intervals.map((interval) => (
              <tr key={interval.id}>
                <th scope="row">{interval.id}</th>
                <td>
                  {interval.missing ? 'No data' : `${(interval.uptime * 100).toFixed(2)}%`}
                  {interval.detail ? `, ${interval.detail}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}
