'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { Checkbox } from '../Checkbox'
import { Text } from '../Text'
import { InlineMessage } from '../InlineMessage'

export interface CheckboxOption<T extends string = string> {
  value: T
  label: string
  hint?: string
  disabled?: boolean
}

export interface CheckboxGroupProps<T extends string = string> {
  options: CheckboxOption<T>[]
  value: T[]
  onValueChange: (value: T[]) => void
  /** Visible group label, rendered as a legend. */
  label: string
  /** Guidance under the legend. */
  hint?: string
  /** Validation message. Replaces the hint. */
  error?: string
  orientation?: 'vertical' | 'horizontal'
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A set of related checkboxes as a real fieldset and legend, so the group name
 * is announced once before the options rather than repeated into each label.
 *
 * The value is an array: the group owns the selection, each Checkbox stays a
 * plain control.
 */
export function CheckboxGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  hint,
  error,
  orientation = 'vertical',
  disabled = false,
  className,
}: CheckboxGroupProps<T>) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  const toggle = (option: T, checked: boolean) => {
    onValueChange(checked ? [...value, option] : value.filter((entry) => entry !== option))
  }

  return (
    <fieldset
      aria-describedby={message ? messageId : undefined}
      aria-invalid={error ? true : undefined}
      className={cn('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}
    >
      <legend className="mb-0.5 p-0">
        <Text as="span" size="label" weight="semibold" tone="soft">
          {label}
        </Text>
      </legend>
      <div className={cn('flex gap-x-5 gap-y-2.5', orientation === 'vertical' ? 'flex-col' : 'flex-wrap')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-2.5',
              (disabled || option.disabled) && 'pointer-events-none opacity-40',
            )}
          >
            <Checkbox
              className="mt-0.5"
              checked={value.includes(option.value)}
              disabled={disabled || option.disabled}
              invalid={Boolean(error)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span className="min-w-0">
              <Text as="span" size="body" weight="medium" className="block">
                {option.label}
              </Text>
              {option.hint && (
                <Text as="span" size="caption" tone="faint" className="block">
                  {option.hint}
                </Text>
              )}
            </span>
          </label>
        ))}
      </div>
      {message && (
        <InlineMessage id={messageId} tone={error ? 'danger' : 'hint'} live={Boolean(error)}>
          {message}
        </InlineMessage>
      )}
    </fieldset>
  )
}
