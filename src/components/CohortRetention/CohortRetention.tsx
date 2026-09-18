'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { SegmentedControl } from '../SegmentedControl'
import { DRAW_IN_CLASS, useDrawIn } from '../internal/plot'

export type CohortRetentionMode = 'percent' | 'count'

export interface CohortRetentionCohort {
  /** Row heading — usually the signup period, “Mar 2026”. */
  label: string
  /** People who joined in this cohort. */
  size: number
  /** People still active in each period since joining, period 0 first. Leave off periods that have not happened. */
  retained: number[]
}

export interface CohortRetentionProps {
  /** One row per cohort, oldest first. */
  cohorts: CohortRetentionCohort[]
  /** Accessible name for the grid, also the table caption. */
  label: string
  /** Column heading for a period index. */
  periodLabel?: (period: number) => string
  /** Show shares or head counts. Omit for uncontrolled. */
  mode?: CohortRetentionMode
  /** Starting mode when uncontrolled. */
  defaultMode?: CohortRetentionMode
  onModeChange?: (mode: CohortRetentionMode) => void
  /** Show the percent / count switch above the grid. */
  showModeToggle?: boolean
  /** Add a weighted average row under the cohorts. */
  showAverage?: boolean
  /** Format head counts in the size column and in count mode. */
  formatCount?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/** Accent mixed into the surface in proportion to the share, floored so a small share is still tinted. */
const shade = (share: number) =>
  `color-mix(in oklab, var(--color-accent-strong) ${Math.round(8 + Math.max(0, Math.min(1, share)) * 86)}%, var(--color-surface))`

/**
 * The SaaS retention triangle: one row per signup cohort, one column per period
 * since signup, each cell the share of that cohort still active.
 *
 * It is a real table rather than a picture of one, because the reading people
 * do with it is tabular — across a row to see a cohort decay, down a column to
 * see whether newer cohorts hold on better. Shading carries that pattern at a
 * glance and the number stays printed in every cell. Cells darken with the
 * share itself, not a stepped scale, since the printed value already says
 * exactly how much.
 *
 * The average row is weighted by cohort size and only counts cohorts old
 * enough to have reached each period, so the right-hand columns are not
 * dragged down by cohorts that have simply not got there yet. Percent and
 * count switch in place. The grid is one tab stop; arrow keys move between
 * cells, Home and End along a row, Ctrl+Home and Ctrl+End to the corners.
 */
export function CohortRetention({
  cohorts,
  label,
  periodLabel = (period) => `Month ${period}`,
  mode: modeProp,
  defaultMode = 'percent',
  onModeChange,
  showModeToggle = true,
  showAverage = true,
  formatCount = (value) => value.toLocaleString(),
  className,
}: CohortRetentionProps) {
  const [ownMode, setOwnMode] = useState(defaultMode)
  const mode = modeProp ?? ownMode
  const drawn = useDrawIn()
  const [cursor, setCursor] = useState({ row: 0, column: 0 })
  const cells = useRef(new Map<string, HTMLElement | null>())
  const moveFocus = useRef(false)

  const periods = Math.max(0, ...cohorts.map((cohort) => cohort.retained.length))
  const average = Array.from({ length: periods }, (_, period) => {
    let retained = 0
    let size = 0
    for (const cohort of cohorts) {
      if (period >= cohort.retained.length) continue
      retained += cohort.retained[period]
      size += cohort.size
    }
    return size ? { retained, size } : null
  })
  const rows = [
    ...cohorts.map((cohort) => ({
      label: cohort.label,
      size: cohort.size,
      cells: cohort.retained.map((retained) => ({ retained, size: cohort.size })),
    })),
    ...(showAverage && cohorts.length
      ? [
          {
            label: 'Average',
            size: Math.round(cohorts.reduce((sum, cohort) => sum + cohort.size, 0) / cohorts.length),
            cells: average,
          },
        ]
      : []),
  ]
  const columns = periods + 2
  const at = { row: Math.min(cursor.row, rows.length - 1), column: Math.min(cursor.column, columns - 1) }

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    cells.current.get(`${at.row}:${at.column}`)?.focus()
  })

  const setMode = (next: CohortRetentionMode) => {
    setOwnMode(next)
    onModeChange?.(next)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const last = { row: rows.length - 1, column: columns - 1 }
    const moves: Record<string, () => { row: number; column: number }> = {
      ArrowRight: () => ({ ...at, column: Math.min(last.column, at.column + 1) }),
      ArrowLeft: () => ({ ...at, column: Math.max(0, at.column - 1) }),
      ArrowDown: () => ({ ...at, row: Math.min(last.row, at.row + 1) }),
      ArrowUp: () => ({ ...at, row: Math.max(0, at.row - 1) }),
      Home: () => (event.ctrlKey ? { row: 0, column: 0 } : { ...at, column: 0 }),
      End: () => (event.ctrlKey ? last : { ...at, column: last.column }),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveFocus.current = true
    setCursor(move())
  }

  const cellProps = (row: number, column: number) => ({
    ref: (element: HTMLElement | null) => {
      cells.current.set(`${row}:${column}`, element)
    },
    tabIndex: row === at.row && column === at.column ? 0 : -1,
    onFocus: () => setCursor({ row, column }),
  })

  const printed = (cell: { retained: number; size: number }) =>
    mode === 'percent' ? `${Math.round((cell.retained / (cell.size || 1)) * 100)}%` : formatCount(cell.retained)

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {showModeToggle && (
        <SegmentedControl
          label="Show retention as"
          size="sm"
          value={mode}
          onValueChange={setMode}
          className="self-start"
          options={[
            { value: 'percent', label: 'Percent' },
            { value: 'count', label: 'Users' },
          ]}
        />
      )}
      <div className="w-full overflow-x-auto">
        <table
          role="grid"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="w-full border-separate border-spacing-[3px] text-[11px]"
        >
          <thead>
            <tr>
              <th scope="col" className="px-2 pb-1 text-left font-semibold text-ink-faint">
                Cohort
              </th>
              <th scope="col" className="px-2 pb-1 text-right font-semibold text-ink-faint">
                Users
              </th>
              {Array.from({ length: periods }, (_, period) => (
                <th
                  key={period}
                  scope="col"
                  className="whitespace-nowrap px-1 pb-1 text-center font-semibold text-ink-faint"
                >
                  {periodLabel(period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isAverage = showAverage && rowIndex === cohorts.length
              return (
                <tr key={`${row.label}-${rowIndex}`}>
                  <th
                    scope="row"
                    {...cellProps(rowIndex, 0)}
                    className={cn(
                      'whitespace-nowrap rounded-[6px] px-2 py-1.5 text-left font-bold text-ink',
                      isAverage && 'border-t border-line text-ink-soft',
                    )}
                  >
                    {row.label}
                  </th>
                  <td
                    {...cellProps(rowIndex, 1)}
                    className="whitespace-nowrap rounded-[6px] px-2 py-1.5 text-right font-semibold tabular-nums text-ink-soft"
                  >
                    {isAverage ? `~${formatCount(row.size)}` : formatCount(row.size)}
                  </td>
                  {Array.from({ length: periods }, (_, period) => {
                    const cell = row.cells[period]
                    const share = cell ? cell.retained / (cell.size || 1) : 0
                    return (
                      <td
                        key={period}
                        {...cellProps(rowIndex, period + 2)}
                        className={cn(
                          'min-w-[52px] rounded-[6px] px-1 py-1.5 text-center tabular-nums transition-opacity',
                          DRAW_IN_CLASS,
                          cell ? (share >= 0.5 ? 'font-bold text-accent-ink' : 'font-semibold text-ink') : 'text-ink-faint',
                          isAverage && 'shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
                        )}
                        style={{
                          background: cell ? shade(share) : undefined,
                          opacity: drawn ? 1 : 0,
                          transitionDelay: drawn ? `${Math.min((rowIndex + period) * 14, 320)}ms` : '0ms',
                        }}
                      >
                        {cell ? (
                          printed(cell)
                        ) : (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="sr-only">No data yet</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
