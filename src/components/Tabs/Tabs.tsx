'use client'

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'

export interface TabItem<T extends string = string> {
  value: T
  label: string
  icon?: IconComponent
  /** Count or status shown after the label. */
  badge?: ReactNode
  disabled?: boolean
  content: ReactNode
}

export type TabsVariant = 'pill' | 'underline'

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name for the tab list. */
  label: string
  variant?: TabsVariant
  /** Stretch the tabs to fill the width. */
  fullWidth?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Tabs with the full keyboard model: arrows move, Home and End jump, and only
 * the selected tab is a tab stop, so Tab moves out to the panel rather than
 * through every tab.
 *
 * `pill` reuses the dashboard nav treatment; `underline` is for tabs inside a
 * card, where a filled pill would compete with the card header.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onValueChange,
  label,
  variant = 'pill',
  fullWidth = false,
  className,
}: TabsProps<T>) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = items.find((item) => item.value === value) ?? items[0]

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const enabled = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.disabled)
    if (enabled.length === 0) return

    let target
    if (event.key === 'Home') target = enabled[0]
    else if (event.key === 'End') target = enabled[enabled.length - 1]
    else {
      const step = event.key === 'ArrowRight' ? 1 : -1
      const position = enabled.findIndex(({ i }) => i === index)
      target = enabled[(position + step + enabled.length) % enabled.length]
    }

    onValueChange(target.item.value)
    refs.current[target.i]?.focus()
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          // The strip scrolls rather than wrapping or clipping: a tab that has
          // overflowed its container is a tab that cannot be reached at all.
          'no-scrollbar flex max-w-full items-center overflow-x-auto',
          variant === 'pill'
            ? 'gap-0.5 self-start rounded-full bg-surface p-1 shadow-[var(--shadow-tile)]'
            : 'gap-1 border-b border-line',
          fullWidth && 'w-full self-stretch',
        )}
      >
        {items.map((item, index) => {
          const selected = item.value === value
          const Icon = item.icon
          return (
            <button
              key={item.value}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-[13px] leading-none transition-colors',
                'disabled:pointer-events-none disabled:opacity-40',
                fullWidth && 'flex-1 justify-center',
                variant === 'pill'
                  ? cn(
                      'h-8 rounded-full px-3.5',
                      selected
                        ? 'bg-accent font-bold tracking-[-0.01em] text-accent-ink'
                        : 'font-medium text-ink-soft hover:text-ink',
                    )
                  : cn(
                      '-mb-px h-9 border-b-2 px-3',
                      selected
                        ? 'border-b-accent-strong font-bold text-ink'
                        : 'border-b-transparent font-medium text-ink-soft hover:text-ink',
                    ),
              )}
            >
              {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
              {item.label}
              {item.badge}
            </button>
          )
        })}
      </div>

      {current && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.value}`}
          aria-labelledby={`${base}-tab-${current.value}`}
          tabIndex={0}
          className="min-w-0 focus-visible:outline-none"
        >
          {current.content}
        </div>
      )}
    </div>
  )
}
