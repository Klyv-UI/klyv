'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ChevronRightIcon } from '../internal/icons'
import { useAnnounce } from '../LiveRegion'
import { VisuallyHidden } from '../VisuallyHidden'

export interface SortableTreeItem {
  id: string
  label: string
  children?: SortableTreeItem[]
  /** Children hidden. Collapsing is part of the value, so it survives a reorder and can be saved with it. */
  collapsed?: boolean
}

export interface SortableTreeProps {
  /** Controlled tree. */
  value?: SortableTreeItem[]
  /** Initial tree, uncontrolled. */
  defaultValue?: SortableTreeItem[]
  /** Called with the whole new tree after a move, or after a branch is collapsed or expanded. */
  onValueChange?: (value: SortableTreeItem[]) => void
  /** Accessible name for the tree. */
  label: string
  /** Pixels per level, both for drawing and for how far a drag must travel sideways to change depth. */
  indentation?: number
  /** Deepest level an item may be dropped at, counting the top level as 0. */
  maxDepth?: number
  /** Custom row content. Defaults to the label. */
  renderLabel?: (item: SortableTreeItem) => ReactNode
  /** Merged last, so it wins. */
  className?: string
}

interface SortableTreeRow {
  id: string
  parentId: string | null
  depth: number
  item: SortableTreeItem
}

interface SortableTreeDrag {
  activeId: string
  overId: string
  /** The depth asked for; the projection clamps it to what the neighbours allow. */
  depth: number
  pointer: boolean
}

function flatten(items: SortableTreeItem[], parentId: string | null = null, depth = 0): SortableTreeRow[] {
  return items.flatMap((item) => [{ id: item.id, parentId, depth, item }, ...flatten(item.children ?? [], item.id, depth + 1)])
}

/** Rebuild nesting from rows in order, each carrying its parent. */
function build(rows: SortableTreeRow[]): SortableTreeItem[] {
  const root: SortableTreeItem[] = []
  const nodes = new Map<string, SortableTreeItem>()
  for (const row of rows) nodes.set(row.id, { ...row.item, children: [] })
  for (const row of rows) {
    const node = nodes.get(row.id)!
    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    ;(parent ? parent.children! : root).push(node)
  }
  for (const node of nodes.values()) if (node.children!.length === 0) delete node.children
  return root
}

/** Rows a reader can see: children of collapsed branches, and of the item being dragged, are left out. */
function visible(rows: SortableTreeRow[], activeId: string | null) {
  const hidden = new Set<string>()
  return rows.filter((row) => {
    if (row.parentId && hidden.has(row.parentId)) {
      hidden.add(row.id)
      return false
    }
    if (row.item.collapsed || row.id === activeId) hidden.add(row.id)
    return true
  })
}

function move<T>(list: T[], from: number, to: number) {
  const next = list.slice()
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/**
 * Where the dragged item would land: the row it is over decides the position, and the requested depth is clamped
 * between what the row below needs (it cannot be orphaned) and one deeper than the row above.
 */
function project(rows: SortableTreeRow[], drag: SortableTreeDrag, maxDepth: number) {
  const from = rows.findIndex((row) => row.id === drag.activeId)
  const to = rows.findIndex((row) => row.id === drag.overId)
  const moved = move(rows, from, to)
  const previous = moved[to - 1]
  const next = moved[to + 1]
  const highest = Math.min(maxDepth, previous ? previous.depth + 1 : 0)
  const lowest = next ? Math.min(next.depth, highest) : 0
  const depth = Math.max(lowest, Math.min(highest, drag.depth))
  let parentId: string | null = null
  if (depth > 0 && previous) {
    if (depth === previous.depth) parentId = previous.parentId
    else if (depth > previous.depth) parentId = previous.id
    else parentId = moved.slice(0, to).reverse().find((row) => row.depth === depth)?.parentId ?? null
  }
  return { depth, parentId, moved, index: to }
}

const GRIP = (
  <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden="true">
    {[4, 8, 12].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} />))}
  </svg>
)

/**
 * A hierarchy you reorder by dragging: up and down chooses the position, left and right chooses the depth.
 *
 * The rows are drawn flat, one per visible item, with the depth as indentation — which is what makes a nested drag
 * tractable. While an item is dragged its descendants are taken out of the list and travel with it, so it can never be
 * dropped inside itself. The projection then asks only two neighbours: the row above sets the deepest it may go (one
 * level below that row) and the row below sets the shallowest (it must not be left without its parent). Sideways
 * pointer travel divided by the indentation is the requested depth, clamped between those two.
 *
 * The keyboard uses the same projection. Arrows move focus as in any tree — right and left expand and collapse —
 * until Space picks an item up; then up and down move it, right and left indent and outdent it, Space drops it and
 * Escape puts it back. Every step is announced with the position and the parent, because an indent is invisible to
 * a screen reader otherwise.
 */
