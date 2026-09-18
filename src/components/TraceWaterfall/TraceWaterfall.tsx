'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Legend } from '../Legend'
import { Text } from '../Text'
import { ChevronRightIcon, CrossIcon } from '../internal/icons'
import { DRAW_IN_CLASS, niceScale, useDrawIn } from '../internal/plot'

export interface TraceWaterfallSpan {
  id: string
  /** The span that called this one. Missing or unknown parents make a root. */
  parentId?: string | null
  /** The operation — `GET /orders`, `SELECT orders`. */
  name: string
  /** The service that recorded the span. Bars are coloured per service. */
  service: string
  /** Start time in milliseconds, on any clock shared by the whole trace. */
  start: number
  /** Duration in milliseconds. */
  duration: number
  status?: 'ok' | 'error'
  /** Tags recorded on the span, shown in the details panel. */
  attributes?: Record<string, string | number | boolean>
}

export interface TraceWaterfallProps {
  spans: TraceWaterfallSpan[]
  /** Accessible name for the trace tree. */
  label: string
  /** Controlled selected span id; its details panel is open. */
  selected?: string | null
  /** Selected span when uncontrolled. */
  defaultSelected?: string | null
  onSelectedChange?: (id: string | null) => void
  /** Ids of spans whose children start hidden. */
  defaultCollapsed?: string[]
  /** Mark the stretch of each span that lies on the critical path. */
  showCriticalPath?: boolean
  /** Format a duration in milliseconds. */
  formatDuration?: (ms: number) => string
  /** Merged last, so it wins. */
  className?: string
}

interface Node {
  span: TraceWaterfallSpan
  end: number
  depth: number
  children: Node[]
  parent: Node | null
  self: number
  critical: { from: number; to: number }[]
}

// Eight services tell apart before any repeats: the status hues, their tints, and neutrals.
// Danger is left out on purpose — it marks failed spans.
const SERVICE_COLORS = [
  'var(--color-accent-strong)',
  'var(--color-success)',
  'var(--color-warning)',
  'color-mix(in oklab, var(--color-ink) 45%, var(--color-surface))',
  'color-mix(in oklab, var(--color-warning) 45%, var(--color-surface))',
  'color-mix(in oklab, var(--color-success) 40%, var(--color-surface))',
  'color-mix(in oklab, var(--color-ink) 18%, var(--color-surface))',
  'color-mix(in oklab, var(--color-ink) 65%, var(--color-accent-strong))',
]

const defaultFormat = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : ms >= 10 ? `${Math.round(ms)} ms` : `${ms.toFixed(1)} ms`)

function build(spans: TraceWaterfallSpan[]) {
  const nodes = new Map<string, Node>()
  for (const span of spans) nodes.set(span.id, { span, end: span.start + span.duration, depth: 0, children: [], parent: null, self: span.duration, critical: [] })
  const roots: Node[] = []
  for (const node of nodes.values()) {
    const parent = node.span.parentId ? nodes.get(node.span.parentId) : undefined
    if (parent && parent !== node) {
      node.parent = parent
      parent.children.push(node)
    } else roots.push(node)
  }
  const order = (list: Node[]) => list.sort((a, b) => a.span.start - b.span.start || b.span.duration - a.span.duration)
  const visit = (node: Node, depth: number) => {
    node.depth = depth
    order(node.children)
    // Self time: the span minus the union of its children, clipped to the span.
    let covered = 0
    let reach = node.span.start
    for (const child of node.children) {
      const from = Math.max(reach, child.span.start)
      const to = Math.min(node.end, child.end)
      if (to > from) covered += to - from
      reach = Math.max(reach, Math.min(node.end, child.end))
    }
    node.self = Math.max(0, node.span.duration - covered)
    node.children.forEach((child) => visit(child, depth + 1))
  }
  order(roots).forEach((root) => visit(root, 0))
  return { nodes, roots }
}

