'use client'

import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Tooltip } from '../Tooltip'

export interface HeatmapDay {
  /** ISO yyyy-mm-dd. */
  date: string
  value: number
}

export interface ActivityHeatmapProps {
  days: HeatmapDay[]
  /** Accessible name for the grid. */
  label: string
  /** Number of weeks to show, counting back from the last day supplied. */
  weeks?: number
  /** Turn a value into tooltip text. */
  format?: (value: number, date: string) => string
  /** Buckets for the colour ramp. Values are placed by quantile. */
  steps?: number
  /** Merged last, so it wins. */
  className?: string
}

const RAMP = [
  'bg-track',
  'bg-accent-soft',
  'bg-accent',
  'bg-accent-strong',
  'bg-[#8FC421]',
] as const

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * A calendar density grid: one cell per day, coloured by how much happened.
 *
 * It answers a question no chart in the library answers well — when did this
 * happen, across months, at a glance. A line chart shows the shape of a series;
 * a heatmap shows rhythm: weekends, pay days, the quiet fortnight in August.
 *
 * The ramp uses quantiles rather than a linear scale, because activity data is
 * almost always skewed and a linear ramp leaves the whole grid in the lowest
 * bucket. Every cell carries its date and value as text, so the grid is
 * readable without the colour and without a pointer.
 */
export function ActivityHeatmap({
  days,
  label,
  weeks = 26,
  format = (value) => `${value} transactions`,
  steps = 5,
  className,
}: ActivityHeatmapProps) {
  const { columns, thresholds, total } = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day.value]))
    const last = days.length ? new Date(days[days.length - 1].date) : new Date()

    // Walk back to the Monday that starts the first visible week.
    const end = new Date(last)
    end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7) - 1))
    const start = new Date(end)
    start.setDate(start.getDate() - weeks * 7 + 1)

    const grid: { date: string; value: number }[][] = []
    for (let week = 0; week < weeks; week += 1) {
      const column: { date: string; value: number }[] = []
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start)
        date.setDate(start.getDate() + week * 7 + day)
        const iso = toISO(date)
        column.push({ date: iso, value: byDate.get(iso) ?? 0 })
      }
      grid.push(column)
    }

    const positives = days.map((day) => day.value).filter((value) => value > 0).sort((a, b) => a - b)
    const cuts = Array.from({ length: Math.max(1, steps - 1) }, (_, index) => {
      const position = Math.floor(((index + 1) / steps) * positives.length)
      return positives[Math.min(position, positives.length - 1)] ?? 0
    })

    return {
      columns: grid,
      thresholds: cuts,
      total: days.reduce((sum, day) => sum + day.value, 0),
    }
  }, [days, weeks, steps])

  const bucketOf = (value: number) => {
    if (value <= 0) return 0
    const index = thresholds.findIndex((threshold) => value <= threshold)
    return index === -1 ? RAMP.length - 1 : Math.min(index + 1, RAMP.length - 1)
  }

  const monthMarks = columns.map((column, index) => {
    const first = new Date(column[0].date)
    const previous = index > 0 ? new Date(columns[index - 1][0].date) : null
    return !previous || first.getMonth() !== previous.getMonth() ? MONTHS[first.getMonth()] : ''
  })

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex min-w-max gap-1">
          <div className="flex shrink-0 flex-col gap-[3px] pr-1 pt-[15px]">
            {WEEKDAY_LABELS.map((day, index) => (
              <span key={index} className="flex h-[12px] items-center">
                <Text as="span" size="micro" weight="medium" tone="faint">
                  {day}
                </Text>
              </span>
            ))}
          </div>

          <div role="grid" aria-label={label} className="flex gap-[3px]">
            {columns.map((column, columnIndex) => (
              <div key={columnIndex} role="row" className="flex flex-col gap-[3px]">
                <span className="h-3">
                  <Text as="span" size="micro" weight="medium" tone="faint">
                    {monthMarks[columnIndex]}
                  </Text>
                </span>
                {column.map((cell) => (
                  <Tooltip
                    key={cell.date}
                    delay={80}
                    content={`${cell.date}: ${format(cell.value, cell.date)}`}
                  >
                    <span
                      role="gridcell"
                      tabIndex={-1}
                      className={cn(
                        'size-3 rounded-[var(--radius-3)] transition-transform hover:scale-125',
                        RAMP[bucketOf(cell.value)],
                      )}
                    >
                      <VisuallyHidden>
                        {cell.date}: {format(cell.value, cell.date)}
                      </VisuallyHidden>
                    </span>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text size="caption" tone="faint" tabular>
          {total.toLocaleString('en-US')} in the last {weeks} weeks
        </Text>
        <div className="flex items-center gap-1.5">
          <Text as="span" size="caption" tone="faint">
            Less
          </Text>
          {RAMP.map((tone) => (
            <span key={tone} className={cn('size-3 rounded-[var(--radius-3)]', tone)} aria-hidden="true" />
          ))}
          <Text as="span" size="caption" tone="faint">
            More
          </Text>
        </div>
      </div>
    </div>
  )
}
