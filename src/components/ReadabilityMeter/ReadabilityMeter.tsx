'use client'

import { useId, useMemo, useRef, useState, type UIEvent } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export type ReadabilityMeterIssueKind = 'hard' | 'very-hard' | 'passive' | 'adverb' | 'complex'

export interface ReadabilityMeterIssue {
  kind: ReadabilityMeterIssueKind
  start: number
  end: number
  text: string
  /** A plainer word, for `complex`. */
  suggestion?: string
}

export interface ReadabilityMeterStats {
  words: number
  sentences: number
  syllables: number
  /** Flesch reading ease: 100 is very easy, below 30 is very hard. */
  readingEase: number
  /** Flesch–Kincaid US school grade. */
  grade: number
  issues: ReadabilityMeterIssue[]
}

export interface ReadabilityMeterProps {
  /** Controlled text. */
  value?: string
  /** Starting text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit. */
  onValueChange?: (value: string) => void
  /** Grade to aim for; the summary says whether the text meets it. */
  targetGrade?: number
  /** Visible label of the text field. */
  label?: string
  /** Height of the field in text rows. */
  rows?: number
  /** Merged last, so it wins. */
  className?: string
}

const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  the: 1, every: 3, business: 2, different: 3, evening: 2, interest: 3, family: 3, people: 2, area: 3, idea: 3, being: 2, create: 2, created: 3, science: 2, quiet: 2, poem: 2, real: 1, really: 2, cafe: 2, recipe: 3, simile: 3, whole: 1, eye: 1, fire: 1, hour: 1,
}

/** Vowel groups, less a silent final e, plus the common exceptions. Right for most English words, never for all. */
export function readabilityMeterSyllables(raw: string): number {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return 0
  if (SYLLABLE_EXCEPTIONS[word]) return SYLLABLE_EXCEPTIONS[word]!
  if (word.length <= 3) return 1
  const trimmed = word.replace(/(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, trimmed.match(/[aeiouy]{1,2}/g)?.length ?? 1)
}

const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "aren't", "wasn't", "weren't"])
const IRREGULAR = new Set(
  'arisen awoken beaten become begun bent bound bitten blown broken brought built bought caught chosen come cut dealt done drawn driven eaten fallen fed felt fought found forbidden forgotten forgiven frozen given gone grown hung heard hidden held hurt kept known laid led left lent let lost made meant met paid put read ridden rung risen run said seen sought sold sent set shaken shown shut sung sunk sat slept spoken spent spun spread stood stolen stuck struck sworn swept swum taken taught torn told thought thrown understood woken worn won written'.split(' '),
)
const NOT_ADVERBS = new Set(
  'only family reply apply supply early daily likely holy ugly fly july italy belly jelly rely ally bully silly lonely lovely friendly costly elderly monthly weekly yearly hourly curly scholarly orderly assembly anomaly butterfly comply deadly homely jolly lily melancholy oily rally sly smelly steely wily woolly imply multiply ally'.split(' '),
)
const SIMPLER: Record<string, string> = {
  utilize: 'use', utilise: 'use', facilitate: 'help', approximately: 'about', commence: 'start', demonstrate: 'show', subsequently: 'later', additional: 'more', assistance: 'help', endeavor: 'try', endeavour: 'try', numerous: 'many', sufficient: 'enough', terminate: 'end', purchase: 'buy', obtain: 'get', require: 'need', modify: 'change', individual: 'person', methodology: 'method', functionality: 'feature', leverage: 'use', implement: 'build', optimize: 'improve', ascertain: 'find out', accordingly: 'so', nevertheless: 'still', therefore: 'so', consequently: 'so', regarding: 'about', 'in order to': 'to', 'prior to': 'before', 'due to the fact that': 'because', 'at this point in time': 'now', 'in the event that': 'if', 'a number of': 'some',
}

type Segmenter = { segment: (text: string) => Iterable<{ segment: string; index: number; isWordLike?: boolean }> }
const segmenter = (granularity: 'sentence' | 'word'): Segmenter | null => {
  const Ctor = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => Segmenter }).Segmenter
  return Ctor ? new Ctor('en', { granularity }) : null
}

function sentencesOf(text: string) {
  const seg = segmenter('sentence')
  if (seg) return [...seg.segment(text)].map(({ segment, index }) => ({ start: index, text: segment }))
  const out: { start: number; text: string }[] = []
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)\s*/g
  for (let m = re.exec(text); m && m[0]; m = re.exec(text)) out.push({ start: m.index, text: m[0] })
  return out
}

function wordsOf(text: string, offset: number) {
  const seg = segmenter('word')
  if (seg) return [...seg.segment(text)].filter((part) => part.isWordLike).map(({ segment, index }) => ({ start: offset + index, text: segment }))
  const out: { start: number; text: string }[] = []
  const re = /[A-Za-z0-9’']+/g
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ start: offset + m.index, text: m[0] })
  return out
}

