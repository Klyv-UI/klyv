'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { ChartTooltip } from '../ChartTooltip'
import { SegmentedControl } from '../SegmentedControl'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, TICK_CLASS, svgId, useChartCursor, useDrawIn } from '../internal/plot'

export type GanttChartZoom = 'day' | 'week' | 'month'

export interface GanttChartTask {
  id: string
  label: string
  /** Rows are grouped under a heading per lane — a team, a workstream. */
  lane?: string
  start: Date
  /** Inclusive of the whole end day. Ignored for milestones. */
  end: Date
  /** Share complete, 0 to 1. Drawn as a fill inside the bar. */
  progress?: number
  /** Ids of tasks that must finish first. Drawn as arrows. */
  dependsOn?: string[]
  /** A single moment rather than a span. Drawn as a diamond on `start`. */
  milestone?: boolean
}

export interface GanttChartProps {
  tasks: GanttChartTask[]
  /** Accessible name for the chart. */
  label: string
  /** Controlled zoom level. */
  zoom?: GanttChartZoom
  /** Zoom level when uncontrolled. */
  defaultZoom?: GanttChartZoom
  onZoomChange?: (zoom: GanttChartZoom) => void
  /** Show the day / week / month switch above the chart. */
  showZoomControl?: boolean
  /** Where the today line is drawn. Pass it explicitly when rendering on a server. */
  today?: Date
  /** Show the column of task names beside the timeline. */
  showTaskList?: boolean
  /** Height of each row in pixels. */
  rowHeight?: number
  /** Merged last, so it wins. */
  className?: string
}

const DAY = 86_400_000
const UNIT: Record<GanttChartZoom, number> = { day: 30, week: 9, month: 2.6 }
const HEADER = 30

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
const short = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * A plan as bars on a calendar: one row per task, grouped by lane, with progress
 * inside each bar, arrows for what waits on what, and a line for today.
 *
 * It is drawn in real pixels rather than a scaled viewBox, because a plan's
 * length is its content: stretching six months into the card's width makes day
 * zoom unreadable, so the timeline scrolls instead and the task names stay put.
 * Zoom changes pixels per day, not the data, so switching never loses your place
 * in the plan. One tab stop; arrows walk the tasks in row order and scroll each
 * into view, and the full plan is also in a hidden table.
 */
