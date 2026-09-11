'use client'

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export type ChipSize = 'sm' | 'md'

const SIZES: Record<ChipSize, string> = {
  sm: 'h-7 pl-2.5 text-[11px]',
  md: 'h-8 pl-3 text-[12px]',
}

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> & {
  /** Visible text. */
  label: string
  size?: ChipSize
  /** Toggled on. Sets aria-pressed, so the chip reads as a toggle. */
  selected?: boolean
  /** Adds a remove affordance. The chip stays clickable in its own right. */
  onRemove?: () => void
}

/**
 * The interactive counterpart to `Tag`: a filter value that can be toggled,
 * removed, or both. The remove control is a separate button so that removing
 * and selecting stay distinguishable to a screen reader.
 */
export function Chip({
  className,
  label,
  size = 'md',
  selected = false,
  onRemove,
  disabled,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border transition-colors',
        selected
          ? 'border-accent-strong bg-accent text-accent-ink'
          : 'border-line-strong bg-surface text-ink-soft',
        disabled && 'pointer-events-none opacity-40',
        SIZES[size],
        onRemove ? 'pr-1' : size === 'sm' ? 'pr-2.5' : 'pr-3',
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        className="font-semibold leading-none outline-none transition-colors hover:text-ink disabled:cursor-not-allowed"
        {...props}
      >
        {label}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={cn(
            'ml-1.5 inline-flex items-center justify-center rounded-full transition-colors',
            size === 'sm' ? 'size-4' : 'size-5',
            selected ? 'hover:bg-accent-strong' : 'hover:bg-surface-muted hover:text-ink',
          )}
        >
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <VisuallyHidden>Remove {label}</VisuallyHidden>
        </button>
      )}
    </span>
  )
}
