'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Spinner } from '../Spinner'
import { ArrowRightIcon, CheckIcon } from '../internal/icons'

export type SwipeToConfirmStatus = 'idle' | 'pending' | 'done'

export interface SwipeToConfirmProps {
  /** What sliding does — "Slide to pay $42.00". Also the slider's accessible name. */
  label: string
  /** Runs once the thumb reaches the end. Return a promise to show pending until it settles. */
  onConfirm: () => void | Promise<void>
  /** Label while the promise is pending. */
  pendingLabel?: string
  /** Label once confirmed. */
  doneLabel?: string
  /** Controlled status, for when the confirmation is tracked elsewhere. */
  status?: SwipeToConfirmStatus
  /** Milliseconds after done before the track resets. Leave it out to stay done. */
  resetAfter?: number
  /** Milliseconds Enter or Space must be held to confirm from the keyboard. */
  holdDuration?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const THUMB = 44
const PAD = 4
const THRESHOLD = 0.92

/**
 * A slide-to-confirm track, for a commitment made on a phone — pay, send, end
 * a shift.
 *
 * A tap is too easy to make by accident in a pocket or a moving vehicle; a
 * slide across the whole track is not. Let go before the end and the thumb
 * springs back, which reads as "not done" without any message.
 *
 * The keyboard gets the same deliberateness rather than a shortcut around it.
 * The thumb is a slider: arrows move it, End jumps to the end and confirms, and
 * holding Enter or Space fills the track over a moment, rewinding if released
 * early. Under reduced motion the spring back is instant.
 */
export function SwipeToConfirm({
  label,
  onConfirm,
  pendingLabel = 'Confirming…',
  doneLabel = 'Confirmed',
  status: controlledStatus,
  resetAfter,
  holdDuration = 900,
  disabled = false,
  className,
}: SwipeToConfirmProps) {
  const [internalStatus, setInternalStatus] = useState<SwipeToConfirmStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [holding, setHolding] = useState(false)
  const status = controlledStatus ?? internalStatus
  const reduced = usePrefersReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const start = useRef({ x: 0, progress: 0 })
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm

  const travel = () => Math.max(1, (trackRef.current?.offsetWidth ?? 280) - THUMB - PAD * 2)
  const locked = disabled || status !== 'idle'

  const confirm = async () => {
    setProgress(1)
    setDragging(false)
    setHolding(false)
    try {
      const result = confirmRef.current()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setInternalStatus('pending')
        await result
      }
      setInternalStatus('done')
    } catch {
      setInternalStatus('idle')
      setProgress(0)
    }
  }

  // Whatever the status came back to, the thumb follows: back to the start when idle, at the end otherwise.
  useEffect(() => {
    if (status === 'idle' && !dragging && !holding) setProgress(0)
    if (status !== 'idle') setProgress(1)
  }, [status])

  useEffect(() => {
    if (status !== 'done' || resetAfter === undefined) return
    const timer = window.setTimeout(() => setInternalStatus('idle'), resetAfter)
    return () => window.clearTimeout(timer)
  }, [status, resetAfter])

  // Holding Enter or Space fills the track from wall-clock time; letting go springs it back.
  useEffect(() => {
    if (!holding) return
    const began = performance.now()
    let frame = requestAnimationFrame(function step() {
      // performance.now rather than the frame timestamp, which can predate `began` by a frame.
      const next = Math.min(1, Math.max(0, (performance.now() - began) / holdDuration))
      setProgress(next)
      if (next >= 1) {
        void confirm()
        return
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [holding, holdDuration])

  const release = () => {
    if (status === 'idle') setProgress(0)
  }

  const text = status === 'pending' ? pendingLabel : status === 'done' ? doneLabel : label
  const offset = progress * travel()
  const settle = !dragging && !holding && !reduced

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-[52px] w-full min-w-[220px] select-none overflow-hidden rounded-full border',
        status === 'done' ? 'border-success/40 bg-success/12' : 'border-line-strong bg-surface-muted',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 rounded-full',
          status === 'done' ? 'bg-transparent' : 'bg-[color-mix(in_oklab,var(--color-accent)_45%,transparent)]',
          settle && 'transition-[width] duration-300 ease-out',
        )}
        style={{ width: offset + THUMB + PAD * 2 }}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 flex items-center justify-center pl-12 pr-4 text-[13px] font-bold',
          status === 'done' ? 'text-success' : 'text-ink',
        )}
        style={{ opacity: status === 'idle' ? Math.max(0, 1 - progress * 1.6) : 1 }}
      >
        {text}
      </span>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={status === 'idle' ? `${Math.round(progress * 100)}%. Slide to the end, press End, or hold Enter to confirm.` : text}
        aria-disabled={locked || undefined}
        onPointerDown={(event) => {
          if (locked || event.button !== 0) return
          start.current = { x: event.clientX, progress }
          setDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          const next = start.current.progress + (event.clientX - start.current.x) / travel()
          setProgress(Math.min(1, Math.max(0, next)))
        }}
        onPointerUp={() => {
          if (!dragging) return
          setDragging(false)
          if (progress >= THRESHOLD) void confirm()
          else release()
        }}
        onPointerCancel={() => {
          setDragging(false)
          release()
        }}
        onBlur={() => {
          if (holding) {
            setHolding(false)
            release()
          }
        }}
        onKeyDown={(event) => {
          if (locked) return
          const step = 0.1
          if (event.key === 'End') {
            event.preventDefault()
            void confirm()
          } else if (event.key === 'Home') {
            event.preventDefault()
            setProgress(0)
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            const next = Math.min(1, Math.round((progress + step) * 100) / 100)
            if (next >= 1) void confirm()
            else setProgress(next)
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            setProgress(Math.max(0, Math.round((progress - step) * 100) / 100))
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!event.repeat) setHolding(true)
          }
        }}
        onKeyUp={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && holding) {
            setHolding(false)
            release()
          }
        }}
        className={cn(
          'absolute left-1 top-1 inline-flex touch-none items-center justify-center rounded-full shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          status === 'done' ? 'bg-success text-ink-inverse' : 'bg-accent text-accent-ink',
          locked ? 'cursor-default' : dragging ? 'cursor-grabbing' : 'cursor-grab',
          settle && 'transition-transform duration-300 ease-out',
        )}
        style={{ width: THUMB, height: THUMB, transform: `translateX(${offset}px)` }}
      >
        {status === 'pending' ? (
          <Spinner size="md" />
        ) : status === 'done' ? (
          <CheckIcon size={18} strokeWidth={2.75} />
        ) : (
          <ArrowRightIcon size={18} strokeWidth={2.5} />
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {status === 'idle' ? '' : text}
      </span>
    </div>
  )
}
