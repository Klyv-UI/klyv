'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import {
  DRAW_IN_CLASS,
  PLOT_WIDTH,
  PlotAnnouncer,
  PlotTip,
  TICK_CLASS,
  gutterFor,
  linear,
  niceScale,
  pointerToView,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

/** The Western Electric / Nelson run rules the chart can test for. */
export type ControlChartRule = 'beyond-3-sigma' | 'two-of-three-2-sigma' | 'four-of-five-1-sigma' | 'eight-one-side' | 'six-trending'

/** One run of a rule being broken: overlapping windows of the same rule merge into one. */
export interface ControlChartViolation {
  rule: ControlChartRule
  /** Indexes of the points that form the pattern, ascending. */
  points: number[]
}

/** Limits for one phase. Limits are recalculated from scratch at the start of each phase. */
export interface ControlChartPhase {
  start: number
  end: number
  centre: number
  /** Estimated process sigma: mean moving range ÷ 1.128. */
  sigma: number
  /** Mean moving range. */
  movingRange: number
}

export interface ControlChartProps {
  /** Individual measurements, in time order. */
  values: number[]
  /** Names each point — a date, a batch number. Defaults to its position. */
  labels?: string[]
  /** Accessible name for the chart. */
  label: string
  /** Which rules to test. Defaults to all five. */
  rules?: ControlChartRule[]
  /** Indexes where a new phase begins, e.g. after a process change. Limits are recalculated from each one. */
  phases?: number[]
  /** Draw the moving-range chart under the individuals chart. */
  showMovingRange?: boolean
  /** Individuals chart height in pixels. */
  height?: number
  /** Format values on the axis and in the tooltip. */
  formatY?: (value: number) => string
  /** Called when the set of violations changes. */
  onViolationsChange?: (violations: ControlChartViolation[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const ALL_RULES: ControlChartRule[] = ['beyond-3-sigma', 'two-of-three-2-sigma', 'four-of-five-1-sigma', 'eight-one-side', 'six-trending']

const RULE_TEXT: Record<ControlChartRule, { name: string; meaning: string }> = {
  'beyond-3-sigma': { name: 'Beyond 3σ', meaning: 'A point outside the control limits: something unusual happened then.' },
  'two-of-three-2-sigma': { name: '2 of 3 beyond 2σ', meaning: 'Two of three points past 2σ on one side: an early sign of a shift.' },
  'four-of-five-1-sigma': { name: '4 of 5 beyond 1σ', meaning: 'Four of five points past 1σ on one side: a small, sustained shift.' },
  'eight-one-side': { name: '8 on one side', meaning: 'Eight points in a row on one side of the centre: the mean has moved.' },
  'six-trending': { name: '6 trending', meaning: 'Six points in a row steadily rising or falling: the process is drifting.' },
}

/** d2 for subgroups of two — converts a mean moving range into a sigma estimate. */
const D2 = 1.128
/** D4 for subgroups of two — the moving-range chart's upper limit factor. */
const D4 = 3.267
const PAD = { top: 12, bottom: 22 }

function limitsFor(values: number[], starts: number[]): ControlChartPhase[] {
  const bounds = [...new Set([0, ...starts.filter((start) => start > 0 && start < values.length)])].sort((a, b) => a - b)
  return bounds.map((start, index) => {
    const end = bounds[index + 1] ?? values.length
    const slice = values.slice(start, end)
    const centre = slice.reduce((sum, value) => sum + value, 0) / (slice.length || 1)
    let ranges = 0
    for (let i = 1; i < slice.length; i += 1) ranges += Math.abs(slice[i] - slice[i - 1])
    const movingRange = slice.length > 1 ? ranges / (slice.length - 1) : 0
    return { start, end, centre, sigma: movingRange / D2, movingRange }
  })
}

/**
 * Tests every window of every phase. Windows never straddle a phase boundary,
 * because the zones they are measured against change there.
 */
function detect(values: number[], phases: ControlChartPhase[], rules: ControlChartRule[]): ControlChartViolation[] {
  const found: ControlChartViolation[] = []
  for (const rule of rules) {
    let run: Set<number> | null = null
    let runEnd = -1
    const flush = () => {
      if (run) found.push({ rule, points: [...run].sort((a, b) => a - b) })
      run = null
    }
    for (const phase of phases) {
      const z = (i: number) => (phase.sigma > 0 ? (values[i] - phase.centre) / phase.sigma : 0)
      const window = (i: number, size: number) => (i - size + 1 >= phase.start ? Array.from({ length: size }, (_, k) => i - size + 1 + k) : null)
      for (let i = phase.start; i < phase.end; i += 1) {
        let points: number[] | null = null
        if (rule === 'beyond-3-sigma') {
          if (Math.abs(z(i)) > 3) points = [i]
        } else if (rule === 'two-of-three-2-sigma' || rule === 'four-of-five-1-sigma') {
          const [size, need, limit] = rule === 'two-of-three-2-sigma' ? [3, 2, 2] : [5, 4, 1]
          const w = window(i, size)
          const side = Math.sign(z(i))
          if (w && side !== 0 && side * z(i) > limit) {
            const beyond = w.filter((k) => side * z(k) > limit)
            if (beyond.length >= need) points = beyond
          }
        } else if (rule === 'eight-one-side') {
          const w = window(i, 8)
          if (w && (w.every((k) => z(k) > 0) || w.every((k) => z(k) < 0))) points = w
        } else {
          const w = window(i, 6)
          if (w) {
            const steps = w.slice(1).map((k) => values[k] - values[k - 1])
            if (steps.every((step) => step > 0) || steps.every((step) => step < 0)) points = w
          }
        }
        if (!points) continue
        if (run && points[0] <= runEnd) points.forEach((point) => run!.add(point))
        else {
          flush()
          run = new Set(points)
        }
        runEnd = i
      }
      flush()
    }
  }
  return found.sort((a, b) => a.points[0] - b.points[0])
}

/**
 * A statistical process control chart for individual measurements — the XmR
 * chart — that says when a change is a signal and when it is noise.
 *
 * Limits come from the average moving range, not the standard deviation: a
 * shift or a trend inflates the standard deviation and hides itself inside
 * wider limits, while point-to-point ranges barely notice it. Violations of the
 * run rules are ringed on the chart and listed in words beside it, because a
 * red dot without its reason starts an argument, not an investigation. Phases
 * recalculate the limits after a deliberate change, so the new process is
 * judged against itself.
 */
export function ControlChart({
  values,
  labels,
  label,
  rules = ALL_RULES,
  phases: phaseStarts = [],
  showMovingRange = true,
  height = 240,
  formatY = formatTick,
  onViolationsChange,
  className,
}: ControlChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const n = values.length
  const { active, setActive, keyProps } = useChartCursor(n)
  const [focusRun, setFocusRun] = useState<number | null>(null)
  const nameOf = (index: number) => labels?.[index] ?? `#${index + 1}`

  const phases = useMemo(() => limitsFor(values, phaseStarts), [values, phaseStarts.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const violations = useMemo(() => detect(values, phases, rules), [values, phases, rules.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onViolationsChange?.(violations)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violations])

  const flagged = new Map<number, ControlChartRule[]>()
  for (const violation of violations) for (const point of violation.points) flagged.set(point, [...(flagged.get(point) ?? []), violation.rule])
  const phaseOf = (index: number) => phases.find((phase) => index >= phase.start && index < phase.end) ?? phases[0]

  let low = Math.min(...values)
  let high = Math.max(...values)
  for (const phase of phases) {
    low = Math.min(low, phase.centre - 3.2 * phase.sigma)
    high = Math.max(high, phase.centre + 3.2 * phase.sigma)
  }
  const ys = niceScale(low, high, 4)
  const left = gutterFor(ys.ticks, formatY)
  const lastPhase = phases[phases.length - 1]
  const right = 14 + 5.4 * Math.max(...[3, 0, -3].map((k) => `UCL ${formatY(lastPhase.centre + k * lastPhase.sigma)}`.length))
  const plot = { x: left, y: PAD.top, width: PLOT_WIDTH - left - right, height: height - PAD.top - PAD.bottom }
  const toX = linear(0, Math.max(1, n - 1), plot.x + 6, plot.x + plot.width - 6)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const edge = (index: number) => (index <= 0 ? plot.x : index >= n ? plot.x + plot.width : (toX(index - 1) + toX(index)) / 2)

  const mrHeight = 96
  const ranges = values.map((value, index) => (index === 0 || phaseOf(index).start === index ? null : Math.abs(value - values[index - 1])))
  const mrMax = niceScale(0, Math.max(...ranges.map((r) => r ?? 0), ...phases.map((phase) => phase.movingRange * D4)), 2)
  const toMr = linear(0, mrMax.max, mrHeight - 18, 8)

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x } = pointerToView(event, PLOT_WIDTH, height)
    const index = Math.round(((x - plot.x - 6) / (plot.width - 12)) * (n - 1))
    setActive(index >= 0 && index < n ? index : null)
  }

  const highlighted = new Set(focusRun === null ? [] : violations[focusRun]?.points ?? [])
  const zText = (index: number) => {
    const phase = phaseOf(index)
    const z = phase.sigma > 0 ? (values[index] - phase.centre) / phase.sigma : 0
    return `${z >= 0 ? '+' : ''}${z.toFixed(1)}σ`
  }
  const describe = (index: number) => {
    const broken = flagged.get(index)
    return `${nameOf(index)}: ${formatY(values[index])}, ${zText(index)}${broken ? `; ${broken.map((rule) => RULE_TEXT[rule].name).join(', ')}` : ''}`
  }
  const linePath = values.map((value, index) => `${index ? 'L' : 'M'}${toX(index).toFixed(1)} ${toY(value).toFixed(1)}`).join('')

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${n} points, ${violations.length} rule ${violations.length === 1 ? 'violation' : 'violations'}; use arrow keys to step through the points.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {ys.ticks.map((tick) => (
            <text key={tick} x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
              {formatY(tick)}
            </text>
          ))}
          {phases.map((phase, index) => {
            const x1 = edge(phase.start)
            const x2 = edge(phase.end)
            const at = (k: number) => toY(phase.centre + k * phase.sigma)
            return (
              <g key={phase.start}>
                <rect x={x1} y={at(3)} width={x2 - x1} height={at(-3) - at(3)} className="fill-surface-sunken" />
                <rect x={x1} y={at(1)} width={x2 - x1} height={at(-1) - at(1)} fill="color-mix(in oklab, var(--color-success) 8%, transparent)" />
                {[-2, -1, 1, 2].map((k) => (
                  <line key={k} x1={x1} x2={x2} y1={at(k)} y2={at(k)} className="stroke-line-strong" strokeWidth="1" strokeDasharray="1 3" />
                ))}
                {[-3, 3].map((k) => (
                  <line key={k} x1={x1} x2={x2} y1={at(k)} y2={at(k)} stroke="var(--color-danger)" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="5 3" />
                ))}
                <line x1={x1} x2={x2} y1={at(0)} y2={at(0)} className="stroke-ink-soft" strokeWidth="1.25" />
                {index > 0 && (
                  <>
                    <line x1={x1} x2={x1} y1={plot.y} y2={plot.y + plot.height} className="stroke-ink-faint" strokeWidth="1" />
                    <text x={x1 + 4} y={plot.y + 8} className="fill-ink-faint text-[9px] font-semibold">
                      {`Phase ${index + 1}`}
                    </text>
                  </>
                )}
                {index === phases.length - 1 &&
                  ([
                    ['UCL', 3],
                    ['CL', 0],
                    ['LCL', -3],
                  ] as const).map(([name, k]) => (
                    <text key={name} x={plot.x + plot.width + 4} y={at(k)} dominantBaseline="middle" className="fill-ink-faint text-[9px] font-semibold">
                      {`${name} ${formatY(phase.centre + k * phase.sigma)}`}
                    </text>
                  ))}
              </g>
            )
          })}
          <path
            d={linePath}
            fill="none"
            className={cn('stroke-ink-soft transition-opacity', DRAW_IN_CLASS)}
            strokeWidth="1.5"
            strokeLinejoin="round"
            opacity={drawn ? 1 : 0}
          />
          {values.map((value, index) => {
            const bad = flagged.has(index)
            return (
              <circle
                key={index}
                cx={toX(index)}
                cy={toY(value)}
                r={active === index ? 5 : bad ? 4 : 2.75}
                fill={bad ? 'var(--color-danger)' : 'var(--color-ink)'}
                stroke={highlighted.has(index) || active === index ? 'var(--color-ink)' : 'var(--color-surface)'}
                strokeWidth={highlighted.has(index) ? 2.5 : 1.25}
                className={cn('transition-opacity', DRAW_IN_CLASS)}
                opacity={drawn ? 1 : 0}
              />
            )
          })}
          {active !== null && (
            <line x1={toX(active)} x2={toX(active)} y1={plot.y} y2={plot.y + plot.height} className="pointer-events-none stroke-ink-faint" strokeWidth="1" />
          )}
          {labels &&
            [0, Math.floor((n - 1) / 2), n - 1].map((index, k) => (
              <text key={k} x={toX(index)} y={height - 6} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} className={TICK_CLASS}>
                {nameOf(index)}
              </text>
            ))}
        </svg>
        {active !== null && (
          <PlotTip x={toX(active)} y={toY(values[active])} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={nameOf(active)}
              rows={[
                { label: 'Value', value: formatY(values[active]) },
                { label: 'From centre', value: zText(active) },
                { label: 'Moving range', value: ranges[active] === null ? '—' : formatY(ranges[active]!) },
                ...(flagged.get(active) ?? []).map((rule) => ({ label: RULE_TEXT[rule].name, value: 'Signal', color: 'var(--color-danger)' })),
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showMovingRange && (
        <svg aria-hidden="true" viewBox={`0 0 ${PLOT_WIDTH} ${mrHeight}`} className="w-full">
          <text x={plot.x - 8} y={toMr(0)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
            0
          </text>
          <text x={4} y={10} className="fill-ink-faint text-[9px] font-semibold">
            Moving range
          </text>
          {phases.map((phase) => (
            <g key={phase.start}>
              <line x1={edge(phase.start)} x2={edge(phase.end)} y1={toMr(phase.movingRange)} y2={toMr(phase.movingRange)} className="stroke-ink-soft" strokeWidth="1" />
              <line
                x1={edge(phase.start)}
                x2={edge(phase.end)}
                y1={toMr(phase.movingRange * D4)}
                y2={toMr(phase.movingRange * D4)}
                stroke="var(--color-danger)"
                strokeOpacity="0.7"
                strokeDasharray="5 3"
              />
            </g>
          ))}
          <text x={plot.x + plot.width + 4} y={toMr(phases[phases.length - 1].movingRange * D4)} dominantBaseline="middle" className="fill-ink-faint text-[9px] font-semibold">
            {`UCL ${formatY(phases[phases.length - 1].movingRange * D4)}`}
          </text>
          {ranges.map((range, index) =>
            range === null ? null : (
              <line
                key={index}
                x1={toX(index)}
                x2={toX(index)}
                y1={toMr(0)}
                y2={toMr(range)}
                strokeWidth="3"
                strokeLinecap="round"
                stroke={range > phaseOf(index).movingRange * D4 ? 'var(--color-danger)' : 'var(--color-ink-faint)'}
                opacity={active === null || active === index ? 1 : 0.55}
              />
            ),
          )}
        </svg>
      )}

      <div className="flex flex-col gap-1.5">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          {violations.length ? `${violations.length} ${violations.length === 1 ? 'signal' : 'signals'}` : 'In control'}
        </Text>
        {violations.length === 0 ? (
          <Text size="caption" weight="medium" tone="soft">
            No point breaks the tested rules. The variation shown is the process’s ordinary noise.
          </Text>
        ) : (
          <ul className="flex flex-col gap-1">
            {violations.map((violation, index) => {
              const first = violation.points[0]
              const last = violation.points[violation.points.length - 1]
              return (
                <li key={`${violation.rule}-${first}`}>
                  <button
                    type="button"
                    aria-pressed={focusRun === index}
                    onClick={() => {
                      setFocusRun(focusRun === index ? null : index)
                      setActive(focusRun === index ? null : last)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-[var(--radius-10)] px-2.5 py-1.5 text-left hover:bg-surface-muted',
                      focusRun === index && 'bg-surface-muted',
                    )}
                  >
                    <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-danger" />
                    <span className="flex min-w-0 flex-col">
                      <Text as="span" size="caption" weight="bold">
                        {`${RULE_TEXT[violation.rule].name} · ${first === last ? nameOf(first) : `${nameOf(first)} to ${nameOf(last)}`}`}
                      </Text>
                      <Text as="span" size="caption" weight="medium" tone="soft">
                        {RULE_TEXT[violation.rule].meaning}
                      </Text>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. ${phases.map((phase, index) => `Phase ${index + 1}: centre ${formatY(phase.centre)}, limits ${formatY(phase.centre - 3 * phase.sigma)} to ${formatY(phase.centre + 3 * phase.sigma)}.`).join(' ')}`}</caption>
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">Value</th>
              <th scope="col">Moving range</th>
              <th scope="col">Rules broken</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr key={index}>
                <th scope="row">{nameOf(index)}</th>
                <td>{formatY(value)}</td>
                <td>{ranges[index] === null ? '' : formatY(ranges[index]!)}</td>
                <td>{(flagged.get(index) ?? []).map((rule) => RULE_TEXT[rule].name).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer message={active === null ? '' : describe(active)} />
    </div>
  )
}
