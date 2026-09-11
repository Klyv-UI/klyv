'use client'

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Label } from '../Label'
import { InlineMessage } from '../InlineMessage'

export interface FieldProps {
  /** Visible label. */
  label: string
  /** Exactly one form control. */
  children: ReactNode
  /** Guidance shown under the control while it is valid. */
  hint?: string
  /** Error message. Replaces the hint and marks the control invalid. */
  error?: string
  /** Marks the label and forwards the requirement to the control. */
  required?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Hide the label visually, keeping it for assistive tech. */
  hideLabel?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Label, control, hint and error, wired together in one place.
 *
 * Field generates the id and clones its single child to attach `id`,
 * `aria-describedby`, `aria-invalid`, `required` and `disabled`. Doing it here
 * is what stops every form in the app associating these by hand, which is where
 * accessible forms usually go wrong.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  disabled = false,
  hideLabel = false,
  className,
}: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': message ? messageId : undefined,
        invalid: error ? true : undefined,
        required: required || undefined,
        disabled: disabled || undefined,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required} disabled={disabled} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      {control}
      {message && (
        <InlineMessage id={messageId} tone={error ? 'danger' : 'hint'} live={Boolean(error)}>
          {message}
        </InlineMessage>
      )}
    </div>
  )
}
