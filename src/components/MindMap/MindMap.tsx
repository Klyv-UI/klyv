'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { PlotAnnouncer } from '../internal/plot'

export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  /** Hide the children, keeping them in the value. */
  collapsed?: boolean
  /** Which side of the centre a first-level branch sits on. Balanced automatically when absent. */
  side?: 'left' | 'right'
}

export interface MindMapProps {
  /** Controlled tree. */
  value?: MindMapNode
  /** Tree when uncontrolled. */
  defaultValue?: MindMapNode
  /** Called with the whole new tree after every edit. */
  onValueChange?: (value: MindMapNode) => void
  /** Accessible name for the map. */
  label: string
  /** Text given to a new node before it is renamed. */
  placeholder?: string
  /** Show the map without editing. Navigation and collapsing still work. */
  readOnly?: boolean
  /** Height of the canvas in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/** The tree as an indented outline, two spaces per level — pastes into any notes app. */
export function mindMapToOutline(root: MindMapNode, depth = 0): string {
  const line = `${'  '.repeat(depth)}- ${root.label}`
  return [line, ...(root.children ?? []).map((child) => mindMapToOutline(child, depth + 1))].join('\n')
}

interface Laid {
  node: MindMapNode
  x: number
  y: number
  w: number
  depth: number
  side: 1 | -1
  parent?: Laid
  level: number
  index: number
  count: number
}

const ROW = 40
const LEVEL = 176
let serial = 0
const newId = () => `mm-${Date.now().toString(36)}-${(serial += 1)}`
const widthOf = (label: string, depth: number) => Math.min(depth ? 170 : 200, Math.max(56, label.length * 7 + (depth ? 26 : 36)))

function mapTree(node: MindMapNode, fn: (node: MindMapNode) => MindMapNode | null): MindMapNode | null {
  const next = fn(node)
  if (!next) return null
  const children = next.children?.map((child) => mapTree(child, fn)).filter((child): child is MindMapNode => !!child)
  return { ...next, children }
}

/**
 * Two-sided radial layout: first-level branches are shared between left and
 * right so the heavier side never runs off the canvas, and each side is a tidy
 * tree whose rows are as tall as the leaves they hold.
 */
function layoutMindMap(root: MindMapNode) {
  const weight = (node: MindMapNode): number =>
    node.collapsed || !node.children?.length ? 1 : node.children.reduce((sum, child) => sum + weight(child), 0)
  const all: Laid[] = []
  const rootW = widthOf(root.label, 0)
  const top: Laid = { node: root, x: 0, y: 0, w: rootW, depth: 0, side: 1, level: 1, index: 1, count: 1 }
  all.push(top)
  const sides: Record<'left' | 'right', MindMapNode[]> = { left: [], right: [] }
  let [left, right] = [0, 0]
  for (const child of root.children ?? []) {
    const side = child.side ?? (right <= left ? 'right' : 'left')
    sides[side].push(child)
    if (side === 'right') right += weight(child)
    else left += weight(child)
  }
  for (const key of ['right', 'left'] as const) {
    const sign = key === 'right' ? 1 : -1
    let cursor = -(sides[key].reduce((sum, child) => sum + weight(child), 0) * ROW) / 2
    const place = (node: MindMapNode, depth: number, parent: Laid, index: number, count: number): void => {
      const w = widthOf(node.label, depth) + (node.collapsed && node.children?.length ? 28 : 0)
      const inner = rootW / 2 + 44 + (depth - 1) * LEVEL
      const laid: Laid = { node, x: sign * (inner + w / 2), y: 0, w, depth, side: sign, parent, level: depth + 1, index, count }
      all.push(laid)
      const kids = node.collapsed ? [] : (node.children ?? [])
      if (!kids.length) {
        laid.y = cursor + ROW / 2
        cursor += ROW
        return
      }
      const start = all.length
      kids.forEach((child, i) => place(child, depth + 1, laid, i + 1, kids.length))
      const direct = all.slice(start).filter((entry) => entry.parent === laid)
      laid.y = (direct[0].y + direct[direct.length - 1].y) / 2
    }
    sides[key].forEach((child) => place(child, 1, top, (root.children ?? []).indexOf(child) + 1, root.children!.length))
  }
  return all
}

/**
 * A mind map you build from the keyboard: Tab adds a child, Enter a sibling,
 * typing renames, Delete removes, the arrows move to whichever node is in that
 * direction on screen, and Space folds a branch.
 *
 * Idea capture dies when the tool asks for the mouse between every thought,
 * so every edit is one key away from the node you are on. Arrows are spatial
 * rather than tree-order because on a two-sided map "next" means different
 * things on each side; left always goes left. Tab is taken for adding a child,
 * so Shift+Tab, or Escape then Tab, leaves the map. The value is a plain tree,
 * and mindMapToOutline turns it into an indented list.
 */
export function MindMap({
  value: valueProp,
  defaultValue,
  onValueChange,
  label,
  placeholder = 'New idea',
  readOnly = false,
  height = 420,
  className,
}: MindMapProps) {
  const [state, setState] = useState<MindMapNode>(defaultValue ?? { id: 'root', label: 'Central idea' })
  const value = valueProp ?? state
  const [activeId, setActiveId] = useState(value.id)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0, k: 1 })
  const [message, setMessage] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const released = useRef(false)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const wantFocus = useRef(false)

  const laid = layoutMindMap(value)
  const byId = new Map(laid.map((entry) => [entry.node.id, entry]))
  const active = byId.get(activeId) ?? laid[0]

  const commit = (next: MindMapNode) => {
    if (valueProp === undefined) setState(next)
    onValueChange?.(next)
  }

  const fit = () => {
    const node = canvasRef.current
    const w = node?.clientWidth || 640
    const xs = laid.flatMap((entry) => [entry.x - entry.w / 2, entry.x + entry.w / 2])
    const ys = laid.map((entry) => entry.y)
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys) - 20, Math.max(...ys) + 20]
    const k = Math.min(1.2, (w - 32) / (maxX - minX || 1), (height - 32) / (maxY - minY || 1))
    setPan({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: height / 2 - ((minY + maxY) / 2) * k })
  }
  useEffect(fit, [])

  useEffect(() => {
    if (editing || !wantFocus.current) return
    wantFocus.current = false
    refs.current.get(active.node.id)?.focus({ preventScroll: true })
  })

  const moveTo = (id: string) => {
    const target = byId.get(id)
    if (!target) return
    wantFocus.current = true
    setActiveId(id)
    const w = canvasRef.current?.clientWidth || 640
    const sx = target.x * pan.k + pan.x
    const sy = target.y * pan.k + pan.y
    if (sx < 60 || sx > w - 60 || sy < 24 || sy > height - 24)
      setPan((current) => ({ ...current, x: w / 2 - target.x * current.k, y: height / 2 - target.y * current.k }))
  }

  const addNode = (parentId: string, afterId?: string) => {
    const fresh: MindMapNode = { id: newId(), label: placeholder }
    const isRoot = parentId === value.id
    if (isRoot && !afterId) {
      const weights = { left: 0, right: 0 }
      for (const entry of laid) if (entry.depth === 1) weights[entry.side === 1 ? 'right' : 'left'] += 1
      fresh.side = weights.right <= weights.left ? 'right' : 'left'
    }
    if (isRoot && afterId) fresh.side = byId.get(afterId)!.side === 1 ? 'right' : 'left'
    const next = mapTree(value, (node) => {
      if (node.id !== parentId) return node
      const children = [...(node.children ?? [])]
      const at = afterId ? children.findIndex((child) => child.id === afterId) + 1 : children.length
      children.splice(at, 0, fresh)
      return { ...node, collapsed: false, children }
    })!
    commit(next)
    setActiveId(fresh.id)
    setEditing({ id: fresh.id, text: '' })
    setMessage(`Added ${isRoot || !afterId ? 'child' : 'sibling'}. Type a name, Enter to keep it.`)
  }

  const remove = (target: Laid) => {
    if (!target.parent) return
    const siblings = target.parent.node.children ?? []
    const index = siblings.findIndex((child) => child.id === target.node.id)
    const after = siblings[index - 1] ?? siblings[index + 1] ?? target.parent.node
    commit(mapTree(value, (node) => (node.id === target.node.id ? null : node))!)
    wantFocus.current = true
    setActiveId(after.id)
    setMessage(`Removed ${target.node.label}.`)
  }

  const finishEdit = (keep: boolean) => {
    if (!editing) return
    const text = editing.text.trim()
    if (keep && text) commit(mapTree(value, (node) => (node.id === editing.id ? { ...node, label: text } : node))!)
    setEditing(null)
    wantFocus.current = true
  }

  const spatial = (dx: number, dy: number) => {
    let best: Laid | undefined
    let score = Infinity
    for (const entry of laid) {
      const [ex, ey] = [entry.x - active.x, entry.y - active.y]
      const primary = dx ? ex * dx : ey * dy
      if (entry === active || primary <= 1) continue
      const candidate = primary + 2.5 * Math.abs(dx ? ey : ex)
      if (candidate < score) {
        score = candidate
        best = entry
      }
    }
    return best
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return
    const node = active.node
    const key = event.key
    if (key === 'Tab') {
      if (event.shiftKey || released.current || readOnly) return
      event.preventDefault()
      addNode(node.id)
    } else if (key === 'Escape') {
      released.current = true
      setMessage('Tab now leaves the map.')
      return
    } else if (key === 'Enter' && !readOnly) {
      event.preventDefault()
      if (active.parent) addNode(active.parent.node.id, node.id)
      else addNode(node.id)
    } else if (key === 'F2' && !readOnly) {
      event.preventDefault()
      setEditing({ id: node.id, text: node.label })
    } else if ((key === 'Delete' || key === 'Backspace') && !readOnly) {
      event.preventDefault()
      remove(active)
    } else if (key === ' ') {
      event.preventDefault()
      if (!node.children?.length) return
      commit(mapTree(value, (entry) => (entry.id === node.id ? { ...entry, collapsed: !entry.collapsed } : entry))!)
      wantFocus.current = true
      setMessage(`${node.label} ${node.collapsed ? 'expanded' : 'collapsed'}.`)
    } else if (key.startsWith('Arrow')) {
      event.preventDefault()
      const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key] ?? [0, 0]
      const next = spatial(dx, dy)
      if (next) moveTo(next.node.id)
    } else if (key === 'Home') {
      event.preventDefault()
      moveTo(value.id)
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !readOnly) {
      event.preventDefault()
      setEditing({ id: node.id, text: key })
    } else return
    released.current = false
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[role="treeitem"], button')) return
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div
        ref={canvasRef}
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface active:cursor-grabbing"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          const start = drag.current
          if (start) setPan((current) => ({ ...current, x: start.px + event.clientX - start.x, y: start.py + event.clientY - start.y }))
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.k})` }}>
          <svg className="absolute overflow-visible" width="1" height="1" aria-hidden="true">
            {laid.map((entry) => {
              const parent = entry.parent
              if (!parent) return null
              const x1 = parent.x + (entry.side * parent.w) / 2
              const x2 = entry.x - (entry.side * entry.w) / 2
              const mid = (x1 + x2) / 2
              return (
                <path
                  key={entry.node.id}
                  d={`M${x1},${parent.y} C${mid},${parent.y} ${mid},${entry.y} ${x2},${entry.y}`}
                  fill="none"
                  strokeWidth={entry.depth === 1 ? 2.5 : 1.5}
                  className={entry.depth === 1 ? 'stroke-accent-strong' : 'stroke-line-strong'}
                />
              )
            })}
          </svg>
          <div role="tree" aria-label={label}>
            {laid.map((entry) => {
              const { node } = entry
              const isActive = entry === active
              const hasKids = !!node.children?.length
              const isEditing = editing?.id === node.id
              return (
                <div
                  key={node.id}
                  ref={(element) => {
                    if (element) refs.current.set(node.id, element)
                    else refs.current.delete(node.id)
                  }}
                  role="treeitem"
                  aria-level={entry.level}
                  aria-posinset={entry.index}
                  aria-setsize={entry.count}
                  aria-selected={isActive}
                  aria-expanded={hasKids ? !node.collapsed : undefined}
                  tabIndex={isActive && !isEditing ? 0 : -1}
                  onKeyDown={onKeyDown}
                  onFocus={() => {
                    released.current = false
                    setActiveId(node.id)
                  }}
                  onClick={() => moveTo(node.id)}
                  onDoubleClick={() => !readOnly && setEditing({ id: node.id, text: node.label })}
                  className={cn(
                    'absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center gap-1 whitespace-nowrap px-3 text-center font-semibold outline-none',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    entry.depth === 0
                      ? 'h-11 rounded-[var(--radius-tile)] bg-ink text-[14px] text-ink-inverse'
                      : entry.depth === 1
                        ? 'h-8 rounded-full border border-line-strong bg-surface text-[13px] text-ink'
                        : 'h-7 rounded-[var(--radius-8)] text-[12px] text-ink-soft hover:bg-surface-muted',
                    isActive && entry.depth > 0 && 'bg-accent text-accent-ink',
                    isActive && entry.depth === 0 && 'ring-2 ring-accent-strong ring-offset-2 ring-offset-surface',
                  )}
                  style={{ left: entry.x, top: entry.y, width: entry.w }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      aria-label={`Rename ${node.label}`}
                      value={editing.text}
                      placeholder={placeholder}
                      onChange={(event) => setEditing({ id: node.id, text: event.target.value })}
                      onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
                      onBlur={() => finishEdit(true)}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                        if (event.key === 'Enter') finishEdit(true)
                        if (event.key === 'Escape') finishEdit(false)
                      }}
                      className="w-full min-w-0 bg-transparent text-center outline-none"
                    />
                  ) : (
                    <span className="truncate">{node.label}</span>
                  )}
                  {hasKids && node.collapsed && (
                    <span aria-hidden="true" className="rounded-full bg-surface-muted px-1.5 text-[10px] text-ink-soft">
                      +{node.children!.length}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={fit}
          className="absolute bottom-2 right-2 h-7 rounded-full bg-shell px-3 text-[11px] font-semibold text-ink shadow-[var(--shadow-float)] hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Fit
        </button>
      </div>
      <p className="text-[11px] font-medium text-ink-faint">
        {readOnly
          ? 'Arrows move · Space folds a branch'
          : 'Tab child · Enter sibling · type or F2 to rename · Delete removes · Space folds · Shift+Tab leaves'}
      </p>
      <PlotAnnouncer message={message} />
    </div>
  )
}
