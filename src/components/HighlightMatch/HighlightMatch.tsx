import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface HighlightMatchProps {
  /** The text to render. */
  text: string
  /** What to find. A string is split into words unless `splitWords` is false; an array is used term by term. */
  query: string | string[]
  /** Split a string query on whitespace so each word matches on its own, in any order. */
  splitWords?: boolean
  /** Only match at the start of a word — “an” finds “Anna” but not “Joanna”. */
  wordStart?: boolean
  /** Merged onto every `<mark>`. */
  markClassName?: string
  /** Merged onto the wrapping span. */
  className?: string
}

/** A matched run, as `[start, end)` offsets into the original text. */
export type HighlightMatchRange = [number, number]

/** Lower case with accents removed, one character at a time, so offsets can be mapped back to the original. */
function fold(text: string) {
  let folded = ''
  const origin: number[] = []
  let index = 0
  for (const char of text) {
    const plain = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (let unit = 0; unit < plain.length; unit += 1) origin.push(index)
    folded += plain
    index += char.length
  }
  origin.push(text.length)
  return { folded, origin }
}

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Where `query` matches inside `text`, ignoring case and accents. Ranges are sorted and never overlap. */
export function highlightMatchRanges(
  text: string,
  query: string | string[],
  { splitWords = true, wordStart = false }: { splitWords?: boolean; wordStart?: boolean } = {},
): HighlightMatchRange[] {
  const terms = (Array.isArray(query) ? query : splitWords ? query.split(/\s+/) : [query])
    .map((term) => fold(term.trim()).folded)
    .filter(Boolean)
  if (terms.length === 0 || !text) return []

  // Longest first, so “new york” wins over “new” where both would match.
  const alternatives = [...new Set(terms)].sort((a, b) => b.length - a.length).map(escape).join('|')
  const pattern = new RegExp(wordStart ? `(?<![\\p{L}\\p{N}])(?:${alternatives})` : alternatives, 'gu')
  const { folded, origin } = fold(text)

  const ranges: HighlightMatchRange[] = []
  for (const match of folded.matchAll(pattern)) {
    const start = origin[match.index]
    const end = origin[match.index + match[0].length] ?? text.length
    // Folding can turn one character into two, so runs that touch or overlap in the original are merged.
    const last = ranges[ranges.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else if (end > start) ranges.push([start, end])
  }
  return ranges
}

/**
 * Text with the parts that match a search wrapped in `<mark>`.
 *
 * Matching is done on a folded copy — lower case, accents stripped — so
 * “cafe” finds “Café” and “zoe” finds “Zoë”, and the highlight is mapped
 * back onto the original characters rather than the folded ones, so the
 * reader still sees the accent they typed past. Query text is escaped
 * before it becomes a pattern, so a search for “c++” or “(beta)” matches
 * literally instead of throwing.
 *
 * `<mark>` rather than a styled span, because it is announced as highlighted
 * by the screen readers that support it and it survives copy into a rich
 * editor. The tint is the accent washed into the surface, with ink text on
 * top, so the match stands out without taking the text below contrast.
 */
export function HighlightMatch({ text, query, splitWords = true, wordStart = false, markClassName, className }: HighlightMatchProps) {
  const ranges = highlightMatchRanges(text, query, { splitWords, wordStart })
  if (ranges.length === 0) return <span className={className}>{text}</span>

  const parts: ReactNode[] = []
  let cursor = 0
  ranges.forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark
        key={start}
        className={cn(
          'rounded-[var(--radius-3)] bg-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] px-px text-inherit [box-decoration-break:clone]',
          markClassName,
        )}
      >
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))

  return <span className={className}>{parts}</span>
}
