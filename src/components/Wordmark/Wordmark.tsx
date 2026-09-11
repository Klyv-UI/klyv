import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type WordmarkSize = 'sm' | 'md' | 'lg'

const SIZES: Record<WordmarkSize, { mark: number; radius: string; text: string; gap: string }> = {
  sm: { mark: 28, radius: 'rounded-[9px]', text: 'text-[15px]', gap: 'gap-2' },
  md: { mark: 34, radius: 'rounded-[11px]', text: 'text-[18px]', gap: 'gap-2.5' },
  lg: { mark: 44, radius: 'rounded-[14px]', text: 'text-[24px]', gap: 'gap-3' },
}

export interface WordmarkProps {
  /** Product name, rendered beside the mark. */
  name: string
  /** The mark itself — a glyph, a letter, an inline SVG. Kept as a slot so the
   *  library carries no brand asset of its own. */
  mark?: ReactNode
  size?: WordmarkSize
  /** Hide the name and expose it to assistive tech only. */
  markOnly?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/** Mark-plus-name lockup, sized as one unit so the two never drift apart. */
export function Wordmark({ name, mark, size = 'md', markOnly = false, className }: WordmarkProps) {
  const { mark: markSize, radius, text, gap } = SIZES[size]

  return (
    <span className={cn('inline-flex shrink-0 items-center', gap, className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center bg-accent font-extrabold text-accent-ink',
          radius,
        )}
        style={{ width: markSize, height: markSize, fontSize: Math.round(markSize * 0.5) }}
      >
        {mark ?? name.charAt(0).toLowerCase()}
      </span>
      {markOnly ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className={cn('font-extrabold leading-none tracking-[-0.03em] text-ink', text)}>
          {name}
        </span>
      )}
    </span>
  )
}
