'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { ChevronDownIcon, SearchIcon } from '../internal/icons'
import { Portal } from '../Portal'
import { usePopoverPosition } from '../Popover/usePopoverPosition'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface ScopedSearchScope {
  /** Also the word recognised after `in:` — `in:docs`. */
  value: string
  label: string
}

export interface ScopedSearchSuggestion {
  id: string
  label: string
  /** The scope this result belongs to. Suggestions outside the chosen scope are hidden. */
  scope: string
  /** Secondary text — a path, an issue number, a team. */
  hint?: string
  /** A glyph or avatar before the label. */
  leading?: ReactNode
}

export interface ScopedSearchProps {
  /** The scopes on offer. The first one is the catch-all when it is called `all`. */
  scopes?: ScopedSearchScope[]
  /** Controlled scope. */
  scope?: string
  /** Starting scope when uncontrolled. */
  defaultScope?: string
  /** Called when the scope changes — from the selector or from an `in:` token. */
  onScopeChange?: (scope: string) => void
  /** Controlled query text. */
  value?: string
  /** Starting query when uncontrolled. */
  defaultValue?: string
  /** Called on every keystroke with the query text. */
  onValueChange?: (value: string) => void
  /** Candidate results. They are filtered by scope and by a case-insensitive match on the label. */
  suggestions?: ScopedSearchSuggestion[]
  /** Set false when the suggestions are already filtered by a server. Scope is still applied. */
  filterSuggestions?: boolean
  /** Most suggestions shown at once. */
  maxSuggestions?: number
  /** Called with the query and scope when Enter is pressed without a suggestion highlighted. */
  onSubmit?: (query: string, scope: string) => void
  /** Called when a suggestion is chosen. */
  onSuggestionSelect?: (suggestion: ScopedSearchSuggestion) => void
  /** Recognise a typed `in:docs ` and turn it into the scope. */
  recognizeTokens?: boolean
  /** Accessible name for the search field. */
  label?: string
  placeholder?: string
  disabled?: boolean
  /** Merged onto the form. */
  className?: string
}

const DEFAULT_SCOPES: ScopedSearchScope[] = [
  { value: 'all', label: 'All' },
  { value: 'docs', label: 'Docs' },
  { value: 'issues', label: 'Issues' },
  { value: 'people', label: 'People' },
]

/**
 * A search box that says where it is looking.
 *
 * A single global search mixes a person called Ada with an issue mentioning
 * ada and a doc about ADA compliance, and the reader has to filter by eye. The
 * scope selector sits inside the field, so the choice is visible while typing
 * and travels with the query on submit. People who live in the keyboard can
 * type `in:issues ` instead; the token is lifted out of the text and becomes
 * the scope.
 *
 * Suggestions follow the editable-combobox pattern: focus stays in the input,
 * arrows move a highlight read out through `aria-activedescendant`, Enter on a
 * highlight picks it and Enter with none submits the query, and Escape closes
 * the list without leaving the field.
 */
