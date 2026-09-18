'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { BackToTop } from '../BackToTop'
import { Text } from '../Text'

export type ScrollProgressVariant = 'bar' | 'ring'

export interface ScrollProgressProps {
  /** The scrolling element. Omit to track the window. */
  target?: RefObject<HTMLElement | null>
  variant?: ScrollProgressVariant
  /** Bar thickness, or ring diameter, in pixels. */
  size?: number
  /** Pin to the viewport. Turn it off to place it inside a container. */
  fixed?: boolean
  /** Which edge it pins to when fixed. */
  position?: 'top' | 'bottom'
  /** Show the percentage inside the ring. */
  showValue?: boolean
  /**
   * Render the ring as a back-to-top button.
   *
   * @deprecated Use `<BackToTop showProgress />`, which this now renders: it moves focus
   * to the top of the page, jumps instead of animating under reduced motion, and leaves
   * the tab order while hidden. `target`, `fixed` and `className` are passed on; the ring's
   * size, colours, `showValue` and `hideUntil` are not.
   */
  backToTop?: boolean
  /** Hide the ring until there is something to show. */
  hideUntil?: number
  /** Any CSS colour for the filled portion. Defaults to the accent. */
  color?: string
  /** Any CSS colour for the portion not yet read. */
  trackColor?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * How far through the page — or through one scrolling element — the reader is.
 *
 * Scroll fires far more often than the screen repaints, so the handler does
 * nothing but request a frame; the measurement and the single state write
 * happen once per frame at most. Without that coalescing this is one of the
 * easiest components in a library to make a page feel slow.
 *
 * The value is written to `aria-valuenow` on a `progressbar`, so it is
 * available to a screen reader without being announced on every pixel of
 * scroll — the ring itself is decorative and marked so.
 *
 * It is an indicator, not a control. For a button that takes the reader back
 * up — with the ring as its progress — use BackToTop with `showProgress`; the
 * deprecated `backToTop` prop renders exactly that.
 */
export function ScrollProgress({ backToTop = false, ...props }: ScrollProgressProps) {
  if (backToTop && props.variant === 'ring') {
    return <BackToTop showProgress target={props.target} fixed={props.fixed} className={props.className} />
  }
  return <ScrollProgressIndicator {...props} />
}

function ScrollProgressIndicator({
  target,
  variant = 'bar',
  size = variant === 'bar' ? 3 : 44,
  fixed = true,
  position = 'top',
  showValue = false,
  hideUntil = 0,
  color = 'var(--color-accent-strong)',
  trackColor = 'transparent',
  className,
}: Omit<ScrollProgressProps, 'backToTop'>) {
  const [progress, setProgress] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    const node = target?.current ?? null

    const measure = () => {
      frame.current = 0
      if (node) {
        const max = node.scrollHeight - node.clientHeight
        setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, node.scrollTop / max)))
      } else {
        const max = document.documentElement.scrollHeight - window.innerHeight
        setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max)))
      }
    }

    const onScroll = () => {
      if (frame.current) return
      frame.current = requestAnimationFrame(measure)
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
  }, [target])

  const percent = Math.round(progress * 100)

  if (variant === 'bar') {
    return (
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'left-0 right-0 z-[var(--z-sticky)] overflow-hidden',
          fixed ? 'fixed' : 'absolute',
          position === 'top' ? 'top-0' : 'bottom-0',
          className,
        )}
        style={{ height: size, background: trackColor }}
      >
        {/* No transition — the value is already frame-accurate, and easing it
            would leave the bar lagging the content it describes. */}
        <div
          className="h-full w-full origin-left rounded-r-full"
          style={{ background: color, transform: `scaleX(${progress})` }}
        />
      </div>
    )
  }

  const stroke = Math.max(2, Math.round(size * 0.09))
  const radius = size / 2 - stroke
  const circumference = 2 * Math.PI * radius
  const visible = percent >= hideUntil * 100

  const ring = (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor === 'transparent' ? 'var(--color-track)' : trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      {showValue && (
        <Text
          as="span"
          size="micro"
          tabular
          className="absolute inset-0 flex items-center justify-center"
        >
          {percent}
        </Text>
      )}
    </>
  )

  const shell = cn(
    'relative inline-flex items-center justify-center rounded-full bg-surface shadow-[var(--shadow-float)] transition-opacity duration-[var(--duration-slow)]',
    fixed && 'fixed bottom-6 right-6 z-[var(--z-sticky)]',
    visible ? 'opacity-100' : 'pointer-events-none opacity-0',
    className,
  )

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={shell}
    >
      {ring}
    </div>
  )
}
