'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PLOT_WIDTH, PlotAnnouncer, PlotTip, useChartCursor, useDrawIn } from '../internal/plot'

export interface WordCloudWord {
  text: string
  /** Frequency, score or count. Font size follows its square root, so area tracks weight. */
  weight: number
}

export interface WordCloudProps {
  words: WordCloudWord[]
  /** Accessible name for the cloud. */
  label: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Smallest and largest font size, in viewBox pixels. */
  fontSize?: [number, number]
  /** Share of words turned 90°, from 0 to 1. Which ones is decided by the seed. */
  rotation?: number
  /** Same seed, same words, same layout — so a cloud does not reshuffle on every render. */
  seed?: number
  /** Draw at most this many words, heaviest first. */
  maxWords?: number
  /** Format weights in the tooltip and the list. */
  format?: (value: number) => string
  /** What a weight measures — “Mentions”. */
  valueLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

interface WordCloudPlaced {
  word: WordCloudWord
  x: number
  y: number
  size: number
  rotated: boolean
  rank: number
}

/** Small, fast, seedable PRNG (mulberry32). */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let measureContext: CanvasRenderingContext2D | null | undefined

/** Canvas text metrics where there is a canvas; an average glyph width where there is not. */
function measure(text: string, size: number, family: string | null) {
  if (measureContext === undefined) {
    measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (measureContext && family) {
    measureContext.font = `700 ${size}px ${family}`
    return measureContext.measureText(text).width
  }
  return text.length * size * 0.58
}

/**
 * Places words on an Archimedean spiral out from the centre, each at the first
 * spot where its box collides with nothing already placed. Words that reach
 * the edge without finding room are returned as dropped, never overlapped.
 */
export function wordCloudLayout(
  words: WordCloudWord[],
  { width, height, fontSize, rotation, seed, family }: { width: number; height: number; fontSize: [number, number]; rotation: number; seed: number; family: string | null },
) {
  const next = random(seed)
  const sorted = [...words].filter((word) => word.text && Number.isFinite(word.weight)).sort((a, b) => b.weight - a.weight)
  const max = Math.sqrt(Math.max(0, sorted[0]?.weight ?? 1))
  const min = Math.sqrt(Math.max(0, sorted[sorted.length - 1]?.weight ?? 0))
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
  const placed: WordCloudPlaced[] = []
  const dropped: WordCloudWord[] = []
  const aspect = width / height

  sorted.forEach((word, rank) => {
    const t = max === min ? 1 : (Math.sqrt(Math.max(0, word.weight)) - min) / (max - min)
    const size = Math.round(fontSize[0] + t * (fontSize[1] - fontSize[0]))
    const rotated = rank > 0 && next() < rotation
    const textWidth = measure(word.text, size, family) + 4
    const textHeight = size * 0.92 + 2
    const [w, h] = rotated ? [textHeight, textWidth] : [textWidth, textHeight]
    const phase = next() * Math.PI * 2
    for (let step = 0; step < 6000; step += 1) {
      const angle = step * 0.21
      const radius = step * 0.34
      const x = width / 2 + radius * Math.cos(angle + phase) * Math.sqrt(aspect)
      const y = height / 2 + (radius * Math.sin(angle + phase)) / Math.sqrt(aspect)
      if (radius > Math.hypot(width, height) / 1.6) break
      const box = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }
      if (box.x0 < 2 || box.y0 < 2 || box.x1 > width - 2 || box.y1 > height - 2) continue
      if (boxes.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)) continue
      boxes.push(box)
      placed.push({ word, x, y, size, rotated, rank })
      return
    }
    dropped.push(word)
  })
  return { placed, dropped, sorted }
}

const TONES = ['fill-ink', 'fill-[color-mix(in_oklab,var(--color-accent-strong)_55%,var(--color-ink))]', 'fill-ink-soft', 'fill-ink-faint']

/**
 * Words sized by weight, packed into a shape you can scan.
 *
 * A word cloud is only honest if its sizes are, so font size follows the
 * square root of weight — area, not height, is what reads as “bigger” — and
 * nothing overlaps: each word walks out along a spiral until its box is clear,
 * and a word that finds no room is left out and said so, rather than drawn on
 * top of another. The seed makes the layout repeatable, so the same data never
 * reshuffles between renders or screenshots.
 *
 * It is a picture of emphasis, not a way to compare numbers; the list beneath
 * it, ordered by weight, is the accessible version and the precise one.
 */
export function WordCloud({
  words,
  label,
  height = 320,
  fontSize = [12, 52],
  rotation = 0,
  seed = 7,
  maxWords = 80,
  format = formatTick,
  valueLabel = 'Weight',
  className,
}: WordCloudProps) {
  const listId = useId()
  const drawn = useDrawIn()
  const ref = useRef<HTMLDivElement>(null)
  const [family, setFamily] = useState<string | null>(null)
  useEffect(() => {
    if (ref.current) setFamily(getComputedStyle(ref.current).fontFamily || null)
  }, [])

  const [low, high] = fontSize
  const { placed, dropped, sorted } = useMemo(
    () => wordCloudLayout(words.slice().sort((a, b) => b.weight - a.weight).slice(0, maxWords), { width: PLOT_WIDTH, height, fontSize: [low, high], rotation, seed, family }),
    [words, maxWords, height, low, high, rotation, seed, family],
  )
  const { active, setActive, keyProps } = useChartCursor(placed.length)
  const current = active === null ? null : placed[active]
  const tier = (rank: number) => TONES[Math.min(TONES.length - 1, Math.floor((rank / Math.max(1, sorted.length)) * TONES.length))]

  return (
    <div ref={ref} className={cn('flex w-full flex-col gap-2', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${placed.length} words; use arrow keys to step through them by weight.`}
          aria-describedby={listId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {placed.map((entry, index) => (
            <text
              key={`${entry.word.text}-${entry.rank}`}
              x={entry.x}
              y={entry.y}
              textAnchor="middle"
              dominantBaseline="central"
              transform={entry.rotated ? `rotate(-90 ${entry.x} ${entry.y})` : undefined}
              onPointerEnter={() => setActive(index)}
              className={cn(
                'cursor-default font-bold transition-opacity',
                DRAW_IN_CLASS,
                active === index ? 'fill-ink underline' : tier(entry.rank),
                active !== null && active !== index && 'opacity-40',
              )}
              style={{
                fontSize: entry.size,
                opacity: drawn ? undefined : 0,
                transitionDelay: drawn ? `${Math.min(index * 12, 480)}ms` : '0ms',
              }}
            >
              {entry.word.text}
            </text>
          ))}
        </svg>
        {current && (
          <PlotTip x={current.x} y={current.y - current.size / 2} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={current.word.text} rows={[{ label: valueLabel, value: format(current.word.weight) }, { label: 'Rank', value: `${current.rank + 1} of ${sorted.length}` }]} />
          </PlotTip>
        )}
      </div>
      {dropped.length > 0 && (
        <p className="text-[11px] font-medium text-ink-faint">
          {dropped.length === 1 ? '1 word did not fit' : `${dropped.length} words did not fit`}:{' '}
          {dropped.map((word) => word.text).join(', ')}.
        </p>
      )}
      <VisuallyHidden>
        <ol id={listId}>
          {sorted.map((word, rank) => (
            <li key={`${word.text}-${rank}`}>{`${word.text}: ${format(word.weight)}`}</li>
          ))}
        </ol>
      </VisuallyHidden>
      <PlotAnnouncer message={current ? `${current.word.text}, ${valueLabel.toLowerCase()} ${format(current.word.weight)}, rank ${current.rank + 1}` : ''} />
    </div>
  )
}
