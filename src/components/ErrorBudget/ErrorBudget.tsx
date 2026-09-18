'use client'

import { useId, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { ChartTooltip } from '../ChartTooltip'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PLOT_WIDTH, PlotAnnouncer, PlotTip, TICK_CLASS, linear, pointerToView, svgId, useChartCursor, useDrawIn } from '../internal/plot'

/** One evenly spaced bucket of traffic. */
export interface ErrorBudgetSample {
  /** Start of the bucket, epoch milliseconds. */
  time: number
  requests: number
  /** Requests that counted against the SLO. */
  errors: number
}

/** A multi-window burn-rate alert: fires while both windows burn faster than `burnRate`. */
export interface ErrorBudgetAlertRule {
  /** Long window in milliseconds — says the burn is significant. */
  longWindow: number
  /** Short window in milliseconds — says it is still happening, so the alert resets quickly. */
  shortWindow: number
  /** Multiple of the sustainable rate. 1× spends exactly the budget over the SLO window. */
  burnRate: number
  severity: 'page' | 'ticket'
}

/** A stretch of time an alert rule was firing. */
export interface ErrorBudgetAlertPeriod {
  rule: ErrorBudgetAlertRule
  start: number
  end: number
  /** Highest short-window burn rate while firing. */
  peakBurn: number
}

