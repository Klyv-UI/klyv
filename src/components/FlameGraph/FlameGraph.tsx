'use client'

import { useId, useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ChartTooltip } from '../ChartTooltip'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { SearchIcon } from '../internal/icons'
import { DRAW_IN_CLASS, PLOT_WIDTH, PlotAnnouncer, PlotTip, pointerToView, useDrawIn } from '../internal/plot'

export type FlameGraphOrientation = 'flame' | 'icicle'

/** One frame in the folded call tree. */
export interface FlameGraphFrame {
  /** The stack from the root to this frame, joined with `;`. */
  id: string
  name: string
  depth: number
  /** Samples in this frame and everything it called. */
  total: number
  /** Samples where this frame was on top of the stack. */
  self: number
  /** `total` in the baseline profile, when comparing. */
  baseTotal: number
}

export interface FlameGraphProps {
  /** Collapsed stacks, one per line: `main;handle;parse 42`. The format Brendan Gregg’s stackcollapse scripts emit. */
  profile: string
  /** A second profile in the same format. When given, frames are coloured by how their share changed from it. */
  baseline?: string
  /** Accessible name for the graph. */
  label: string
  /** Controlled orientation: flame grows up from the root, icicle hangs down from it. */
  orientation?: FlameGraphOrientation
  /** Orientation when uncontrolled. */
  defaultOrientation?: FlameGraphOrientation
  onOrientationChange?: (orientation: FlameGraphOrientation) => void
  /** Controlled search text. Matching frames are highlighted. */
  search?: string
  /** Search text when uncontrolled. */
  defaultSearch?: string
  onSearchChange?: (search: string) => void
  /** Show the search field, orientation switch and zoom breadcrumb. */
  showControls?: boolean
  /** Height of a frame row in pixels. */
  rowHeight?: number
  /** What a sample is called in the tooltip — samples, ms, allocations. */
  unit?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Node extends FlameGraphFrame {
  parent: Node | null
  children: Node[]
  x0: number
  x1: number
}

function fold(text: string) {
  const lines: [string[], number][] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const match = /^(.*\S)\s+(\d+(?:\.\d+)?)$/.exec(line)
    if (!line || line.startsWith('#') || !match) continue
    lines.push([match[1].split(';').filter(Boolean), Number(match[2])])
  }
  return lines
}

/** Folds both profiles into one tree, so a frame that only exists in one still has a place to be compared. */
function build(profile: string, baseline?: string) {
  const make = (name: string, id: string, depth: number, parent: Node | null): Node => ({
    id, name, depth, parent, total: 0, self: 0, baseTotal: 0, children: [], x0: 0, x1: 0,
  })
  const root = make('all', 'all', 0, null)
  const index = new Map<Node, Map<string, Node>>()
  const add = (stack: string[], count: number, base: boolean) => {
    let node = root
    if (base) root.baseTotal += count
    else root.total += count
    for (const name of stack) {
      let kids = index.get(node)
      if (!kids) index.set(node, (kids = new Map()))
      let child = kids.get(name)
      if (!child) {
        child = make(name, `${node.id};${name}`, node.depth + 1, node)
        kids.set(name, child)
        node.children.push(child)
      }
      if (base) child.baseTotal += count
      else child.total += count
      node = child
    }
    if (!base) node.self += count
  }
  for (const [stack, count] of fold(profile)) add(stack, count, false)
  if (baseline) for (const [stack, count] of fold(baseline)) add(stack, count, true)
  const all: Node[] = []
  const layout = (node: Node, x0: number) => {
    node.x0 = x0
    node.x1 = x0 + (root.total ? node.total / root.total : 0)
    all.push(node)
    let cursor = x0
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    for (const child of node.children) {
      if (child.total <= 0) continue
      layout(child, cursor)
      cursor = child.x1
    }
  }
  layout(root, 0)
  return { root, all, byId: new Map(all.map((node) => [node.id, node])) }
}

const hash = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) % 1000
}

