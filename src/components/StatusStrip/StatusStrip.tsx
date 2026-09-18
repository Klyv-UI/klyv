'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Legend } from '../Legend'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, useChartCursor, useDrawIn } from '../internal/plot'

/** The four states a status page publishes. */
export type StatusStripStatus = 'operational' | 'degraded' | 'outage' | 'unknown'

export interface StatusInterval {
  /** Label for this slice — a date, an hour, a build number. Shown unless `date` is given. */
  id: string
  /** Fraction of the interval that was healthy, 0 to 1. Derived from `downtimeMinutes` or `status` when omitted. */
  uptime?: number
  /** The status a person declared. Beats the ratio thresholds; `'unknown'` counts as missing. */
  status?: StatusStripStatus
  /** One line per incident, shown in the tip and the hidden table. */
  incidents?: string[]
  /** Minutes of downtime in a day-long interval. Gives `uptime` as 1 − minutes / 1440 when that is omitted. */
  downtimeMinutes?: number
  /** Formatted as the label when given, in place of `id`. */
  date?: Date
  /** Shown in the tip. "2 incidents, 14 minutes" and so on. */
  detail?: string
  /** No data for this interval — drawn as a gap, never as an outage. */
  missing?: boolean
}

export interface StatusStripProps {
  /** Oldest first. Each carries a measured `uptime`, a declared `status`, or both. */
  intervals: StatusInterval[]
  /** Accessible name — which service this describes. */
  label: string
  /** Caption at the left-hand end of the strip. */
  from?: string
  /** Caption at the right-hand end of the strip. */
  to?: string
  /** Below this counts as degraded; below `down` counts as an outage. Ignored where a status is declared. */
  degraded?: number
  /** Ratio below which an interval counts as down. Ignored where a status is declared. */
  down?: number
  /** Uptime to print, 0 to 1. Averaged from the measured intervals when omitted. */
  uptime?: number
  /** Show the status key under the strip — once under a stack of strips is enough. */
  showLegend?: boolean
  /** Bar height in pixels. Widths are flexible. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

type Tone = 'operational' | 'degraded' | 'outage' | 'missing'

const TONES: Record<Tone, { name: string; className: string; color: string }> = {
  operational: { name: 'Operational', className: 'bg-success', color: 'var(--color-success)' },
  degraded: { name: 'Degraded', className: 'bg-warning', color: 'var(--color-warning)' },
  outage: { name: 'Outage', className: 'bg-danger', color: 'var(--color-danger)' },
  missing: { name: 'No data', className: 'bg-line', color: 'var(--color-line)' },
}

const isMissing = (interval: StatusInterval) => Boolean(interval.missing) || interval.status === 'unknown'

const uptimeOf = (interval: StatusInterval) =>
  interval.uptime ??
  (interval.downtimeMinutes !== undefined
    ? Math.max(0, 1 - interval.downtimeMinutes / 1440)
    : interval.status === 'outage'
      ? 0
      : 1)

const nameOf = (interval: StatusInterval) => (interval.date ? formatDate(interval.date) : interval.id)

/**
 * The uptime strip from a status page: one bar per interval, coloured by how
 * much of it was healthy — or by the status a person declared for it.
 *
 * Two inputs, because status pages have two sources of truth. A monitor
 * measures a ratio, and the thresholds turn it into a colour. An incident
 * process declares a status and names the incidents behind it, and that
 * declaration wins over any ratio, so the strip never shows green on a day
 * someone published an outage.
 *
 * Missing data is drawn as its own state, not as an outage. Every status page
 * that conflates the two ends up claiming downtime for the week before it was
 * installed, and the distinction between "we were down" and "we were not
 * watching" is exactly the one a status page exists to make. Missing intervals
 * are left out of the average.
 *
 * Colour is never the only signal. The strip is one tab stop; arrow keys walk
 * the intervals, the tip and a live region say what each one was, and every
 * figure is also in a hidden table.
 */
export function StatusStrip({
  intervals,
  label,
  from,
  to,
  degraded = 0.995,
  down = 0.9,
  uptime,
  showLegend = false,
  height = 34,
  className,
}: StatusStripProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const { active, setActive, keyProps } = useChartCursor(intervals.length)

  const measured = intervals.filter((interval) => !isMissing(interval))
  const average =
    uptime ??
    (measured.length === 0 ? null : measured.reduce((sum, interval) => sum + uptimeOf(interval), 0) / measured.length)
  const printed = average === null ? 'No data' : `${(average * 100).toFixed(2)}% uptime`

  const toneFor = (interval: StatusInterval): Tone => {
    if (isMissing(interval)) return 'missing'
    if (interval.status) return interval.status as Exclude<StatusStripStatus, 'unknown'>
    const ratio = uptimeOf(interval)
    if (ratio < down) return 'outage'
    if (ratio < degraded) return 'degraded'
    return 'operational'
  }

  const describe = (interval: StatusInterval) => {
    if (isMissing(interval)) return 'No data'
    return [
      `${(uptimeOf(interval) * 100).toFixed(2)}% — ${TONES[toneFor(interval)].name.toLowerCase()}`,
      interval.downtimeMinutes ? `${interval.downtimeMinutes} min down` : null,
      interval.detail ?? null,
      interval.incidents?.length ? interval.incidents.join('; ') : null,
    ]
      .filter(Boolean)
      .join(', ')
  }

  const current = active === null ? null : intervals[active]

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Text size="caption" weight="bold">
          {label}
        </Text>
        {average !== null && (
          <Text size="caption" tone="faint" tabular>
            {printed}
          </Text>
        )}
      </div>

      <div className="relative">
        <div
          // Grid rather than flex: bars are equal tracks, so ninety of them
          // compress on a phone and stretch on a monitor without a breakpoint.
          className="grid auto-cols-fr grid-flow-col gap-[3px] rounded-[var(--radius-3)] outline-offset-4"
          style={{ height }}
          role="img"
          aria-label={`${label}: ${printed} over ${intervals.length} intervals. Use arrow keys to step through them.`}
          aria-describedby={tableId}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {intervals.map((interval, index) => {
            const tone = toneFor(interval)
            return (
              <span
                key={interval.id}
                onPointerEnter={() => setActive(index)}
                className={cn(
                  'block h-full w-full rounded-[var(--radius-2)] transition-transform',
                  DRAW_IN_CLASS,
                  TONES[tone].className,
                  tone === 'missing' && 'opacity-60',
                  active === index && 'outline outline-2 outline-offset-1 outline-ink',
                )}
                style={{
                  transformOrigin: 'bottom',
                  transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
                  transitionDelay: drawn ? `${Math.min(index * 4, 360)}ms` : '0ms',
                }}
              />
            )
          })}
        </div>

        {current && active !== null && (
          <PlotTip x={active + 0.5} y={0.4} width={intervals.length} height={1}>
            <div
              aria-hidden="true"
              className="flex w-max max-w-[240px] flex-col gap-1.5 rounded-[var(--radius-glyph)] border border-line bg-surface p-2.5 shadow-[var(--shadow-float)]"
            >
              <Text size="caption" weight="bold" tone="faint">
                {nameOf(current)}
              </Text>
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: TONES[toneFor(current)].color }}
                />
                <Text as="span" size="caption" weight="bold" className="flex-1">
                  {TONES[toneFor(current)].name}
                </Text>
                {!isMissing(current) && (
                  <Text as="span" size="caption" weight="medium" tone="soft" tabular>
                    {current.downtimeMinutes
                      ? `${current.downtimeMinutes} min`
                      : `${(uptimeOf(current) * 100).toFixed(2)}%`}
                  </Text>
                )}
              </span>
              {current.detail && (
                <Text size="caption" weight="medium" tone="soft" leading="normal">
                  {current.detail}
                </Text>
              )}
              {current.incidents?.length ? (
                <ul className="flex list-none flex-col gap-1 border-t border-line pt-1.5">
                  {current.incidents.map((incident, index) => (
                    <li key={index}>
                      <Text size="caption" weight="medium" tone="soft" leading="normal">
                        {incident}
                      </Text>
                    </li>
                  ))}
                </ul>
              ) : current.status && current.status !== 'unknown' ? (
                <Text size="caption" weight="medium" tone="faint">
                  No incidents
                </Text>
              ) : null}
            </div>
          </PlotTip>
        )}
      </div>

      {(from || to) && (
        <div aria-hidden="true" className="flex items-center justify-between gap-3">
          <Text size="micro" tone="faint">
            {from}
          </Text>
          <Text size="micro" tone="faint">
            {to}
          </Text>
        </div>
      )}

      {showLegend && (
        <Legend
          label="Status key"
          series={(Object.keys(TONES) as Tone[]).map((tone) => ({
            label: TONES[tone].name,
            color: TONES[tone].color,
          }))}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label} uptime by interval</caption>
          <tbody>
            {intervals.map((interval) => (
              <tr key={interval.id}>
                <th scope="row">{nameOf(interval)}</th>
                <td>{describe(interval)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={current ? `${nameOf(current)}: ${describe(current)}` : ''} />
    </div>
  )
}
