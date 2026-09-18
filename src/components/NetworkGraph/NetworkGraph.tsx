'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { SERIES_COLORS } from '../../lib/chart'
import { usePrefersReducedMotion } from '../../lib/motion'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
import { VisuallyHidden } from '../VisuallyHidden'
import { PLOT_WIDTH, PlotAnnouncer, PlotTip, pointerToView, useChartCursor } from '../internal/plot'

export interface NetworkGraphNode {
  id: string
  label: string
  /** Nodes in the same group share a colour and a legend entry. */
  group?: string
}

export interface NetworkGraphLink {
  /** Id of one end. */
  source: string
  /** Id of the other end. Links are undirected. */
  target: string
}

export interface NetworkGraphProps {
  nodes: NetworkGraphNode[]
  links: NetworkGraphLink[]
  /** Accessible name for the graph. */
  label: string
  /** Height in viewBox pixels. The width fills the container. */
  height?: number
  /** Simulation steps before the layout settles. More untangles bigger graphs, at a cost. */
  ticks?: number
  /** Resting length of a link, in viewBox pixels. */
  linkDistance?: number
  /** Print each node’s label under it. */
  showLabels?: boolean
  /** Called when a node is clicked or chosen with Enter. */
  onNodeSelect?: (id: string) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Body {
  x: number
  y: number
  vx: number
  vy: number
  pinned: boolean
}

const TICKS_PER_FRAME = 4
/** Repulsion between every pair of nodes. Negative pushes apart. */
const CHARGE = -300

/**
 * Things and the connections between them, laid out by a small force simulation
 * written here rather than imported: every node pushes every other away, every
 * link pulls its two ends to a resting length, and a weak pull holds the whole
 * graph in the middle.
 *
 * The simulation runs a fixed number of steps and then stops. A graph that
 * keeps drifting cannot be read, and a layout that never finishes keeps a
 * laptop fan on. The first frames are drawn so the graph visibly untangles;
 * under reduced motion every step runs in one go and the settled layout appears
 * at once. Start positions are a sunflower spiral, not random,
 * so the same data always settles into the same picture.
 *
 * Dragging a node pins it where it is dropped and lets its neighbours relax
 * around it. Hover or arrow to a node and its neighbours stay lit while the
 * rest fade. Positions carry no meaning, so the hidden list — every node and
 * what it connects to — is a complete alternative, not a summary.
 */
export function NetworkGraph({
  nodes,
  links,
  label,
  height = 380,
  ticks = 300,
  linkDistance = 60,
  showLabels = true,
  onNodeSelect,
  className,
}: NetworkGraphProps) {
  const listId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const bodies = useRef<Body[]>([])
  const [, setVersion] = useState(0)
  const drag = useRef<number | null>(null)
  const moved = useRef(false)
  const heat = useRef<(steps: number) => void>(() => {})
  const { active, setActive, keyProps } = useChartCursor(nodes.length)

  const indexOf = new Map(nodes.map((node, index) => [node.id, index]))
  const edges = links.flatMap((link) => {
    const a = indexOf.get(link.source)
    const b = indexOf.get(link.target)
    return a === undefined || b === undefined || a === b ? [] : [[a, b] as const]
  })
  const neighbours = nodes.map(() => new Set<number>())
  for (const [a, b] of edges) {
    neighbours[a].add(b)
    neighbours[b].add(a)
  }
  const groups = [...new Set(nodes.map((node) => node.group ?? ''))]
  const colorOf = (node: NetworkGraphNode) => SERIES_COLORS[groups.indexOf(node.group ?? '') % SERIES_COLORS.length]
  const radiusOf = (index: number) => 5 + Math.min(7, Math.sqrt(neighbours[index].size) * 2)

  const signature = `${nodes.map((node) => node.id).join(',')}|${edges.map((edge) => edge.join('-')).join(',')}`
  if (bodies.current.length !== nodes.length) {
    // Spiral slots are handed out breadth-first from the best-connected node, so
    // neighbours start near each other and the simulation has less to untangle.
    const rank = new Map<number, number>()
    const byDegree = nodes.map((_, index) => index).sort((a, b) => neighbours[b].size - neighbours[a].size)
    for (const start of byDegree) {
      if (rank.has(start)) continue
      const queue = [start]
      rank.set(start, rank.size)
      for (let at = 0; at < queue.length; at += 1) {
        for (const next of [...neighbours[queue[at]]].sort((a, b) => neighbours[b].size - neighbours[a].size)) {
          if (rank.has(next)) continue
          rank.set(next, rank.size)
          queue.push(next)
        }
      }
    }
    bodies.current = nodes.map((_, index) => {
      const slot = rank.get(index) ?? index
      const r = 18 * Math.sqrt(slot + 0.5)
      const angle = slot * 2.399963
      return { x: PLOT_WIDTH / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle), vx: 0, vy: 0, pinned: false }
    })
  }

