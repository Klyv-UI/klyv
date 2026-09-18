import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type GridBreakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl'
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 12
/** One count, or one per breakpoint — `{ base: 1, md: 2, lg: 4 }`. */
export type GridResponsiveColumns = GridColumns | Partial<Record<GridBreakpoint, GridColumns>>
export type GridGap = 0 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12
export type GridAlign = 'start' | 'center' | 'end' | 'stretch'
export type GridItemSpan = 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'full'
/** One span, or one per breakpoint — `{ base: 'full', md: 2 }`. */
export type GridResponsiveSpan = GridItemSpan | Partial<Record<GridBreakpoint, GridItemSpan>>
export type GridItemRowSpan = 1 | 2 | 3 | 4

const BREAKPOINTS: GridBreakpoint[] = ['base', 'sm', 'md', 'lg', 'xl']

// Every class is written out in full: Tailwind finds utilities by reading the
// source, so a class assembled from a prefix and a number would never be built.
const COLUMNS: Record<GridBreakpoint, Record<GridColumns, string>> = {
  base: { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6', 12: 'grid-cols-12' },
  sm: { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 12: 'sm:grid-cols-12' },
  md: { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 12: 'md:grid-cols-12' },
  lg: { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12' },
  xl: { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 12: 'xl:grid-cols-12' },
}

const SPAN: Record<GridBreakpoint, Record<GridItemSpan, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6', 12: 'col-span-12', full: 'col-span-full' },
  sm: { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6', 12: 'sm:col-span-12', full: 'sm:col-span-full' },
  md: { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6', 12: 'md:col-span-12', full: 'md:col-span-full' },
  lg: { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6', 12: 'lg:col-span-12', full: 'lg:col-span-full' },
  xl: { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4', 5: 'xl:col-span-5', 6: 'xl:col-span-6', 12: 'xl:col-span-12', full: 'xl:col-span-full' },
}

const ROW_SPAN: Record<GridItemRowSpan, string> = { 1: 'row-span-1', 2: 'row-span-2', 3: 'row-span-3', 4: 'row-span-4' }

const GAP: Record<GridGap, string> = {
  0: 'gap-0', 1: 'gap-1', 1.5: 'gap-1.5', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12',
}

const ALIGN: Record<GridAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

function responsive<V extends string | number, T extends Record<string, string>>(
  value: V | Partial<Record<GridBreakpoint, V>> | undefined,
  table: Record<GridBreakpoint, T>,
) {
  if (value === undefined) return []
  const byPoint: Partial<Record<GridBreakpoint, V>> = typeof value === 'object' ? value : { base: value }
  return BREAKPOINTS.map((point) => (byPoint[point] === undefined ? false : table[point][byPoint[point] as keyof T]))
}

export interface GridOwnProps {
  /** Column count, or one per breakpoint: `{ base: 1, md: 2, lg: 4 }`. Ignored when `minItemWidth` is set. */
  columns?: GridResponsiveColumns
  /**
   * Fit as many columns as there is room for, each at least this wide — a number is pixels, a string any CSS length.
   * The grid then answers to its own width rather than the viewport’s, which is what a card list inside a sidebar layout wants.
   */
  minItemWidth?: number | string
  /** Space between cells, on the spacing scale — 4 is 16px. */
  gap?: GridGap
  /** Vertical alignment of cells inside their rows. */
  align?: GridAlign
  /** The cells. Wrap one in GridItem to span columns or rows. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type GridProps<E extends ElementType = 'div'> = GridOwnProps & {
  /** The element to render — `ul` for a list of cards, `section`. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof GridOwnProps | 'as'>

/**
 * The two-dimensional counterpart to Stack.
 *
 * Grid layouts come in two kinds and both are here. A fixed count per
 * breakpoint — one column on a phone, four on a desk — is what a dashboard
 * row wants, and is written as `columns`. A card list wants the opposite: as
 * many columns as fit, never narrower than a readable card. That is
 * `minItemWidth`, which writes `repeat(auto-fill, minmax(min(100%, w), 1fr))`
 * so it follows the grid’s own width, and the `min(100%, …)` stops a card
 * wider than its container from forcing a horizontal scroll.
 *
 * Spans live on GridItem rather than on arbitrary class names, so a span of
 * `full` still means the whole row after the column count changes.
 */
export function Grid<E extends ElementType = 'div'>({
  as,
  columns = 1,
  minItemWidth,
  gap = 4,
  align,
  children,
  className,
  style,
  ...props
}: GridProps<E> & { style?: CSSProperties }) {
  const Component = (as ?? 'div') as ElementType
  const min = typeof minItemWidth === 'number' ? `${minItemWidth}px` : minItemWidth

  return (
    <Component
      className={cn('grid min-w-0', !min && responsive(columns, COLUMNS), GAP[gap], align && ALIGN[align], className)}
      style={min ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}), 1fr))`, ...style } : style}
      {...props}
    >
      {children}
    </Component>
  )
}

export interface GridItemOwnProps {
  /** Columns to span, or one per breakpoint. `full` runs to the end of the row whatever the column count. */
  span?: GridResponsiveSpan
  /** Rows to span. */
  rowSpan?: GridItemRowSpan
  /** The cell’s content. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type GridItemProps<E extends ElementType = 'div'> = GridItemOwnProps & {
  /** The element to render — `li` inside a `ul` grid. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof GridItemOwnProps | 'as'>

/** One cell of a Grid that spans more than one column or row. */
export function GridItem<E extends ElementType = 'div'>({ as, span, rowSpan, children, className, ...props }: GridItemProps<E>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component className={cn('min-w-0', responsive(span, SPAN), rowSpan && ROW_SPAN[rowSpan], className)} {...props}>
      {children}
    </Component>
  )
}
