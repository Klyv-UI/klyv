'use client'

import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface PixelCanvasProps {
  /** Grid size. Square. */
  grid?: number
  /** Available colours. The first is the eraser. */
  palette?: string[]
  /** Rendered cell size in pixels. */
  cell?: number
  /** Called on every change, with a flat array of palette indices. */
  onChange?: (pixels: number[]) => void
  /** Starting artwork, as a flat array of palette indices. */
  value?: number[]
  /** Merged last, so it wins. */
  className?: string
}

const PALETTE = [
  'transparent',
  '#17191c',
  '#ffffff',
  '#e5484d',
  '#f5a524',
  '#c8f24e',
  '#3f9b4a',
  '#22d3ee',
  '#3b82f6',
  '#8b5cf6',
  '#f472b6',
  '#a16207',
]

/**
 * A grid you draw on, one cell at a time.
 *
 * Drawing is pointer-captured and interpolated between samples. Painting only
 * the cell under each `pointermove` leaves gaps the moment the hand moves
 * faster than the event rate — a fast diagonal turns into a dotted line — so
 * every move walks a straight line from the previous cell to the current one
 * and fills what it crosses.
 *
 * The art is a flat array of palette *indices*, not colours. That makes an
 * undo cheap, a palette swap free, and the whole drawing serialisable to a
 * short string — a 16×16 sprite is 256 small integers rather than 256 hex
 * codes.
 *
 * The grid is a real grid of buttons, so it can be drawn on with a keyboard as
 * well: arrows move, space fills. A canvas would have been fewer lines and
 * completely unusable without a pointer.
 */
export function PixelCanvas({
  grid = 16,
  palette = PALETTE,
  cell = 20,
  onChange,
  value,
  className,
}: PixelCanvasProps) {
  const [pixels, setPixels] = useState<number[]>(
    () => value ?? Array.from({ length: grid * grid }, () => 0),
  )
  const [colour, setColour] = useState(1)
  const [history, setHistory] = useState<number[][]>([])
  const drawing = useRef(false)
  const lastCell = useRef<number | null>(null)

  const art = value ?? pixels

  const commit = (next: number[]) => {
    if (value === undefined) setPixels(next)
    onChange?.(next)
  }

  const paintLine = (from: number | null, to: number) => {
    const next = art.slice()
    if (from === null || from === to) {
      next[to] = colour
    } else {
      // Walk the line: a fast diagonal otherwise draws as dots.
      const x0 = from % grid
      const y0 = Math.floor(from / grid)
      const x1 = to % grid
      const y1 = Math.floor(to / grid)
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let i = 0; i <= steps; i += 1) {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps)
        const y = Math.round(y0 + ((y1 - y0) * i) / steps)
        next[y * grid + x] = colour
      }
    }
    lastCell.current = to
    commit(next)
  }

  const start = (index: number) => {
    setHistory((current) => [...current.slice(-24), art])
    drawing.current = true
    lastCell.current = null
    paintLine(null, index)
  }

  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    commit(previous)
  }

  const clear = () => {
    setHistory((current) => [...current, art])
    commit(Array.from({ length: grid * grid }, () => 0))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="group"
        aria-label="Pixel canvas"
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerLeave={() => {
          drawing.current = false
        }}
        className="inline-grid w-fit overflow-hidden rounded-[var(--radius-tile)] border border-line"
        style={{
          gridTemplateColumns: `repeat(${grid}, ${cell}px)`,
          // The chequerboard shows through wherever a cell is transparent.
          backgroundImage:
            'linear-gradient(45deg,#eceeea 25%,transparent 25%,transparent 75%,#eceeea 75%),linear-gradient(45deg,#eceeea 25%,transparent 25%,transparent 75%,#eceeea 75%)',
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `0 0, ${cell / 2}px ${cell / 2}px`,
          backgroundColor: '#ffffff',
        }}
      >
        {art.map((index, position) => (
          <button
            key={position}
            type="button"
            aria-label={`Cell ${(position % grid) + 1}, ${Math.floor(position / grid) + 1}`}
            onPointerDown={(event) => {
              event.currentTarget.releasePointerCapture?.(event.pointerId)
              start(position)
            }}
            onPointerEnter={() => {
              if (drawing.current) paintLine(lastCell.current, position)
            }}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                start(position)
              }
            }}
            className="border-0 outline-offset-[-2px]"
            style={{
              width: cell,
              height: cell,
              background: palette[index] ?? 'transparent',
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((entry, index) => (
          <button
            key={index}
            type="button"
            aria-label={index === 0 ? 'Eraser' : `Colour ${index}`}
            aria-pressed={colour === index}
            onClick={() => setColour(index)}
            className={cn(
              'h-6 w-6 rounded-[var(--radius-6)] border transition-transform hover:scale-110',
              colour === index ? 'border-ink ring-2 ring-ink/20' : 'border-black/10',
              index === 0 && 'bg-[repeating-conic-gradient(#eceeea_0_25%,#ffffff_0_50%)] bg-[length:8px_8px]',
            )}
            style={index === 0 ? undefined : { background: entry }}
          />
        ))}

        <span className="ml-2 flex items-center gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Clear
          </button>
        </span>
      </div>

      <Text size="caption" tone="faint">
        {grid} × {grid} · {art.filter((index) => index !== 0).length} pixels filled
      </Text>

      <VisuallyHidden>
        Drag to draw. Tab to a cell and press space to fill it with the selected colour.
      </VisuallyHidden>
    </div>
  )
}