/**
 * The critical path, walked backwards from the end of a span: the child that
 * finished last is what the span was waiting on, so its time is critical and it
 * is walked the same way; the gaps between such children are the span's own.
 */
function markCritical(node: Node, until: number) {
  let cursor = Math.min(node.end, until)
  for (;;) {
    let best: Node | null = null
    let bestEnd = -Infinity
    for (const child of node.children) {
      if (child.span.start >= cursor) continue
      const end = Math.min(child.end, cursor)
      if (end > bestEnd) {
        bestEnd = end
        best = child
      }
    }
    if (!best || bestEnd <= node.span.start) break
    if (bestEnd < cursor) node.critical.push({ from: bestEnd, to: cursor })
    markCritical(best, bestEnd)
    cursor = Math.max(node.span.start, best.span.start)
  }
  if (cursor > node.span.start) node.critical.push({ from: node.span.start, to: cursor })
}

/**
 * One distributed trace as a waterfall: every span a bar on a shared time
 * axis, nested under the span that called it, coloured by service.
 *
 * The questions a trace gets opened for are "where did the time go" and "what
 * would make this faster", and bar length answers neither on its own — a parent
 * is always as long as its slowest child. So each span also carries its self
 * time, the part no child accounts for, and the critical path is marked: the
 * chain of work the request actually waited on, where shaving time shortens the
 * trace. Rows are a tree — arrows move, Left and Right collapse and expand,
 * Enter opens the span's details.
 */
