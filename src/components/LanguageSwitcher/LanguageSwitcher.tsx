'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { CheckIcon, ChevronDownIcon, SearchIcon } from '../internal/icons'

export interface LanguageSwitcherOption {
  /** BCP 47 tag — `fr`, `pt-BR`. Also set as the `lang` of the native name. */
  value: string
  /** The language in its own words — "Deutsch", "日本語". */
  nativeName: string
  /** The language in English, shown second — "German". */
  englishName: string
}

export type LanguageSwitcherVariant = 'full' | 'compact'

export interface LanguageSwitcherProps {
  /** The languages on offer. */
  options: LanguageSwitcherOption[]
  /** The current locale, when controlled. */
  value?: string
  /** The starting locale, when uncontrolled. */
  defaultValue?: string
  /** Called with the chosen locale. */
  onValueChange?: (value: string) => void
  /** `full` shows the current language; `compact` is a globe alone, for a crowded header. */
  variant?: LanguageSwitcherVariant
  /** Accessible name for the trigger and the list. */
  label?: string
  /** Show a filter field once there are at least this many languages. */
  searchThreshold?: number
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the trigger. */
  className?: string
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className={className}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 3.9 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.35 5.4 8S6.2 3.65 8 1.75z" />
    </svg>
  )
}

/**
 * A locale picker that a reader who cannot read the current language can
 * still use.
 *
 * Each language is written in its own words first, because someone looking
 * for "Deutsch" will not recognise "German" — and the English name follows
 * for everyone else. The native name carries its own `lang`, so a screen
 * reader switches voice rather than mispronouncing it. The trigger shows a
 * globe, the one cue that works in every language.
 *
 * It is a listbox, as Select is: arrows, Home and End move, Enter chooses,
 * Escape closes and focus returns to the trigger. Past a handful of options a
 * filter field appears that matches either name or the tag, and ArrowDown
 * from it steps into the list.
 */
export function LanguageSwitcher({
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  variant = 'full',
  label = 'Language',
  searchThreshold = 8,
  placement = 'bottom',
  align = 'end',
  className,
}: LanguageSwitcherProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const value = controlled ?? uncontrolled
  const current = options.find((option) => option.value === value)
  const searchable = options.length >= searchThreshold

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? options.filter((option) =>
        [option.nativeName, option.englishName, option.value].some((text) => text.toLowerCase().includes(needle)),
      )
    : options

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const frame = requestAnimationFrame(() => {
      if (searchRef.current) return searchRef.current.focus()
      const list = listRef.current
      ;(list?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const choose = (next: string) => {
    if (controlled === undefined) setUncontrolled(next)
    onValueChange?.(next)
    setOpen(false)
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      nodes[(index + 1) % nodes.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index <= 0 && searchRef.current) searchRef.current.focus()
      else nodes[(index - 1 + nodes.length) % nodes.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
    }
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      listRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus()
    } else if (event.key === 'Enter' && shown.length > 0) {
      event.preventDefault()
      choose(shown[0].value)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      label={label}
      className="w-[260px] gap-1 p-1"
      trigger={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={variant === 'compact' ? `${label}: ${current?.englishName ?? ''}` : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full font-bold leading-none text-ink transition-colors',
            variant === 'compact'
              ? 'size-9 justify-center text-ink-soft hover:bg-surface-muted hover:text-ink'
              : 'h-9 border border-line bg-surface pl-2.5 pr-2 text-[12px] hover:border-line-strong',
            className,
          )}
        >
          <GlobeIcon className="shrink-0" />
          {variant === 'full' && (
            <>
              <span className="sr-only">{label}: </span>
              <span lang={current?.value}>{current?.nativeName}</span>
              <ChevronDownIcon size={14} className="shrink-0 text-ink-faint" />
            </>
          )}
        </button>
      }
    >
      {searchable && (
        <div className="relative p-1">
          <SearchIcon size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label={`Filter ${label.toLowerCase()}s`}
            aria-controls={listId}
            placeholder="Search languages"
            className="h-9 w-full rounded-full border border-line bg-surface pl-8 pr-3 text-[12px] font-medium text-ink placeholder:text-ink-faint"
          />
        </div>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={shown.length === 0}
        onKeyDown={onListKeyDown}
        className="flex max-h-[260px] flex-col overflow-y-auto"
      >
        {shown.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={selected}
              onClick={() => choose(option.value)}
              className={cn(
                'flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors',
                selected ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              )}
            >
              <span className="min-w-0 flex-1">
                <span lang={option.value} className="block truncate text-[13px] font-semibold">
                  {option.nativeName}
                </span>
                {option.englishName !== option.nativeName && (
                  <span className="block truncate text-[11px] font-medium text-ink-faint">{option.englishName}</span>
                )}
              </span>
              {selected && <CheckIcon size={14} className="shrink-0 text-ink" />}
            </button>
          )
        })}
      </div>
      {shown.length === 0 && (
        <p role="status" className="px-2.5 py-3 text-center text-[12px] font-medium text-ink-faint">
          No language matches “{query}”
        </p>
      )}
    </Popover>
  )
}
