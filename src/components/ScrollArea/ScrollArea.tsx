'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ScrollAreaOrientation = 'vertical' | 'horizontal' | 'both'

export interface ScrollAreaProps {
  /** The content that may overflow. */
  children: ReactNode
  /**
   * Accessible name for the scrolling region. Required: the region takes
   * keyboard focus, and a focus stop with no name is announced as nothing.
   */
  label: string
  /** Which axes scroll. The other axis clips. */
  orientation?: ScrollAreaOrientation
  /** Any CSS length. Omit when a flex or grid parent already bounds the height. */
  maxHeight?: number | string
  /** Any CSS length, for horizontal scrolling inside an unbounded parent. */
  maxWidth?: number | string
  /** Fade the edges that have more content beyond them. */
  fade?: boolean
  /** Length of the fade, in pixels. */
  fadeSize?: number
  /** Merged last, so it wins. */
  className?: string
}

interface ScrollAreaEdges {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

const NONE: ScrollAreaEdges = { top: false, bottom: false, left: false, right: false }

/** One mask gradient per axis; an edge with nothing beyond it stays opaque. */
function edgeMask(start: boolean, end: boolean, size: number, direction: string) {
  const from = start ? 'transparent' : 'black'
  const to = end ? 'transparent' : 'black'
  return `linear-gradient(${direction}, ${from} 0, black ${size}px, black calc(100% - ${size}px), ${to} 100%)`
}

/**
 * A scrolling container that tells you there is more.
 *
 * Operating systems increasingly hide scrollbars until you scroll, so a box
 * cut off at exactly a line break looks finished. The fade answers that: an
 * edge fades only while there is content past it, and stops fading once you
 * reach the end, so the fade itself is the "keep going" signal.
 *
 * The scrollbars are thinned rather than hidden. Hiding them takes away the
 * one control a mouse user without a wheel has.
 *
 * The region is focusable and named, because content that is only text leaves
 * nothing inside to tab to — without a focus stop of its own, the overflow can
 * be reached by pointer and by nothing else.
 */
export function ScrollArea({
  children,
  label,
  orientation = 'vertical',
  maxHeight,
  maxWidth,
  fade = true,
  fadeSize = 28,
  className,
}: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<ScrollAreaEdges>(NONE)

  const measure = useCallback(() => {
    const node = ref.current
    if (!node) return
    // A pixel of slack: fractional zoom leaves scrollTop a hair short of the end.
    const next: ScrollAreaEdges = {
      top: node.scrollTop > 1,
      bottom: node.scrollTop + node.clientHeight < node.scrollHeight - 1,
      left: node.scrollLeft > 1,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
    }
    setEdges((current) =>
      current.top === next.top &&
      current.bottom === next.bottom &&
      current.left === next.left &&
      current.right === next.right
        ? current
        : next,
    )
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node || !fade) return
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // Content that loads late — an image, a fetched list — changes whether
    // there is anything past the edge without a scroll event to say so.
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of Array.from(node.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [fade, measure, children])

  const vertical = orientation !== 'horizontal'
  const horizontal = orientation !== 'vertical'

  const masks: string[] = []
  if (fade && vertical && (edges.top || edges.bottom)) masks.push(edgeMask(edges.top, edges.bottom, fadeSize, 'to bottom'))
  if (fade && horizontal && (edges.left || edges.right)) masks.push(edgeMask(edges.left, edges.right, fadeSize, 'to right'))

  const style: CSSProperties = { maxHeight, maxWidth }
  if (masks.length) {
    style.maskImage = masks.join(', ')
    style.WebkitMaskImage = masks.join(', ')
    if (masks.length > 1) {
      style.maskComposite = 'intersect'
      style.WebkitMaskComposite = 'source-in'
    }
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      onScroll={fade ? measure : undefined}
      style={style}
      className={cn(
        'min-h-0 overscroll-contain',
        vertical ? 'overflow-y-auto' : 'overflow-y-hidden',
        horizontal ? 'overflow-x-auto' : 'overflow-x-hidden',
        '[scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]',
        '[&::-webkit-scrollbar]:size-2 [&::-webkit-scrollbar-track]:bg-transparent',
        '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong',
        'focus-visible:outline-offset-[-2px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
