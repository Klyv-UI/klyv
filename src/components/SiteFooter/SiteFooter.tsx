import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Text } from '../Text'
import type { SiteLink } from '../SiteHeader'

export interface FooterColumn {
  title: string
  links: (SiteLink & { badge?: string })[]
}

export interface FooterSocial {
  label: string
  href: string
  icon: IconComponent
}

export interface SiteFooterProps {
  brand: ReactNode
  tagline?: ReactNode
  columns: FooterColumn[]
  social?: FooterSocial[]
  /** Copyright line. */
  legal?: ReactNode
  /** Terms, privacy, cookies — the row under the rule. */
  bottomLinks?: SiteLink[]
  /** Newsletter sign-up, a status badge, a region switcher. */
  aside?: ReactNode
  maxWidth?: number
  className?: string
}

/**
 * The site map at the foot of every marketing page.
 *
 * Column titles are real `h2`s. The footer is where people go looking for
 * "Careers" or "Security" by heading, and a column of links under a styled
 * `div` gives a screen reader nothing to jump between.
 */
export function SiteFooter({
  brand,
  tagline,
  columns,
  social = [],
  legal,
  bottomLinks = [],
  aside,
  maxWidth = 1200,
  className,
}: SiteFooterProps) {
  return (
    <footer className={cn('w-full border-t border-line px-5 pb-8 pt-14', className)}>
      <div className="mx-auto flex w-full flex-col gap-12" style={{ maxWidth }}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex max-w-[34ch] flex-col items-start gap-4">
            {brand}
            {tagline && (
              <Text size="body" weight="medium" tone="soft" leading="normal">
                {tagline}
              </Text>
            )}
            {aside}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <Text as="h2" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                  {column.title}
                </Text>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href} className="flex items-center gap-2">
                      <a
                        href={link.href}
                        className="text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                      {link.badge && (
                        <span className="rounded-full bg-accent px-1.5 py-[2px] text-[9px] font-bold leading-none text-accent-ink">
                          {link.badge}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            {legal && (
              <Text size="caption" weight="semibold" tone="faint">
                {legal}
              </Text>
            )}
            {bottomLinks.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {bottomLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-[11px] font-semibold text-ink-faint transition-colors hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {social.length > 0 && (
            <ul className="flex gap-1">
              {social.map(({ label, href, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    aria-label={label}
                    title={label}
                    className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}