export function TraceWaterfall({
  spans,
  label,
  selected: selectedProp,
  defaultSelected = null,
  onSelectedChange,
  defaultCollapsed = [],
  showCriticalPath = true,
  formatDuration = defaultFormat,
  className,
}: TraceWaterfallProps) {
  const baseId = useId()
  const drawn = useDrawIn()
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [collapsed, setCollapsed] = useState(() => new Set(defaultCollapsed))
  const [selectedState, setSelectedState] = useState<string | null>(defaultSelected)
  const selected = selectedProp !== undefined ? selectedProp : selectedState
  const select = (id: string | null) => {
    if (selectedProp === undefined) setSelectedState(id)
    onSelectedChange?.(id)
  }

  const tree = useMemo(() => {
    const built = build(spans)
    const last = built.roots.reduce<Node | null>((best, root) => (!best || root.end > best.end ? root : best), null)
    if (last) markCritical(last, last.end)
    return built
  }, [spans])

  const t0 = Math.min(...spans.map((span) => span.start))
  const t1 = Math.max(...spans.map((span) => span.start + span.duration))
  const totalTime = Math.max(1e-9, t1 - t0)
  const ticks = niceScale(0, totalTime, 5).ticks.filter((tick) => tick <= totalTime * 1.0001)
  const services = [...new Set(spans.map((span) => span.service))]
  const colorOf = (service: string) => SERVICE_COLORS[services.indexOf(service) % SERVICE_COLORS.length]
  const at = (time: number) => ((time - t0) / totalTime) * 100

  const rows: Node[] = []
  const walk = (list: Node[]) => {
    for (const node of list) {
      rows.push(node)
      if (!collapsed.has(node.span.id)) walk(node.children)
    }
  }
  walk(tree.roots)

  const [focused, setFocused] = useState<string | null>(null)
  const current = rows.find((node) => node.span.id === focused) ?? rows.find((node) => node.span.id === selected) ?? rows[0]
  const focusRow = (node: Node | undefined) => {
    if (!node) return
    setFocused(node.span.id)
    rowRefs.current.get(node.span.id)?.focus()
  }
  const toggle = (node: Node, open?: boolean) => {
    if (!node.children.length) return
    setCollapsed((previous) => {
      const next = new Set(previous)
      const willOpen = open ?? next.has(node.span.id)
      if (willOpen) next.delete(node.span.id)
      else next.add(node.span.id)
      return next
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, node: Node) => {
    const index = rows.indexOf(node)
    const isOpen = node.children.length > 0 && !collapsed.has(node.span.id)
    switch (event.key) {
      case 'ArrowDown':
        focusRow(rows[index + 1])
        break
      case 'ArrowUp':
        focusRow(rows[index - 1])
        break
      case 'Home':
        focusRow(rows[0])
        break
      case 'End':
        focusRow(rows[rows.length - 1])
        break
      case 'ArrowRight':
        if (node.children.length && !isOpen) toggle(node, true)
        else if (isOpen) focusRow(node.children[0])
        break
      case 'ArrowLeft':
        if (isOpen) toggle(node, false)
        else focusRow(node.parent ?? undefined)
        break
      case 'Enter':
      case ' ':
        select(selected === node.span.id ? null : node.span.id)
        break
      case 'Escape':
        if (selected === null) return
        select(null)
        break
      default:
        return
    }
    event.preventDefault()
  }

  const detail = selected ? tree.nodes.get(selected) : undefined
  const criticalTotal = (node: Node) => node.critical.reduce((sum, part) => sum + part.to - part.from, 0)
  const criticalCount = [...tree.nodes.values()].filter((node) => node.critical.length > 0).length
  const posIn = (node: Node) => {
    const siblings = node.parent ? node.parent.children : tree.roots
    return { size: siblings.length, pos: siblings.indexOf(node) + 1 }
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text size="caption" weight="semibold" tone="soft" tabular>
          {`${spans.length} spans · ${services.length} services · ${formatDuration(totalTime)}`}
          {showCriticalPath && ` · ${criticalCount} spans on the critical path`}
        </Text>
        <Legend label="Services" series={services.map((service) => ({ label: service, color: colorOf(service) }))} />
      </div>

      <div className="overflow-hidden rounded-[var(--radius-glyph)] border border-line">
        <div aria-hidden="true" className="flex h-7 border-b border-line bg-surface-sunken">
          <div className="w-[36%] shrink-0 border-r border-line px-3 text-[10px] font-bold uppercase leading-7 tracking-wider text-ink-faint">
            Span
          </div>
          <div className="relative mx-3 flex-1">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 text-[9px] font-medium leading-7 text-ink-faint tabular-nums first:translate-x-0 last:-translate-x-full"
                style={{ left: `${(tick / totalTime) * 100}%` }}
              >
                {formatDuration(tick)}
              </span>
            ))}
          </div>
        </div>
        <div role="tree" aria-label={label} className="max-h-[440px] overflow-y-auto">
          {rows.map((node, index) => {
            const { span } = node
            const left = at(span.start)
            const width = Math.max(0.35, (span.duration / totalTime) * 100)
            // After the bar when there is room, before it when not, inside its end when it spans the row.
            const place = left + width < 78 ? 'after' : left > 14 ? 'before' : 'inside'
            const isOpen = !collapsed.has(span.id)
            const { size, pos } = posIn(node)
            const onPath = showCriticalPath && node.critical.length > 0
            return (
              <div
                key={span.id}
                ref={(element) => {
                  if (element) rowRefs.current.set(span.id, element)
                  else rowRefs.current.delete(span.id)
                }}
                id={`${baseId}-${span.id}`}
                role="treeitem"
                aria-level={node.depth + 1}
                aria-setsize={size}
                aria-posinset={pos}
                aria-expanded={node.children.length ? isOpen : undefined}
                aria-selected={selected === span.id}
                aria-label={`${span.name}, ${span.service}, ${formatDuration(span.duration)}, self ${formatDuration(node.self)}${onPath ? ', on the critical path' : ''}${span.status === 'error' ? ', error' : ''}`}
                tabIndex={span.id === current?.span.id ? 0 : -1}
                onKeyDown={(event) => onKeyDown(event, node)}
                onFocus={() => setFocused(span.id)}
                onClick={() => select(selected === span.id ? null : span.id)}
                className={cn(
                  'flex h-7 cursor-pointer items-center outline-offset-[-2px] hover:bg-surface-sunken',
                  selected === span.id && 'bg-surface-muted hover:bg-surface-muted',
                )}
              >
                <div className="flex h-full w-[36%] shrink-0 items-center gap-1 border-r border-line pr-2" style={{ paddingLeft: 6 + node.depth * 14 }}>
                  <span
                    aria-hidden="true"
                    className={cn('grid size-4 shrink-0 place-items-center text-ink-faint', !node.children.length && 'invisible')}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggle(node)
                    }}
                  >
                    <ChevronRightIcon size={11} className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} />
                  </span>
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colorOf(span.service) }} />
                  <span className={cn('truncate text-[12px] font-medium', span.status === 'error' ? 'text-danger' : 'text-ink')}>{span.name}</span>
                  <span className="ml-auto hidden shrink-0 text-[10px] font-medium text-ink-faint sm:inline">{span.service}</span>
                </div>
                <div aria-hidden="true" className="relative mx-3 h-full flex-1">
                  {ticks.map((tick) => (
                    <span key={tick} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(tick / totalTime) * 100}%` }} />
                  ))}
                  <div
                    className={cn('absolute top-1.5 h-4 rounded-[var(--radius-3)] transition-transform', DRAW_IN_CLASS)}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: colorOf(span.service),
                      outline: span.status === 'error' ? '1.5px solid var(--color-danger)' : undefined,
                      transformOrigin: 'left center',
                      transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                      transitionDelay: drawn ? `${Math.min(index * 20, 300)}ms` : '0ms',
                    }}
                  />
                  {onPath &&
                    node.critical.map((part) => (
                      <span
                        key={part.from}
                        className="absolute bottom-1 h-[3px] rounded-full bg-ink"
                        style={{ left: `${at(part.from)}%`, width: `${Math.max(0.2, ((part.to - part.from) / totalTime) * 100)}%` }}
                      />
                    ))}
                  <span
                    className={cn(
                      'absolute whitespace-nowrap text-[10px] font-semibold tabular-nums',
                      place === 'inside'
                        ? 'top-[7px] mr-1 rounded-[var(--radius-4)] bg-surface/85 px-1 leading-[14px] text-ink'
                        : 'top-0 px-1.5 leading-7 text-ink-soft',
                    )}
                    style={
                      place === 'after'
                        ? { left: `${left + width}%` }
                        : place === 'before'
                          ? { right: `${100 - left}%` }
                          : { right: `${100 - left - width}%` }
                    }
                  >
                    {formatDuration(span.duration)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {detail && (
        <section aria-label={`Details for ${detail.span.name}`} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text size="label" weight="bold" className="truncate">
                {detail.span.name}
              </Text>
              <Text size="caption" weight="medium" tone="soft">
                {`${detail.span.service}${detail.span.status === 'error' ? ' · error' : ''}`}
              </Text>
            </div>
            <IconButton
              icon={CrossIcon}
              label="Close span details"
              size="xs"
              tone="bare"
              onClick={() => {
                select(null)
                rowRefs.current.get(detail.span.id)?.focus()
              }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
              ['Duration', formatDuration(detail.span.duration)],
              ['Self time', formatDuration(detail.self)],
              ['Starts at', `+${formatDuration(detail.span.start - t0)}`],
              ['Share of trace', `${((detail.span.duration / totalTime) * 100).toFixed(1)}%`],
              ...(showCriticalPath ? [['Critical time', criticalTotal(detail) ? formatDuration(criticalTotal(detail)) : 'Not critical']] : []),
              ['Children', String(detail.children.length)],
              ...Object.entries(detail.span.attributes ?? {}).map(([key, value]) => [key, String(value)]),
            ].map(([term, value]) => (
              <div key={term} className="flex min-w-0 flex-col gap-0.5">
                <Text as="dt" size="micro" weight="semibold" tone="faint" className="truncate">
                  {term}
                </Text>
                <Text as="dd" size="caption" weight="bold" className="break-words font-mono">
                  {value}
                </Text>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
