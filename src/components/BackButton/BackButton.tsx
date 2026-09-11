'use client'

import { cn } from '../../lib/cn'

export interface BackButtonProps {
  /** Where it goes back to. Shown beside the chevron. */
  label?: string
  /** Called on press. Use `href` instead to render a link. */
  onClick?: () => void
  /** Render as a link instead of a button. */
  href?: string
  /** Hide the label, keeping it for assistive tech. */
  iconOnly?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      <path
        d="M10 3.5L5.5 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Chevron plus destination. It names where it goes rather than saying only
 * "Back", because a lone chevron gives a screen reader nothing to announce.
 */
export function BackButton({
  label = 'Back',
  onClick,
  href,
  iconOnly = false,
  className,
}: BackButtonProps) {
  const classes = cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-[13px] font-semibold leading-none',
    'text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink',
    iconOnly && 'w-9 justify-center px-0',
    className,
  )

  const content = (
    <>
      <ChevronLeft />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </>
  )

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  )
}
