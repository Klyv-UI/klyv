'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface LazyMountProps {
  /** Rendered once the wrapper comes within `rootMargin` of the viewport. */
  children: ReactNode
  /** How far outside the viewport to start mounting, as an IntersectionObserver root margin. */
  rootMargin?: string
  /** Space held before mount, so the page does not jump when the content arrives. Number is px. */
  minHeight?: number | string
  /** Aspect ratio held before mount — `16 / 9` — for media whose height follows its width. */
  aspectRatio?: number | string
  /** Shown in the reserved space until mount. Defaults to a quiet sunken block. */
  placeholder?: ReactNode
  /** Unmount again when scrolled far away, keeping the last measured height. For very long pages. */
  unmountWhenHidden?: boolean
  /** Called each time the children mount. */
  onMount?: () => void
  /** Merged onto the wrapper. */
  className?: string
}

/**
 * Keeps an expensive subtree out of the page until the reader is about to see it.
 *
 * A dashboard with twenty charts pays for all twenty on load, even though the
 * reader sees three. This mounts children only when the wrapper comes within
 * `rootMargin` of the viewport, and holds their space in the meantime — a
 * `minHeight` or an aspect ratio — so the scrollbar does not lie and the page
 * does not jump when they land. With `unmountWhenHidden` it also lets them go
 * again once far away, remembering their measured height.
 *
 * Content that is not mounted cannot be found by in-page search or read ahead
 * by a screen reader, so the wrapper reports itself busy while waiting, and
 * everything mounts before printing. Where IntersectionObserver is missing it
 * mounts at once: late content beats content that never arrives.
 */
export function LazyMount({
  children,
  rootMargin = '200px',
  minHeight,
  aspectRatio,
  placeholder,
  unmountWhenHidden = false,
  onMount,
  className,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [held, setHeld] = useState<number | null>(null)
  const onMountRef = useRef(onMount)
  onMountRef.current = onMount

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
          if (!unmountWhenHidden) observer.disconnect()
        } else if (unmountWhenHidden) {
          setHeld(node.getBoundingClientRect().height || null)
          setMounted(false)
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, unmountWhenHidden])

  useEffect(() => {
    const onPrint = () => setMounted(true)
    window.addEventListener('beforeprint', onPrint)
    return () => window.removeEventListener('beforeprint', onPrint)
  }, [])

  useEffect(() => {
    if (mounted) onMountRef.current?.()
  }, [mounted])

  const reserve: CSSProperties = mounted
    ? {}
    : {
        minHeight: held ?? minHeight,
        aspectRatio: held == null && aspectRatio != null ? String(aspectRatio) : undefined,
      }

  return (
    <div ref={ref} aria-busy={!mounted || undefined} data-mounted={mounted ? '' : undefined} style={reserve} className={cn('relative', className)}>
      {mounted
        ? children
        : placeholder ?? (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-[var(--radius-card)] bg-surface-sunken"
            />
          )}
    </div>
  )
}
