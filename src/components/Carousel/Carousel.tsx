'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'
import { useCarousel } from './useCarousel'

export interface CarouselProps {
  /** The slides, one per child. */
  children: ReactNode
  /** Accessible name for the track. */
  label: string
  /** Minimum width of each item while scrolling. */
  itemMinWidth?: number
  /**
   * Breakpoint from which the track becomes a plain grid. The dashboard band
   * scrolls below xl and is a three-up grid above it.
   */
  gridFrom?: 'md' | 'lg' | 'xl' | 'never'
  /** Columns once it becomes a grid. */
  columns?: 2 | 3 | 4
  /** Merged last, so it wins. */
  className?: string
}

const GRID_CLASSES = {
  md: 'md:auto-cols-auto md:grid-flow-row md:overflow-visible',
  lg: 'lg:auto-cols-auto lg:grid-flow-row lg:overflow-visible',
  xl: 'xl:auto-cols-auto xl:grid-flow-row xl:overflow-visible',
  never: '',
} as const

const COLUMN_CLASSES = {
  md: { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' },
  lg: { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' },
  xl: { 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4' },
  never: { 2: '', 3: '', 4: '' },
} as const

/**
 * A scroll-snap track with chevron controls that become a plain grid at a
 * chosen breakpoint — the dashboard card band exactly.
 *
 * The track scrolls natively, so it keeps momentum, trackpad gestures and
 * keyboard scrolling; the chevrons are an addition rather than a replacement,
 * and they hide when there is nothing left to scroll.
 */
export function Carousel({
  children,
  label,
  itemMinWidth = 300,
  gridFrom = 'xl',
  columns = 3,
  className,
}: CarouselProps) {
  const { trackRef, canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useCarousel()

  return (
    <div className={cn('relative', className)}>
      {canScrollPrev && (
        <IconButton
          icon={ChevronLeftIcon}
          label="Previous"
          tone="white"
          size="lg"
          onClick={scrollPrev}
          className="absolute left-1 top-1/2 z-[var(--z-sticky)] -translate-y-1/2"
        />
      )}
      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        style={{ gridAutoColumns: `minmax(${itemMinWidth}px, 1fr)` }}
        className={cn(
          'no-scrollbar grid grid-flow-col gap-4 overflow-x-auto scroll-smooth',
          '[scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start]',
          GRID_CLASSES[gridFrom],
          COLUMN_CLASSES[gridFrom][columns],
        )}
      >
        {children}
      </div>
      {canScrollNext && (
        <IconButton
          icon={ChevronRightIcon}
          label="Next"
          tone="white"
          size="lg"
          onClick={scrollNext}
          className="absolute right-1 top-1/2 z-[var(--z-sticky)] -translate-y-1/2"
        />
      )}
    </div>
  )
}
