'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '../internal/icons'

export type Game2048Direction = 'up' | 'down' | 'left' | 'right'

export interface Game2048Props {
  /** Cells per side. */
  size?: number
  /** The tile that wins. Play can continue past it. */
  target?: number
  /** localStorage key for the best score. Pass null to keep it in memory only. */
  storageKey?: string | null
  /** Called once per game when the target tile first appears. */
  onWin?: (score: number) => void
  /** Called when no move is left. */
  onGameOver?: (score: number) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Tile {
  id: number
  value: number
  row: number
  col: number
  /** Merged into another tile this move: drawn sliding underneath, then dropped. */
  gone?: boolean
  born?: 'spawn' | 'merge'
}

interface Board {
  tiles: Tile[]
  score: number
}

const VECTORS: Record<Game2048Direction, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }
const KEYS: Record<string, Game2048Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}

let nextId = 1

function spawn(tiles: Tile[], size: number): Tile[] {
  const taken = new Set(tiles.filter((tile) => !tile.gone).map((tile) => tile.row * size + tile.col))
  const free = Array.from({ length: size * size }, (_, cell) => cell).filter((cell) => !taken.has(cell))
  if (!free.length) return tiles
  const cell = free[Math.floor(Math.random() * free.length)]
  // The original odds: one spawn in ten is a 4.
  return [...tiles, { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, row: Math.floor(cell / size), col: cell % size, born: 'spawn' }]
}

/**
 * One move. Each line is walked from the edge the tiles slide towards, and a
 * tile merges only with the next one along — and only if that one has not
 * merged already this move — so [2, 2, 4] slides to [4, 4], not [8].
 */
function slide(board: Board, direction: Game2048Direction, size: number) {
  const [dr, dc] = VECTORS[direction]
  const live = board.tiles.filter((tile) => !tile.gone).map(({ born: _born, ...tile }) => tile)
  const grid = new Map(live.map((tile) => [tile.row * size + tile.col, tile]))
  const out: Tile[] = []
  const merges: number[] = []
  let score = board.score
  let moved = false

  for (let line = 0; line < size; line += 1) {
    const cells = Array.from({ length: size }, (_, index) => {
      // Order from the far edge back, so the first tile is the one that stops first.
      const along = dr + dc > 0 ? size - 1 - index : index
      return dr !== 0 ? [along, line] : [line, along]
    })
    let place = 0
    let lastTile: Tile | null = null
    let lastMerged = false
    for (const [row, col] of cells) {
      const tile = grid.get(row * size + col)
      if (!tile) continue
      if (lastTile && !lastMerged && lastTile.value === tile.value) {
        const [r, c] = cells[place - 1]
        out.push({ ...tile, row: r, col: c, gone: true })
        const merged = out.find((item) => item.id === lastTile!.id)!
        merged.gone = true
        const value = tile.value * 2
        out.push({ id: nextId++, value, row: r, col: c, born: 'merge' })
        merges.push(value)
        score += value
        lastMerged = true
        moved = true
        continue
      }
      const [r, c] = cells[place]
      if (r !== row || c !== col) moved = true
      const placed = { ...tile, row: r, col: c }
      out.push(placed)
      lastTile = placed
      lastMerged = false
      place += 1
    }
  }
  return { board: { tiles: out, score }, moved, merges }
}

function canMove(tiles: Tile[], size: number) {
  const live = tiles.filter((tile) => !tile.gone)
  if (live.length < size * size) return true
  const grid = new Map(live.map((tile) => [tile.row * size + tile.col, tile.value]))
  return live.some(
    (tile) =>
      (tile.col < size - 1 && grid.get(tile.row * size + tile.col + 1) === tile.value) ||
      (tile.row < size - 1 && grid.get((tile.row + 1) * size + tile.col) === tile.value),
  )
}

function fresh(size: number): Board {
  return { tiles: spawn(spawn([], size), size), score: 0 }
}

