'use client'

import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { SearchIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface TransferListItem {
  id: string
  label: string
  /** Secondary line under the label. Searched by the filter too. */
  description?: string
  /** Shown but cannot be marked or moved. */
  disabled?: boolean
}

export interface TransferListProps {
  /** Every item, in the order the lists show them. */
  items: TransferListItem[]
  /** Controlled ids in the selected list. */
  value?: string[]
  /** Starting ids when uncontrolled. */
  defaultValue?: string[]
  /** Called with the selected ids, in item order, after every move. */
  onValueChange?: (value: string[]) => void
  /** Heading of the left list. */
  availableLabel?: string
  /** Heading of the right list. */
  selectedLabel?: string
  /** Show a filter field above each list. */
  filterable?: boolean
  /** Height of each list body, in pixels. */
  listHeight?: number
  /** Merged last, so it wins. */
  className?: string
}

const glyph = (d: string): IconComponent =>
  function Glyph({ size = 16 }) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    )
  }
const RIGHT = glyph('M6 3.5L10.5 8 6 12.5')
const LEFT = glyph('M10 3.5L5.5 8l4.5 4.5')
const ALL_RIGHT = glyph('M3.5 3.5L8 8l-4.5 4.5M8.5 3.5L13 8l-4.5 4.5')
const ALL_LEFT = glyph('M12.5 3.5L8 8l4.5 4.5M7.5 3.5L3 8l4.5 4.5')

/**
 * Two lists and the buttons between them, for choosing a subset of a long set
 * where the order and the leftovers both matter — the columns in an export, the
 * members of a group.
 *
 * Each list is a multi-select listbox with one tab stop: arrows move, Space
 * marks, Shift extends the mark, Ctrl+A marks everything visible, Enter moves.
 * The filter narrows what is visible without unmarking anything, and every move
 * is announced with the new counts, since the change happens in the other list.
 */
