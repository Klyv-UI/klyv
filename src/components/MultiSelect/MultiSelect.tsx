'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Checkbox } from '../Checkbox'
import { Chip } from '../Chip'
import { Text } from '../Text'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { ChevronDownIcon } from '../internal/icons'
import type { SelectOption } from '../Select'

export interface MultiSelectProps<T extends string = string> {
  options: SelectOption<T>[]
  value: T[]
  onValueChange: (value: T[]) => void
  /** Accessible name. */
  label: string
  /** Trigger text when nothing is chosen. */
  placeholder?: string
  /** Show the chosen values as removable Chips under the trigger. */
  showChips?: boolean
  /** Which side of the trigger it opens on. Flips when it would leave the viewport. */
  placement?: PopoverPlacement
  /** How it lines up with the trigger along that side. */
  align?: PopoverAlign
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
 * Choose several values from a list. The panel stays open while selecting,
 * since closing after each pick makes choosing four things cost four openings.
 *
 * Options are checkboxes rather than multi-select listbox options: the checkbox
 * state is what makes it obvious that more than one can be chosen.
 */
export function MultiSelect<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  placeholder = 'Select',
  showChips = true,
  placement = 'bottom',
  align = 'start',
  invalid = false,
  disabled = false,
  id,
  className,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const chosen = options.filter((option) => value.includes(option.value))

  const toggle = (option: T, checked: boolean) => {
    onValueChange(checked ? [...value, option] : value.filter((entry) => entry !== option))
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Popover
        open={open}
        onOpenChange={(next) => !disabled && setOpen(next)}
        placement={placement}
        align={align}
        className="max-h-[280px] min-w-[220px] overflow-y-auto p-1"
        trigger={
          <button
            type="button"
            id={id}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={label}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              'inline-flex h-10 w-full items-center gap-2 rounded-full border bg-surface pl-3.5 pr-2.5',
              'text-[13px] font-bold leading-none text-ink transition-colors hover:border-line-strong',
              'disabled:pointer-events-none disabled:opacity-40',
              invalid ? 'border-danger' : 'border-line',
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {chosen.length === 0 ? (
                <Text as="span" size="body" weight="medium" tone="faint">
                  {placeholder}
                </Text>
              ) : (
                `${chosen.length} selected`
              )}
            </span>
            <ChevronDownIcon size={16} className="shrink-0 text-ink-faint" />
          </button>
        }
      >
        <div role="listbox" aria-multiselectable aria-label={label} className="flex flex-col">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-10)] px-2.5 py-2 transition-colors',
                'hover:bg-surface-muted',
                option.disabled && 'pointer-events-none opacity-40',
              )}
            >
              <Checkbox
                boxSize="sm"
                checked={value.includes(option.value)}
                disabled={option.disabled}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              {option.leading}
              <Text as="span" size="body" weight="semibold" tone="soft" truncate>
                {option.label}
              </Text>
            </label>
          ))}
        </div>
      </Popover>

      {showChips && chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              size="sm"
              selected
              onRemove={() => toggle(option.value, false)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
