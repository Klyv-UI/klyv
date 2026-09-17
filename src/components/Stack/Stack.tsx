import { Children, Fragment, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type StackDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
export type StackBreakpoint = 'base' | 'sm' | 'md' | 'lg'
/** One direction, or one per breakpoint — `{ base: 'column', md: 'row' }`. */
export type StackResponsiveDirection = StackDirection | Partial<Record<StackBreakpoint, StackDirection>>
export type StackGap = 0 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

// Every class is written out in full: Tailwind finds utilities by reading the
// source, so a class assembled from a prefix and a value would never be built.
const DIRECTION: Record<StackBreakpoint, Record<StackDirection, string>> = {
  base: { row: 'flex-row', column: 'flex-col', 'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse' },
  sm: { row: 'sm:flex-row', column: 'sm:flex-col', 'row-reverse': 'sm:flex-row-reverse', 'column-reverse': 'sm:flex-col-reverse' },
  md: { row: 'md:flex-row', column: 'md:flex-col', 'row-reverse': 'md:flex-row-reverse', 'column-reverse': 'md:flex-col-reverse' },
  lg: { row: 'lg:flex-row', column: 'lg:flex-col', 'row-reverse': 'lg:flex-row-reverse', 'column-reverse': 'lg:flex-col-reverse' },
}

// A divider is a hairline across the cross axis: tall in a row, wide in a column.
const RULE: Record<StackBreakpoint, { row: string; column: string }> = {
  base: { row: 'h-auto w-px', column: 'h-px w-auto' },
  sm: { row: 'sm:h-auto sm:w-px', column: 'sm:h-px sm:w-auto' },
  md: { row: 'md:h-auto md:w-px', column: 'md:h-px md:w-auto' },
  lg: { row: 'lg:h-auto lg:w-px', column: 'lg:h-px lg:w-auto' },
}

const GAP: Record<StackGap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  1.5: 'gap-1.5',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
}

const ALIGN: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const JUSTIFY: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const BREAKPOINTS: StackBreakpoint[] = ['base', 'sm', 'md', 'lg']

export interface StackOwnProps {
  /** Main axis. Pass an object to change it at a breakpoint: `{ base: 'column', md: 'row' }`. */
  direction?: StackResponsiveDirection
  /** Space between children, on the spacing scale — 4 is 16px. */
  gap?: StackGap
  /** Cross-axis alignment. */
  align?: StackAlign
  /** Main-axis distribution. */
  justify?: StackJustify
  /** Let children wrap onto further lines. Dividers are best left off when wrapping. */
  wrap?: boolean
  /** Draw a hairline between children, turning with the direction at each breakpoint. */
  dividers?: boolean
  /** The children, laid out in order. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type StackProps<E extends ElementType = 'div'> = StackOwnProps & {
  /** The element to render — `ul`, `section`, `nav`. Dividers become list items inside a list. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof StackOwnProps | 'as'>

/**
 * The flex column and the flex row, with the spacing written once.
 *
 * Most layout in a product is "these things, in a line, this far apart" —
 * and written by hand it drifts: `gap-3` here, `space-y-2.5` there, a margin
 * on the last child. Stack keeps gap on the spacing scale and lets the
 * direction change at a breakpoint, which covers the common "stacked on a
 * phone, side by side on a desk" case without a media query.
 *
 * Dividers are real elements between the children rather than borders on
 * them, so they sit centred in the gap and turn with the direction. Inside a
 * `ul` or `ol` they render as hidden list items, so the list stays valid.
 */
export function Stack<E extends ElementType = 'div'>({
  as,
  direction = 'column',
  gap = 3,
  align,
  justify,
  wrap = false,
  dividers = false,
  children,
  className,
  ...props
}: StackProps<E>) {
  const Component = (as ?? 'div') as ElementType
  const directions: Partial<Record<StackBreakpoint, StackDirection>> =
    typeof direction === 'string' ? { base: direction } : { base: 'column', ...direction }

  const items = Children.toArray(children)
  const Rule = Component === 'ul' || Component === 'ol' ? 'li' : 'div'

  return (
    <Component
      className={cn(
        'flex min-w-0',
        BREAKPOINTS.map((point) => directions[point] && DIRECTION[point][directions[point]!]),
        GAP[gap],
        align && ALIGN[align],
        justify && JUSTIFY[justify],
        wrap && 'flex-wrap',
        className,
      )}
      {...props}
    >
      {dividers
        ? items.map((child, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <Rule
                  aria-hidden="true"
                  className={cn(
                    'shrink-0 self-stretch bg-line',
                    BREAKPOINTS.map((point) => {
                      const axis = directions[point]
                      return axis && RULE[point][axis.startsWith('row') ? 'row' : 'column']
                    }),
                  )}
                />
              )}
              {child}
            </Fragment>
          ))
        : children}
    </Component>
  )
}
