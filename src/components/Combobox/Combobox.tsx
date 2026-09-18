'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Input } from '../Input'
import { Text } from '../Text'
import { Portal } from '../Portal'
import { usePopoverPosition } from '../Popover/usePopoverPosition'
import { CheckIcon } from '../internal/icons'
import type { SelectOption } from '../Select'

export interface ComboboxProps<T extends string = string> {
  options: SelectOption<T>[]
  value: T | null
  onValueChange: (value: T | null) => void
  /** Accessible name. */
  label: string
  /** Shown while the field is empty. */
  placeholder?: string
  /** Shown when the query matches nothing. */
  emptyMessage?: string
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
 * A Select the user can type into. Filtering is a plain case-insensitive
 * substring match, which is predictable and needs no configuration; anything
 * cleverer belongs to the application supplying the options.
 *
 * It follows the editable-combobox pattern: the input keeps focus while the
 * list is open and the active option is tracked with aria-activedescendant.
 */
export function Combobox<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  placeholder = 'Search',
  emptyMessage = 'No matches',
  invalid = false,
  disabled = false,
  id,
  className,
}: ComboboxProps<T>) {
  const selected = options.find((option) => option.value === value) ?? null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase()
    if (!normalised) return options
    return options.filter((option) => option.label.toLowerCase().includes(normalised))
  }, [options, query])

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    listRef as React.RefObject<HTMLElement>,
    open,
    'bottom',
    'start',
    6,
  )

  useEffect(() => setActive(0), [query, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const choose = (option: SelectOption<T>) => {
    if (option.disabled) return
    onValueChange(option.value)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((previous) => (previous + step + filtered.length) % Math.max(1, filtered.length))
    } else if (event.key === 'Enter' && open && filtered[active]) {
      event.preventDefault()
      choose(filtered[active])
    } else if (event.key === 'Escape') {
      // With the list open, closing it is this press's whole job. Marking it
      // handled stops the overlay stack also closing the dialog around the
      // combobox. With the list closed, Escape carries on to that dialog.
      if (open) event.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  // The list sits on the overlay stack so it is above any dialog it opens in,
  // however deep. Escape is handled above, on the input.
  const { zIndex } = useOverlayLayer({ open, onDismiss: () => setOpen(false), kind: 'popover' })

  // From useId, not the label. An id built from "Ship to country" has spaces
  // in it, and aria-controls and aria-activedescendant are space-separated
  // lists — screen readers looked for three elements that did not exist.
  const generatedId = useId()
  const listId = `${id ?? generatedId}-listbox`

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].value}` : undefined}
        aria-label={label}
        invalid={invalid}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={selected && !query ? 'placeholder:font-bold placeholder:text-ink' : undefined}
      />
      {open && (
        <Portal>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: anchorRef.current?.offsetWidth,
              zIndex,
            }}
            className="max-h-[260px] overflow-y-auto rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
          >
            {filtered.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${option.value}`}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-[var(--radius-10)] px-2.5 py-2 text-[13px] font-semibold transition-colors',
                  index === active ? 'bg-surface-muted text-ink' : 'text-ink-soft',
                  option.disabled && 'pointer-events-none opacity-40',
                )}
              >
                {option.leading}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value && <CheckIcon size={14} className="shrink-0" />}
              </div>
            ))}
            {filtered.length === 0 && (
              <Text size="caption" tone="faint" className="px-2.5 py-3">
                {emptyMessage}
              </Text>
            )}
          </div>
        </Portal>
      )}
    </div>
  )
}
