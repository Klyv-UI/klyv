'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export type HoldTone = 'danger' | 'accent' | 'ink'

const TONES: Record<HoldTone, { shell: string; fill: string }> = {
  danger: { shell: 'border-danger/40 text-danger', fill: 'bg-danger/12' },
  accent: { shell: 'border-accent-strong text-ink', fill: 'bg-accent/40' },
  ink: { shell: 'border-line-strong text-ink', fill: 'bg-surface-muted' },
}

export interface HoldToConfirmProps {
  /** Resting label — the action itself. */
  label: string
  /** Label while the press is held. */
  holdingLabel?: string
  /** Label after it fires, held briefly. */
  doneLabel?: string
  onConfirm: () => void
  /** Milliseconds the press must be held. */
  duration?: number
  tone?: HoldTone
  /** Glyph before the label. */
  icon?: IconComponent
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A destructive action that has to be held down rather than clicked.
 *
 * It replaces the confirmation dialog for actions that are irreversible but
 * routine. A dialog asks "are you sure?" a second after the mistake has already
 * been made, and is dismissed by reflex; a hold cannot be completed by
 * accident, because the commitment is spread across the whole gesture instead
 * of being concentrated in one click.
 *
 * Progress is driven from timestamps in a `requestAnimationFrame` loop rather
 * than by counting frames, so it takes the same wall-clock time on a 60Hz and
 * a 144Hz screen. Releasing early rewinds — visibly, and about twice as fast as
 * it filled — so an abandoned press reads as cancelled rather than as stuck.
 *
 * Space and Enter hold it too: `keydown` repeats while a key is down, and
 * `keyup` ends it, so the keyboard gets the same gesture rather than a
 * shortcut that skips the safeguard.
 */
export function HoldToConfirm({
  label,
  holdingLabel = 'Keep holding…',
  doneLabel = 'Done',
  onConfirm,
  duration = 1400,
  tone = 'danger',
  icon: Icon,
  disabled = false,
  className,
}: HoldToConfirmProps) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [done, setDone] = useState(false)
  const frame = useRef(0)
  const startedAt = useRef(0)
  // Kept in a ref so a caller passing an inline arrow does not restart the
  // loop on every render — which would reset the gesture mid-press.
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm
  const palette = TONES[tone]

  // One loop for both directions: filling while held, rewinding once released.
  useEffect(() => {
    if (done) return

    const step = (now: number) => {
      if (holding) {
        const next = Math.min(1, (now - startedAt.current) / duration)
        setProgress(next)
        if (next >= 1) {
          setHolding(false)
          setDone(true)
          confirmRef.current()
          return
        }
      } else {
        let finished = false
        setProgress((value) => {
          const next = Math.max(0, value - 0.02)
          finished = next === 0
          return next
        })
        if (finished) return
      }
      frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [done, duration, holding])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => {
      setDone(false)
      setProgress(0)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [done])

  const begin = () => {
    if (disabled || done || holding) return
    // Start from where the rewind left off, so a re-press does not stutter.
    startedAt.current = performance.now() - progress * duration
    setHolding(true)
  }

  const end = () => setHolding(false)

  // A hold ends when the holder stops — not only when a key comes back up. The
  // keyup of a Space held while tabbing or switching windows goes somewhere
  // else, so the button used to go on "holding" with no one on it and fire the
  // destructive action by itself. Losing focus, the window losing focus, the
  // tab being hidden and the button being disabled all end the hold.
  useEffect(() => {
    if (!holding) return
    const release = () => setHolding(false)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release()
    }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [holding])

  useEffect(() => {
    if (disabled) setHolding(false)
  }, [disabled])

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}. Press and hold to confirm.`}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onBlur={end}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          begin()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') end()
      }}
      className={cn(
        'relative isolate inline-flex h-10 select-none items-center justify-center gap-2 overflow-hidden rounded-full border px-5 font-bold leading-none transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        done ? 'border-success text-success' : palette.shell,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 -z-10 origin-left',
          done ? 'bg-success/15' : palette.fill,
        )}
        style={{ width: '100%', transform: `scaleX(${done ? 1 : progress})` }}
      />
      {Icon && <Icon size={15} strokeWidth={2.25} aria-hidden="true" />}
      <Text as="span" size="body" className="text-current">
        {done ? doneLabel : holding ? holdingLabel : label}
      </Text>
      <span role="status" aria-live="polite" className="sr-only">
        {done ? doneLabel : ''}
      </span>
    </button>
  )
}
