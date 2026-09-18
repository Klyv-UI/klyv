import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ExternalIcon } from '../internal/icons'

export type TextLinkTone = 'default' | 'accent' | 'soft' | 'inherit'
export type TextLinkUnderline = 'always' | 'hover'

const TONES: Record<TextLinkTone, string> = {
  /** Ink text on an accent underline — the accent carries the “this is a link” signal without carrying the text. */
  default: 'text-ink decoration-accent-strong hover:decoration-ink',
  /** Accent-toned text, mixed towards ink so it clears 4.5:1 like Text’s `accent` tone. */
  accent:
    'text-[color-mix(in_oklab,var(--color-accent-strong)_45%,var(--color-ink))] decoration-current/40 hover:decoration-current',
  /** Secondary copy — footers, captions, legal lines. */
  soft: 'text-ink-soft decoration-line-strong hover:text-ink hover:decoration-ink',
  /** Takes the surrounding colour, for links inside a banner or an alert. */
  inherit: 'text-inherit decoration-current/40 hover:decoration-current',
}

export interface TextLinkOwnProps {
  /** Colour treatment. */
  tone?: TextLinkTone
  /** `always` for links inside running text, where colour alone would not mark them; `hover` for navigation lists. */
  underline?: TextLinkUnderline
  /**
   * Opens in a new tab: adds `target="_blank"`, `rel="noopener noreferrer"`, an arrow glyph, and the words below for
   * screen readers. Defaults to true when `target="_blank"` is passed.
   */
  external?: boolean
  /** Hidden text read after an external link’s name. */
  newTabLabel?: string
  /** Renders plain text marked as a disabled link — nothing to click, nothing to tab to. */
  disabled?: boolean
  /** The link text. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type TextLinkProps<E extends ElementType = 'a'> = TextLinkOwnProps & {
  /** Render as another component — usually a router link: `as={Link} to="/billing"`. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof TextLinkOwnProps | 'as'>

/**
 * The library’s inline link.
 *
 * The accent is a fill colour — as text it fails contrast on a light surface —
 * so by default the link text stays ink and the accent goes into a thick
 * underline set a few pixels below the baseline, where it clears descenders.
 * That keeps links findable in running text by more than colour alone
 * (WCAG 1.4.1) without dimming the words.
 *
 * A link that opens a new tab says so twice: a small arrow for sighted
 * readers and “(opens in new tab)” in the accessible name for everyone else,
 * with `rel="noopener noreferrer"` so the opened page cannot reach back.
 * Visited links fade their underline — browsers only allow colour changes on
 * `:visited`, so decoration colour is the one signal available.
 *
 * A disabled link is not a link: it renders as text with `aria-disabled`, so
 * it neither navigates nor sits in the tab order, and a router `Link` passed
 * through `as` is not mounted at all.
 */
export function TextLink<E extends ElementType = 'a'>({
  as,
  tone = 'default',
  underline = 'always',
  external,
  newTabLabel = '(opens in new tab)',
  disabled = false,
  children,
  className,
  ...props
}: TextLinkProps<E>) {
  const rest = props as Record<string, unknown>
  const opensNewTab = external ?? rest.target === '_blank'

  const classes = cn(
    'rounded-[4px] font-semibold decoration-2 underline-offset-[0.22em] transition-colors',
    underline === 'always' ? 'underline' : 'no-underline hover:underline',
    TONES[tone],
    'visited:decoration-ink-faint',
    className,
  )

  if (disabled) {
    return (
      <span role="link" aria-disabled="true" className={cn(classes, 'cursor-not-allowed no-underline opacity-50 hover:no-underline')}>
        {children}
      </span>
    )
  }

  const Component = (as ?? 'a') as ElementType
  // A caller’s own `rel` (nofollow, me) is kept, never allowed to drop the two that protect the opener.
  const rel = opensNewTab
    ? [...new Set([...String(rest.rel ?? '').split(/\s+/).filter(Boolean), 'noopener', 'noreferrer'])].join(' ')
    : rest.rel

  return (
    <Component target={opensNewTab ? '_blank' : undefined} {...props} rel={rel} className={classes}>
      {children}
      {opensNewTab && (
        <>
          <ExternalIcon size="0.8em" strokeWidth={2} className="ml-0.5 inline-block align-[-0.05em]" />
          <span className="sr-only"> {newTabLabel}</span>
        </>
      )}
    </Component>
  )
}
