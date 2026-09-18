'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { Text } from '../Text'

/** Where a comment points, recorded the way the W3C Web Annotation model does. */
export interface CommentAnchorsSelector {
  /** The quoted text itself. */
  exact: string
  /** Up to a few dozen characters before the quote. */
  prefix: string
  /** Up to a few dozen characters after the quote. */
  suffix: string
  /** Character offset when the comment was made. A hint only, never trusted on its own. */
  start: number
}

export interface CommentAnchorsComment {
  id: string
  selector: CommentAnchorsSelector
  author: string
  body: string
  /** Shown beside the author, e.g. "2h". */
  time?: string
}

export interface CommentAnchorsAnchor {
  start: number
  end: number
  /** 0–1. Exact matches score 0.9 and above; fuzzy ones by edit distance and context. */
  confidence: number
  method: 'exact' | 'fuzzy'
}

export interface CommentAnchorsProps {
  /** The current document text. Comments re-anchor whenever it changes. */
  text: string
  /** Comments with their selectors, in any order. */
  comments: CommentAnchorsComment[]
  /** Anchors scoring below this are listed as orphaned. 0.6 keeps a reworded quote and drops a rewritten one. */
  threshold?: number
  /** Controlled active comment id. */
  activeId?: string | null
  /** Called when a card or a highlight is chosen. */
  onActiveChange?: (id: string | null) => void
  /** Accessible name for the document region. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/** Builds a selector for a range of `text`, with `context` characters either side. */
export function createCommentAnchorsSelector(text: string, start: number, end: number, context = 32): CommentAnchorsSelector {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - context), start),
    suffix: text.slice(end, end + context),
    start,
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]!
}

const similarity = (a: string, b: string) => (a.length + b.length === 0 ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length))

function contextScore(text: string, start: number, end: number, selector: CommentAnchorsSelector) {
  const before = text.slice(Math.max(0, start - selector.prefix.length), start)
  const after = text.slice(end, end + selector.suffix.length)
  return (similarity(before, selector.prefix) + similarity(after, selector.suffix)) / 2
}

/**
 * Finds a selector in `text`: every exact occurrence first, scored by context and
 * distance from the hint; failing that, the substring with the least edit distance
 * to the quote (Sellers' approximate matching), bounded to 35% of its length.
 */
export function anchorCommentAnchorsSelector(text: string, selector: CommentAnchorsSelector): CommentAnchorsAnchor | null {
  const { exact } = selector
  if (!exact) return null
  const drift = (start: number) => Math.min(1, Math.abs(start - selector.start) / Math.max(text.length, 1)) * 0.05
  let best: CommentAnchorsAnchor | null = null
  for (let at = text.indexOf(exact), seen = 0; at !== -1 && seen < 50; at = text.indexOf(exact, at + 1), seen += 1) {
    const confidence = 0.9 + 0.1 * contextScore(text, at, at + exact.length, selector) - drift(at)
    if (!best || confidence > best.confidence) best = { start: at, end: at + exact.length, confidence, method: 'exact' }
  }
  if (best) return best

  const m = exact.length
  const maxErrors = Math.floor(m * 0.35)
  const from = Math.max(0, selector.start - 4000)
  const haystack = text.slice(from, selector.start + m + 4000)
  const n = haystack.length
  // Row i holds the best edit distance of exact[0..i) ending at each text position,
  // plus where that alignment starts — a free start is what makes it a substring search.
  let dist = new Uint16Array(n + 1)
  let origin = Int32Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i += 1) {
    const d = new Uint16Array(n + 1)
    const o = new Int32Array(n + 1)
    d[0] = i
    o[0] = 0
    for (let j = 1; j <= n; j += 1) {
      const diag = dist[j - 1]! + (exact[i - 1] === haystack[j - 1] ? 0 : 1)
      const up = dist[j]! + 1
      const left = d[j - 1]! + 1
      if (diag <= up && diag <= left) (d[j] = diag), (o[j] = origin[j - 1]!)
      else if (up <= left) (d[j] = up), (o[j] = origin[j]!)
      else (d[j] = left), (o[j] = o[j - 1]!)
    }
    dist = d
    origin = o
  }
  const word = /[\p{L}\p{N}]/u
  for (let j = 1; j <= n; j += 1) {
    const errors = dist[j]!
    if (errors > maxErrors || errors > (dist[j - 1] ?? Infinity) || errors > (dist[j + 1] ?? Infinity)) continue
    let start = from + origin[j]!
    let end = from + j
    // A quote that began and ended on word boundaries should again: "econd week" becomes "second week".
    if (!word.test(selector.prefix.slice(-1)) || !selector.prefix) while (start > 0 && word.test(text[start - 1]!) && word.test(text[start]!)) start -= 1
    if (!word.test(selector.suffix[0] ?? '')) while (end < text.length && word.test(text[end]!) && word.test(text[end - 1]!)) end += 1
    if (end <= start) continue
    const quote = similarity(text.slice(start, end), exact)
    const confidence = 0.65 * quote + 0.35 * contextScore(text, start, end, selector) - drift(start)
    if (!best || confidence > best.confidence) best = { start, end, confidence, method: 'fuzzy' }
  }
  return best
}