export interface ErrorBudgetProps {
  /** Traffic in time order, evenly spaced. Five-minute buckets or finer, so the shortest alert window has data. */
  samples: ErrorBudgetSample[]
  /** The SLO as a fraction: 0.999 is three nines. */
  target: number
  /** SLO window length in milliseconds. */
  window?: number
  /** When the SLO window began. Defaults to the first sample. */
  windowStart?: number
  /** Alert rules to evaluate. Defaults to the SRE workbook’s four multi-window rules. */
  alerts?: ErrorBudgetAlertRule[]
  /** Accessible name for the chart. */
  label: string
  /** Burn-down plot height in pixels. */
  height?: number
  /** Format a timestamp for the axis, tooltip and alert list. */
  formatTime?: (time: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const DEFAULT_ALERTS: ErrorBudgetAlertRule[] = [
  { longWindow: HOUR, shortWindow: 5 * MINUTE, burnRate: 14.4, severity: 'page' },
  { longWindow: 6 * HOUR, shortWindow: 30 * MINUTE, burnRate: 6, severity: 'page' },
  { longWindow: DAY, shortWindow: 2 * HOUR, burnRate: 3, severity: 'ticket' },
  { longWindow: 3 * DAY, shortWindow: 6 * HOUR, burnRate: 1, severity: 'ticket' },
]

const defaultTime = (time: number) =>
  new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const span = (ms: number) => {
  if (!Number.isFinite(ms)) return 'never'
  if (ms >= 2 * DAY) return `${(ms / DAY).toFixed(1)} days`
  if (ms >= 2 * HOUR) return `${(ms / HOUR).toFixed(1)} hours`
  return `${Math.max(1, Math.round(ms / MINUTE))} min`
}
const windowName = (ms: number) => (ms >= DAY ? `${ms / DAY}d` : ms >= HOUR ? `${ms / HOUR}h` : `${ms / MINUTE}m`)
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

/**
 * An SLO’s error budget, spent: how much failure the target allows over the
 * window, how much is gone, how fast it is going, and when it runs out.
 *
 * Alerting on the error rate alone pages for every blip and misses a slow leak.
 * Burn rate — the error ratio as a multiple of what the SLO can sustain — makes
 * both visible on one scale, and the multi-window rules evaluated here (a long
 * window to say the burn matters, a short one to say it is still happening)
 * are the ones from the SRE workbook: 14.4× over an hour pages because at that
 * pace 2% of a month’s budget is gone in that hour. Every rule is evaluated over
 * the whole series with prefix sums, so the alert lanes show exactly when each
 * would have fired, not just whether it fires now.
 */
export function ErrorBudget({
  samples,
  target,
  window: windowLength = 30 * DAY,
  windowStart,
  alerts = DEFAULT_ALERTS,
  label,
  height = 200,
  formatTime = defaultTime,
  className,
}: ErrorBudgetProps) {
  const tableId = useId()
  const clipId = svgId(`${tableId}clip`)
  const drawn = useDrawIn()
  const allowed = Math.max(1e-9, 1 - target)

  const model = useMemo(() => {
    const n = samples.length
    const times = samples.map((s) => s.time)
    const step = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 5 * MINUTE
    const req = new Float64Array(n + 1)
    const err = new Float64Array(n + 1)
    samples.forEach((s, i) => {
      req[i + 1] = req[i] + Math.max(0, s.requests)
      err[i + 1] = err[i] + Math.max(0, s.errors)
    })
    const first = (time: number) => {
      let lo = 0
      let hi = n
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (times[mid] < time) lo = mid + 1
        else hi = mid
      }
      return lo
    }
    /** Burn rate over the `w` milliseconds ending with bucket `i`. */
    const burn = (i: number, w: number) => {
      const j = first(times[i] + step - w)
      const r = req[i + 1] - req[j]
      return r > 0 ? (err[i + 1] - err[j]) / r / allowed : 0
    }
    const start = windowStart ?? times[0] ?? 0
    const now = n ? times[n - 1] + step : start
    const elapsed = Math.max(step, now - start)
    const budget = allowed * req[n] * (windowLength / elapsed)
    const remaining = (i: number) => 1 - err[i + 1] / (budget || 1)

    const periods: ErrorBudgetAlertPeriod[] = []
    for (const rule of alerts) {
      let open: ErrorBudgetAlertPeriod | null = null
      for (let i = 0; i < n; i += 1) {
        const short = burn(i, rule.shortWindow)
        const firing = short > rule.burnRate && burn(i, rule.longWindow) > rule.burnRate
        if (firing && open) {
          open.end = times[i] + step
          open.peakBurn = Math.max(open.peakBurn, short)
        } else if (firing) open = { rule, start: times[i], end: times[i] + step, peakBurn: short }
        else if (open) {
          periods.push(open)
          open = null
        }
      }
      if (open) periods.push(open)
    }
    const consumed = err[n] / (budget || 1)
    const burn1h = n ? burn(n - 1, HOUR) : 0
    const average = consumed / (elapsed / windowLength)
    return { n, step, burn, start, now, budget, remaining, periods, consumed, burn1h, average, errors: err[n], requests: req[n] }
  }, [samples, allowed, windowLength, windowStart, alerts])

  // One cursor stop per pixel pair: enough to find any moment, few enough to arrow through.
  const plot = { x: 40, y: 10, width: PLOT_WIDTH - 40 - 12, height: height - 10 - 22 }
  const columns = Math.min(model.n, Math.round(plot.width / 2))
  const pick = Array.from({ length: columns }, (_, c) => Math.min(model.n - 1, Math.round(((c + 1) * model.n) / columns) - 1))
  const { active, setActive, keyProps } = useChartCursor(pick.length)

  const end = model.start + windowLength
  const toX = linear(model.start, end, plot.x, plot.x + plot.width)
  const lowest = Math.min(0, ...pick.map((i) => model.remaining(i)))
  const toY = linear(lowest, 1, plot.y + plot.height, plot.y)
  const remainingNow = 1 - model.consumed
  const exhaustIn = model.burn1h > 0 && remainingNow > 0 ? (remainingNow * windowLength) / model.burn1h : remainingNow <= 0 ? 0 : Infinity
  const exhaustAvg = model.average > 0 && remainingNow > 0 ? (remainingNow * windowLength) / model.average : remainingNow <= 0 ? 0 : Infinity
  const projectEnd = Math.min(end, model.now + exhaustIn)
  const projectY = remainingNow - ((projectEnd - model.now) / windowLength) * model.burn1h
  const days = Math.round(windowLength / DAY)
  const dayTicks = Array.from({ length: 7 }, (_, k) => model.start + (windowLength * k) / 6)

  const laneHeight = 16
  const lanesTop = height + 6
  const total = lanesTop + alerts.length * (laneHeight + 4) + 4
  const burnPath = pick.map((i, c) => `${c ? 'L' : 'M'}${toX(samples[i].time + model.step).toFixed(1)} ${toY(model.remaining(i)).toFixed(1)}`).join('')
  const ruleName = (rule: ErrorBudgetAlertRule) => `${rule.burnRate}× ${windowName(rule.longWindow)}/${windowName(rule.shortWindow)}`

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x } = pointerToView(event, PLOT_WIDTH, total)
    const time = linear(plot.x, plot.x + plot.width, model.start, end)(x)
    if (time < model.start || time > model.now) return setActive(null)
    let best = 0
    pick.forEach((i, c) => {
      if (samples[i].time <= time) best = c
    })
    setActive(best)
  }

  const index = active === null ? null : pick[active]
  const firingAt = (time: number) => model.periods.filter((p) => time >= p.start && time < p.end)
  const describe = (i: number) =>
    `${formatTime(samples[i].time)}: ${pct(model.remaining(i))} of budget left, burn rate ${model.burn(i, HOUR).toFixed(1)}× over 1h${
      firingAt(samples[i].time).length ? `, alerting ${firingAt(samples[i].time).map((p) => ruleName(p.rule)).join(', ')}` : ''
    }`

  const stats: [string, string][] = [
    ['SLO', `${(target * 100).toFixed(target >= 0.999 ? 2 : 1)}% · ${days}d`],
    ['Budget', `${Math.round(model.budget).toLocaleString()} errors`],
    ['Consumed', pct(model.consumed)],
    ['Remaining', pct(remainingNow)],
    ['Burn rate 1h', `${model.burn1h.toFixed(2)}×`],
    ['Exhausted in', remainingNow <= 0 ? 'Spent' : exhaustIn > end - model.now ? 'Outlasts window' : span(exhaustIn)],
  ]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-0.5 rounded-[var(--radius-10)] bg-surface-sunken px-2.5 py-2">
            <Text as="dt" size="micro" weight="semibold" tone="faint">
              {term}
            </Text>
            <Text as="dd" size="label" weight="bold" tabular tone={term === 'Remaining' && remainingNow < 0.25 ? 'danger' : 'default'}>
              {value}
            </Text>
          </div>
        ))}
      </dl>

      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${pct(remainingNow)} of the error budget remains; ${model.periods.length} alert periods. Use arrow keys to step through time.`}
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
                x={plot.x}
                y={0}
                width={plot.width}
                height={total}
                className={cn('transition-transform', DRAW_IN_CLASS)}
                style={{ transformBox: 'fill-box', transformOrigin: 'left center', transform: drawn ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </clipPath>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'} strokeWidth="1" />
              <text x={plot.x - 6} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {`${tick * 100}%`}
              </text>
            </g>
          ))}
          {dayTicks.map((tick, k) => (
            <text key={tick} x={toX(tick)} y={plot.y + plot.height + 15} textAnchor={k === 0 ? 'start' : k === 6 ? 'end' : 'middle'} className={TICK_CLASS}>
              {new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          ))}
          <rect x={toX(model.now)} y={plot.y} width={Math.max(0, plot.x + plot.width - toX(model.now))} height={plot.height} className="fill-surface-sunken" />
          <line x1={toX(model.start)} y1={toY(1)} x2={toX(end)} y2={toY(0)} className="stroke-ink-faint" strokeWidth="1" strokeDasharray="4 4" />
          <g clipPath={`url(#${clipId})`}>
            <path d={`${burnPath}L${toX(model.now)} ${toY(lowest)}L${toX(model.start)} ${toY(lowest)}Z`} fill="color-mix(in oklab, var(--color-accent-strong) 22%, transparent)" />
            <path d={burnPath} fill="none" stroke="var(--color-accent-strong)" strokeWidth="2" strokeLinejoin="round" />
            {remainingNow > 0 && (
              <line x1={toX(model.now)} y1={toY(remainingNow)} x2={toX(projectEnd)} y2={toY(Math.max(lowest, projectY))} stroke="var(--color-danger)" strokeWidth="1.5" strokeDasharray="3 3" />
            )}
            {alerts.map((rule, row) => {
              const y = lanesTop + row * (laneHeight + 4)
              return (
                <g key={ruleName(rule)}>
                  <rect x={plot.x} y={y} width={plot.width} height={laneHeight} rx={3} className="fill-surface-sunken" />
                  {model.periods
                    .filter((period) => period.rule === rule)
                    .map((period) => (
                      <rect
                        key={period.start}
                        x={toX(period.start)}
                        y={y}
                        width={Math.max(2, toX(period.end) - toX(period.start))}
                        height={laneHeight}
                        rx={2}
                        fill={rule.severity === 'page' ? 'var(--color-danger)' : 'var(--color-warning)'}
                      />
                    ))}
                </g>
              )
            })}
          </g>
          {alerts.map((rule, row) => (
            <text key={ruleName(rule)} x={plot.x - 6} y={lanesTop + row * (laneHeight + 4) + laneHeight / 2} textAnchor="end" dominantBaseline="middle" className="fill-ink-faint text-[8px] font-semibold">
              {`${rule.burnRate}×`}
            </text>
          ))}
          <line x1={toX(model.now)} x2={toX(model.now)} y1={plot.y} y2={total - 4} className="stroke-ink-soft" strokeWidth="1" />
          <text x={toX(model.now) + 4} y={plot.y + 8} className="fill-ink-soft text-[9px] font-semibold">
            Now
          </text>
          {index !== null && (
            <g pointerEvents="none">
              <line x1={toX(samples[index].time + model.step)} x2={toX(samples[index].time + model.step)} y1={plot.y} y2={total - 4} className="stroke-ink" strokeWidth="1" />
              <circle cx={toX(samples[index].time + model.step)} cy={toY(model.remaining(index))} r="4" fill="var(--color-accent-strong)" className="stroke-ink" strokeWidth="1.5" />
            </g>
          )}
        </svg>
        {index !== null && (
          <PlotTip x={toX(samples[index].time + model.step)} y={toY(model.remaining(index))} width={PLOT_WIDTH} height={total}>
            <ChartTooltip
              title={formatTime(samples[index].time)}
              rows={[
                { label: 'Budget left', value: pct(model.remaining(index)), color: 'var(--color-accent-strong)' },
                { label: 'Burn 1h', value: `${model.burn(index, HOUR).toFixed(2)}×` },
                { label: 'Burn 6h', value: `${model.burn(index, 6 * HOUR).toFixed(2)}×` },
                { label: 'Errors in bucket', value: `${samples[index].errors.toLocaleString()} / ${samples[index].requests.toLocaleString()}` },
                ...firingAt(samples[index].time).map((p) => ({
                  label: `Alert ${ruleName(p.rule)}`,
                  value: p.rule.severity,
                  color: p.rule.severity === 'page' ? 'var(--color-danger)' : 'var(--color-warning)',
                })),
              ]}
            />
          </PlotTip>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          {model.periods.length ? `${model.periods.length} alert ${model.periods.length === 1 ? 'period' : 'periods'}` : 'No alerts fired'}
        </Text>
        {model.periods.length > 0 && (
          <ul className="flex flex-col gap-1">
            {[...model.periods]
              .sort((a, b) => a.start - b.start)
              .map((period) => (
                <li key={`${ruleName(period.rule)}-${period.start}`} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 rounded-full', period.rule.severity === 'page' ? 'bg-danger' : 'bg-warning')}
                  />
                  <Text as="span" size="caption" weight="bold" className="w-12 shrink-0 capitalize">
                    {period.rule.severity}
                  </Text>
                  <Text as="span" size="caption" weight="medium" tone="soft" tabular>
                    {`${ruleName(period.rule)} · ${formatTime(period.start)} for ${span(period.end - period.start)} · peak ${period.peakBurn.toFixed(1)}×`}
                  </Text>
                </li>
              ))}
          </ul>
        )}
        <Text size="caption" weight="medium" tone="soft">
          {`At the average rate so far the budget lasts ${remainingNow <= 0 ? 'no longer — it is spent' : span(exhaustAvg)}; the dashed red line projects the last hour’s rate.`}
        </Text>
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. ${stats.map(([term, value]) => `${term}: ${value}`).join('. ')}.`}</caption>
          <thead>
            <tr>
              <th scope="col">Alert rule</th>
              <th scope="col">Severity</th>
              <th scope="col">Started</th>
              <th scope="col">Lasted</th>
              <th scope="col">Peak burn</th>
            </tr>
          </thead>
          <tbody>
            {model.periods.map((period) => (
              <tr key={`${ruleName(period.rule)}-${period.start}`}>
                <th scope="row">{ruleName(period.rule)}</th>
                <td>{period.rule.severity}</td>
                <td>{formatTime(period.start)}</td>
                <td>{span(period.end - period.start)}</td>
                <td>{`${period.peakBurn.toFixed(1)}×`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer message={index === null ? '' : describe(index)} />
    </div>
  )
}
