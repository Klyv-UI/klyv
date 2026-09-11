'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { Radio } from '../Radio'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { InlineMessage } from '../InlineMessage'

export interface RadioOption<T extends string = string> {
  value: T
  label: string
  hint?: string
  disabled?: boolean
}

export interface RadioGroupProps<T extends string = string> {
  options: RadioOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Visible group label, rendered as a legend. */
  label: string
  /** Guidance under the legend. */
  hint?: string
  /** Validation message. Replaces the hint and marks the group invalid. */
  error?: string
  /** Stack the options, or lay them out in a row. */
  orientation?: 'vertical' | 'horizontal'
  /** Draw each option as a selectable card rather than a bare row. */
  variant?: 'plain' | 'card'
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Single choice from a set, as a real fieldset of radios sharing one name —
 * which is what gives arrow-key navigation and single-selection for free.
 *
 * The `card` variant is for choices that carry a description and need a larger
 * hit target, such as a delivery speed.
 */
export function RadioGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  hint,
  error,
  orientation = 'vertical',
  variant = 'plain',
  disabled = false,
  className,
}: RadioGroupProps<T>) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

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
      <div
        className={cn(
          'flex gap-x-5',
          variant === 'card' ? 'gap-y-2' : 'gap-y-2.5',
          orientation === 'vertical' ? 'flex-col' : 'flex-wrap',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value
          const inner = (
            <>
              <Radio
                className="mt-0.5"
                name={id}
                value={option.value}
                checked={selected}
                disabled={disabled || option.disabled}
                invalid={Boolean(error)}
                onChange={() => onValueChange(option.value)}
              />
              <span className="min-w-0">
                <Text as="span" size="body" weight={variant === 'card' ? 'bold' : 'medium'} className="block">
                  {option.label}
                </Text>
                {option.hint && (
                  <Text as="span" size="caption" tone="faint" className="block">
                    {option.hint}
                  </Text>
                )}
              </span>
            </>
          )

          const rowClass = cn(
            'flex cursor-pointer items-start gap-2.5',
            (disabled || option.disabled) && 'pointer-events-none opacity-40',
          )

          if (variant === 'card') {
            return (
              <Surface
                as="label"
                key={option.value}
                variant="tile"
                padding="sm"
                className={cn(
                  rowClass,
                  'flex-row transition-colors',
                  selected ? 'border-accent-strong bg-accent-soft/40' : 'hover:border-line-strong',
                )}
              >
                {inner}
              </Surface>
            )
          }

          return (
            <label key={option.value} className={rowClass}>
              {inner}
            </label>
          )
        })}
      </div>
      {message && (
        <InlineMessage id={messageId} tone={error ? 'danger' : 'hint'} live={Boolean(error)}>
          {message}
        </InlineMessage>
      )}
    </fieldset>
  )
}
