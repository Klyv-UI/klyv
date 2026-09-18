'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Kbd } from '../Kbd'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface UndoEntry {
  id: string
  /** What the step did, in the reader's language. */
  label: string
}

export interface UndoStackProps {
  /** Steps already applied, oldest first. The last one is what undo reverses. */
  past: UndoEntry[]
  /** Steps undone, most recently undone first. */
  future: UndoEntry[]
  /** Reverse `steps` entries from the end of `past`. */
  onUndo: (steps: number) => void
  /** Reapply `steps` entries from the front of `future`. */
  onRedo: (steps: number) => void
  /** Accessible name. */
  label: string
  /** Bind the platform undo and redo shortcuts while this is mounted. */
  shortcuts?: boolean
  /** Entries offered in the history list. */
  historyLimit?: number
  /** Merged last, so it wins. */
  className?: string
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Undo and redo, with the history behind them visible.
 *
 * Every step is named. An undo button that says "Undo" and nothing else asks
 * the reader to remember what they last did, and the answer after a few minutes
 * of work is that they do not — so they press it, watch something change, and
 * press redo. Naming the step turns a gamble into a decision.
 *
 * The history list is the second half of that: jumping back four steps in one
 * move is a different action from pressing undo four times, and only the first
 * one can be reasoned about before committing to it.
 *
 * Shortcuts are opt-in and ignored while a field is focused, because the
 * browser's own undo inside a text input is what someone typing expects. A
 * component that steals Cmd+Z from a textarea has broken something older and
 * more familiar than itself.
 */
export function UndoStack({
  past,
  future,
  onUndo,
  onRedo,
  label,
  shortcuts = true,
  historyLimit = 8,
  className,
}: UndoStackProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const nextUndo = past[past.length - 1]
  const nextRedo = future[0]

  useEffect(() => {
    if (!shortcuts) return
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = isMac() ? event.metaKey : event.ctrlKey
      if (!modifier || event.key.toLowerCase() !== 'z') return

      // The browser's own undo inside a field is older and more expected.
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      event.preventDefault()
      if (event.shiftKey) {
        if (future.length > 0) onRedo(1)
      } else if (past.length > 0) {
        onUndo(1)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [future.length, onRedo, onUndo, past.length, shortcuts])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const history = [...past].reverse().slice(0, historyLimit)

  return (
    <div ref={rootRef} role="group" aria-label={label} className={cn('relative inline-flex items-center gap-1', className)}>
      <button
        type="button"
        disabled={past.length === 0}
        onClick={() => onUndo(1)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-bold transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40"
      >
        Undo
        {/* The step, not just the verb. */}
        {nextUndo && (
          <Text as="span" size="micro" tone="faint" truncate className="max-w-[130px]">
            {nextUndo.label}
          </Text>
        )}
      </button>

      <button
        type="button"
        disabled={future.length === 0}
        onClick={() => onRedo(1)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-bold transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40"
      >
        Redo
        {nextRedo && (
          <Text as="span" size="micro" tone="faint" truncate className="max-w-[130px]">
            {nextRedo.label}
          </Text>
        )}
      </button>

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={past.length === 0}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-2.5 text-[12px] font-bold transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40"
      >
        History
      </button>

      {open && (
        <Surface
          variant="floating"
          role="menu"
          aria-label="Step back to"
          className="absolute left-0 top-full z-[var(--z-popover)] mt-1.5 w-[248px] border border-line p-1"
        >
          {history.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onUndo(index + 1)
                setOpen(false)
              }}
              className="flex w-full items-baseline justify-between gap-3 rounded-[var(--radius-10)] px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
            >
              <Text as="span" size="caption" truncate>
                {entry.label}
              </Text>
              <Text as="span" size="micro" tone="faint" tabular>
                {index === 0 ? 'undo' : `back ${index + 1}`}
              </Text>
            </button>
          ))}
        </Surface>
      )}

      {shortcuts && (
        <span className="ml-1 hidden items-center gap-1 sm:inline-flex">
          <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>Z</Kbd>
        </span>
      )}

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {past.length} {past.length === 1 ? 'step' : 'steps'} can be undone,{' '}
          {future.length} redone.
        </p>
      </VisuallyHidden>
    </div>
  )
}
