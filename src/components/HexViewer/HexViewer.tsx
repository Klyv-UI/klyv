'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'

export type HexViewerBytesPerRow = 8 | 16 | 32

/** An inclusive byte range, in buffer offsets. */
export interface HexViewerSelection {
  start: number
  end: number
}

export interface HexViewerProps {
  /** The bytes to show. Never copied, so a large buffer costs only the rows on screen. */
  data: Uint8Array | ArrayBuffer
  /** Accessible name for the byte grid. */
  label: string
  /** Initial bytes per row; the reader can change it. */
  defaultBytesPerRow?: HexViewerBytesPerRow
  /** Visible rows before the grid scrolls. */
  rows?: number
  /** Initial selection. */
  defaultSelection?: HexViewerSelection
  /** Called whenever the selection changes. */
  onSelectionChange?: (selection: HexViewerSelection) => void
  /** Added to every displayed offset — for a slice taken from the middle of a file. */
  baseOffset?: number
  /** Merged last, so it wins. */
  className?: string
}

const ROW_HEIGHT = 22
const OVERSCAN = 6
const WIDTHS: HexViewerBytesPerRow[] = [8, 16, 32]

const hex = (value: number, digits = 2) => value.toString(16).padStart(digits, '0')
const printable = (byte: number) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.')

/** "0x1f", "1f", "31" — hexadecimal when prefixed or when it has a-f, else decimal. */
function parseOffset(text: string): number | null {
  const value = text.trim().toLowerCase()
  if (!value) return null
  const isHex = value.startsWith('0x') || /[a-f]/.test(value)
  const digits = value.replace(/^0x/, '')
  if (!(isHex ? /^[0-9a-f]+$/ : /^\d+$/).test(digits)) return null
  return Number.parseInt(digits, isHex ? 16 : 10)
}

/**
 * Bytes as a reader of binary formats expects them: an offset, a row of hex,
 * and the same bytes as ASCII, with one selection shared by both panes.
 *
 * Only the rows in view are rendered, so a 50 MB capture scrolls like a 50-byte
 * one. The grid is one tab stop with an active cell — arrows walk bytes, Shift
 * extends, Page keys move a screen, Ctrl+Home/End jump to the ends, Ctrl+C copies
 * the selection as hex. Clicking either pane selects in both, because the ASCII
 * column is usually where you spot the string and the hex is where you read it.
 * A small inspector reads the bytes under the cursor as integers, which is most
 * of what people squint at hex to work out.
 */
