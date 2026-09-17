import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface ProfileCardStat {
  /** What is being counted — "Followers". */
  label: string
  /** The figure, already formatted — "12.4k". */
  value: ReactNode
}

export interface ProfileCardLink {
  /** Network or destination — "GitHub". The accessible name when the link shows only its icon. */
  label: string
  href: string
  /** Glyph for the link. With one, the link shows the icon alone. */
  icon?: IconComponent
}

export type ProfileCardVariant = 'full' | 'compact'

export interface ProfileCardProps {
  /** Full name. Drives the avatar initials and the heading. */
  name: string
  /** Job title, team or handle, under the name. */
  role?: ReactNode
  /** Portrait URL. Without one the avatar shows initials. */
  avatarSrc?: string
  /** Banner image URL across the top of the full card. Omitted, a soft accent band is drawn instead. */
  coverSrc?: string
  /** A sentence or two about the person. Full variant only. */
  bio?: ReactNode
  /** Counts in a row under the bio — posts, followers, projects. Full variant only. */
  stats?: ProfileCardStat[]
  /** Social and web links. */
  links?: ProfileCardLink[]
  /** The main action — Follow, Message. Usually a Button. */
  primaryAction?: ReactNode
  /** The lesser action beside it. */
  secondaryAction?: ReactNode
  /** full is the standalone card with cover, bio and stats; compact is a single row for lists. */
  variant?: ProfileCardVariant
  /** Heading level for the name, so the card fits the page outline. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A person, summarised: who they are, what they do, and what you can do next.
 *
 * The name is a real heading and the stats are a description list, because a
 * screen-reader user skimming a grid of people moves by heading and needs
 * "Followers, 12.4k" read as a pair rather than as two loose numbers. Links with
 * an icon show only the icon but keep the network name as their label.
 *
 * Compact drops the cover, bio and stats rather than shrinking them: in a list
 * the reader is choosing a person, and that needs a face, a name and an action.
 */
export function ProfileCard({
  name,
  role,
  avatarSrc,
  coverSrc,
  bio,
  stats,
  links,
  primaryAction,
  secondaryAction,
  variant = 'full',
  headingLevel: Heading = 'h3',
  className,
}: ProfileCardProps) {
  const actions = (primaryAction || secondaryAction) && (
    <div className={cn('flex items-center gap-2', variant === 'full' && 'w-full [&>*]:flex-1')}>
      {secondaryAction}
      {primaryAction}
    </div>
  )

  const linkRow = links && links.length > 0 && (
    <ul className="flex flex-wrap items-center gap-1">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={Icon ? link.label : undefined}
              title={Icon ? link.label : undefined}
              className={cn(
                'inline-flex items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink',
                Icon ? 'size-8' : 'h-8 px-2.5 text-[12px] font-semibold',
              )}
            >
              {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : link.label}
            </a>
          </li>
        )
      })}
    </ul>
  )

  if (variant === 'compact') {
    return (
      <Surface variant="card" padding="md" className={cn('flex-row items-center gap-3', className)}>
        <Avatar name={name} src={avatarSrc} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as={Heading} size="body" truncate>
            {name}
          </Text>
          {role && (
            <Text size="caption" tone="faint" truncate>
              {role}
            </Text>
          )}
        </div>
        {linkRow}
        {actions}
      </Surface>
    )
  }

  return (
    <Surface variant="card" className={cn('overflow-hidden', className)}>
      <div className="h-24 bg-[color-mix(in_oklab,var(--color-accent)_28%,var(--color-surface-muted))]">
        {coverSrc && <img src={coverSrc} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex flex-col items-center gap-4 px-5 pb-5 text-center">
        <Avatar name={name} src={avatarSrc} size="lg" className="-mt-6 ring-4 ring-surface" />
        <div className="flex flex-col items-center gap-1.5">
          <Text as={Heading} size="heading">
            {name}
          </Text>
          {role && (
            <Text size="label" tone="faint">
              {role}
            </Text>
          )}
        </div>
        {bio && (
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[40ch]">
            {bio}
          </Text>
        )}
        {stats && stats.length > 0 && (
          <dl className="grid w-full auto-cols-fr grid-flow-col divide-x divide-line rounded-[var(--radius-tile)] border border-line py-2.5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse items-center gap-1 px-2">
                <dt>
                  <Text as="span" size="caption" tone="faint">
                    {stat.label}
                  </Text>
                </dt>
                <dd>
                  <Text as="span" size="stat" tabular>
                    {stat.value}
                  </Text>
                </dd>
              </div>
            ))}
          </dl>
        )}
        {linkRow}
        {actions}
      </div>
    </Surface>
  )
}
