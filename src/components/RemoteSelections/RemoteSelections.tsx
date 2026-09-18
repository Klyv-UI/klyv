'use client'

import { useEffect, useId, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export interface RemoteSelectionsPeer {
  id: string
  name: string
  /** Where their selection started, as a character offset into the text. */
  anchor: number
  /** Where their caret is. Equal to `anchor` for a bare caret. */
  head: number
  /** Override the palette colour, as a token or any CSS colour. */
  color?: string
}

export interface RemoteSelectionsProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange' | 'className'> {
  /** Accessible name for the text field. */
  label: string
  /** Controlled text. */
  value?: string
  /** Initial text, uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every local edit. */
  onValueChange?: (value: string) => void
  /** Everyone else’s carets and selections, as offsets into the current text. */
  peers: RemoteSelectionsPeer[]
  /** Called with the peers’ offsets moved through a local edit, so they can be stored until the next server update. */
  onPeersChange?: (peers: RemoteSelectionsPeer[]) => void
  /** Merged onto the wrapper, last, so it wins. */
  className?: string
  /** Merged onto the textarea. */
  textareaClassName?: string
}

/** Palette colour and the ink that reads on it, walking the chart series order. */
const PALETTE = [
  { fill: 'var(--color-accent-strong)', ink: 'var(--color-accent-ink)' },
  { fill: 'var(--color-ink)', ink: 'var(--color-ink-inverse)' },
  { fill: 'var(--color-success)', ink: 'var(--color-ink-inverse)' },
  { fill: 'var(--color-warning)', ink: 'var(--color-accent-ink)' },
  { fill: 'var(--color-danger)', ink: 'var(--color-ink-inverse)' },
]

const ZERO_WIDTH = String.fromCharCode(0x200b)

/** Styles the mirror has to share with the textarea for text to wrap at exactly the same places. */
const MIRRORED = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontFeatureSettings', 'letterSpacing', 'wordSpacing',
  'lineHeight', 'textTransform', 'textIndent', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'direction', 'textAlign',
] as const

interface RemoteSelectionsBox {
  left: number
  top: number
  width: number
  height: number
}

interface RemoteSelectionsMeasure {
  caret: RemoteSelectionsBox
  ranges: RemoteSelectionsBox[]
}

/**
 * Where a local edit moves an offset. The edit is recovered as the common prefix and suffix of the old and new text:
 * offsets before it stay, offsets after it shift by the change in length, and offsets inside deleted text collapse
 * to where the deletion happened.
 */
