'use client'

import { useState } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '../Button'
import { Menu, type MenuItem } from '../Menu'
import type { PopoverAlign, PopoverPlacement } from '../Popover'

export interface DropdownMenuProps {
  /** The menu contents. */
  items: (MenuItem | 'separator')[]
  /** Trigger text. */
  label: string
  /** Accessible name for the menu panel. Defaults to the trigger label. */
  menuLabel?: string
  /** Trigger styling, matching Button. */
  variant?: ButtonVariant
  /** Trigger height, matching Button. */
  size?: ButtonSize
  /** Which side of the trigger it opens on. Flips when it would leave the viewport. */
  placement?: PopoverPlacement
  /** How it lines up with the trigger along that side. */
  align?: PopoverAlign
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      aria-hidden="true"
      className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Menu with a labelled Button trigger — the common case, packaged so callers
 * do not rewire aria-haspopup and aria-expanded every time.
 */
export function DropdownMenu({
  items,
  label,
  menuLabel,
  variant = 'outline',
  size = 'md',
  placement = 'bottom',
  align = 'start',
  disabled = false,
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <Menu
      items={items}
      label={menuLabel ?? label}
      placement={placement}
      align={align}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          className={className}
        >
          {label}
          <Chevron open={open} />
        </Button>
      }
    />
  )
}