export function GanttChart({
  tasks,
  label,
  zoom: zoomProp,
  defaultZoom = 'week',
  onZoomChange,
  showZoomControl = true,
  today: todayProp,
  showTaskList = true,
  rowHeight = 34,
  className,
}: GanttChartProps) {
  const tableId = useId()
  const markerId = svgId(`${tableId}arrow`)
  const drawn = useDrawIn()
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [listWidth, setListWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoomState, setZoomState] = useState(defaultZoom)
  const zoom = zoomProp ?? zoomState
  const setZoom = (next: GanttChartZoom) => {
    if (zoomProp === undefined) setZoomState(next)
    onZoomChange?.(next)
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const measure = () => {
      if (node.clientWidth > 0) setWidth(node.clientWidth)
      setListWidth(listRef.current?.offsetWidth ?? 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [showTaskList])

  const today = startOfDay(todayProp ?? new Date())
  const rows: ({ kind: 'lane'; lane: string } | { kind: 'task'; task: GanttChartTask; order: number })[] = []
  const lanes = [...new Set(tasks.map((task) => task.lane ?? ''))]
  const ordered: GanttChartTask[] = []
  for (const lane of lanes) {
    if (lane) rows.push({ kind: 'lane', lane })
    for (const task of tasks.filter((entry) => (entry.lane ?? '') === lane)) {
      rows.push({ kind: 'task', task, order: ordered.length })
      ordered.push(task)
    }
  }
  const { active, setActive, keyProps } = useChartCursor(ordered.length)

  let first = today
  let last = today
  for (const task of tasks) {
    if (task.start < first) first = task.start
    const end = task.milestone ? task.start : task.end
    if (end > last) last = end
  }
  let origin = addDays(first, zoom === 'day' ? -1 : -3)
  if (zoom === 'week') origin = addDays(origin, -((origin.getDay() + 6) % 7))
  if (zoom === 'month') origin = new Date(origin.getFullYear(), origin.getMonth(), 1)
  const unit = UNIT[zoom]
  const span = daysBetween(origin, last) + (zoom === 'month' ? 21 : 6)
  const chartWidth = Math.max(width, span * unit)
  const height = HEADER + rows.length * rowHeight + 8
  const toX = (date: Date) => daysBetween(origin, date) * unit
  const rowY = new Map<string, number>()
  rows.forEach((row, index) => row.kind === 'task' && rowY.set(row.task.id, HEADER + index * rowHeight + rowHeight / 2))

  const ticks: { date: Date; text: string; major: boolean }[] = []
  for (let offset = 0; offset * unit <= chartWidth; offset += 1) {
    const date = addDays(origin, offset)
    if (zoom === 'day') ticks.push({ date, text: String(date.getDate()), major: date.getDate() === 1 || offset === 0 })
    else if (zoom === 'week' && date.getDay() === 1) ticks.push({ date, text: short(date), major: false })
    else if (zoom === 'month' && date.getDate() === 1)
      ticks.push({ date, text: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), major: false })
  }

  const current = active === null ? null : ordered[active]

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !current) return
    const x = toX(current.start)
    if (x < node.scrollLeft + 16 || x > node.scrollLeft + node.clientWidth - 48) node.scrollLeft = Math.max(0, x - 48)
    // Scroll follows the cursor only; zoom and width changes do not yank the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const describe = (task: GanttChartTask) =>
    task.milestone
      ? `${task.label}: milestone on ${short(task.start)}`
      : `${task.label}: ${short(task.start)} to ${short(task.end)}, ${Math.round((task.progress ?? 0) * 100)}% complete${
          task.dependsOn?.length
            ? `, after ${task.dependsOn.map((id) => tasks.find((t) => t.id === id)?.label ?? id).join(', ')}`
            : ''
        }`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {showZoomControl && (
        <SegmentedControl
          label="Timeline zoom"
          size="sm"
          value={zoom}
          onValueChange={setZoom}
          className="self-end"
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      )}
      <div className="relative w-full">
        <div className="flex w-full overflow-hidden rounded-[var(--radius-glyph)] border border-line">
          {showTaskList && (
            <div
              ref={listRef}
              aria-hidden="true"
              className="w-[34%] max-w-[220px] shrink-0 border-r border-line bg-surface-sunken"
            >
              <div style={{ height: HEADER }} className="border-b border-line" />
              {rows.map((row) => (
                <div
                  key={row.kind === 'lane' ? `lane-${row.lane}` : row.task.id}
                  style={{ height: rowHeight }}
                  className={cn(
                    'flex items-center truncate px-3',
                    row.kind === 'lane'
                      ? 'text-[10px] font-bold uppercase tracking-wider text-ink-faint'
                      : cn('text-[12px] font-medium text-ink-soft', row.order === active && 'text-ink'),
                  )}
                >
                  <span className="truncate">{row.kind === 'lane' ? row.lane : row.task.label}</span>
                </div>
              ))}
            </div>
          )}
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-x-auto"
            onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          >
            <div className="relative" style={{ width: chartWidth }}>
              <svg
                role="img"
                aria-label={`${label}. ${ordered.length} tasks; use arrow keys to step through them.`}
                aria-describedby={tableId}
                width={chartWidth}
                height={height}
                className="block outline-offset-[-2px]"
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const row = rows[Math.floor((event.clientY - rect.top - HEADER) / rowHeight)]
                  setActive(row?.kind === 'task' ? row.order : null)
                }}
                onPointerLeave={() => setActive(null)}
                {...keyProps}
              >
                <defs>
                  <marker
                    id={markerId}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0 0L8 4L0 8z" className="fill-ink-faint" />
                  </marker>
                </defs>
                {rows.map((row, index) =>
                  row.kind === 'lane' ? (
                    <rect
                      key={`band-${row.lane}`}
                      x={0}
                      y={HEADER + index * rowHeight}
                      width={chartWidth}
                      height={rowHeight}
                      className="fill-surface-sunken"
                    />
                  ) : (
                    row.order === active && (
                      <rect
                        key="hover"
                        x={0}
                        y={HEADER + index * rowHeight}
                        width={chartWidth}
                        height={rowHeight}
                        className="fill-surface-muted"
                      />
                    )
                  ),
                )}
                {ticks.map((tick) => (
                  <g key={tick.date.getTime()}>
                    <line
                      x1={toX(tick.date)}
                      x2={toX(tick.date)}
                      y1={HEADER - 6}
                      y2={height}
                      className={tick.major ? 'stroke-line-strong' : 'stroke-line'}
                      strokeWidth="1"
                    />
                    <text
                      x={toX(tick.date) + (zoom === 'day' ? unit / 2 : 4)}
                      y={18}
                      textAnchor={zoom === 'day' ? 'middle' : 'start'}
                      className={TICK_CLASS}
                    >
                      {tick.text}
                    </text>
                  </g>
                ))}
                <line x1={0} x2={chartWidth} y1={HEADER} y2={HEADER} className="stroke-line" strokeWidth="1" />

                {ordered.flatMap((task) =>
                  (task.dependsOn ?? []).map((id) => {
                    const from = ordered.find((entry) => entry.id === id)
                    if (!from) return null
                    const x1 = from.milestone ? toX(from.start) + unit / 2 + 7 : toX(addDays(from.end, 1))
                    const y1 = rowY.get(from.id) ?? 0
                    const x2 = task.milestone ? toX(task.start) + unit / 2 - 8 : toX(task.start) - 1
                    const y2 = rowY.get(task.id) ?? 0
                    const elbow = Math.max(x1 + 6, Math.min(x2 - 8, x1 + 10))
                    return (
                      <path
                        key={`${id}-${task.id}`}
                        d={`M${x1} ${y1}H${elbow}V${y2}H${x2}`}
                        fill="none"
                        className={cn('stroke-ink-faint transition-opacity', DRAW_IN_CLASS)}
                        strokeWidth="1.25"
                        markerEnd={`url(#${markerId})`}
                        opacity={
                          drawn ? (active === null || current?.id === task.id || current?.id === id ? 0.9 : 0.25) : 0
                        }
                      />
                    )
                  }),
                )}

                {ordered.map((task, index) => {
                  const y = rowY.get(task.id) ?? 0
                  const dim = active !== null && active !== index
                  if (task.milestone) {
                    const x = toX(task.start) + unit / 2
                    return (
                      <path
                        key={task.id}
                        d={`M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}z`}
                        className={cn('fill-ink transition-[opacity]', DRAW_IN_CLASS)}
                        opacity={drawn ? (dim ? 0.45 : 1) : 0}
                      />
                    )
                  }
                  const x = toX(task.start)
                  const barWidth = Math.max(unit, toX(addDays(task.end, 1)) - x)
                  const progress = Math.min(1, Math.max(0, task.progress ?? 0))
                  const barHeight = Math.min(18, rowHeight - 12)
                  return (
                    <g
                      key={task.id}
                      opacity={dim ? 0.55 : 1}
                      className={cn('transition-transform', DRAW_IN_CLASS)}
                      style={{
                        transformBox: 'fill-box',
                        transformOrigin: 'left center',
                        transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                        transitionDelay: drawn ? `${Math.min(index * 30, 300)}ms` : '0ms',
                      }}
                    >
                      <rect
                        x={x}
                        y={y - barHeight / 2}
                        width={barWidth}
                        height={barHeight}
                        rx={5}
                        fill="color-mix(in oklab, var(--color-accent-strong) 32%, var(--color-surface))"
                      />
                      <rect
                        x={x}
                        y={y - barHeight / 2}
                        width={barWidth * progress}
                        height={barHeight}
                        rx={5}
                        fill="var(--color-accent-strong)"
                      />
                      {active === index && (
                        <rect
                          x={x - 1.5}
                          y={y - barHeight / 2 - 1.5}
                          width={barWidth + 3}
                          height={barHeight + 3}
                          rx={6}
                          fill="none"
                          className="stroke-ink"
                          strokeWidth="1.5"
                        />
                      )}
                      {!showTaskList && (
                        <text
                          x={x + barWidth + 6}
                          y={y}
                          dominantBaseline="middle"
                          className="fill-ink-soft text-[10px] font-semibold"
                        >
                          {task.label}
                        </text>
                      )}
                    </g>
                  )
                })}

                {today >= origin && toX(today) <= chartWidth && (
                  <g>
                    <line
                      x1={toX(today) + unit / 2}
                      x2={toX(today) + unit / 2}
                      y1={HEADER - 4}
                      y2={height}
                      stroke="var(--color-danger)"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={toX(today) + unit / 2 - 16}
                      y={HEADER - 12}
                      width={32}
                      height={12}
                      rx={6}
                      fill="var(--color-danger)"
                    />
                    <text
                      x={toX(today) + unit / 2}
                      y={HEADER - 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-ink-inverse text-[8px] font-bold"
                    >
                      Today
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>
        {current && active !== null && (
          // Outside the scrolling box, so the scroll container never clips it.
          <PlotTip
            x={listWidth + Math.min(width, Math.max(0, toX(current.start) - scrollLeft + unit / 2))}
            y={(rowY.get(current.id) ?? 0) + 1}
            width={listWidth + width}
            height={height + 2}
          >
            <ChartTooltip
              title={current.label}
              rows={
                current.milestone
                  ? [{ label: 'Milestone', value: short(current.start) }]
                  : [
                      { label: 'Start', value: short(current.start) },
                      { label: 'End', value: short(current.end) },
                      { label: 'Duration', value: `${daysBetween(current.start, current.end) + 1}d` },
                      {
                        label: 'Complete',
                        value: `${Math.round((current.progress ?? 0) * 100)}%`,
                        color: 'var(--color-accent-strong)',
                      },
                    ]
              }
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              {['Task', 'Lane', 'Start', 'End', 'Complete', 'Depends on'].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((task) => (
              <tr key={task.id}>
                <th scope="row">{task.milestone ? `${task.label} (milestone)` : task.label}</th>
                <td>{task.lane ?? ''}</td>
                <td>{short(task.start)}</td>
                <td>{task.milestone ? '' : short(task.end)}</td>
                <td>{task.milestone ? '' : `${Math.round((task.progress ?? 0) * 100)}%`}</td>
                <td>{(task.dependsOn ?? []).map((id) => tasks.find((t) => t.id === id)?.label ?? id).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span>{`Today is ${short(today)}.`}</span>
      </VisuallyHidden>

      <PlotAnnouncer message={current ? describe(current) : ''} />
    </div>
  )
}