function readBest(key: string | null) {
  if (!key) return 0
  try {
    return Number(window.localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

const TONES = [
  'bg-surface text-ink',
  'bg-[color-mix(in_oklab,var(--color-accent)_26%,var(--color-surface))] text-ink',
  'bg-[color-mix(in_oklab,var(--color-accent)_48%,var(--color-surface))] text-ink',
  'bg-[color-mix(in_oklab,var(--color-accent)_70%,var(--color-surface))] text-accent-ink',
  'bg-accent text-accent-ink',
  'bg-accent-strong text-accent-ink',
  'bg-[color-mix(in_oklab,var(--color-warning)_70%,var(--color-accent))] text-accent-ink',
  'bg-warning text-accent-ink',
  'bg-[color-mix(in_oklab,var(--color-danger)_70%,var(--color-warning))] text-ink-inverse',
  'bg-danger text-ink-inverse',
  'bg-ink text-ink-inverse',
]

/**
 * 2048, with tiles that keep who they are.
 *
 * Most versions store the board as a grid of numbers and re-render it, which
 * is why their tiles blink into place rather than slide: a number has no
 * identity to animate. Here every tile carries an id through each move, so a
 * slide is a change of position on the same element and CSS can tween it. A
 * merge keeps both parents for one frame, sliding them under the new tile,
 * then drops them — the same trick the original uses.
 *
 * Undo keeps the last twenty boards. The best score lives in localStorage and
 * degrades to memory when storage is refused. The board is one tab stop:
 * arrows or WASD move, and a swipe does on touch. Each move is announced with
 * what merged and the new score, and the grid is readable row by row.
 */
export function Game2048({ size = 4, target = 2048, storageKey = 'klyv-2048-best', onWin, onGameOver, className }: Game2048Props) {
  const [board, setBoard] = useState<Board>(() => ({ tiles: [], score: 0 }))
  const [undo, setUndo] = useState<Board[]>([])
  const [best, setBest] = useState(0)
  const [won, setWon] = useState<'no' | 'showing' | 'continued'>('no')
  const [message, setMessage] = useState('')
  const reduced = usePrefersReducedMotion()
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef(new Map<number, HTMLDivElement>())
  const animated = useRef(new Set<number>())

  // Dealt after mount: Math.random during render would differ between server and client.
  useEffect(() => {
    setBoard(fresh(size))
    setUndo([])
    setWon('no')
    setBest(readBest(storageKey))
  }, [size, storageKey])

  const over = board.tiles.length > 0 && !canMove(board.tiles, size)

  // New and merged tiles pop in. Web Animations, so reduced motion can simply skip it.
  useIsomorphicLayoutEffect(() => {
    if (reduced) return
    for (const tile of board.tiles) {
      if (!tile.born || animated.current.has(tile.id)) continue
      animated.current.add(tile.id)
      tileRefs.current.get(tile.id)?.animate?.(
        tile.born === 'spawn'
          ? [{ transform: 'scale(0)' }, { transform: 'scale(1)' }]
          : [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
        { duration: 180, delay: 90, easing: 'ease-out', fill: 'backwards' },
      )
    }
  }, [board, reduced])

  // Drop the merged-away parents once they have finished sliding.
  useEffect(() => {
    if (!board.tiles.some((tile) => tile.gone)) return
    const timer = window.setTimeout(() => setBoard((current) => ({ ...current, tiles: current.tiles.filter((tile) => !tile.gone) })), reduced ? 0 : 120)
    return () => window.clearTimeout(timer)
  }, [board, reduced])

  const move = (direction: Game2048Direction) => {
    if (over || won === 'showing') return
    const result = slide(board, direction, size)
    if (!result.moved) {
      setMessage(`Nothing moves ${direction}.`)
      return
    }
    const next = { ...result.board, tiles: spawn(result.board.tiles, size) }
    setUndo((stack) => [...stack.slice(-19), { tiles: board.tiles.filter((tile) => !tile.gone).map(({ born: _born, ...tile }) => tile), score: board.score }])
    setBoard(next)
    if (next.score > best) {
      setBest(next.score)
      try {
        if (storageKey) window.localStorage.setItem(storageKey, String(next.score))
      } catch {
        // Storage refused: the best score stays for this visit.
      }
    }
    const merged = result.merges.length ? ` Merged ${result.merges.join(', ')}.` : ''
    let tail = ` Score ${next.score}.`
    if (won === 'no' && result.merges.some((value) => value >= target)) {
      setWon('showing')
      tail += ` You made ${target}!`
      onWin?.(next.score)
    } else if (!canMove(next.tiles, size)) {
      tail += ' No moves left. Game over.'
      onGameOver?.(next.score)
    }
    setMessage(`Moved ${direction}.${merged}${tail}`)
  }

  const restart = () => {
    setBoard(fresh(size))
    setUndo([])
    setWon('no')
    setMessage('New game.')
    boardRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEYS[event.key]
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    move(direction)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current
    swipe.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const grid = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => board.tiles.find((tile) => !tile.gone && tile.row === row && tile.col === col)?.value ?? 0),
  )
  const cell = 100 / size

  return (
    <div className={cn('flex w-full max-w-[420px] flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {[
            ['Score', board.score],
            ['Best', best],
          ].map(([name, value]) => (
            <div key={name} className="flex min-w-[76px] flex-col rounded-[var(--radius-tile)] bg-surface-muted px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{name}</span>
              <span className="text-[16px] font-extrabold tabular-nums text-ink">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!undo.length}
            onClick={() => {
              setBoard(undo[undo.length - 1])
              setUndo(undo.slice(0, -1))
              if (won === 'showing') setWon('no')
              setMessage('Move undone.')
            }}
          >
            Undo
          </Button>
          <Button size="sm" variant="ghost" onClick={restart}>
            New game
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={boardRef}
          role="group"
          tabIndex={0}
          aria-roledescription="game board"
          aria-label={`2048 board, ${size} by ${size}. Arrow keys or W A S D to move.`}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
          className="relative aspect-square w-full touch-none select-none rounded-[var(--radius-card)] bg-line-strong p-[1.5%] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <div className="relative size-full">
            {Array.from({ length: size * size }, (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="absolute rounded-[var(--radius-10)] bg-[color-mix(in_oklab,var(--color-surface)_55%,transparent)]"
                style={{ left: `calc(${(index % size) * cell}% + 1.5%)`, top: `calc(${Math.floor(index / size) * cell}% + 1.5%)`, width: `calc(${cell}% - 3%)`, height: `calc(${cell}% - 3%)` }}
              />
            ))}
            {/* Sorted by id, so existing tiles never change DOM order — a moved node would not transition. */}
            {board.tiles
              .slice()
              .sort((a, b) => a.id - b.id)
              .map((tile) => {
                const tone = TONES[Math.min(TONES.length - 1, Math.log2(tile.value) - 1)]
                return (
                  <div
                    key={tile.id}
                    aria-hidden="true"
                    className="absolute left-0 top-0 transition-transform duration-100 ease-out motion-reduce:transition-none"
                    style={{
                      width: `${cell}%`,
                      height: `${cell}%`,
                      transform: `translate(${tile.col * 100}%, ${tile.row * 100}%)`,
                      zIndex: tile.gone ? 0 : 1,
                      transitionDuration: reduced ? '0ms' : undefined,
                    }}
                  >
                    <div
                      ref={(node) => {
                        if (node) tileRefs.current.set(tile.id, node)
                        else tileRefs.current.delete(tile.id)
                      }}
                      className={cn(
                        'absolute inset-[6%] flex items-center justify-center rounded-[var(--radius-10)] font-extrabold tabular-nums shadow-[var(--shadow-tile)]',
                        tile.value >= 1024 ? 'text-[clamp(16px,5vw,28px)]' : tile.value >= 128 ? 'text-[clamp(18px,6vw,34px)]' : 'text-[clamp(20px,7vw,40px)]',
                        tone,
                      )}
                    >
                      {tile.value}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {(won === 'showing' || over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--color-surface)_82%,transparent)]">
            <p className="m-0 text-[24px] font-extrabold text-ink">{won === 'showing' ? `${target}!` : 'Game over'}</p>
            <p className="m-0 text-[13px] font-semibold text-ink-soft">Score {board.score}</p>
            <div className="flex gap-2">
              {won === 'showing' && (
                <Button
                  size="sm"
                  onClick={() => {
                    setWon('continued')
                    boardRef.current?.focus()
                  }}
                >
                  Keep going
                </Button>
              )}
              <Button size="sm" variant={won === 'showing' ? 'outline' : 'accent'} onClick={restart}>
                New game
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1" role="group" aria-label="Move tiles">
        {(
          [
            ['left', ChevronLeftIcon],
            ['up', ChevronUpIcon],
            ['down', ChevronDownIcon],
            ['right', ChevronRightIcon],
          ] as const
        ).map(([direction, icon]) => (
          <IconButton key={direction} icon={icon} label={`Move ${direction}`} size="sm" tone="muted" shape="square" onClick={() => move(direction)} />
        ))}
      </div>

      <table className="sr-only">
        <caption>Board</caption>
        <tbody>
          {grid.map((row, index) => (
            <tr key={index}>
              {row.map((value, col) => (
                <td key={col}>{value || 'empty'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
