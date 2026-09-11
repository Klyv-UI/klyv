'use client'

import { cn } from '../../lib/cn'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export interface TabBarItem<T extends string = string> {
  value: T
  label: string
  icon: IconComponent
  /** Shows an unread marker on the item. */
  badge?: boolean
}

export interface TabBarProps<T extends string = string> {
  items: TabBarItem<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name for the bar. */
  label: string
  /** Pin to the bottom of the viewport, with safe-area padding. */
  fixed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The bottom navigation bar for narrow viewports: icon over label, one row,
 * always visible.
 *
 * It is navigation rather than tabs, so it is a nav landmark with
 * aria-current, not a tablist — a bottom bar usually switches routes, and
 * announcing it as tabs would promise a panel that is not there.
 */
export function TabBar<T extends string = string>({
  items,
  value,
  onValueChange,
  label,
  fixed = false,
  className,
}: TabBarProps<T>) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex w-full items-stretch gap-1 border-t border-line bg-surface px-2 pt-1.5',
        fixed
          ? 'fixed inset-x-0 bottom-0 z-[var(--z-sticky)] pb-[max(6px,env(safe-area-inset-bottom))]'
          : 'pb-1.5',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-glyph)] px-1 py-1.5 transition-colors',
              selected ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={selected ? 2.25 : 2} aria-hidden="true" />
              {item.badge && (
                <StatusDot ring className="absolute -right-1 -top-0.5" label={`${item.label} has updates`} />
              )}
            </span>
            <Text as="span" size="micro" weight={selected ? 'bold' : 'medium'} className="text-current">
              {item.label}
            </Text>
            {selected && (
              <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent-strong" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
