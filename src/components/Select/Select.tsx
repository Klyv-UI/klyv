'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { CheckIcon, ChevronDownIcon } from '../internal/icons'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Glyph, flag or swatch shown before the label. */
  leading?: ReactNode
  hint?: string
  disabled?: boolean
}

export type SelectSize = 'sm' | 'md'

const TRIGGER_SIZES: Record<SelectSize, string> = {
  sm: 'h-9 pl-2.5 pr-2 text-[12px]',
  md: 'h-10 pl-3 pr-2.5 text-[13px]',
}

export interface SelectProps<T extends string = string> {
  options: SelectOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name. Pair with a Field for a visible one. */
  label: string
  /** Control height: 36px or 40px. */
  size?: SelectSize
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Lifted pill, as the currency pickers use, instead of a bordered field. */
  variant?: 'field' | 'pill'
  /** Marks the field as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Stretch to the container width. */
  fullWidth?: boolean
  /** Overrides the generated id. Useful when a label lives elsewhere. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Single choice from a list, with listbox semantics: the trigger reports the
 * expanded state, the panel is a listbox, and arrow keys, Home, End, Enter and
 * Escape all behave as a native select would.
 *
 * A native select is still the better answer on touch. This exists because the
 * design needs a flag and a label in the trigger, which a native select cannot
 * render.
 */
export function Select<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  size = 'md',
  placement = 'bottom',
  align = 'end',
  variant = 'field',
  invalid = false,
  disabled = false,
  fullWidth = false,
  id,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const current = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      const first = listRef.current?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])')
      ;(current ?? first)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) ?? []),
    ]
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      nodes[(index + step + nodes.length) % nodes.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      nodes[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      nodes[nodes.length - 1]?.focus()
    }
  }

  const listId = useId()

  return (
    <Popover
      open={open}
      onOpenChange={(next) => !disabled && setOpen(next)}
      placement={placement}
      align={align}
      label={label}
      className={cn('max-h-[280px] min-w-[180px] overflow-y-auto p-1', className)}
      trigger={
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={label}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 font-bold leading-none text-ink transition-colors',
            'disabled:pointer-events-none disabled:opacity-40',
            TRIGGER_SIZES[size],
            variant === 'pill'
              ? // `shell`, not `white`: literal white stays white in dark mode, under light text.
              'rounded-full bg-shell shadow-[var(--shadow-tile)] hover:bg-surface-muted'
              : 'rounded-full border bg-surface hover:border-line-strong',
            variant === 'field' && (invalid ? 'border-danger' : 'border-line'),
            fullWidth && 'w-full',
          )}
        >
          {selected?.leading}
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
          <ChevronDownIcon size={16} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex flex-col"
      >
        {options.map((option) => {
          const isSelected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              onClick={() => {
                onValueChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-10)] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                'disabled:pointer-events-none disabled:opacity-40',
                isSelected ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              )}
            >
              {option.leading}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.hint && (
                  <Text as="span" size="caption" tone="faint" className="block truncate">
                    {option.hint}
                  </Text>
                )}
              </span>
              {isSelected && <CheckIcon size={14} className="shrink-0 text-ink" />}
            </button>
          )
        })}
      </div>
    </Popover>
  )
}
