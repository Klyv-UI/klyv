'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Text } from '../Text'
import { Popover } from '../Popover'
import { opensPicker } from '../Popover/opensPicker'
import { Calendar } from '../Calendar'

export interface DateRange {
  start?: string
  end?: string
}

function formatDisplay(range: DateRange): string {
  const format = (iso?: string) => {
    if (!iso) return ''
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }
  if (!range.start) return ''
  if (!range.end) return `${format(range.start)} to ...`
  return `${format(range.start)} to ${format(range.end)}`
}

export interface DateRangePickerProps {
  value: DateRange
  onValueChange: (value: DateRange) => void
  /** Accessible name. */
  label: string
  /** Shown while the field is empty. */
  placeholder?: string
  min?: string
  max?: string
  /** Named ranges shown beside the grid. */
  presets?: { label: string; range: DateRange }[]
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Overrides the generated id. Useful when a label lives elsewhere. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Two linked endpoints on one Calendar. Clicking sets the start, clicking again
 * sets the end, and a click before the current start restarts the range — which
 * is what people expect and avoids a modal "choose start / choose end" step.
 *
 * Presets exist because most range choices are a named period, not two dates.
 */
export function DateRangePicker({
  value,
  onValueChange,
  label,
  placeholder = 'Choose a range',
  min,
  max,
  presets,
  disabled = false,
  id,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const pick = (iso: string) => {
    if (!value.start || value.end || iso < value.start) {
      onValueChange({ start: iso, end: undefined })
      return
    }
    onValueChange({ start: value.start, end: iso })
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => !disabled && setOpen(next)}
      placement="bottom"
      align="start"
      label={label}
      className="p-3"
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
          disabled={disabled}
          onKeyDown={(event) => {
            if (!disabled && opensPicker(event)) setOpen(true)
          }}
          containerClassName={className}
          className="cursor-pointer"
        />
      }
    >
      <div className={cn('flex gap-3', presets && 'flex-col sm:flex-row')}>
        {presets && (
          <div className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-[140px] sm:flex-col">
            <Text size="caption" weight="bold" tone="faint" className="hidden px-1 uppercase tracking-wider sm:block">
              Presets
            </Text>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onValueChange(preset.range)
                  setOpen(false)
                }}
                className="rounded-[10px] px-2.5 py-1.5 text-left text-[12px] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Calendar
            rangeStart={value.start}
            rangeEnd={value.end}
            min={min}
            max={max}
            label={label}
            onValueChange={pick}
          />
          {value.start && !value.end && (
            <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
              <Text size="caption" tone="faint">
                Now choose the end date
              </Text>
              <Button size="sm" variant="ghost" onClick={() => onValueChange({})}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>
    </Popover>
  )
}
