'use client'

import { useId, useState, type ChangeEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Radio } from '../Radio'
import { Checkbox } from '../Checkbox'

export interface ChoiceCardGroupOption {
  value: string
  /** The choice itself, in a few words. Becomes the input's accessible name. */
  title: string
  /** What choosing it means. Read out as the input's description. */
  description?: ReactNode
  /** Decorative glyph or illustration at the start of the card. */
  icon?: ReactNode
  /** Price or other figure, set at the end of the title row. */
  price?: ReactNode
  disabled?: boolean
}

export type ChoiceCardGroupColumns = 1 | 2 | 3

interface ChoiceCardGroupBaseProps {
  options: ChoiceCardGroupOption[]
  /** Group name, rendered as the fieldset legend. */
  label: string
  /** Keep the legend for assistive tech but hide it visually. */
  hideLabel?: boolean
  /** Cards per row from the `sm` breakpoint up. One column below it. */
  columns?: ChoiceCardGroupColumns
  /** Form field name. Generated when omitted, so the radios still group. */
  name?: string
  /** Blocks every card. */
  disabled?: boolean
  /** Marks the group invalid. Pair with a message. */
  invalid?: boolean
  /** Merged last, so it wins. */
  className?: string
}

export interface ChoiceCardGroupSingleProps extends ChoiceCardGroupBaseProps {
  /** Radios: exactly one card can be chosen. */
  multiple?: false
  /** Controlled chosen value. */
  value?: string
  /** Starting value when uncontrolled. */
  defaultValue?: string
  /** Called with the newly chosen value. */
  onValueChange?: (value: string) => void
}

export interface ChoiceCardGroupMultipleProps extends ChoiceCardGroupBaseProps {
  /** Checkboxes: any number of cards can be chosen. */
  multiple: true
  /** Controlled chosen values. */
  value?: string[]
  /** Starting values when uncontrolled. */
  defaultValue?: string[]
  /** Called with every chosen value, in option order. */
  onValueChange?: (value: string[]) => void
}

export type ChoiceCardGroupProps = ChoiceCardGroupSingleProps | ChoiceCardGroupMultipleProps

const COLUMNS: Record<ChoiceCardGroupColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
}

/**
 * Radio buttons or checkboxes drawn as cards — for choices that need a sentence
 * of explanation or a price before anyone can make them: a plan, a shipping
 * speed, a workspace role.
 *
 * Underneath every card is a real input inside a real fieldset. The browser
 * supplies the radio group's arrow keys, form submission and autofill, and the
 * title and description are wired as name and description, so a screen reader
 * hears "Pro, radio button, 2 of 3, unlimited projects" rather than one run-on
 * label. The whole card is the hit area.
 */
export function ChoiceCardGroup(props: ChoiceCardGroupProps) {
  const { options, label, hideLabel = false, columns = 2, name, disabled = false, invalid = false, className } = props
  const generated = useId()
  const groupName = name ?? generated
  const [uncontrolled, setUncontrolled] = useState<string[]>(() => {
    const initial = props.defaultValue
    return initial === undefined ? [] : Array.isArray(initial) ? initial : [initial]
  })
  const chosen = props.value === undefined ? uncontrolled : Array.isArray(props.value) ? props.value : [props.value]

  const toggle = (value: string, checked: boolean) => {
    if (props.multiple) {
      const set = new Set(chosen)
      if (checked) set.add(value)
      else set.delete(value)
      const next = options.map((option) => option.value).filter((v) => set.has(v))
      if (props.value === undefined) setUncontrolled(next)
      props.onValueChange?.(next)
    } else if (checked) {
      if (props.value === undefined) setUncontrolled([value])
      props.onValueChange?.(value)
    }
  }

  return (
    <fieldset disabled={disabled} className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className={cn('mb-2 text-[13px] font-semibold text-ink-soft', hideLabel && 'sr-only')}>{label}</legend>
      <div className={cn('grid gap-3', COLUMNS[columns])}>
        {options.map((option, index) => {
          const inputId = `${generated}-${index}`
          const checked = chosen.includes(option.value)
          const input = {
            id: inputId,
            name: groupName,
            value: option.value,
            checked,
            disabled: option.disabled,
            invalid,
            'aria-labelledby': `${inputId}-title`,
            'aria-describedby': option.description ? `${inputId}-description` : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement>) => toggle(option.value, event.target.checked),
            className: 'focus-visible:outline-none',
          }
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                'relative flex cursor-pointer gap-3 rounded-[var(--radius-tile)] border bg-surface p-4 transition-colors',
                'hover:border-line-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                checked
                  ? 'border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-surface))] hover:border-accent-strong'
                  : invalid
                    ? 'border-danger'
                    : 'border-line',
                (option.disabled || disabled) && 'cursor-not-allowed opacity-50 hover:border-line',
              )}
            >
              {option.icon && (
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-glyph)] bg-surface-muted text-ink">
                  {option.icon}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span id={`${inputId}-title`} className="text-[14px] font-bold tracking-[-0.01em] text-ink">
                    {option.title}
                  </span>
                  {option.price && <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">{option.price}</span>}
                </span>
                {option.description && (
                  <span id={`${inputId}-description`} className="text-[12px] font-medium leading-normal text-ink-soft">
                    {option.description}
                  </span>
                )}
              </span>
              {props.multiple ? <Checkbox boxSize="sm" {...input} /> : <Radio dotSize="sm" {...input} />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
