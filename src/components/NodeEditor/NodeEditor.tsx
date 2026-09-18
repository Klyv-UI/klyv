'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { CrossIcon } from '../internal/icons'
import { IconButton } from '../IconButton'
import { useAnnounce } from '../LiveRegion'
import { Menu, type MenuItem } from '../Menu'
import { PanZoom, type PanZoomView } from '../PanZoom'

export interface NodeEditorPort {
  id: string
  label: string
  /** Wires only join ports whose types are compatible. `any` fits everything. */
  type: string
}

export interface NodeEditorNode {
  id: string
  title: string
  /** Position of the top-left corner, in canvas pixels. */
  x: number
  y: number
  inputs: NodeEditorPort[]
  outputs: NodeEditorPort[]
}

export interface NodeEditorEndpoint {
  node: string
  port: string
}

export interface NodeEditorWire {
  id: string
  from: NodeEditorEndpoint
  to: NodeEditorEndpoint
}

export interface NodeEditorGraph {
  nodes: NodeEditorNode[]
  wires: NodeEditorWire[]
}

export interface NodeEditorProps {
  /** Controlled graph. */
  value?: NodeEditorGraph
  /** Initial graph, uncontrolled. */
  defaultValue?: NodeEditorGraph
  /** Called with the whole graph after every change, including each step of a node drag. */
  onValueChange?: (graph: NodeEditorGraph) => void
  /** Accessible name for the canvas. */
  label: string
  /** Whether an output type may feed an input type. Defaults to equal types, or either side being `any`. */
  isCompatible?: (outputType: string, inputType: string) => boolean
  /** Allow wires that close a loop. Off by default: most node graphs are evaluated in order and a loop never ends. */
  allowCycles?: boolean
  /** Width of every node in pixels. */
  nodeWidth?: number
  /** Zoom with the wheel. Turn it off inside a scrolling page if it fights the scroll. */
  wheelZoom?: boolean
  /** Merged last, so it wins. Give the component a height here. */
  className?: string
}

const HEADER = 36
const ROW = 26

const defaultCompatible = (output: string, input: string) => output === input || output === 'any' || input === 'any'

const TYPE_COLOURS = ['var(--color-accent-strong)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-ink-soft)']
const typeColour = (type: string) => TYPE_COLOURS[[...type].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TYPE_COLOURS.length]!

const portPoint = (node: NodeEditorNode, port: string, side: 'in' | 'out', width: number) => {
  const list = side === 'in' ? node.inputs : node.outputs
  const index = Math.max(0, list.findIndex((entry) => entry.id === port))
  return { x: side === 'in' ? node.x : node.x + width, y: node.y + HEADER + index * ROW + ROW / 2 }
}

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const bend = Math.max(40, Math.abs(b.x - a.x) / 2)
  return `M${a.x} ${a.y} C${a.x + bend} ${a.y} ${b.x - bend} ${b.y} ${b.x} ${b.y}`
}

/** Whether `target` can be reached from `start` by following wires downstream. */
function reaches(wires: NodeEditorWire[], start: string, target: string) {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length) {
    const node = stack.pop()!
    if (node === target) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const wire of wires) if (wire.from.node === node) stack.push(wire.to.node)
  }
  return false
}

let counter = 0
const wireId = () => `wire-${Date.now().toString(36)}-${(counter += 1)}`

/**
 * A node graph editor: boxes with typed inputs on the left and outputs on the right, joined by wires you drag out of
 * a port.
 *
 * Port positions are computed from the node’s position and the port’s row, never measured, so wires stay attached at
 * any zoom and while a node is mid-drag. A wire is checked before it is made, not after: the types must fit, a node
 * cannot feed itself, and unless loops are allowed the new wire must not let data flow back to where it came from —
 * a depth-first walk downstream from the target looking for the source. While a wire is being dragged the inputs it
 * could land on are lit and the rest dimmed, and a refusal says why rather than silently snapping back. An input takes
 * one wire; connecting another replaces it.
 *
 * The viewport is PanZoom, so dragging the background pans and the wheel zooms. Everything also works from the
 * keyboard: nodes are focusable and move with the arrow keys, Delete removes one, and every port is a button whose
 * menu lists exactly the connections that would be valid from it, plus the ones to undo.
 */
