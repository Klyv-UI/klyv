'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Slider } from '../Slider'
import { Text } from '../Text'

export interface GameOfLifeProps {
  /** Cells across. */
  columns?: number
  /** Cells down. */
  rows?: number
  /** Share of cells alive after randomising, 0 to 1. */
  density?: number
  /** Generations per second when the board first renders. The slider changes it after that. */
  defaultSpeed?: number
  /** Start running on mount. Ignored under reduced motion, where the board waits for Play. */
  autoPlay?: boolean
  /** Edges wrap round to the opposite side, so gliders do not die at the border. */
  wrap?: boolean
  /** Accessible name for the board. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

function randomBoard(size: number, density: number) {
  const cells = new Uint8Array(size)
  for (let i = 0; i < size; i += 1) cells[i] = Math.random() < density ? 1 : 0
  return cells
}

/** Reads a colour token off the element, so the board follows the theme and the preset. */
function token(element: Element, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

/**
 * Conway’s Game of Life on a canvas: play, pause, step, clear, randomise, and
 * draw your own cells.
 *
 * The board lives in a typed array outside React, and only the generation
 * count goes through state — a 48 × 28 board is 1,344 cells, and diffing that
 * many elements ten times a second is work the canvas does not need. Colours
 * are read from the tokens each frame, so switching theme or accent repaints
 * without a remount.
 *
 * It stops itself when scrolled out of view, and under reduced motion it starts
 * paused so the only movement is movement the reader asked for. The board is
 * one tab stop: arrows move a cell cursor, Space or Enter toggles the cell, and
 * the cursor position and cell state are announced.
 */
export function GameOfLife({
  columns = 48,
  rows = 28,
  density = 0.28,
  defaultSpeed = 10,
  autoPlay = true,
  wrap = true,
  label = 'Game of Life board',
  className,
}: GameOfLifeProps) {
  const reducedMotion = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cells = useRef<Uint8Array>(new Uint8Array(columns * rows))
  const [generation, setGeneration] = useState(0)
  const [population, setPopulation] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(defaultSpeed)
  const [visible, setVisible] = useState(true)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [message, setMessage] = useState('')
  const painting = useRef<0 | 1 | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const box = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.round(box.width * dpr)
    const height = Math.round(box.height * dpr)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const cell = width / columns
    const cellHeight = height / rows
    context.fillStyle = token(canvas, '--color-surface-sunken', 'Canvas')
    context.fillRect(0, 0, width, height)
    context.strokeStyle = token(canvas, '--color-line', 'GrayText')
    context.lineWidth = 1
    context.beginPath()
    for (let x = 1; x < columns; x += 1) {
      context.moveTo(Math.round(x * cell) + 0.5, 0)
      context.lineTo(Math.round(x * cell) + 0.5, height)
    }
    for (let y = 1; y < rows; y += 1) {
      context.moveTo(0, Math.round(y * cellHeight) + 0.5)
      context.lineTo(width, Math.round(y * cellHeight) + 0.5)
    }
    context.stroke()
    context.fillStyle = token(canvas, '--color-accent-strong', 'Highlight')
    const inset = Math.max(1, cell * 0.1)
    for (let y = 0; y < rows; y += 1)
      for (let x = 0; x < columns; x += 1)
        if (cells.current[y * columns + x])
          context.fillRect(x * cell + inset, y * cellHeight + inset, cell - inset * 2, cellHeight - inset * 2)
    if (cursor) {
      context.strokeStyle = token(canvas, '--color-focus', 'CanvasText')
      context.lineWidth = Math.max(2, dpr * 2)
      context.strokeRect(cursor.x * cell + 1, cursor.y * cellHeight + 1, cell - 2, cellHeight - 2)
    }
  }, [columns, rows, cursor])

  const count = () => cells.current.reduce((sum, value) => sum + value, 0)