  useEffect(() => {
    let frame = 0
    let alpha = 1
    // Alpha cools from 1 to about 0.001 over the run, the schedule d3-force uses.
    const decay = 1 - 0.001 ** (1 / Math.max(1, ticks))
    let remaining = 0

    // Degree per node, for link strength: a hub is pulled on by many links, so each pulls it less.
    const degree = nodes.map((_, index) => Math.max(1, neighbours[index].size))

    const step = () => {
      const list = bodies.current
      alpha += (0 - alpha) * decay
      for (const [a, b] of edges) {
        const from = list[a]
        const to = list[b]
        let dx = to.x + to.vx - from.x - from.vx || 0.01
        let dy = to.y + to.vy - from.y - from.vy || 0.01
        const d = Math.hypot(dx, dy)
        const pull = (((d - linkDistance) / d) * alpha) / Math.min(degree[a], degree[b])
        dx *= pull
        dy *= pull
        const bias = degree[a] / (degree[a] + degree[b])
        to.vx -= dx * bias
        to.vy -= dy * bias
        from.vx += dx * (1 - bias)
        from.vy += dy * (1 - bias)
      }
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const dx = list[j].x - list[i].x || 0.01
          const dy = list[j].y - list[i].y || 0.01
          // Repulsion falls off with distance, not its square, so far nodes still spread.
          const push = (CHARGE * alpha) / Math.max(dx * dx + dy * dy, 1)
          list[i].vx += dx * push
          list[i].vy += dy * push
          list[j].vx -= dx * push
          list[j].vy -= dy * push
        }
      }
      for (const body of list) {
        if (body.pinned) {
          body.vx = 0
          body.vy = 0
          continue
        }
        // Gravity is weaker across than down, so the graph spreads to the plot's wide shape.
        body.vx += (PLOT_WIDTH / 2 - body.x) * 0.03 * alpha
        body.vy += (height / 2 - body.y) * 0.08 * alpha
        body.vx *= 0.6
        body.vy *= 0.6
        body.x = Math.min(PLOT_WIDTH - 16, Math.max(16, body.x + body.vx))
        body.y = Math.min(height - 20, Math.max(14, body.y + body.vy))
      }
    }

    const loop = () => {
      for (let i = 0; i < TICKS_PER_FRAME && remaining > 0; i += 1, remaining -= 1) step()
      setVersion((value) => value + 1)
      if (remaining > 0) frame = requestAnimationFrame(loop)
    }

    heat.current = (steps: number) => {
      const instant =
        typeof requestAnimationFrame === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      alpha = Math.max(alpha, steps >= ticks ? 1 : 0.3)
      remaining = steps
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
      if (instant) {
        while (remaining > 0) {
          step()
          remaining -= 1
        }
        setVersion((value) => value + 1)
      } else frame = requestAnimationFrame(loop)
    }