export function ScopedSearch({
  scopes = DEFAULT_SCOPES,
  scope: controlledScope,
  defaultScope,
  onScopeChange,
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  suggestions = [],
  filterSuggestions = true,
  maxSuggestions = 6,
  onSubmit,
  onSuggestionSelect,
  recognizeTokens = true,
  label = 'Search',
  placeholder = 'Search',
  disabled = false,
  className,
}: ScopedSearchProps) {
  const [ownScope, setOwnScope] = useState(defaultScope ?? scopes[0]?.value ?? 'all')
  const [ownValue, setOwnValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const anchorRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`
  const scopeId = `${baseId}-scope`

  const scope = controlledScope ?? ownScope
  const query = controlledValue ?? ownValue
  const catchAll = scopes[0]?.value === 'all' ? 'all' : null
  const scopeLabel = (value: string) => scopes.find((item) => item.value === value)?.label ?? value

  const setScope = (next: string) => {
    if (controlledScope === undefined) setOwnScope(next)
    onScopeChange?.(next)
  }
  const setQuery = (next: string) => {
    if (controlledValue === undefined) setOwnValue(next)
    onValueChange?.(next)
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return suggestions
      .filter((item) => scope === catchAll || item.scope === scope)
      .filter((item) => !filterSuggestions || !needle || item.label.toLowerCase().includes(needle))
      .slice(0, maxSuggestions)
  }, [suggestions, scope, catchAll, query, filterSuggestions, maxSuggestions])

  const expanded = open && query.trim().length > 0
  useEffect(() => setActive(-1), [query, scope])

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    listRef as React.RefObject<HTMLElement>,
    expanded,
    'bottom',
    'start',
    6,
  )
  const { zIndex } = useOverlayLayer({ open: expanded, onDismiss: () => setOpen(false), kind: 'popover' })

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [expanded])

  const onInput = (text: string) => {
    if (recognizeTokens) {
      const match = /(^|\s)in:([\w-]+)\s/i.exec(text)
      const found = match && scopes.find((item) => [item.value, item.label].some((name) => name.toLowerCase() === match[2].toLowerCase()))
      if (match && found) {
        setScope(found.value)
        text = (text.slice(0, match.index) + match[1] + text.slice(match.index + match[0].length)).replace(/^\s+/, '')
      }
    }
    setQuery(text)
    setOpen(true)
  }

  const choose = (suggestion: ScopedSearchSuggestion) => {
    onSuggestionSelect?.(suggestion)
    setQuery(suggestion.label)
    setOpen(false)
    inputRef.current?.focus()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (expanded && visible[active]) return choose(visible[active])
    setOpen(false)
    onSubmit?.(query.trim(), scope)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!expanded) return setOpen(true)
      if (visible.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      const total = visible.length
      setActive((current) => {
        // Position `total` stands for "nothing highlighted".
        const from = current < 0 || current >= total ? total : current
        const next = (from + step + total + 1) % (total + 1)
        return next === total ? -1 : next
      })
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      setOpen(false)
    }
  }

  // The highlight cycles through the suggestions and back to "none", so Enter
  // can always get to plain submit again without clearing the text.
  const activeIndex = active >= visible.length ? -1 : active
  const activeId = expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined

  return (
    <form
      ref={anchorRef}
      role="search"
      aria-label={label}
      onSubmit={submit}
      className={cn(
        'flex h-10 w-full items-center rounded-full border border-line bg-surface text-[13px] focus-within:border-line-strong',
        disabled && 'opacity-40',
        className,
      )}
    >
      <label htmlFor={scopeId} className="sr-only">
        Search in
      </label>
      <span className="relative flex h-full shrink-0 items-center border-r border-line">
        <select
          id={scopeId}
          value={scope}
          disabled={disabled}
          onChange={(event) => setScope(event.target.value)}
          className="h-full cursor-pointer appearance-none rounded-l-full bg-transparent pl-4 pr-8 font-semibold text-ink disabled:cursor-not-allowed"
        >
          {scopes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={12} className="pointer-events-none absolute right-3 text-ink-faint" />
      </span>
      <SearchIcon size={15} className="ml-3 shrink-0 text-ink-faint" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        disabled={disabled}
        value={query}
        placeholder={scope === catchAll ? placeholder : `${placeholder} ${scopeLabel(scope).toLowerCase()}`}
        onChange={(event) => onInput(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-full min-w-0 flex-1 rounded-r-full bg-transparent pl-2 pr-4 font-medium text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
      {expanded && (
        <Portal>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={`Suggestions in ${scopeLabel(scope)}`}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: anchorRef.current?.offsetWidth,
              zIndex,
            }}
            className="max-h-[300px] overflow-y-auto rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
          >
            {visible.map((item, index) => (
              <div
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold transition-colors',
                  index === activeIndex ? 'bg-surface-muted text-ink' : 'text-ink-soft',
                )}
              >
                {item.leading && <span className="flex shrink-0 items-center text-ink-faint">{item.leading}</span>}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.hint && <span className="truncate text-[11px] font-medium text-ink-faint">{item.hint}</span>}
                </span>
                {scope === catchAll && (
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                    {scopeLabel(item.scope)}
                  </span>
                )}
              </div>
            ))}
            {visible.length === 0 && (
              <Text size="caption" tone="faint" className="px-2.5 py-3">
                No matches in {scopeLabel(scope)}. Press Enter to search anyway.
              </Text>
            )}
          </div>
        </Portal>
      )}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {expanded ? `${visible.length} ${visible.length === 1 ? 'suggestion' : 'suggestions'} in ${scopeLabel(scope)}` : ''}
        </span>
      </VisuallyHidden>
    </form>
  )
}
