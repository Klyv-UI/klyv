'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SearchIcon } from '../internal/icons'
import { parseQuery, type QueryBarParseResult, type QueryBarSchema, type QueryBarToken } from './query'

export interface QueryBarProps {
  /** The keys the bar recognises, their types and their values. */
  schema: QueryBarSchema
  /** Controlled query text. */
  value?: string
  /** Starting text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit. */
  onValueChange?: (value: string) => void
  /** Called with the parsed tree and its issues on every edit. */
  onQueryChange?: (result: QueryBarParseResult) => void
  /** Accessible name of the field. */
  label: string
  placeholder?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Suggestion {
  label: string
  hint?: string
  /** Text that replaces the token under the caret. */
  insert: string
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
const quote = (value: string) => (/[\s()]/.test(value) ? `"${value}"` : value)

function suggestionsFor(token: QueryBarToken | undefined, text: string, schema: QueryBarSchema): Suggestion[] {
  const sign = token?.negated ? '-' : ''
  if (!token || token.kind !== 'term' || token.quoted) return []
  if (token.key === undefined) {
    const partial = (token.value ?? '').toLowerCase()
    return Object.entries(schema)
      .filter(([key]) => key.startsWith(partial) && key !== partial)
      .map(([key, field]) => ({ label: `${key}:`, hint: field.description ?? field.type, insert: `${sign}${key}:` }))
  }
  const field = schema[token.key]
  if (!field) return []
  const typed = text.slice(token.keyEnd, token.end)
  const lead = `${sign}${token.key}:`
  if (field.type === 'date') {
    return [
      { label: `>=${day(7)}`, hint: 'last 7 days', insert: `${lead}>=${day(7)} ` },
      { label: `>=${day(30)}`, hint: 'last 30 days', insert: `${lead}>=${day(30)} ` },
      { label: `<${day(90)}`, hint: 'older than 90 days', insert: `${lead}<${day(90)} ` },
    ].filter((option) => option.label.startsWith(typed) && option.label !== typed)
  }
  const values = [...(field.type === 'user' ? ['@me'] : []), ...(field.values ?? [])]
  return values
    .filter((value) => value.toLowerCase().startsWith(typed.toLowerCase()) && value !== typed)
    .map((value) => ({ label: value, insert: `${lead}${quote(value)} ` }))
}

/**
 * A search field that speaks a filter syntax — `status:open -label:bug
 * created:>2024-01-01 assignee:@me OR priority:high` — and shows that it
 * understood.
 *
 * A row of dropdowns caps what can be asked; a bare text box hides what was
 * understood. This keeps the text box and draws over it: recognised filters
 * are tinted as chips in place, negations and unknown keys look different,
 * and problems are underlined where they are and explained below. Completion
 * offers keys, then that key’s values, from the schema. The parsed tree comes
 * out with `onQueryChange`, and `matchesQuery` applies it to records.
 */
export function QueryBar({ schema, value, defaultValue = '', onValueChange, onQueryChange, label, placeholder = 'Filter', className }: QueryBarProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const text = value ?? uncontrolled
  const inputRef = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(text.length)
  const [scroll, setScroll] = useState(0)
  const [open, setOpen] = useState(false)
  const [rawActive, setActive] = useState(0)

  const result = useMemo(() => parseQuery(text, schema), [text, schema])
  const report = useRef(onQueryChange)
  report.current = onQueryChange
  useEffect(() => report.current?.(result), [result])

  const token = result.tokens.find((candidate) => candidate.start <= caret && caret <= candidate.end)
  const suggestions = open ? suggestionsFor(token, text, schema) : []
  const active = suggestions.length === 0 ? -1 : Math.min(rawActive, suggestions.length - 1)

  const sync = () => {
    const input = inputRef.current
    if (!input) return
    setCaret(input.selectionStart ?? input.value.length)
    setScroll(input.scrollLeft)
  }

  const change = (next: string, cursor?: number) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
    setActive(0)
    if (cursor !== undefined) {
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(cursor, cursor)
        sync()
      })
    }
  }

  const accept = (suggestion: Suggestion) => {
    const from = token && token.kind === 'term' ? token.start : caret
    const to = token && token.kind === 'term' ? token.end : caret
    const rest = text.slice(to)
    const insert = rest.startsWith(' ') ? suggestion.insert.trimEnd() : suggestion.insert
    change(text.slice(0, from) + insert + rest, from + insert.length)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length === 0) {
      setOpen(true)
      event.preventDefault()
      return
    }
    if (suggestions.length === 0) {
      if (event.key === 'Escape') setOpen(false)
      return
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((active + 1) % suggestions.length),
      ArrowUp: () => setActive((active - 1 + suggestions.length) % suggestions.length),
      Enter: () => accept(suggestions[active]),
      Tab: () => accept(suggestions[active]),
      Escape: () => setOpen(false),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  // The mirror: the same text in the same font and weight, with every token
  // painted. Only colour and background change — anything that changed a
  // glyph's width would slide the caret off the text it sits in.
  const errorAt = (start: number, end: number) => result.issues.some((issue) => issue.severity === 'error' && issue.start < end && issue.end > start)
  const pieces: ReactNode[] = []
  let at = 0
  for (const piece of result.tokens) {
    if (piece.start > at) pieces.push(text.slice(at, piece.start))
    const body = text.slice(piece.start, piece.end)
    const broken = errorAt(piece.start, piece.end)
    const underline = broken && 'underline decoration-danger decoration-wavy decoration-from-font underline-offset-4'
    if (piece.kind === 'term' && piece.key !== undefined) {
      const known = schema[piece.key] !== undefined
      const split = (piece.keyEnd ?? piece.start) - piece.start
      pieces.push(
        <span
          key={piece.start}
          className={cn(
            'rounded-[var(--radius-5)]',
            !known ? 'text-ink-soft underline decoration-dotted underline-offset-4' : piece.negated ? 'bg-[color-mix(in_oklab,var(--color-danger)_16%,transparent)]' : 'bg-accent-soft',
            underline,
          )}
        >
          <span className={cn(known && (piece.negated ? 'text-danger' : 'text-accent-strong'))}>{body.slice(0, split)}</span>
          <span className="text-ink">{body.slice(split)}</span>
        </span>,
      )
    } else if (piece.kind === 'or' || piece.kind === 'not' || piece.kind === 'open' || piece.kind === 'close') {
      pieces.push(
        <span key={piece.start} className={cn('text-accent-strong', underline)}>
          {body}
        </span>,
      )
    } else {
      pieces.push(
        <span key={piece.start} className={cn(piece.negated ? 'text-danger' : 'text-ink', piece.quoted && 'bg-surface-muted rounded-[var(--radius-5)]', underline)}>
          {body}
        </span>,
      )
    }
    at = piece.end
  }
  if (at < text.length) pieces.push(text.slice(at))

  const errors = result.issues.filter((issue) => issue.severity === 'error')
  const warnings = result.issues.filter((issue) => issue.severity === 'warning')
  const listId = `${uid}-suggestions`
  const issuesId = `${uid}-issues`

  return (
    <div className={cn('relative flex w-full flex-col gap-1.5', className)}>
      <div className={cn('relative flex h-10 items-center rounded-full border bg-surface', errors.length ? 'border-danger' : 'border-line focus-within:border-line-strong')}>
        <span className="pointer-events-none absolute left-3.5 flex items-center text-ink-faint">
          <SearchIcon size={14} />
        </span>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-10 right-4 overflow-hidden">
          <div className="flex h-full items-center whitespace-pre font-sans text-[13px] font-medium text-ink" style={{ transform: `translateX(${-scroll}px)` }}>
            {/* One inline run: in a flex box the spaces between chips would be dropped. */}
            <span className="whitespace-pre">{text ? pieces : <span className="text-ink-faint">{placeholder}</span>}</span>
          </div>
        </div>
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={issuesId}
          aria-invalid={errors.length > 0 || undefined}
          value={text}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            change(event.target.value)
            setOpen(true)
            setCaret(event.target.selectionStart ?? event.target.value.length)
          }}
          onKeyDown={onKeyDown}
          onKeyUp={sync}
          onClick={sync}
          onSelect={sync}
          onScroll={sync}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="h-full w-full min-w-0 rounded-full bg-transparent pl-10 pr-4 font-sans text-[13px] font-medium text-transparent caret-[var(--color-ink)] outline-none selection:bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={suggestions.length === 0}
        className="absolute inset-x-0 top-11 z-10 flex max-h-64 flex-col overflow-y-auto rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.label}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => {
              event.preventDefault()
              accept(suggestion)
            }}
            className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-8)] px-2.5 py-1.5 text-[12px]', index === active ? 'bg-accent-soft' : 'hover:bg-surface-muted')}
          >
            <span className="font-mono font-semibold text-ink">{suggestion.label}</span>
            {suggestion.hint && <span className="truncate font-medium text-ink-faint">{suggestion.hint}</span>}
          </li>
        ))}
      </ul>
      <div id={issuesId} aria-live="polite" className="flex flex-col gap-0.5 px-2 text-[12px] font-medium">
        {errors.map((issue) => (
          <p key={`${issue.start}-${issue.message}`} className="text-danger">
            <span className="font-mono">col {issue.start + 1}</span> · {issue.message}
          </p>
        ))}
        {warnings.map((issue) => (
          <p key={`${issue.start}-${issue.message}`} className="text-ink-faint">
            <span className="font-mono">col {issue.start + 1}</span> · {issue.message}
          </p>
        ))}
      </div>
    </div>
  )
}
