import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * The five container recipes the dashboard repeats. Extracting them is what
 * removes the long, drifting `rounded-… border-… bg-… shadow-…` strings.
 */
export type SurfaceVariant = 'card' | 'tile' | 'field' | 'sunken' | 'floating'

const VARIANTS: Record<SurfaceVariant, string> = {
  /** Cards — the main content containers. */
  card: 'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
  /** Bordered tiles nested inside a card (partner tiles, payment tiles). */
  tile: 'rounded-[var(--radius-tile)] border border-line',
  /** Filled input surfaces (the exchange amount fields). */
  field: 'rounded-[var(--radius-field)] bg-surface-muted',
  /** Recessed rows for read-only key/value pairs (currency rate, fee). */
  sunken: 'rounded-[var(--radius-glyph)] bg-surface-sunken',
  /** Detached layers — menus, drawers, floating controls. */
  floating: 'rounded-[var(--radius-tile)] bg-surface shadow-[var(--shadow-float)]',
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-3.5',
  lg: 'p-5',
} as const

export type SurfacePadding = keyof typeof PADDING

export interface SurfaceOwnProps {
  variant?: SurfaceVariant
  padding?: SurfacePadding
  /** Strengthen the border on hover, as nested tiles do in the dashboard. */
  interactive?: boolean
  /** The surface contents. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

type SurfaceProps<E extends ElementType> = SurfaceOwnProps & {
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof SurfaceOwnProps | 'as'>

export function Surface<E extends ElementType = 'div'>({
  as,
  variant = 'card',
  padding = 'none',
  interactive = false,
  className,
  ...rest
}: SurfaceProps<E>) {
  const Component = (as ?? 'div') as ElementType

  return (
    <Component
      className={cn(
        // Every container in the dashboard is a vertical stack; `flex-row`,
        // `grid` or `block` in `className` override this when it is not.
        'flex flex-col',
        VARIANTS[variant],
        PADDING[padding],
        interactive && 'transition-colors hover:border-line-strong',
        className,
      )}
      {...rest}
    />
  )
}
