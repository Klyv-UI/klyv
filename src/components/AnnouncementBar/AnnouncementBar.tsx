import type { ReactNode } from 'react'
import { Banner } from '../Banner'

/** @deprecated Use `BannerTone` — `muted` is Banner's `neutral`. */
export type AnnouncementTone = 'accent' | 'ink' | 'muted'

/** @deprecated Use `BannerProps` with `layout="strip"`. */
export interface AnnouncementBarProps {
  /** One sentence. */
  children: ReactNode
  /** Short qualifier in front — "New". */
  badge?: string
  /** Where the announcement leads. */
  href?: string
  /** Text of the `href` link. */
  linkLabel?: string
  /** Surface colour. `muted` maps to Banner's `neutral`. */
  tone?: AnnouncementTone
  /** Called when the bar is dismissed. */
  onDismiss?: () => void
  /** Remember the dismissal in this browser under this key. Change the key for the next announcement. */
  storageKey?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The thin strip across the very top of a site, kept for code written against 1.0.
 *
 * @deprecated Use `<Banner layout="strip">`. AnnouncementBar is now exactly that,
 * with `tone="muted"` renamed to `neutral` and `ink` as its default tone.
 */
export function AnnouncementBar({ tone, children, ...rest }: AnnouncementBarProps) {
  return (
    <Banner layout="strip" tone={tone === 'muted' ? 'neutral' : (tone ?? 'ink')} {...rest}>
      {children}
    </Banner>
  )
}