const grade = (words: number, sentences: number, syllables: number) => 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59

/** Everything the meter shows, as data. */
export function analyzeReadability(text: string): ReadabilityMeterStats {
  const issues: ReadabilityMeterIssue[] = []
  let words = 0
  let sentences = 0
  let syllables = 0
  for (const sentence of sentencesOf(text)) {
    const list = wordsOf(sentence.text, sentence.start)
    if (list.length === 0) continue
    sentences += 1
    words += list.length
    const counts = list.map((word) => readabilityMeterSyllables(word.text))
    const own = counts.reduce((sum, n) => sum + n, 0)
    syllables += own
    const level = grade(list.length, 1, own)
    const trimmed = sentence.text.trimEnd()
    if (list.length >= 14 && level >= 10) issues.push({ kind: level >= 14 ? 'very-hard' : 'hard', start: sentence.start, end: sentence.start + trimmed.length, text: trimmed })

    list.forEach((word, i) => {
      const lower = word.text.toLowerCase()
      if (/ly$/.test(lower) && lower.length > 4 && !NOT_ADVERBS.has(lower)) issues.push({ kind: 'adverb', start: word.start, end: word.start + word.text.length, text: word.text })
      if (BE.has(lower)) {
        // be + participle, allowing one adverb between: "was quickly written".
        for (const next of list.slice(i + 1, i + 3)) {
          const candidate = next.text.toLowerCase()
          if ((/[a-z]{2,}ed$/.test(candidate) && candidate !== 'need') || IRREGULAR.has(candidate)) {
            issues.push({ kind: 'passive', start: word.start, end: next.start + next.text.length, text: text.slice(word.start, next.start + next.text.length) })
            break
          }
          if (!/ly$/.test(candidate)) break
        }
      }
    })
  }
  for (const [phrase, suggestion] of Object.entries(SIMPLER)) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi')
    for (let m = re.exec(text); m; m = re.exec(text)) issues.push({ kind: 'complex', start: m.index, end: m.index + m[0].length, text: m[0], suggestion })
  }
  issues.sort((a, b) => a.start - b.start)
  const safeWords = Math.max(words, 1)
  const safeSentences = Math.max(sentences, 1)
  return {
    words,
    sentences,
    syllables,
    readingEase: words ? 206.835 - 1.015 * (safeWords / safeSentences) - 84.6 * (syllables / safeWords) : 0,
    grade: words ? Math.max(0, grade(safeWords, safeSentences, syllables)) : 0,
    issues,
  }
}

const EASE_BANDS: [number, string][] = [
  [90, 'Very easy'],
  [80, 'Easy'],
  [70, 'Fairly easy'],
  [60, 'Plain English'],
  [50, 'Fairly difficult'],
  [30, 'Difficult'],
  [-Infinity, 'Very difficult'],
]

const STYLE: Record<ReadabilityMeterIssueKind, { mark: string; swatch: string; name: string }> = {
  'very-hard': { mark: 'bg-[color-mix(in_oklab,var(--color-danger)_22%,transparent)]', swatch: 'bg-[color-mix(in_oklab,var(--color-danger)_40%,transparent)]', name: 'Very hard sentences' },
  hard: { mark: 'bg-[color-mix(in_oklab,var(--color-warning)_26%,transparent)]', swatch: 'bg-[color-mix(in_oklab,var(--color-warning)_50%,transparent)]', name: 'Hard sentences' },
  passive: { mark: 'underline decoration-success decoration-2 underline-offset-4', swatch: 'border-b-2 border-success', name: 'Passive voice' },
  adverb: { mark: 'underline decoration-accent-strong decoration-wavy decoration-2 underline-offset-4', swatch: 'border-b-2 border-dotted border-accent-strong', name: 'Adverbs' },
  complex: { mark: 'underline decoration-ink-soft decoration-dashed decoration-2 underline-offset-4', swatch: 'border-b-2 border-dashed border-ink-soft', name: 'Simpler word available' },
}

/**
 * A writing field that grades itself as you type: Flesch reading ease and
 * Flesch–Kincaid grade for the whole text, and marks in the text itself for
 * what drags it down — long, hard sentences, passive constructions, adverbs,
 * and words with a plainer equivalent.
 *
 * The marks are drawn on a layer behind a real textarea that mirrors its text,
 * so the field keeps native editing, undo and spellcheck. The same findings are
 * listed under the field, because underlines and tints say nothing to a screen
 * reader. Syllables are estimated from vowel groups and sentences are split with
 * Intl.Segmenter where the browser has it — good enough to steer by, which is
 * what a grade is for.
 */
