'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'

export type PatternLockStatus = 'idle' | 'success' | 'error'

export interface PatternLockProps {
  /** Dots per side. */
  size?: number
  /** Fewest dots a pattern may have. Shorter ones are refused with a message. */
  minLength?: number
  /**
   * Called with the dot indices (row by row, from 0) when a pattern is
   * finished. Return or resolve true for success, false for a wrong pattern.
   */
  onComplete?: (pattern: number[]) => boolean | void | Promise<boolean | void>
  /** Forces the state from outside, for patterns checked elsewhere. */
  status?: PatternLockStatus
  /** Accessible name. */
  label?: string
  /** Blocks drawing. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const GAP = 80
const PAD = 40
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/**
 * A grid of dots joined by one continuous stroke — the unlock pattern — for a
 * quick second factor, a parental gate, or confirming a destructive action on a
 * touch device.
 *
 * It follows the rules people know from phones: a dot joins once, and a stroke
 * that passes straight over an unused dot picks it up on the way, so the
 * pattern is the one drawn rather than the one the pointer happened to land
 * on. The same pattern can be entered without a pointer: arrows move a cursor,
 * Space joins the dot under it, Backspace takes the last one back and Enter
 * submits. Every dot joined is announced by its number.
 */
export function PatternLock({
  size = 3,
  minLength = 4,
  onComplete,
  status: statusProp,
  label = 'Unlock pattern',
  disabled = false,
  className,
}: PatternLockProps) {
  const uid = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [path, setPathState] = useState<number[]>([])
  // Pointer moves arrive faster than renders; the ref is the path as of the last event.
  const pathRef = useRef<number[]>([])
  const setPath = (next: number[]) => {
    pathRef.current = next
    setPathState(next)
  }
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState(Math.floor((size * size) / 2))
  const [own, setOwn] = useState<PatternLockStatus>('idle')
  const [message, setMessage] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const drawing = useRef(false)
  const reset = useRef<number>()
  const status = statusProp ?? own
  const extent = PAD * 2 + GAP * (size - 1)

  useEffect(() => () => window.clearTimeout(reset.current), [])

  const at = (index: number) => ({ x: PAD + (index % size) * GAP, y: PAD + Math.floor(index / size) * GAP })

  /** The dot, plus any unused dots the straight line from the last one passes over. */
  const extend = (current: number[], index: number) => {
    if (current.includes(index)) return current
    const last = current[current.length - 1]
    const next = [...current]
    if (last !== undefined) {
      const [dr, dc] = [Math.floor(index / size) - Math.floor(last / size), (index % size) - (last % size)]
      const steps = gcd(dr, dc)
      for (let s = 1; s < steps; s++) {
        const between = last + (dr / steps) * s * size + (dc / steps) * s
        if (!next.includes(between)) next.push(between)
      }
    }
    next.push(index)
    return next
  }

  const add = (index: number) => {
    const current = pathRef.current
    const next = extend(current, index)
    if (next.length === current.length) return
    setPath(next)
    setAnnouncement(`Dot ${next.slice(current.length).map((i) => i + 1).join(', ')} joined. ${next.length} dots.`)
  }

  const finish = async (pattern: number[]) => {
    drawing.current = false
    setPointer(null)
    if (pattern.length === 0) return
    window.clearTimeout(reset.current)
    const settle = (next: PatternLockStatus, text: string) => {
      setOwn(next)
      setMessage(text)
      setAnnouncement(text)
      if (next !== 'success') reset.current = window.setTimeout(() => {
        setPath([])
        setOwn('idle')
      }, 1200)
    }
    if (pattern.length < minLength) return settle('error', `Join at least ${minLength} dots.`)
    const result = await onComplete?.(pattern)
    if (result === true) settle('success', 'Pattern accepted.')
    else if (result === false) settle('error', 'Wrong pattern. Try again.')
    else settle('idle', `Pattern of ${pattern.length} dots entered.`)
  }

  const locate = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * extent
    const y = ((event.clientY - box.top) / box.height) * extent
    const hit = Array.from({ length: size * size }, (_, i) => i).find((i) => Math.hypot(at(i).x - x, at(i).y - y) < GAP * 0.32)
    return { x, y, hit }
  }

