'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
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

export interface CandlestickChartCandle {
  /** Period label — a date, an hour. Shown on the axis and in the tooltip. */
  date: string
  open: number
  high: number
  low: number
  close: number
  /** Traded volume, drawn as a bar under the candle. */
  volume?: number
}

export interface CandlestickChartProps {
  /** Oldest first. */
  candles: CandlestickChartCandle[]
  /** Accessible name for the chart. */
  label: string
  /** Chart height in pixels, volume included. The width fills the container. */
  height?: number
  /** Draw the volume pane when the candles carry volume. */
  showVolume?: boolean
  /** Format prices on the axis and in the tooltip. */
  format?: (value: number) => string
  /** Format volume in the tooltip. */
  formatVolume?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const UP = 'var(--color-success)'
const DOWN = 'var(--color-danger)'

/**
 * Open, high, low and close per period, with volume underneath.
 *
 * Up and down differ in fill as well as hue: a rising candle is hollow and a
 * falling one solid, the convention from before colour screens, which is also
 * what makes the chart readable to someone who cannot tell green from red.
 *
 * The crosshair follows the pointer on both axes and prints the price under it
 * on the axis, because reading a level off a candlestick chart is most of what
 * people use one for. From the keyboard the crosshair steps from candle to
 * candle and rests on the close.
 */
export function CandlestickChart({
  candles,
  label,
  height = 300,
  showVolume = true,
  format = formatTick,
  formatVolume = formatTick,
  className,
}: CandlestickChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const { active, setActive, keyProps } = useChartCursor(candles.length)
  const [pointerY, setPointerY] = useState<number | null>(null)

  const hasVolume = showVolume && candles.some((candle) => Number.isFinite(candle.volume))
  let low = Infinity
  let high = -Infinity
  let volumeMax = 0
  for (const candle of candles) {
    low = Math.min(low, candle.low)
    high = Math.max(high, candle.high)
    volumeMax = Math.max(volumeMax, candle.volume ?? 0)
  }
  const scale = niceScale(low, high, 4)
  const left = gutterFor(scale.ticks, format)
  const bottom = 26
  const volumeHeight = hasVolume ? Math.round((height - bottom) * 0.2) : 0
  const gap = hasVolume ? 10 : 0
  const price = { x: left, y: 12, width: PLOT_WIDTH - left - 12, height: height - 12 - bottom - volumeHeight - gap }
  const volumeTop = price.y + price.height + gap
  const toY = linear(scale.min, scale.max, price.y + price.height, price.y)
  const fromY = linear(price.y + price.height, price.y, scale.min, scale.max)
  const toVolume = linear(0, volumeMax || 1, 0, volumeHeight)
  const band = price.width / Math.max(1, candles.length)
  const body = Math.max(1.5, Math.min(18, band * 0.64))
  const centre = (index: number) => price.x + band * (index + 0.5)
  const labelStep = Math.ceil(candles.length / 8)

  const current = active === null ? null : candles[active]
  const crossY =
    current === null ? null : pointerY !== null && pointerY >= price.y && pointerY <= price.y + price.height ? pointerY : toY(current.close)

  const change = (candle: CandlestickChartCandle) => {
    const delta = candle.close - candle.open
    const percent = candle.open ? (delta / candle.open) * 100 : 0
    return `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))} (${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(2)}%)`
  }
  const describe = (candle: CandlestickChartCandle) =>
    `${candle.date}: open ${format(candle.open)}, high ${format(candle.high)}, low ${format(candle.low)}, close ${format(candle.close)}, ${change(candle)}${candle.volume !== undefined ? `, volume ${formatVolume(candle.volume)}` : ''}`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${candles.length} periods; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full cursor-crosshair rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.floor((point.x - price.x) / band)
            setActive(index >= 0 && index < candles.length ? index : null)
            setPointerY(point.y)
          }}
          onPointerLeave={() => {
            setActive(null)
            setPointerY(null)
          }}
          onKeyDown={(event) => {
            setPointerY(null)
            keyProps.onKeyDown(event)
          }}
          tabIndex={keyProps.tabIndex}
          onFocus={keyProps.onFocus}
          onBlur={keyProps.onBlur}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line x1={price.x} x2={price.x + price.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={price.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {format(tick)}
              </text>
            </g>
          ))}
          {hasVolume && (
            <line x1={price.x} x2={price.x + price.width} y1={volumeTop + volumeHeight} y2={volumeTop + volumeHeight} className="stroke-line" strokeWidth="1" />
          )}

          {candles.map((candle, index) => {
            const up = candle.close >= candle.open
            const tone = up ? UP : DOWN
            const x = centre(index)
            const top = toY(Math.max(candle.open, candle.close))
            const bottomY = toY(Math.min(candle.open, candle.close))
            const dim = active !== null && active !== index
            const vol = toVolume(candle.volume ?? 0)
            return (
              <g key={`${candle.date}-${index}`} opacity={dim ? 0.55 : 1}>
                {hasVolume && candle.volume !== undefined && (
                  <rect x={x - body / 2} y={volumeTop + volumeHeight - vol} width={body} height={vol} fill={tone} fillOpacity={0.35} />
                )}
                <g
                  className={cn('transition-[transform,opacity]', DRAW_IN_CLASS)}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: drawn ? 'scaleY(1)' : 'scaleY(0.3)',
                    opacity: drawn ? 1 : 0,
                    transitionDelay: drawn ? `${Math.min(index * 10, 400)}ms` : '0ms',
                  }}
                >
                  <line x1={x} x2={x} y1={toY(candle.high)} y2={toY(candle.low)} stroke={tone} strokeWidth="1.25" />
                  <rect
                    x={x - body / 2}
                    y={top}
                    width={body}
                    height={Math.max(1, bottomY - top)}
                    rx={Math.min(1.5, body / 4)}
                    fill={up ? 'var(--color-surface)' : tone}
                    stroke={tone}
                    strokeWidth="1.25"
                  />
                </g>
                {index % labelStep === 0 && (
                  <text x={x} y={height - 8} textAnchor="middle" className={TICK_CLASS}>
                    {candle.date}
                  </text>
                )}
              </g>
            )
          })}

          {current && active !== null && crossY !== null && (
            <g pointerEvents="none">
              <line x1={centre(active)} x2={centre(active)} y1={price.y} y2={volumeTop + volumeHeight} className="stroke-ink-faint" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={price.x} x2={price.x + price.width} y1={crossY} y2={crossY} className="stroke-ink-faint" strokeWidth="1" strokeDasharray="3 3" />
              <rect x={1} y={crossY - 8} width={left - 4} height={16} rx={3} className="fill-ink" />
              <text x={left / 2 - 1} y={crossY} textAnchor="middle" dominantBaseline="middle" className="fill-ink-inverse text-[9px] font-bold">
                {format(fromY(crossY))}
              </text>
            </g>
          )}
        </svg>

        {current && active !== null && (
          <PlotTip x={centre(active)} y={toY(current.high)} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={current.date}
              rows={[
                { label: 'Open', value: format(current.open) },
                { label: 'High', value: format(current.high) },
                { label: 'Low', value: format(current.low) },
                { label: 'Close', value: format(current.close), color: current.close >= current.open ? UP : DOWN },
                { label: 'Change', value: change(current) },
                ...(current.volume !== undefined ? [{ label: 'Volume', value: formatVolume(current.volume) }] : []),
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              {['Period', 'Open', 'High', 'Low', 'Close', 'Volume'].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candles.map((candle, index) => (
              <tr key={`${candle.date}-${index}`}>
                <th scope="row">{candle.date}</th>
                <td>{format(candle.open)}</td>
                <td>{format(candle.high)}</td>
                <td>{format(candle.low)}</td>
                <td>{format(candle.close)}</td>
                <td>{candle.volume === undefined ? '' : formatVolume(candle.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={current ? describe(current) : ''} />
    </div>
  )
}
