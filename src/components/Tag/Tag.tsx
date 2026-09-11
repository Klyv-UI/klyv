import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type TagTone = 'neutral' | 'outline' | 'accent'
export type TagSize = 'sm' | 'md'

const TONES: Record<TagTone, string> = {
  neutral: 'bg-surface-muted text-ink-soft',
  outline: 'border border-line-strong text-ink-soft',
  accent: 'bg-accent-soft text-[color-mix(in_oklab,var(--color-accent-strong)_58%,var(--color-ink))]',
}

const SIZES: Record<TagSize, string> = {
  sm: 'h-5 px-2 text-[10px]',
  md: 'h-6 px-2.5 text-[11px]',
}

export interface TagProps {
  children: ReactNode
  tone?: TagTone
  size?: TagSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A static label for classifying something. Non-interactive by definition —
 * if it can be selected or removed, it is a `Chip`. Distinct from `Badge`,
 * which is a small qualifier pinned to another element rather than a category.
 */
export function Tag({ children, tone = 'neutral', size = 'md', className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold leading-none',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
