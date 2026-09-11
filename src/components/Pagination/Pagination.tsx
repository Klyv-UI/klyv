'use client'

import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

export interface PaginationProps {
  /** Current page, one-based. */
  page: number
  /** Total number of pages. */
  pageCount: number
  onPageChange: (page: number) => void
  /** How many numbered buttons to show around the current page. */
  siblings?: number
  /** Accessible name for the control. */
  label?: string
  /** Show a compact form with only the arrows and a counter. */
  compact?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const GAP = 'gap' as const

/** Page numbers around `page`, with gaps where pages are skipped. */
function buildRange(page: number, pageCount: number, siblings: number): (number | typeof GAP)[] {
  const total = siblings * 2 + 5
  if (pageCount <= total) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const left = Math.max(2, page - siblings)
  const right = Math.min(pageCount - 1, page + siblings)
  const range: (number | typeof GAP)[] = [1]

  if (left > 2) range.push(GAP)
  for (let index = left; index <= right; index += 1) range.push(index)
  if (right < pageCount - 1) range.push(GAP)
  range.push(pageCount)

  return range
}

/**
 * Page navigation with a sliding window of page numbers. The first and last
 * page are always reachable, and the window keeps the control a fixed width so
 * the layout does not jump between pages.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  label = 'Pagination',
  compact = false,
  className,
}: PaginationProps) {
  const go = (next: number) => onPageChange(Math.min(pageCount, Math.max(1, next)))

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1.5', className)}>
      <IconButton
        icon={ChevronLeftIcon}
        label="Previous page"
        tone="plain"
        size="sm"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      />

      {compact ? (
        <Text size="caption" weight="semibold" tone="soft" tabular className="px-2">
          Page {page} of {pageCount}
        </Text>
      ) : (
        <ul className="flex list-none items-center gap-1">
          {buildRange(page, pageCount, siblings).map((entry, index) =>
            entry === GAP ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1">
                <Text as="span" size="caption" tone="faint">
                  ...
                </Text>
              </li>
            ) : (
              <li key={entry}>
                <button
                  type="button"
                  aria-current={entry === page ? 'page' : undefined}
                  aria-label={`Page ${entry}`}
                  onClick={() => go(entry)}
                  className={cn(
                    'tabular inline-flex size-9 items-center justify-center rounded-full text-[12px] transition-colors',
                    entry === page
                      ? 'bg-accent font-bold text-accent-ink'
                      : 'font-semibold text-ink-soft hover:bg-surface-muted hover:text-ink',
                  )}
                >
                  {entry}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <IconButton
        icon={ChevronRightIcon}
        label="Next page"
        tone="plain"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      />
      <span role="status" aria-live="polite" className="sr-only">
        Page {page} of {pageCount}
      </span>
    </nav>
  )
}
