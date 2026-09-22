import type { ReactNode } from 'react'
import { cn } from 'klyvui'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

/**
 * A pill that filters a list, announced as a toggle. Used by every filterable
 * page — the catalogue, the changelog, Built With, Integrations — so a filter
 * looks and behaves the same wherever it appears.
 */
export function FilterChip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
        active
          ? 'bg-ink text-ink-inverse'
          : 'bg-surface-muted text-ink-soft hover:bg-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function Count({ children }: { children: ReactNode }) {
  return (
    // No opacity: it multiplies against whatever colour the row inherits and
    // throws away the contrast the ink tokens were chosen for. The mono face at
    // 10px already reads as secondary.
    <span className="font-mono text-[10px] font-bold tabular-nums">{children}</span>
  )
}