export function NodeEditor({
  value,
  defaultValue = { nodes: [], wires: [] },
  onValueChange,
  label,
  isCompatible = defaultCompatible,
  allowCycles = false,
  nodeWidth = 184,
  wheelZoom = true,
  className,
}: NodeEditorProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const graph = value ?? uncontrolled
  const [view, setView] = useState<PanZoomView>({ x: 0, y: 0, scale: 1 })
  const [pending, setPending] = useState<{ from: NodeEditorEndpoint; x: number; y: number } | null>(null)
  const [selectedWire, setSelectedWire] = useState<string | null>(null)
  const [openPort, setOpenPort] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const announce = useAnnounce()

  const contentWidth = Math.max(800, ...graph.nodes.map((node) => node.x + nodeWidth + 240))
  const contentHeight = Math.max(480, ...graph.nodes.map((node) => node.y + HEADER + Math.max(node.inputs.length, node.outputs.length) * ROW + 200))

  const commit = (next: NodeEditorGraph) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const say = (text: string, error = false) => {
    setMessage({ text, error })
    announce(text, error ? 'assertive' : 'polite')
  }
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3200)
    return () => clearTimeout(timer)
  }, [message])

  const nodeOf = (id: string) => graph.nodes.find((node) => node.id === id)
  const portOf = (end: NodeEditorEndpoint, side: 'in' | 'out') => {
    const node = nodeOf(end.node)
    return (side === 'in' ? node?.inputs : node?.outputs)?.find((port) => port.id === end.port)
  }
  const name = (end: NodeEditorEndpoint, side: 'in' | 'out') => `${nodeOf(end.node)?.title} › ${portOf(end, side)?.label}`

  /** Why a wire from → to cannot be made, or null if it can. */
  const problem = (from: NodeEditorEndpoint, to: NodeEditorEndpoint): string | null => {
    const output = portOf(from, 'out')
    const input = portOf(to, 'in')
    if (!output || !input) return 'That port no longer exists.'
    if (from.node === to.node) return 'A node cannot feed itself.'
    if (!isCompatible(output.type, input.type)) return `${output.label} is ${output.type}, and ${input.label} takes ${input.type}.`
    const others = graph.wires.filter((wire) => !(wire.to.node === to.node && wire.to.port === to.port))
    if (!allowCycles && reaches(others, to.node, from.node)) return 'That wire would make a loop.'
    return null
  }

  const connect = (from: NodeEditorEndpoint, to: NodeEditorEndpoint) => {
    const reason = problem(from, to)
    if (reason) return say(`Not connected. ${reason}`, true)
    const wires = graph.wires.filter((wire) => !(wire.to.node === to.node && wire.to.port === to.port))
    commit({ ...graph, wires: [...wires, { id: wireId(), from, to }] })
    say(`Connected ${name(from, 'out')} to ${name(to, 'in')}.`)
  }

  const disconnect = (wire: NodeEditorWire) => {
    commit({ ...graph, wires: graph.wires.filter((entry) => entry.id !== wire.id) })
    setSelectedWire(null)
    say(`Disconnected ${name(wire.from, 'out')} from ${name(wire.to, 'in')}.`)
  }

  const removeNode = (node: NodeEditorNode) => {
    commit({
      nodes: graph.nodes.filter((entry) => entry.id !== node.id),
      wires: graph.wires.filter((wire) => wire.from.node !== node.id && wire.to.node !== node.id),
    })
    say(`Deleted ${node.title} and its wires.`)
  }

  const moveNode = (id: string, x: number, y: number) =>
    commit({ ...graph, nodes: graph.nodes.map((node) => (node.id === id ? { ...node, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) } : node)) })

  /** Client pixels to canvas pixels, whatever the pan and zoom. */
  const toCanvas = (clientX: number, clientY: number) => {
    const box = contentRef.current!.getBoundingClientRect()
    const scale = box.width / contentWidth || 1
    return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale }
  }

  const startNodeDrag = (event: PointerEvent<HTMLDivElement>, node: NodeEditorNode) => {
    event.stopPropagation()
    if (event.button !== 0 || (event.target as Element).closest('button')) return
    const start = toCanvas(event.clientX, event.clientY)
    const origin = { x: node.x, y: node.y }
    const header = event.currentTarget
    header.setPointerCapture(event.pointerId)
    const onMove = (move: globalThis.PointerEvent) => {
      const point = toCanvas(move.clientX, move.clientY)
      moveNode(node.id, origin.x + point.x - start.x, origin.y + point.y - start.y)
    }
    const onUp = () => {
      header.removeEventListener('pointermove', onMove)
      header.removeEventListener('pointerup', onUp)
      header.removeEventListener('pointercancel', onUp)
    }
    header.addEventListener('pointermove', onMove)
    header.addEventListener('pointerup', onUp)
    header.addEventListener('pointercancel', onUp)
  }

  const startWire = (event: PointerEvent<HTMLButtonElement>, from: NodeEditorEndpoint) => {
    event.stopPropagation()
    if (event.button !== 0) return
    const button = event.currentTarget
    button.setPointerCapture(event.pointerId)
    const origin = { x: event.clientX, y: event.clientY }
    dragged.current = false
    const onMove = (move: globalThis.PointerEvent) => {
      if (!dragged.current && Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 5) return
      dragged.current = true
      setPending({ from, ...toCanvas(move.clientX, move.clientY) })
    }
    const onUp = (up: globalThis.PointerEvent) => {
      button.removeEventListener('pointermove', onMove)
      button.removeEventListener('pointerup', onUp)
      button.removeEventListener('pointercancel', onUp)
      setPending(null)
      // The click that follows this pointerup is swallowed by the menu guard; after that, clicks open the menu again.
      setTimeout(() => {
        dragged.current = false
      }, 0)
      if (!dragged.current || up.type !== 'pointerup') return
      const point = toCanvas(up.clientX, up.clientY)
      let best: { to: NodeEditorEndpoint; distance: number } | null = null
      for (const node of graph.nodes) {
        for (const port of node.inputs) {
          const at = portPoint(node, port.id, 'in', nodeWidth)
          const distance = Math.hypot(at.x - point.x, at.y - point.y)
          if (distance < 22 && (!best || distance < best.distance)) best = { to: { node: node.id, port: port.id }, distance }
        }
      }
      if (best) connect(from, best.to)
    }
    button.addEventListener('pointermove', onMove)
    button.addEventListener('pointerup', onUp)
    button.addEventListener('pointercancel', onUp)
  }

  const onNodeKeyDown = (event: KeyboardEvent<HTMLDivElement>, node: NodeEditorNode) => {
    // Keys inside a node, and inside its port menus, belong to the node — not to the viewport’s panning.
    event.stopPropagation()
    if (event.target !== event.currentTarget) return
    const step = event.shiftKey ? 50 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      moveNode(node.id, node.x + moves[event.key]![0], node.y + moves[event.key]![1])
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeNode(node)
    }
  }

  const portMenu = (node: NodeEditorNode, port: NodeEditorPort, side: 'in' | 'out'): MenuItem[] => {
    const here = { node: node.id, port: port.id }
    const items: MenuItem[] = []
    for (const other of graph.nodes) {
      for (const candidate of side === 'out' ? other.inputs : other.outputs) {
        const there = { node: other.id, port: candidate.id }
        const [from, to] = side === 'out' ? [here, there] : [there, here]
        const exists = graph.wires.some((wire) => wire.from.node === from.node && wire.from.port === from.port && wire.to.node === to.node && wire.to.port === to.port)
        if (exists || problem(from, to)) continue
        items.push({
          id: `connect-${other.id}-${candidate.id}`,
          label: `${side === 'out' ? 'Connect to' : 'Connect from'} ${other.title} › ${candidate.label}`,
          onSelect: () => connect(from, to),
        })
      }
    }
    if (!items.length) items.push({ id: 'none', label: side === 'out' ? 'No compatible inputs' : 'No compatible outputs', disabled: true })
    for (const wire of graph.wires) {
      const attached = side === 'out' ? wire.from.node === node.id && wire.from.port === port.id : wire.to.node === node.id && wire.to.port === port.id
      if (!attached) continue
      items.push({
        id: `disconnect-${wire.id}`,
        label: `Disconnect ${side === 'out' ? `from ${name(wire.to, 'in')}` : `from ${name(wire.from, 'out')}`}`,
        destructive: true,
        onSelect: () => disconnect(wire),
      })
    }
    return items
  }

  const wireSelected = graph.wires.find((wire) => wire.id === selectedWire)
  const wireMid = (() => {
    if (!wireSelected) return null
    const fromNode = nodeOf(wireSelected.from.node)
    const toNode = nodeOf(wireSelected.to.node)
    if (!fromNode || !toNode) return null
    const a = portPoint(fromNode, wireSelected.from.port, 'out', nodeWidth)
    const b = portPoint(toNode, wireSelected.to.port, 'in', nodeWidth)
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  })()

  return (
    <div
      className={cn('relative h-[460px] w-full min-w-0', className)}
      onPointerDownCapture={(event) => {
        if (!(event.target as Element).closest('[data-wire]')) setSelectedWire(null)
      }}
    >
      <PanZoom
        label={label}
        contentWidth={contentWidth}
        contentHeight={contentHeight}
        view={view}
        onViewChange={setView}
        wheelZoom={wheelZoom}
        min={0.3}
        max={2}
        className="size-full bg-[radial-gradient(circle,var(--color-line-strong)_1px,transparent_1px)] [background-size:22px_22px]"
      >
        <div ref={contentRef} className="relative" style={{ width: contentWidth, height: contentHeight }}>
          <svg aria-hidden="true" width={contentWidth} height={contentHeight} className="absolute inset-0 overflow-visible">
            {graph.wires.map((wire) => {
              const fromNode = nodeOf(wire.from.node)
              const toNode = nodeOf(wire.to.node)
              if (!fromNode || !toNode) return null
              const d = curve(portPoint(fromNode, wire.from.port, 'out', nodeWidth), portPoint(toNode, wire.to.port, 'in', nodeWidth))
              const chosen = wire.id === selectedWire
              return (
                <g key={wire.id} data-wire="">
                  <path d={d} fill="none" stroke={chosen ? 'var(--color-accent-strong)' : 'var(--color-ink-faint)'} strokeWidth={chosen ? 3 : 2} />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      setSelectedWire(wire.id)
                    }}
                  />
                </g>
              )
            })}
            {pending &&
              (() => {
                const fromNode = nodeOf(pending.from.node)
                if (!fromNode) return null
                return (
                  <path
                    d={curve(portPoint(fromNode, pending.from.port, 'out', nodeWidth), pending)}
                    fill="none"
                    stroke="var(--color-accent-strong)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                  />
                )
              })()}
          </svg>

          {graph.nodes.map((node) => {
            const rows = Math.max(node.inputs.length, node.outputs.length, 1)
            return (
              <div
                key={node.id}
                role="group"
                aria-roledescription="node"
                aria-label={`${node.title}, ${node.inputs.length} inputs, ${node.outputs.length} outputs. Arrow keys move it, Delete removes it.`}
                tabIndex={0}
                onKeyDown={(event) => onNodeKeyDown(event, node)}
                onPointerDown={(event) => event.stopPropagation()}
                style={{ left: node.x, top: node.y, width: nodeWidth, height: HEADER + rows * ROW + 8 }}
                className="absolute rounded-[var(--radius-tile)] border border-line-strong bg-surface shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2"
              >
                <div
                  onPointerDown={(event) => startNodeDrag(event, node)}
                  className="flex h-[36px] cursor-grab touch-none items-center gap-2 border-b border-line pl-3 pr-1 active:cursor-grabbing"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">{node.title}</span>
                  <IconButton icon={CrossIcon} label={`Delete ${node.title}`} size="xs" onClick={() => removeNode(node)} />
                </div>
                {(['in', 'out'] as const).map((side) =>
                  (side === 'in' ? node.inputs : node.outputs).map((port, index) => {
                    const key = `${node.id}:${port.id}:${side}`
                    const connections = graph.wires.filter((wire) =>
                      side === 'in' ? wire.to.node === node.id && wire.to.port === port.id : wire.from.node === node.id && wire.from.port === port.id,
                    ).length
                    const target = pending && side === 'in' ? problem(pending.from, { node: node.id, port: port.id }) : undefined
                    return (
                      <div
                        key={key}
                        className={cn('absolute flex items-center', side === 'in' ? 'left-0 flex-row' : 'right-0 flex-row-reverse')}
                        style={{ top: HEADER + index * ROW, height: ROW, width: nodeWidth / 2 }}
                      >
                        <Menu
                          label={`${port.label} connections`}
                          align={side === 'in' ? 'start' : 'end'}
                          open={openPort === key}
                          onOpenChange={(next) => {
                            // A drag out of the port ends in a click on it; that click is not a request for the menu.
                            if (next && dragged.current) {
                              dragged.current = false
                              return
                            }
                            setOpenPort(next ? key : null)
                          }}
                          items={portMenu(node, port, side)}
                          trigger={
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-label={`${port.label} ${side === 'in' ? 'input' : 'output'}, ${port.type}, ${connections} connected`}
                              onPointerDown={side === 'out' ? (event) => startWire(event, { node: node.id, port: port.id }) : (event) => event.stopPropagation()}
                              className={cn(
                                'group/port flex h-[26px] touch-none items-center gap-1.5 rounded-md text-[11px] font-semibold text-ink-soft hover:text-ink',
                                side === 'in' ? '-ml-[7px] pr-1.5' : '-mr-[7px] flex-row-reverse pl-1.5',
                                side === 'out' && 'cursor-crosshair',
                                target === null && 'text-ink',
                                typeof target === 'string' && 'opacity-40',
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'size-3.5 rounded-full border-2 border-surface transition-transform group-hover/port:scale-125',
                                  target === null && 'scale-150 ring-2 ring-[var(--color-accent-strong)]',
                                )}
                                style={{ background: typeColour(port.type) }}
                              />
                              <span className="truncate">{port.label}</span>
                            </button>
                          }
                        />
                      </div>
                    )
                  }),
                )}
              </div>
            )
          })}

          {wireSelected && wireMid && (
            <span data-wire="" className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: wireMid.x, top: wireMid.y }}>
              <IconButton
                icon={CrossIcon}
                label={`Disconnect ${name(wireSelected.from, 'out')} from ${name(wireSelected.to, 'in')}`}
                size="xs"
                tone="white"
                autoFocus
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Delete' || event.key === 'Backspace') disconnect(wireSelected)
                  if (event.key === 'Escape') setSelectedWire(null)
                }}
                onClick={() => disconnect(wireSelected)}
              />
            </span>
          )}
        </div>
      </PanZoom>
      {message && (
        <p
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-full border bg-surface px-3 py-1.5 text-[12px] font-semibold shadow-[var(--shadow-float)]',
            message.error ? 'border-danger text-danger' : 'border-line text-ink',
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