const hasHighlightApi = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'

/**
 * Comments pinned to a quote rather than to an offset, so they survive edits.
 *
 * Each comment stores what the W3C annotation model stores — the exact quote, a
 * little text either side, and the old position as a hint. When the text
 * changes, the quote is looked for exactly; failing that, by approximate match
 * with a bounded edit distance, and the card says how sure the match is. A
 * comment whose quote is gone is listed as orphaned rather than silently pinned
 * to the wrong words, which is the failure people notice.
 *
 * Highlights use the CSS Custom Highlight API where it exists, so the document
 * stays one text node; elsewhere the text is split into marks. Cards sit in the
 * margin level with their anchor and push each other down instead of overlapping.
 */
export function CommentAnchors({
  text,
  comments,
  threshold = 0.6,
  activeId,
  onActiveChange,
  label = 'Document',
  className,
}: CommentAnchorsProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const name = `klyv-anchors-${uid}`
  const [ownActive, setOwnActive] = useState<string | null>(null)
  const active = activeId !== undefined ? activeId : ownActive
  const choose = (id: string | null) => {
    if (activeId === undefined) setOwnActive(id)
    onActiveChange?.(id)
  }
  const [highlightApi, setHighlightApi] = useState<boolean | null>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const [tops, setTops] = useState<Record<string, number>>({})
  const [height, setHeight] = useState(0)

  const resolved = useMemo(
    () =>
      comments.map((comment) => {
        const anchor = anchorCommentAnchorsSelector(text, comment.selector)
        return { comment, anchor: anchor && anchor.confidence >= threshold ? anchor : null, score: anchor?.confidence ?? 0 }
      }),
    [text, comments, threshold],
  )
  const anchored = resolved.filter((entry) => entry.anchor).sort((a, b) => a.anchor!.start - b.anchor!.start)
  const orphaned = resolved.filter((entry) => !entry.anchor)

  useEffect(() => setHighlightApi(hasHighlightApi()), [])

  const rangeFor = (start: number, end: number) => {
    const node = docRef.current?.firstChild
    if (!node || node.nodeType !== Node.TEXT_NODE) return null
    const range = document.createRange()
    const length = (node as Text).length
    range.setStart(node, Math.min(start, length))
    range.setEnd(node, Math.min(end, length))
    return range
  }

  useEffect(() => {
    if (!highlightApi) return
    const all = new Highlight()
    const current = new Highlight()
    for (const { comment, anchor } of anchored) {
      const range = rangeFor(anchor!.start, anchor!.end)
      if (range) (comment.id === active ? current : all).add(range)
    }
    CSS.highlights.set(name, all)
    CSS.highlights.set(`${name}-active`, current)
    return () => {
      CSS.highlights.delete(name)
      CSS.highlights.delete(`${name}-active`)
    }
  })

  const layout = () => {
    const doc = docRef.current
    if (!doc) return
    const origin = doc.getBoundingClientRect().top
    const next: Record<string, number> = {}
    let floor = 0
    for (const { comment, anchor } of anchored) {
      let top = 0
      if (highlightApi) {
        const rect = rangeFor(anchor!.start, anchor!.end)?.getClientRects?.()[0]
        top = rect ? rect.top - origin : 0
      } else {
        const mark = [...doc.querySelectorAll<HTMLElement>('[data-first]')].find((node) =>
          node.dataset.first!.split(' ').includes(comment.id),
        )
        top = mark ? mark.getBoundingClientRect().top - origin : 0
      }
      next[comment.id] = Math.max(top, floor)
      floor = next[comment.id]! + (cardRefs.current.get(comment.id)?.offsetHeight ?? 0) + 8
    }
    setTops((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
    setHeight(floor)
  }

  useIsomorphicLayoutEffect(layout)
  useEffect(() => {
    const doc = docRef.current
    if (!doc || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => layout())
    observer.observe(doc)
    return () => observer.disconnect()
  })

  const segments = useMemo(() => {
    if (highlightApi !== false) return null
    const cuts = new Set([0, text.length])
    for (const { anchor } of anchored) cuts.add(anchor!.start), cuts.add(anchor!.end)
    const points = [...cuts].sort((a, b) => a - b)
    return points.slice(0, -1).map((start, i) => {
      const end = points[i + 1]!
      const ids = anchored.filter(({ anchor }) => anchor!.start <= start && anchor!.end >= end).map(({ comment }) => comment.id)
      const first = anchored.filter(({ anchor }) => anchor!.start === start).map(({ comment }) => comment.id)
      return { start, end, ids, first }
    })
  }, [highlightApi, text, anchored])

  const card = (comment: CommentAnchorsComment, anchor: CommentAnchorsAnchor | null, score: number) => {
    const status = !anchor
      ? `Quote not found${score ? ` · best match ${Math.round(score * 100)}%` : ''}`
      : anchor.method === 'exact'
        ? 'Anchored exactly'
        : `Re-anchored · ${Math.round(anchor.confidence * 100)}% sure`
    return (
      <button
        type="button"
        aria-pressed={active === comment.id}
        onClick={() => choose(active === comment.id ? null : comment.id)}
        className={cn(
          'flex w-full flex-col gap-1 rounded-[var(--radius-tile)] border bg-surface p-3 text-left shadow-[var(--shadow-tile)] transition-colors',
          active === comment.id ? 'border-accent-strong' : 'border-line hover:border-line-strong',
        )}
      >
        <span className="flex items-baseline gap-2">
          <Text as="span" size="label" weight="bold">
            {comment.author}
          </Text>
          {comment.time && (
            <Text as="span" size="caption" tone="faint">
              {comment.time}
            </Text>
          )}
        </span>
        <Text as="span" size="label" tone="soft" leading="normal">
          {comment.body}
        </Text>
        {!anchor && (
          <Text as="span" size="caption" tone="faint" className="line-through">
            “{comment.selector.exact}”
          </Text>
        )}
        <Text as="span" size="micro" weight="semibold" tone={anchor?.method === 'fuzzy' ? 'accent' : 'faint'}>
          {status}
        </Text>
      </button>
    )
  }

  return (
    <div className={cn('grid w-full grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_240px]', className)}>
      {highlightApi && (
        <style>{`::highlight(${name}){background-color:color-mix(in oklab,var(--color-accent) 30%,transparent)}::highlight(${name}-active){background-color:color-mix(in oklab,var(--color-accent) 70%,transparent);color:var(--color-ink)}`}</style>
      )}
      <div
        ref={docRef}
        role="region"
        aria-label={label}
        className="whitespace-pre-wrap rounded-[var(--radius-card)] border border-line bg-surface p-5 font-sans text-[14px] font-medium leading-[1.75] text-ink"
      >
        {segments
          ? segments.map((segment) =>
              segment.ids.length ? (
                <mark
                  key={segment.start}
                  data-first={segment.first.join(' ') || undefined}
                  onClick={() => choose(segment.ids[0]!)}
                  className={cn(
                    'rounded-[var(--radius-hair)] text-ink',
                    segment.ids.includes(active ?? '')
                      ? 'bg-[color-mix(in_oklab,var(--color-accent)_70%,transparent)]'
                      : 'bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)]',
                  )}
                >
                  {text.slice(segment.start, segment.end)}
                </mark>
              ) : (
                text.slice(segment.start, segment.end)
              ),
            )
          : text}
      </div>
      <div className="flex flex-col gap-4">
        <ul aria-label="Comments" className="relative flex flex-col gap-2 sm:block" style={{ minHeight: height }}>
          {anchored.map(({ comment, anchor, score }) => (
            <li
              key={comment.id}
              ref={(node) => {
                if (node) cardRefs.current.set(comment.id, node)
                else cardRefs.current.delete(comment.id)
              }}
              className="sm:absolute sm:inset-x-0 sm:transition-[top] sm:motion-reduce:transition-none"
              style={{ top: tops[comment.id] ?? 0 }}
            >
              {card(comment, anchor, score)}
            </li>
          ))}
        </ul>
        {orphaned.length > 0 && (
          <section aria-label="Orphaned comments" className="flex flex-col gap-2 border-t border-line pt-3">
            <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
              Orphaned · {orphaned.length}
            </Text>
            <ul className="flex flex-col gap-2">
              {orphaned.map(({ comment, score }) => (
                <li key={comment.id}>{card(comment, null, score)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
