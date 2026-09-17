import type { ElementType } from 'react'
import { cn } from '../../lib/cn'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

export interface ArticlePagerLink {
  /** The article's title. */
  title: string
  /** Where it lives. Passed to `linkAs` as `href`. */
  href: string
  /** Overrides the direction label — "Previous chapter", "Up next". */
  label?: string
}

export interface ArticlePagerProps {
  /** The article before this one. Omit on the first page. */
  previous?: ArticlePagerLink
  /** The article after this one. Omit on the last page. */
  next?: ArticlePagerLink
  /** Name of the navigation landmark, so it is distinct from the site's other navs. */
  label?: string
  /** Link element — a router link that takes `href`. Defaults to `a`. */
  linkAs?: ElementType
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The previous and next links at the foot of a doc page.
 *
 * Arrows alone tell the reader which way, not where to — so each link says
 * both: the direction as a small label and the destination as its title.
 * The pair sits in its own named `nav`, which lets a screen-reader user jump
 * to it from the landmarks list without confusing it with the site
 * navigation.
 *
 * A single link keeps its side: "next" on the first page stays on the right,
 * where the eye expects forward to be, rather than sliding over to fill the
 * row. On a phone the two stack, previous first.
 */
export function ArticlePager({
  previous,
  next,
  label = 'Previous and next article',
  linkAs: Link = 'a',
  className,
}: ArticlePagerProps) {
  if (!previous && !next) return null

  const card =
    'group flex min-w-0 items-center gap-3 rounded-[var(--radius-tile)] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-surface-sunken'

  return (
    <nav aria-label={label} className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {previous && (
        <Link href={previous.href} rel="prev" className={card}>
          <ChevronLeftIcon size={16} className="shrink-0 text-ink-faint transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-faint">{previous.label ?? 'Previous'}</span>
            <span className="truncate text-[14px] font-bold text-ink">{previous.title}</span>
          </span>
        </Link>
      )}
      {next && (
        <Link href={next.href} rel="next" className={cn(card, 'justify-end text-right sm:col-start-2')}>
          <span className="flex min-w-0 flex-col items-end gap-1">
            <span className="text-[11px] font-semibold text-ink-faint">{next.label ?? 'Next'}</span>
            <span className="max-w-full truncate text-[14px] font-bold text-ink">{next.title}</span>
          </span>
          <ChevronRightIcon size={16} className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      )}
    </nav>
  )
}
