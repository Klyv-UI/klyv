'use client'

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Button, type ButtonSize, type ButtonVariant } from '../Button'
import { VisuallyHidden } from '../VisuallyHidden'

export interface ToggleButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'value' | 'defaultValue' | 'aria-pressed'> {
  /**
   * The label. It must not change with the state — "Mute" stays "Mute" and the
   * pressed state says whether it is on. A label that flips to "Unmute" makes
   * a screen reader announce "Unmute, pressed", which contradicts itself.
   */
  children: ReactNode
  /** Controlled pressed state. */
  pressed?: boolean
  /** Starting state when uncontrolled. */
  defaultPressed?: boolean
  /** Called with the new state after each press. */
  onPressedChange?: (pressed: boolean) => void
  /** Look while not pressed. Same set as Button. */
  variant?: ButtonVariant
  /** Look while pressed. */
  pressedVariant?: ButtonVariant
  /** Same heights as Button: 32px or 40px. */
  size?: ButtonSize
  /** Glyph beside the label. */
  icon?: IconComponent
  /** Glyph shown instead of `icon` while pressed — an outlined star becoming a filled one. */
  pressedIcon?: IconComponent
  /** Show the glyph alone. The label is kept for assistive technology. */
  iconOnly?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A single button that stays down.
 *
 * It is a Button with `aria-pressed`, not a Switch or a Checkbox: Bold, Mute,
 * Follow and Star are actions that happen to stick, and are announced as a
 * toggle button that is pressed or not. A Switch says "a setting", which is
 * wrong for these.
 *
 * The pressed state changes the fill, not just the glyph. An icon swap alone
 * is a small change to spot at a glance, and in a row of mixed states the fill
 * is what makes the on ones findable.
 */
export function ToggleButton({
  children,
  pressed: controlled,
  defaultPressed = false,
  onPressedChange,
  variant = 'outline',
  pressedVariant = 'accent',
  size = 'md',
  icon,
  pressedIcon,
  iconOnly = false,
  disabled,
  onClick,
  className,
  ...rest
}: ToggleButtonProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultPressed)
  const pressed = controlled ?? uncontrolled
  const Icon = pressed ? (pressedIcon ?? icon) : icon

  return (
    <Button
      {...rest}
      aria-pressed={pressed}
      variant={pressed ? pressedVariant : variant}
      size={size}
      disabled={disabled}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (controlled === undefined) setUncontrolled(!pressed)
        onPressedChange?.(!pressed)
      }}
      className={cn(
        // A pressed outline button swaps to a borderless fill; keep the box the
        // same size so neighbours do not shift by a pixel.
        'border border-transparent',
        !pressed && variant === 'outline' && 'border-line-strong',
        iconOnly && (size === 'sm' ? 'w-8 px-0' : 'w-10 px-0'),
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} aria-hidden="true" />}
      {iconOnly ? <VisuallyHidden>{children}</VisuallyHidden> : children}
    </Button>
  )
}
