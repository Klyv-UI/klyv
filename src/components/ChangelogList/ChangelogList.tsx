import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tag, type TagTone } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { formatDate } from '../../lib/format'

export interface ChangelogEntry {
  id: string
  date: Date
  title: string
  /** "v2.14". */
  version?: string
  body?: ReactNode
  /** "New", "Improved", "Fixed" get their own tones; anything else is neutral. */
  tags?: string[]
  href?: string
  /** A screenshot or clip. timeline only. */
  media?: ReactNode
}

export interface ChangelogListProps {
  entries: ChangelogEntry[]
  /** When the reader last looked. Later entries are marked new. */
  unreadSince?: Date
  /** timeline for a changelog page; compact for a "What's new" popover. */
  variant?: 'timeline' | 'compact'
  label?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
}

const TAG_TONES: Record<string, TagTone> = {
  new: 'accent',
  feature: 'accent',
  improved: 'neutral',
  improvement: 'neutral',
  fixed: 'outline',
  fix: 'outline',
}

/**
 * Product updates, newest first — as a public changelog page, or compact in the
 * "What's new" panel inside the app.
 *
 * Entries newer than the reader's last visit carry an accent dot and the word
 * "New" for assistive tech, which is the whole point of an in-app changelog:
 * a list of everything that has ever shipped is an archive, a list with the
 * unseen ones marked is news.
 */
export function ChangelogList({
  entries,
  unreadSince,
  variant = 'timeline',
  label = 'Changelog',
  headingLevel: Heading = 'h2',
  className,
}: ChangelogListProps) {
  const isUnread = (entry: ChangelogEntry) => Boolean(unreadSince && entry.date > unreadSince)

  const title = (entry: ChangelogEntry, size: string) =>
    entry.href ? (
      <a href={entry.href} className={cn(size, 'text-ink underline-offset-4 hover:underline')}>
        {entry.title}
      </a>
    ) : (
      <span className={cn(size, 'text-ink')}>{entry.title}</span>
    )

  const tags = (entry: ChangelogEntry) =>
    entry.tags && entry.tags.length > 0 ? (
      <span className="flex flex-wrap gap-1">
        {entry.tags.map((tag) => (
          <Tag key={tag} size="sm" tone={TAG_TONES[tag.toLowerCase()] ?? 'neutral'}>
            {tag}
          </Tag>
        ))}
      </span>
    ) : null

  if (variant === 'compact') {
    return (
      <ol aria-label={label} className={cn('flex flex-col', className)}>
        {entries.map((entry) => {
          const unread = isUnread(entry)
          return (
            <li key={entry.id} className="flex gap-3 border-b border-line py-3 last:border-0">
              <span
                aria-hidden="true"
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-accent-strong' : 'bg-transparent')}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <Heading className="leading-tight">
                  {unread && <VisuallyHidden>New: </VisuallyHidden>}
                  {title(entry, 'text-[13px] font-bold')}
                </Heading>
                {entry.body && (
                  <Text size="caption" tone="soft" leading="normal" className="line-clamp-2">
                    {entry.body}
                  </Text>
                )}
                <Text size="micro" weight="semibold" tone="faint">
                  <time dateTime={entry.date.toISOString()}>{formatDate(entry.date)}</time>
                  {entry.version && ` · ${entry.version}`}
                </Text>
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol aria-label={label} className={cn('flex flex-col', className)}>
      {entries.map((entry) => {
        const unread = isUnread(entry)
        return (
          <li key={entry.id} className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:gap-8">
            <div className="flex items-center gap-2 md:flex-col md:items-start md:pt-0.5">
              <Text size="label" weight="bold" tone="soft">
                <time dateTime={entry.date.toISOString()}>{formatDate(entry.date)}</time>
              </Text>
              {entry.version && (
                <Tag size="sm" tone="outline">
                  {entry.version}
                </Tag>
              )}
            </div>
            <div className="relative flex flex-col gap-3 border-l border-line pb-12 pl-6 last:pb-0">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -left-[5px] top-1 size-[9px] rounded-full ring-4 ring-surface',
                  unread ? 'bg-accent-strong' : 'bg-line-strong',
                )}
              />
              {tags(entry)}
              <Heading className="leading-tight">
                {unread && <VisuallyHidden>New: </VisuallyHidden>}
                {title(entry, 'text-[18px] font-extrabold tracking-[-0.02em]')}
              </Heading>
              {entry.body && (
                <div className="max-w-[68ch] text-[13px] font-medium leading-relaxed text-ink-soft">{entry.body}</div>
              )}
              {entry.media && (
                <div className="overflow-hidden rounded-[var(--radius-tile)] border border-line">{entry.media}</div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
