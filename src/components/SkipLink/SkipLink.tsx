import type { AnchorHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type SkipLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Id of the landmark to jump to, without the hash. */
  target: string
}

/**
 * The first thing in the tab order: a link that lets a keyboard user jump past
 * the navigation. Invisible until focused, then it appears over the header.
 */
export function SkipLink({ className, target, children = 'Skip to content', ...props }: SkipLinkProps) {
  return (
    <a
      href={`#${target}`}
      className={cn(
        'sr-only rounded-full bg-surface px-4 text-[13px] font-bold leading-none text-ink shadow-[var(--shadow-float)]',
        'focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4',
        'focus-visible:z-[var(--z-overlay)] focus-visible:inline-flex focus-visible:h-10 focus-visible:items-center',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}
