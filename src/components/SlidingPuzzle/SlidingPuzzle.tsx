'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'

export interface SlidingPuzzleResult {
  moves: number
  seconds: number
}

export interface SlidingPuzzleProps {
  /** Tiles per side. 4 is the classic fifteen puzzle. */
  size?: number
  /** Paint a generated picture across the tiles instead of plain numbers. The numbers stay, small, as a guide. */
  imageTiles?: boolean
  /** Called when the tiles are back in order. */
  onSolve?: (result: SlidingPuzzleResult) => void
  /** Accessible name for the board. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const solvedBoard = (size: number) => Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size))

/**
 * Half of all arrangements cannot be solved. For an odd width the inversion
 * count must be even; for an even width, the inversions plus the blank’s row
 * counted from the bottom must be odd.
 */
function solvable(tiles: number[], size: number) {
  const numbers = tiles.filter(Boolean)
  let inversions = 0
  for (let i = 0; i < numbers.length; i += 1) for (let j = i + 1; j < numbers.length; j += 1) if (numbers[i] > numbers[j]) inversions += 1
  if (size % 2 === 1) return inversions % 2 === 0
  const blankFromBottom = size - Math.floor(tiles.indexOf(0) / size)
  return (inversions + blankFromBottom) % 2 === 1
}

function shuffle(size: number): number[] {
  const tiles = solvedBoard(size)
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[tiles[index], tiles[swap]] = [tiles[swap], tiles[index]]
  }
  if (!solvable(tiles, size)) {
    // Swapping any two numbered tiles flips the parity, which makes it solvable.
    const [a, b] = tiles.map((tile, index) => (tile ? index : -1)).filter((index) => index >= 0)
    ;[tiles[a], tiles[b]] = [tiles[b], tiles[a]]
  }
  return tiles.every((tile, index) => tile === solvedBoard(size)[index]) ? shuffle(size) : tiles
}

