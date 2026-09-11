'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface ImageCompareProps {
  /** The state being compared against — drawn underneath. */
  before: ReactNode
  /** The new state — drawn on top and clipped to the handle. */
  after: ReactNode
  /** Accessible name for the comparison. */
  label: string
  /** Corner captions. Omit either to hide it. */
  beforeLabel?: string
  /** Caption for the revealed side. Empty hides it. */
  afterLabel?: string
  /** Starting position, 0 to 1. */
  initial?: number
  /** Split top/bottom instead of left/right. */
  orientation?: 'horizontal' | 'vertical'
  /** Reveal follows the pointer without a press. */
  hover?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Two states of the same thing, split by a handle you drag across them.
 *
 * Both layers are laid out in full and the top one is clipped by a
 * `clip-path` inset — not resized. Resizing the top layer would reflow its
 * contents at every pixel of the drag, which is why a version built that way
 * judders on anything more complex than a photograph. Clipping moves one
 * number and never touches layout, so the two sides stay pixel-aligned.
 *
 * The handle is a real slider: `role="slider"` with `aria-valuenow`, arrow keys
 * for fine steps, Home and End for the extremes. It takes children rather than
 * image sources, so it compares whatever you put in it — screenshots, two chart
 * states, a before-and-after of a form.
 */
export function ImageCompare({
  before,
  after,
  label,
  beforeLabel = 'Before',
  afterLabel = 'After',
  initial = 0.5,
  orientation = 'horizontal',
  hover = false,
  className,
}: ImageCompareProps) {
  const [position, setPosition] = useState(Math.min(1, Math.max(0, initial)))
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const isHorizontal = orientation === 'horizontal'
  const percent = Math.round(position * 100)

  const track = (clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect()
    if (!box) return
    const next = isHorizontal
      ? (clientX - box.left) / box.width
      : (clientY - box.top) / box.height
    setPosition(Math.min(1, Math.max(0, next)))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setPosition((value) => Math.max(0, value - step))
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      setPosition((value) => Math.min(1, value + step))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setPosition(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setPosition(1)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative isolate select-none overflow-hidden rounded-[var(--radius-card)] border border-line',
        className,
      )}
      onPointerDown={(event) => {
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        track(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (!dragging.current && !hover) return
        track(event.clientX, event.clientY)
      }}
      onPointerUp={() => {
        dragging.current = false
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
    >
      <div className="relative">{before}</div>

      <div
        className="absolute inset-0"
        style={{
          // Clipped, not resized — the layer underneath never reflows. The
          // after layer keeps the far side, so the handle uncovers the before.
          clipPath: isHorizontal
            ? `inset(0 0 0 ${percent}%)`
            : `inset(${percent}% 0 0 0)`,
        }}
      >
        {after}
      </div>

      {beforeLabel && (
        <Text
          as="span"
          size="micro"
          className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/70 px-2 py-1 text-ink-inverse"
        >
          {beforeLabel}
        </Text>
      )}
      {afterLabel && (
        <Text
          as="span"
          size="micro"
          className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-2 py-1 text-accent-ink"
        >
          {afterLabel}
        </Text>
      )}

      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% ${beforeLabel || 'before'} shown`}
        aria-orientation={isHorizontal ? 'horizontal' : 'vertical'}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute z-10 flex items-center justify-center',
          isHorizontal ? 'inset-y-0 w-8 -translate-x-1/2 cursor-ew-resize' : 'inset-x-0 h-8 -translate-y-1/2 cursor-ns-resize',
        )}
        style={isHorizontal ? { left: `${percent}%` } : { top: `${percent}%` }}
      >
        <span
          aria-hidden="true"
          className={cn('absolute bg-white/90', isHorizontal ? 'inset-y-0 w-0.5' : 'inset-x-0 h-0.5')}
        />
        <span
          aria-hidden="true"
          className="relative grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-float)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={cn(!isHorizontal && 'rotate-90')}>
            <path d="m9 6-5 6 5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>
    </div>
  )
}
