import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'

/** Every variant here appears in the dashboard; none were added speculatively. */
export type ButtonVariant = 'accent' | 'muted' | 'outline' | 'white' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  /** Primary action — Send, Swap. */
  accent: 'bg-accent text-accent-ink hover:bg-accent-strong active:bg-accent-strong',
  /** Secondary action on a card — Payments, QR, More. */
  muted: 'bg-surface-muted text-ink hover:bg-line-strong active:bg-line-strong',
  /** Quiet action inside a card — Withdraw. */
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-muted',
  /** Action lifted off a coloured surface. `shell` is white on a light page
   *  and near-black on a dark one, so the label stays readable either way. */
  white: 'bg-shell text-ink shadow-[var(--shadow-float)] hover:bg-surface-muted',
  /** Lowest-emphasis action — inline affordances. */
  ghost: 'text-ink-soft hover:bg-surface-muted hover:text-ink',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-[12px]',
  md: 'h-10 px-5 text-[13px]',
}

export interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Swaps the label for a spinner and blocks interaction. */
  loading?: boolean
  fullWidth?: boolean
  /**
   * Blocks interaction. On a native button this is the `disabled` attribute;
   * on anything else — a link — there is no such attribute, so the element is
   * marked `aria-disabled`, taken out of the tab order and made inert to the
   * pointer instead.
   */
  disabled?: boolean
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export type ButtonProps<E extends ElementType = 'button'> = ButtonOwnProps & {
  /**
   * Render as another element — usually a router link: `as={Link} to="/start"`.
   * Navigation belongs on a link, and a button nested inside one is invalid
   * interactive markup, so this is how a call to action reaches another page.
   */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof ButtonOwnProps | 'as'>

export function Button<E extends ElementType = 'button'>({
  as,
  className,
  variant = 'accent',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps<E>) {
  const Component = (as ?? 'button') as ElementType
  const blocked = Boolean(disabled || loading)

  // Only a real button takes `type` and `disabled`. Set before the spread, so a
  // caller's `type="submit"` still wins.
  const state =
    Component === 'button'
      ? { type: 'button', disabled: blocked }
      : { 'aria-disabled': blocked || undefined, tabIndex: blocked ? -1 : undefined }

  return (
    <Component
      {...state}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold leading-none transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        'aria-disabled:pointer-events-none aria-disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </Component>
  )
}
