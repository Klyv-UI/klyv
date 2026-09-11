import type { ButtonHTMLAttributes } from 'react'
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
  /** Action lifted off a coloured surface — Order Yours Now. */
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

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Swaps the label for a spinner and blocks interaction. */
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  className,
  variant = 'accent',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold leading-none transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </button>
  )
}
