'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Text } from '../Text'
import { Popover } from '../Popover'

export interface TimePickerProps {
  /** Time as a 24-hour HH:mm string. */
  value?: string
  onValueChange: (value: string) => void
  /** Accessible name. */
  label: string
  /** Minutes between options. */
  step?: 15 | 30 | 60
  /** Earliest and latest selectable times, as HH:mm. */
  min?: string
  max?: string
  /** Shown while the field is empty. */
  placeholder?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Overrides the generated id. Useful when a label lives elsewhere. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

function buildTimes(step: number): string[] {
  const times: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
    const minute = String(minutes % 60).padStart(2, '0')
    times.push(`${hour}:${minute}`)
  }
  return times
}

/**
 * Time selection from a fixed list rather than free text or a spinner.
 *
 * A list is faster than typing for the common case of scheduling on the
 * quarter-hour, and it removes the whole class of parsing errors that comes
 * with accepting "half two". Values stay 24-hour internally regardless of how
 * they are displayed.
 */
export function TimePicker({
  value,
  onValueChange,
  label,
  step = 30,
  min,
  max,
  placeholder = 'Choose a time',
  disabled = false,
  id,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const times = buildTimes(step).filter((time) => (!min || time >= min) && (!max || time <= max))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => !disabled && setOpen(next)}
      placement="bottom"
      align="start"
      label={label}
      className="max-h-[260px] w-[140px] overflow-y-auto p-1"
      trigger={
        <Input
          id={id}
          readOnly
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          value={value ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          containerClassName={className}
          className="cursor-pointer tabular"
        />
      }
    >
      <div role="listbox" aria-label={label} className="flex flex-col">
        {times.map((time) => (
          <button
            key={time}
            type="button"
            role="option"
            aria-selected={time === value}
            onClick={() => {
              onValueChange(time)
              setOpen(false)
            }}
            className={cn(
              'tabular rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
              time === value ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            )}
          >
            {time}
          </button>
        ))}
        {times.length === 0 && (
          <Text size="caption" tone="faint" className="px-2.5 py-3">
            No times available
          </Text>
        )}
      </div>
    </Popover>
  )
}