  const step = useCallback(() => {
    const current = cells.current
    const next = new Uint8Array(current.length)
    for (let y = 0; y < rows; y += 1)
      for (let x = 0; x < columns; x += 1) {
        let neighbours = 0
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue
            let nx = x + dx
            let ny = y + dy
            if (wrap) {
              nx = (nx + columns) % columns
              ny = (ny + rows) % rows
            } else if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue
            neighbours += current[ny * columns + nx]
          }
        const alive = current[y * columns + x]
        next[y * columns + x] = neighbours === 3 || (alive && neighbours === 2) ? 1 : 0
      }
    cells.current = next
    setGeneration((value) => value + 1)
    setPopulation(next.reduce((sum, value) => sum + value, 0))
  }, [columns, rows, wrap])

  const randomise = () => {
    cells.current = randomBoard(columns * rows, density)
    setGeneration(0)
    setPopulation(count())
    draw()
  }
  const clear = () => {
    cells.current = new Uint8Array(columns * rows)
    setPlaying(false)
    setGeneration(0)
    setPopulation(0)
    draw()
  }

  // A fresh board whenever its size changes; on mount, run unless motion is reduced.
  useEffect(() => {
    cells.current = randomBoard(columns * rows, density)
    setGeneration(0)
    setPopulation(cells.current.reduce((sum, value) => sum + value, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows])

  useEffect(() => {
    setPlaying(autoPlay && !reducedMotion)
  }, [autoPlay, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (now - last >= 1000 / speed) {
        last = now
        step()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, visible, speed, step])

  useEffect(() => {
    draw()
  }, [draw, generation])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  const toggle = (x: number, y: number, value?: 0 | 1) => {
    const index = y * columns + x
    const next = value ?? (cells.current[index] ? 0 : 1)
    if (cells.current[index] === next) return next
    cells.current[index] = next
    setPopulation(count())
    draw()
    return next
  }

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - box.left) / (box.width || 1)) * columns)
    const y = Math.floor(((event.clientY - box.top) / (box.height || 1)) * rows)
    return x >= 0 && y >= 0 && x < columns && y < rows ? { x, y } : null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const at = cursor ?? { x: 0, y: 0 }
    const moves: Record<string, { x: number; y: number }> = {
      ArrowRight: { x: Math.min(columns - 1, at.x + 1), y: at.y },
      ArrowLeft: { x: Math.max(0, at.x - 1), y: at.y },
      ArrowDown: { x: at.x, y: Math.min(rows - 1, at.y + 1) },
      ArrowUp: { x: at.x, y: Math.max(0, at.y - 1) },
      Home: { x: 0, y: at.y },
      End: { x: columns - 1, y: at.y },
    }
    if (moves[event.key]) {
      event.preventDefault()
      const next = cursor ? moves[event.key] : at
      setCursor(next)
      setMessage(
        `Row ${next.y + 1}, column ${next.x + 1}, ${cells.current[next.y * columns + next.x] ? 'alive' : 'empty'}`,
      )
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      const alive = toggle(at.x, at.y)
      setCursor(at)
      setMessage(`Row ${at.y + 1}, column ${at.x + 1}, ${alive ? 'alive' : 'empty'}`)
    } else if (event.key === 'Escape' && cursor) {
      event.preventDefault()
      setCursor(null)
    }
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <canvas
        ref={canvasRef}
        role="application"
        aria-roledescription="cell board"
        aria-label={`${label}, ${columns} by ${rows}. Arrow keys move the cursor; Space toggles a cell.`}
        tabIndex={0}
        className="block w-full touch-none cursor-crosshair rounded-[var(--radius-tile)] border border-line outline-offset-2"
        style={{ aspectRatio: `${columns} / ${rows}` }}
        onKeyDown={onKeyDown}
        onBlur={() => setCursor(null)}
        onPointerDown={(event) => {
          const at = cellAt(event)
          if (!at) return
          event.currentTarget.setPointerCapture?.(event.pointerId)
          painting.current = toggle(at.x, at.y)
        }}
        onPointerMove={(event) => {
          const at = cellAt(event)
          if (at && painting.current !== null) toggle(at.x, at.y, painting.current)
        }}
        onPointerUp={() => {
          painting.current = null
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="muted" onClick={step} disabled={playing}>
          Step
        </Button>
        <Button size="sm" variant="muted" onClick={randomise}>
          Randomise
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
        <label className="ml-auto flex min-w-[160px] items-center gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Speed
          </Text>
          <Slider
            value={speed}
            min={1}
            max={30}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-valuetext={`${speed} generations per second`}
            className="w-28"
          />
        </label>
      </div>

      <div className="flex gap-4">
        <Text as="span" size="caption" weight="medium" tone="faint" tabular>
          Generation <span className="font-bold text-ink">{generation}</span>
        </Text>
        <Text as="span" size="caption" weight="medium" tone="faint" tabular>
          Alive <span className="font-bold text-ink">{population}</span>
        </Text>
        {playing && !visible && (
          <Text as="span" size="caption" weight="medium" tone="faint">
            Paused while off screen
          </Text>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
    </div>
  )
}
