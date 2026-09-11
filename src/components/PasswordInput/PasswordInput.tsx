'use client'

import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { IconButton } from '../IconButton'
import { Input, type InputSize } from '../Input'
import { EyeIcon, EyeOffIcon } from '../internal/icons'

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  /** Control height, matching Input. */
  inputSize?: InputSize
  invalid?: boolean
  /** Hide the reveal control, for contexts where shoulder-surfing matters. */
  revealable?: boolean
  /** Classes for the wrapper rather than the control itself. */
  containerClassName?: string
}

/**
 * Input with a reveal toggle. The toggle is a real button with a changing
 * accessible name, so its state is announced rather than inferred from a glyph.
 *
 * Reveal is deliberately not sticky: it resets whenever the component remounts.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { inputSize = 'md', invalid, revealable = true, containerClassName, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false)

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        inputSize={inputSize}
        invalid={invalid}
        containerClassName={containerClassName}
        autoComplete="current-password"
        trailing={
          revealable ? (
            <IconButton
              icon={visible ? EyeOffIcon : EyeIcon}
              label={visible ? 'Hide password' : 'Show password'}
              size="xs"
              aria-pressed={visible}
              onClick={() => setVisible((previous) => !previous)}
            />
          ) : undefined
        }
        {...props}
      />
    )
  },
)