export function TransferList({
  items,
  value,
  defaultValue = [],
  onValueChange,
  availableLabel = 'Available',
  selectedLabel = 'Selected',
  filterable = true,
  listHeight = 240,
  className,
}: TransferListProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selected = new Set(value ?? uncontrolled)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState('')

  const left = items.filter((item) => !selected.has(item.id))
  const right = items.filter((item) => selected.has(item.id))

  const move = (ids: string[], toSelected: boolean) => {
    const movable = ids.filter((id) => !items.find((item) => item.id === id)?.disabled)
    if (movable.length === 0) return
    const next = new Set(selected)
    movable.forEach((id) => (toSelected ? next.add(id) : next.delete(id)))
    const ordered = items.filter((item) => next.has(item.id)).map((item) => item.id)
    if (value === undefined) setUncontrolled(ordered)
    onValueChange?.(ordered)
    setMarked((current) => new Set([...current].filter((id) => !movable.includes(id))))
    const noun = movable.length === 1 ? 'item' : 'items'
    setAnnouncement(
      `${movable.length} ${noun} moved to ${toSelected ? selectedLabel : availableLabel}. ${ordered.length} selected, ${items.length - ordered.length} available.`,
    )
  }

  const markedIn = (list: TransferListItem[]) => list.filter((item) => marked.has(item.id)).map((item) => item.id)
  const enabled = (list: TransferListItem[]) => list.filter((item) => !item.disabled).map((item) => item.id)

  const buttons: { icon: IconComponent; label: string; ids: string[]; to: boolean }[] = [
    { icon: ALL_RIGHT, label: `Move all to ${selectedLabel}`, ids: enabled(left), to: true },
    { icon: RIGHT, label: `Move marked to ${selectedLabel}`, ids: markedIn(left), to: true },
    { icon: LEFT, label: `Move marked to ${availableLabel}`, ids: markedIn(right), to: false },
    { icon: ALL_LEFT, label: `Move all to ${availableLabel}`, ids: enabled(right), to: false },
  ]

  return (
    <div className={cn('flex w-full flex-col items-stretch gap-3 sm:flex-row', className)}>
      <Pane title={availableLabel} list={left} total={items.length} marked={marked} setMarked={setMarked} onMove={(ids) => move(ids, true)} filterable={filterable} height={listHeight} />
      <div className="flex shrink-0 justify-center gap-2 sm:flex-col">
        {buttons.map(({ icon: Icon, label, ids, to }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            disabled={ids.length === 0}
            onClick={() => move(ids, to)}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow-tile)] transition-colors hover:border-line-strong disabled:pointer-events-none disabled:opacity-40 max-sm:rotate-90"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <Pane title={selectedLabel} list={right} total={items.length} marked={marked} setMarked={setMarked} onMove={(ids) => move(ids, false)} filterable={filterable} height={listHeight} />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

interface PaneProps {
  title: string
  list: TransferListItem[]
  total: number
  marked: Set<string>
  setMarked: (update: (current: Set<string>) => Set<string>) => void
  onMove: (ids: string[]) => void
  filterable: boolean
  height: number
}

function Pane({ title, list, total, marked, setMarked, onMove, filterable, height }: PaneProps) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [rawActive, setActive] = useState(0)
  const anchor = useRef(0)
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? list.filter((item) => `${item.label} ${item.description ?? ''}`.toLowerCase().includes(needle))
    : list
  const active = Math.min(rawActive, visible.length - 1)
  const markedHere = list.filter((item) => marked.has(item.id)).length

  const setMarks = (ids: string[], on: boolean, replace = false) =>
    setMarked((current) => {
      const next = new Set(replace ? [...current].filter((id) => !list.some((item) => item.id === id)) : current)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const range = (from: number, to: number) =>
    visible.slice(Math.min(from, to), Math.max(from, to) + 1).filter((item) => !item.disabled).map((item) => item.id)

  const focusRow = (index: number, extend: boolean) => {
    const next = Math.max(0, Math.min(index, visible.length - 1))
    setActive(next)
    document.getElementById(`${uid}-${next}`)?.scrollIntoView?.({ block: 'nearest' })
    if (extend) setMarks(range(anchor.current, next), true, true)
    else anchor.current = next
  }

  const toggle = (index: number) => {
    const item = visible[index]
    if (!item || item.disabled) return
    setMarks([item.id], !marked.has(item.id))
    anchor.current = index
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(active + 1, event.shiftKey),
      ArrowUp: () => focusRow(active - 1, event.shiftKey),
      Home: () => focusRow(0, event.shiftKey),
      End: () => focusRow(visible.length - 1, event.shiftKey),
      ' ': () => toggle(active),
      Enter: () => onMove(list.filter((item) => marked.has(item.id)).map((item) => item.id)),
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      setMarks(range(0, visible.length - 1), true)
      return
    }
    const handler = keys[event.key]
    if (!handler || visible.length === 0) return
    event.preventDefault()
    handler()
  }

  const onClick = (event: MouseEvent, index: number) => {
    setActive(index)
    if (event.shiftKey) setMarks(range(anchor.current, index), true, true)
    else toggle(index)
  }

  return (
    <div role="group" aria-labelledby={`${uid}-title`} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <span id={`${uid}-title`} className="text-[13px] font-bold text-ink">
          {title}
        </span>
        <span className="text-[12px] font-medium tabular-nums text-ink-faint">
          {markedHere > 0 ? `${markedHere} marked · ` : ''}
          {list.length}/{total}
        </span>
      </div>
      {filterable && (
        <div className="border-b border-line p-2">
          <Input inputSize="sm" type="search" aria-label={`Filter ${title}`} placeholder="Filter" value={query} onChange={(event) => setQuery(event.target.value)} leading={<SearchIcon size={14} />} />
        </div>
      )}
      <div className="relative">
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${uid}-title`}
          aria-activedescendant={active >= 0 ? `${uid}-${active}` : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          style={{ height }}
          className="group overflow-y-auto p-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong"
        >
          {visible.map((item, index) => {
            const on = marked.has(item.id)
            return (
              <div
                key={item.id}
                id={`${uid}-${index}`}
                role="option"
                aria-selected={on}
                aria-disabled={item.disabled || undefined}
                onClick={(event) => onClick(event, index)}
                onDoubleClick={() => onMove([item.id])}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-10)] px-2.5 py-1.5',
                  index === active && 'group-focus-visible:ring-1 group-focus-visible:ring-ink-faint',
                  on ? 'bg-accent-soft' : 'hover:bg-surface-sunken',
                  item.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                <span aria-hidden="true" className={cn('flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-5)] border', on ? 'border-accent-strong bg-accent-strong text-accent-ink' : 'border-line-strong')}>
                  {on && <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3.5 8.5l3 3 6-6.5" /></svg>}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold text-ink">{item.label}</span>
                  {item.description && <span className="truncate text-[12px] font-medium text-ink-faint">{item.description}</span>}
                </span>
              </div>
            )
          })}
        </div>
        {visible.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-[12px] font-medium text-ink-faint">
            {needle ? 'No matches' : 'Nothing here'}
          </p>
        )}
      </div>
    </div>
  )
}
