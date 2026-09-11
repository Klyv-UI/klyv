'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { CheckIcon, CrossIcon, PencilIcon } from '../internal/icons'
import { Text } from '../Text'

export interface InlineEditProps {
  /** The saved value. */
  value: string
  /** Called with the new value when it is saved and differs from the old. */
  onSave: (value: string) => void
  /** Accessible name — what is being edited. */
  label: string
  /** Shown while the value is empty. */
  placeholder?: string
  /** Return a reason to reject a value; the field stays open until it passes. */
  validate?: (value: string) => string | undefined
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A value that reads as text until someone chooses to change it.
 *
 * Reading mode is a real button that names what it edits, so it is reachable by
 * keyboard and announced as editable. Editing is a labelled input: Enter saves,
 * Escape restores the original, and focus returns to the button either way, so
 * nobody is dropped at the top of the page. A value that fails validation keeps
 * the field open and says why, tied to the input with aria-describedby.
 */
export function InlineEdit({ value, onSave, label, placeholder, validate, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string>()
  const reading = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const errorId = useId()

  // Hand focus back to the text once the field closes, so the place is kept.
  useEffect(() => {
    if (editing || !returnFocus.current) return
    returnFocus.current = false
    reading.current?.focus()
  }, [editing])

  const open = () => {
    setDraft(value)
    setError(undefined)
    setEditing(true)
  }

  const close = () => {
    returnFocus.current = true
    setEditing(false)
    setError(undefined)
  }

  const save = () => {
    const next = draft.trim()
    const problem = validate?.(next)
    if (problem) {
      setError(problem)
      return
    }
    if (next !== value) onSave(next)
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  if (!editing) {
    return (
      <button
        ref={reading}
        type="button"
        onClick={open}
        aria-label={`${label}: ${value || 'empty'}. Edit`}
        className={cn(
          'group -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-glyph)] px-1.5 py-1 text-left transition-colors hover:bg-surface-muted',
          className,
        )}
      >
        <Text as="span" size="body" weight="semibold" tone={value ? 'default' : 'faint'} truncate>
          {value || placeholder || 'Empty'}
        </Text>
        <PencilIcon
          size={13}
          className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5">
        <Input
          // Entering edit mode is the user's own request for this field.
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          invalid={Boolean(error)}
          inputSize="sm"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(undefined)
          }}
          onKeyDown={onKeyDown}
          containerClassName="min-w-0 flex-1"
        />
        <IconButton icon={CheckIcon} label="Save" size="sm" tone="accent" onClick={save} />
        <IconButton icon={CrossIcon} label="Cancel" size="sm" tone="muted" onClick={close} />
      </div>
      {error && (
        <Text as="span" id={errorId} size="micro" weight="semibold" tone="danger">
          {error}
        </Text>
      )}
    </div>
  )
}
