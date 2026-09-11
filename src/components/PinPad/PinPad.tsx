'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface PinPadProps {
  /** How many digits. */
  length?: number
  /** Called once the last digit lands. Return false to reject and shake. */
  onComplete: (code: string) => boolean | void | Promise<boolean | void>
  /** Accessible name — what the code is for. */
  label: string
  /** Shown under the dots. */
  hint?: string
  /** Message shown after a rejection. */
  errorMessage?: string
  /** Extra key in the bottom-left — biometrics, "forgot", anything. */
  extra?: { label: string; onSelect: () => void; glyph?: string }
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * A numeric keypad with a masked display, for entering a short code.
 *
 * The pad and the physical keyboard are the same control, not two paths: digits
 * typed anywhere while it is focused land in the same buffer, Backspace deletes
 * and Escape clears. Building the pad without that leaves anyone on a laptop
 * poking at buttons with a mouse.
 *
 * `onComplete` may return `false`, or a promise of it, to reject the code. That
 * inverts the usual arrangement, where the parent has to reach back in to clear
 * the field: here rejection is the return value, the pad shakes, clears itself
 * and restores focus without the caller holding a ref.
 *
 * The shake is decoration and the message is not. Rejection is announced
 * through a live region as well, because an animation is invisible to a screen
 * reader and "wrong code" is not optional information.
 */
export function PinPad({
  length = 4,
  onComplete,
  label,
  hint,
  errorMessage = 'That code was not right. Try again.',
  extra,
  disabled = false,
  className,
}: PinPadProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const submitted = useRef(false)

  const push = (digit: string) => {
    if (disabled || busy || code.length >= length) return
    setError(false)
    setCode((current) => current + digit)
  }

  const back = () => {
    setError(false)
    setCode((current) => current.slice(0, -1))
  }

  useEffect(() => {
    if (code.length !== length || submitted.current) return
    submitted.current = true

    const finish = (accepted: boolean | void) => {
      submitted.current = false
      setBusy(false)
      if (accepted === false) {
        setError(true)
        setCode('')
        rootRef.current?.focus()
      }
    }

    const result = onComplete(code)
    if (result instanceof Promise) {
      setBusy(true)
      void result.then(finish)
    } else {
      finish(result)
    }
  }, [code, length, onComplete])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()
      push(event.key)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      back()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setCode('')
      setError(false)
    }
  }

  const key = (content: string, onSelect: () => void, keyLabel: string, muted = false) => (
    <button
      key={keyLabel}
      type="button"
      tabIndex={-1}
      aria-label={keyLabel}
      disabled={disabled || busy}
      onClick={onSelect}
      className={cn(
        'h-14 rounded-[var(--radius-tile)] text-[18px] font-bold transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        muted
          ? 'text-ink-soft hover:bg-surface-muted'
          : 'bg-surface-muted text-ink hover:bg-line active:bg-line-strong',
      )}
    >
      {content}
    </button>
  )

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn('inline-flex w-[260px] flex-col items-center gap-4 outline-offset-4', className)}
    >
      <div
        className={cn('motion-safe-only flex items-center gap-3', error && 'text-danger')}
        style={
          error ? ({ animation: 'input-shake 480ms ease-in-out' } as CSSProperties) : undefined
        }
      >
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              'h-3 w-3 rounded-full transition-colors duration-[var(--duration-fast)]',
              error
                ? 'bg-danger'
                : index < code.length
                  ? 'bg-ink'
                  : 'border border-line-strong bg-transparent',
            )}
          />
        ))}
      </div>

      {(hint || error) && (
        <Text size="caption" tone={error ? 'danger' : 'faint'} className="text-center">
          {error ? errorMessage : hint}
        </Text>
      )}

      <div className="grid w-full grid-cols-3 gap-2">
        {KEYS.map((digit) => key(digit, () => push(digit), digit))}
        {extra
          ? key(extra.glyph ?? '·', extra.onSelect, extra.label, true)
          : <span key="spacer" />}
        {key('0', () => push('0'), '0')}
        {key('⌫', back, 'Delete', true)}
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {error ? errorMessage : `${code.length} of ${length} digits entered`}
        </p>
      </VisuallyHidden>
    </div>
  )
}
