'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PLOT_WIDTH, PlotAnnouncer, PlotTip, useDrawIn } from '../internal/plot'

/** A GeoJSON position: longitude, latitude in degrees. */
export type ChoroplethMapPosition = [number, number] | number[]

export interface ChoroplethMapFeature {
  type: 'Feature'
  id?: string | number
  properties?: Record<string, unknown> | null
  geometry:
    | { type: 'Polygon'; coordinates: ChoroplethMapPosition[][] }
    | { type: 'MultiPolygon'; coordinates: ChoroplethMapPosition[][][] }
}

export interface ChoroplethMapFeatureCollection {
  type: 'FeatureCollection'
  features: ChoroplethMapFeature[]
}

export type ChoroplethMapProjection = 'equirectangular' | 'mercator'

export interface ChoroplethMapProps {
  /** Regions as a GeoJSON FeatureCollection of Polygons and MultiPolygons. */
  data: ChoroplethMapFeatureCollection
  /** Value per region, keyed by what `featureKey` returns. Missing keys are drawn as “no data”. */
  values: Record<string, number>
  /** Accessible name for the map. */
  label: string
  /** Key of a feature in `values`. Defaults to `feature.id`, then `properties.id`. */
  featureKey?: (feature: ChoroplethMapFeature) => string
  /** Name of a feature for labels. Defaults to `properties.name`, then the key. */
  featureName?: (feature: ChoroplethMapFeature) => string
  /** Equirectangular keeps areas honest near the equator; Mercator is what people expect of a world map. */
  projection?: ChoroplethMapProjection
  /** Colour steps between the lowest and highest value. */
  steps?: number
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Format values in the legend, tooltip and table. */
  format?: (value: number) => string
  /** What a value measures — “Signups per 1,000”. */
  valueLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

const RAD = Math.PI / 180
const MERCATOR_LIMIT = 85.05112878 * RAD

/** Longitude and latitude in degrees to unscaled plane coordinates, y up. */
function project(kind: ChoroplethMapProjection, [lon, lat]: ChoroplethMapPosition): [number, number] {
  const lambda = lon * RAD
  const phi = Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat * RAD))
  return kind === 'mercator' ? [lambda, Math.log(Math.tan(Math.PI / 4 + phi / 2))] : [lambda, lat * RAD]
}

const polygonsOf = (feature: ChoroplethMapFeature) =>
  feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates

const stepColor = (step: number, steps: number) =>
  `color-mix(in oklab, var(--color-accent-strong) ${Math.round(12 + (step / Math.max(1, steps - 1)) * 88)}%, var(--color-surface))`

/**
 * Regions shaded by a value, from GeoJSON you already have.
 *
 * The projection is implemented here — equirectangular or Mercator — and fitted
 * to the viewport from the data’s own bounds, so a map of four districts fills
 * the frame as well as a map of the world does, with no tile server and no map
 * library. Values fall into a few equal steps rather than a continuous ramp,
 * because a reader can match five swatches to a legend and cannot match fifty.
 *
 * Regions are one tab stop; arrow keys move to the nearest region in that
 * direction, which is how a sighted keyboard user expects a map to behave, and
 * every value is in the hidden table.
 */
