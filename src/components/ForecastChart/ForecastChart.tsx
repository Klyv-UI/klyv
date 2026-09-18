'use client'

import { useEffect, useId, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
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
  gutterFor,
  linear,
  niceScale,
  pointerToView,
  svgId,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export type ForecastChartSeasonality = 'additive' | 'multiplicative'

/** Smoothing weights for level, trend and season, each between 0 and 1. */
export interface ForecastChartParams {
  alpha: number
  beta: number
  gamma: number
}

/** What the fit produced, handed to `onFit`. */
export interface ForecastChartFit extends ForecastChartParams {
  seasonality: ForecastChartSeasonality
  /** One-step-ahead predictions over the history. The first season seeds the model and is left out. */
  fitted: number[]
  forecast: number[]
  lower: number[]
  upper: number[]
  /** Mean absolute percentage error of the one-step predictions, 0 to 1. */
  mape: number
  /** MAPE of a refit that held back the last `horizon` points, or null when the history is too short. */
  holdoutMape: number | null
  rmse: number
}

export interface ForecastChartProps {
  /** The history, evenly spaced, oldest first. */
  values: number[]
  /** Season length in steps — 7 for daily data with a weekly cycle, 12 for monthly data. */
  period: number
  /** Steps to forecast. Defaults to one season. */
  horizon?: number
  /** Additive when the seasonal swing stays the same size; multiplicative when it grows with the level. */
  seasonality?: ForecastChartSeasonality
  /** Fixed smoothing weights. Leave out to fit them by minimising squared one-step error. */
  params?: ForecastChartParams
  /** Coverage of the prediction band. */
  confidence?: 0.8 | 0.9 | 0.95 | 0.99
  /** Accessible name for the chart. */
  label: string
  /** Names step `index` — a date, a month. Indexes past the history are forecast steps. */
  formatX?: (index: number) => string
  /** Format values on the axis and in the tooltip. */
  formatY?: (value: number) => string
  /** Draw the model's one-step predictions over the history. */
  showFitted?: boolean
  /** Show the fitted weights and error metrics under the chart. */
  showMetrics?: boolean
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Called with the fitted model whenever it is refitted. */
  onFit?: (fit: ForecastChartFit) => void
  /** Merged last, so it wins. */
  className?: string
}

const Z = { 0.8: 1.2816, 0.9: 1.6449, 0.95: 1.96, 0.99: 2.5758 }
const PAD = { top: 16, right: 14, bottom: 26 }

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1)

/** One pass of Holt–Winters over `values`: fitted one-step predictions, SSE, and `horizon` steps ahead. */
function holtWinters(values: number[], m: number, mode: ForecastChartSeasonality, p: ForecastChartParams, horizon: number) {
  const add = mode === 'additive'
  let level = mean(values.slice(0, m))
  let trend = (mean(values.slice(m, 2 * m)) - level) / m
  const season = values.slice(0, m).map((value) => (add ? value - level : value / level))
  const fitted: number[] = []
  let sse = 0
  let count = 0
  let ape = 0
  let apeCount = 0
  for (let t = 0; t < values.length; t += 1) {
    const s = season[t % m]
    const guess = add ? level + trend + s : (level + trend) * s
    fitted.push(guess)
    const y = values[t]
    if (t >= m) {
      sse += (y - guess) ** 2
      count += 1
      if (y !== 0) {
        ape += Math.abs((y - guess) / y)
        apeCount += 1
      }
    }
    const previous = level
    level = p.alpha * (add ? y - s : y / s) + (1 - p.alpha) * (level + trend)
    trend = p.beta * (level - previous) + (1 - p.beta) * trend
    season[t % m] = p.gamma * (add ? y - level : y / level) + (1 - p.gamma) * s
  }
  const forecast: number[] = []
  for (let k = 1; k <= horizon; k += 1) {
    const s = season[(values.length - 1 + k) % m]
    forecast.push(add ? level + k * trend + s : (level + k * trend) * s)
  }
  return { fitted, forecast, sse: Number.isFinite(sse) ? sse : Infinity, count, mape: apeCount ? ape / apeCount : 0 }
}

