'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Text } from '../Text'
import { ArrowRightIcon, ChevronLeftIcon } from '../internal/icons'

export type NotFoundStateHeadingLevel = 'h1' | 'h2' | 'h3'

export interface NotFoundStateLink {
  /** Link text — where it goes. */
  label: string
  href: string
  /** One short line under the label. */
  description?: string
}

export interface NotFoundStateProps {
  /** The status code, drawn large. */
  code?: string
  /** What happened, in words. */
  title?: string
  /** Why it might have happened and what to try. */
  description?: ReactNode
  /** A search field — usually a SearchField wired to site search. */
  search?: ReactNode
  /** Pages people most often meant. Three or four at most. */
  links?: NotFoundStateLink[]
  /** Heading over the links. */
  linksTitle?: string
  /** Where the home action goes. Pass null to leave it out. */
  homeHref?: string | null
  /** Label on the home action. */
  homeLabel?: string
  /** Show a back action. It calls onBack, or steps back through history. */
  showBack?: boolean
  /** Label on the back action. */
  backLabel?: string
  /** Replaces the default history step — for an app with its own router. */
  onBack?: () => void
  /** Artwork above the code. It is hidden from assistive technology; pass null for none. */
  illustration?: ReactNode | null
  /** The title's heading level. h1 when this is the whole page, lower inside an app shell. */
  headingLevel?: NotFoundStateHeadingLevel
  /** Merged last, so it wins. */
  className?: string
}

function DefaultIllustration() {
  return (
    <svg viewBox="0 0 160 96" width={160} height={96} fill="none" className="text-ink-faint">
      <rect x="16" y="14" width="96" height="68" rx="10" className="fill-surface-muted" stroke="currentColor" strokeWidth="2" />
      <path d="M16 30h96" stroke="currentColor" strokeWidth="2" />
      <circle cx="28" cy="22" r="2.5" fill="currentColor" />
      <circle cx="37" cy="22" r="2.5" fill="currentColor" />
      <path d="M34 48h40M34 60h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" />
      <circle cx="112" cy="58" r="20" className="fill-accent" />
      <circle cx="112" cy="58" r="20" stroke="currentColor" strokeWidth="2" />
      <path d="M126 72l14 14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M106 52l12 12M118 52l-12 12" className="stroke-accent-ink" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The body of a 404 page.
 *
 * A bare "page not found" is a dead end, and the reader got here by following
 * something they trusted. So the state offers every way out it can: search for
 * what they meant, the handful of pages people usually meant, a step back, and
 * home. The code is shown large because it is what people quote to support —
 * but the title says it in words, and the heading level is a prop, since the
 * same body is a whole page on a site and a region inside an app shell.
 */
export function NotFoundState({
  code = '404',
  title = 'We can’t find that page',
  description = 'The link may be out of date, or the page may have moved. Check the address, or try one of these instead.',
  search,
  links = [],
  linksTitle = 'Popular pages',
  homeHref = '/',
  homeLabel = 'Go to home',
  showBack = true,
  backLabel = 'Go back',
  onBack,
  illustration,
  headingLevel = 'h1',
  className,
}: NotFoundStateProps) {
  const linksId = useId()
  const Heading = headingLevel
  const LinksHeading = headingLevel === 'h1' ? 'h2' : headingLevel === 'h2' ? 'h3' : 'h4'
  const art = illustration === undefined ? <DefaultIllustration /> : illustration

  const back = () => {
    if (onBack) onBack()
    else window.history.back()
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 px-4 py-10 text-center', className)}>
      {art && <div aria-hidden="true">{art}</div>}

      <div className="flex flex-col items-center gap-2">
        <Text size="caption" weight="bold" tone="faint" className="font-mono text-[56px] leading-none tracking-[-0.04em]">
          <span className="sr-only">Error </span>
          {code}
        </Text>
        <Text as={Heading} size="title">
          {title}
        </Text>
        {description && (
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[440px]">
            {description}
          </Text>
        )}
      </div>

      {search && <div className="w-full max-w-[400px] text-left">{search}</div>}

      {(showBack || homeHref !== null) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {showBack && (
            <Button variant="outline" onClick={back}>
              <ChevronLeftIcon size={14} />
              {backLabel}
            </Button>
          )}
          {homeHref !== null && (
            <Button as="a" href={homeHref}>
              {homeLabel}
            </Button>
          )}
        </div>
      )}

      {links.length > 0 && (
        <nav aria-labelledby={linksId} className="w-full text-left">
          <Text as={LinksHeading} id={linksId} size="caption" weight="bold" tone="faint" className="mb-2 uppercase tracking-wider">
            {linksTitle}
          </Text>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Text as="span" size="body">
                      {link.label}
                    </Text>
                    {link.description && (
                      <Text as="span" size="label" tone="soft" leading="tight">
                        {link.description}
                      </Text>
                    )}
                  </span>
                  <ArrowRightIcon
                    size={14}
                    className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
