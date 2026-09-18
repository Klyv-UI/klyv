'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { onThemeChange } from '../../theme'
import { firstFit, knuthPlass, type JustifiedTextLine } from './linebreak'

export type JustifiedTextAlgorithm = 'optimal' | 'greedy'

export interface JustifiedTextProps {
  /** The paragraph. Whitespace is collapsed, as in HTML. */
  children: string
  /** `optimal` is Knuth–Plass; `greedy` is first-fit, as browsers justify. Useful for comparison. */
  algorithm?: JustifiedTextAlgorithm
  /** Allow breaks inside words at hyphenation points. Only the optimal breaker hyphenates. */
  hyphenate?: boolean
  /** Liang patterns, whitespace-separated, to replace the compact English set. */
  patterns?: string
  /** How loose a line the first pass accepts (Knuth’s tolerance). Looser passes follow if nothing fits. */
  tolerance?: number
  /** Called after every layout with the lines chosen. */
  onLayout?: (lines: JustifiedTextLine[]) => void
  /** Show each line’s stretch as a faint bar in the margin. */
  showRatios?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function fontOf(element: Element) {
  const style = getComputedStyle(element)
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}

/**
 * A justified paragraph without rivers.
 *
 * Browsers justify one line at a time: fill it, stretch what is there, move
 * on — so one long word can leave a line of gaping spaces. This measures every
 * word with the element’s own font and runs Knuth and Plass’s total-fit search
 * over the whole paragraph, with Liang hyphenation offering breaks inside
 * words, and picks the set of breaks whose worst lines are least bad. It lays
 * out again when the width, the theme font or a web font changes.
 *
 * The drawn lines are hidden from assistive technology and the plain text is
 * read instead, so a hyphen added for layout is never spoken. Where there is
 * no canvas to measure with, it falls back to the browser’s own justification.
 */
export function JustifiedText({
  children,
  algorithm = 'optimal',
  hyphenate = true,
  patterns,
  tolerance,
  onLayout,
  showRatios = false,
  className,
}: JustifiedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [layout, setLayout] = useState<{ lines: JustifiedTextLine[]; space: number } | null>(null)
  const [revision, setRevision] = useState(0)
  const onLayoutRef = useRef(onLayout)
  onLayoutRef.current = onLayout

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const bump = () => setRevision((value) => value + 1)
    let lastWidth = -1
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      if (width !== lastWidth) {
        lastWidth = width
        bump()
      }
    })
    observer.observe(element)
    const offTheme = onThemeChange(bump)
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.addEventListener?.('loadingdone', bump)
    return () => {
      observer.disconnect()
      offTheme()
      fonts?.removeEventListener?.('loadingdone', bump)
    }
  }, [])

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    const context = element ? document.createElement('canvas').getContext('2d') : null
    const width = element ? element.clientWidth - parseFloat(getComputedStyle(element).paddingLeft || '0') - parseFloat(getComputedStyle(element).paddingRight || '0') : 0
    if (!element || !context || width <= 0) {
      setLayout(null)
      return
    }
    context.font = fontOf(element)
    const cache = new Map<string, number>()
    const measure = (text: string) => {
      let w = cache.get(text)
      if (w === undefined) cache.set(text, (w = context.measureText(text).width))
      return w
    }
    // A hair under the box, so sub-pixel rounding in the DOM never wraps a line.
    const target = width - 0.5
    const lines = algorithm === 'greedy' ? firstFit(children, measure, target) : knuthPlass(children, measure, target, { hyphenate, patterns, tolerance })
    setLayout({ lines, space: measure(' ') })
    onLayoutRef.current?.(lines)
  }, [children, algorithm, hyphenate, patterns, tolerance, revision])

  return (
    <p ref={ref} className={cn('relative font-sans text-[14px] leading-[1.6] text-ink', !layout && 'text-justify', className)} data-layout={layout ? algorithm : 'native'}>
      {layout ? (
        <>
          <span className="sr-only">{children}</span>
          <span aria-hidden="true" className="block">
            {layout.lines.map((line, index) => (
              <span
                key={index}
                className={cn('relative flex whitespace-nowrap', line.last || line.words.length < 2 ? 'justify-start' : 'justify-between')}
                style={line.last ? { gap: layout.space } : undefined}
              >
                {showRatios && (
                  <span
                    className={cn(
                      'absolute -left-3 top-1/2 h-[70%] w-1 -translate-y-1/2 rounded-full',
                      line.last ? 'bg-transparent' : Math.abs(line.ratio) > 1 ? 'bg-danger' : Math.abs(line.ratio) > 0.5 ? 'bg-warning' : 'bg-success',
                    )}
                    style={{ opacity: line.last ? 0 : 0.35 + Math.min(1, Math.abs(line.ratio)) * 0.65 }}
                  />
                )}
                {line.words.map((word, at) => (
                  <span key={at}>{word}</span>
                ))}
              </span>
            ))}
          </span>
        </>
      ) : (
        children
      )}
    </p>
  )
}
