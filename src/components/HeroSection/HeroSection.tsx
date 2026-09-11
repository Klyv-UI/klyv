'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Text } from '../Text'
import { ArrowRightIcon } from '../internal/icons'
import { DISPLAY_XL } from '../internal/StatusPill'

export interface HeroAnnouncement {
  /** The news itself — "Workflows are here". */
  label: string
  /** Short qualifier in front of it — "New". */
  badge?: string
  href?: string
  onClick?: () => void
}

export interface HeroSectionProps {
  /** Headline. Wrap the phrase that carries the promise in `HeroHighlight`. */
  title: ReactNode
  description?: ReactNode
  /** The pill above the headline that links to the latest launch. */
  announcement?: HeroAnnouncement
  /** Primary and secondary calls to action. */
  actions?: ReactNode
  /** Reassurance under the actions — "No credit card required". */
  note?: ReactNode
  /** Product screenshot or illustration. Application-owned. */
  media?: ReactNode
  /** Decoration behind everything — an AuroraSurface, a grid. */
  backdrop?: ReactNode
  /** center stacks copy over media; split puts them side by side from lg. */
  layout?: 'center' | 'split'
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/**
 * The first screen of a SaaS site: an announcement, a promise, two actions and
 * the product.
 *
 * `PromoBanner` is the in-app hero — a fixed-height card inside a dashboard.
 * This is page-level: it owns the display type scale, reads as the page's `h1`,
 * and frames the product image the way the rest of the kit frames surfaces, so
 * a screenshot of the app sits in the same radius and elevation as the app.
 *
 * The announcement is a real link, not a decorated span — it is the most
 * clicked element on most landing pages.
 */
export function HeroSection({
  title,
  description,
  announcement,
  actions,
  note,
  media,
  backdrop,
  layout = 'center',
  headingLevel: Heading = 'h1',
  className,
}: HeroSectionProps) {
  const split = layout === 'split'

  const pill = announcement && <Announcement {...announcement} />

  const copy = (
    <div className={cn('flex flex-col gap-6', split ? 'items-start' : 'items-center text-center')}>
      {pill}
      <Heading className={cn(DISPLAY_XL, 'isolate max-w-[18ch] text-ink')}>{title}</Heading>
      {description && (
        <Text
          size="stat"
          weight="medium"
          tone="soft"
          leading="normal"
          className="max-w-[56ch] text-[16px] sm:text-[17px]"
        >
          {description}
        </Text>
      )}
      {actions && (
        <div className={cn('flex flex-wrap items-center gap-3', !split && 'justify-center')}>
          {actions}
        </div>
      )}
      {note && (
        <Text size="caption" weight="semibold" tone="faint">
          {note}
        </Text>
      )}
    </div>
  )

  const frame = media && (
    <div className="overflow-hidden rounded-[var(--radius-banner)] border border-line bg-surface shadow-[var(--shadow-window)]">
      {media}
    </div>
  )

  return (
    <section className={cn('relative isolate overflow-hidden px-5 py-16 sm:py-24', className)}>
      {backdrop && (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          {backdrop}
        </div>
      )}
      <div
        className={cn(
          'mx-auto flex w-full max-w-[1200px] flex-col gap-12 sm:gap-16',
          split && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center',
        )}
      >
        {copy}
        {frame}
      </div>
    </section>
  )
}

function Announcement({ label, badge, href, onClick }: HeroAnnouncement) {
  const body = (
    <>
      {badge && <Badge>{badge}</Badge>}
      <span>{label}</span>
      <ArrowRightIcon size={13} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
    </>
  )
  const style =
    'group inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-[12px] font-semibold text-ink shadow-[var(--shadow-tile)] transition-colors hover:border-line-strong'

  if (href) {
    return (
      <a href={href} onClick={onClick} className={style}>
        {body}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={style}>
        {body}
      </button>
    )
  }
  return <span className={style}>{body}</span>
}

/**
 * The emphasised phrase in a hero headline — an accent marker drawn under the
 * words rather than a colour change, so it survives any accent, pale or deep.
 */
export function HeroHighlight({ children }: { children: ReactNode }) {
  return (
    <span className="relative whitespace-nowrap">
      <span
        aria-hidden="true"
        className="absolute inset-x-[-0.06em] bottom-[0.04em] -z-10 h-[0.38em] rounded-[0.12em] bg-accent"
      />
      {children}
    </span>
  )
}
