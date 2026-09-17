'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export interface InputOTPProps {
  /** Current code. Shorter than `length` while being entered. */
  value: string
  onValueChange: (value: string) => void
  /** Number of characters. */
  length?: number
  /** Accessible name for the group. */
  label?: string
  /** Marks the field as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Fired once the last character is entered. */
  onComplete?: (value: string) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A one-time code split across single-character boxes.
 *
 * The boxes are one logical field: pasting a whole code fills them all, typing
 * advances, Backspace on an empty box steps back, and arrow keys move between
 * them. Without that, a split code field is markedly worse than a plain input.
 */
export function InputOTP({
  value,
  onValueChange,
  length = 6,
  label = 'One-time code',
  invalid = false,
  disabled = false,
  onComplete,
  className,
}: InputOTPProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const characters = value.split('').slice(0, length)

  const commit = (next: string) => {
    const trimmed = next.slice(0, length)
    onValueChange(trimmed)
    if (trimmed.length === length) onComplete?.(trimmed)
  }

  const setAt = (index: number, character: string) => {
    const next = value.padEnd(index, ' ').split('')
    next[index] = character
    commit(next.join('').replace(/\s+$/, ''))
    if (character) refs.current[Math.min(index + 1, length - 1)]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !characters[index]) {
      event.preventDefault()
      refs.current[Math.max(0, index - 1)]?.focus()
      commit(value.slice(0, Math.max(0, index - 1)))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      refs.current[Math.max(0, index - 1)]?.focus()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      refs.current[Math.min(length - 1, index + 1)]?.focus()
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\s/g, '').slice(0, length)
    commit(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center gap-2', disabled && 'opacity-40', className)}
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          value={characters[index] ?? ''}
          onChange={(event) => setAt(index, event.target.value.slice(-1))}
          onKeyDown={(event) => onKeyDown(event, index)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
          className={cn(
            'tabular size-11 rounded-[var(--radius-glyph)] border bg-surface text-center',
            'text-[16px] font-extrabold text-ink transition-colors',
            'focus:border-line-strong disabled:cursor-not-allowed',
            invalid ? 'border-danger' : 'border-line',
          )}
        />
      ))}
    </div>
  )
}