/** Paints an abstract picture from the colour tokens, so image mode follows the theme and needs no asset. */
function paint(element: Element): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 480
  const context = canvas.getContext('2d')
  if (!context) return null
  const style = getComputedStyle(element)
  const token = (name: string) => style.getPropertyValue(name).trim() || 'gray'
  const ground = context.createLinearGradient(0, 0, 480, 480)
  ground.addColorStop(0, token('--color-accent-soft'))
  ground.addColorStop(1, token('--color-accent-strong'))
  context.fillStyle = ground
  context.fillRect(0, 0, 480, 480)
  context.fillStyle = token('--color-ink')
  context.beginPath()
  context.arc(330, 150, 88, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = token('--color-surface')
  for (let ring = 0; ring < 7; ring += 1) {
    context.globalAlpha = 0.55 - ring * 0.06
    context.beginPath()
    context.ellipse(150, 340, 150 - ring * 18, 70 - ring * 8, -0.4, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
  context.strokeStyle = token('--color-ink')
  context.lineWidth = 10
  context.beginPath()
  for (let x = 0; x <= 480; x += 12) context.lineTo(x, 400 + Math.sin(x / 34) * 26)
  context.stroke()
  return canvas.toDataURL()
}

/**
 * The fifteen puzzle, at any size: slide the tiles back into order through the
 * one gap.
 *
 * Shuffles are random but always solvable — half of all arrangements are not,
 * and a puzzle that cannot be finished is a trap, not a challenge — so the
 * parity is checked and corrected before the board is dealt. Clicking a tile in
 * line with the gap slides the whole run towards it, as a physical puzzle does.
 *
 * The board is one tab stop: an arrow key moves the tile on that side of the gap
 * into it, and each move is announced with the count. Tiles glide under normal
 * motion and jump under reduced motion. Image mode paints a picture from the
 * colour tokens on a canvas, so it needs no asset and follows the theme.
 */
export function SlidingPuzzle({ size = 4, imageTiles = false, onSolve, label = 'Sliding puzzle', className }: SlidingPuzzleProps) {
  const [tiles, setTiles] = useState(() => solvedBoard(size))
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [started, setStarted] = useState(false)
  const [picture, setPicture] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)

  const solved = tiles.every((tile, index) => tile === (index + 1) % (size * size))

  const restart = useCallback(() => {
    setTiles(shuffle(size))
    setMoves(0)
    setSeconds(0)
    setStarted(false)
    setMessage('Shuffled.')
  }, [size])

  useEffect(() => restart(), [restart])

  useEffect(() => {
    if (imageTiles && boardRef.current) setPicture(paint(boardRef.current))
  }, [imageTiles])

  useEffect(() => {
    if (!started || solved) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [started, solved])

  const slide = (index: number) => {
    if (solved && started) return
    const blank = tiles.indexOf(0)
    const [row, col] = [Math.floor(index / size), index % size]
    const [blankRow, blankCol] = [Math.floor(blank / size), blank % size]
    if (index === blank || (row !== blankRow && col !== blankCol)) return setMessage('That tile is not in line with the gap.')
    // Every tile between the clicked one and the gap moves one step towards the gap.
    const step = row === blankRow ? (col < blankCol ? -1 : 1) : col === blankCol ? (row < blankRow ? -size : size) : 0
    const next = tiles.slice()
    let at = blank
    let count = 0
    while (at !== index) {
      next[at] = next[at + step]
      at += step
      count += 1
    }
    next[index] = 0
    const direction = step === -1 ? 'right' : step === 1 ? 'left' : step < 0 ? 'down' : 'up'
    const total = moves + count
    setTiles(next)
    setMoves(total)
    setStarted(true)
    const done = next.every((tile, position) => tile === (position + 1) % (size * size))
    if (done) {
      setMessage(`Solved in ${total} moves.`)
      onSolve?.({ moves: total, seconds })
    } else setMessage(`${count === 1 ? `Tile ${tiles[index]}` : `${count} tiles`} moved ${direction}. ${total} moves.`)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const blank = tiles.indexOf(0)
    const [row, col] = [Math.floor(blank / size), blank % size]
    // The arrow names the direction the tile travels, so Left pulls in the tile to the right of the gap.
    const from: Record<string, number | null> = {
      ArrowLeft: col < size - 1 ? blank + 1 : null,
      ArrowRight: col > 0 ? blank - 1 : null,
      ArrowUp: row < size - 1 ? blank + size : null,
      ArrowDown: row > 0 ? blank - size : null,
    }
    if (!(event.key in from)) return
    event.preventDefault()
    const source = from[event.key]
    if (source === null) setMessage('Nothing can move that way.')
    else slide(source)
  }

  const position = (index: number) => ({ x: (index % size) * 100, y: Math.floor(index / size) * 100 })

  return (
    <div className={cn('flex w-full max-w-[380px] flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <dl className="m-0 flex gap-5">
          {[
            ['Moves', String(moves)],
            ['Time', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`],
          ].map(([term, detail]) => (
            <div key={term} className="flex flex-col gap-1">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
              <dd className="m-0 text-[15px] font-extrabold leading-none text-ink tabular">{detail}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={restart}>
          Shuffle
        </Button>
      </div>

      <div
        ref={boardRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}, ${size} by ${size}. Arrow keys slide a tile into the gap.${solved && started ? ' Solved.' : ''}`}
        onKeyDown={onKeyDown}
        className="relative aspect-square w-full touch-manipulation rounded-[var(--radius-tile)] bg-surface-sunken p-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <div className="relative size-full">
          {tiles.map((tile, index) => {
            if (!tile) return null
            const { x, y } = position(index)
            const home = position(tile - 1)
            return (
              <button
                key={tile}
                type="button"
                tabIndex={-1}
                aria-label={`Tile ${tile}, row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}`}
                onClick={() => slide(index)}
                className={cn(
                  'absolute left-0 top-0 p-0.5 transition-transform duration-150 ease-out motion-reduce:transition-none',
                )}
                style={{ width: `${100 / size}%`, height: `${100 / size}%`, transform: `translate(${x}%, ${y}%)` }}
              >
                <span
                  className={cn(
                    'relative flex size-full items-center justify-center rounded-[var(--radius-glyph)] border text-[clamp(14px,5vw,24px)] font-extrabold shadow-[var(--shadow-tile)]',
                    tile === index + 1 ? 'border-accent-strong' : 'border-line-strong',
                    picture ? 'text-transparent' : 'bg-surface text-ink hover:bg-surface-muted',
                  )}
                  style={
                    picture
                      ? { backgroundImage: `url(${picture})`, backgroundSize: `${size * 100}% ${size * 100}%`, backgroundPosition: `${(home.x / 100 / Math.max(1, size - 1)) * 100}% ${(home.y / 100 / Math.max(1, size - 1)) * 100}%` }
                      : undefined
                  }
                >
                  {picture ? (
                    <span className="absolute left-1.5 top-1 rounded-full bg-surface px-1.5 text-[10px] font-bold text-ink">{tile}</span>
                  ) : (
                    tile
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {solved && started && (
          <p className="absolute inset-x-3 bottom-3 m-0 rounded-[var(--radius-tile)] bg-surface p-2 text-center text-[13px] font-bold text-ink shadow-[var(--shadow-float)]">
            Solved in {moves} moves
          </p>
        )}
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
