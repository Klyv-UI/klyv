'use client'

import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'

export interface ToggleGroupItem<T extends string = string> {
  value: T
  label: string
  icon?: IconComponent
  /**
   * Show the icon alone. The label is still required and still announced — an
   * icon-only toggle without one is a control nobody can name.
   */
  iconOnly?: boolean
  disabled?: boolean
}

export type ToggleGroupSize = 'sm' | 'md'

const SIZES: Record<ToggleGroupSize, { text: string; square: string; icon: number }> = {
  sm: { text: 'h-7 px-3 text-[12px]', square: 'h-7 w-7', icon: 14 },
  md: { text: 'h-8 px-3.5 text-[13px]', square: 'h-8 w-8', icon: 15 },
}

export interface ToggleGroupProps<T extends string = string> {
  items: ToggleGroupItem<T>[]
  /** The values currently pressed. */
  value: T[]
  onValueChange: (value: T[]) => void
  /**
   * `multiple` lets any combination be on — bold and italic together. `single`
   * allows at most one, and pressing it again turns it off, which is what
   * separates this from SegmentedControl, where exactly one is always chosen.
   */
  type?: 'single' | 'multiple'
  /** Accessible name for the set. */
  label: string
  size?: ToggleGroupSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A row of on/off toggles.
 *
 * Each one is a real button with aria-pressed, so it is announced as a toggle
 * that is pressed or not — rather than as a radio or a checkbox dressed up as a
 * button. The pressed state takes the accent because it is the state the eye is
 * looking for; everything else stays quiet.
 */
export function ToggleGroup<T extends string = string>({
  items,
  value,
  onValueChange,
  type = 'multiple',
  label,
  size = 'md',
  className,
}: ToggleGroupProps<T>) {
  const toggle = (item: T) => {
    const pressed = value.includes(item)
    if (type === 'single') onValueChange(pressed ? [] : [item])
    else onValueChange(pressed ? value.filter((entry) => entry !== item) : [...value, item])
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-full bg-surface-muted p-0.5', className)}
    >
      {items.map((item) => {
        const pressed = value.includes(item.value)
        const Icon = item.icon

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={pressed}
            aria-label={item.iconOnly ? item.label : undefined}
            disabled={item.disabled}
            onClick={() => toggle(item.value)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold leading-none transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              item.iconOnly ? SIZES[size].square : SIZES[size].text,
              pressed ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:bg-surface hover:text-ink',
            )}
          >
            {Icon && <Icon size={SIZES[size].icon} strokeWidth={2} aria-hidden="true" />}
            {!item.iconOnly && item.label}
          </button>
        )
      })}
    </div>
  )
}
