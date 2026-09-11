'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Kbd } from '../Kbd'
import { Text } from '../Text'

export interface ShortcutRecorderProps {
  /** The current binding, as parts: e.g. ['Meta', 'Shift', 'K']. */
  value: string[]
  onChange: (parts: string[]) => void
  /** Accessible name — which command this binds. */
  label: string
  /** Bindings already taken, so a clash can be reported rather than saved. */
  taken?: { parts: string[]; label: string }[]
  /** Require at least one modifier. Off for a single-key command palette. */
  requireModifier?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const MODIFIERS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

const DISPLAY: Record<string, string> = {
  Meta: '⌘',
  Control: 'Ctrl',
  Alt: '⌥',
  Shift: '⇧',
  ' ': 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Enter: '↵',
}

const show = (part: string) => DISPLAY[part] ?? (part.length === 1 ? part.toUpperCase() : part)
const same = (a: string[], b: string[]) => a.length === b.length && a.every((p, i) => p === b[i])

/**
 * A field that records the next key combination you press.
 *
 * It listens on `keydown` and stops there — no text input, no parsing of typed
 * strings like "Cmd+Shift+K". The combination people want is the one their
 * fingers already know, and asking them to spell it introduces a whole class of
 * mistakes that pressing it cannot make.
 *
 * Every key event while armed is prevented and stopped, including Tab and the
 * browser's own shortcuts, because the entire point is to capture combinations
 * the page would otherwise act on. Escape is the one exception: it cancels,
 * since a recorder with no way out is a trap.
 *
 * A modifier-only press does not commit — it updates the preview and waits, so
 * holding Cmd on the way to Cmd+K does not save "⌘". Clashes are reported
 * against `taken` rather than silently overwritten, because two commands
 * sharing a binding is a bug the person recording it is best placed to fix.
 */
export function ShortcutRecorder({
  value,
  onChange,
  label,
  taken = [],
  requireModifier = true,
  className,
}: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)

  const clash = taken.find((entry) => same(entry.parts, value))

  useEffect(() => {
    if (!recording) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Everything is swallowed: the combinations worth binding are exactly
      // the ones the browser would otherwise act on.
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecording(false)
        setPreview([])
        return
      }

      const parts: string[] = []
      if (event.metaKey) parts.push('Meta')
      if (event.ctrlKey) parts.push('Control')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')

      if (MODIFIERS.has(event.key)) {
        // Modifiers alone are a preview, never a binding.
        setPreview(parts)
        return
      }

      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
      if (requireModifier && parts.length === 1) {
        setPreview(parts)
        return
      }

      onChange(parts)
      setPreview([])
      setRecording(false)
      buttonRef.current?.focus()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (MODIFIERS.has(event.key)) setPreview([])
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
    }
  }, [onChange, recording, requireModifier])

  const parts = recording && preview.length > 0 ? preview : value

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label}. ${value.length > 0 ? `Currently ${value.map(show).join(' ')}.` : 'Not set.'} Press to record a new shortcut.`}
        onClick={() => {
          setRecording((current) => !current)
          setPreview([])
        }}
        onBlur={() => setRecording(false)}
        className={cn(
          'inline-flex h-10 min-w-[168px] items-center justify-between gap-3 rounded-[var(--radius-field)] border px-3 transition-colors',
          recording
            ? 'border-accent-strong bg-accent-soft'
            : 'border-line bg-surface hover:border-line-strong',
        )}
      >
        <span className="inline-flex items-center gap-1">
          {parts.length > 0 ? (
            parts.map((part, index) => <Kbd key={`${part}-${index}`}>{show(part)}</Kbd>)
          ) : (
            <Text as="span" size="caption" tone="faint">
              Not set
            </Text>
          )}
        </span>
        <Text as="span" size="micro" tone={recording ? 'default' : 'faint'}>
          {recording ? 'Listening…' : 'Change'}
        </Text>
      </button>

      {recording ? (
        <Text size="caption" tone="faint" role="status" aria-live="polite">
          Press a combination. Escape cancels.
        </Text>
      ) : clash ? (
        <Text size="caption" tone="danger">
          Already used by {clash.label}.
        </Text>
      ) : null}
    </div>
  )
}
