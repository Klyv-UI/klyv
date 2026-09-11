'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Tooltip } from '../Tooltip'

export type PresenceStatus = 'active' | 'idle' | 'away'

export interface Participant {
  id: string
  name: string
  status?: PresenceStatus
  color?: string
  /** Marks the local person, who is always listed first and named "you". */
  you?: boolean
}

export interface PresenceBarProps {
  participants: Participant[]
  /** Accessible name for the group. */
  label: string
  /** Avatars shown before the rest collapse into a count. */
  max?: number
  size?: 'sm' | 'md'
  /** Announce arrivals and departures through a live region. */
  announce?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const RINGS: Record<PresenceStatus, string> = {
  active: 'ring-success',
  idle: 'ring-warning',
  away: 'ring-line-strong',
}

const STATUS_TEXT: Record<PresenceStatus, string> = {
  active: 'active now',
  idle: 'idle',
  away: 'away',
}

/**
 * Who else is here, with arrivals and departures that can be seen and heard.
 *
 * The list is sorted so the local person comes first and the rest hold a stable
 * order by id — not by arrival. Sorting by arrival makes every join reshuffle
 * the row, and the movement reads as several people leaving and returning
 * rather than as one person joining.
 *
 * Status is a ring around the avatar *and* part of the accessible name, since a
 * coloured ring alone tells nobody who cannot see it whether a colleague is
 * actually at their desk.
 *
 * Joins and departures are announced through a polite live region, which is the
 * whole reason this is not `AvatarGroup` with a status dot bolted on: a
 * presence list changes on its own, and a change nobody is told about is not
 * presence, it is decoration.
 */
export function PresenceBar({
  participants,
  label,
  max = 5,
  size = 'md',
  announce = true,
  className,
}: PresenceBarProps) {
  const previous = useRef<string[]>([])
  const [announcement, setAnnouncement] = useState('')

  // Local person first, then a stable order that a join cannot reshuffle.
  const ordered = [...participants].sort((a, b) => {
    if (a.you !== b.you) return a.you ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  // Keyed on the ids alone: `ordered` is a fresh array every render, and
  // depending on it would run this on renders where nobody came or went.
  const roster = ordered.map((person) => person.id).join(',')

  useEffect(() => {
    if (!announce) return
    const ids = roster ? roster.split(',') : []
    const before = previous.current
    previous.current = ids
    if (before.length === 0) return

    const joined = ordered.filter((person) => !before.includes(person.id) && !person.you)
    const left = before.filter((id) => !ids.includes(id))
    const parts: string[] = []
    if (joined.length > 0) parts.push(`${joined.map((person) => person.name).join(', ')} joined`)
    if (left.length > 0) parts.push(`${left.length} left`)
    if (parts.length > 0) setAnnouncement(parts.join('. '))
    // `ordered` is read for names only; `roster` is what decides a change.
  }, [announce, roster]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = ordered.slice(0, max)
  const overflow = ordered.slice(max)

  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center -space-x-2">
        {shown.map((person) => {
          const status = person.status ?? 'active'
          return (
            <Tooltip
              key={person.id}
              content={`${person.you ? `${person.name} (you)` : person.name} · ${STATUS_TEXT[status]}`}
            >
              <span
                className={cn(
                  'motion-safe-only inline-flex rounded-full ring-2 transition-transform duration-[var(--duration-slow)] hover:z-10 hover:-translate-y-0.5',
                  RINGS[status],
                  status === 'away' && 'opacity-60',
                )}
              >
                <Avatar
                  name={person.name}
                  size={size === 'sm' ? 'sm' : 'md'}
                  className="border-2 border-surface"
                />
              </span>
            </Tooltip>
          )
        })}

        {overflow.length > 0 && (
          <Tooltip content={overflow.map((person) => person.name).join(', ')}>
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full border-2 border-surface bg-surface-muted ring-2 ring-line',
                size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
              )}
            >
              <Text as="span" size="micro" tone="soft" tabular>
                +{overflow.length}
              </Text>
            </span>
          </Tooltip>
        )}
      </div>

      <Text size="caption" tone="faint">
        {ordered.length === 1 ? 'Only you' : `${ordered.length} here`}
      </Text>

      <VisuallyHidden>
        <ul>
          {ordered.map((person) => (
            <li key={person.id}>
              {person.you ? `${person.name} (you)` : person.name} — {STATUS_TEXT[person.status ?? 'active']}
            </li>
          ))}
        </ul>
        <p role="status" aria-live="polite">
          {announcement}
        </p>
      </VisuallyHidden>
    </div>
  )
}
