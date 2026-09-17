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
  const generatedId = useId()
  const child = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null
  const own = child?.props ?? {}

  // The control keeps an id it was given — a test hook, an anchor target — and
  // the label follows it. Field only supplies one when there is none.
  const id = typeof own.id === 'string' && own.id ? own.id : generatedId
  const messageId = `${generatedId}-message`
  const message = error ?? hint

  // Only what Field actually has to say is passed down. Cloning with
  // `disabled: undefined` does not leave the child's own `disabled` alone — it
  // overwrites it, so `<Field><Input disabled /></Field>` rendered an editable
  // input, and a child's own `required` and `aria-describedby` vanished the
  // same way. Field's settings add to the child's; they never take away.
  const control = child
    ? cloneElement(child, {
        id,
        ...(message || own['aria-describedby']
          ? {
              'aria-describedby': [own['aria-describedby'], message ? messageId : null]
                .filter(Boolean)
                .join(' '),
            }
          : null),
        ...(error ? { invalid: true } : null),
        ...(required ? { required: true } : null),
        ...(disabled ? { disabled: true } : null),
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