export function SortableTree({
  value,
  defaultValue = [],
  onValueChange,
  label,
  indentation = 24,
  maxDepth = Number.POSITIVE_INFINITY,
  renderLabel,
  className,
}: SortableTreeProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const items = value ?? uncontrolled
  const all = flatten(items)
  const [drag, setDrag] = useState<SortableTreeDrag | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const helpId = useId()
  const announce = useAnnounce()

  const commit = (next: SortableTreeItem[]) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const rows = visible(all, drag?.activeId ?? null)
  const projection = drag ? project(rows, drag, maxDepth) : null
  const shown = projection ? projection.moved : rows
  const labelOf = (id: string | null) => all.find((row) => row.id === id)?.item.label
  const tabStop = shown.some((row) => row.id === focusedId) ? focusedId : shown[0]?.id

  const describe = (next: SortableTreeDrag) => {
    const place = project(visible(all, next.activeId), next, maxDepth)
    const parent = place.parentId ? `inside ${labelOf(place.parentId)}` : 'at the top level'
    return `position ${place.index + 1} of ${place.moved.length}, ${parent}`
  }

  const drop = (current: SortableTreeDrag) => {
    const place = project(visible(all, current.activeId), current, maxDepth)
    const from = all.findIndex((row) => row.id === current.activeId)
    const to = all.findIndex((row) => row.id === current.overId)
    const updated = all.map((row) => (row.id === current.activeId ? { ...row, parentId: place.parentId, depth: place.depth } : row))
    // Descendants keep their parent id, so they follow the item wherever it lands in the order.
    commit(build(move(updated, from, to)))
    setDrag(null)
    announce(`Dropped ${labelOf(current.activeId)}, ${describe(current)}.`)
  }

  const focusRow = (id: string | undefined) => {
    if (!id) return
    setFocusedId(id)
    rowRefs.current.get(id)?.focus()
  }

  const toggle = (row: SortableTreeRow, collapsed: boolean) => {
    if (!row.item.children?.length) return
    commit(build(all.map((entry) => (entry.id === row.id ? { ...entry, item: { ...entry.item, collapsed } } : entry))))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: SortableTreeRow) => {
    const index = shown.findIndex((entry) => entry.id === row.id)
    if (drag && !drag.pointer) {
      const place = project(rows, drag, maxDepth)
      let next: SortableTreeDrag | null = null
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const overIndex = rows.findIndex((entry) => entry.id === drag.overId) + (event.key === 'ArrowDown' ? 1 : -1)
        if (overIndex >= 0 && overIndex < rows.length) next = { ...drag, overId: rows[overIndex]!.id, depth: place.depth }
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        next = { ...drag, depth: place.depth + (event.key === 'ArrowRight' ? 1 : -1) }
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        drop(drag)
        return
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setDrag(null)
        announce(`Cancelled. ${labelOf(drag.activeId)} is back where it was.`)
        return
      } else if (event.key === 'Tab') {
        setDrag(null)
        return
      }
      if (!next) return
      event.preventDefault()
      setDrag(next)
      announce(`${labelOf(drag.activeId)}, ${describe(next)}.`)
      return
    }

    const children = row.item.children?.length ?? 0
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(shown[index + 1]?.id),
      ArrowUp: () => focusRow(shown[index - 1]?.id),
      Home: () => focusRow(shown[0]?.id),
      End: () => focusRow(shown[shown.length - 1]?.id),
      ArrowRight: () => {
        if (children && row.item.collapsed) toggle(row, false)
        else if (children) focusRow(shown[index + 1]?.id)
      },
      ArrowLeft: () => {
        if (children && !row.item.collapsed) toggle(row, true)
        else focusRow(row.parentId ?? undefined)
      },
      ' ': () => {
        const start = { activeId: row.id, overId: row.id, depth: row.depth, pointer: false }
        setDrag(start)
        const carried = children ? ` with ${children} item${children === 1 ? '' : 's'} inside` : ''
        announce(
          `Picked up ${row.item.label}${carried}, ${describe(start)}. Up and down to move, right and left to change level, Space to drop, Escape to cancel.`,
        )
      },
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  // The pointer is followed on the window rather than captured: the dragged row is moved in the DOM as the order
  // changes, and a moved element can lose its capture mid-drag.
  const onPointerDown = (event: PointerEvent<HTMLSpanElement>, row: SortableTreeRow) => {
    if (event.button !== 0) return
    event.preventDefault()
    const rowHeight = rowRefs.current.get(row.id)?.offsetHeight || 36
    const list = visible(all, row.id)
    const startIndex = list.findIndex((entry) => entry.id === row.id)
    const origin = { x: event.clientX, y: event.clientY }
    let current: SortableTreeDrag = { activeId: row.id, overId: row.id, depth: row.depth, pointer: true }
    setFocusedId(row.id)
    rowRefs.current.get(row.id)?.focus({ preventScroll: true })
    setDrag(current)

    const onMove = (move: globalThis.PointerEvent) => {
      const overIndex = Math.max(0, Math.min(list.length - 1, startIndex + Math.round((move.clientY - origin.y) / rowHeight)))
      const depth = row.depth + Math.round((move.clientX - origin.x) / indentation)
      const overId = list[overIndex]!.id
      if (overId === current.overId && depth === current.depth) return
      current = { ...current, overId, depth }
      setDrag(current)
    }
    const stop = (end: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (end.type === 'pointerup') drop(current)
      else setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  // Reordering moves the focused row in the DOM, which blurs it; put focus back on the item being carried.
  useEffect(() => {
    if (drag && !drag.pointer) rowRefs.current.get(drag.activeId)?.focus({ preventScroll: true })
  }, [drag])

  return (
    <div className={className}>
    <div
      role="tree"
      aria-label={label}
      aria-describedby={helpId}
      className="flex flex-col gap-0.5 rounded-[var(--radius-card)] border border-line bg-surface p-1.5"
    >
      {shown.map((row) => {
        const active = drag?.activeId === row.id
        const depth = active && projection ? projection.depth : row.depth
        const siblings = all.filter((entry) => entry.parentId === row.parentId)
        const children = row.item.children?.length ?? 0
        const carried = active ? all.filter((entry) => entry !== row && isDescendant(all, entry, row.id)).length : 0
        return (
          <div
            key={row.id}
            ref={(node) => {
              if (node) rowRefs.current.set(row.id, node)
              else rowRefs.current.delete(row.id)
            }}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-expanded={children ? !row.item.collapsed : undefined}
            aria-setsize={siblings.length}
            aria-posinset={siblings.indexOf(all.find((entry) => entry.id === row.id)!) + 1}
            tabIndex={row.id === tabStop ? 0 : -1}
            onFocus={() => setFocusedId(row.id)}
            onKeyDown={(event) => onKeyDown(event, row)}
            onBlur={(event) => {
              // A blur with nowhere to go is the row being moved in the DOM, not the reader leaving.
              const next = event.relatedTarget as Node | null
              if (drag && !drag.pointer && next && !event.currentTarget.parentElement?.contains(next)) setDrag(null)
            }}
            style={{ paddingLeft: 4 + depth * indentation }}
            className={cn(
              'flex h-9 select-none items-center gap-1 rounded-[10px] pr-2 text-[13px] font-semibold text-ink outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
              active
                ? 'bg-[color-mix(in_oklab,var(--color-accent)_22%,var(--color-surface))] shadow-[var(--shadow-float)]'
                : 'hover:bg-surface-muted',
              drag && !active && 'motion-safe:transition-[padding] motion-safe:duration-150',
            )}
          >
            <span
              aria-hidden="true"
              onPointerDown={(event) => onPointerDown(event, row)}
              className={cn('inline-flex size-6 touch-none items-center justify-center rounded-md text-ink-faint', active ? 'cursor-grabbing' : 'cursor-grab hover:text-ink')}
            >
              {GRIP}
            </span>
            <span
              aria-hidden="true"
              onClick={() => toggle(row, !row.item.collapsed)}
              className={cn('inline-flex size-5 items-center justify-center text-ink-faint', children ? 'cursor-pointer hover:text-ink' : 'invisible')}
            >
              <ChevronRightIcon size={12} className={cn('motion-safe:transition-transform', !row.item.collapsed && 'rotate-90')} />
            </span>
            <span className="min-w-0 flex-1 truncate">{renderLabel ? renderLabel(row.item) : row.item.label}</span>
            {carried > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink">+{carried}</span>
            )}
          </div>
        )
      })}
    </div>
    <VisuallyHidden>
      <span id={helpId}>Press Space to pick an item up, arrows to move it or change its level, Space to drop, Escape to cancel.</span>
    </VisuallyHidden>
    </div>
  )
}

function isDescendant(rows: SortableTreeRow[], row: SortableTreeRow, ancestorId: string): boolean {
  let parentId = row.parentId
  while (parentId) {
    if (parentId === ancestorId) return true
    parentId = rows.find((entry) => entry.id === parentId)?.parentId ?? null
  }
  return false
}
