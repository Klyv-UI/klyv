'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Legend } from '../Legend'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, useChartCursor, useDrawIn } from '../internal/plot'

export type UptimeBarStatus = 'operational' | 'degraded' | 'outage' | 'unknown'

export interface UptimeBarDay {
  /** A Date is formatted for you; a string is shown as given. */
  date: Date | string
  status: UptimeBarStatus
  /** One line per incident, shown in the tooltip and the table. */
  incidents?: string[]
  /** Minutes of downtime that day. When any day has it, uptime is computed from minutes. */
  downtimeMinutes?: number
}

export interface UptimeBarProps {
  /** Oldest first — usually the last 90 days. */
  days: UptimeBarDay[]
  /** The service or component this row describes. */
  label: string
  /** Uptime percentage to print, 0 to 100. Computed from `days` when omitted. */
  uptime?: number
  /** Caption under the left end of the row. Defaults to "N days ago". */
  from?: string
  /** Caption under the right end of the row. */
  to?: string
  /** Show the status key under the row. */
  showLegend?: boolean
  /** Bar height in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const STATUS: Record<UptimeBarStatus, { name: string; className: string; color: string }> = {
  operational: { name: 'Operational', className: 'bg-success', color: 'var(--color-success)' },
  degraded: { name: 'Degraded', className: 'bg-warning', color: 'var(--color-warning)' },
  outage: { name: 'Outage', className: 'bg-danger', color: 'var(--color-danger)' },
  unknown: { name: 'No data', className: 'bg-line-strong', color: 'var(--color-line-strong)' },
}

/**
 * One status-page row: a thin bar per day, the day’s worst status as its colour,
 * and the uptime percentage for the period beside the name.
 *
 * Unlike StatusStrip, which colours by a measured ratio, this takes the status
 * a person declared — the four states a status page publishes — plus the
 * incidents behind it, so the tooltip can say what happened rather than only
 * how much. Days with no data are excluded from the percentage, not counted as
 * up or down. Without minutes, an outage day counts as down and a degraded day
 * as up; pass `downtimeMinutes` or `uptime` when the real figure is known.
 *
 * The row is one tab stop; arrow keys walk the days, and each day is also a row
 * in the hidden table.
 */
export function UptimeBar({
  days,
  label,
  uptime,
  from,
  to = 'Today',
  showLegend = false,
  height = 32,
  className,
}: UptimeBarProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const { active, setActive, keyProps } = useChartCursor(days.length)

  const measured = days.filter((day) => day.status !== 'unknown')
  const byMinutes = days.some((day) => day.downtimeMinutes !== undefined)
  const computed =
    measured.length === 0
      ? null
      : byMinutes
        ? 100 * (1 - measured.reduce((sum, day) => sum + (day.downtimeMinutes ?? 0), 0) / (measured.length * 1440))
        : (100 * measured.filter((day) => day.status !== 'outage').length) / measured.length
  const percent = uptime ?? computed
  const printed = percent === null ? 'No data' : `${percent.toFixed(2)}% uptime`

  const dateOf = (day: UptimeBarDay) => (typeof day.date === 'string' ? day.date : formatDate(day.date))
  const detail = (day: UptimeBarDay) =>
    [
      STATUS[day.status].name,
      day.downtimeMinutes ? `${day.downtimeMinutes} min down` : null,
      day.incidents?.length ? day.incidents.join('; ') : day.status === 'unknown' ? null : 'No incidents',
    ]
      .filter(Boolean)
      .join(', ')

  const current = active === null ? null : days[active]

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Text size="label" weight="bold">
          {label}
        </Text>
        <Text size="caption" weight="semibold" tone="soft" tabular>
          {printed}
        </Text>
      </div>

      <div className="relative">
        <div
          role="img"
          aria-label={`${label}: ${printed} over ${days.length} days. Use arrow keys to step through the days.`}
          aria-describedby={tableId}
          className="flex items-stretch gap-px rounded-[3px] outline-offset-4 sm:gap-[2px]"
          style={{ height }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {days.map((day, index) => (
            <span
              key={index}
              onPointerEnter={() => setActive(index)}
              className={cn(
                'min-w-0 flex-1 rounded-[2px] transition-transform',
                DRAW_IN_CLASS,
                STATUS[day.status].className,
                active === index && 'outline outline-2 outline-offset-1 outline-ink',
              )}
              style={{
                transformOrigin: 'bottom',
                transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
                transitionDelay: drawn ? `${Math.min(index * 4, 360)}ms` : '0ms',
              }}
            />
          ))}
        </div>

        {current && active !== null && (
          <PlotTip x={active + 0.5} y={0.4} width={days.length} height={1}>
            <div
              aria-hidden="true"
              className="flex w-max max-w-[240px] flex-col gap-1.5 rounded-[var(--radius-glyph)] border border-line bg-surface p-2.5 shadow-[var(--shadow-float)]"
            >
              <Text size="caption" weight="bold" tone="faint">
                {dateOf(current)}
              </Text>
              <span className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS[current.status].color }} />
                <Text as="span" size="caption" weight="bold" className="flex-1">
                  {STATUS[current.status].name}
                </Text>
                {current.downtimeMinutes ? (
                  <Text as="span" size="caption" weight="medium" tone="soft" tabular>
                    {current.downtimeMinutes} min
                  </Text>
                ) : null}
              </span>
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
              ) : current.status !== 'unknown' ? (
                <Text size="caption" weight="medium" tone="faint">
                  No incidents
                </Text>
              ) : null}
            </div>
          </PlotTip>
        )}
      </div>

      <div aria-hidden="true" className="flex items-center justify-between gap-3">
        <Text as="span" size="micro" weight="medium" tone="faint">
          {from ?? `${days.length} days ago`}
        </Text>
        <Text as="span" size="micro" weight="medium" tone="faint">
          {to}
        </Text>
      </div>

      {showLegend && (
        <Legend
          label="Status key"
          series={(Object.keys(STATUS) as UptimeBarStatus[]).map((status) => ({
            label: STATUS[status].name,
            color: STATUS[status].color,
          }))}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label} status by day</caption>
          <tbody>
            {days.map((day, index) => (
              <tr key={index}>
                <th scope="row">{dateOf(day)}</th>
                <td>{detail(day)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={current ? `${dateOf(current)}: ${detail(current)}` : ''} />
    </div>
  )
}