/**
 * Weights that minimise one-step squared error: a coarse 10×10×10 grid, then
 * coordinate descent with a shrinking step around the best cell. A thousand
 * passes over a few hundred points is a few milliseconds.
 */
function fitParams(values: number[], m: number, mode: ForecastChartSeasonality): ForecastChartParams {
  const cost = (p: ForecastChartParams) => holtWinters(values, m, mode, p, 0).sse
  let best = { alpha: 0.5, beta: 0.1, gamma: 0.1 }
  let bestCost = Infinity
  for (let a = 0.05; a < 1; a += 0.1)
    for (let b = 0.05; b < 1; b += 0.1)
      for (let g = 0.05; g < 1; g += 0.1) {
        const candidate = { alpha: a, beta: b, gamma: g }
        const value = cost(candidate)
        if (value < bestCost) {
          bestCost = value
          best = candidate
        }
      }
  for (const step of [0.04, 0.02, 0.01, 0.005]) {
    let improved = true
    while (improved) {
      improved = false
      for (const key of ['alpha', 'beta', 'gamma'] as const)
        for (const sign of [-1, 1]) {
          const candidate = { ...best, [key]: Math.min(0.999, Math.max(0.001, best[key] + sign * step)) }
          const value = cost(candidate)
          if (value < bestCost - 1e-12) {
            bestCost = value
            best = candidate
            improved = true
          }
        }
    }
  }
  return best
}

/**
 * A forecast with its uncertainty drawn in: Holt–Winters triple exponential
 * smoothing fitted to the history, projected `horizon` steps ahead, with a
 * prediction band that widens the further out it goes.
 *
 * The weights are fitted, not guessed — a grid search then a local refinement
 * on squared one-step error — because hand-picked smoothing weights are the
 * usual reason a forecast looks confident and is wrong. The band comes from the
 * residual variance, widened per step by the model's own error propagation, so
 * a volatile history gives an honestly wide band. MAPE is reported twice: on the
 * fitted history, and on a refit that held back the last `horizon` points,
 * which is the number that says how far to trust what is on the right.
 */
