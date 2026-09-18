'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import { ChevronRightIcon } from '../internal/icons'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, useDrawIn } from '../internal/plot'

export interface SunburstChartNode {
  id: string
  label: string
  /** Value of a leaf. A branch is the sum of its children, so a branch value is ignored. */
  value?: number
  children?: SunburstChartNode[]
  /** Any CSS colour. Set on a top-level branch, it tints everything beneath it. */
  color?: string
}

export interface SunburstChartProps {
  /** The root. Its label is printed in the centre until you zoom in. */
  data: SunburstChartNode
  /** Accessible name for the chart. */
  label: string
  /** Rings drawn outward from the node in focus. Deeper levels appear as you zoom. */
  depth?: number
  /** Largest rendered size in pixels. The chart shrinks with its container. */
  size?: number
  /** Format values in the centre, tooltip and hidden list. */
  format?: (value: number) => string
  /** What a value measures, for the tooltip — “Spend”, “Size”. */
  valueLabel?: string
  /** Called when the chart zooms, with the id of the node now in the centre. */
  onZoom?: (id: string) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Arc {
  node: SunburstChartNode
  value: number
  parentValue: number
  depth: number
  a0: number
  a1: number
  color: string
  parent: number | null
}

const VIEW = 320
const CENTRE = VIEW / 2
const HOLE = 50
const TAU = Math.PI * 2

const totalOf = (node: SunburstChartNode): number =>
  node.children?.length
    ? node.children.reduce((sum, child) => sum + totalOf(child), 0)
    : Math.max(0, Number.isFinite(node.value) ? (node.value as number) : 0)

function findPath(node: SunburstChartNode, id: string): SunburstChartNode[] | null {
  if (node.id === id) return [node]
  for (const child of node.children ?? []) {
    const path = findPath(child, id)
    if (path) return [node, ...path]
  }
  return null
}

const point = (radius: number, angle: number) => [CENTRE + radius * Math.sin(angle), CENTRE - radius * Math.cos(angle)]

function arcPath(r0: number, r1: number, a0: number, a1: number): string {
  // A full ring cannot be one arc command: start and end coincide and it draws nothing.
  if (a1 - a0 >= TAU - 1e-6) return `${arcPath(r0, r1, a0, a0 + Math.PI)} ${arcPath(r0, r1, a0 + Math.PI, a1)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = point(r1, a0)
  const [x1, y1] = point(r1, a1)
  const [x2, y2] = point(r0, a1)
  const [x3, y3] = point(r0, a0)
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}

/**
 * A hierarchy as rings: the whole in the centre, each level one ring further
 * out, every arc as wide as its share of its parent.
 *
 * Only a few rings are drawn at a time. Past three levels the outer arcs are
 * slivers nobody can hover, so the chart zooms instead — click or press Enter on
 * a branch and it becomes the centre, with a breadcrumb back up. Labels print
 * only where the arc is long enough to hold them; everything else is one hover
 * or one arrow key away, and the whole tree is in a hidden nested list.
 *
 * Top-level branches take a series colour and their descendants are that colour
 * mixed further into the surface at each level, so a branch reads as one family
 * without a legend. Arrow keys walk the tree the way it is drawn: left and right
 * round a ring, out to the first child and in to the parent.
 */
export function SunburstChart({
  data,
  label,
  depth = 3,
  size = 320,
  format = formatTick,
  valueLabel = 'Value',
  onZoom,
  className,
}: SunburstChartProps) {
  const listId = useId()
  const [focusId, setFocusId] = useState(data.id)
  const [active, setActive] = useState<number | null>(null)

  const path = findPath(data, focusId) ?? [data]
  const focus = path[path.length - 1]
  const focusTotal = totalOf(focus)
  const rootTotal = totalOf(data)
  const ring = (CENTRE - 4 - HOLE) / Math.max(1, depth)

  const arcs: Arc[] = []
  const layout = (
    node: SunburstChartNode,
    level: number,
    a0: number,
    a1: number,
    color: string | null,
    parent: number | null,
  ) => {
    const value = totalOf(node)
    let start = a0
    for (const [index, child] of (node.children ?? []).entries()) {
      const childValue = totalOf(child)
      if (childValue <= 0) continue
      const end = start + (value ? ((a1 - a0) * childValue) / value : 0)
      const base = child.color ?? color ?? SERIES_COLORS[index % SERIES_COLORS.length]
      const mix = 100 - (level - 1) * 24
      arcs.push({
        node: child,
        value: childValue,
        parentValue: value,
        depth: level,
        a0: start,
        a1: end,
        color: level === 1 ? base : `color-mix(in oklab, ${base} ${mix}%, var(--color-surface))`,
        parent,
      })
      if (level < depth) layout(child, level + 1, start, end, base, arcs.length - 1)
      start = end
    }
  }
  layout(focus, 1, 0, TAU, null, null)

  const zoomTo = (id: string, cursor: number | null = null) => {
    setFocusId(id)
    setActive(cursor)
    onZoom?.(id)
  }
  const current = active !== null && active < arcs.length ? arcs[active] : null

  const siblingsOf = (index: number) =>
    arcs.flatMap((arc, at) => (arc.parent === arcs[index].parent && arc.depth === arcs[index].depth ? [at] : []))

  const onKeyDown = (event: KeyboardEvent) => {
    const at = active !== null && active < arcs.length ? active : null
    let next: number | null = at
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (at !== null && event.key === 'Escape') next = null
      else if (path.length > 1) {
        event.preventDefault()
        zoomTo(path[path.length - 2].id, 0)
        return
      } else return
    } else if (at === null) {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      next = arcs.length ? 0 : null
    } else {
      const siblings = siblingsOf(at)
      const position = siblings.indexOf(at)
      switch (event.key) {
        case 'ArrowRight':
          next = siblings[(position + 1) % siblings.length]
          break
        case 'ArrowLeft':
          next = siblings[(position - 1 + siblings.length) % siblings.length]
          break
        case 'ArrowDown': {
          const child = arcs.findIndex((arc) => arc.parent === at)
          next = child === -1 ? at : child
          break
        }
        case 'ArrowUp':
          next = arcs[at].parent ?? at
          break
        case 'Home':
          next = siblings[0]
          break
        case 'End':
          next = siblings[siblings.length - 1]
          break
        case 'Enter':
        case ' ':
          if (arcs[at].node.children?.length) {
            event.preventDefault()
            zoomTo(arcs[at].node.id, 0)
          }
          return
        default:
          return
      }
    }
    event.preventDefault()
    setActive(next)
  }

  const describe = (arc: Arc) =>
    `${arc.node.label}: ${format(arc.value)}, ${Math.round((arc.value / (arc.parentValue || 1)) * 100)}% of ${
      arc.parent === null ? focus.label : arcs[arc.parent].node.label
    }${arc.node.children?.length ? `, ${arc.node.children.length} children, press Enter to zoom in` : ''}`

  const renderList = (nodes: SunburstChartNode[], parentValue: number) => (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          {`${node.label}: ${format(totalOf(node))} (${Math.round((totalOf(node) / (parentValue || 1)) * 100)}%)`}
          {node.children?.length ? renderList(node.children, totalOf(node)) : null}
        </li>
      ))}
    </ul>
  )

  const tip = current ? point(HOLE + ring * (current.depth - 0.5), (current.a0 + current.a1) / 2) : null

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <nav aria-label={`${label} path`} className="self-stretch">
        <ol className="flex list-none flex-wrap items-center gap-1 text-[11px]">
          {path.map((node, index) => (
            <li key={node.id} className="flex items-center gap-1">
              {index > 0 && <ChevronRightIcon size={12} className="text-ink-faint" />}
              {index === path.length - 1 ? (
                <span aria-current="location" className="font-bold text-ink">
                  {node.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => zoomTo(node.id)}
                  className="rounded-[6px] px-1 font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {node.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="relative w-full" style={{ maxWidth: size }}>
        <svg
          role="img"
          aria-label={`${label}. ${focus.label}, ${format(focusTotal)}, split into ${
            arcs.filter((arc) => arc.depth === 1).length
          } parts. Arrow keys move between arcs, Enter zooms in, Backspace zooms out.`}
          aria-describedby={listId}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full rounded-full outline-offset-2"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={(event) => {
            let keyboard = false
            try {
              keyboard = event.currentTarget.matches(':focus-visible')
            } catch {
              keyboard = false
            }
            if (keyboard && active === null && arcs.length) setActive(0)
          }}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          <Rings key={focus.id} arcs={arcs} ring={ring} active={active} onHover={setActive} onZoom={zoomTo} />
          <g
            onClick={() => path.length > 1 && zoomTo(path[path.length - 2].id)}
            onPointerEnter={() => setActive(null)}
            className={cn(path.length > 1 && 'cursor-pointer')}
          >
            <circle cx={CENTRE} cy={CENTRE} r={HOLE - 3} className="fill-surface" />
            <text x={CENTRE} y={CENTRE - 6} textAnchor="middle" className="fill-ink-faint text-[9px] font-semibold">
              {focus.label.length > 14 ? `${focus.label.slice(0, 13)}…` : focus.label}
            </text>
            <text x={CENTRE} y={CENTRE + 10} textAnchor="middle" className="fill-ink text-[14px] font-extrabold">
              {format(focusTotal)}
            </text>
          </g>
        </svg>

        {current && tip && (
          <PlotTip x={tip[0]} y={tip[1]} width={VIEW} height={VIEW}>
            <ChartTooltip
              title={current.node.label}
              rows={[
                { label: valueLabel, value: format(current.value), color: current.color },
                {
                  label: `Share of ${current.parent === null ? focus.label : arcs[current.parent].node.label}`,
                  value: `${((current.value / (current.parentValue || 1)) * 100).toFixed(1)}%`,
                },
                ...(focus.id !== data.id || current.depth > 1
                  ? [{ label: 'Share of total', value: `${((current.value / (rootTotal || 1)) * 100).toFixed(1)}%` }]
                  : []),
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <div id={listId}>{renderList(focus.children ?? [], focusTotal)}</div>
      </VisuallyHidden>
      <PlotAnnouncer message={current ? describe(current) : ''} />
    </div>
  )
}

function Rings({
  arcs,
  ring,
  active,
  onHover,
  onZoom,
}: {
  arcs: Arc[]
  ring: number
  active: number | null
  onHover: (index: number) => void
  onZoom: (id: string) => void
}) {
  const drawn = useDrawIn()
  return (
    <g
      className={cn('transition-[transform,opacity]', DRAW_IN_CLASS)}
      style={{
        transformOrigin: `${CENTRE}px ${CENTRE}px`,
        transform: drawn ? 'scale(1)' : 'scale(0.82)',
        opacity: drawn ? 1 : 0,
      }}
    >
      {arcs.map((arc, index) => {
        const r0 = HOLE + ring * (arc.depth - 1)
        const r1 = r0 + ring
        const mid = (arc.a0 + arc.a1) / 2
        const rMid = (r0 + r1) / 2
        const text = arc.node.label
        const fits = (arc.a1 - arc.a0) * rMid > text.length * 5 + 10 && ring >= 14
        const [tx, ty] = point(rMid, mid)
        let rotate = (mid * 180) / Math.PI
        if (rotate > 90 && rotate < 270) rotate += 180
        const zoomable = Boolean(arc.node.children?.length)
        return (
          <g
            key={arc.node.id}
            onPointerEnter={() => onHover(index)}
            onClick={() => zoomable && onZoom(arc.node.id)}
            className={cn(zoomable && 'cursor-pointer')}
          >
            <path
              d={arcPath(r0 + 0.75, r1 - 0.75, arc.a0, arc.a1)}
              fill={arc.color}
              className="stroke-surface transition-opacity"
              strokeWidth="1.5"
              opacity={active === null || active === index ? 1 : 0.55}
            />
            {fits && (
              <text
                x={tx}
                y={ty}
                transform={`rotate(${rotate} ${tx} ${ty})`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-ink stroke-surface text-[8.5px] font-semibold"
                strokeWidth="2.5"
                paintOrder="stroke"
              >
                {text}
              </text>
            )}
          </g>
        )
      })}
      {active !== null && arcs[active] && (
        <path
          d={arcPath(
            HOLE + ring * (arcs[active].depth - 1) + 0.75,
            HOLE + ring * arcs[active].depth - 0.75,
            arcs[active].a0,
            arcs[active].a1,
          )}
          fill="none"
          className="pointer-events-none stroke-ink"
          strokeWidth="2"
        />
      )}
    </g>
  )
}
