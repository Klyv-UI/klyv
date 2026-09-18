'use client'

import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Tooltip } from '../Tooltip'
import type { IconComponent } from '../../lib/types'

export interface RailItem<T extends string = string> {
  value: T
  label: string
  icon: IconComponent
}

export interface SidebarRailProps<T extends string = string> {
  /** The primary group of destinations. */
  items: RailItem<T>[]
  /** Pinned to the bottom — settings, sign out. */
  footerItems?: RailItem<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name for the rail. */
  label?: string
  /** Show a Tooltip on each control. */
  tooltips?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The 42px icon rail: a primary group optically centred against the content
 * column, and a utility group pinned to the bottom.
 *
 * Every control carries a real label through IconButton, so the rail is usable
 * without the tooltips — those are an accelerator, not the label.
 */
export function SidebarRail<T extends string = string>({
  items,
  footerItems = [],
  value,
  onValueChange,
  label = 'Sections',
  tooltips = true,
  className,
}: SidebarRailProps<T>) {
  const render = (item: RailItem<T>) => {
    const control = (
      <IconButton
        icon={item.icon}
        label={item.label}
        tone="plain"
        shape="square"
        selected={item.value === value}
        onClick={() => onValueChange(item.value)}
        className="size-[42px] rounded-[var(--radius-13)]"
      />
    )
    return (
      <li key={item.value}>
        {tooltips ? (
          <Tooltip content={item.label} placement="right">
            {control}
          </Tooltip>
        ) : (
          control
        )}
      </li>
    )
  }

  return (
    <nav
      aria-label={label}
      className={cn('flex w-[42px] shrink-0 flex-col justify-between py-2', className)}
    >
      <span aria-hidden="true" />
      <ul className="flex flex-col gap-[6px]">{items.map(render)}</ul>
      <ul className="flex flex-col gap-[6px]">{footerItems.map(render)}</ul>
    </nav>
  )
}