    heat.current(ticks)
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
    }
    // The signature stands in for nodes and links, which are new arrays every render.
  }, [signature, ticks, linkDistance, height]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = bodies.current
  const lit = active === null ? null : new Set([active, ...neighbours[active]])
  const current = active === null ? null : nodes[active]

  const describe = (index: number) => {
    const names = [...neighbours[index]].map((other) => nodes[other].label)
    return `${nodes[index].label}${nodes[index].group ? `, ${nodes[index].group}` : ''}: ${
      names.length ? `connected to ${names.join(', ')}` : 'no connections'
    }`
  }

  const nearest = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = pointerToView(event, PLOT_WIDTH, height)
    let best: number | null = null
    let bestDistance = 18
    list.forEach((body, index) => {
      const distance = Math.hypot(body.x - x, body.y - y) - radiusOf(index)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    return { best, x, y }
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${nodes.length} nodes and ${edges.length} connections; use arrow keys to step through nodes.`}
          aria-describedby={listId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full touch-none select-none rounded-[var(--radius-glyph)] outline-offset-2"
          {...keyProps}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && active !== null) {
              event.preventDefault()
              onNodeSelect?.(nodes[active].id)
              return
            }
            keyProps.onKeyDown(event)
          }}
          onPointerDown={(event) => {
            const { best } = nearest(event)
            if (best === null) return
            drag.current = best
            moved.current = false
            setActive(best)
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => {
            const { best, x, y } = nearest(event)
            if (drag.current === null) {
              setActive(best)
              return
            }
            const body = list[drag.current]
            body.x = Math.min(PLOT_WIDTH - 16, Math.max(16, x))
            body.y = Math.min(height - 20, Math.max(14, y))
            body.pinned = true
            moved.current = true
            if (reducedMotion) setVersion((value) => value + 1)
            else heat.current(40)
          }}
          onPointerUp={(event) => {
            const { best } = nearest(event)
            if (drag.current !== null && !moved.current && best === drag.current) onNodeSelect?.(nodes[best].id)
            drag.current = null
          }}
          onPointerLeave={() => drag.current === null && setActive(null)}
        >
          <g>
            {edges.map(([a, b]) => {
              const on = lit !== null && (a === active || b === active)
              return (
                <line
                  key={`${a}-${b}`}
                  x1={list[a].x}
                  y1={list[a].y}
                  x2={list[b].x}
                  y2={list[b].y}
                  className={cn('transition-opacity', on ? 'stroke-ink' : 'stroke-line-strong')}
                  strokeWidth={on ? 1.75 : 1.25}
                  opacity={lit === null || on ? 1 : 0.3}
                />
              )
            })}
          </g>
          {nodes.map((node, index) => {
            const body = list[index]
            const dim = lit !== null && !lit.has(index)
            return (
              <g key={node.id} className="transition-opacity" opacity={dim ? 0.25 : 1}>
                <circle
                  cx={body.x}
                  cy={body.y}
                  r={radiusOf(index)}
                  fill={colorOf(node)}
                  className={cn('stroke-surface', drag.current === index ? 'cursor-grabbing' : 'cursor-grab')}
                  strokeWidth={index === active ? 0 : 2}
                />
                {index === active && (
                  <circle
                    cx={body.x}
                    cy={body.y}
                    r={radiusOf(index) + 3}
                    fill="none"
                    className="stroke-ink"
                    strokeWidth="2"
                  />
                )}
                {showLabels && (
                  <text
                    x={body.x}
                    y={body.y + radiusOf(index) + 10}
                    textAnchor="middle"
                    className={cn(
                      'pointer-events-none stroke-surface text-[9px]',
                      index === active ? 'fill-ink font-bold' : 'fill-ink-soft font-medium',
                    )}
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {node.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {current && active !== null && drag.current === null && (
          <PlotTip x={list[active].x} y={list[active].y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={current.label}
              rows={[
                ...(current.group ? [{ label: 'Group', value: current.group, color: colorOf(current) }] : []),
                { label: 'Connections', value: String(neighbours[active].size) },
              ]}
            />
          </PlotTip>
        )}
      </div>

      {groups.length > 1 && (
        <Legend
          label={`${label} groups`}
          series={groups.map((group) => ({
            label: group || 'Other',
            color: SERIES_COLORS[groups.indexOf(group) % SERIES_COLORS.length],
          }))}
        />
      )}

      <VisuallyHidden>
        <ul id={listId}>
          {nodes.map((node, index) => (
            <li key={node.id}>{describe(index)}</li>
          ))}
        </ul>
      </VisuallyHidden>
      <PlotAnnouncer message={active === null ? '' : describe(active)} />
    </div>
  )
}
