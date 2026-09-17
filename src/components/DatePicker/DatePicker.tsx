'use client'

import { useState } from 'react'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Popover } from '../Popover'
import { opensPicker } from '../Popover/opensPicker'
import { Calendar } from '../Calendar'

function formatDisplay(iso?: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export interface DatePickerProps {
  /** Selected date as an ISO yyyy-mm-dd string. */
  value?: string
  onValueChange: (value: string) => void
  /** Accessible name. Pair with a Field for a visible label. */
  label: string
  /** Shown while the field is empty. */
  placeholder?: string
  min?: string
  max?: string
  /** Marks the field as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Overrides the generated id. Useful when a label lives elsewhere. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Calendar in a Popover, behind a read-only field.
 *
 * The field is read-only rather than free-text on purpose: parsing typed dates
 * across formats is a source of silent errors, and the grid is faster anyway.
 * The chosen date is shown in a long, unambiguous format.
 */
export function DatePicker({
  value,
  onValueChange,
  label,
  placeholder = 'Choose a date',
  min,
  max,
  invalid = false,
  disabled = false,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => !disabled && setOpen(next)}
      placement="bottom"
      align="start"
      label={label}
      className="p-3"
      // The day that carries the tab stop: the chosen date, or today.
      initialFocus='[role="grid"] button[tabindex="0"]'
      trigger={
        <Input
          id={id}
          readOnly
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
          value={formatDisplay(value)}
          placeholder={placeholder}
          invalid={invalid}
          disabled={disabled}
          onKeyDown={(event) => {
            if (!disabled && opensPicker(event)) setOpen(true)
          }}
          containerClassName={className}
          className="cursor-pointer"
        />
      }
    >
      <Surface variant="floating" className="border-0 shadow-none">
        <Calendar
          value={value}
          min={min}
          max={max}
          label={label}
          onValueChange={(next) => {
            onValueChange(next)
            setOpen(false)
          }}
        />
      </Surface>
    </Popover>
  )
}
