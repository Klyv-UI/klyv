'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { StarIcon } from '../internal/icons'

export type RatingSize = 'sm' | 'md' | 'lg'

const SIZES: Record<RatingSize, number> = { sm: 16, md: 20, lg: 28 }

export interface RatingProps {
  value: number
  onValueChange?: (value: number) => void
  /** Number of stars. */
  max?: number
  /** Star size: 16, 20 or 28px. */
  size?: RatingSize
  /** Accessible name for the control. */
  label: string
  /** Display only. Renders as an image with a text alternative. */
  readOnly?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A star scale. Interactive ratings are a real radio group, so arrow keys work
 * and the current value is announced; read-only ratings collapse to a single
 * image with a text alternative rather than five separate controls.
 */
export function Rating({
  value,
  onValueChange,
  max = 5,
  size = 'md',
  label,
  readOnly = false,
  disabled = false,
  className,
}: RatingProps) {
  const name = useId()
  const [hovered, setHovered] = useState<number | null>(null)
  const px = SIZES[size]
  const shown = hovered ?? value

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={`${label}: ${value} out of ${max}`}
        className={cn('inline-flex items-center gap-0.5', className)}
      >
        {Array.from({ length: max }, (_, index) => (
          <StarIcon
            key={index}
            size={px}
            className={index < value ? 'text-accent-strong' : 'text-line-strong'}
          />
        ))}
      </span>
    )
  }

  return (
    <span
      role="radiogroup"
      aria-label={label}
      onPointerLeave={() => setHovered(null)}
      className={cn('inline-flex items-center gap-0.5', disabled && 'pointer-events-none opacity-40', className)}
    >
      {Array.from({ length: max }, (_, index) => {
        const star = index + 1
        return (
          <label
            key={star}
            onPointerEnter={() => setHovered(star)}
            className="cursor-pointer p-0.5 leading-none"
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              disabled={disabled}
              onChange={() => onValueChange?.(star)}
              className="peer sr-only"
            />
            <StarIcon
              size={px}
              className={cn(
                'transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-strong',
                star <= shown ? 'text-accent-strong' : 'text-line-strong',
              )}
            />
            <VisuallyHidden>
              {star} star{star === 1 ? '' : 's'}
            </VisuallyHidden>
          </label>
        )
      })}
    </span>
  )
}
