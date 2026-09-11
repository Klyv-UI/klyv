'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface TreeMapNode {
  id: string
  label: string
  value: number
  color?: string
}

export interface TreeMapProps {
  nodes: TreeMapNode[]
  /** Accessible name — what the whole area represents. */
  label: string
  /** Layout width. The rendered element keeps the ratio and fills its container. */
  width?: number
  /** Layout height. The rendered element keeps the ratio and fills its container. */
  height?: number
  /** Called when a tile is chosen. Tiles become buttons when set. */
  onSelect?: (node: TreeMapNode) => void
  /** Turns a value into its printed label. */
  format?: (value: number) => string
  /** Show each tile's share of the total. */
  showShare?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface Tile extends TreeMapNode {
  x: number
  y: number
  width: number
  height: number
  share: number
}

interface Space {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Tile fill by rank: one hue, strongest for the largest share.
 *
 * A categorical palette is wrong here — these are parts of one whole, not
 * unrelated series — and it also breaks the labels, since a mid-dark
 * categorical colour leaves dark text on a dark tile. A single-hue ramp
 * between two light tokens keeps every tile readable with the same ink.
 */
function rampFill(rank: number, count: number): string {
  const weight = count <= 1 ? 92 : 92 - (rank / (count - 1)) * 74
  return `color-mix(in oklab, var(--color-accent-strong) ${weight.toFixed(1)}%, var(--color-surface-muted))`
}

/** Worst aspect ratio in a row, given the row's values and the side it sits on. */
function worst(row: number[], side: number, scale: number): number {
  const sum = row.reduce((total, value) => total + value, 0) * scale
  const max = Math.max(...row) * scale
  const min = Math.min(...row) * scale
  const side2 = side * side
  const sum2 = sum * sum
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min))
}

/**
 * Squarified layout: lay values into rows along the shorter side, closing a row
 * as soon as adding another value would make its tiles less square.
 */
function squarify(values: TreeMapNode[], space: Space, total: number): Tile[] {
  const tiles: Tile[] = []
  const queue = [...values].sort((a, b) => b.value - a.value)
  let area = { ...space }
  let scale = (area.width * area.height) / (total || 1)
  let row: TreeMapNode[] = []

  const layRow = () => {
    if (row.length === 0) return
    const rowValue = row.reduce((sum, node) => sum + node.value, 0) * scale
    const vertical = area.width >= area.height
    const thickness = rowValue / (vertical ? area.height : area.width)
    let offset = vertical ? area.y : area.x

    for (const node of row) {
      const length = (node.value * scale) / thickness
      tiles.push({
        ...node,
        x: vertical ? area.x : offset,
        y: vertical ? offset : area.y,
        width: vertical ? thickness : length,
        height: vertical ? length : thickness,
        share: node.value / (total || 1),
      })
      offset += length
    }

    // The row is done; the rest of the space is what is left beside it.
    if (vertical) area = { ...area, x: area.x + thickness, width: area.width - thickness }
    else area = { ...area, y: area.y + thickness, height: area.height - thickness }
    row = []
  }

  while (queue.length > 0) {
    const next = queue[0]
    const side = Math.min(area.width, area.height)
    const current = row.map((node) => node.value)
    const withNext = [...current, next.value]

    if (row.length === 0 || worst(withNext, side, scale) <= worst(current, side, scale)) {
      row.push(queue.shift() as TreeMapNode)
    } else {
      layRow()
      scale = (area.width * area.height) / (queue.reduce((sum, n) => sum + n.value, 0) || 1)
    }
  }
  layRow()

  return tiles
}

/**
 * Part-to-whole by area, laid out so every tile is close to square.
 *
 * A naive treemap slices strips off one edge and produces slivers — tiles so
 * long and thin that their area is impossible to judge and their labels do not
 * fit, which defeats the only thing a treemap is for. The squarified algorithm
 * fills rows along the shorter side and closes a row the moment adding another
 * value would make the row *less* square, which keeps aspect ratios near one.
 *
 * It answers a different question from `DonutChart`: a donut compares a handful
 * of slices, a treemap shows the whole distribution at once, including the long
 * tail. Twenty categories in a donut is unreadable; twenty here is a picture.
 *
 * Labels are drawn only where the tile can hold them, so nothing is clipped
 * mid-word — the hidden table carries every value regardless, and tiles become
 * real buttons as soon as `onSelect` is supplied.
 */
export function TreeMap({
  nodes,
  label,
  width = 620,
  height = 300,
  onSelect,
  format = (value) => String(value),
  showShare = true,
  className,
}: TreeMapProps) {
  const tableId = useId()
  const [active, setActive] = useState<string | null>(null)

  const total = nodes.reduce((sum, node) => sum + node.value, 0)
  const tiles = useMemo(
    () => squarify(nodes, { x: 0, y: 0, width, height }, total),
    [height, nodes, total, width],
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-glyph)]"
        style={{ aspectRatio: `${width} / ${height}` }}
        role="group"
        aria-label={label}
        aria-describedby={tableId}
      >
        {tiles.map((tile, index) => {
          // Tiles arrive largest first, so the index is the rank.
          const color = tile.color ?? rampFill(index, tiles.length)
          const roomy = tile.width > 74 && tile.height > 42
          const Component = onSelect ? 'button' : 'div'

          return (
            <Component
              key={tile.id}
              {...(onSelect
                ? { type: 'button' as const, onClick: () => onSelect(tile) }
                : {})}
              onPointerEnter={() => setActive(tile.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(tile.id)}
              onBlur={() => setActive(null)}
              aria-label={`${tile.label}, ${format(tile.value)}`}
              className={cn(
                'absolute overflow-hidden rounded-[3px] p-2 text-left transition-opacity duration-[var(--duration-fast)]',
                active && active !== tile.id ? 'opacity-55' : 'opacity-100',
              )}
              style={{
                left: `${(tile.x / width) * 100}%`,
                top: `${(tile.y / height) * 100}%`,
                width: `${(tile.width / width) * 100}%`,
                height: `${(tile.height / height) * 100}%`,
                background: color,
                // A 2px inset ring rather than a border, so tile sizes stay
                // exactly proportional to their values.
                boxShadow: 'inset 0 0 0 2px var(--color-surface)',
              }}
            >
              {roomy && (
                <span className="flex flex-col gap-0.5">
                  <Text as="span" size="caption" weight="bold" truncate className="text-ink">
                    {tile.label}
                  </Text>
                  <Text as="span" size="micro" tabular className="text-ink/70">
                    {format(tile.value)}
                    {showShare ? ` · ${Math.round(tile.share * 100)}%` : ''}
                  </Text>
                </span>
              )}
            </Component>
          )
        })}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <tbody>
            {tiles.map((tile) => (
              <tr key={tile.id}>
                <th scope="row">{tile.label}</th>
                <td>{format(tile.value)}</td>
                <td>{Math.round(tile.share * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}
