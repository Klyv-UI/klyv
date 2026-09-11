'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface FlowNode {
  id: string
  label: string
  color?: string
}

export interface FlowLink {
  from: string
  to: string
  value: number
}

export interface SankeyFlowProps {
  nodes: FlowNode[]
  links: FlowLink[]
  /** Accessible name — what is flowing. */
  label: string
  /** Diagram width. It scrolls horizontally when it does not fit. */
  width?: number
  /** Diagram height. */
  height?: number
  /** Node bar width in pixels. */
  nodeWidth?: number
  /** Minimum gap between nodes in a column, in pixels. */
  nodePadding?: number
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

interface Placed {
  node: FlowNode
  column: number
  value: number
  x: number
  y: number
  height: number
}

/** A ribbon between two node edges, with a flat top and bottom. */
function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
  const mid = (x0 + x1) / 2
  return [
    `M${x0},${y0}`,
    `C${mid},${y0} ${mid},${y1} ${x1},${y1}`,
    `L${x1},${y1 + h1}`,
    `C${mid},${y1 + h1} ${mid},${y0 + h0} ${x0},${y0 + h0}`,
    'Z',
  ].join(' ')
}

/**
 * Where an amount comes from and where it goes, as ribbons whose thickness is
 * the amount itself.
 *
 * Columns are assigned by longest path from a source rather than by declaration
 * order, so a node that receives from two different depths still lands to the
 * right of both and no ribbon ever flows backwards. Height inside a column is
 * shared out by value, which is what makes thickness comparable across the
 * whole diagram rather than only within one column.
 *
 * Ribbons are cubic curves with a flat top and bottom edge — one path, not a
 * stroked line — because a stroke cannot taper, and the whole point is that a
 * flow arriving thinner than it left is visible as loss.
 *
 * Hovering a node lifts every flow through it and dims the rest. That is a
 * convenience, not the content: the full set of flows is in a hidden table, so
 * the diagram never holds the only copy of the numbers.
 */
