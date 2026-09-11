import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface PromoBannerProps {
  /** Headline. Use `highlight` to mark the emphasised phrase. */
  title: ReactNode
  /** Supporting line under the headline. */
  description?: ReactNode
  /** Primary affordance, usually a Button with variant="white". */
  action?: ReactNode
  /** Artwork behind the copy. Application-owned; the library ships no imagery. */
  art?: ReactNode
  /** Figure or portrait beside the action. */
  aside?: ReactNode
  /** Height at the sm breakpoint and up. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The hero strip: headline, supporting line, one affordance and an artwork
 * slot. Artwork is a slot rather than a prop so the library carries no imagery
 * and no brand asset of its own.
 *
 * A gradient masks the artwork behind the copy, which is what keeps the
 * headline readable over any illustration without dimming the whole banner.
 */
export function PromoBanner({
  title,
  description,
  action,
  art,
  aside,
  height = 160,
  className,
}: PromoBannerProps) {
  return (
    <section
      style={{ '--promo-height': `${height}px` } as React.CSSProperties}
      className={cn(
        'relative isolate h-[150px] overflow-hidden rounded-[var(--radius-banner)] bg-accent sm:h-[var(--promo-height)]',
        className,
      )}
    >
      {art && <div className="absolute inset-y-0 right-0 h-full w-[70%] min-w-[420px]">{art}</div>}
      {art && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-accent via-accent to-transparent"
        />
      )}

      <div className="relative flex h-full items-center">
        <div className="max-w-[54%] pl-6 sm:pl-8">
          <Text
            as="h2"
            size="title"
            leading="normal"
            // The banner's background *is* the accent, so its title takes the
            // ink chosen to sit on it rather than a tone meant for a surface.
            className="text-[24px] leading-[1.16] text-accent-ink sm:text-[30px]"
          >
            {title}
          </Text>
          {description && (
            <Text
              size="caption"
              weight="medium"
              leading="normal"
              className="mt-2.5 text-[color-mix(in_oklab,var(--color-accent-ink)_72%,var(--color-accent))] sm:text-[12px]"
            >
              {description}
            </Text>
          )}
        </div>

        {(action || aside) && (
          <div className="ml-auto hidden h-full items-end sm:flex">
            {action && <div className="relative z-10 mb-10 mr-[-14px]">{action}</div>}
            {aside}
          </div>
        )}
      </div>
    </section>
  )
}

/** Marks the emphasised phrase inside a PromoBanner headline. */
export function PromoHighlight({ children }: { children: ReactNode }) {
  return (
    <span className="box-decoration-clone rounded-[5px] bg-[color-mix(in_oklab,var(--color-accent-ink)_13%,var(--color-accent))] px-1.5 py-0.5">
      {children}
    </span>
  )
}
