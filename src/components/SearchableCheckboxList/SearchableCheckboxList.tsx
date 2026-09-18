'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Checkbox } from '../Checkbox'
import { Input } from '../Input'
import { Switch } from '../Switch'
import { SearchIcon } from '../internal/icons'

export interface SearchableCheckboxListItem {
  id: string
  label: string
  /** Secondary text on the same row. Searched by the filter too. */
  description?: string
  /** Shown but cannot be ticked or unticked. */
  disabled?: boolean
}

export interface SearchableCheckboxListProps {
  /** Every option. Thousands are fine: only the rows in view are rendered. */
  items: SearchableCheckboxListItem[]
  /** Controlled ticked ids. */
  value?: string[]
  /** Starting ticked ids when uncontrolled. */
  defaultValue?: string[]
  /** Called with the ticked ids, in item order, after every change. */
  onValueChange?: (value: string[]) => void
  /** Names the list and its filter, such as “Countries”. */
  label: string
  /** Placeholder of the filter field. */
  placeholder?: string
  /** Height of the scrolling list, in pixels. */
  height?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const ROW = 36
const OVERSCAN = 8

/**
 * A long list of checkboxes with a filter, for picking many from hundreds —
 * countries, tags, repositories, recipients.
 *
 * “Select all” means all that are *shown*: filter to “united” and it ticks the
 * matches, not the whole world, and its mixed state describes the same set. The
 * selected count always counts everything, and “Show selected only” answers the
 * question every long checklist raises — what did I tick?
 *
 * Rows are real checkboxes, so Space and screen readers behave as they always
 * do; only those in view (plus a margin) exist in the DOM, which is what keeps
 * a few thousand options instant. Arrow keys move between rows and scroll the
 * next one into existence before focusing it.
 */
export function SearchableCheckboxList({
  items,
  value,
  defaultValue = [],
  onValueChange,
  label,
  placeholder = 'Filter',
  height = 280,
  disabled = false,
  className,
}: SearchableCheckboxListProps) {
  const uid = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const focusNext = useRef<number | null>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const chosen = useMemo(() => new Set(value ?? uncontrolled), [value, uncontrolled])

  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (!selectedOnly || chosen.has(item.id)) &&
          (!needle || `${item.label} ${item.description ?? ''}`.toLowerCase().includes(needle)),
      ),
    [items, needle, selectedOnly, chosen],
  )
  const enabled = visible.filter((item) => !item.disabled)
  const tickedHere = enabled.filter((item) => chosen.has(item.id)).length
  const allState = tickedHere === 0 ? false : tickedHere === enabled.length ? true : 'mixed'

  const commit = (next: Set<string>) => {
    const ordered = items.filter((item) => next.has(item.id)).map((item) => item.id)
    if (value === undefined) setUncontrolled(ordered)
    onValueChange?.(ordered)
  }
  const toggle = (id: string, on: boolean) => {
    const next = new Set(chosen)
    if (on) next.add(id)
    else next.delete(id)
    commit(next)
  }
  const toggleAll = () => {
    const next = new Set(chosen)
    enabled.forEach((item) => (allState === true ? next.delete(item.id) : next.add(item.id)))
    commit(next)
  }

  // A new filter starts at the top of its results.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
    setScrollTop(0)
  }, [needle, selectedOnly])

  useEffect(() => {
    if (focusNext.current === null) return
    scroller.current?.querySelector<HTMLInputElement>(`[data-row="${focusNext.current}"] input`)?.focus()
    focusNext.current = null
  })

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN)
  const last = Math.min(visible.length, Math.ceil((scrollTop + height) / ROW) + OVERSCAN)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = Number((event.target as HTMLElement).closest<HTMLElement>('[data-row]')?.dataset.row)
    if (Number.isNaN(row)) return
    const moves: Record<string, number> = { ArrowDown: row + 1, ArrowUp: row - 1, Home: 0, End: visible.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const target = Math.max(0, Math.min(visible.length - 1, moves[event.key]))
    const node = scroller.current
    if (node) {
      const top = target * ROW
      if (top < node.scrollTop) node.scrollTop = top
      else if (top + ROW > node.scrollTop + height) node.scrollTop = top + ROW - height
      const rendered = node.querySelector<HTMLInputElement>(`[data-row="${target}"] input`)
      if (rendered) rendered.focus()
      else focusNext.current = target
      setScrollTop(node.scrollTop)
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={`${uid}-label`}
      className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface', disabled && 'opacity-50', className)}
    >
      <div className="flex flex-col gap-2.5 border-b border-line p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span id={`${uid}-label`} className="text-[13px] font-bold text-ink">
            {label}
          </span>
          <span aria-live="polite" className="text-[12px] font-medium text-ink-faint tabular-nums">
            {chosen.size.toLocaleString()} selected
          </span>
        </div>
        <Input
          type="search"
          inputSize="sm"
          aria-label={`Filter ${label}`}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<SearchIcon size={14} />}
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink">
            <Checkbox
              boxSize="sm"
              checked={allState === true}
              indeterminate={allState === 'mixed'}
              disabled={disabled || enabled.length === 0}
              onChange={toggleAll}
            />
            {needle || selectedOnly ? `Select all ${enabled.length.toLocaleString()} shown` : 'Select all'}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink-soft">
            <Switch switchSize="sm" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} disabled={disabled} />
            Show selected only
          </label>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onKeyDown={onKeyDown}
        className="relative overflow-y-auto"
        style={{ height }}
      >
        <ul aria-labelledby={`${uid}-label`} className="relative" style={{ height: visible.length * ROW }}>
          {visible.slice(first, last).map((item, offset) => {
            const index = first + offset
            return (
              <li
                key={item.id}
                data-row={index}
                aria-setsize={visible.length}
                aria-posinset={index + 1}
                className="absolute inset-x-0 px-1.5"
                style={{ top: index * ROW, height: ROW }}
              >
                <label
                  className={cn(
                    'flex h-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-10)] px-2 hover:bg-surface-sunken',
                    item.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Checkbox
                    boxSize="sm"
                    checked={chosen.has(item.id)}
                    disabled={disabled || item.disabled}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                  />
                  <span className="min-w-0 truncate text-[13px] font-medium text-ink">{item.label}</span>
                  {item.description && <span className="ml-auto shrink-0 text-[12px] font-medium text-ink-faint">{item.description}</span>}
                </label>
              </li>
            )
          })}
        </ul>
        {visible.length === 0 && (
          <p className="absolute inset-x-0 top-8 text-center text-[12px] font-medium text-ink-faint">
            {selectedOnly && chosen.size === 0 ? 'Nothing selected yet' : 'No matches'}
          </p>
        )}
      </div>
    </div>
  )
}
