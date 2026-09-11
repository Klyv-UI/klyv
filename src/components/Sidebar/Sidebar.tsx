'use client'

import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Divider } from '../Divider'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export interface SidebarItem<T extends string = string> {
  value: T
  label: string
  icon?: IconComponent
  /** Count or status shown on the right. */
  badge?: string | number
  disabled?: boolean
}

export interface SidebarGroup<T extends string = string> {
  /** Uppercase group heading. Omit for an unlabelled group. */
  label?: string
  items: SidebarItem<T>[]
}

export interface SidebarProps<T extends string = string> {
  groups: SidebarGroup<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name for the navigation. */
  label?: string
  /** Pinned to the bottom, above any footer content. */
  footer?: React.ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The full-width navigation column: grouped sections with optional counts.
 *
 * The current item carries aria-current="page" rather than only a background
 * colour, so it is announced as the current location.
 */
export function Sidebar<T extends string = string>({
  groups,
  value,
  onValueChange,
  label = 'Sections',
  footer,
  className,
}: SidebarProps<T>) {
  return (
    <nav aria-label={label} className={cn('flex w-[232px] shrink-0 flex-col gap-5', className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-1">
            {group.label && (
              <Text size="caption" weight="bold" tone="faint" className="px-2.5 uppercase tracking-wider">
                {group.label}
              </Text>
            )}
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const selected = item.value === value
                const Icon = item.icon
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => onValueChange(item.value)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition-colors',
                        'disabled:pointer-events-none disabled:opacity-40',
                        selected
                          ? 'bg-accent font-bold text-accent-ink'
                          : 'font-medium text-ink-soft hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      {item.badge !== undefined && (
                        <Badge tone={selected ? 'neutral' : 'neutral'}>{item.badge}</Badge>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      {footer && (
        <div className="flex flex-col gap-3">
          <Divider />
          {footer}
        </div>
      )}
    </nav>
  )
}
