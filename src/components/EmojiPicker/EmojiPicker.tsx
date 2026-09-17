'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { SearchIcon } from '../internal/icons'
import {
  EMOJI_PICKER_CATEGORIES,
  EMOJI_PICKER_DATA,
  type EmojiPickerCategory,
  type EmojiPickerEmoji,
} from './emojiData'

export interface EmojiPickerProps {
  /** Called with the chosen emoji. The picker adds it to the recent row too. */
  onSelect: (emoji: EmojiPickerEmoji) => void
  /** Replace the built-in set. */
  emojis?: EmojiPickerEmoji[]
  /** Replace the built-in category tabs. */
  categories?: EmojiPickerCategory[]
  /** Controlled recent emoji characters, most recent first. */
  recent?: string[]
  /** Starting recent emoji when uncontrolled. */
  defaultRecent?: string[]
  /** Called with the new recent list after each pick. Persist it if you want it to survive a reload. */
  onRecentChange?: (recent: string[]) => void
  /** How many recent emoji to keep. */
  maxRecent?: number
  /** Cells per row; arrow keys move by this many vertically. */
  columns?: number
  /** Accessible name for the picker. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const RECENT: EmojiPickerCategory = { id: 'recent', label: 'Recent', icon: '🕘' }

/**
 * A searchable emoji grid for reactions and messages, with its own small data
 * set so a reaction bar does not pull in a megabyte of Unicode tables.
 *
 * Categories are tabs; the emoji are a grid with one tab stop, where arrows move
 * a cell or a row and Home and End go to the ends of a row. Search replaces the
 * tabs with a result count that is announced, and ArrowDown from the search
 * field goes straight into the results. Every cell is named ("fire"), so the
 * grid is usable without seeing the pictures.
 */
export function EmojiPicker({
  onSelect,
  emojis = EMOJI_PICKER_DATA,
  categories = EMOJI_PICKER_CATEGORIES,
  recent,
  defaultRecent = [],
  onRecentChange,
  maxRecent = 16,
  columns = 8,
  label = 'Emoji',
  className,
}: EmojiPickerProps) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [ownRecent, setOwnRecent] = useState(defaultRecent)
  const recentList = recent ?? ownRecent
  const tabs = recentList.length > 0 ? [RECENT, ...categories] : categories
  const [tab, setTab] = useState(tabs[0]?.id ?? '')
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : (tabs[0]?.id ?? '')
  const [rawCell, setCell] = useState(0)
  const [preview, setPreview] = useState<EmojiPickerEmoji | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? emojis.filter((e) => e.name.includes(needle) || e.keywords.some((word) => word.startsWith(needle)))
    : activeTab === RECENT.id
      ? recentList.map((char) => emojis.find((e) => e.emoji === char)).filter((e): e is EmojiPickerEmoji => Boolean(e))
      : emojis.filter((e) => e.category === activeTab)
  const cell = Math.max(0, Math.min(rawCell, shown.length - 1))

  const pick = (entry: EmojiPickerEmoji) => {
    const next = [entry.emoji, ...recentList.filter((char) => char !== entry.emoji)].slice(0, maxRecent)
    if (recent === undefined) setOwnRecent(next)
    onRecentChange?.(next)
    onSelect(entry)
  }

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(index, shown.length - 1))
    setCell(next)
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus()
  }

  const onGridKey = (event: KeyboardEvent) => {
    const col = cell % columns
    const moves: Record<string, number> = {
      ArrowRight: cell + 1,
      ArrowLeft: cell - 1,
      ArrowDown: cell + columns,
      ArrowUp: cell - columns,
      Home: cell - col,
      End: Math.min(cell - col + columns - 1, shown.length - 1),
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    goTo(moves[event.key])
  }

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key as 'ArrowRight' | 'ArrowLeft']
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + tabs.length) % tabs.length
    setTab(tabs[next].id)
    setCell(0)
    tabRefs.current[next]?.focus()
  }

  const rows = Array.from({ length: Math.ceil(shown.length / columns) }, (_, row) => shown.slice(row * columns, (row + 1) * columns))
  const tabLabel = tabs.find((entry) => entry.id === activeTab)?.label ?? label

  return (
    <div role="group" aria-label={label} className={cn('flex w-[328px] max-w-full flex-col gap-2 p-2', className)}>
      <Input
        inputSize="sm"
        type="search"
        aria-label="Search emoji"
        placeholder="Search emoji"
        value={query}
        leading={<SearchIcon size={14} />}
        onChange={(event) => {
          setQuery(event.target.value)
          setCell(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && shown.length > 0) {
            event.preventDefault()
            goTo(0)
          }
        }}
      />

      {needle ? (
        <p role="status" className="px-1 text-[12px] font-semibold text-ink-faint">
          {shown.length === 0 ? `No emoji match “${query.trim()}”` : `${shown.length} ${shown.length === 1 ? 'result' : 'results'}`}
        </p>
      ) : (
        <div role="tablist" aria-label="Emoji categories" className="flex justify-between gap-0.5 border-b border-line pb-1.5">
          {tabs.map((entry, index) => {
            const selected = entry.id === activeTab
            return (
              <button
                key={entry.id}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                id={`${uid}-tab-${entry.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                aria-label={entry.label}
                title={entry.label}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(entry.id)
                  setCell(0)
                }}
                onKeyDown={(event) => onTabKey(event, index)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[10px] text-[17px] transition-colors',
                  selected ? 'bg-accent-soft' : 'opacity-70 grayscale hover:bg-surface-muted hover:opacity-100 hover:grayscale-0',
                )}
              >
                <span aria-hidden="true">{entry.icon}</span>
              </button>
            )
          })}
        </div>
      )}

      <div
        id={`${uid}-panel`}
        {...(needle ? {} : { role: 'tabpanel', 'aria-labelledby': `${uid}-tab-${activeTab}` })}
        className="h-[224px] overflow-y-auto"
      >
        {shown.length > 0 && (
          <div ref={gridRef} role="grid" aria-label={needle ? 'Search results' : tabLabel} onKeyDown={onGridKey} className="flex flex-col">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} role="row" className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {row.map((entry, colIndex) => {
                  const index = rowIndex * columns + colIndex
                  return (
                    <div key={entry.emoji} role="gridcell">
                      <button
                        type="button"
                        data-cell={index}
                        tabIndex={index === cell ? 0 : -1}
                        aria-label={entry.name}
                        onClick={() => pick(entry)}
                        onFocus={() => {
                          setCell(index)
                          setPreview(entry)
                        }}
                        onMouseEnter={() => setPreview(entry)}
                        className="flex aspect-square w-full items-center justify-center rounded-[10px] text-[22px] leading-none transition-colors hover:bg-surface-muted focus-visible:bg-accent-soft focus-visible:outline-offset-[-2px]"
                      >
                        <span aria-hidden="true">{entry.emoji}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div aria-hidden="true" className="flex h-8 items-center gap-2 border-t border-line px-1 pt-2">
        <span className="text-[20px] leading-none">{preview?.emoji ?? ''}</span>
        <span className="truncate text-[12px] font-semibold text-ink-soft">{preview?.name ?? 'Pick an emoji'}</span>
      </div>
    </div>
  )
}
