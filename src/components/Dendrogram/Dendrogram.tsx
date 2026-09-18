'use client'

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { TICK_CLASS, niceScale } from '../internal/plot'

export type DendrogramLinkage = 'single' | 'complete' | 'average'
export type DendrogramDistance = 'euclidean' | 'correlation'

/** One agglomeration step. Ids below the leaf count are leaves; `n + i` is the cluster made at step `i`. */
export interface DendrogramMerge {
  left: number
  right: number
  height: number
  size: number
}

export interface DendrogramProps {
  /** One label per row of `values`. */
  labels: string[]
  /** The matrix to cluster: one row per item, one column per measurement. */
  values: number[][]
  /** Column names. When given, the matrix is drawn as a heatmap in leaf order. */
  columns?: string[]
  /** Accessible name for the chart. */
  label: string
  /** How the distance between two clusters is measured. */
  linkage?: DendrogramLinkage
  /** How the distance between two rows is measured. Correlation groups rows by shape, not size. */
  distance?: DendrogramDistance
  /** Controlled cut height. */
  cut?: number
  /** Cut height when uncontrolled. Defaults to 60% of the tallest merge. */
  defaultCut?: number
  onCutChange?: (cut: number) => void
  /** Draw the reordered matrix beside the tree. */
  showHeatmap?: boolean
  /** Height of each leaf row in pixels. */
  rowHeight?: number
  /** Merged last, so it wins. */
  className?: string
}

const CLUSTER_COLORS = [
  'var(--color-accent-strong)',
  'var(--color-ink)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-ink-soft)',
]

function rowDistance(a: number[], b: number[], kind: DendrogramDistance) {
  if (kind === 'euclidean') return Math.sqrt(a.reduce((sum, value, i) => sum + (value - (b[i] ?? 0)) ** 2, 0))
  const mean = (row: number[]) => row.reduce((sum, value) => sum + value, 0) / (row.length || 1)
  const [ma, mb] = [mean(a), mean(b)]
  let num = 0
  let da = 0
  let db = 0
  a.forEach((value, i) => {
    num += (value - ma) * (b[i] - mb)
    da += (value - ma) ** 2
    db += (b[i] - mb) ** 2
  })
  return da && db ? 1 - num / Math.sqrt(da * db) : 1
}

/**
 * Agglomerative clustering with Lance–Williams updates: repeatedly join the two
 * closest clusters, then recompute each remaining cluster's distance to the
 * new one from the two it replaced — min, max or the size-weighted mean.
 */
export function clusterHierarchy(
  values: number[][],
  linkage: DendrogramLinkage = 'average',
  distance: DendrogramDistance = 'euclidean',
): DendrogramMerge[] {
  const n = values.length
  const d = values.map((row) => values.map((other) => rowDistance(row, other, distance)))
  const alive = values.map((_, i) => i)
  const ids = values.map((_, i) => i)
  const sizes = values.map(() => 1)
  const merges: DendrogramMerge[] = []
  while (alive.length > 1) {
    let best = [0, 1]
    let low = Infinity
    for (let a = 0; a < alive.length; a += 1)
      for (let b = a + 1; b < alive.length; b += 1)
        if (d[alive[a]][alive[b]] < low) {
          low = d[alive[a]][alive[b]]
          best = [a, b]
        }
    const [i, j] = [alive[best[0]], alive[best[1]]]
    for (const k of alive) {
      if (k === i || k === j) continue
      const next =
        linkage === 'single'
          ? Math.min(d[i][k], d[j][k])
          : linkage === 'complete'
            ? Math.max(d[i][k], d[j][k])
            : (sizes[i] * d[i][k] + sizes[j] * d[j][k]) / (sizes[i] + sizes[j])
      d[i][k] = d[k][i] = next
    }
    merges.push({ left: ids[i], right: ids[j], height: Math.max(0, low), size: sizes[i] + sizes[j] })
    sizes[i] += sizes[j]
    ids[i] = n + merges.length - 1
    alive.splice(best[1], 1)
  }
  return merges
}

/** Cluster number per leaf for a cut at `height`, numbered in leaf order from 0. */
export function cutDendrogram(merges: DendrogramMerge[], leafCount: number, height: number, order?: number[]) {
  const parent = new Map<number, number>()
  merges.forEach((merge, i) => {
    parent.set(merge.left, leafCount + i)
    parent.set(merge.right, leafCount + i)
  })
  const heightOf = (id: number) => (id < leafCount ? 0 : merges[id - leafCount].height)
  const top = (leaf: number) => {
    let id = leaf
    while (parent.has(id) && heightOf(parent.get(id)!) <= height) id = parent.get(id)!
    return id
  }
  const numbering = new Map<number, number>()
  const result: number[] = new Array(leafCount)
  for (const leaf of order ?? [...Array(leafCount).keys()]) {
    const root = top(leaf)
    if (!numbering.has(root)) numbering.set(root, numbering.size)
    result[leaf] = numbering.get(root)!
  }
  return result
}

