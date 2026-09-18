'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { ChevronRightIcon } from '../internal/icons'
import { normalise, queryJson, type JsonQueryPathPart, type JsonQueryResult } from './jsonpath'

export interface JsonQueryProps {
  /** The document to query. */
  data: unknown
  /** Controlled JSONPath expression. */
  value?: string
  /** Starting expression when uncontrolled. */
  defaultValue?: string
  /** Called with the expression after every edit. */
  onValueChange?: (value: string) => void
  /** Called with the matches whenever the expression evaluates cleanly. */
  onResultsChange?: (results: JsonQueryResult[]) => void
  /** Ready-made expressions offered under the field. */
  examples?: string[]
  /** Visible label for the expression field. */
  label?: string
  /** Most results listed; the tree still marks every match. */
  maxResults?: number
  /** Merged last, so it wins. */
  className?: string
}

const brief = (value: unknown, max = 70) => {
  const text = JSON.stringify(value) ?? 'undefined'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * A JSONPath field over a document, with the matches listed by their
 * normalised paths and marked where they sit in the document itself.
 *
 * The evaluator is written out rather than borrowed: recursive descent,
 * slices, unions and filters like `[?(@.price < 10 && @.tags)]` are parsed
 * into a tree and walked, so there is no `eval` anywhere and a query can only
 * read. A mistake is reported at its character, with a caret under it, which
 * is the difference between fixing a filter and rewriting it. The tree opens
 * the branches that hold matches, so a hit deep in the document is on screen.
 */
export function JsonQuery({
  data,
  value,
  defaultValue = '$',
  onValueChange,
  onResultsChange,
  examples = [],
  label = 'JSONPath',
  maxResults = 200,
  className,
}: JsonQueryProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const expression = value ?? uncontrolled
  const set = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }
  const outcome = useMemo(() => queryJson(data, expression), [data, expression])
  const results = outcome.ok ? outcome.results : []
  const matched = useMemo(() => new Set(results.map((result) => result.path)), [results])
  const [open, setOpen] = useState<Set<string>>(() => new Set(['$']))

  // Open every branch that leads to a match, keeping what the reader opened.
  useEffect(() => {
    if (!outcome.ok) return
    onResultsChange?.(outcome.results)
    setOpen((current) => {
      const next = new Set(current)
      for (const result of outcome.results.slice(0, 500)) {
        for (let depth = 0; depth < result.parts.length; depth++) next.add(normalise(result.parts.slice(0, depth)))
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome])

  const toggle = (path: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-expr`} className="text-[12px] font-semibold text-ink">
          {label}
        </label>
        <Input
          id={`${uid}-expr`}
          value={expression}
          onChange={(event) => set(event.target.value)}
          invalid={!outcome.ok}
          aria-describedby={`${uid}-status`}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
        />
        {!outcome.ok && (
          <pre aria-hidden="true" className="overflow-x-auto px-4 font-mono text-[12px] leading-snug text-ink-soft">
            {expression}
            {'\n'}
            <span className="text-danger">{`${' '.repeat(Math.min(outcome.error.at, expression.length))}^`}</span>
          </pre>
        )}
        {examples.length > 0 && (
          <div role="group" aria-label="Example queries" className="flex flex-wrap gap-1.5 pt-1">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                aria-pressed={expression === example}
                onClick={() => set(example)}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                  expression === example ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      <p id={`${uid}-status`} role="status" className={cn('text-[12px] font-semibold', outcome.ok ? 'text-ink-soft' : 'text-danger')}>
        {outcome.ok
          ? `${results.length} match${results.length === 1 ? '' : 'es'}`
          : `${outcome.error.message} (character ${outcome.error.at + 1})`}
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 id={`${uid}-results`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Results
          </h3>
          <ol tabIndex={0} aria-labelledby={`${uid}-results`} className="flex max-h-80 flex-col divide-y divide-line overflow-auto rounded-[var(--radius-tile)] border border-line">
            {results.length === 0 && <li className="px-3 py-2 text-[12px] font-medium text-ink-faint">{outcome.ok ? 'Nothing matches.' : 'Fix the expression to see results.'}</li>}
            {results.slice(0, maxResults).map((result, index) => (
              <li key={`${result.path}-${index}`} className="flex flex-col gap-0.5 px-3 py-1.5">
                <code className="break-all font-mono text-[11px] font-semibold text-ink">{result.path}</code>
                <span className="truncate font-mono text-[11px] text-ink-soft">{brief(result.value)}</span>
              </li>
            ))}
            {results.length > maxResults && <li className="px-3 py-2 text-[12px] font-medium text-ink-faint">{results.length - maxResults} more not listed</li>}
          </ol>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 id={`${uid}-doc`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Document
          </h3>
          <div tabIndex={0} role="group" aria-labelledby={`${uid}-doc`} className="max-h-80 overflow-auto rounded-[var(--radius-tile)] border border-line bg-surface-sunken py-2 font-mono text-[12px]">
            <TreeNode value={data} parts={[]} name={null} open={open} matched={matched} toggle={toggle} />
          </div>
        </div>
      </div>
    </div>
  )
}

interface TreeNodeProps {
  value: unknown
  parts: JsonQueryPathPart[]
  name: JsonQueryPathPart | null
  open: Set<string>
  matched: Set<string>
  toggle: (path: string) => void
}

function TreeNode({ value, parts, name, open, matched, toggle }: TreeNodeProps) {
  const path = normalise(parts)
  const hit = matched.has(path)
  const container = typeof value === 'object' && value !== null
  const isOpen = open.has(path)
  const entries: [JsonQueryPathPart, unknown][] = Array.isArray(value)
    ? value.map((item, i) => [i, item])
    : container
      ? Object.entries(value as Record<string, unknown>)
      : []
  const key = name === null ? '$' : typeof name === 'number' ? `${name}` : JSON.stringify(name)
  const [o, c] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  const depth = parts.length

  return (
    <div>
      <div
        className={cn('flex items-center gap-1 whitespace-nowrap py-px pr-3', hit && 'bg-[color-mix(in_oklab,var(--color-accent)_40%,transparent)]')}
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      >
        {container ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${path}`}
            onClick={() => toggle(path)}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-3)] text-ink-faint hover:text-ink"
          >
            <ChevronRightIcon size={11} className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className={cn(hit ? 'font-semibold text-ink' : 'text-ink-soft')}>{key}: </span>
        <span className={cn(hit ? 'text-ink' : 'text-ink-faint', !container && typeof value === 'string' && !hit && 'text-ink-soft')}>
          {container ? (isOpen ? o : `${o} … ${entries.length} ${c}`) : brief(value, 60)}
        </span>
        {hit && <span className="sr-only"> (match)</span>}
      </div>
      {container && isOpen && (
        <>
          {entries.map(([k, v]) => (
            <TreeNode key={String(k)} value={v} parts={[...parts, k]} name={k} open={open} matched={matched} toggle={toggle} />
          ))}
          <div className="py-px text-ink-faint" style={{ paddingInlineStart: `${8 + depth * 14 + 20}px` }}>
            {c}
          </div>
        </>
      )}
    </div>
  )
}
