'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button, type ButtonSize } from '../Button'
import { ChevronDownIcon } from '../internal/icons'
import { Menu, type MenuItem } from '../Menu'

export interface SplitButtonProps {
  /** The primary action's label. */
  children: ReactNode
  /** The primary action. */
  onClick: () => void
  /** The alternatives, shown in the menu. */
  items: (MenuItem | 'separator')[]
  /** Accessible name for the menu half — "More save options". */
  menuLabel: string
  /** Emphasis, shared by both halves. */
  variant?: 'accent' | 'muted' | 'outline'
  /** Control height, shared by both halves. */
  size?: ButtonSize
  /** Disables the action and the menu together. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A primary action with its alternatives one click away — Save, and beside it
 * Save as draft and Save and close.
 *
 * It is two buttons, not one button with a hot zone: the action and the menu
 * are separate tab stops with separate names, so nobody using a keyboard or a
 * screen reader has to guess which half they are on. The menu is the
 * library's Menu, so it brings arrow keys, Escape and outside-click with it.
 */
export function SplitButton({
  children,
  onClick,
  items,
  menuLabel,
  variant = 'accent',
  size = 'md',
  disabled = false,
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('inline-flex items-stretch', className)}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={onClick}
        className="rounded-r-none"
      >
        {children}
      </Button>

      <Menu
        label={menuLabel}
        items={items}
        open={open}
        onOpenChange={setOpen}
        align="end"
        trigger={
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            aria-label={menuLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            className={cn(
              'rounded-l-none',
              size === 'sm' ? 'px-2' : 'px-2.5',
              // Outline halves share one border; filled halves get a hairline
              // mixed from their own label colour, so it works on any fill.
              variant === 'outline'
                ? '-ml-px'
                : 'border-l border-l-[color:color-mix(in_oklab,currentColor_24%,transparent)]',
            )}
          >
            <ChevronDownIcon size={size === 'sm' ? 12 : 14} />
          </Button>
        }
      />
    </div>
  )
}
