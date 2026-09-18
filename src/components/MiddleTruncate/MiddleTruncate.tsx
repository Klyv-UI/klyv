'use client'

import { useRef, useState, type ClipboardEvent, type ElementType } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export interface MiddleTruncateProps {
  /** The full string. Always what assistive technology reads and what copying yields. */
  text: string
  /**
   * Characters always kept at the end. `'extension'` keeps the file extension plus
   * the few characters before it — `…-final.pdf`. A number keeps exactly that many.
   */
  keepEnd?: number | 'extension'
  /** What stands in for the cut. */
  ellipsis?: string
  /** Element to render. */
  as?: ElementType
  /** Merged onto the element. Set the font here; it is what gets measured. */
  className?: string
}

const EXTENSION = /\.[a-z0-9]{1,8}$/i

function tailLength(text: string, keepEnd: MiddleTruncateProps['keepEnd']) {
  if (typeof keepEnd === 'number') return Math.max(0, Math.min(text.length, keepEnd))
  const match = text.match(EXTENSION)
  return match ? Math.min(text.length, match[0].length + 4) : 0
}

let canvas: HTMLCanvasElement | null = null
function measurer() {
  if (typeof document === 'undefined') return null
  canvas ??= document.createElement('canvas')
  return canvas.getContext('2d')
}

/** The shorthand is empty in some engines, so build it from the longhands. */
function fontOf(style: CSSStyleDeclaration) {
  return style.font || `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}

/**
 * A long string that keeps both ends when it does not fit.
 *
 * End-truncation hides exactly the part that tells file names, branches and
 * IDs apart: `quarterly-report-2024-…` twice in a row is two identical rows.
 * This cuts the middle instead and always keeps the tail — by default the file
 * extension and a few characters before it — so `quarterly-re…v3-final.pdf`
 * stays distinguishable from its neighbours.
 *
 * The cut is computed, not guessed: the element’s own computed font is
 * measured on a canvas and a binary search finds the longest string that fits
 * the measured width, redone whenever the width changes or fonts finish
 * loading. The visible text is hidden from assistive technology and the full
 * value is read instead; it is also the tooltip and what the clipboard gets
 * when the text is copied. Without canvas, it falls back to an ordinary end
 * ellipsis in CSS.
 */
export function MiddleTruncate({ text, keepEnd = 'extension', ellipsis = '…', as: Tag = 'span', className }: MiddleTruncateProps) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState<string | null>(null)

  useIsomorphicLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0

    const fit = () => {
      const context = measurer()
      const style = getComputedStyle(node)
      const width = node.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (!context || width <= 0) {
        setShown(null)
        return
      }
      context.font = fontOf(style)
      const spacing = parseFloat(style.letterSpacing) || 0
      const measure = (value: string) => context.measureText(value).width + spacing * value.length

      if (measure(text) <= width) {
        setShown(text)
        return
      }
      const tail = tailLength(text, keepEnd)
      const build = (count: number) => {
        const end = Math.min(count, Math.max(tail, Math.floor(count / 2)))
        return text.slice(0, count - end) + ellipsis + (end > 0 ? text.slice(text.length - end) : '')
      }
      let low = 0
      let high = text.length - 1
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (measure(build(mid)) <= width) low = mid
        else high = mid - 1
      }
      setShown(build(low))
    }

    fit()
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(node)
    let live = true
    document.fonts?.ready.then(() => live && fit())
    return () => {
      live = false
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [text, keepEnd, ellipsis])

  // Whatever part of the cut string was selected, the clipboard gets the real value.
  const onCopy = (event: ClipboardEvent) => {
    const node = ref.current
    const selection = window.getSelection()
    if (!node || !selection || !node.contains(selection.anchorNode) || !node.contains(selection.focusNode)) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', text)
  }

  const truncated = shown !== null && shown !== text

  return (
    <Tag
      ref={ref}
      title={truncated ? text : undefined}
      onCopy={onCopy}
      className={cn(
        'block min-w-0 max-w-full overflow-hidden whitespace-nowrap',
        shown === null && 'text-ellipsis',
        className,
      )}
    >
      <span aria-hidden="true">{shown ?? text}</span>
      <span className="sr-only">{text}</span>
    </Tag>
  )
}
