'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { IconTile } from '../IconTile'
import { Text } from '../Text'
import { Collapse } from '../Collapse'
import { DescriptionList, type DescriptionItem } from '../DescriptionList'
import { List } from '../List'
import { ListItem } from '../ListItem'
import { ChevronDownIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface ActivityEntry {
  id: string
  /** ISO yyyy-mm-dd. Entries are grouped by this. */
  date: string
  title: string
  subtitle?: string
  /** Signed amount. Positive renders as a credit. */
  amount?: number
  /** Glyph for the row. Falls back to an avatar from the title. */
  icon?: IconComponent
  /** Expanded detail. Rows without it do not expand. */
  details?: DescriptionItem[]
  /** Extra content in the expanded panel. */
  extra?: ReactNode
}

export interface ActivityFeedProps {
  entries: ActivityEntry[]
  /** Accessible name for the feed. */
  label: string
  /** Format an amount for display. */
  format?: (amount: number) => string
  /** Show a running total per day group. */
  showDailyTotals?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (same(date, today)) return 'Today'
  if (same(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * A transaction feed grouped by day, with sticky date headers and rows that
 * expand in place.
 *
 * Two things make a real feed different from a list. The first is grouping: a
 * flat list of eighty transactions is unreadable, but the same rows under
 * "Today", "Yesterday" and a date are scannable. The second is expansion —
 * opening a row in place keeps the reader where they were, which a detail
 * route does not.
 *
 * Rows with no detail do not become buttons, so nothing offers an interaction
 * that leads nowhere.
 */
export function ActivityFeed({
  entries,
  label,
  format = (amount) => `${amount < 0 ? '-' : '+'}$${Math.abs(amount).toFixed(2)}`,
  showDailyTotals = false,
  className,
}: ActivityFeedProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>()
    for (const entry of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const bucket = map.get(entry.date)
      if (bucket) bucket.push(entry)
      else map.set(entry.date, [entry])
    }
    return [...map.entries()]
  }, [entries])

  return (
    <div className={cn('flex flex-col', className)}>
      {groups.map(([date, rows]) => {
        const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
        return (
          <section key={date} aria-label={formatDay(date)}>
            <div className="sticky top-0 z-[var(--z-raised)] flex items-baseline justify-between gap-3 bg-surface/90 py-1.5 backdrop-blur-sm">
              <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                {formatDay(date)}
              </Text>
              {showDailyTotals && (
                <Text size="caption" weight="bold" tone={total >= 0 ? 'success' : 'soft'} tabular>
                  {format(total)}
                </Text>
              )}
            </div>

            <List label={`${label}, ${formatDay(date)}`}>
              {rows.map((row) => {
                const open = expanded === row.id
                const expandable = Boolean(row.details?.length || row.extra)
                return (
                  <li key={row.id}>
                    <ListItem
                      as="div"
                      leading={
                        row.icon ? <IconTile icon={row.icon} /> : <Avatar name={row.title} />
                      }
                      title={row.title}
                      subtitle={row.subtitle}
                      value={row.amount !== undefined ? format(row.amount) : undefined}
                      valueTone={row.amount !== undefined && row.amount > 0 ? 'success' : 'default'}
                      onClick={expandable ? () => setExpanded(open ? null : row.id) : undefined}
                      trailing={
                        expandable ? (
                          <span className="flex shrink-0 items-center gap-2">
                            {row.amount !== undefined && (
                              <Text
                                as="span"
                                tabular
                                tone={row.amount > 0 ? 'success' : 'default'}
                              >
                                {format(row.amount)}
                              </Text>
                            )}
                            <ChevronDownIcon
                              size={14}
                              className={cn(
                                'shrink-0 text-ink-faint transition-transform',
                                open && 'rotate-180',
                              )}
                            />
                          </span>
                        ) : undefined
                      }
                    />
                    {expandable && (
                      <Collapse open={open}>
                        <div className="ml-[60px] mr-2.5 mb-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
                          {row.details && <DescriptionList items={row.details} divided />}
                          {row.extra && <div className="mt-3">{row.extra}</div>}
                        </div>
                      </Collapse>
                    )}
                  </li>
                )
              })}
            </List>
          </section>
        )
      })}
    </div>
  )
}
