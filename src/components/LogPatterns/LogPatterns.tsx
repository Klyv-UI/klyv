'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { ChevronRightIcon, SearchIcon } from '../internal/icons'

export interface LogPatternsTemplate {
  id: number
  /** Template tokens. Variables are `<*>`, or a typed mask such as `<NUM>` or `<IP>`. */
  tokens: string[]
  /** The tokens joined with spaces. */
  template: string
  /** Lines that matched. */
  count: number
  /** Indexes into `lines` of every line that matched, in arrival order. */
  lines: number[]
}

export interface LogPatternsProps {
  /** Raw log lines. Appending lines is incremental: only the new ones are parsed. */
  lines: string[]
  /** Drain’s tree depth, counting the root and the length layer. 4 means the first two tokens route a line. */
  depth?: number
  /** Share of tokens that must agree for a line to join a template, 0 to 1. */
  similarity?: number
  /** Branches per tree node before new tokens fall into the wildcard branch. */
  maxChildren?: number
  /** Matching lines listed under an open template. */
  sampleLines?: number
  /** Heading for the list. */
  label?: string
  /** Called when a template is opened or closed. */
  onTemplateSelect?: (template: LogPatternsTemplate | null) => void
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------------ drain */

const WILD = '<*>'

/**
 * Masks run before clustering, most specific first, so a UUID is not read as
 * five hex runs and an IP is not read as four numbers.
 */
const MASKS: [RegExp, string][] = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>'],
  [/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?![\w.])/g, '<IP>'],
  [/\b0x[0-9a-f]+\b|\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8,}\b/gi, '<HEX>'],
  [/(?<![A-Za-z<])[-+]?\d+(?:\.\d+)?/g, '<NUM>'],
]

const isVariable = (token: string) => token === WILD || /^.*<(UUID|IP|HEX|NUM)>.*$/.test(token)

function mask(token: string) {
  let out = token
  for (const [pattern, name] of MASKS) out = out.replace(pattern, name)
  return out
}

interface DrainGroup {
  id: number
  tokens: string[]
  lines: number[]
}

interface DrainNode {
  children: Map<string, DrainNode>
  groups: DrainGroup[]
}

interface Drain {
  byLength: Map<number, DrainNode>
  groups: DrainGroup[]
  processed: number
  first: string | undefined
}

const node = (): DrainNode => ({ children: new Map(), groups: [] })
const newDrain = (): Drain => ({ byLength: new Map(), groups: [], processed: 0, first: undefined })

/**
 * Drain (He et al., 2017): a fixed-depth tree routes each line by its token
 * count and first few tokens to a small bucket of templates, and only that
 * bucket is compared. That is why it stays fast on millions of lines — a line
 * is never compared with templates of another shape.
 */
function add(drain: Drain, tokens: string[], line: number, depth: number, threshold: number, maxChildren: number) {
  let current = drain.byLength.get(tokens.length)
  if (!current) drain.byLength.set(tokens.length, (current = node()))
  for (let level = 0; level < Math.min(depth - 2, tokens.length); level += 1) {
    const token = tokens[level]
    // Tokens holding digits are probably variables: route them to the wildcard branch.
    let key = /\d/.test(token) || isVariable(token) ? WILD : token
    if (!current.children.has(key) && key !== WILD && current.children.size >= maxChildren - 1) key = WILD
    let child = current.children.get(key)
    if (!child) current.children.set(key, (child = node()))
    current = child
  }

  let best: DrainGroup | null = null
  let bestScore = -1
  let bestWild = Infinity
  for (const group of current.groups) {
    let same = 0
    let wild = 0
    group.tokens.forEach((token, index) => {
      if (token === WILD) wild += 1
      else if (token === tokens[index]) same += 1
    })
    const score = same / tokens.length
    if (score > bestScore || (score === bestScore && wild < bestWild)) [best, bestScore, bestWild] = [group, score, wild]
  }

  if (best && bestScore >= threshold) {
    best.tokens = best.tokens.map((token, index) => (token === tokens[index] ? token : WILD))
    best.lines.push(line)
    return
  }
  const group = { id: drain.groups.length + 1, tokens: tokens.slice(), lines: [line] }
  current.groups.push(group)
  drain.groups.push(group)
}

const tokenize = (line: string) => line.trim().split(/\s+/).filter(Boolean)

/* ------------------------------------------------------------------ view */

function TemplateText({ tokens }: { tokens: string[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        const variable = isVariable(token)
        return (
          <span key={index}>
            {index > 0 && ' '}
            {variable ? (
              <span className="rounded-[var(--radius-6)] bg-[color-mix(in_oklab,var(--color-accent)_32%,transparent)] px-1 font-bold text-ink">{token}</span>
            ) : (
              token
            )}
          </span>
        )
      })}
    </>
  )
}

