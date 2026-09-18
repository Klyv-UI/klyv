'use client'

import { createContext, useContext, useId, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { IconButton } from '../IconButton'
import { Menu, type MenuItem } from '../Menu'
import {
  activateDockTab,
  closeDockTab,
  dockGroups,
  dockTab,
  resizeDockSplit,
  type DockLayoutGroup,
  type DockLayoutNode,
  type DockLayoutSplit,
  type DockLayoutZone,
} from './layout'

export interface DockLayoutPanel {
  /** Tab label. */
  title: string
  content: ReactNode
  /** Show a close control and allow Delete on the tab. Defaults to true. */
  closable?: boolean
}

export interface DockLayoutProps {
  /** Every panel that can appear, by id. The layout refers to them by these ids. */
  panels: Record<string, DockLayoutPanel>
  /** Controlled layout tree. */
  value?: DockLayoutNode
  /** Starting layout when uncontrolled. */
  defaultValue?: DockLayoutNode
  /** Called with the new tree after every move, resize, close or tab switch. */
  onValueChange?: (layout: DockLayoutNode) => void
  /** Accessible name for the whole workspace. */
  label?: string
  /** Height of the workspace, in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const MoreIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="12.5" cy="8" r="1.4" />
  </svg>
)

interface Dock {
  panels: Record<string, DockLayoutPanel>
  layout: DockLayoutNode
  set: (next: DockLayoutNode) => void
  dragging: string | null
  setDragging: (tab: string | null) => void
  uid: string
}
const DockContext = createContext<Dock | null>(null)

const titleOf = (dock: Dock, tab: string) => dock.panels[tab]?.title ?? tab

function zoneAt(event: DragEvent, element: HTMLElement): DockLayoutZone {
  const rect = element.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  const edges: [DockLayoutZone, number][] = [
    ['left', x],
    ['right', 1 - x],
    ['top', y],
    ['bottom', 1 - y],
  ]
  const [zone, distance] = edges.sort((a, b) => a[1] - b[1])[0]
  return distance < 0.25 ? zone : 'center'
}

const ZONE_BOX: Record<DockLayoutZone, string> = {
  center: 'inset-2',
  left: 'inset-y-2 left-2 w-[calc(50%-8px)]',
  right: 'inset-y-2 right-2 w-[calc(50%-8px)]',
  top: 'inset-x-2 top-2 h-[calc(50%-8px)]',
  bottom: 'inset-x-2 bottom-2 h-[calc(50%-8px)]',
}

function Group({ group }: { group: DockLayoutGroup }) {
  const dock = useContext(DockContext)!
  const [hover, setHover] = useState<DockLayoutZone | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const tabRefs = useRef<(HTMLElement | null)[]>([])
  const all = dockGroups(dock.layout)
  const number = all.findIndex((candidate) => candidate.id === group.id) + 1
  const active = group.active
  const tabId = (tab: string) => `${dock.uid}-${group.id}-${tab}-tab`
  const panelId = `${dock.uid}-${group.id}-panel`

  const close = (tab: string) => {
    if (dock.panels[tab]?.closable === false) return
    dock.set(closeDockTab(dock.layout, tab))
  }

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const count = group.tabs.length
    const go = (next: number) => {
      const target = (next + count) % count
      dock.set(activateDockTab(dock.layout, group.id, group.tabs[target]))
      tabRefs.current[target]?.focus()
    }
    const keys: Record<string, () => void> = {
      ArrowRight: () => go(index + 1),
      ArrowLeft: () => go(index - 1),
      Home: () => go(0),
      End: () => go(count - 1),
      Delete: () => close(group.tabs[index]),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!dock.dragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const zone = zoneAt(event, event.currentTarget)
    if (zone !== hover) setHover(zone)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const tab = dock.dragging ?? event.dataTransfer.getData('text/plain')
    setHover(null)
    dock.setDragging(null)
    if (tab && dock.panels[tab]) dock.set(dockTab(dock.layout, tab, group.id, zoneAt(event, event.currentTarget)))
  }

  const others = all.filter((candidate) => candidate.id !== group.id)
  const actions: (MenuItem | 'separator')[] = active
    ? [
        ...others.map((other) => ({
          id: `move-${other.id}`,
          label: `Move to group ${all.indexOf(other) + 1} (${titleOf(dock, other.active)})`,
          onSelect: () => dock.set(dockTab(dock.layout, active, other.id, 'center')),
        })),
        { id: 'split-right', label: 'Split right', disabled: group.tabs.length < 2, onSelect: () => dock.set(dockTab(dock.layout, active, group.id, 'right')) },
        { id: 'split-down', label: 'Split down', disabled: group.tabs.length < 2, onSelect: () => dock.set(dockTab(dock.layout, active, group.id, 'bottom')) },
        'separator',
        { id: 'close', label: `Close ${titleOf(dock, active)}`, destructive: true, disabled: dock.panels[active]?.closable === false, onSelect: () => close(active) },
      ]
    : []

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface"
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null)
      }}
      onDrop={onDrop}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-surface-sunken pr-1">
        <div role="tablist" aria-label={`Group ${number}`} className="flex min-w-0 flex-1 overflow-x-auto">
          {group.tabs.map((tab, index) => {
            const selected = tab === active
            const closable = dock.panels[tab]?.closable !== false
            return (
              <div
                key={tab}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                id={tabId(tab)}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', tab)
                  event.dataTransfer.effectAllowed = 'move'
                  dock.setDragging(tab)
                }}
                onDragEnd={() => dock.setDragging(null)}
                onClick={() => dock.set(activateDockTab(dock.layout, group.id, tab))}
                onKeyDown={(event) => onTabKey(event, index)}
                className={cn(
                  'group/tab flex h-9 shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-line pl-3 pr-1.5 text-[12px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong',
                  selected ? 'bg-surface text-ink' : 'text-ink-faint hover:text-ink',
                  dock.dragging === tab && 'opacity-50',
                )}
              >
                <span className="truncate">{titleOf(dock, tab)}</span>
                {closable && (
                  // Pointer-only: keyboard users close with Delete or the group menu,
                  // and a button inside a tab would be an invalid child of the tablist.
                  <span
                    aria-hidden="true"
                    title={`Close ${titleOf(dock, tab)}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      close(tab)
                    }}
                    className={cn('flex size-5 items-center justify-center rounded-[var(--radius-5)] text-ink-faint hover:bg-surface-muted hover:text-ink', !selected && 'opacity-0 group-hover/tab:opacity-100')}
                  >
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {active && (
          <Menu
            label={`Actions for ${titleOf(dock, active)}`}
            items={actions}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            align="end"
            trigger={<IconButton icon={MoreIcon} label={`Actions for ${titleOf(dock, active)}`} size="xs" />}
          />
        )}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={active ? tabId(active) : undefined} aria-label={active ? undefined : 'Empty group'} tabIndex={0} className="min-h-0 flex-1 overflow-auto outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong">
        {active ? dock.panels[active]?.content : <p className="p-4 text-[12px] font-medium text-ink-faint">No open panels.</p>}
      </div>
      {hover && (
        <div aria-hidden="true" className={cn('pointer-events-none absolute rounded-[var(--radius-8)] border-2 border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)]', ZONE_BOX[hover])} />
      )}
    </div>
  )
}

function Split({ split }: { split: DockLayoutSplit }) {
  const dock = useContext(DockContext)!
  const ref = useRef<HTMLDivElement>(null)
  const row = split.direction === 'row'
  const step = (delta: number) => dock.set(resizeDockSplit(dock.layout, split.id, split.ratio + delta))
  const name = (node: DockLayoutNode) => titleOf(dock, dockGroups(node)[0]?.active ?? '')

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = row
      ? { ArrowLeft: () => step(-0.05), ArrowRight: () => step(0.05) }
      : { ArrowUp: () => step(-0.05), ArrowDown: () => step(0.05) }
    keys.Home = () => dock.set(resizeDockSplit(dock.layout, split.id, 0.1))
    keys.End = () => dock.set(resizeDockSplit(dock.layout, split.id, 0.9))
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    event.currentTarget.setPointerCapture(event.pointerId)
    let layout = dock.layout
    const move = (next: globalThis.PointerEvent) => {
      const ratio = row ? (next.clientX - box.left) / box.width : (next.clientY - box.top) / box.height
      layout = resizeDockSplit(layout, split.id, ratio)
      dock.set(layout)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div ref={ref} className={cn('flex h-full min-h-0 w-full min-w-0 flex-1', row ? 'flex-row' : 'flex-col')}>
      <div className="flex min-h-0 min-w-0" style={{ flex: `0 0 calc(${split.ratio * 100}% - 3px)` }}>
        <Node node={split.children[0]} />
      </div>
      <div
        role="separator"
        aria-orientation={row ? 'vertical' : 'horizontal'}
        aria-label={`Resize ${name(split.children[0])} and ${name(split.children[1])}`}
        aria-valuenow={Math.round(split.ratio * 100)}
        aria-valuemin={10}
        aria-valuemax={90}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        className={cn(
          'group/sep relative flex shrink-0 touch-none items-center justify-center outline-none',
          row ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
        )}
      >
        <span className={cn('rounded-full bg-line transition-colors group-hover/sep:bg-accent-strong group-focus-visible/sep:bg-accent-strong', row ? 'h-8 w-0.5' : 'h-0.5 w-8')} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <Node node={split.children[1]} />
      </div>
    </div>
  )
}

function Node({ node }: { node: DockLayoutNode }) {
  return node.type === 'group' ? <Group group={node} /> : <Split split={node} />
}

/**
 * An IDE-style workspace: panels in tab groups, groups in resizable splits,
 * and tabs that can be dragged anywhere.
 *
 * Fixed layouts decide for the reader which two things they will want side by
 * side. This lets them decide: drop a tab in the middle of a group to join it,
 * or on an edge to split that group in two; a group left empty closes and its
 * neighbour takes the room. The layout is a plain tree — controlled, so it can
 * be saved and restored — and everything the pointer does has a keyboard
 * path: arrows move between tabs, Delete closes one, the group menu moves or
 * splits it, and the dividers resize with the arrow keys.
 */
export function DockLayout({ panels, value, defaultValue, onValueChange, label = 'Workspace', height = 420, className }: DockLayoutProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState<DockLayoutNode>(
    () => defaultValue ?? { type: 'group', id: 'group-root', tabs: Object.keys(panels), active: Object.keys(panels)[0] ?? '' },
  )
  const [dragging, setDragging] = useState<string | null>(null)
  const layout = value ?? uncontrolled
  const set = (next: DockLayoutNode) => {
    if (next === layout) return
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  return (
    <DockContext.Provider value={{ panels, layout, set, dragging, setDragging, uid }}>
      <div role="region" aria-label={label} style={{ height }} className={cn('flex w-full min-w-0 rounded-[var(--radius-card)] bg-surface-sunken p-1.5', className)}>
        <Node node={layout} />
      </div>
    </DockContext.Provider>
  )
}