function transformOffset(offset: number, before: string, after: string): number {
  let start = 0
  const shortest = Math.min(before.length, after.length)
  while (start < shortest && before[start] === after[start]) start += 1
  let end = 0
  while (end < shortest - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1
  const removedEnd = before.length - end
  const inserted = after.length - end - start
  if (offset <= start) return offset
  if (offset >= removedEnd) return offset + (after.length - before.length)
  return start + inserted
}

/**
 * Measure caret and range rectangles for a textarea with a hidden mirror div: the same width, font, padding and
 * wrapping, the text up to the range, then a span holding the range. The span’s client rects are the line fragments.
 */
function measure(textarea: HTMLTextAreaElement, mirror: HTMLDivElement, text: string, from: number, to: number): RemoteSelectionsMeasure {
  const style = getComputedStyle(textarea)
  for (const key of MIRRORED) mirror.style[key] = style[key]
  mirror.style.width = `${textarea.clientWidth}px`
  const start = Math.max(0, Math.min(from, to, text.length))
  const end = Math.min(text.length, Math.max(from, to))
  mirror.textContent = text.slice(0, start)
  const marker = document.createElement('span')
  // A zero-width space keeps an empty range measurable, and the trailing text keeps wrapping identical.
  marker.textContent = text.slice(start, end) || ZERO_WIDTH
  mirror.append(marker, document.createTextNode(text.slice(end) + ZERO_WIDTH))
  const origin = mirror.getBoundingClientRect()
  const rects = Array.from(marker.getClientRects())
  const toBox = (rect: DOMRect) => ({
    left: rect.left - origin.left - textarea.scrollLeft,
    top: rect.top - origin.top - textarea.scrollTop,
    width: rect.width,
    height: rect.height,
  })
  const ranges = start === end ? [] : rects.filter((rect) => rect.width > 0).map(toBox)
  // The caret sits at the head: the end of the last fragment when the head is at the end, else the start of the first.
  const headAtEnd = to >= from
  const edge = headAtEnd ? rects[rects.length - 1] : rects[0]
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4
  const caret = edge
    ? { ...toBox(edge), left: toBox(edge).left + (headAtEnd && start !== end ? edge.width : 0), width: 2, height: edge.height || lineHeight }
    : { left: 0, top: 0, width: 2, height: lineHeight }
  return { caret, ranges }
}

const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length

/**
 * Other people’s carets and selections, drawn inside an ordinary textarea from nothing but character offsets.
 *
 * A textarea cannot tell you where character 212 is on screen, so the positions come from a mirror: an invisible div
 * with the same width, font, padding and wrapping, holding the text up to the selection and then a span around it.
 * The span’s client rects are exactly the line fragments a selection covers, which is what a multi-line highlight
 * needs. Everything is re-measured when the text changes, the field scrolls or resizes, or the fonts finish loading.
 *
 * Offsets from the server are only correct for the text the server saw. When you type before someone’s caret, their
 * caret has to move with the text or it drifts onto the wrong word, so each local edit is diffed and every peer offset
 * is moved through it — and handed back through `onPeersChange` — until the next update arrives. The overlay is hidden
 * from assistive technology; a text summary of who is where is attached as the field’s description instead.
 */
export function RemoteSelections({
  label,
  value,
  defaultValue = '',
  onValueChange,
  peers,
  onPeersChange,
  className,
  textareaClassName,
  rows = 8,
  ...rest
}: RemoteSelectionsProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const summaryId = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const text = value ?? uncontrolled
  const [local, setLocal] = useState(peers)
  const [boxes, setBoxes] = useState<Record<string, RemoteSelectionsMeasure>>({})
  const [frame, setFrame] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [tick, setTick] = useState(0)

  // A server update replaces whatever the local transform had worked out. Compared by content, so a parent that
  // rebuilds the same array on every render does not undo the transform.
  const peerKey = JSON.stringify(peers)
  useEffect(() => setLocal(JSON.parse(peerKey) as RemoteSelectionsPeer[]), [peerKey])

  const onChange = (next: string) => {
    const moved = local.map((peer) => ({
      ...peer,
      anchor: transformOffset(peer.anchor, text, next),
      head: transformOffset(peer.head, text, next),
    }))
    setLocal(moved)
    onPeersChange?.(moved)
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current
    const mirror = mirrorRef.current
    if (!textarea || !mirror) return
    const next: Record<string, RemoteSelectionsMeasure> = {}
    for (const peer of local) next[peer.id] = measure(textarea, mirror, text, peer.anchor, peer.head)
    mirror.textContent = ''
    setBoxes(next)
    const style = getComputedStyle(textarea)
    setFrame({
      top: parseFloat(style.borderTopWidth) || 0,
      left: parseFloat(style.borderLeftWidth) || 0,
      width: textarea.clientWidth,
      height: textarea.clientHeight,
    })
  }, [local, text, tick])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const remeasure = () => setTick((value) => value + 1)
    textarea.addEventListener('scroll', remeasure, { passive: true })
    const observer = new ResizeObserver(remeasure)
    observer.observe(textarea)
    void document.fonts?.ready.then(remeasure)
    return () => {
      textarea.removeEventListener('scroll', remeasure)
      observer.disconnect()
    }
  }, [])

  const summary = local.length
    ? local
        .map((peer) => {
          const line = lineOf(text, peer.head)
          const span = Math.abs(peer.head - peer.anchor)
          return span ? `${peer.name} has ${span} characters selected, ending on line ${line}` : `${peer.name} is on line ${line}`
        })
        .join('. ')
    : 'Nobody else is editing.'

  return (
    <div className={cn('relative w-full', className)}>
      <textarea
        {...rest}
        ref={textareaRef}
        rows={rows}
        aria-label={label}
        aria-describedby={[rest['aria-describedby'], summaryId].filter(Boolean).join(' ')}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'block w-full resize-y rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-[14px] leading-6 text-ink',
          'placeholder:text-ink-faint',
          textareaClassName,
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute overflow-hidden"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
      >
        {local.map((peer, index) => {
          const box = boxes[peer.id]
          if (!box) return null
          const swatch = peer.color ? { fill: peer.color, ink: 'var(--color-ink-inverse)' } : PALETTE[index % PALETTE.length]!
          const flagBelow = box.caret.top < 18
          return (
            <div key={peer.id}>
              {box.ranges.map((range, rangeIndex) => (
                <span
                  key={rangeIndex}
                  className="absolute rounded-[var(--radius-2)]"
                  style={{
                    ...range,
                    background: `color-mix(in oklab, ${swatch.fill} 28%, transparent)`,
                  }}
                />
              ))}
              <span
                className="absolute motion-safe:transition-[left,top] motion-safe:duration-100"
                style={{ left: box.caret.left - 1, top: box.caret.top, width: 2, height: box.caret.height, background: swatch.fill }}
              >
                <span
                  className="absolute left-0 whitespace-nowrap rounded-[var(--radius-4)] px-1.5 py-px text-[10px] font-bold leading-4"
                  style={{
                    background: swatch.fill,
                    color: swatch.ink,
                    ...(flagBelow ? { top: '100%', borderTopLeftRadius: 0 } : { bottom: '100%', borderBottomLeftRadius: 0 }),
                  }}
                >
                  {peer.name}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:break-word]"
      />
      <span id={summaryId} className="sr-only">
        {summary}
      </span>
    </div>
  )
}
