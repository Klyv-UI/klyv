'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Divider } from '../Divider'
import { Text } from '../Text'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import type { IconComponent } from '../../lib/types'

export interface MenuItem {
  id: string
  label: string
  icon?: IconComponent
  /** Right-aligned hint — a shortcut, a count. */
  meta?: ReactNode
  disabled?: boolean
  /** Marks the item as the current choice. */
  selected?: boolean
  /** Reddens the item, for a destructive action. */
  destructive?: boolean
  onSelect?: () => void
}

export interface MenuProps {
  items: (MenuItem | 'separator')[]
  trigger: ReactNode
  /** Accessible name for the menu. */
  label: string
  /** Which side of the trigger it opens on. Flips when it would leave the viewport. */
  placement?: PopoverPlacement
  /** How it lines up with the trigger along that side. */
  align?: PopoverAlign
  /** Controlled open state. Omit to let the menu manage its own. */
  open?: boolean
  /** Called when the menu opens or closes. Pair with `open` to control it. */
  onOpenChange?: (open: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A list of actions in a Popover. Owns the menu keyboard model: arrows move,
 * Home and End jump, Enter activates, and choosing an item closes the panel.
 */
export function Menu({
  items,
  trigger,
  label,
  placement = 'bottom',
  align = 'start',
  open: controlledOpen,
  onOpenChange,
  className,
}: MenuProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const listRef = useRef<HTMLDivElement>(null)

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }

  const actionable = items.filter(
    (item): item is MenuItem => item !== 'separator' && !item.disabled,
  )

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? []),
    ]
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      nodes[(index + step + nodes.length) % nodes.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
    }
  }

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      className={cn('min-w-[180px] p-1', className)}
    >
      <div
        ref={listRef}
        role="menu"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="flex flex-col"
      >
        {items.map((item, index) => {
          if (item === 'separator') {
            return <Divider key={`separator-${index}`} className="my-1" />
          }
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onSelect?.()
                setOpen(false)
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                'disabled:pointer-events-none disabled:opacity-40',
                item.destructive
                  ? 'text-danger hover:bg-danger/10'
                  : item.selected
                    ? 'bg-surface-muted text-ink'
                    : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              )}
            >
              {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.meta && (
                <Text as="span" size="caption" tone="faint">
                  {item.meta}
                </Text>
              )}
            </button>
          )
        })}
        {actionable.length === 0 && (
          <Text size="caption" tone="faint" className="px-2.5 py-2">
            Nothing available
          </Text>
        )}
      </div>
    </Popover>
  )
}