  const begin = () => {
    window.clearTimeout(reset.current)
    setOwn('idle')
    setMessage('')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) return
    const row = Math.floor(cursor / size)
    const col = cursor % size
    const moves: Record<string, number> = {
      ArrowLeft: row * size + Math.max(0, col - 1),
      ArrowRight: row * size + Math.min(size - 1, col + 1),
      ArrowUp: Math.max(0, row - 1) * size + col,
      ArrowDown: Math.min(size - 1, row + 1) * size + col,
    }
    if (event.key in moves) {
      event.preventDefault()
      setCursor(moves[event.key])
    } else if (event.key === ' ') {
      event.preventDefault()
      if (status !== 'idle') {
        begin()
        setPath([])
      }
      add(cursor)
    } else if (event.key === 'Backspace' && path.length) {
      event.preventDefault()
      setPath(path.slice(0, -1))
      setAnnouncement(`Dot ${path[path.length - 1] + 1} removed. ${path.length - 1} dots.`)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      finish(path)
    } else if (event.key === 'Escape' && path.length) {
      event.preventDefault()
      setPath([])
      setAnnouncement('Pattern cleared.')
    }
  }

  const tone = status === 'success' ? 'stroke-success' : status === 'error' ? 'stroke-danger' : 'stroke-ink'
  const dotTone = status === 'success' ? 'fill-success' : status === 'error' ? 'fill-danger' : 'fill-ink'
  const last = path.length ? at(path[path.length - 1]) : null
  const points = path.map((i) => `${at(i).x},${at(i).y}`).join(' ')

  return (
    <div className={cn('flex w-full max-w-[280px] flex-col items-center gap-3', disabled && 'opacity-40', className)}>
      <div
        role="application"
        aria-roledescription="pattern lock"
        aria-label={label}
        aria-describedby={`${uid}-help`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        className="group w-full rounded-[var(--radius-card)] border border-line bg-surface-sunken outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${extent} ${extent}`}
          aria-hidden="true"
          className="block w-full touch-none select-none"
          onPointerDown={(event) => {
            if (disabled) return
            const { hit } = locate(event)
            begin()
            drawing.current = true
            svgRef.current?.setPointerCapture?.(event.pointerId)
            setPath(hit === undefined ? [] : [hit])
            if (hit !== undefined) setCursor(hit)
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return
            const { x, y, hit } = locate(event)
            setPointer({ x, y })
            if (hit !== undefined) {
              add(hit)
              setCursor(hit)
            }
          }}
          onPointerUp={() => drawing.current && finish(pathRef.current)}
          onPointerCancel={() => {
            drawing.current = false
            setPointer(null)
            setPath([])
          }}
        >
          {points && <polyline points={points} fill="none" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className={cn(tone, 'opacity-70')} />}
          {last && pointer && <line x1={last.x} y1={last.y} x2={pointer.x} y2={pointer.y} strokeWidth={6} strokeLinecap="round" className={cn(tone, 'opacity-30')} />}
          {Array.from({ length: size * size }, (_, i) => {
            const { x, y } = at(i)
            const on = path.includes(i)
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={on ? 14 : 7} className={cn('transition-[r] duration-150 motion-reduce:transition-none', on ? dotTone : 'fill-ink-faint')} />
                {on && <circle cx={x} cy={y} r={22} className={cn('fill-none opacity-40', tone)} strokeWidth={2} />}
                <circle cx={x} cy={y} r={26} className={cn('fill-none stroke-focus opacity-0', i === cursor && 'group-focus-visible:opacity-100')} strokeWidth={2} strokeDasharray="4 4" />
              </g>
            )
          })}
        </svg>
      </div>
      <p id={`${uid}-help`} className="sr-only">
        Arrow keys move between dots, Space joins the dot, Backspace removes the last one, Enter submits. Dots are numbered 1 to {size * size}, row by row.
      </p>
      <p className={cn('min-h-[18px] text-center text-[12px] font-semibold', status === 'error' ? 'text-danger' : status === 'success' ? 'text-success' : 'text-ink-faint')}>
        {message || (path.length ? `${path.length} dot${path.length === 1 ? '' : 's'}` : `Join at least ${minLength} dots`)}
      </p>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
