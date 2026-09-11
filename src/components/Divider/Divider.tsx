import { cn } from '../../lib/cn'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  /** Merged last, so it wins. */
  className?: string
}

/** Hairline rule on the `line` token — the same separator the drawer uses. */
export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  return (
    <hr
      aria-orientation={orientation}
      className={cn(
        'border-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px self-stretch',
        className,
      )}
    />
  )
}