/**
 * A profile as a flame graph: every stack sampled, folded into a tree, each
 * frame as wide as the share of samples it was on the stack for.
 *
 * Width is the whole encoding. Frames are sorted by name, not time, so equal
 * stacks merge and the widest towers are where the time went; self time in the
 * tooltip separates a frame that is slow from one that calls something slow.
 * Click or Enter zooms a frame to full width, search lights up every frame that
 * matches and says what share of samples they cover — counting nested matches
 * once — and a baseline turns it into a differential graph, red where a frame's
 * share grew and green where it shrank.
 */
export function FlameGraph({
  profile,
  baseline,
  label,
  orientation: orientationProp,
  defaultOrientation = 'flame',
  onOrientationChange,
  search: searchProp,
  defaultSearch = '',
  onSearchChange,
  showControls = true,
  rowHeight = 18,
  unit = 'samples',
  className,
}: FlameGraphProps) {
  const summaryId = useId()
  const searchId = useId()
  const drawn = useDrawIn()
  const tree = useMemo(() => build(profile, baseline), [profile, baseline])
  const [orientationState, setOrientationState] = useState(defaultOrientation)
  const orientation = orientationProp ?? orientationState
  const setOrientation = (next: FlameGraphOrientation) => {
    if (orientationProp === undefined) setOrientationState(next)
    onOrientationChange?.(next)
  }
  const [searchState, setSearchState] = useState(defaultSearch)
  const search = searchProp ?? searchState
  const setSearch = (next: string) => {
    if (searchProp === undefined) setSearchState(next)
    onSearchChange?.(next)
  }
  const [zoomId, setZoomId] = useState('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const zoom = tree.byId.get(zoomId) ?? tree.root
  const active = activeId ? tree.byId.get(activeId) ?? null : null
  const diff = Boolean(baseline) && tree.root.baseTotal > 0

  const span = zoom.x1 - zoom.x0 || 1
  const scale = PLOT_WIDTH / span
  const visible = tree.all.filter((node) => node.total > 0 && node.x1 > zoom.x0 && node.x0 < zoom.x1 && (node.x1 - node.x0) * scale >= 0.5)
  const depth = visible.reduce((max, node) => Math.max(max, node.depth), 0)
  const height = (depth + 1) * rowHeight
  const geometry = (node: Node) => {
    const x = Math.max(0, (node.x0 - zoom.x0) * scale)
    const w = Math.min(PLOT_WIDTH, (node.x1 - zoom.x0) * scale) - x
    const y = orientation === 'flame' ? height - (node.depth + 1) * rowHeight : node.depth * rowHeight
    return { x, y, w }
  }

  const query = search.trim().toLowerCase()
  const matches = useMemo(() => {
    const found = new Set<string>()
    if (!query) return { found, share: 0 }
    let covered = 0
    for (const node of tree.all) {
      if (node.depth === 0 || !node.name.toLowerCase().includes(query)) continue
      found.add(node.id)
      let parent = node.parent
      let nested = false
      while (parent) {
        if (found.has(parent.id)) nested = true
        parent = parent.parent
      }
      if (!nested) covered += node.total
    }
    return { found, share: tree.root.total ? covered / tree.root.total : 0 }
  }, [tree, query])

  const share = (value: number, of: number) => (of ? value / of : 0)
  const deltaOf = (node: Node) => share(node.total, tree.root.total) - share(node.baseTotal, tree.root.baseTotal)
  const maxDelta = diff ? Math.max(1e-9, ...tree.all.map((node) => Math.abs(deltaOf(node)))) : 1
  const pct = (value: number) => `${(value * 100).toFixed(value < 0.001 && value > 0 ? 3 : 1)}%`

  const paint = (node: Node) => {
    if (query && matches.found.size) {
      return matches.found.has(node.id)
        ? { fill: 'var(--color-accent-strong)', text: 'fill-accent-ink' }
        : { fill: 'var(--color-surface-muted)', text: 'fill-ink-faint' }
    }
    if (diff) {
      const t = Math.abs(deltaOf(node)) / maxDelta
      if (t < 0.02) return { fill: 'var(--color-surface-muted)', text: 'fill-ink-soft' }
      const tone = deltaOf(node) > 0 ? 'var(--color-danger)' : 'var(--color-success)'
      const amount = Math.round(18 + t * 70)
      return { fill: `color-mix(in oklab, ${tone} ${amount}%, var(--color-surface))`, text: amount > 55 ? 'fill-ink-inverse' : 'fill-ink' }
    }
    return { fill: `color-mix(in oklab, var(--color-warning) ${45 + (hash(node.name) % 50)}%, var(--color-danger))`, text: 'fill-accent-ink' }
  }

  const peers = (node: Node) => visible.filter((other) => other.depth === node.depth).sort((a, b) => a.x0 - b.x0)
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const current = active ?? zoom
    const up = orientation === 'flame' ? 'ArrowUp' : 'ArrowDown'
    const down = orientation === 'flame' ? 'ArrowDown' : 'ArrowUp'
    let next: Node | null | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const row = peers(current)
      next = row[row.indexOf(current) + (event.key === 'ArrowRight' ? 1 : -1)]
    } else if (event.key === up) {
      next = current.children.filter((child) => visible.includes(child)).sort((a, b) => b.total - a.total)[0]
    } else if (event.key === down) {
      next = current.parent
    } else if (event.key === 'Home') {
      next = zoom
    } else if (event.key === 'Enter') {
      setZoomId(current.id)
    } else if (event.key === 'Escape') {
      if (zoom !== tree.root) setZoomId(zoom.parent?.id ?? 'all')
      else if (active) setActiveId(null)
      else return
    } else return
    event.preventDefault()
    if (next) setActiveId(next.id)
  }
  const onFocus = (event: FocusEvent<SVGSVGElement>) => {
    let keyboard = false
    try {
      keyboard = event.currentTarget.matches(':focus-visible')
    } catch {
      keyboard = false
    }
    if (keyboard && !active) setActiveId(zoom.id)
  }
  const nodeAt = (x: number, y: number) =>
    visible.find((node) => {
      const g = geometry(node)
      return x >= g.x && x <= g.x + g.w && y >= g.y && y < g.y + rowHeight
    }) ?? null

  const crumbs: Node[] = []
  for (let node: Node | null = zoom; node; node = node.parent) crumbs.unshift(node)
  const describe = (node: Node) =>
    `${node.name}: ${node.total.toLocaleString()} ${unit} (${pct(share(node.total, tree.root.total))}), self ${node.self.toLocaleString()}` +
    (diff ? `, ${deltaOf(node) >= 0 ? '+' : ''}${(deltaOf(node) * 100).toFixed(2)} points against baseline` : '')
  const topSelf = [...tree.all].filter((node) => node.self > 0).sort((a, b) => b.self - a.self).slice(0, 8)

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={searchId} className="sr-only">
            Search frames
          </label>
          <Input
            id={searchId}
            type="search"
            inputSize="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search frames"
            leading={<SearchIcon size={14} />}
            containerClassName="min-w-[180px] flex-1"
          />
          <SegmentedControl
            label="Orientation"
            size="sm"
            value={orientation}
            onValueChange={setOrientation}
            options={[
              { value: 'flame', label: 'Flame' },
              { value: 'icicle', label: 'Icicle' },
            ]}
          />
        </div>
      )}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Zoom path">
            <ol className="flex flex-wrap items-center gap-1">
              {crumbs.map((node, index) => (
                <li key={node.id} className="flex items-center gap-1">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-[11px] text-ink-faint">
                      /
                    </span>
                  )}
                  {node === zoom ? (
                    <span aria-current="location" className="max-w-[180px] truncate font-mono text-[11px] font-bold text-ink">
                      {node.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setZoomId(node.id)}
                      className="max-w-[140px] truncate rounded-[var(--radius-4)] px-1 font-mono text-[11px] font-medium text-ink-soft hover:bg-surface-muted hover:text-ink"
                    >
                      {node.name}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex items-center gap-2">
            {query && (
              <Text as="span" size="caption" weight="semibold" tone="soft" tabular>
                {matches.found.size ? `${matches.found.size} frames match · ${pct(matches.share)} of ${unit}` : 'No frames match'}
              </Text>
            )}
            {zoom !== tree.root && (
              <Button size="sm" variant="ghost" onClick={() => setZoomId('all')}>
                Reset zoom
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${tree.root.total.toLocaleString()} ${unit}. Arrow keys move between frames, Enter zooms, Escape zooms out.`}
          aria-describedby={summaryId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          tabIndex={0}
          className="w-full cursor-pointer rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const { x, y } = pointerToView(event, PLOT_WIDTH, height)
            setActiveId(nodeAt(x, y)?.id ?? null)
          }}
          onPointerLeave={() => setActiveId(null)}
          onClick={() => active && setZoomId(active.id)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={() => setActiveId(null)}
        >
          {visible.map((node) => {
            const { x, y, w } = geometry(node)
            const { fill, text } = paint(node)
            const chars = Math.floor((w - 8) / 5.6)
            return (
              <g
                key={node.id}
                className={cn('transition-opacity', DRAW_IN_CLASS)}
                opacity={drawn ? 1 : 0}
                style={{ transitionDelay: drawn ? `${Math.min(node.depth * 40, 400)}ms` : '0ms' }}
              >
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={Math.max(0.5, w - 1)}
                  height={rowHeight - 1}
                  rx={2}
                  fill={fill}
                  stroke={active === node ? 'var(--color-ink)' : 'none'}
                  strokeWidth="1.5"
                />
                {chars >= 3 && (
                  <text x={x + 4} y={y + rowHeight / 2 + 0.5} dominantBaseline="middle" className={cn('pointer-events-none font-mono text-[10px] font-medium', text)}>
                    {node.name.length > chars ? `${node.name.slice(0, chars - 1)}…` : node.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {active && (
          <PlotTip
            x={geometry(active).x + geometry(active).w / 2}
            y={geometry(active).y + (orientation === 'flame' ? 0 : rowHeight)}
            width={PLOT_WIDTH}
            height={height}
          >
            <ChartTooltip
              title={active.name}
              rows={[
                { label: `Total ${unit}`, value: `${active.total.toLocaleString()} · ${pct(share(active.total, tree.root.total))}` },
                { label: `Self ${unit}`, value: `${active.self.toLocaleString()} · ${pct(share(active.self, tree.root.total))}` },
                ...(active !== zoom && zoom !== tree.root ? [{ label: `Of ${zoom.name}`, value: pct(share(active.total, zoom.total)) }] : []),
                ...(diff
                  ? [
                      { label: 'Baseline share', value: pct(share(active.baseTotal, tree.root.baseTotal)) },
                      {
                        label: 'Change',
                        value: `${deltaOf(active) >= 0 ? '+' : ''}${(deltaOf(active) * 100).toFixed(2)} pts`,
                        color: deltaOf(active) > 0 ? 'var(--color-danger)' : 'var(--color-success)',
                      },
                    ]
                  : []),
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <div id={summaryId}>
          <p>{`${tree.root.total.toLocaleString()} ${unit} across ${tree.all.length - 1} distinct frames, ${depth} levels deep${zoom !== tree.root ? `, zoomed into ${zoom.name}` : ''}.`}</p>
          <p>{`Most ${unit} on top of the stack: ${topSelf.map((node) => `${node.name} ${pct(share(node.self, tree.root.total))}`).join(', ')}.`}</p>
        </div>
      </VisuallyHidden>
      <PlotAnnouncer message={active ? describe(active) : query ? `${matches.found.size} frames match, ${pct(matches.share)} of ${unit}` : ''} />
    </div>
  )
}
