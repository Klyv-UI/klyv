import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { StatusDot, type StatusDotTone } from '../StatusDot'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { StatusPill } from '../internal/StatusPill'

export type IncidentTimelineStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved'
export type IncidentTimelineSeverity = 'maintenance' | 'minor' | 'major' | 'critical'

export interface IncidentTimelineUpdate {
  id: string
  status: IncidentTimelineStatus
  /** When the update was posted. */
  at: Date
  /** What was said. Plain sentences; the status is already a label. */
  message: ReactNode
}

export interface IncidentTimelineProps {
  /** The incident name — "Elevated API error rates". */
  title: string
  severity: IncidentTimelineSeverity
  /** Updates in any order. They are shown newest first. */
  updates: IncidentTimelineUpdate[]
  /** Components the incident touches — "API", "Dashboard". */
  components?: string[]
  /** When impact began, if earlier than the first update. */
  startedAt?: Date
  /** Reference time for an incident still open. Pass it for stable server rendering. */
  now?: Date
  /** Heading element for the title, to fit the page outline. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** Format each update’s timestamp. */
  formatTime?: (date: Date) => string
  /** Merged last, so it wins. */
  className?: string
}

const STATUS: Record<IncidentTimelineStatus, { name: string; tone: StatusDotTone }> = {
  investigating: { name: 'Investigating', tone: 'danger' },
  identified: { name: 'Identified', tone: 'warning' },
  monitoring: { name: 'Monitoring', tone: 'accent' },
  resolved: { name: 'Resolved', tone: 'success' },
}

const SEVERITY: Record<IncidentTimelineSeverity, { name: string; tone: StatusDotTone }> = {
  maintenance: { name: 'Maintenance', tone: 'neutral' },
  minor: { name: 'Minor', tone: 'warning' },
  major: { name: 'Major', tone: 'danger' },
  critical: { name: 'Critical', tone: 'danger' },
}

const defaultTime = (date: Date) =>
  date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** "45m", "2h 14m", "3d 4h" — the two largest units, which is all a reader compares. */
function duration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/**
 * One incident as a status page tells it: what broke, how badly, what it
 * touched, how long it lasted, and every update, newest first.
 *
 * Newest first because the person arriving mid-incident wants the current
 * state, not the story; the first update is still there at the bottom. The
 * status of each update is a word as well as a dot — "Monitoring" in one colour
 * and "Identified" in another are the same dot to many readers.
 *
 * Duration runs from the start (or the first update) to the latest update when
 * that update is "resolved". An incident that is still open says so and counts to `now`,
 * rather than printing a duration that looks final.
 */
export function IncidentTimeline({
  title,
  severity,
  updates,
  components = [],
  startedAt,
  now,
  headingLevel: Heading = 'h3',
  formatTime = defaultTime,
  className,
}: IncidentTimelineProps) {
  const ordered = [...updates].sort((a, b) => b.at.getTime() - a.at.getTime())
  const earliest = ordered[ordered.length - 1]?.at
  const start = startedAt ?? earliest
  const latest = ordered[0]
  const open = latest?.status !== 'resolved'
  const end = open || !latest ? (now ?? new Date()) : latest.at

  return (
    <article className={cn('flex w-full flex-col gap-4', className)}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={SEVERITY[severity].tone}>{SEVERITY[severity].name}</StatusPill>
          {latest && (
            <Tag size="sm" tone="outline">
              {open ? STATUS[latest.status].name : 'Resolved'}
            </Tag>
          )}
        </div>
        <Heading className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</Heading>
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {start && (
            <div className="flex items-baseline gap-1.5">
              <Text as="dt" size="caption" tone="faint">
                {open ? 'Ongoing for' : 'Lasted'}
              </Text>
              <Text as="dd" size="caption" weight="bold" tabular>
                {duration(end.getTime() - start.getTime())}
              </Text>
            </div>
          )}
          {components.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <Text as="dt" size="caption" tone="faint">
                Affected
              </Text>
              <dd className="flex flex-wrap gap-1">
                {components.map((component) => (
                  <Tag key={component} size="sm">
                    {component}
                  </Tag>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <ol aria-label={`Updates for ${title}, newest first`} className="flex list-none flex-col">
        {ordered.map((update, index) => (
          <li key={update.id} className="flex gap-3">
            <div aria-hidden="true" className="flex flex-col items-center">
              <span className="flex h-5 items-center">
                <StatusDot tone={STATUS[update.status].tone} size="md" />
              </span>
              {index < ordered.length - 1 && <span className="w-px flex-1 bg-line-strong" />}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col gap-1', index < ordered.length - 1 && 'pb-5')}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Text as="span" size="label" weight="bold">
                  {STATUS[update.status].name}
                </Text>
                <Text as="time" size="caption" tone="faint" tabular dateTime={update.at.toISOString()}>
                  {formatTime(update.at)}
                </Text>
              </div>
              <Text size="label" tone="soft" leading="normal">
                {update.message}
              </Text>
            </div>
          </li>
        ))}
      </ol>
    </article>
  )
}
