'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { SearchIcon } from '../internal/icons'
import { fuzzyScore, type FuzzyFinderMatch } from './fuzzy'

export interface FuzzyFinderItem {
  id: string
  /** The text that is searched and highlighted — a path, a name. */
  label: string
  /** A quieter second line. Not searched. */
  detail?: string
}

export interface FuzzyFinderProps {
  /** Everything that can be found. Ten thousand is fine: scoring runs in slices between frames. */
  items: FuzzyFinderItem[]
  /** Accessible name of the search field. */
  label: string
  placeholder?: string
  /** Called with the chosen item — Enter, or a click. */
  onSelect?: (item: FuzzyFinderItem) => void
  /** Keep at most this many ranked results. */
  limit?: number
  /** Height of the result list, in pixels. */
  height?: number
  /** Height of one result row, in pixels. Rows are virtualised, so this must be exact. */
  rowHeight?: number
  /** Merged last, so it wins. */
  className?: string
}

interface Result {
  item: FuzzyFinderItem
  match: FuzzyFinderMatch | null
}

const SLICE = 1500

function highlight(text: string, indices: number[] | undefined): ReactNode {
  if (!indices?.length) return text
  const marks = new Set(indices)
  const parts: ReactNode[] = []
  let run = ''
  let on = false
  const flush = (key: number) => {
    if (!run) return
    parts.push(on ? <mark key={key} className="rounded-[var(--radius-4)] bg-transparent font-bold text-accent-strong underline decoration-2 underline-offset-2">{run}</mark> : run)
    run = ''
  }
  for (let i = 0; i < text.length; i++) {
    if (marks.has(i) !== on) {
      flush(i)
      on = !on
    }
    run += text[i]
  }
  flush(text.length)
  return parts
}

/**
 * A search box that forgives: type the letters you remember, in order, and
 * the best candidates rise — "usrst" finds `useUrlState`, "cmpbtn" finds
 * `components/Button`.
 *
 * Scoring is fzf’s: word starts, camelCase humps and path separators earn
 * bonuses, runs earn more, gaps cost, and a dynamic program places each
 * character where the total is best, which is also what gets highlighted.
 * Large lists are scored in slices so typing never stalls, a query that
 * extends the last one only rescans the last matches, and the list is
 * virtualised so ten thousand rows cost what twenty do.
 */
export function FuzzyFinder({
  items,
  label,
  placeholder = 'Search',
  onSelect,
  limit = 1000,
  height = 320,
  rowHeight = 40,
  className,
}: FuzzyFinderProps) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>(() => items.map((item) => ({ item, match: null })))
  const [busy, setBusy] = useState(false)
  const [total, setTotal] = useState(0)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [rawActive, setActive] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const previous = useRef<{ query: string; items: FuzzyFinderItem[]; pool: FuzzyFinderItem[] } | null>(null)

  useEffect(() => {
    const needle = query.trim()
    if (!needle) {
      setResults(items.map((item) => ({ item, match: null })))
      setBusy(false)
      setElapsed(null)
      previous.current = null
      return
    }
    // A query that only adds characters can only lose matches, so scan the last pool.
    const last = previous.current
    const pool = last && last.items === items && needle.startsWith(last.query) ? last.pool : items
    const found: { item: FuzzyFinderItem; match: FuzzyFinderMatch; order: number }[] = []
    const started = performance.now()
    let index = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    setBusy(true)
    const step = () => {
      const end = Math.min(pool.length, index + SLICE)
      for (; index < end; index++) {
        const match = fuzzyScore(needle, pool[index].label)
        if (match) found.push({ item: pool[index], match, order: index })
      }
      if (cancelled) return
      if (index < pool.length) {
        timer = setTimeout(step, 0)
        return
      }
      found.sort((a, b) => b.match.score - a.match.score || a.item.label.length - b.item.label.length || a.order - b.order)
      previous.current = { query: needle, items, pool: found.map((entry) => entry.item) }
      setResults(found.slice(0, limit))
      setTotal(found.length)
      setBusy(false)
      setElapsed(Math.round(performance.now() - started))
      setActive(0)
      if (listRef.current) listRef.current.scrollTop = 0
    }
    step()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, items, limit])

  const active = results.length === 0 ? -1 : Math.min(rawActive, results.length - 1)

  const move = (index: number) => {
    if (results.length === 0) return
    const next = Math.max(0, Math.min(results.length - 1, index))
    setActive(next)
    const list = listRef.current
    if (!list) return
    const top = next * rowHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (top + rowHeight > list.scrollTop + height) list.scrollTop = top + rowHeight - height
  }

  const page = Math.max(1, Math.floor(height / rowHeight) - 1)
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active + 1),
      ArrowUp: () => move(active - 1),
      PageDown: () => move(active + page),
      PageUp: () => move(active - page),
      Enter: () => active >= 0 && onSelect?.(results[active].item),
      Escape: () => setQuery(''),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
  const lastRow = Math.min(results.length, Math.ceil((scrollTop + height) / rowHeight) + 4)
  const windowed = useMemo(() => results.slice(first, lastRow), [results, first, lastRow])
  const optionId = (index: number) => `${uid}-option-${index}`
  const summary = query.trim()
    ? busy
      ? 'Searching…'
      : `${total.toLocaleString()} ${total === 1 ? 'match' : 'matches'} of ${items.length.toLocaleString()}${total > results.length ? `, best ${results.length.toLocaleString()} shown` : ''}`
    : `${items.length.toLocaleString()} items`

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded="true"
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        leading={<SearchIcon size={14} />}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="flex items-center justify-between px-1 text-[11px] font-medium text-ink-faint">
        <span role="status">{summary}</span>
        {elapsed !== null && !busy && <span className="tabular-nums">{elapsed} ms</span>}
      </div>
      <div className="relative">
        <div
          ref={listRef}
          id={`${uid}-list`}
          role="listbox"
          aria-label={`${label} results`}
          aria-busy={busy || undefined}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ height }}
          className="relative overflow-y-auto rounded-[var(--radius-tile)] border border-line bg-surface"
        >
          <div style={{ height: results.length * rowHeight }} className="relative">
            {windowed.map(({ item, match }, offset) => {
              const index = first + offset
              return (
                <div
                  key={item.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  aria-setsize={results.length}
                  aria-posinset={index + 1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setActive(index)
                    onSelect?.(item)
                  }}
                  style={{ top: index * rowHeight, height: rowHeight }}
                  className={cn(
                    'absolute inset-x-1 flex cursor-pointer flex-col justify-center rounded-[var(--radius-8)] px-2.5',
                    index === active ? 'bg-accent-soft' : 'hover:bg-surface-muted',
                  )}
                >
                  <span className="truncate font-mono text-[12px] text-ink">{highlight(item.label, match?.indices)}</span>
                  {item.detail && <span className="truncate text-[11px] font-medium text-ink-faint">{item.detail}</span>}
                </div>
              )
            })}
          </div>
        </div>
        {results.length === 0 && !busy && (
          <p className="pointer-events-none absolute inset-x-0 top-8 text-center text-[12px] font-medium text-ink-faint">Nothing matches “{query.trim()}”</p>
        )}
      </div>
    </div>
  )
}
