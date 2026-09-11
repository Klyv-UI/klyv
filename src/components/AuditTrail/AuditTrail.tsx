'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Text } from '../Text'
import { Collapse } from '../Collapse'
import { relativeTime, useRelativeClock } from '../../lib/time'

export interface AuditChange {
  field: string
  from: string | null
  to: string | null
}

export interface AuditEntry {
  id: string
  at: Date
  actor: { name: string; you?: boolean }
  /** What happened, as a sentence fragment: "changed the daily limit". */
  action: string
  /** What it happened to. */
  target?: string
  changes?: AuditChange[]
  /** Where it came from — an IP, a device, an API key. */
  source?: string
}

export interface AuditTrailProps {
  entries: AuditEntry[]
  /** Accessible name for the list. */
  label: string
  /** Show only entries by this actor name. */
  actorFilter?: string
  /** Merged last, so it wins. */
  className?: string
}

const dayKey = (date: Date) => date.toDateString()

const dayLabel = (date: Date) => {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  if (date.toDateString() === today) return 'Today'
  if (date.toDateString() === yesterday) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Who changed what, when, and what the value was before.
 *
 * The before value is the whole difference between an audit trail and an
 * activity feed. "Sarah changed the daily limit" is a log line; "Sarah changed
 * the daily limit from £500 to £5,000" is the thing an investigation actually
 * needs, and it is the field every implementation drops first because storing
 * it is inconvenient.
 *
 * Entries are grouped by day and never reordered within one. An audit trail
 * that sorts by anything other than time stops being evidence — and for the
 * same reason there is no edit, no delete and no "collapse similar".
 *
 * Absolute timestamps sit under the relative ones rather than replacing them.
 * "2 hours ago" is what a reader scans; "14:32:07" is what they quote.
 */
export function AuditTrail({ entries, label, actorFilter, className }: AuditTrailProps) {
  const [open, setOpen] = useState<string | null>(null)
  const now = useRelativeClock(entries[0]?.at)

  const groups = useMemo(() => {
    const filtered = actorFilter
      ? entries.filter((entry) => entry.actor.name === actorFilter)
      : entries
    // Newest first, and stable within a day.
    const sorted = [...filtered].sort((a, b) => b.at.getTime() - a.at.getTime())
    const map = new Map<string, AuditEntry[]>()
    for (const entry of sorted) {
      const key = dayKey(entry.at)
      const bucket = map.get(key)
      if (bucket) bucket.push(entry)
      else map.set(key, [entry])
    }
    return [...map.entries()]
  }, [actorFilter, entries])

  return (
    <div aria-label={label} className={cn('flex flex-col gap-4', className)}>
      {groups.map(([key, day]) => (
        <section key={key} className="flex flex-col gap-1.5">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            {dayLabel(day[0].at)}
          </Text>

          <ul className="flex flex-col">
            {day.map((entry) => {
              const expandable = (entry.changes?.length ?? 0) > 0
              const isOpen = open === entry.id
              return (
                <li key={entry.id} className="border-b border-line last:border-b-0">
                  <div className="flex items-start gap-3 py-3">
                    <Avatar name={entry.actor.name} size="sm" />

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Text size="body" weight="medium" leading="normal">
                        <strong className="font-bold">
                          {entry.actor.you ? 'You' : entry.actor.name}
                        </strong>{' '}
                        {entry.action}
                        {entry.target ? (
                          <>
                            {' '}
                            <strong className="font-bold">{entry.target}</strong>
                          </>
                        ) : null}
                      </Text>

                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Text as="span" size="caption" tone="faint">
                          {relativeTime(entry.at, now)}
                        </Text>
                        {/* The one people quote, under the one people scan. */}
                        <Text as="span" size="micro" tone="faint" tabular>
                          {entry.at.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </Text>
                        {entry.source && (
                          <Text as="span" size="micro" tone="faint">
                            · {entry.source}
                          </Text>
                        )}
                      </div>

                      {expandable && (
                        <Collapse open={isOpen}>
                          <dl className="mt-1 flex flex-col gap-1 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
                            {entry.changes?.map((change) => (
                              <div key={change.field} className="flex flex-wrap items-baseline gap-2">
                                <Text as="dt" size="caption" tone="faint">
                                  {change.field}
                                </Text>
                                <Text as="dd" size="caption" className="flex items-baseline gap-2">
                                  <span className="text-ink-faint line-through">
                                    {change.from ?? 'not set'}
                                  </span>
                                  <span aria-hidden="true" className="text-ink-faint">
                                    →
                                  </span>
                                  <span className="font-bold">{change.to ?? 'not set'}</span>
                                </Text>
                              </div>
                            ))}
                          </dl>
                        </Collapse>
                      )}
                    </div>

                    {expandable && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : entry.id)}
                        className="shrink-0 rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                      >
                        {isOpen ? 'Hide' : `${entry.changes?.length} ${entry.changes?.length === 1 ? 'field' : 'fields'}`}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