function slotsOf(group: LogPatternsTemplate, lines: string[]) {
  return group.tokens
    .map((token, position) => ({ token, position }))
    .filter(({ token }) => isVariable(token))
    .map(({ token, position }) => {
      const seen = new Map<string, number>()
      for (const line of group.lines.slice(0, 2000)) {
        const value = tokenize(lines[line])[position]
        if (value !== undefined) seen.set(value, (seen.get(value) ?? 0) + 1)
      }
      const examples = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([value]) => value)
      return { position, token, distinct: seen.size, examples, capped: group.lines.length > 2000 }
    })
}

/**
 * Log lines, grouped into the templates that printed them.
 *
 * The clustering is Drain, the parser most log platforms use, written out
 * here in full: numbers, IPs, hex and UUIDs are masked first, then a
 * fixed-depth tree keyed on token count and leading tokens picks a handful of
 * candidate templates, and a line joins the most similar one if enough tokens
 * agree — turning the tokens that disagree into wildcards. It is incremental,
 * so a live tail can be fed one line at a time and each line costs the same.
 *
 * Opening a template lists its variable slots with their distinct values and
 * the lines behind it, which is the question a pattern view is for: this
 * message spiked — from which hosts, with which ids?
 */
export function LogPatterns({
  lines,
  depth = 4,
  similarity = 0.5,
  maxChildren = 100,
  sampleLines = 40,
  label = 'Log patterns',
  onTemplateSelect,
  className,
}: LogPatternsProps) {
  const drainRef = useRef<Drain>(newDrain())
  const settings = useRef({ depth, similarity, maxChildren })
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  // Parse only what is new; start over if the settings change or the lines were replaced rather than appended.
  useEffect(() => {
    const same = settings.current.depth === depth && settings.current.similarity === similarity && settings.current.maxChildren === maxChildren
    const drain = drainRef.current
    if (!same || lines.length < drain.processed || (drain.processed > 0 && lines[0] !== drain.first)) {
      drainRef.current = newDrain()
      settings.current = { depth, similarity, maxChildren }
      setOpen(null)
    }
    let cancelled = false
    const run = () => {
      const current = drainRef.current
      current.first = lines[0]
      // Chunked, so pasting a hundred thousand lines never blocks a frame for long.
      const end = Math.min(lines.length, current.processed + 4000)
      for (let index = current.processed; index < end; index += 1) {
        const tokens = tokenize(lines[index]).map(mask)
        if (tokens.length) add(current, tokens, index, depth, similarity, maxChildren)
      }
      current.processed = end
      setVersion((value) => value + 1)
      if (end < lines.length && !cancelled) timer = window.setTimeout(run, 0)
    }
    let timer = window.setTimeout(run, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [lines, depth, similarity, maxChildren])

  const templates = useMemo<LogPatternsTemplate[]>(
    () =>
      drainRef.current.groups
        .map((group) => ({ id: group.id, tokens: group.tokens.slice(), template: group.tokens.join(' '), count: group.lines.length, lines: group.lines.slice() }))
        .sort((a, b) => b.count - a.count || a.id - b.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
  const parsed = drainRef.current.processed
  const shown = templates.filter((template) => !query || template.template.toLowerCase().includes(query.toLowerCase())).slice(0, 200)
  const selected = templates.find((template) => template.id === open) ?? null

  const toggle = (template: LogPatternsTemplate) => {
    const next = open === template.id ? null : template.id
    setOpen(next)
    onTemplateSelect?.(next === null ? null : template)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const keys: Record<string, number> = { ArrowDown: focus + 1, ArrowUp: focus - 1, Home: 0, End: shown.length - 1 }
    if (!(event.key in keys) || !(event.target as HTMLElement).dataset.row) return
    event.preventDefault()
    const next = Math.max(0, Math.min(shown.length - 1, keys[event.key]))
    setFocus(next)
    listRef.current?.querySelectorAll<HTMLButtonElement>('[data-row]')[next]?.focus()
  }

  const highlight = (line: string, template: LogPatternsTemplate): ReactNode =>
    tokenize(line).map((token, index) => (
      <span key={index}>
        {index > 0 && ' '}
        {isVariable(template.tokens[index] ?? '') ? <mark className="rounded-[var(--radius-6)] bg-[color-mix(in_oklab,var(--color-accent)_32%,transparent)] px-0.5 text-ink">{token}</mark> : token}
      </span>
    ))

  return (
    <section aria-labelledby={`${id}-title`} className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id={`${id}-title`} className="m-0 text-[15px] font-bold text-ink">
            {label}
          </h3>
          <p className="m-0 text-[12px] font-medium tabular-nums text-ink-soft">
            {parsed.toLocaleString()} {parsed === 1 ? 'line' : 'lines'} → {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            {parsed < lines.length ? ` · parsing ${lines.length - parsed} more` : ''}
          </p>
        </div>
        <Input
          inputSize="sm"
          aria-label="Filter templates"
          placeholder="Filter templates"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setFocus(0)
          }}
          leading={<SearchIcon size={14} aria-hidden="true" />}
          className="pl-9"
          containerClassName="w-full sm:w-[220px]"
        />
      </div>

      {shown.length === 0 ? (
        <p className="m-0 rounded-[var(--radius-tile)] border border-dashed border-line-strong p-6 text-center text-[13px] font-medium text-ink-soft">
          {templates.length ? 'No template matches that filter.' : 'No lines yet. Templates appear as lines arrive.'}
        </p>
      ) : (
        <ul ref={listRef} onKeyDown={onKeyDown} className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface p-0">
          {shown.map((template, index) => {
            const expanded = template.id === open
            const share = parsed ? template.count / parsed : 0
            return (
              <li key={template.id}>
                <button
                  type="button"
                  data-row
                  tabIndex={index === Math.min(focus, shown.length - 1) ? 0 : -1}
                  aria-expanded={expanded}
                  aria-controls={expanded ? `${id}-detail-${template.id}` : undefined}
                  onClick={() => {
                    setFocus(index)
                    toggle(template)
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                >
                  <ChevronRightIcon size={14} aria-hidden="true" className={cn('mt-0.5 shrink-0 text-ink-faint transition-transform motion-reduce:transition-none', expanded && 'rotate-90')} />
                  <span className="flex w-[64px] shrink-0 flex-col gap-1">
                    <span className="text-[13px] font-extrabold tabular-nums text-ink">{template.count.toLocaleString()}</span>
                    <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-track">
                      <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${Math.max(2, share * 100)}%` }} />
                    </span>
                    <span className="sr-only">{Math.round(share * 100)}% of lines.</span>
                  </span>
                  <span className="min-w-0 flex-1 break-words font-mono text-[12px] leading-relaxed text-ink-soft">
                    <TemplateText tokens={template.tokens} />
                  </span>
                </button>
                {expanded && selected && (
                  <div id={`${id}-detail-${template.id}`} className="flex flex-col gap-3 bg-surface-sunken px-3 py-3">
                    {(() => {
                      const slots = slotsOf(selected, lines)
                      return slots.length ? (
                        <table className="w-full border-collapse text-left text-[12px]">
                          <caption className="sr-only">Variable slots</caption>
                          <thead>
                            <tr className="text-[11px] uppercase tracking-wider text-ink-faint">
                              <th scope="col" className="py-1 pr-3 font-bold">Slot</th>
                              <th scope="col" className="py-1 pr-3 font-bold">Distinct</th>
                              <th scope="col" className="py-1 font-bold">Most common values</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slots.map((slot) => (
                              <tr key={slot.position} className="border-t border-line align-top">
                                <td className="py-1.5 pr-3 font-mono text-ink">
                                  #{slot.position + 1} {slot.token}
                                </td>
                                <td className="py-1.5 pr-3 font-semibold tabular-nums text-ink">
                                  {slot.distinct}
                                  {slot.capped ? '+' : ''}
                                </td>
                                <td className="py-1.5 font-mono text-ink-soft">{slot.examples.join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="m-0 text-[12px] font-medium text-ink-soft">No variable slots — every line is identical.</p>
                      )
                    })()}
                    <div className="flex flex-col gap-1">
                      <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        Matching lines{template.count > sampleLines ? ` (latest ${sampleLines} of ${template.count.toLocaleString()})` : ''}
                      </p>
                      <ol className="m-0 flex max-h-[220px] list-none flex-col gap-0.5 overflow-y-auto p-0 font-mono text-[11px] leading-relaxed text-ink-soft">
                        {selected.lines
                          .slice(-sampleLines)
                          .reverse()
                          .map((line) => (
                            <li key={line} className="break-all">
                              <span className="mr-2 select-none text-ink-faint tabular-nums">{line + 1}</span>
                              {highlight(lines[line], selected)}
                            </li>
                          ))}
                      </ol>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {templates.length > shown.length && !query && <p className="m-0 text-[12px] text-ink-faint">Showing the 200 largest templates.</p>}
    </section>
  )
}
