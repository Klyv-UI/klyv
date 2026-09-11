import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { Marquee } from '../Marquee'

export interface LogoItem {
  /** Company name. This is what a screen reader hears. */
  name: string
  /** Inline SVG or image. Drawn in currentColor, so it takes the muted tone. */
  logo: ReactNode
}

export interface LogoCloudProps {
  logos: LogoItem[]
  /** The claim the logos support — "Trusted by 4,000 teams". */
  title?: ReactNode
  /** row wraps centred; grid draws hairline cells; marquee scrolls. */
  variant?: 'row' | 'grid' | 'marquee'
  className?: string
}

/**
 * Social proof as a strip of customer marks.
 *
 * Every mark is flattened to the faint ink tone. A row of logos in their own
 * brand colours is a row of competing calls to action; in one tone they read as
 * a single fact — "people like you use this" — which is all the strip is for.
 *
 * Each logo is exposed as an image named for the company, since the marks are
 * frequently the only place the names appear.
 */
export function LogoCloud({ logos, title, variant = 'row', className }: LogoCloudProps) {
  const mark = (item: LogoItem) => (
    <span
      role="img"
      aria-label={item.name}
      className="flex h-8 items-center text-ink-faint transition-colors hover:text-ink-soft [&_img]:h-full [&_img]:w-auto [&_svg]:h-full [&_svg]:w-auto"
    >
      {item.logo}
    </span>
  )

  return (
    <section className={cn('flex flex-col items-center gap-6', className)}>
      {title && (
        <Text size="label" weight="semibold" tone="faint" className="text-center">
          {title}
        </Text>
      )}

      {variant === 'marquee' ? (
        <Marquee speed={36} className="w-full">
          {logos.map((item) => (
            <span key={item.name} className="px-8">
              {mark(item)}
            </span>
          ))}
        </Marquee>
      ) : variant === 'grid' ? (
        <ul className="grid w-full grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-line sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((item) => (
            <li
              key={item.name}
              className="-mb-px -mr-px flex h-24 items-center justify-center border-b border-r border-line px-6"
            >
              {mark(item)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {logos.map((item) => (
            <li key={item.name}>{mark(item)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