export function HexViewer({
  data,
  label,
  defaultBytesPerRow = 16,
  rows = 12,
  defaultSelection,
  onSelectionChange,
  baseOffset = 0,
  className,
}: HexViewerProps) {
  const bytes = useMemo(() => (data instanceof Uint8Array ? data : new Uint8Array(data)), [data])
  const id = useId().replace(/:/g, '')
  const scroller = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [perRow, setPerRow] = useState<HexViewerBytesPerRow>(defaultBytesPerRow)
  const [anchor, setAnchor] = useState(defaultSelection?.start ?? 0)
  const [cursor, setCursor] = useState(defaultSelection?.end ?? 0)
  const [scrollTop, setScrollTop] = useState(0)
  const [goTo, setGoTo] = useState('')
  const [goToError, setGoToError] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  const length = bytes.length
  const rowCount = Math.max(1, Math.ceil(length / perRow))
  const digits = Math.max(4, Math.ceil(hex(Math.max(0, baseOffset + length - 1), 1).length / 2) * 2)
  const start = Math.min(anchor, cursor)
  const end = Math.max(anchor, cursor)

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rowCount - 1, Math.floor(scrollTop / ROW_HEIGHT) + rows + OVERSCAN)

  const report = useRef(onSelectionChange)
  report.current = onSelectionChange
  useEffect(() => report.current?.({ start, end }), [start, end])

  // Keep the active byte on screen — the grid scrolls itself, since the rows it
  // would otherwise scroll to may not be rendered yet.
  const reveal = (index: number) => {
    const node = scroller.current
    const row = Math.floor(index / perRow)
    const top = scrollTop / ROW_HEIGHT
    let next = scrollTop
    if (row < top) next = row * ROW_HEIGHT
    else if (row >= top + rows) next = (row - rows + 1) * ROW_HEIGHT
    if (next === scrollTop) return
    if (node) node.scrollTop = next
    setScrollTop(next)
  }

  const moveTo = (index: number, extend: boolean) => {
    if (length === 0) return
    const next = Math.min(length - 1, Math.max(0, index))
    setCursor(next)
    if (!extend) setAnchor(next)
    reveal(next)
  }

  const selectionHex = () =>
    Array.from(bytes.subarray(start, end + 1), (byte) => hex(byte)).join(' ')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selectionHex())
      setCopied(`Copied ${end - start + 1} bytes as hex`)
    } catch {
      setCopied('Copy failed')
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      void copy()
      return
    }
    if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      setAnchor(0)
      setCursor(Math.max(0, length - 1))
      return
    }
    const rowStart = cursor - (cursor % perRow)
    const moves: Record<string, number> = {
      ArrowRight: cursor + 1,
      ArrowLeft: cursor - 1,
      ArrowDown: cursor + perRow,
      ArrowUp: cursor - perRow,
      PageDown: cursor + perRow * rows,
      PageUp: cursor - perRow * rows,
      Home: mod ? 0 : rowStart,
      End: mod ? length - 1 : rowStart + perRow - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    moveTo(moves[event.key], event.shiftKey)
  }

  const onGoTo = (event: FormEvent) => {
    event.preventDefault()
    const offset = parseOffset(goTo)
    const index = offset === null ? null : offset - baseOffset
    if (index === null || index < 0 || index >= length) {
      setGoToError(`Enter an offset from ${hex(baseOffset)} to ${hex(baseOffset + Math.max(0, length - 1))}.`)
      return
    }
    setGoToError(null)
    moveTo(index, false)
    scroller.current?.focus()
  }

  const pointer = (index: number) => ({
    onMouseDown: (event: MouseEvent) => {
      event.preventDefault()
      scroller.current?.focus()
      dragging.current = true
      moveTo(index, event.shiftKey)
    },
    onMouseEnter: (event: MouseEvent) => {
      if (dragging.current && event.buttons === 1) moveTo(index, true)
    },
  })

  useEffect(() => {
    const stop = () => (dragging.current = false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const read = (size: 1 | 2 | 4, signed: boolean) =>
    cursor + size > length
      ? '—'
      : String(
          size === 1
            ? signed ? view.getInt8(cursor) : view.getUint8(cursor)
            : size === 2
              ? signed ? view.getInt16(cursor, true) : view.getUint16(cursor, true)
              : signed ? view.getInt32(cursor, true) : view.getUint32(cursor, true),
        )

  const cell = (index: number) =>
    cn(
      'cursor-default',
      index >= start && index <= end && 'bg-[color-mix(in_oklab,var(--color-accent)_32%,transparent)] text-ink',
      index === cursor && 'outline outline-1 -outline-offset-1 outline-ink',
    )

  const rendered = []
  for (let row = first; row <= last; row += 1) {
    const offset = row * perRow
    const slice = Array.from(bytes.subarray(offset, Math.min(length, offset + perRow)))
    rendered.push(
      <div
        key={row}
        role="row"
        aria-rowindex={row + 1}
        className="absolute inset-x-0 flex items-center gap-4 px-3"
        style={{ top: row * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <span role="rowheader" className="shrink-0 text-ink-faint">
          {hex(baseOffset + offset, digits)}
        </span>
        <span className="flex shrink-0 gap-x-[0.5ch]" role="presentation">
          {slice.map((byte, column) => {
            const index = offset + column
            return (
              <span
                key={column}
                id={`${id}-b${index}`}
                role="gridcell"
                aria-selected={index >= start && index <= end}
                aria-label={`${hex(baseOffset + index, digits)}: ${hex(byte)}`}
                className={cn('rounded-[var(--radius-3)] px-[1px]', column > 0 && column % 8 === 0 && 'ml-[1ch]', cell(index), byte === 0 && 'text-ink-faint')}
                {...pointer(index)}
              >
                {hex(byte)}
              </span>
            )
          })}
        </span>
        <span role="gridcell" aria-label={`ASCII ${slice.map(printable).join('')}`} className="flex shrink-0 border-l border-line pl-4">
          {slice.map((byte, column) => (
            <span key={column} aria-hidden="true" className={cn('w-[1ch] text-center', cell(offset + column), printable(byte) === '.' && 'text-ink-faint')} {...pointer(offset + column)}>
              {printable(byte)}
            </span>
          ))}
        </span>
      </div>,
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-start gap-3">
        <SegmentedControl
          label="Bytes per row"
          size="sm"
          value={String(perRow)}
          onValueChange={(value) => setPerRow(Number(value) as HexViewerBytesPerRow)}
          options={WIDTHS.map((width) => ({ value: String(width), label: String(width) }))}
        />
        <form onSubmit={onGoTo} className="flex items-start gap-2">
          <div className="flex flex-col gap-1">
            <Input
              inputSize="sm"
              aria-label="Go to offset"
              placeholder="Offset, e.g. 0x40"
              value={goTo}
              onChange={(event) => setGoTo(event.target.value)}
              invalid={Boolean(goToError)}
              aria-describedby={goToError ? `${id}-goto` : undefined}
              className="w-40 font-mono"
            />
            {goToError && (
              <Text id={`${id}-goto`} size="caption" tone="danger" role="alert">
                {goToError}
              </Text>
            )}
          </div>
          <Button type="submit" size="sm" variant="muted">
            Go
          </Button>
        </form>
        <Button size="sm" variant="outline" onClick={copy} disabled={length === 0} className="ml-auto">
          Copy as hex
        </Button>
      </div>

      <div
        ref={scroller}
        role="grid"
        tabIndex={0}
        aria-label={label}
        aria-multiselectable="true"
        aria-rowcount={rowCount}
        aria-colcount={perRow + 2}
        aria-activedescendant={length > 0 && cursor >= first * perRow && cursor < (last + 1) * perRow ? `${id}-b${cursor}` : undefined}
        onKeyDown={onKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="relative overflow-auto rounded-[var(--radius-tile)] border border-line bg-surface font-mono text-[12px] leading-none text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        style={{ height: Math.min(rowCount, rows) * ROW_HEIGHT + 16 }}
      >
        <div role="rowgroup" className="relative my-2 min-w-max select-none" style={{ height: rowCount * ROW_HEIGHT }}>
          {length === 0 ? (
            <div role="row">
              <span role="gridcell" className="px-3 text-ink-faint">
                No bytes
              </span>
            </div>
          ) : (
            rendered
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Text size="caption" tone="soft" tabular>
          {length === 0
            ? 'Empty buffer'
            : `Selected ${hex(baseOffset + start, digits)}–${hex(baseOffset + end, digits)} · ${end - start + 1} ${end === start ? 'byte' : 'bytes'} of ${length.toLocaleString()}`}
        </Text>
        {length > 0 && (
          <Text size="caption" tone="faint" tabular className="font-mono">
            {`u8 ${read(1, false)} · i8 ${read(1, true)} · u16le ${read(2, false)} · i16le ${read(2, true)} · u32le ${read(4, false)}`}
          </Text>
        )}
        <span role="status" className="sr-only">
          {copied}
        </span>
      </div>
    </div>
  )
}