export function ChoroplethMap({
  data,
  values,
  label,
  featureKey = (feature) => String(feature.id ?? feature.properties?.id ?? ''),
  featureName,
  projection = 'mercator',
  steps = 5,
  height = 360,
  format = formatTick,
  valueLabel = 'Value',
  className,
}: ChoroplethMapProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const [active, setActive] = useState<number | null>(null)

  const regions = useMemo(() => {
    const projected = data.features.map((feature) => polygonsOf(feature).map((rings) => rings.map((ring) => ring.map((position) => project(projection, position)))))
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const polygons of projected)
      for (const rings of polygons)
        for (const [x, y] of rings[0] ?? []) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
    const pad = 12
    const scale = Math.min((PLOT_WIDTH - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1))
    const ox = (PLOT_WIDTH - (maxX - minX) * scale) / 2
    const oy = (height - (maxY - minY) * scale) / 2
    const toView = ([x, y]: [number, number]) => [ox + (x - minX) * scale, oy + (maxY - y) * scale] as const

    return data.features.map((feature, index) => {
      let area = 0
      let cx = 0
      let cy = 0
      const d = projected[index]
        .map((rings) =>
          rings
            .map((ring, ringIndex) => {
              const points = ring.map(toView)
              if (ringIndex === 0) {
                // Area-weighted centroid of each outer ring, so the tooltip sits on the land.
                // Each ring is normalised to positive area, so islands wound either way add up.
                let ringArea = 0
                let ringX = 0
                let ringY = 0
                for (let i = 0; i < points.length - 1; i += 1) {
                  const cross = points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]
                  ringArea += cross
                  ringX += (points[i][0] + points[i + 1][0]) * cross
                  ringY += (points[i][1] + points[i + 1][1]) * cross
                }
                const sign = ringArea < 0 ? -1 : 1
                area += ringArea * sign
                cx += ringX * sign
                cy += ringY * sign
              }
              return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`
            })
            .join(''),
        )
        .join('')
      const key = featureKey(feature)
      return {
        key,
        name: featureName?.(feature) ?? String(feature.properties?.name ?? key),
        d,
        x: area ? cx / (3 * area) : PLOT_WIDTH / 2,
        y: area ? cy / (3 * area) : height / 2,
        value: Number.isFinite(values[key]) ? values[key] : null,
      }
    })
  }, [data, values, projection, height, featureKey, featureName])

  const known = regions.map((region) => region.value).filter((value): value is number => value !== null)
  const min = Math.min(...known)
  const max = Math.max(...known)
  const stepOf = (value: number) => (max === min ? steps - 1 : Math.min(steps - 1, Math.floor(((value - min) / (max - min)) * steps)))
  const bounds = Array.from({ length: steps }, (_, step) => [min + ((max - min) * step) / steps, min + ((max - min) * (step + 1)) / steps])
  const region = active === null ? null : regions[active]
  const hasGaps = known.length < regions.length

  const onKeyDown = (event: KeyboardEvent) => {
    if (!regions.length) return
    const directions: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    let next: number | null = active
    if (event.key in directions) {
      if (active === null) next = 0
      else {
        const [dx, dy] = directions[event.key]
        let best = Infinity
        regions.forEach((candidate, index) => {
          const vx = candidate.x - regions[active].x
          const vy = candidate.y - regions[active].y
          const along = vx * dx + vy * dy
          if (index === active || along <= 1) return
          // Distance, with sideways drift costing double, so Right means right.
          const cost = along + Math.abs(vx * dy - vy * dx) * 2
          if (cost < best) {
            best = cost
            next = index
          }
        })
      }
    } else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = regions.length - 1
    else if (event.key === 'Escape' && active !== null) next = null
    else return
    event.preventDefault()
    setActive(next)
  }

  const describe = (entry: (typeof regions)[number]) => `${entry.name}: ${entry.value === null ? 'no data' : `${valueLabel.toLowerCase()} ${format(entry.value)}`}`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${regions.length} regions; use arrow keys to move between neighbouring regions.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {regions.map((entry, index) => (
            <path
              key={entry.key || index}
              d={entry.d}
              fillRule="evenodd"
              fill={entry.value === null ? 'var(--color-surface-muted)' : stepColor(stepOf(entry.value), steps)}
              stroke="var(--color-surface)"
              strokeWidth="1.25"
              strokeLinejoin="round"
              opacity={drawn ? 1 : 0}
              className={cn('transition-opacity', DRAW_IN_CLASS)}
              onPointerEnter={() => setActive(index)}
            />
          ))}
          {region && <path d={region.d} fill="none" stroke="var(--color-ink)" strokeWidth="2.25" strokeLinejoin="round" pointerEvents="none" />}
        </svg>
        {region && (
          <PlotTip x={region.x} y={region.y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={region.name} rows={[{ label: valueLabel, value: region.value === null ? 'No data' : format(region.value) }]} />
          </PlotTip>
        )}
      </div>

      <ul aria-label={`${valueLabel} scale`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {bounds.map(([low, high], step) =>
          known.length === 0 || (max === min && step < steps - 1) ? null : (
            <li key={step} className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
              <span aria-hidden="true" className="h-2.5 w-5 rounded-sm" style={{ background: stepColor(step, steps) }} />
              {max === min ? format(max) : `${format(low)}–${format(high)}`}
            </li>
          ),
        )}
        {hasGaps && (
          <li className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-sm border border-line-strong bg-surface-muted" />
            No data
          </li>
        )}
      </ul>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {[...regions]
              .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
              .map((entry, index) => (
                <tr key={entry.key || index}>
                  <th scope="row">{entry.name}</th>
                  <td>{entry.value === null ? 'No data' : format(entry.value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={region ? describe(region) : ''} />
    </div>
  )
}