export function ForecastChart({
  values,
  period,
  horizon = period,
  seasonality = 'additive',
  params,
  confidence = 0.8,
  label,
  formatX = (index) => String(index + 1),
  formatY = formatTick,
  showFitted = true,
  showMetrics = true,
  height = 260,
  onFit,
  className,
}: ForecastChartProps) {
  const tableId = useId()
  const clipId = svgId(`${tableId}clip`)
  const drawn = useDrawIn()
  const m = Math.max(2, Math.round(period))
  const usable = values.length >= 2 * m
  const mode: ForecastChartSeasonality = seasonality === 'multiplicative' && values.every((value) => value > 0) ? 'multiplicative' : 'additive'

  const fit = useMemo<ForecastChartFit | null>(() => {
    if (!usable) return null
    const weights = params ?? fitParams(values, m, mode)
    const run = holtWinters(values, m, mode, weights, horizon)
    const sigma2 = run.sse / Math.max(1, run.count - 3)
    const z = Z[confidence]
    const lower: number[] = []
    const upper: number[] = []
    let spread = 1
    for (let h = 1; h <= horizon; h += 1) {
      if (h > 1) {
        const j = h - 1
        spread += (weights.alpha * (1 + j * weights.beta) + (j % m === 0 ? weights.gamma : 0)) ** 2
      }
      const half = z * Math.sqrt(sigma2 * spread)
      lower.push(run.forecast[h - 1] - half)
      upper.push(run.forecast[h - 1] + half)
    }
    let holdoutMape: number | null = null
    const train = values.slice(0, values.length - horizon)
    if (horizon > 0 && train.length >= 2 * m + 2) {
      const back = holtWinters(train, m, mode, params ?? fitParams(train, m, mode), horizon).forecast
      let sum = 0
      let seen = 0
      back.forEach((guess, index) => {
        const actual = values[train.length + index]
        if (actual !== 0) {
          sum += Math.abs((actual - guess) / actual)
          seen += 1
        }
      })
      holdoutMape = seen ? sum / seen : null
    }
    return {
      ...weights,
      seasonality: mode,
      fitted: run.fitted,
      forecast: run.forecast,
      lower,
      upper,
      mape: run.mape,
      holdoutMape,
      rmse: Math.sqrt(run.sse / Math.max(1, run.count)),
    }
    // Params are compared by value, so an inline object does not refit every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, m, mode, params?.alpha, params?.beta, params?.gamma, horizon, confidence, usable])

  useEffect(() => {
    if (fit) onFit?.(fit)
    // Reported when the model changes, not when the callback's identity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit])

  const n = values.length
  const total = n + (fit ? horizon : 0)
  const { active, setActive, keyProps } = useChartCursor(total)

  if (!fit) {
    return (
      <div className={cn('rounded-[var(--radius-card)] border border-dashed border-line-strong p-6 text-center', className)}>
        <Text size="caption" weight="medium" tone="soft">
          {`${label}: a seasonal forecast needs at least two full seasons of history (${2 * m} points); there are ${n}.`}
        </Text>
      </div>
    )
  }

  let low = Infinity
  let high = -Infinity
  for (const value of [...values, ...fit.lower, ...fit.upper, ...(showFitted ? fit.fitted.slice(m) : [])]) {
    if (value < low) low = value
    if (value > high) high = value
  }
  const ys = niceScale(low, high, 4)
  const left = gutterFor(ys.ticks, formatY)
  const plot = { x: left, y: PAD.top, width: PLOT_WIDTH - left - PAD.right, height: height - PAD.top - PAD.bottom }
  const toX = linear(0, total - 1, plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const line = (points: [number, number][]) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`).join('')

  const last: [number, number] = [n - 1, values[n - 1]]
  const actualPath = line(values.map((value, index) => [index, value]))
  const fittedPath = line(fit.fitted.slice(m).map((value, index) => [index + m, value]))
  const forecastPath = line([last, ...fit.forecast.map((value, index): [number, number] => [n + index, value])])
  const bandPath = `${line([last, ...fit.upper.map((value, index): [number, number] => [n + index, value])])}${fit.lower
    .map((value, index) => [n + index, value] as [number, number])
    .reverse()
    .map(([x, y]) => `L${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`)
    .join('')}Z`
  const split = toX(n - 1)
  const tickEvery = Math.max(1, Math.ceil(total / 8))
  const coverage = `${Math.round(confidence * 100)}%`
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`

  const rowsAt = (index: number) => {
    if (index < n) {
      return [
        { label: 'Actual', value: formatY(values[index]), color: 'var(--color-ink)' },
        ...(showFitted && index >= m ? [{ label: 'Fitted', value: formatY(fit.fitted[index]), color: 'var(--color-ink-faint)' }] : []),
      ]
    }
    const k = index - n
    return [
      { label: 'Forecast', value: formatY(fit.forecast[k]), color: 'var(--color-accent-strong)' },
      { label: `${coverage} low`, value: formatY(fit.lower[k]) },
      { label: `${coverage} high`, value: formatY(fit.upper[k]) },
    ]
  }
  const yAt = (index: number) => (index < n ? values[index] : fit.forecast[index - n])

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x } = pointerToView(event, PLOT_WIDTH, height)
    const index = Math.round(((x - plot.x) / plot.width) * (total - 1))
    setActive(index >= 0 && index < total ? index : null)
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${n} observed points and a ${horizon}-step forecast with a ${coverage} prediction band; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
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
                height={height}
                className={cn('transition-transform', DRAW_IN_CLASS)}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'left center',
                  transform: `scaleX(${drawn ? 1 : (split - plot.x) / plot.width})`,
                }}
              />
            </clipPath>
          </defs>
          {ys.ticks.map((tick) => (
            <g key={tick}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {formatY(tick)}
              </text>
            </g>
          ))}
          {Array.from({ length: total }, (_, index) => index)
            .filter((index) => index % tickEvery === 0)
            .map((index) => (
              <text key={index} x={toX(index)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
                {formatX(index)}
              </text>
            ))}
          <rect x={split} y={plot.y} width={plot.x + plot.width - split} height={plot.height} className="fill-surface-sunken" />
          <line x1={split} x2={split} y1={plot.y - 6} y2={plot.y + plot.height} className="stroke-line-strong" strokeWidth="1" strokeDasharray="3 3" />
          <text x={split - 6} y={plot.y - 4} textAnchor="end" className="fill-ink-faint text-[9px] font-semibold">
            History
          </text>
          <text x={split + 6} y={plot.y - 4} className="fill-ink-faint text-[9px] font-semibold">
            Forecast
          </text>
          <g clipPath={`url(#${clipId})`}>
            <path d={bandPath} fill="color-mix(in oklab, var(--color-accent-strong) 28%, transparent)" />
            {showFitted && <path d={fittedPath} fill="none" stroke="var(--color-ink-faint)" strokeWidth="1.25" strokeDasharray="4 3" />}
            <path d={actualPath} fill="none" stroke="var(--color-ink)" strokeWidth="1.75" strokeLinejoin="round" />
            <path d={forecastPath} fill="none" stroke="var(--color-accent-strong)" strokeWidth="2.25" strokeLinejoin="round" />
          </g>
          {active !== null && (
            <g pointerEvents="none">
              <line x1={toX(active)} x2={toX(active)} y1={plot.y} y2={plot.y + plot.height} className="stroke-ink-faint" strokeWidth="1" />
              <circle cx={toX(active)} cy={toY(yAt(active))} r="4" fill={active < n ? 'var(--color-ink)' : 'var(--color-accent-strong)'} className="stroke-surface" strokeWidth="2" />
            </g>
          )}
        </svg>
        {active !== null && (
          <PlotTip x={toX(active)} y={toY(yAt(active))} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={`${formatX(active)}${active >= n ? ` · step ${active - n + 1}` : ''}`} rows={rowsAt(active)} />
          </PlotTip>
        )}
      </div>

      <Legend
        label={`${label} key`}
        series={[
          { label: 'Actual', color: 'var(--color-ink)' },
          ...(showFitted ? [{ label: 'Fitted', color: 'var(--color-ink-faint)' }] : []),
          { label: 'Forecast', color: 'var(--color-accent-strong)' },
          { label: `${coverage} prediction interval`, color: 'color-mix(in oklab, var(--color-accent-strong) 35%, transparent)' },
        ]}
      />

      {showMetrics && (
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            ['α level', fit.alpha.toFixed(3)],
            ['β trend', fit.beta.toFixed(3)],
            ['γ season', fit.gamma.toFixed(3)],
            ['MAPE (fit)', pct(fit.mape)],
            [`MAPE (last ${horizon})`, fit.holdoutMape === null ? '—' : pct(fit.holdoutMape)],
            ['RMSE', formatY(fit.rmse)],
          ].map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 rounded-[var(--radius-10)] bg-surface-sunken px-2.5 py-2">
              <Text as="dt" size="micro" weight="semibold" tone="faint">
                {term}
              </Text>
              <Text as="dd" size="label" weight="bold" tabular>
                {value}
              </Text>
            </div>
          ))}
        </dl>
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. ${mode === 'additive' ? 'Additive' : 'Multiplicative'} Holt–Winters, season ${m}.`}</caption>
          <thead>
            <tr>
              {['Step', 'Actual', 'Fitted', 'Forecast', `${coverage} low`, `${coverage} high`].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: total }, (_, index) => (
              <tr key={index}>
                <th scope="row">{formatX(index)}</th>
                <td>{index < n ? formatY(values[index]) : ''}</td>
                <td>{index < n && index >= m ? formatY(fit.fitted[index]) : ''}</td>
                <td>{index >= n ? formatY(fit.forecast[index - n]) : ''}</td>
                <td>{index >= n ? formatY(fit.lower[index - n]) : ''}</td>
                <td>{index >= n ? formatY(fit.upper[index - n]) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer message={active === null ? '' : `${formatX(active)}: ${rowsAt(active).map((row) => `${row.label} ${row.value}`).join(', ')}`} />
    </div>
  )
}
