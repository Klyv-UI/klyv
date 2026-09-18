'use client'

import { useId, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import {
  DRAW_IN_CLASS,
  PLOT_WIDTH,
  PlotAnnouncer,
  PlotTip,
  TICK_CLASS,
  linear,
  niceScale,
  pointerToView,
  svgId,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface KaplanMeierChartSubject {
  /** Time until the event, or until the subject was last seen. */
  time: number
  /** True when the event happened at `time`; false when the subject was censored — still fine when last seen. */
  event: boolean
}

export interface KaplanMeierChartGroup {
  id: string
  label: string
  subjects: KaplanMeierChartSubject[]
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

/** The estimate just after `time`. */
export interface KaplanMeierChartStep {
  time: number
  survival: number
  lower: number
  upper: number
  /** Subjects still followed at `time`, before its events. */
  atRisk: number
  events: number
  censored: number
}

export interface KaplanMeierChartProps {
  /** One curve per group. */
  groups: KaplanMeierChartGroup[]
  /** Accessible name for the chart. */
  label: string
  /** Coverage of the confidence band. */
  confidence?: 0.9 | 0.95 | 0.99
  /** Shade the confidence band around each curve. */
  showConfidence?: boolean
  /** Tick each censored subject on its curve. */
  showCensors?: boolean
  /** Mark where each curve crosses 50%. */
  showMedian?: boolean
  /** Print the number at risk under each axis tick. */
  showAtRisk?: boolean
  /** Name of the time unit, printed under the axis — days, months. */
  timeLabel?: string
  /** Format times on the axis and in the tooltip. */
  formatTime?: (value: number) => string
  /** Plot height in pixels, not counting the at-risk table. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const Z = { 0.9: 1.6449, 0.95: 1.96, 0.99: 2.5758 }

/**
 * The product-limit estimator. Censored subjects leave the risk set without
 * counting as events; the band uses Greenwood's variance on the log(−log)
 * scale, which keeps it inside 0–100% where the plain formula spills over.
 */
function estimate(subjects: KaplanMeierChartSubject[], z: number) {
  const sorted = subjects.filter((s) => Number.isFinite(s.time) && s.time >= 0).sort((a, b) => a.time - b.time)
  const steps: KaplanMeierChartStep[] = [{ time: 0, survival: 1, lower: 1, upper: 1, atRisk: sorted.length, events: 0, censored: 0 }]
  let survival = 1
  let greenwood = 0
  let index = 0
  while (index < sorted.length) {
    const time = sorted[index].time
    const atRisk = sorted.length - index
    let events = 0
    let censored = 0
    while (index < sorted.length && sorted[index].time === time) {
      if (sorted[index].event) events += 1
      else censored += 1
      index += 1
    }
    if (events > 0) {
      survival *= 1 - events / atRisk
      greenwood += atRisk > events ? events / (atRisk * (atRisk - events)) : 0
    }
    let lower = survival
    let upper = survival
    if (survival > 0 && survival < 1) {
      const se = Math.sqrt(greenwood) / Math.abs(Math.log(survival))
      lower = survival ** Math.exp(z * se)
      upper = survival ** Math.exp(-z * se)
    }
    const previous = steps[steps.length - 1]
    if (time === 0) Object.assign(previous, { survival, lower, upper, events, censored })
    else steps.push({ time, survival, lower, upper, atRisk, events, censored })
  }
  const median = steps.find((step) => step.survival <= 0.5)?.time ?? null
  const end = sorted.length ? sorted[sorted.length - 1].time : 0
  return { steps, median, end, total: sorted.length, events: sorted.filter((s) => s.event).length }
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  const t = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let sum = 1.000000000190015
  for (const k of c) sum += k / ++y
  return -t + Math.log((2.5066282746310005 * sum) / x)
}

/** Upper regularised incomplete gamma Q(a, x): series below a + 1, continued fraction above. */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    for (let n = 1; n < 200; n += 1) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

/**
 * The log-rank test across all groups: observed minus expected events at each
 * event time, weighed against their covariance, compared with χ² on k − 1
 * degrees of freedom.
 */
function logRank(groups: KaplanMeierChartSubject[][]) {
  const k = groups.length
  if (k < 2) return null
  const times = [...new Set(groups.flatMap((g) => g.filter((s) => s.event).map((s) => s.time)))].sort((a, b) => a - b)
  const observed = new Array(k).fill(0)
  const expected = new Array(k).fill(0)
  const v = Array.from({ length: k }, () => new Array(k).fill(0))
  for (const t of times) {
    const at = groups.map((g) => g.filter((s) => s.time >= t).length)
    const dead = groups.map((g) => g.filter((s) => s.event && s.time === t).length)
    const n = at.reduce((a, b) => a + b, 0)
    const d = dead.reduce((a, b) => a + b, 0)
    if (n === 0) continue
    for (let j = 0; j < k; j += 1) {
      observed[j] += dead[j]
      expected[j] += (d * at[j]) / n
      if (n > 1)
        for (let l = 0; l < k; l += 1) v[j][l] += ((d * (n - d)) / (n - 1)) * (at[j] / n) * ((j === l ? 1 : 0) - at[l] / n)
    }
  }
  // Solve V' x = U for the first k − 1 groups by Gaussian elimination.
  const size = k - 1
  const m = v.slice(0, size).map((row, j) => [...row.slice(0, size), observed[j] - expected[j]])
  for (let col = 0; col < size; col += 1) {
    let pivot = col
    for (let row = col + 1; row < size; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    if (Math.abs(m[col][col]) < 1e-12) return null
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue
      const f = m[row][col] / m[col][col]
      for (let c = col; c <= size; c += 1) m[row][c] -= f * m[col][c]
    }
  }
  let chi = 0
  for (let j = 0; j < size; j += 1) chi += (observed[j] - expected[j]) * (m[j][size] / m[j][j])
  return { chi, df: size, p: gammaQ(size / 2, chi / 2), observed, expected }
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const pText = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`)

/**
 * Survival curves: the share of each group still without the event over time
 * — customers not yet churned, patients not yet relapsed, trials not yet
 * converted — estimated with Kaplan–Meier.
 *
 * Everyone who has not had the event yet is censored rather than dropped, which
 * is the whole point: an average of "time to churn" over customers who have
 * churned says nothing about the ones who have not. Bands, censor ticks and the
 * at-risk table show how much data is behind each part of each curve, so the
 * thin tail on the right is read as the guess it is. The log-rank p-value says
 * whether the gap between groups is more than chance.
 */
export function KaplanMeierChart({
  groups,
  label,
  confidence = 0.95,
  showConfidence = true,
  showCensors = true,
  showMedian = true,
  showAtRisk = true,
  timeLabel,
  formatTime = formatTick,
  height = 260,
  className,
}: KaplanMeierChartProps) {
  const tableId = useId()
  const clipId = svgId(`${tableId}clip`)
  const drawn = useDrawIn()

  const curves = useMemo(
    () =>
      groups.map((group, index) => ({
        ...group,
        color: group.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
        ...estimate(group.subjects, Z[confidence]),
      })),
    [groups, confidence],
  )
  const test = useMemo(() => logRank(groups.map((group) => group.subjects)), [groups])
  const times = [...new Set(curves.flatMap((curve) => curve.steps.map((step) => step.time)))].sort((a, b) => a - b)
  const { active, setActive, keyProps } = useChartCursor(times.length)

  const xs = niceScale(0, Math.max(1, ...curves.map((curve) => curve.end)), 6)
  const left = 78
  const plot = { x: left, y: 12, width: PLOT_WIDTH - left - 16, height: height - 12 - 28 - (timeLabel ? 12 : 0) }
  const toX = linear(0, xs.max, plot.x, plot.x + plot.width)
  const toY = linear(0, 1, plot.y + plot.height, plot.y)
  const riskTop = height + 8
  const total = height + (showAtRisk ? 22 + curves.length * 15 : 0)

  const stepAt = (curve: (typeof curves)[number], time: number) => {
    let found = curve.steps[0]
    for (const step of curve.steps) if (step.time <= time) found = step
    return found
  }
  const atRisk = (curve: (typeof curves)[number], time: number) => curve.subjects.filter((s) => s.time >= time).length
  const stepPath = (curve: (typeof curves)[number], key: 'survival' | 'lower' | 'upper') => {
    let d = `M${toX(0)} ${toY(curve.steps[0][key])}`
    for (const step of curve.steps.slice(1)) d += `H${toX(step.time).toFixed(1)}V${toY(step[key]).toFixed(1)}`
    return `${d}H${toX(curve.end).toFixed(1)}`
  }
  const bandPath = (curve: (typeof curves)[number]) => {
    let d = `M${toX(0)} ${toY(1)}`
    for (const step of curve.steps.slice(1)) d += `H${toX(step.time).toFixed(1)}V${toY(step.upper).toFixed(1)}`
    d += `H${toX(curve.end).toFixed(1)}V${toY(curve.steps[curve.steps.length - 1].lower).toFixed(1)}`
    for (let i = curve.steps.length - 1; i >= 1; i -= 1) d += `H${toX(curve.steps[i].time).toFixed(1)}V${toY(curve.steps[i - 1].lower).toFixed(1)}`
    return `${d}H${toX(0)}Z`
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x } = pointerToView(event, PLOT_WIDTH, total)
    if (x < plot.x - 8 || x > plot.x + plot.width + 8) return setActive(null)
    const time = linear(plot.x, plot.x + plot.width, 0, xs.max)(x)
    let best = 0
    times.forEach((t, index) => {
      if (t <= time) best = index
    })
    setActive(best)
  }

  const time = active === null ? null : times[active]
  const summary = `${test ? `Log-rank χ² ${test.chi.toFixed(2)}, ${test.df} df, ${pText(test.p)}. ` : ''}${curves
    .map((curve) => `${curve.label}: ${curve.total} subjects, ${curve.events} events, median ${curve.median === null ? 'not reached' : formatTime(curve.median)}.`)
    .join(' ')}`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {test && (
        <Text size="caption" weight="semibold" tone="soft" tabular>
          {`Log-rank χ² = ${test.chi.toFixed(2)}, ${test.df} df, ${pText(test.p)}${test.p < 0.05 ? ' — the curves differ by more than chance' : ' — no evidence the curves differ'}`}
        </Text>
      )}
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${summary} Use arrow keys to step through time.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${total}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={plot.x - 2}
                y={0}
                width={plot.width + 4}
                height={height}
                className={cn('transition-transform', DRAW_IN_CLASS)}
                style={{ transformBox: 'fill-box', transformOrigin: 'left center', transform: drawn ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </clipPath>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {`${tick * 100}%`}
              </text>
            </g>
          ))}
          {xs.ticks.map((tick) => (
            <text key={tick} x={toX(tick)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
              {formatTime(tick)}
            </text>
          ))}
          {timeLabel && (
            <text x={plot.x + plot.width / 2} y={height - 2} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
              {timeLabel}
            </text>
          )}
          <g clipPath={`url(#${clipId})`}>
            {showConfidence &&
              curves.map((curve) => <path key={`band-${curve.id}`} d={bandPath(curve)} fill={curve.color} fillOpacity="0.14" />)}
            {showMedian &&
              curves.map(
                (curve) =>
                  curve.median !== null && (
                    <path
                      key={`median-${curve.id}`}
                      d={`M${plot.x} ${toY(0.5)}H${toX(curve.median)}V${plot.y + plot.height}`}
                      fill="none"
                      stroke={curve.color}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.8"
                    />
                  ),
              )}
            {curves.map((curve) => (
              <path key={curve.id} d={stepPath(curve, 'survival')} fill="none" stroke={curve.color} strokeWidth="2" />
            ))}
            {showCensors &&
              curves.flatMap((curve) =>
                curve.steps
                  .filter((step) => step.censored > 0)
                  .map((step) => (
                    <path
                      key={`c-${curve.id}-${step.time}`}
                      d={`M${toX(step.time)} ${toY(step.survival) - 4}v8`}
                      stroke={curve.color}
                      strokeWidth="1.5"
                    />
                  )),
              )}
          </g>
          {time !== null && (
            <g pointerEvents="none">
              <line x1={toX(time)} x2={toX(time)} y1={plot.y} y2={plot.y + plot.height} className="stroke-ink-faint" strokeWidth="1" />
              {curves.map((curve) => (
                <circle key={curve.id} cx={toX(time)} cy={toY(stepAt(curve, time).survival)} r="3.5" fill={curve.color} className="stroke-surface" strokeWidth="1.5" />
              ))}
            </g>
          )}
          {showAtRisk && (
            <g aria-hidden="true">
              <text x={4} y={riskTop} className="fill-ink-faint text-[9px] font-bold uppercase">
                At risk
              </text>
              {curves.map((curve, row) => (
                <g key={curve.id}>
                  <circle cx={7} cy={riskTop + 15 * (row + 1) - 3} r={3} fill={curve.color} />
                  <text x={14} y={riskTop + 15 * (row + 1)} className="fill-ink-soft text-[9px] font-semibold">
                    {curve.label.length > 11 ? `${curve.label.slice(0, 10)}…` : curve.label}
                  </text>
                  {xs.ticks.map((tick) => (
                    <text key={tick} x={toX(tick)} y={riskTop + 15 * (row + 1)} textAnchor="middle" className="fill-ink-soft text-[9px] font-medium tabular-nums">
                      {atRisk(curve, tick)}
                    </text>
                  ))}
                </g>
              ))}
            </g>
          )}
        </svg>
        {time !== null && (
          <PlotTip x={toX(time)} y={toY(stepAt(curves[0], time).survival)} width={PLOT_WIDTH} height={total}>
            <ChartTooltip
              title={`${timeLabel ? `${timeLabel} ` : 't = '}${formatTime(time)}`}
              rows={curves.map((curve) => {
                const step = stepAt(curve, time)
                return { label: `${curve.label} (${atRisk(curve, time)} at risk)`, value: `${pct(step.survival)} [${pct(step.lower)}–${pct(step.upper)}]`, color: curve.color }
              })}
            />
          </PlotTip>
        )}
      </div>

      <Legend
        label={`${label} groups`}
        series={curves.map((curve) => ({
          label: curve.label,
          color: curve.color,
          value: `median ${curve.median === null ? 'not reached' : formatTime(curve.median)}`,
        }))}
      />

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. ${summary}`}</caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Time</th>
              <th scope="col">At risk</th>
              <th scope="col">Events</th>
              <th scope="col">Censored</th>
              <th scope="col">Survival</th>
              <th scope="col">{`${Math.round(confidence * 100)}% interval`}</th>
            </tr>
          </thead>
          <tbody>
            {curves.flatMap((curve) =>
              curve.steps.map((step) => (
                <tr key={`${curve.id}-${step.time}`}>
                  <th scope="row">{curve.label}</th>
                  <td>{formatTime(step.time)}</td>
                  <td>{step.atRisk}</td>
                  <td>{step.events}</td>
                  <td>{step.censored}</td>
                  <td>{pct(step.survival)}</td>
                  <td>{`${pct(step.lower)} to ${pct(step.upper)}`}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer
        message={
          time === null
            ? ''
            : `${formatTime(time)}: ${curves.map((curve) => `${curve.label} ${pct(stepAt(curve, time).survival)}, ${atRisk(curve, time)} at risk`).join('; ')}`
        }
      />
    </div>
  )
}
