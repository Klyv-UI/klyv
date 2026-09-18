'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { SearchIcon } from '../internal/icons'
import { FullTextSearchIndex, fullTextSnippet, type FullTextSearchDocument } from './searchIndex'

export interface FullTextSearchProps<D extends FullTextSearchDocument> {
  /** The corpus. Changes are applied to the index incrementally, by id and identity. */
  documents: D[]
  /** Accessible name of the search field. */
  label: string
  placeholder?: string
  /** Searched fields and their boosts. Defaults to title ×3, body ×1. */
  fields?: Record<string, number>
  /** How many results to show. */
  limit?: number
  /** Called with the chosen document — Enter, or a click. */
  onSelect?: (document: D) => void
  /** Extra line under a result — a section, a date. */
  renderMeta?: (document: D) => ReactNode
  /** Show each result’s BM25 score. */
  showScores?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function marked(text: string, marks: [number, number][]): ReactNode[] {
  const parts: ReactNode[] = []
  let at = 0
  marks.forEach(([start, end]) => {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark key={start} className="rounded-[var(--radius-3)] bg-[color-mix(in_oklab,var(--color-accent)_28%,transparent)] px-0.5 text-ink">
        {text.slice(start, end)}
      </mark>,
    )
    at = end
  })
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/**
 * Search across documents that are already in the browser — help articles,
 * a changelog, a settings page — without a server.
 *
 * Filtering on `includes` finds "invoice" but not "invoices", ranks nothing,
 * and shows a title with no hint of why it matched. This keeps a real inverted
 * index: words are stemmed and stop words dropped, results are ranked by BM25
 * with the title weighted above the body, the last word matches as a prefix
 * while it is still being typed, and each result shows the passage with the
 * most matched words, marked. Adding or removing a document updates the index
 * in place instead of rebuilding it.
 */
export function FullTextSearch<D extends FullTextSearchDocument>({
  documents,
  label,
  placeholder = 'Search',
  fields,
  limit = 8,
  onSelect,
  renderMeta,
  showScores = false,
  className,
}: FullTextSearchProps<D>) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [rawActive, setActive] = useState(0)
  const fieldKey = JSON.stringify(fields ?? null)
  const state = useRef<{ index: FullTextSearchIndex<D>; key: string; seen: Map<string, D> } | null>(null)

  // Reconcile the index with the documents: only what changed is re-indexed.
  if (!state.current || state.current.key !== fieldKey) state.current = { index: new FullTextSearchIndex<D>({ fields }), key: fieldKey, seen: new Map() }
  const { index, seen } = state.current
  const ids = new Set<string>()
  for (const document of documents) {
    ids.add(document.id)
    if (seen.get(document.id) !== document) {
      index.add(document)
      seen.set(document.id, document)
    }
  }
  for (const id of [...seen.keys()]) {
    if (!ids.has(id)) {
      index.remove(id)
      seen.delete(id)
    }
  }

  const hits = useMemo(() => (query.trim() ? index.search(query, { limit }) : []), [index, query, limit, documents])
  const active = hits.length === 0 ? -1 : Math.min(rawActive, hits.length - 1)
  const optionId = (at: number) => `${uid}-result-${at}`

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive(Math.min(hits.length - 1, active + 1)),
      ArrowUp: () => setActive(Math.max(0, active - 1)),
      Enter: () => active >= 0 && onSelect?.(hits[active].document),
      Escape: () => setQuery(''),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const trimmed = query.trim()
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={hits.length > 0}
        aria-controls={`${uid}-results`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        leading={<SearchIcon size={14} />}
        autoComplete="off"
      />
      <p role="status" className="px-1 text-[11px] font-medium text-ink-faint">
        {trimmed
          ? `${hits.length === 0 ? 'No' : hits.length}${hits.length === limit ? '+' : ''} ${hits.length === 1 ? 'result' : 'results'} in ${index.size} documents`
          : `${index.size} documents indexed`}
      </p>
      <ul id={`${uid}-results`} role="listbox" aria-label={`${label} results`} className="flex flex-col gap-1">
        {hits.map((hit, at) => {
          const title = fullTextSnippet(hit.document.title, hit.terms, 1000)
          const body = fullTextSnippet(hit.document.body, hit.terms)
          return (
            <li
              key={hit.document.id}
              id={optionId(at)}
              role="option"
              aria-selected={at === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setActive(at)
                onSelect?.(hit.document)
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded-[var(--radius-tile)] border px-3 py-2.5',
                at === active ? 'border-accent-strong bg-accent-soft' : 'border-line bg-surface hover:bg-surface-muted',
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-bold text-ink">{marked(title.text || hit.document.title, title.marks)}</span>
                {showScores && <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">{hit.score.toFixed(2)}</span>}
              </span>
              {body.text && (
                <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                  {body.clipped[0] && '… '}
                  {marked(body.text, body.marks)}
                  {body.clipped[1] && ' …'}
                </span>
              )}
              {renderMeta && <span className="text-[11px] font-medium text-ink-faint">{renderMeta(hit.document)}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
