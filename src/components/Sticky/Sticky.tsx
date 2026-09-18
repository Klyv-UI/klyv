'use client'

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface StickyState {
  /** True while the element is pinned at its offset. */
  stuck: boolean
}

export interface StickyProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** The pinned content, or a function of the stuck state for content that changes when pinned. */
  children: ReactNode | ((state: StickyState) => ReactNode)
  /** Distance from the top of the scroll container at which it pins, in pixels — the height of a fixed header above it. */
  top?: number
  /** Classes added only while pinned — `shadow-[var(--shadow-float)]`, `border-b border-line`. `data-stuck` is set too. */
  stuckClassName?: string
  /** Called when the element pins or unpins. */
  onStuckChange?: (stuck: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

/** The nearest ancestor that scrolls vertically, or null for the viewport. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

/**
 * `position: sticky` that knows when it has stuck.
 *
 * CSS has no selector for “currently pinned”, and the tell-tale — a header
 * that gains a shadow once content slides under it — needs one. Listening to
 * scroll and measuring would work and would run on every frame of every
 * scroll. Instead an invisible one-pixel sentinel sits just above the element,
 * and an IntersectionObserver watches it with the root’s top edge pulled down
 * by `top`: when the sentinel passes above that line the element is pinned.
 * The browser reports that crossing once, off the main thread’s scroll path.
 *
 * The observer’s root is the nearest scrolling ancestor, found on mount, so
 * a Sticky inside a scrolling panel reports against the panel rather than the
 * window. Where IntersectionObserver is missing it still sticks; it just never
 * reports being stuck, which leaves it looking as it does at rest.
 *
 * A sticky element only pins within its parent, so give it a parent that runs
 * the length of the content it should stay over.
 */
export function Sticky({ children, top = 0, stuckClassName, onStuckChange, className, style, ...props }: StickyProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const onChangeRef = useRef(onStuckChange)
  onChangeRef.current = onStuckChange

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const root = scrollParent(sentinel)

    const observer = new IntersectionObserver(
      ([entry]) => {
        const edge = entry.rootBounds?.top ?? 0
        // Out of the root *above* its top line is pinned; out below is simply not reached yet.
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < edge)
      },
      { root, rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [top])

  const reported = useRef(false)
  useEffect(() => {
    if (reported.current === stuck) return
    reported.current = stuck
    onChangeRef.current?.(stuck)
  }, [stuck])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none h-px -mb-px w-full" />
      <div
        {...props}
        data-stuck={stuck || undefined}
        className={cn('sticky z-[var(--z-sticky)]', stuck && stuckClassName, className)}
        style={{ top, ...style }}
      >
        {typeof children === 'function' ? children({ stuck }) : children}
      </div>
    </>
  )
}
