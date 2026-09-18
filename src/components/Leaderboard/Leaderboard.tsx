import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { VisuallyHidden } from '../VisuallyHidden'

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  /** Avatar image. Initials are drawn without it. */
  avatar?: string
  /** Secondary line under the name — a team, a region. */
  detail?: ReactNode
  /** Last period's rank, for the movement arrow. `'new'` for a first appearance. */
  previousRank?: number | 'new'
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[]
  /** How many ranks to list. */
  limit?: number
  /** The reader's own entry: highlighted, and pinned under the list when it falls outside `limit`. */
  currentUserId?: string
  /** Raise the top three onto a podium above the list. */
  podium?: boolean
  /** Formats a score. Defaults to grouped digits. */
  formatScore?: (score: number) => string
  /** What a score counts, for screen readers — "points", "commits". */
  unit?: string
  /** Accessible name for the ranking. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

interface LeaderboardRanked extends LeaderboardEntry {
  rank: number
}

function Movement({ entry }: { entry: LeaderboardRanked }) {
  const { previousRank, rank } = entry
  if (previousRank === undefined) return null
  if (previousRank === 'new') {
    return <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-bold uppercase text-ink">New</span>
  }
  const delta = previousRank - rank
  if (delta === 0) {
    return (
      <span className="text-[11px] font-bold text-ink-faint">
        <span aria-hidden="true">–</span>
        <VisuallyHidden>no change</VisuallyHidden>
      </span>
    )
  }
  const up = delta > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums', up ? 'text-success' : 'text-danger')}>
      <svg viewBox="0 0 10 10" width={9} height={9} aria-hidden="true" className={cn(!up && 'rotate-180')}>
        <path d="M5 1.5L9 7.5H1z" fill="currentColor" />
      </svg>
      <span aria-hidden="true">{Math.abs(delta)}</span>
      <VisuallyHidden>
        {up ? 'up' : 'down'} {Math.abs(delta)} {Math.abs(delta) === 1 ? 'place' : 'places'}
      </VisuallyHidden>
    </span>
  )
}

const PODIUM = [
  { place: 2, height: 'h-16', order: 'order-1' },
  { place: 1, height: 'h-24', order: 'order-2' },
  { place: 3, height: 'h-12', order: 'order-3' },
]

/**
 * Who is ahead, and where you are — for sales contests, streak boards, the
 * weekly top contributors.
 *
 * Ties share a rank (1, 2, 2, 4), because putting one of two equal scores
 * above the other is a judgement the data did not make. Movement since last
 * period is an arrow and a number, with the words behind them for screen
 * readers.
 *
 * The reader's own row is the one they look for first. When it is outside the
 * top N it is pinned under the list after a gap, so it is visible without
 * scrolling and without pretending they are tenth.
 *
 * The podium is the same ordered list in the same DOM order, rearranged 2–1–3
 * with CSS, so it reads first, second, third.
 */
export function Leaderboard({
  entries,
  limit = 10,
  currentUserId,
  podium = false,
  formatScore = (score) => score.toLocaleString(),
  unit = 'points',
  label,
  className,
}: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  const ranked: LeaderboardRanked[] = sorted.map((entry, index) => ({
    ...entry,
    rank: index > 0 && sorted[index - 1].score === entry.score ? 0 : index + 1,
  }))
  ranked.forEach((entry, index) => {
    if (entry.rank === 0) entry.rank = ranked[index - 1].rank
  })

  const top = ranked.slice(0, limit)
  const onPodium = podium ? top.slice(0, 3) : []
  const listed = podium ? top.slice(onPodium.length) : top
  const me = currentUserId ? ranked.find((entry) => entry.id === currentUserId) : undefined
  const pinned = me && !top.includes(me) ? me : undefined

  const row = (entry: LeaderboardRanked) => {
    const mine = entry.id === currentUserId
    return (
      <li
        key={entry.id}
        aria-current={mine ? 'true' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-[var(--radius-glyph)] px-3 py-2',
          mine ? 'bg-accent-soft' : 'hover:bg-surface-sunken',
        )}
      >
        <span className="w-6 shrink-0 text-right text-[13px] font-extrabold tabular-nums text-ink-soft">
          <VisuallyHidden>Rank </VisuallyHidden>
          {entry.rank}
        </span>
        <Avatar name={entry.name} src={entry.avatar} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-bold text-ink">
            {entry.name}
            {mine && <span className="ml-1.5 text-[11px] font-semibold text-ink-soft">(you)</span>}
          </span>
          {entry.detail && <span className="truncate text-[11px] font-medium text-ink-faint">{entry.detail}</span>}
        </span>
        <span className="w-10 shrink-0 text-right">
          <Movement entry={entry} />
        </span>
        <span className="min-w-[64px] shrink-0 text-right text-[13px] font-extrabold tabular-nums text-ink">
          {formatScore(entry.score)}
          <VisuallyHidden> {unit}</VisuallyHidden>
        </span>
      </li>
    )
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {onPodium.length > 0 && (
        <ol aria-label={`${label}, top ${onPodium.length}`} className="flex items-end justify-center gap-2 pt-2">
          {onPodium.map((entry, index) => {
            const slot = PODIUM.find((item) => item.place === index + 1)!
            const mine = entry.id === currentUserId
            return (
              <li key={entry.id} aria-current={mine ? 'true' : undefined} className={cn('flex w-[31%] max-w-[140px] flex-col items-center gap-1.5', slot.order)}>
                <Avatar name={entry.name} src={entry.avatar} size={index === 0 ? 'lg' : 'md'} ring={mine} />
                <span className="w-full truncate text-center text-[12px] font-bold text-ink">
                  <VisuallyHidden>Rank {entry.rank}, </VisuallyHidden>
                  {entry.name}
                </span>
                <span className="text-[12px] font-extrabold tabular-nums text-ink-soft">
                  {formatScore(entry.score)}
                  <VisuallyHidden> {unit}</VisuallyHidden>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex w-full items-start justify-center rounded-t-[var(--radius-glyph)] pt-2 text-[18px] font-extrabold',
                    slot.height,
                    index === 0 ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink-soft',
                  )}
                >
                  {entry.rank}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {listed.length > 0 && (
        <ol aria-label={label} className="flex flex-col gap-0.5">
          {listed.map(row)}
        </ol>
      )}

      {pinned && (
        <ol aria-label="Your position" className="border-t border-dashed border-line-strong pt-2">
          {row(pinned)}
        </ol>
      )}
    </div>
  )
}
