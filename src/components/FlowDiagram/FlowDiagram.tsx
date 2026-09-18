'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { VisuallyHidden } from '../VisuallyHidden'
import { MinusIcon, PlusIcon } from '../internal/icons'
import { PlotAnnouncer, svgId } from '../internal/plot'

export type FlowDiagramDirection = 'TB' | 'LR'
export type FlowDiagramRouting = 'orthogonal' | 'spline'

export interface FlowDiagramNode {
  id: string
  /** Text in the box. Defaults to the id. */
  label?: string
}

export interface FlowDiagramEdge {
  from: string
  to: string
  /** Short text drawn at the middle of the edge. */
  label?: string
}

export interface FlowDiagramProps {
  /** Nodes, in the order they should be preferred when the layout has a free choice. */
  nodes?: FlowDiagramNode[]
  edges?: FlowDiagramEdge[]
  /**
   * The graph as text, used instead of `nodes` and `edges`. One chain per line:
   * `a -> b -> c`, with `id[Label]` to name a node and `: text` after the last
   * node to label the final edge. `#` starts a comment.
   */
  source?: string
  /** Accessible name for the diagram. */
  label: string
  /** Top to bottom or left to right. */
  direction?: FlowDiagramDirection
  /** Right-angled elbows or smooth curves. */
  routing?: FlowDiagramRouting
  /** Called with a node id when Enter is pressed on it or it is clicked. */
  onNodeSelect?: (id: string) => void
  /** Height of the viewport in pixels. The diagram is fitted inside it. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/** Reads the `a -> b` text syntax into nodes and edges. */
export function parseFlowDiagram(source: string) {
  const nodes = new Map<string, FlowDiagramNode>()
  const edges: FlowDiagramEdge[] = []
  const TOKEN = /^([\w.-]+)(?:\s*\[(.+)\])?$/
  const touch = (token: string) => {
    const match = TOKEN.exec(token.trim())
    if (!match) return null
    const [, id, text] = match
    const known = nodes.get(id)
    if (!known) nodes.set(id, { id, label: text ?? id })
    else if (text) known.label = text
    return id
  }
  for (const raw of source.split(/\n|;/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const parts = line.split(/\s*->\s*/)
    let edgeLabel: string | undefined
    const last = /^(.*?[\w\]])\s*:\s*(.+)$/.exec(parts[parts.length - 1])
    if (last && parts.length > 1) {
      parts[parts.length - 1] = last[1]
      edgeLabel = last[2].trim()
    }
    const ids = parts.map(touch)
    for (let index = 1; index < ids.length; index += 1) {
      const from = ids[index - 1]
      const to = ids[index]
      if (from && to) edges.push({ from, to, label: index === ids.length - 1 ? edgeLabel : undefined })
    }
  }
  return { nodes: [...nodes.values()], edges }
}

interface Placed {
  id: string
  label: string
  dummy: boolean
  layer: number
  x: number
  y: number
  w: number
  h: number
}

const NODE_H = 36
const RANK_GAP = 56
const NODE_GAP = 28

/**
 * The Sugiyama method, in four passes: break cycles by reversing DFS back
 * edges, rank by longest path, split long edges with dummy nodes, reorder each
 * rank by the barycentre of its neighbours (keeping the ordering with fewest
 * crossings), then place nodes as close to their neighbours' mean as the
 * ordering and spacing allow.
 */
export function layoutFlowDiagram(input: FlowDiagramNode[], links: FlowDiagramEdge[], direction: FlowDiagramDirection) {
  const nodes = new Map<string, Placed>()
  const add = (id: string, label: string, dummy = false) => {
    const w = dummy ? 8 : Math.min(200, Math.max(64, label.length * 6.8 + 28))
    nodes.set(id, { id, label, dummy, layer: 0, x: 0, y: 0, w, h: dummy ? 8 : NODE_H })
  }
  for (const node of input) if (!nodes.has(node.id)) add(node.id, node.label ?? node.id)
  for (const edge of links) for (const id of [edge.from, edge.to]) if (!nodes.has(id)) add(id, id)
  const ids = [...nodes.keys()]

  // 1. Cycle removal: an edge into a node still on the DFS stack closes a cycle.
  const out = new Map(ids.map((id) => [id, [] as number[]]))
  links.forEach((edge, index) => edge.from !== edge.to && out.get(edge.from)!.push(index))
  const state = new Map<string, 1 | 2>()
  const reversed = new Set<number>()
  const visit = (id: string) => {
    state.set(id, 1)
    for (const index of out.get(id)!) {
      const next = links[index].to
      if (state.get(next) === 1) reversed.add(index)
      else if (!state.has(next)) visit(next)
    }
    state.set(id, 2)
  }
  for (const id of ids) if (!state.has(id)) visit(id)
  const dag = links
    .map((edge, index) => ({ index, from: reversed.has(index) ? edge.to : edge.from, to: reversed.has(index) ? edge.from : edge.to }))
    .filter((edge) => edge.from !== edge.to)

  // 2. Longest-path layering, in Kahn order.
  const indegree = new Map(ids.map((id) => [id, 0]))
  for (const edge of dag) indegree.set(edge.to, indegree.get(edge.to)! + 1)
  const queue = ids.filter((id) => indegree.get(id) === 0)
  while (queue.length) {
    const id = queue.shift()!
    for (const edge of dag.filter((entry) => entry.from === id)) {
      const target = nodes.get(edge.to)!
      target.layer = Math.max(target.layer, nodes.get(id)!.layer + 1)
      indegree.set(edge.to, indegree.get(edge.to)! - 1)
      if (indegree.get(edge.to) === 0) queue.push(edge.to)
    }
  }

  // 3. Dummy nodes, so every segment joins adjacent ranks.
  const chains = new Map<number, string[]>()
  for (const edge of dag) {
    const chain = [edge.from]
    for (let layer = nodes.get(edge.from)!.layer + 1; layer < nodes.get(edge.to)!.layer; layer += 1) {
      const id = `~${edge.index}:${layer}`
      add(id, '', true)
      nodes.get(id)!.layer = layer
      chain.push(id)
    }
    chain.push(edge.to)
    chains.set(edge.index, chain)
  }
  const up = new Map<string, string[]>([...nodes.keys()].map((id) => [id, []]))
  const down = new Map<string, string[]>([...nodes.keys()].map((id) => [id, []]))
  for (const chain of chains.values())
    for (let step = 1; step < chain.length; step += 1) {
      down.get(chain[step - 1])!.push(chain[step])
      up.get(chain[step])!.push(chain[step - 1])
    }

  // 4. Barycentre sweeps, keeping the best ordering seen.
  const depth = Math.max(0, ...[...nodes.values()].map((node) => node.layer)) + 1
  let layers: string[][] = Array.from({ length: depth }, () => [])
  for (const node of nodes.values()) layers[node.layer].push(node.id)
  const crossings = (order: string[][]) => {
    let total = 0
    for (let layer = 0; layer < order.length - 1; layer += 1) {
      const below = new Map(order[layer + 1].map((id, index) => [id, index]))
      const segments: [number, number][] = []
      order[layer].forEach((id, index) => down.get(id)!.forEach((next) => segments.push([index, below.get(next)!])))
      for (let a = 0; a < segments.length; a += 1)
        for (let b = a + 1; b < segments.length; b += 1)
          if ((segments[a][0] - segments[b][0]) * (segments[a][1] - segments[b][1]) < 0) total += 1
    }
    return total
  }
  let best = layers.map((layer) => [...layer])
  let bestCount = crossings(best)
  for (let sweep = 0; sweep < 12 && bestCount > 0; sweep += 1) {
    const downward = sweep % 2 === 0
    const range = downward ? [...Array(depth).keys()].slice(1) : [...Array(depth).keys()].slice(0, -1).reverse()
    for (const layer of range) {
      const ref = new Map(layers[downward ? layer - 1 : layer + 1].map((id, index) => [id, index]))
      const centre = (id: string, own: number) => {
        const links = (downward ? up : down).get(id)!
        return links.length ? links.reduce((sum, next) => sum + ref.get(next)!, 0) / links.length : own
      }
      layers[layer] = layers[layer]
        .map((id, index) => ({ id, key: centre(id, index) }))
        .sort((a, b) => a.key - b.key)
        .map((entry) => entry.id)
    }
    const count = crossings(layers)
    if (count < bestCount) {
      bestCount = count
      best = layers.map((layer) => [...layer])
    }
  }
  layers = best

  // 5. Coordinates: across each rank, a least-squares fit to the neighbours'
  // mean subject to order and spacing (adjacent blocks merge when they touch).
  const across = (node: Placed) => (direction === 'TB' ? node.w : node.h)
  const along = (node: Placed) => (direction === 'TB' ? node.h : node.w)
  const cross = new Map<string, number>()
  for (const layer of layers) {
    let cursor = 0
    for (const id of layer) {
      const size = across(nodes.get(id)!)
      cross.set(id, cursor + size / 2)
      cursor += size + NODE_GAP
    }
  }
  for (let pass = 0; pass < 8; pass += 1) {
    const order = pass % 2 === 0 ? layers : [...layers].reverse()
    for (const layer of order) {
      const desired = layer.map((id) => {
        const near = [...up.get(id)!, ...down.get(id)!]
        return near.length ? near.reduce((sum, next) => sum + cross.get(next)!, 0) / near.length : cross.get(id)!
      })
      const blocks: { start: number; offsets: number[]; members: number[] }[] = []
      const fit = (block: (typeof blocks)[number]) =>
        block.members.reduce((sum, member, k) => sum + desired[member] - block.offsets[k], 0) / block.members.length
      layer.forEach((_, index) => {
        let block = { start: desired[index], offsets: [0], members: [index] }
        blocks.push(block)
        while (blocks.length > 1) {
          const prev = blocks[blocks.length - 2]
          const tail = prev.members[prev.members.length - 1]
          const gap = (across(nodes.get(layer[tail])!) + across(nodes.get(layer[block.members[0]])!)) / 2 + NODE_GAP
          const reach = prev.start + prev.offsets[prev.offsets.length - 1] + gap
          if (reach <= block.start) break
          const shift = prev.offsets[prev.offsets.length - 1] + gap
          prev.offsets.push(...block.offsets.map((offset) => offset + shift))
          prev.members.push(...block.members)
          prev.start = fit(prev)
          blocks.pop()
          block = prev
        }
      })
      for (const block of blocks) block.members.forEach((member, k) => cross.set(layer[member], block.start + block.offsets[k]))
    }
  }
  const low = Math.min(...[...nodes.values()].map((node) => cross.get(node.id)! - across(node) / 2))
  let rank = 0
  for (const layer of layers) {
    const size = Math.max(...layer.map((id) => along(nodes.get(id)!)))
    for (const id of layer) {
      const node = nodes.get(id)!
      const c = cross.get(id)! - low
      const r = rank + size / 2
      node.x = direction === 'TB' ? c : r
      node.y = direction === 'TB' ? r : c
    }
    rank += size + (direction === 'TB' ? RANK_GAP : RANK_GAP + 24)
  }
  const placed = [...nodes.values()]
  const width = Math.max(0, ...placed.map((node) => node.x + node.w / 2))
  const height = Math.max(0, ...placed.map((node) => node.y + node.h / 2))
  const routes = links.map((edge, index) => {
    const chain = chains.get(index)
    if (!chain) return null
    const points = chain.map((id) => nodes.get(id)!)
    return { edge, points: reversed.has(index) ? [...points].reverse() : points, reversed: reversed.has(index) }
  })
  return { nodes: placed.filter((node) => !node.dummy), layers, routes, width, height, crossings: bestCount }
}

function pathFor(points: Placed[], direction: FlowDiagramDirection, routing: FlowDiagramRouting) {
  const tb = direction === 'TB'
  const port = (node: Placed, towards: Placed) => {
    const sign = (tb ? towards.y - node.y : towards.x - node.x) >= 0 ? 1 : -1
    return tb ? { x: node.x, y: node.y + (sign * node.h) / 2 } : { x: node.x + (sign * node.w) / 2, y: node.y }
  }
  const pts = points.map((node, index) =>
    node.dummy ? { x: node.x, y: node.y } : port(node, points[index === 0 ? 1 : index - 1]),
  )
  let d = `M${pts[0].x},${pts[0].y}`
  for (let index = 1; index < pts.length; index += 1) {
    const [p, q] = [pts[index - 1], pts[index]]
    if (routing === 'spline') {
      const m = tb ? (p.y + q.y) / 2 : (p.x + q.x) / 2
      d += tb ? ` C${p.x},${m} ${q.x},${m} ${q.x},${q.y}` : ` C${m},${p.y} ${m},${q.y} ${q.x},${q.y}`
    } else {
      const m = tb ? (p.y + q.y) / 2 : (p.x + q.x) / 2
      d += tb ? ` L${p.x},${m} L${q.x},${m} L${q.x},${q.y}` : ` L${m},${p.y} L${m},${q.y} L${q.x},${q.y}`
    }
  }
  const [a, b] = [pts[Math.floor((pts.length - 1) / 2)], pts[Math.ceil((pts.length - 1) / 2)]]
  return { d, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
}

/**
 * A directed graph laid out for reading: ranks follow the direction of flow,
 * edges cross as little as the barycentre sweeps can manage, and long edges
 * bend around nodes instead of through them.
 *
 * Layout is computed, never hand-placed, because a flow that has to be
 * rearranged by hand every time a step is added stops being updated. Cycles
 * are allowed — a retry loop is a real flow — and are drawn against the grain
 * rather than rejected. One tab stop: arrows follow edges and walk each rank,
 * Enter selects, + and − zoom, 0 fits. Ctrl or ⌘ with the wheel zooms; dragging
 * the background pans.
 */
export function FlowDiagram({
  nodes: nodesProp,
  edges: edgesProp,
  source,
  label,
  direction = 'TB',
  routing = 'orthogonal',
  onNodeSelect,
  height = 420,
  className,
}: FlowDiagramProps) {
  const listId = useId()
  const markerId = svgId(`${listId}head`)
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: height })
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [active, setActive] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const graph = useMemo(
    () => (source !== undefined ? parseFlowDiagram(source) : { nodes: nodesProp ?? [], edges: edgesProp ?? [] }),
    [source, nodesProp, edgesProp],
  )
  const layout = useMemo(() => layoutFlowDiagram(graph.nodes, graph.edges, direction), [graph, direction])
  const byId = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout])

  const fit = useCallback(() => {
    const pad = 24
    const k = Math.min(1.4, (size.w - pad * 2) / (layout.width || 1), (size.h - pad * 2) / (layout.height || 1))
    setView({ k, x: (size.w - layout.width * k) / 2, y: (size.h - layout.height * k) / 2 })
  }, [size, layout])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => node.clientWidth > 0 && setSize({ w: node.clientWidth, h: node.clientHeight || height })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [height])
  useEffect(fit, [fit])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      zoomAt(Math.exp(-event.deltaY * 0.002), event.clientX - rect.left, event.clientY - rect.top)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const zoomAt = (factor: number, px = size.w / 2, py = size.h / 2) =>
    setView((current) => {
      const k = Math.min(3, Math.max(0.2, current.k * factor))
      return { k, x: px - ((px - current.x) / current.k) * k, y: py - ((py - current.y) / current.k) * k }
    })

  const focusNode = (id: string) => {
    const node = byId.get(id)!
    setActive(id)
    const out = graph.edges.filter((edge) => edge.from === id).map((edge) => byId.get(edge.to)?.label ?? edge.to)
    setMessage(`${node.label}. ${out.length ? `Leads to ${out.join(', ')}.` : 'End of flow.'}`)
    setView((current) => {
      const sx = node.x * current.k + current.x
      const sy = node.y * current.k + current.y
      if (sx > 40 && sx < size.w - 40 && sy > 30 && sy < size.h - 30) return current
      return { ...current, x: size.w / 2 - node.x * current.k, y: size.h / 2 - node.y * current.k }
    })
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const tb = direction === 'TB'
    const node = active ? byId.get(active) : undefined
    const nearest = (ids: string[]) =>
      ids
        .map((id) => byId.get(id)!)
        .sort((a, b) => (tb ? Math.abs(a.x - node!.x) - Math.abs(b.x - node!.x) : Math.abs(a.y - node!.y) - Math.abs(b.y - node!.y)))[0]?.id
    const sideways = (step: number) => {
      const row = layout.nodes.filter((entry) => entry.layer === node!.layer).sort((a, b) => (tb ? a.x - b.x : a.y - b.y))
      return row[row.findIndex((entry) => entry.id === node!.id) + step]?.id
    }
    const next = (id: string) => graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to)
    const prev = (id: string) => graph.edges.filter((edge) => edge.to === id).map((edge) => edge.from)
    let target: string | undefined
    const key = event.key
    if (key === '+' || key === '=') zoomAt(1.2)
    else if (key === '-' || key === '_') zoomAt(1 / 1.2)
    else if (key === '0') fit()
    else if (key === 'Escape' && active) setActive(null)
    else if (key === 'Enter' && active) onNodeSelect?.(active)
    else if (key.startsWith('Arrow')) {
      if (!node) target = layout.nodes[0]?.id
      else if (key === (tb ? 'ArrowDown' : 'ArrowRight')) target = nearest(next(node.id))
      else if (key === (tb ? 'ArrowUp' : 'ArrowLeft')) target = nearest(prev(node.id))
      else if (key === (tb ? 'ArrowRight' : 'ArrowDown')) target = sideways(1)
      else target = sideways(-1)
    } else if (key === 'Home' && layout.nodes.length) target = layout.nodes[0].id
    else return
    event.preventDefault()
    if (target) focusNode(target)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-flow-node]') || (event.target as Element).closest('button')) return
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (start) setView((current) => ({ ...current, x: start.vx + event.clientX - start.x, y: start.vy + event.clientY - start.y }))
  }

  return (
    <div className={cn('relative flex w-full flex-col', className)}>
      <div
        ref={frameRef}
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface active:cursor-grabbing"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <svg
          role="img"
          aria-label={`${label}. ${layout.nodes.length} steps; use arrow keys to follow the flow.`}
          aria-describedby={listId}
          width={size.w}
          height={height}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
        >
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-ink-faint" />
            </marker>
          </defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {layout.routes.map((route, index) => {
              if (!route) return null
              const { d, mid } = pathFor(route.points, direction, routing)
              return (
                <g key={index}>
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={1.5}
                    markerEnd={`url(#${markerId})`}
                    strokeDasharray={route.reversed ? '5 4' : undefined}
                    className="stroke-ink-faint"
                  />
                  {route.edge.label && (
                    <text x={mid.x} y={mid.y} dy="-4" textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold [paint-order:stroke] [stroke:var(--color-surface)] [stroke-width:4px]">
                      {route.edge.label}
                    </text>
                  )}
                </g>
              )
            })}
            {layout.nodes.map((node) => (
              <g
                key={node.id}
                data-flow-node=""
                className="cursor-pointer"
                onClick={() => {
                  focusNode(node.id)
                  onNodeSelect?.(node.id)
                }}
              >
                <rect
                  x={node.x - node.w / 2}
                  y={node.y - node.h / 2}
                  width={node.w}
                  height={node.h}
                  rx="10"
                  className={cn(
                    'stroke-line-strong',
                    active === node.id ? 'fill-accent stroke-ink' : 'fill-surface-muted',
                  )}
                  strokeWidth={active === node.id ? 2 : 1}
                />
                <text x={node.x} y={node.y} dy="0.35em" textAnchor="middle" className={cn('text-[12px] font-semibold', active === node.id ? 'fill-accent-ink' : 'fill-ink')}>
                  {node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        <div className="absolute bottom-2 right-2 flex gap-1">
          <IconButton icon={PlusIcon} label="Zoom in" size="xs" tone="white" onClick={() => zoomAt(1.2)} />
          <IconButton icon={MinusIcon} label="Zoom out" size="xs" tone="white" onClick={() => zoomAt(1 / 1.2)} />
          <button
            type="button"
            onClick={fit}
            className="h-7 rounded-full bg-shell px-3 text-[11px] font-semibold text-ink shadow-[var(--shadow-float)] hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Fit
          </button>
        </div>
      </div>
      <VisuallyHidden>
        <ul id={listId}>
          {graph.edges.map((edge, index) => (
            <li key={index}>
              {byId.get(edge.from)?.label ?? edge.from} to {byId.get(edge.to)?.label ?? edge.to}
              {edge.label ? ` (${edge.label})` : ''}
            </li>
          ))}
        </ul>
      </VisuallyHidden>
      <PlotAnnouncer message={message} />
    </div>
  )
}