export function ReadabilityMeter({ value, defaultValue = '', onValueChange, targetGrade = 8, label = 'Draft', rows = 8, className }: ReadabilityMeterProps) {
  const [own, setOwn] = useState(defaultValue)
  const text = value ?? own
  const stats = useMemo(() => analyzeReadability(text), [text])
  const backdrop = useRef<HTMLDivElement>(null)
  const id = useId()

  const layers = useMemo(() => {
    const cuts = new Set([0, text.length])
    stats.issues.forEach((issue) => cuts.add(issue.start).add(issue.end))
    const points = [...cuts].sort((a, b) => a - b)
    return points.slice(0, -1).map((start, i) => {
      const end = points[i + 1]!
      const kinds = stats.issues.filter((issue) => issue.start <= start && issue.end >= end).map((issue) => issue.kind)
      return { start, end, kinds }
    })
  }, [text, stats])

  const onScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop
  }

  const ease = EASE_BANDS.find(([floor]) => stats.readingEase >= floor)![1]
  const count = (kind: ReadabilityMeterIssueKind) => stats.issues.filter((issue) => issue.kind === kind).length
  const box = 'whitespace-pre-wrap break-words px-4 py-3 font-sans text-[14px] font-medium leading-[1.7] [scrollbar-gutter:stable]'
  const meets = stats.grade <= targetGrade

  return (
    <div className={cn('grid w-full grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className="text-[12px] font-semibold text-ink-soft">
          {label}
        </label>
        <div className="relative overflow-hidden rounded-[var(--radius-field)] border border-line bg-surface focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <div ref={backdrop} aria-hidden="true" className={cn(box, 'pointer-events-none absolute inset-0 overflow-hidden text-transparent')}>
            {layers.map((layer) => (
              <span key={layer.start} className={cn(layer.kinds.map((kind) => STYLE[kind].mark))}>
                {text.slice(layer.start, layer.end)}
              </span>
            ))}
            {'\n'}
          </div>
          <textarea
            id={id}
            rows={rows}
            value={text}
            onScroll={onScroll}
            onChange={(event) => {
              if (value === undefined) setOwn(event.target.value)
              onValueChange?.(event.target.value)
            }}
            className={cn(box, 'relative block w-full resize-y bg-transparent text-ink caret-ink outline-none')}
          />
        </div>
        <details className="text-ink-soft">
          <summary className="cursor-pointer text-[12px] font-semibold">
            {stats.issues.length} suggestion{stats.issues.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-[12px]">
            {stats.issues.map((issue, i) => (
              <li key={i}>
                <strong className="font-bold text-ink">{STYLE[issue.kind].name.replace(/s$/, '')}:</strong> “{issue.text.length > 90 ? `${issue.text.slice(0, 90)}…` : issue.text}”
                {issue.suggestion && ` → try “${issue.suggestion}”`}
              </li>
            ))}
          </ul>
        </details>
      </div>

      <aside aria-label="Readability" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div role="status" className="flex flex-col gap-0.5">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Grade
          </Text>
          <Text size="title" tabular>
            {stats.words ? stats.grade.toFixed(1) : '—'}
          </Text>
          <Text size="caption" weight="semibold" tone={stats.words ? (meets ? 'success' : 'danger') : 'faint'}>
            {stats.words ? (meets ? `At or under grade ${targetGrade}` : `Above the target of ${targetGrade}`) : 'Start typing'}
          </Text>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          <dt className="text-ink-soft">Reading ease</dt>
          <dd className="text-right font-bold tabular-nums text-ink">{stats.words ? `${Math.round(stats.readingEase)} · ${ease}` : '—'}</dd>
          <dt className="text-ink-soft">Words</dt>
          <dd className="text-right font-bold tabular-nums text-ink">{stats.words}</dd>
          <dt className="text-ink-soft">Sentences</dt>
          <dd className="text-right font-bold tabular-nums text-ink">{stats.sentences}</dd>
          <dt className="text-ink-soft">Reading time</dt>
          <dd className="text-right font-bold tabular-nums text-ink">{Math.max(1, Math.round(stats.words / 230))} min</dd>
        </dl>
        <ul aria-label="Issues by kind" className="flex flex-col gap-1.5 border-t border-line pt-3">
          {(Object.keys(STYLE) as ReadabilityMeterIssueKind[]).map((kind) => (
            <li key={kind} className="flex items-center gap-2 text-[12px] text-ink-soft">
              <span aria-hidden="true" className={cn('h-3 w-5 shrink-0 rounded-[var(--radius-2)]', STYLE[kind].swatch)} />
              <span className="flex-1">{STYLE[kind].name}</span>
              <span className="font-bold tabular-nums text-ink">{count(kind)}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
