'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ToolbarProps {
  /** The controls. Separators are drawn between groups. */
  children: ReactNode
  /** Accessible name for the cluster. */
  label: string
  /** track is the lifted white rail from the header; bare has no chrome. */
  variant?: 'track' | 'bare'
  orientation?: 'horizontal' | 'vertical'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A cluster of icon controls on one track — the header utility group.
 *
 * Arrow keys move between the controls and the cluster is a single tab stop,
 * which is what stops a row of six icons costing six tabs to pass.
 */
export function Toolbar({
  children,
  label,
  variant = 'track',
  orientation = 'horizontal',
  className,
}: ToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const back = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    if (event.key !== forward && event.key !== back) return

    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])]
    if (items.length === 0) return

    event.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLElement)
    const step = event.key === forward ? 1 : -1
    const next = (index + step + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5',
        orientation === 'vertical' && 'flex-col',
        variant === 'track' && 'rounded-full bg-surface p-1 shadow-[var(--shadow-tile)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
