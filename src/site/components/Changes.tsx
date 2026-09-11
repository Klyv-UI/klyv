import { Link } from 'react-router-dom'
import { Tag, Text, type TagTone } from 'citrine'
import { CHANGE_CATEGORIES, releaseLabel, type Change, type ChangeCategory, type Release } from '../data/changelog'
import { DocLink } from './Links'

const TONES: Record<ChangeCategory, TagTone> = {
  feature: 'accent',
  improvement: 'neutral',
  fix: 'outline',
  breaking: 'accent',
  docs: 'neutral',
}

export const categoryLabel = (category: ChangeCategory) =>
  CHANGE_CATEGORIES.find((entry) => entry.id === category)?.label ?? category

export function formatReleaseDate(release: Release): string {
  if (!release.date) return 'Not yet released'
  return new Date(`${release.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** One change: its category, what it was, and where to go and look. */
export function ChangeItem({ change }: { change: Change }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-start gap-2">
        <Tag size="sm" tone={TONES[change.category]}>
          {categoryLabel(change.category)}
        </Tag>
        <Text as="span" size="body" weight="semibold" className="min-w-0 flex-1">
          {change.title}
        </Text>
        {change.commit && (
          <code className="rounded-[6px] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
            <span className="sr-only">Commit </span>
            {change.commit}
          </code>
        )}
      </div>
      {change.description && (
        <Text size="caption" tone="soft" leading="normal" className="max-w-[70ch]">
          {change.description}
        </Text>
      )}
      {change.links && change.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {change.links.map((link) => (
            <DocLink key={link.to} label={link.label} to={link.to} />
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * A release on the timeline. The same two-column shape as the library's
 * ChangelogList — date and version on the left, a rule and a dot on the right
 * — built here because an unreleased entry has no date to give it, and links
 * inside the site should be router links rather than full page loads.
 */
export function ReleaseEntry({ release, changes, headingLevel: Heading = 'h2' }: {
  release: Release
  changes: Change[]
  headingLevel?: 'h2' | 'h3'
}) {
  const unreleased = release.status === 'unreleased'
  return (
    <li className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:gap-8">
      <div className="flex items-center gap-2 md:flex-col md:items-start md:pt-0.5">
        <Text size="label" weight="bold" tone="soft">
          {release.date ? <time dateTime={release.date}>{formatReleaseDate(release)}</time> : 'Unreleased'}
        </Text>
        <Tag size="sm" tone={unreleased ? 'accent' : 'outline'}>
          {releaseLabel(release)}
        </Tag>
      </div>
      <div className="relative flex flex-col gap-3 border-l border-line pb-12 pl-6">
        <span
          aria-hidden="true"
          className={`absolute -left-[5px] top-1 size-[9px] rounded-full ring-4 ring-canvas ${unreleased ? 'bg-accent-strong' : 'bg-line-strong'}`}
        />
        <Heading className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          <Link to={`/changelog/${release.version}`} className="underline-offset-4 hover:underline">
            {release.title}
          </Link>
        </Heading>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[68ch]">
          {release.summary}
        </Text>
        {unreleased && (
          <Text size="caption" weight="semibold" tone="faint">
            On the current branch; not in a published version yet.
          </Text>
        )}
        {changes.length > 0 ? (
          <ul className="flex flex-col">
            {changes.map((change) => (
              <ChangeItem key={change.title} change={change} />
            ))}
          </ul>
        ) : (
          <Text size="caption" tone="faint">
            Nothing in this release matches the filter.
          </Text>
        )}
      </div>
    </li>
  )
}
