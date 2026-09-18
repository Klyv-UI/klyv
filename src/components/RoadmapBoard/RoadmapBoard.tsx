'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { SegmentedControl } from '../SegmentedControl'
import { Select } from '../Select'
import { Tabs } from '../Tabs'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { ChevronUpIcon } from '../internal/icons'

export interface RoadmapBoardColumn {
  id: string
  /** “Planned”, “In progress”, “Shipped”. */
  label: string
  /** A line under the column heading. */
  description?: string
}

export interface RoadmapBoardItem {
  id: string
  title: string
  description?: string
  /** Column id this item sits in. */
  status: string
  tags?: string[]
  votes: number
  /** Whether the current reader has voted. */
  voted?: boolean
  comments?: number
  /** Where the full discussion lives. Makes the title a link. */
  href?: string
}

export type RoadmapBoardSort = 'votes' | 'default'

export interface RoadmapBoardProps {
  items: RoadmapBoardItem[]
  /** Defaults to Planned, In progress and Shipped. */
  columns?: RoadmapBoardColumn[]
  /** Called after a vote is toggled; the count updates at once. Reject to roll it back. */
  onVote?: (id: string, voted: boolean) => void | Promise<void>
  /** Starting sort. */
  defaultSort?: RoadmapBoardSort
  /** A slot above the board — usually a “Suggest a feature” button. */
  suggest?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_COLUMNS: RoadmapBoardColumn[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'shipped', label: 'Shipped' },
]

/**
 * A public roadmap people can read and weigh in on.
 *
 * Columns are the three states customers actually ask about, and each is a
 * real list under a heading, so a screen reader hears “Planned, list, 6 items”
 * rather than a wall of cards. Votes are toggle buttons with a pressed state
 * and a name that includes the item — “Upvote Dark mode, 128 votes” — and the
 * count moves the moment it is pressed, rolling back only if the save fails.
 *
 * On a phone three columns side by side are three unreadable slivers, so below
 * the medium breakpoint the board becomes tabs, one column at a time. Filtering
 * by tag and sorting by votes apply to both.
 */
export function RoadmapBoard({ items, columns = DEFAULT_COLUMNS, onVote, defaultSort = 'votes', suggest, className }: RoadmapBoardProps) {
  const id = useId()
  const [tag, setTag] = useState('all')
  const [sort, setSort] = useState<RoadmapBoardSort>(defaultSort)
  const [tab, setTab] = useState(columns[0]?.id ?? '')
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')

  const tags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort()
  const votedOf = (item: RoadmapBoardItem) => overrides[item.id] ?? Boolean(item.voted)
  const votesOf = (item: RoadmapBoardItem) => item.votes + (votedOf(item) === Boolean(item.voted) ? 0 : votedOf(item) ? 1 : -1)

  const toggle = async (item: RoadmapBoardItem) => {
    const next = !votedOf(item)
    setOverrides((current) => ({ ...current, [item.id]: next }))
    setMessage(next ? `Voted for ${item.title}.` : `Vote removed from ${item.title}.`)
    try {
      await onVote?.(item.id, next)
    } catch {
      setOverrides((current) => ({ ...current, [item.id]: !next }))
      setMessage(`Your vote for ${item.title} could not be saved.`)
    }
  }

  const inColumn = (column: string) => {
    const list = items.filter((item) => item.status === column && (tag === 'all' || item.tags?.includes(tag)))
    return sort === 'votes' ? [...list].sort((a, b) => votesOf(b) - votesOf(a)) : list
  }

  const list = (column: RoadmapBoardColumn, headingId?: string) => {
    const cards = inColumn(column.id)
    if (cards.length === 0) {
      return (
        <Text as="p" size="label" tone="faint" className="rounded-[var(--radius-tile)] border border-dashed border-line-strong px-3 py-6 text-center">
          {tag === 'all' ? 'Nothing here yet.' : `Nothing tagged ${tag}.`}
        </Text>
      )
    }
    return (
      <ul aria-labelledby={headingId} className="m-0 flex list-none flex-col gap-2 p-0">
        {cards.map((item) => {
          const voted = votedOf(item)
          const votes = votesOf(item)
          return (
            <li key={item.id} className="flex gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-3 shadow-[var(--shadow-tile)]">
              <button
                type="button"
                aria-pressed={voted}
                aria-label={`Upvote ${item.title}, ${plural(votes, 'vote')}`}
                onClick={() => void toggle(item)}
                className={cn(
                  'flex h-12 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-glyph)] border text-[12px] font-extrabold tabular transition-colors',
                  voted ? 'border-accent-strong bg-accent text-accent-ink' : 'border-line bg-surface-sunken text-ink hover:border-line-strong',
                )}
              >
                <ChevronUpIcon size={14} />
                {votes}
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {item.href ? (
                  <a href={item.href} className="text-[13px] font-bold leading-snug text-ink hover:underline">
                    {item.title}
                  </a>
                ) : (
                  <Text as="span" size="body" weight="bold" leading="tight">
                    {item.title}
                  </Text>
                )}
                {item.description && (
                  <Text as="span" size="label" tone="soft" leading="normal" className="line-clamp-2">
                    {item.description}
                  </Text>
                )}
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.tags?.map((name) => (
                    <Tag key={name} size="sm" tone="neutral">
                      {name}
                    </Tag>
                  ))}
                  {item.comments !== undefined && (
                    <Text as="span" size="caption" tone="faint" className="ml-auto inline-flex items-center gap-1">
                      <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" strokeLinejoin="round" />
                      </svg>
                      <span aria-hidden="true">{item.comments}</span>
                      <span className="sr-only">{plural(item.comments, 'comment')}</span>
                    </Text>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  const count = (column: RoadmapBoardColumn) => inColumn(column.id).length

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Filter by tag"
            size="sm"
            value={tag}
            onValueChange={setTag}
            options={[{ value: 'all', label: 'All tags' }, ...tags.map((name) => ({ value: name, label: name }))]}
          />
          <SegmentedControl
            label="Sort"
            size="sm"
            value={sort}
            onValueChange={setSort}
            options={[
              { value: 'votes', label: 'Top voted' },
              { value: 'default', label: 'Latest' },
            ]}
          />
        </div>
        {suggest}
      </div>

      <div className="md:hidden">
        <Tabs
          label="Roadmap stage"
          variant="underline"
          fullWidth
          value={tab}
          onValueChange={setTab}
          items={columns.map((column) => ({
            value: column.id,
            label: column.label,
            badge: <span className="text-[11px] font-medium text-ink-faint">{count(column)}</span>,
            content: list(column),
          }))}
        />
      </div>

      <div className="hidden gap-4 md:grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => {
          const headingId = `${id}-${column.id}`
          return (
            <section key={column.id} aria-labelledby={headingId} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface-sunken p-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h3 id={headingId} className="m-0 flex items-center gap-2 text-[13px] font-bold text-ink">
                  {column.label}
                  <span className="rounded-full bg-surface-muted px-1.5 text-[11px] font-bold text-ink-soft">{count(column)}</span>
                </h3>
                {column.description && (
                  <Text as="span" size="caption" tone="faint">
                    {column.description}
                  </Text>
                )}
              </div>
              {list(column, headingId)}
            </section>
          )
        })}
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
