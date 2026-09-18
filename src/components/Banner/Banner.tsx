'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'
import { ArrowRightIcon, CrossIcon } from '../internal/icons'

export type BannerTone = 'accent' | 'neutral' | 'ink'

const TONES: Record<BannerTone, { surface: string; title: string; body: string }> = {
  // Solid, not /75: the accent's label is picked to clear 4.5:1 and no more, so
  // fading it is what puts it under. Weight separates body from title instead.
  accent: { surface: 'bg-accent', title: 'text-accent-ink', body: 'text-accent-ink' },
  neutral: { surface: 'bg-surface-muted', title: 'text-ink', body: 'text-ink-soft' },
  ink: { surface: 'bg-ink', title: 'text-ink-inverse', body: 'text-ink-inverse/70' },
}

export interface BannerProps {
  tone?: BannerTone
  /** `block` is a rounded panel with a heading; `strip` is the thin centred bar across the very top of a site. */
  layout?: 'block' | 'strip'
  /** Heading for the message. Usually omitted in a strip, where the message is one sentence. */
  title?: string
  /** The message body — in a strip, the one sentence. */
  children?: ReactNode
  /** Glyph before the message. */
  icon?: IconComponent
  /** Short qualifier in front — "New". */
  badge?: string
  /** Where the message leads. Rendered as a link after it. */
  href?: string
  /** Text of the `href` link. */
  linkLabel?: string
  /** Right-aligned affordance, usually a Button. */
  action?: ReactNode
  /** Called when the banner is dismissed. Its presence, or `storageKey`, adds the dismiss button. */
  onDismiss?: () => void
  /** Remember the dismissal in this browser under this key. Change the key for the next announcement. */
  storageKey?: string
  /** Merged last, so it wins. */
  className?: string
}

function readDismissed(key?: string) {
  if (!key) return false
  try {
    return window.localStorage.getItem(key) === 'dismissed'
  } catch {
    return false
  }
}

/**
 * A full-width announcement about the product, not about the page. Distinct
 * from Alert: Alert reports the state of something on the page, a Banner
 * announces a launch, a webinar, scheduled maintenance, a demo account.
 *
 * It comes in two layouts. `block` is a rounded panel with a heading, for the
 * top of a region. `strip` is the thin centred bar across the very top of a
 * site or app, one sentence with an optional badge and link.
 *
 * Dismissal is remembered per announcement, not globally — keyed by the caller
 * with `storageKey` — so closing last month's launch does not also hide next
 * week's outage notice. Storage failing (private windows, blocked site data)
 * just means it shows again, never an error.
 */
export function Banner({
  tone = 'accent',
  layout = 'block',
  title,
  children,
  icon: Icon,
  badge,
  href,
  linkLabel = 'Learn more',
  action,
  onDismiss,
  storageKey,
  className,
}: BannerProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey))
  if (dismissed) return null

  const styles = TONES[tone]
  const dismissible = Boolean(onDismiss || storageKey)

  const dismiss = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, 'dismissed')
      } catch {
        // Not remembered; it will simply come back next visit.
      }
    }
    setDismissed(true)
    onDismiss?.()
  }

  const badgeNode = badge && (
    <span className="shrink-0 rounded-full bg-current/15 px-2 py-[3px] text-[10px] font-bold leading-none">
      {badge}
    </span>
  )

  const link = href && (
    <a href={href} className="group inline-flex items-center gap-1 font-bold underline underline-offset-2">
      {linkLabel}
      <ArrowRightIcon size={11} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </a>
  )

  if (layout === 'strip') {
    return (
      <div
        role="region"
        aria-label="Announcement"
        className={cn(
          'relative flex min-h-10 w-full items-center justify-center px-12 py-2',
          styles.surface,
          styles.title,
          className,
        )}
      >
        <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-[12px] font-semibold leading-snug">
          {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
          {badgeNode}
          {title && <span className="font-bold">{title}</span>}
          {children && <span>{children}</span>}
          {link}
        </p>
        {action && <div className="shrink-0">{action}</div>}
        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={dismiss}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <CrossIcon size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-tile)] px-4 py-3',
        styles.surface,
        className,
      )}
    >
      {Icon && (
        <span className={cn('shrink-0', styles.title)}>
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {(title || badge) && (
          <div className={cn('flex flex-wrap items-center gap-2', styles.title)}>
            {badgeNode}
            {title && <Text size="body" className={styles.title}>{title}</Text>}
          </div>
        )}
        {(children || link) && (
          <Text
            size="caption"
            weight="medium"
            leading="normal"
            className={cn((title || badge) && 'mt-0.5', styles.body)}
          >
            {children}
            {children && link ? ' ' : null}
            {link && <span className={styles.title}>{link}</span>}
          </Text>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {dismissible && (
        <IconButton
          icon={CrossIcon}
          label="Dismiss announcement"
          size="sm"
          onClick={dismiss}
          className={cn('-mr-1 shrink-0', styles.title)}
        />
      )}
    </div>
  )
}
