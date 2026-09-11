'use client'

import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface EmojiSliderProps {
  value: number
  onChange: (value: number) => void
  /** What is being rated. */
  label: string
  /** Worst to best. The scale is split evenly between them. */
  faces?: string[]
  /** Words for each face, announced instead of the number. */
  words?: string[]
  /** Lowest value. */
  min?: number
  /** Highest value. */
  max?: number
  /** Grow the emoji as it improves. */
  scaleWithValue?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FACES = ['😖', '🙁', '😐', '🙂', '🤩']
const WORDS = ['Awful', 'Not great', 'Fine', 'Good', 'Perfect']

/**
 * A rating you drag, where the face changes as you go.
 *
 * The emoji is the readout. A numeric slider makes people convert a feeling
 * into a number and then wonder whether 7 is the same 7 they gave last time; a
 * face is compared to the feeling directly, which is why every product that
 * actually gets responses uses one.
 *
 * It is still a `role="slider"` with arrow keys, Home and End, and
 * `aria-valuetext` set to the *word* rather than the number — because "Good"
 * is the value, and 68 is an implementation detail nobody rating anything
 * cares about.
 *
 * The face scales with the value as well as changing, so the difference
 * between neighbouring faces is visible in size as well as expression. Two
 * similar emoji at identical size are surprisingly hard to tell apart at a
 * glance.
 */
export function EmojiSlider({
  value,
  onChange,
  label,
  faces = FACES,
  words = WORDS,
  min = 0,
  max = 100,
  scaleWithValue = true,
  className,
}: EmojiSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [active, setActive] = useState(false)

  const span = max - min || 1
  const fraction = Math.min(1, Math.max(0, (value - min) / span))
  const step = Math.min(faces.length - 1, Math.floor(fraction * faces.length))
  const word = words[Math.min(words.length - 1, step)] ?? ''

  const track = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box) return
    onChange(Math.round(min + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span))
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-4">
        <Text as="span" size="body">
          {label}
        </Text>
        <Text as="span" size="caption" weight="bold" tone="soft">
          {word}
        </Text>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        // The word is the value. The number is an implementation detail.
        aria-valuetext={word}
        onPointerDown={(event) => {
          dragging.current = true
          setActive(true)
          event.currentTarget.setPointerCapture(event.pointerId)
          track(event.clientX)
        }}
        onPointerMove={(event) => {
          if (dragging.current) track(event.clientX)
        }}
        onPointerUp={() => {
          dragging.current = false
          setActive(false)
        }}
        onPointerCancel={() => {
          dragging.current = false
          setActive(false)
        }}
        onKeyDown={(event) => {
          const amount = event.shiftKey ? span / 10 : span / 50
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onChange(Math.min(max, value + amount))
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onChange(Math.max(min, value - amount))
          else if (event.key === 'Home') onChange(min)
          else if (event.key === 'End') onChange(max)
          else return
          event.preventDefault()
        }}
        className="relative h-12 cursor-pointer touch-none select-none rounded-full bg-track outline-offset-4"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full bg-accent-soft transition-[width] duration-[var(--duration-fast)]"
          style={{ width: `${fraction * 100}%` }}
        />

        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-[var(--shadow-float)] transition-[transform,width,height] duration-[var(--duration-fast)]',
            active && 'ring-2 ring-accent-strong',
          )}
          style={{
            left: `${fraction * 100}%`,
            width: scaleWithValue ? 40 + step * 4 : 44,
            height: scaleWithValue ? 40 + step * 4 : 44,
            fontSize: scaleWithValue ? 19 + step * 2 : 21,
          }}
        >
          {faces[step]}
        </span>
      </div>

      <div aria-hidden="true" className="flex items-center justify-between">
        {faces.map((face, index) => (
          <span
            key={index}
            className={cn(
              'text-[13px] transition-opacity',
              index === step ? 'opacity-100' : 'opacity-30',
            )}
          >
            {face}
          </span>
        ))}
      </div>
    </div>
  )
}
