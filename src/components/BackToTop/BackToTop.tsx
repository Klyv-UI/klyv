'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface BackToTopProps {
  /** Pixels scrolled before the button appears. */
  threshold?: number
  /** The scrolling element. Omit to track the window. */
  target?: RefObject<HTMLElement | null>
  /**
   * Selector for the element that receives focus once back at the top —
   * usually the skip-link target. Without this, focus stays on a button at the
   * bottom of the page while the reader is looking at the top of it.
   */
  focusTarget?: string
  /** Draw a ring round the button showing how far down the page the reader is. */
  showProgress?: boolean
  /** Accessible name, and the tooltip. */
  label?: string
  /** Which corner it floats in. */
  side?: 'left' | 'right'
  /** Pin to the viewport. Turn it off to place it inside a positioned container. */
  fixed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const SIZE = 44
const STROKE = 3
const RADIUS = SIZE / 2 - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A floating button that takes a long page back to its start.
 *
 * It stays out of the way until it is useful: nothing is shown until the reader
 * is past `threshold`, and it is hidden with `visibility`, so it leaves the tab
 * order too rather than being an invisible stop at the end of every page.
 *
 * Two details decide whether it helps anyone but mouse users. Scrolling alone
 * leaves keyboard focus on the button at the bottom, so the next Tab jumps the
 * reader straight back down; focus is moved to `focusTarget` instead. And the
 * smooth scroll becomes an instant jump when reduced motion is asked for —
 * a long animated scroll is exactly the motion that setting exists to stop.
 *
 * Scroll is read at most once a frame.
 */
export function BackToTop({
  threshold = 400,
  target,
  focusTarget = '#main, main',
  showProgress = false,
  label = 'Back to top',
  side = 'right',
  fixed = true,
  className,
}: BackToTopProps) {
  const reduced = usePrefersReducedMotion()
  const [state, setState] = useState({ visible: false, progress: 0 })
  const frame = useRef(0)

  useEffect(() => {
    const node = target?.current ?? null

    const measure = () => {
      frame.current = 0
      const top = node ? node.scrollTop : window.scrollY
      const max = node ? node.scrollHeight - node.clientHeight : document.documentElement.scrollHeight - window.innerHeight
      const progress = max <= 0 ? 0 : Math.min(1, Math.max(0, top / max))
      const visible = top > threshold
      setState((current) =>
        current.visible === visible && Math.abs(current.progress - progress) < 0.005 ? current : { visible, progress },
      )
    }
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(measure)
    }

    const source: HTMLElement | Window = node ?? window
    source.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    measure()
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      source.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [target, threshold])

  const goToTop = () => {
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
    const node = target?.current
    if (node) node.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })

    const destination = focusTarget ? document.querySelector<HTMLElement>(focusTarget) : null
    if (!destination) return
    // Landmarks are not focusable by default; -1 makes them a focus target
    // without adding them to the tab order.
    if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1')
    destination.focus({ preventScroll: true })
  }

  const { visible, progress } = state

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={goToTop}
      className={cn(
        'z-[var(--z-sticky)] inline-flex items-center justify-center rounded-full bg-shell text-ink shadow-[var(--shadow-float)]',
        'transition-[opacity,transform,visibility,background-color] duration-200 hover:bg-surface-muted motion-reduce:transition-none',
        fixed ? 'fixed bottom-6' : 'absolute bottom-4',
        side === 'right' ? (fixed ? 'right-6' : 'right-4') : fixed ? 'left-6' : 'left-4',
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0',
        className,
      )}
      style={{ width: SIZE, height: SIZE }}
    >
      {showProgress && (
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-line" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="stroke-accent-strong"
          />
        </svg>
      )}
      <svg
        width={18}
        height={18}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="relative"
      >
        <path d="M8 13V3M4 7l4-4 4 4" />
      </svg>
    </button>
  )
}
