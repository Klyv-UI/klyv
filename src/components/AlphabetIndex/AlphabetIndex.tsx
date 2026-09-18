'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export type AlphabetIndexOrientation = 'vertical' | 'horizontal'

export interface AlphabetIndexProps {
  /** The letters on the bar, in order. Defaults to A–Z; pass your own for other alphabets or a leading "#". */
  letters?: string[]
  /** Letters that have entries. The rest are shown but disabled. Omit to enable every letter. */
  available?: string[]
  /**
   * Where each letter’s group heading is: the element with id `${targetIdPrefix}${letter}`.
   * The heading receives focus, so give it `tabIndex={-1}` (it is added if missing).
   */
  targetIdPrefix?: string
  /** Finds the heading for a letter, instead of the id convention. */
  getTarget?: (letter: string) => HTMLElement | null
  /** Called after a jump, with the letter. */
  onJump?: (letter: string) => void
  /** The letter to mark as current — for example the group scrolled into view. */
  current?: string
  /** vertical is the rail beside a contact list; horizontal sits above a directory. */
  orientation?: AlphabetIndexOrientation
  /** Accessible name for the bar. */
  label?: string
  /** Let touch and pen users scrub along the bar to jump as they drag. */
  scrub?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/**
 * The A–Z rail beside a long grouped list.
 *
 * Scrolling a list of four hundred contacts to reach "S" is slow on a
 * trackpad and slower on a phone. The rail jumps straight to the group — and
 * moves keyboard focus to its heading, so the next Tab continues from there
 * instead of from the top of the page. Letters with nobody under them stay in
 * place but are disabled, because a rail that closes up its gaps puts every
 * letter in a different spot from one list to the next.
 *
 * It is one tab stop: arrow keys move along the letters, skipping empty ones,
 * Home and End go to the ends, and typing a letter moves straight to it. On
 * touch, dragging along the rail scrubs through the groups the way a phone’s
 * contacts app does, and focus lands on the last one when the finger lifts.
 */
export function AlphabetIndex({
  letters = AZ,
  available,
  targetIdPrefix = 'letter-',
  getTarget,
  onJump,
  current: controlledCurrent,
  orientation = 'vertical',
  label = 'Jump to letter',
  scrub = true,
  className,
}: AlphabetIndexProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [lastJump, setLastJump] = useState<string | null>(null)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const scrubbing = useRef<string | null>(null)
  const reduced = usePrefersReducedMotion()

  const enabled = (letter: string) => !available || available.some((item) => item.toUpperCase() === letter.toUpperCase())
  const current = controlledCurrent ?? lastJump
  const firstEnabled = letters.findIndex(enabled)
  const currentIndex = current ? letters.findIndex((letter) => letter === current && enabled(letter)) : -1
  const tabIndex = focusIndex !== null && enabled(letters[focusIndex] ?? '') ? focusIndex : currentIndex >= 0 ? currentIndex : firstEnabled

  const jump = (letter: string, moveFocus: boolean) => {
    const target = getTarget ? getTarget(letter) : document.getElementById(`${targetIdPrefix}${letter}`)
    if (target) {
      target.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
      if (moveFocus) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
      }
    }
    setLastJump(letter)
    onJump?.(letter)
  }

  const focusAt = (index: number) => {
    setFocusIndex(index)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = refs.current.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
    const back = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    const seek = (from: number, step: number) => {
      for (let index = from; index >= 0 && index < letters.length; index += step) if (enabled(letters[index])) return index
      return -1
    }
    let next = -1
    if (event.key === forward) next = seek(at + 1, 1)
    else if (event.key === back) next = seek(at - 1, -1)
    else if (event.key === 'Home') next = seek(0, 1)
    else if (event.key === 'End') next = seek(letters.length - 1, -1)
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const index = letters.findIndex((letter) => letter.toUpperCase() === event.key.toUpperCase())
      if (index >= 0 && enabled(letters[index])) next = index
      else return
    } else return
    event.preventDefault()
    if (next >= 0) focusAt(next)
  }

  const letterAt = (event: PointerEvent) => {
    const node = document.elementFromPoint?.(event.clientX, event.clientY) as HTMLElement | null
    return node?.closest<HTMLElement>('[data-alphabet-letter]')?.dataset.alphabetLetter ?? null
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!scrub || event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    scrubbing.current = ''
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current === null) return
    const letter = letterAt(event)
    if (!letter || letter === scrubbing.current || !enabled(letter)) return
    scrubbing.current = letter
    jump(letter, false)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current === null) return
    // Capturing the pointer can retarget the click to the rail, so a plain
    // tap is resolved here from where the finger lifted.
    const tapped = letterAt(event)
    const letter = scrubbing.current || (tapped && enabled(tapped) ? tapped : null)
    scrubbing.current = null
    if (letter) jump(letter, true)
  }

  const vertical = orientation === 'vertical'

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (scrubbing.current = null)}
      className={cn(
        'inline-flex select-none',
        vertical ? 'flex-col items-center gap-px py-1' : 'flex-wrap items-center gap-0.5',
        scrub && 'touch-none',
        className,
      )}
    >
      {letters.map((letter, index) => {
        const on = enabled(letter)
        const isCurrent = on && letter === current
        return (
          <button
            key={letter}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            data-alphabet-letter={letter}
            disabled={!on}
            tabIndex={index === tabIndex ? 0 : -1}
            aria-current={isCurrent ? 'true' : undefined}
            onFocus={() => setFocusIndex(index)}
            onClick={() => jump(letter, true)}
            className={cn(
              'inline-flex items-center justify-center rounded-full font-bold leading-none tabular-nums transition-colors',
              vertical ? 'h-[18px] w-6 text-[10px]' : 'size-7 text-[12px]',
              'disabled:cursor-default disabled:text-ink-faint disabled:opacity-40',
              isCurrent ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            )}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
