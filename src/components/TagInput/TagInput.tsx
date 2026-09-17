'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Chip } from '../Chip'
import { VisuallyHidden } from '../VisuallyHidden'

export interface TagInputProps {
  /** Current tags, in order. */
  value: string[]
  onValueChange: (value: string[]) => void
  /** Accessible name for the control. */
  label: string
  /** Shown when no tags have been added. */
  placeholder?: string
  /** Cap the number of tags. The field disables once reached. */
  max?: number
  /** Reject a value before it is added. Return false to refuse it. */
  validate?: (value: string) => boolean
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
 * A field that turns entries into removable Chips. Enter and comma commit the
 * current text; Backspace on an empty field removes the last tag.
 *
 * Additions and removals are announced through a live region, because the
 * visible change happens outside the input the user is typing into.
 */
export function TagInput({
  value,
  onValueChange,
  label,
  placeholder = 'Add and press Enter',
  max,
  validate,
  invalid = false,
  disabled = false,
  id,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const full = max !== undefined && value.length >= max

  const add = (raw: string) => {
    const entry = raw.trim().replace(/,$/, '')
    if (!entry || full) return
    if (value.includes(entry) || (validate && !validate(entry))) {
      setAnnouncement(`${entry} was not added`)
      return
    }
    onValueChange([...value, entry])
    setAnnouncement(`${entry} added`)
    setDraft('')
  }

  const remove = (entry: string) => {
    onValueChange(value.filter((item) => item !== entry))
    setAnnouncement(`${entry} removed`)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] border bg-surface px-2 py-1.5',
        'transition-colors focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        invalid ? 'border-danger' : 'border-line',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      {value.map((entry) => (
        <Chip key={entry} label={entry} size="sm" selected onRemove={() => remove(entry)} />
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        disabled={disabled || full}
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={full ? `Limit of ${max} reached` : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        className="min-w-[10ch] flex-1 bg-transparent px-1.5 text-[13px] font-medium text-ink outline-none placeholder:text-ink-faint"
      />
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {announcement}
        </span>
      </VisuallyHidden>
    </div>
  )
}