export function SankeyFlow({
  nodes,
  links,
  label,
  width = 640,
  height = 300,
  nodeWidth = 12,
  nodePadding = 14,
  format = (value) => String(value),
  className,
}: SankeyFlowProps) {
  const tableId = useId()
  const [active, setActive] = useState<string | null>(null)

  const layout = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]))

    // Longest path from any source fixes the column, so nothing flows back.
    const column = new Map<string, number>()
    for (const node of nodes) column.set(node.id, 0)
    for (let pass = 0; pass < nodes.length; pass += 1) {
      let moved = false
      for (const link of links) {
        const next = (column.get(link.from) ?? 0) + 1
        if (next > (column.get(link.to) ?? 0)) {
          column.set(link.to, next)
          moved = true
        }
      }
      if (!moved) break
    }

    // A node is as thick as the larger of what enters and what leaves it.
    const incoming = new Map<string, number>()
    const outgoing = new Map<string, number>()
    for (const link of links) {
      outgoing.set(link.from, (outgoing.get(link.from) ?? 0) + link.value)
      incoming.set(link.to, (incoming.get(link.to) ?? 0) + link.value)
    }

    const columns = new Map<number, FlowNode[]>()
    for (const node of nodes) {
      const index = column.get(node.id) ?? 0
      const bucket = columns.get(index)
      if (bucket) bucket.push(node)
      else columns.set(index, [node])
    }

    const lastColumn = Math.max(...[...columns.keys()])
    const columnStep = lastColumn === 0 ? 0 : (width - nodeWidth) / lastColumn

    const placed = new Map<string, Placed>()
    for (const [index, members] of columns) {
      const total = members.reduce(
        (sum, node) => sum + Math.max(incoming.get(node.id) ?? 0, outgoing.get(node.id) ?? 0),
        0,
      )
      const available = height - nodePadding * Math.max(0, members.length - 1)
      let y = 0
      for (const node of members) {
        const value = Math.max(incoming.get(node.id) ?? 0, outgoing.get(node.id) ?? 0)
        const barHeight = total === 0 ? 0 : (value / total) * available
        placed.set(node.id, {
          node,
          column: index,
          value,
          x: index * columnStep,
          y,
          height: barHeight,
        })
        y += barHeight + nodePadding
      }
    }

    // Ribbons stack down each node's edge in declaration order.
    const usedOut = new Map<string, number>()
    const usedIn = new Map<string, number>()
    const ribbons = links.map((link, index) => {
      const from = placed.get(link.from)
      const to = placed.get(link.to)
      if (!from || !to) return null

      const fromTotal = outgoing.get(link.from) ?? 1
      const toTotal = incoming.get(link.to) ?? 1
      const h0 = (link.value / fromTotal) * from.height
      const h1 = (link.value / toTotal) * to.height
      const y0 = from.y + (usedOut.get(link.from) ?? 0)
      const y1 = to.y + (usedIn.get(link.to) ?? 0)
      usedOut.set(link.from, (usedOut.get(link.from) ?? 0) + h0)
      usedIn.set(link.to, (usedIn.get(link.to) ?? 0) + h1)

      return {
        key: `${link.from}-${link.to}-${index}`,
        link,
        d: ribbon(from.x + nodeWidth, y0, h0, to.x, y1, h1),
        color: byId.get(link.from)?.color ?? 'var(--color-accent-strong)',
      }
    })

    return {
      placed: [...placed.values()],
      ribbons: ribbons.filter(Boolean) as NonNullable<(typeof ribbons)[number]>[],
      lastColumn,
    }
  }, [height, links, nodePadding, nodeWidth, nodes, width])

  const touches = (id: string) =>
    active === null || active === id || layout.ribbons.some((entry) => (entry.link.from === active && entry.link.to === id) || (entry.link.to === active && entry.link.from === id))

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        width={width}
        height={height + 26}
        viewBox={`0 0 ${width} ${height + 26}`}
        role="img"
        aria-label={label}
        aria-describedby={tableId}
        className="min-w-full"
      >
        <g>
          {layout.ribbons.map((entry) => {
            const lit = active === null || entry.link.from === active || entry.link.to === active
            return (
              <path
                key={entry.key}
                d={entry.d}
                fill={entry.color}
                className="transition-opacity duration-[var(--duration-fast)]"
                style={{ opacity: lit ? 0.34 : 0.08 }}
              />
            )
          })}
        </g>

        {layout.placed.map((entry) => {
          // Labels sit to the right of their node, except in the last column,
          // where there is no room and they read inwards instead.
          const inward = entry.column === layout.lastColumn
          const labelX = inward ? entry.x - 6 : entry.x + nodeWidth + 6
          const anchor = inward ? 'end' : 'start'
          return (
          <g
            key={entry.node.id}
            onPointerEnter={() => setActive(entry.node.id)}
            onPointerLeave={() => setActive(null)}
            className="transition-opacity duration-[var(--duration-fast)]"
            style={{ opacity: touches(entry.node.id) ? 1 : 0.35 }}
          >
            <rect
              x={entry.x}
              y={entry.y}
              width={nodeWidth}
              height={Math.max(2, entry.height)}
              rx={3}
              fill={entry.node.color ?? 'var(--color-ink)'}
            />
            <text
              x={labelX}
              y={entry.y + entry.height / 2}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-ink text-[11px] font-bold"
            >
              {entry.node.label}
            </text>
            <text
              x={labelX}
              y={entry.y + entry.height / 2 + 13}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-ink-faint text-[10px] font-medium"
            >
              {format(entry.value)}
            </text>
          </g>
          )
        })}
      </svg>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {layout.ribbons.map((entry) => (
              <tr key={entry.key}>
                <td>{nodes.find((node) => node.id === entry.link.from)?.label}</td>
                <td>{nodes.find((node) => node.id === entry.link.to)?.label}</td>
                <td>{format(entry.link.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}
