'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { StarIcon } from '../internal/icons'
import { Surface } from '../Surface'
import { Text } from '../Text'

export type ReviewSummaryStars = 1 | 2 | 3 | 4 | 5

export interface ReviewSummaryHighlight {
  id: string
  /** A short excerpt from the review. */
  quote: string
  /** Who wrote it — "Maya R., verified buyer". */
  author: string
  /** The star rating that review gave. */
  rating: number
}

export interface ReviewSummaryProps {
  /** Mean rating, 0–5. Shown to one decimal. */
  average: number
  /** Number of reviews at each star level. The total is their sum. */
  distribution: Record<ReviewSummaryStars, number>
  /** Controlled star filter; null shows every review. */
  filter?: ReviewSummaryStars | null
  /** Initial filter when uncontrolled. */
  defaultFilter?: ReviewSummaryStars | null
  /** Called when a distribution row is toggled. Without it, and without `filter`, the rows are not buttons. */
  onFilterChange?: (filter: ReviewSummaryStars | null) => void
  /** Up to a few excerpts shown under the bars. */
  highlights?: ReviewSummaryHighlight[]
  /** Merged last, so it wins. */
  className?: string
}

const LEVELS: ReviewSummaryStars[] = [5, 4, 3, 2, 1]

/** Five stars filled to a fraction — 4.6 fills the fifth star most of the way. */
function Stars({ value, size = 16, label }: { value: number; size?: number; label: string }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100))
  const row = (tone: string) =>
    Array.from({ length: 5 }, (_, index) => <StarIcon key={index} size={size} className={cn('shrink-0', tone)} />)
  return (
    <span role="img" aria-label={label} className="relative inline-flex">
      <span className="inline-flex gap-0.5">{row('text-line-strong')}</span>
      <span className="absolute inset-y-0 left-0 inline-flex gap-0.5 overflow-hidden" style={{ width: `${percent}%` }}>
        {row('text-accent-strong')}
      </span>
    </span>
  )
}

/**
 * The shape of a product’s reviews before any of the reviews themselves.
 *
 * An average alone hides the thing buyers most want to know — whether the
 * complaints are common or a loud few — so the 5 → 1 distribution sits beside
 * it. Each bar doubles as the filter for its star level: the place a reader
 * notices "there are a lot of 2-star reviews" is the place they want to read
 * them. The rows are toggle buttons with a pressed state, and their names give
 * the count and share in words, since the bar length is visual only.
 */
export function ReviewSummary({
  average,
  distribution,
  filter: controlledFilter,
  defaultFilter = null,
  onFilterChange,
  highlights,
  className,
}: ReviewSummaryProps) {
  const [uncontrolled, setUncontrolled] = useState<ReviewSummaryStars | null>(defaultFilter)
  const filter = controlledFilter === undefined ? uncontrolled : controlledFilter
  const interactive = Boolean(onFilterChange) || controlledFilter !== undefined
  const total = LEVELS.reduce((sum, level) => sum + (distribution[level] ?? 0), 0)

  const choose = (level: ReviewSummaryStars) => {
    const next = filter === level ? null : level
    if (controlledFilter === undefined) setUncontrolled(next)
    onFilterChange?.(next)
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex shrink-0 flex-col gap-2">
          <Text size="display" tabular>
            {average.toFixed(1)}
          </Text>
          <Stars value={average} label={`Rated ${average.toFixed(1)} out of 5`} />
          <Text size="caption" tone="faint">
            Based on {plural(total, 'review')}
          </Text>
        </div>

        <ul className="flex flex-1 flex-col gap-1" aria-label="Rating distribution">
          {LEVELS.map((level) => {
            const count = distribution[level] ?? 0
            const share = total === 0 ? 0 : Math.round((count / total) * 100)
            const body = (
              <>
                <span className="inline-flex w-8 shrink-0 items-center gap-1 text-[12px] font-bold text-ink-soft">
                  {level}
                  <StarIcon size={11} className="text-accent-strong" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                  <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${share}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink-faint">
                  {share}%
                </span>
              </>
            )
            const name = `${level} star${level === 1 ? '' : 's'}: ${plural(count, 'review')}, ${share}%`
            return (
              <li key={level}>
                {interactive ? (
                  <button
                    type="button"
                    aria-pressed={filter === level}
                    aria-label={`${name}. Show only these`}
                    onClick={() => choose(level)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-surface-muted',
                      filter === level && 'bg-accent-soft hover:bg-accent-soft',
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div role="img" aria-label={name} className="flex items-center gap-3 px-2 py-1.5">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {highlights && highlights.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Highlighted reviews">
          {highlights.map((review) => (
            <li key={review.id}>
              <Surface as="figure" variant="tile" padding="md" className="h-full gap-2">
                <Stars value={review.rating} size={12} label={`${review.rating} out of 5`} />
                <blockquote>
                  <Text size="body" weight="medium" leading="normal">
                    “{review.quote}”
                  </Text>
                </blockquote>
                <Text as="figcaption" size="caption" tone="faint">
                  {review.author}
                </Text>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
