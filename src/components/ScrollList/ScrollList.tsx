import { cn } from '../../lib/cn'
import { ScrollArea, type ScrollAreaProps } from '../ScrollArea'

/**
 * @deprecated Use `ScrollArea` with `scrollbar="hidden"`. `label` is optional here only
 * for compatibility; give the region a name that says what it holds.
 */
export type ScrollListProps = Omit<ScrollAreaProps, 'label'> & {
  /** Accessible name for the scrolling region. */
  label?: string
}

/**
 * Scrolling container for a List, kept for code written against 1.0.
 *
 * @deprecated Use `ScrollArea` with `scrollbar="hidden"`. ScrollList is now that and
 * nothing more: a named, focusable region with a hidden scrollbar, whose fade
 * shows only while there is more past the edge rather than always.
 */
export function ScrollList({ label = 'Scrollable list', className, ...rest }: ScrollListProps) {
  return <ScrollArea label={label} scrollbar="hidden" className={cn('-mx-2.5 flex-1', className)} {...rest} />
}