/**
 * Hierarchical clustering drawn as a tree, with a cut you drag to decide how
 * many groups there are.
 *
 * Clustering tools usually ask for the number of clusters up front, which is
 * the one thing nobody knows before looking. The tree shows every grouping at
 * once, and the cut line makes choosing one a reading decision: the long
 * branches are where the natural gaps are. The matrix beside it is reordered by
 * the same leaf order, so the blocks the tree finds are visible in the data.
 * The cut is a slider: arrow keys move it, and it announces the cluster count.
 */
export function Dendrogram({
  labels,
  values,
  columns,
  label,
  linkage = 'average',
  distance = 'euclidean',
  cut: cutProp,
  defaultCut,
  onCutChange,
  showHeatmap = true,
  rowHeight = 18,
  className,
}: DendrogramProps) {
  const listId = useId()
  const n = values.length
  const merges = useMemo(() => clusterHierarchy(values, linkage, distance), [values, linkage, distance])
  const maxH = Math.max(1e-9, ...merges.map((merge) => merge.height))
  const [cutState, setCutState] = useState(defaultCut ?? maxH * 0.6)
  const cut = Math.min(maxH, Math.max(0, cutProp ?? cutState))
  const setCut = (next: number) => {
    const value = Math.min(maxH, Math.max(0, next))
    if (cutProp === undefined) setCutState(value)
    onCutChange?.(value)
  }

  const order = useMemo(() => {
    const leaves: number[] = []
    const walk = (id: number) => {
      if (id < n) leaves.push(id)
      else {
        walk(merges[id - n].left)
        walk(merges[id - n].right)
      }
    }
    if (n) walk(n > 1 ? n + merges.length - 1 : 0)
    return leaves
  }, [merges, n])
  const clusters = useMemo(() => cutDendrogram(merges, n, cut, order), [merges, n, cut, order])
  const clusterCount = new Set(clusters).size
  const members = new Map<number, number>()
  for (const id of clusters) members.set(id, (members.get(id) ?? 0) + 1)
  const colourOf = (cluster: number) =>
    (members.get(cluster) ?? 0) > 1 ? CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] : 'var(--color-ink-faint)'

  const TREE = 220
  const LABEL = 104
  const CELL = 22
  const cols = showHeatmap && columns?.length ? columns : []
  const TOP = cols.length ? 64 : 26
  const width = TREE + LABEL + cols.length * CELL + 8
  const height = TOP + n * rowHeight + 24
  const scale = niceScale(0, maxH, 4)
  const xOf = (h: number) => TREE - (h / scale.max) * (TREE - 8)
  const rowY = (index: number) => TOP + index * rowHeight + rowHeight / 2

  // Leaf y, then each merge sits halfway between its children.
  const pos = new Map<number, { x: number; y: number }>()
  order.forEach((leaf, index) => pos.set(leaf, { x: TREE, y: rowY(index) }))
  const clusterOf = new Map<number, number>()
  order.forEach((leaf) => clusterOf.set(leaf, clusters[leaf]))
  merges.forEach((merge, i) => {
    const [a, b] = [pos.get(merge.left)!, pos.get(merge.right)!]
    pos.set(n + i, { x: xOf(merge.height), y: (a.y + b.y) / 2 })
    const same = clusterOf.get(merge.left) === clusterOf.get(merge.right) && merge.height <= cut
    clusterOf.set(n + i, same ? clusterOf.get(merge.left)! : -1)
  })

  const ranges = cols.map((_, c) => {
    const column = values.map((row) => row[c])
    return [Math.min(...column), Math.max(...column)]
  })

  const fromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / (rect.width || 1)) * width
    setCut(((TREE - Math.min(TREE, Math.max(8, x))) / (TREE - 8)) * scale.max)
  }

  const onSliderKey = (event: KeyboardEvent) => {
    const step = maxH / 40
    const moves: Record<string, number> = {
      ArrowRight: cut - step,
      ArrowDown: cut - step,
      ArrowLeft: cut + step,
      ArrowUp: cut + step,
      PageUp: cut + step * 5,
      PageDown: cut - step * 5,
      Home: 0,
      End: maxH,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setCut(moves[event.key])
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="relative" style={{ width, minWidth: width }}>
        <svg
          role="img"
          aria-label={`${label}. ${n} items in ${clusterCount} clusters at the current cut.`}
          aria-describedby={listId}
          width={width}
          height={height}
          className="block touch-none select-none"
          onPointerDown={(event) => {
            if (event.clientX - event.currentTarget.getBoundingClientRect().left > TREE) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            fromPointer(event)
          }}
          onPointerMove={(event) => event.currentTarget.hasPointerCapture?.(event.pointerId) && fromPointer(event)}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line x1={xOf(tick)} x2={xOf(tick)} y1={TOP - 4} y2={height - 20} className="stroke-line" />
              <text x={xOf(tick)} y={height - 6} textAnchor="middle" className={TICK_CLASS}>
                {Number(tick.toFixed(2))}
              </text>
            </g>
          ))}
          {merges.map((merge, i) => {
            const p = pos.get(n + i)!
            const cluster = clusterOf.get(n + i)!
            const stroke = cluster >= 0 ? colourOf(cluster) : 'var(--color-ink-faint)'
            return [merge.left, merge.right].map((child) => {
              const c = pos.get(child)!
              const childCluster = clusterOf.get(child)!
              return (
                <g key={`${i}-${child}`} fill="none" strokeWidth={cluster >= 0 ? 2 : 1.25}>
                  <path d={`M${p.x},${p.y} V${c.y}`} style={{ stroke }} />
                  <path
                    d={`M${p.x},${c.y} H${c.x}`}
                    style={{ stroke: childCluster >= 0 && merge.height > cut ? colourOf(childCluster) : stroke }}
                    strokeWidth={childCluster >= 0 ? 2 : 1.25}
                  />
                </g>
              )
            })
          })}
          <line
            x1={xOf(cut)}
            x2={xOf(cut)}
            y1={TOP - 12}
            y2={height - 20}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            className="stroke-danger"
          />
          {order.map((leaf, index) => (
            <text key={leaf} x={TREE + 6} y={rowY(index)} dy="0.35em" className="fill-ink text-[11px] font-medium">
              <tspan style={{ fill: colourOf(clusters[leaf]) }}>●</tspan> {labels[leaf]}
            </text>
          ))}
          {cols.map((column, c) => (
            <text
              key={column}
              transform={`translate(${TREE + LABEL + c * CELL + CELL / 2},${TOP - 6}) rotate(-50)`}
              className={TICK_CLASS}
            >
              {column}
            </text>
          ))}
          {order.map((leaf, index) =>
            cols.map((_, c) => {
              const [lo, hi] = ranges[c]
              const share = hi > lo ? (values[leaf][c] - lo) / (hi - lo) : 0.5
              return (
                <rect
                  key={`${leaf}-${c}`}
                  x={TREE + LABEL + c * CELL}
                  y={TOP + index * rowHeight}
                  width={CELL - 2}
                  height={rowHeight - 2}
                  rx="2"
                  style={{
                    fill: `color-mix(in oklab, var(--color-ink) ${Math.round(8 + share * 80)}%, var(--color-surface))`,
                  }}
                >
                  <title>{`${labels[leaf]}, ${cols[c]}: ${values[leaf][c]}`}</title>
                </rect>
              )
            }),
          )}
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Cut height"
          aria-valuemin={0}
          aria-valuemax={Number(maxH.toFixed(3))}
          aria-valuenow={Number(cut.toFixed(3))}
          aria-valuetext={`${cut.toFixed(2)}, ${clusterCount} clusters`}
          aria-orientation="horizontal"
          onKeyDown={onSliderKey}
          className="absolute size-4 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-danger bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ left: xOf(cut), top: TOP - 26 }}
        />
      </div>
      <p className="mt-1 text-[12px] font-semibold text-ink-soft" aria-live="polite">
        {clusterCount} {clusterCount === 1 ? 'cluster' : 'clusters'} · {linkage} linkage, {distance} distance
      </p>
      <VisuallyHidden>
        <ul id={listId}>
          {[...new Set(order.map((leaf) => clusters[leaf]))].map((cluster) => (
            <li key={cluster}>
              Cluster {cluster + 1}: {order.filter((leaf) => clusters[leaf] === cluster).map((leaf) => labels[leaf]).join(', ')}
            </li>
          ))}
        </ul>
      </VisuallyHidden>
    </div>
  )
}
