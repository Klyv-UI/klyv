'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Text } from '../Text'

export interface FilterChip<T extends string = string> {
  value: T
  label: string
  /** Count of matching records, shown after the label. */
  count?: number
}

export interface FilterBarProps<T extends string = string> {
  /** Quick toggles shown as Chips. */
  filters?: FilterChip<T>[]
  /** Currently active filter values. */
  value?: T[]
  /** Called with the active filter ids. */
  onValueChange?: (value: T[]) => void
  /** Extra controls — a Select, a SearchField, a date range. */
  children?: ReactNode
  /** Total matching records, announced when it changes. */
  resultCount?: number
  /** Noun for the result count, e.g. transactions. */
  resultLabel?: string
  /** Shown when anything is active. */
  onClear?: () => void
  /** Accessible name for the region. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The control strip above a list: quick toggles, any extra controls, the result
 * count, and one way to clear everything.
 *
 * The count is a live region, because filtering changes the list below without
 * moving focus — otherwise a screen reader user gets no confirmation that
 * anything happened.
 */
export function FilterBar<T extends string = string>({
  filters = [],
  value = [],
  onValueChange,
  children,
  resultCount,
  resultLabel = 'results',
  onClear,
  label = 'Filters',
  className,
}: FilterBarProps<T>) {
  const active = value.length > 0

  const toggle = (entry: T) => {
    onValueChange?.(
      value.includes(entry) ? value.filter((item) => item !== entry) : [...value, entry],
    )
  }

  return (
    <div
      role="search"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}
    >
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((filter) => (
            <Chip
              key={filter.value}
              size="sm"
              label={filter.count === undefined ? filter.label : `${filter.label} (${filter.count})`}
              selected={value.includes(filter.value)}
              onClick={() => toggle(filter.value)}
            />
          ))}
        </div>
      )}

      {children}

      <div className="ml-auto flex items-center gap-2">
        {resultCount !== undefined && (
          <Text size="caption" weight="semibold" tone="faint" tabular role="status" aria-live="polite">
            {resultCount} {resultLabel}
          </Text>
        )}
        {onClear && active && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>
    </div>
  )
}
