import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Text } from '../Text'

export interface BarListItem {
  id: string
  label: string
  value: number
  /** Makes the row a link. */
  href?: string
  icon?: IconComponent
}

export interface BarListProps {
  /** The rows. Sorted largest first unless `sorted` is off. */
  items: BarListItem[]
  /** Accessible name for the list. */
  label: string
  /** Turns a value into its printed figure. */
  format?: (value: number) => string
  /** Largest first. Turn off to keep the order you pass. */
  sorted?: boolean
  /** Show this many rows, and sum the rest into one. */
  limit?: number
  /** Label for the summed row when `limit` cuts the list. */
  otherLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

const plain = (value: number) => value.toLocaleString()

/**
 * Ranked horizontal bars — top pages, top referrers, top countries.
 *
 * The most common chart on a dashboard is not really a chart: it is a list in
 * which each row carries a bar proportional to its value. It is marked up as a
 * list rather than drawn as an SVG, so the label and the figure are real text a
 * screen reader reads in order and a person can select. The bar is decoration.
 */
export function BarList({
  items,
  label,
  format = plain,
  sorted = true,
  limit,
  otherLabel = 'Other',
  className,
}: BarListProps) {
  const ordered = sorted ? [...items].sort((a, b) => b.value - a.value) : items
  const rows: BarListItem[] =
    limit !== undefined && ordered.length > limit
      ? [
          ...ordered.slice(0, limit),
          {
            id: '__other',
            label: otherLabel,
            value: ordered.slice(limit).reduce((total, item) => total + item.value, 0),
          },
        ]
      : ordered
  const max = Math.max(1, ...rows.map((row) => row.value))

  return (
    <ul aria-label={label} className={cn('flex flex-col gap-1', className)}>
      {rows.map((row) => {
        const Icon = row.icon
        const inner = (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-[var(--radius-glyph)] bg-accent-soft transition-[width] duration-500 motion-safe-only"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
            <span className="relative flex min-w-0 items-center gap-2 px-2.5">
              {Icon && (
                <Icon size={14} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-soft" />
              )}
              <Text as="span" size="label" weight="semibold" truncate>
                {row.label}
              </Text>
            </span>
          </>
        )

        return (
          <li key={row.id} className="flex items-center gap-3">
            {row.href ? (
              <a
                href={row.href}
                className="relative flex h-8 min-w-0 flex-1 items-center rounded-[var(--radius-glyph)] transition-colors hover:bg-surface-muted"
              >
                {inner}
              </a>
            ) : (
              <div className="relative flex h-8 min-w-0 flex-1 items-center">{inner}</div>
            )}
            <Text as="span" size="label" weight="bold" tabular className="shrink-0">
              {format(row.value)}
            </Text>
          </li>
        )
      })}
    </ul>
  )
}
