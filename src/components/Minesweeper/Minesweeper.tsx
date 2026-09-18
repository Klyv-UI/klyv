'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type MinesweeperDifficulty = 'beginner' | 'intermediate' | 'expert'

export interface MinesweeperResult {
  won: boolean
  seconds: number
  difficulty: MinesweeperDifficulty
}

export interface MinesweeperProps {
  /** Board size and mine count of the first game. The picker changes it after that. */
  defaultDifficulty?: MinesweeperDifficulty
  /** Called when a game is won or lost. */
  onGameEnd?: (result: MinesweeperResult) => void
  /** Merged last, so it wins. */
  className?: string
}

const PRESETS: Record<MinesweeperDifficulty, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
}

type Status = 'ready' | 'playing' | 'won' | 'lost'

interface Cell {
  mine: boolean
  adjacent: number
  open: boolean
  flag: boolean
}

const NUMBER_TONE = [
  '',
  'text-[color-mix(in_oklab,var(--color-accent-strong)_40%,var(--color-ink))]',
  'text-success',
  'text-danger',
  'text-ink',
]

const clock = (seconds: number) => String(Math.min(999, seconds)).padStart(3, '0')

/**
 * Minesweeper, played for real: the first click is always safe, empty regions
 * flood open, flags and chording work, and the game ends in a win or a mine.
 *
 * Mines are laid on the first reveal, away from that cell and its neighbours,
 * so every game opens with a region to reason from rather than a coin toss.
 * Clicking a number whose flags are all placed chords — it opens the rest of its
 * neighbours — which is the move that makes larger boards playable.
 *
 * The board is an ARIA grid with one tab stop. Arrows move, Enter or Space
 * reveals (or chords on a number), F flags, and every cell is named with its
 * position and what is known about it. Outcomes are announced, including how
 * many cells a flood opened, because a sighted player sees that at a glance.
 * On touch, a Flag mode switch stands in for the right click.
 */
export function Minesweeper({ defaultDifficulty = 'beginner', onGameEnd, className }: MinesweeperProps) {
  const [difficulty, setDifficulty] = useState(defaultDifficulty)
  const { rows, cols, mines } = PRESETS[difficulty]
  const [board, setBoard] = useState<Cell[]>([])
  const [status, setStatus] = useState<Status>('ready')
  const [exploded, setExploded] = useState(-1)
  const [active, setActive] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const cells = useRef<(HTMLDivElement | null)[]>([])

  const reset = useCallback((level: MinesweeperDifficulty) => {
    const preset = PRESETS[level]
    setBoard(Array.from({ length: preset.rows * preset.cols }, () => ({ mine: false, adjacent: 0, open: false, flag: false })))
    setStatus('ready')
    setExploded(-1)
    setSeconds(0)
    setActive(0)
    setMessage(`New game: ${preset.cols} by ${preset.rows}, ${preset.mines} mines.`)
  }, [])

  useEffect(() => reset(defaultDifficulty), [reset, defaultDifficulty])

  useEffect(() => {
    if (status !== 'playing') return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [status])

  const neighbours = (index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const out: number[] = []
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        const y = row + dy
        const x = col + dx
        if ((dx || dy) && y >= 0 && y < rows && x >= 0 && x < cols) out.push(y * cols + x)
      }
    return out
  }

  const end = (next: Cell[], won: boolean, at = -1) => {
    setStatus(won ? 'won' : 'lost')
    setExploded(at)
    // A win flags whatever is left; a loss shows where every mine was.
    setBoard(next.map((cell) => (won && cell.mine ? { ...cell, flag: true } : !won && cell.mine && !cell.flag ? { ...cell, open: true } : cell)))
    setMessage(won ? `Cleared in ${seconds} seconds.` : 'Mine. Game over.')
    onGameEnd?.({ won, seconds, difficulty })
  }

  /** Opens cells, flooding outward from zeros. Returns false if a mine was hit. */
  const open = (targets: number[]) => {
    if (status === 'won' || status === 'lost' || board.length === 0) return
    let next = board.map((cell) => ({ ...cell }))
    if (status === 'ready') {
      const safe = new Set([targets[0], ...neighbours(targets[0])])
      const spots = next.map((_, index) => index).filter((index) => !safe.has(index))
      for (let placed = 0; placed < mines && spots.length; placed += 1) {
        const [spot] = spots.splice(Math.floor(Math.random() * spots.length), 1)
        next[spot].mine = true
      }
      next = next.map((cell, index) => ({ ...cell, adjacent: neighbours(index).filter((other) => next[other].mine).length }))
      setStatus('playing')
    }
    const queue = targets.filter((index) => !next[index].open && !next[index].flag)
    const hit = queue.find((index) => next[index].mine)
    if (hit !== undefined) return end(next, false, hit)
    let opened = 0
    while (queue.length) {
      const index = queue.pop()!
      const cell = next[index]
      if (cell.open || cell.flag) continue
      cell.open = true
      opened += 1
      if (cell.adjacent === 0) queue.push(...neighbours(index).filter((other) => !next[other].open && !next[other].mine))
    }
    const hidden = next.filter((cell) => !cell.open).length
    if (hidden === mines) return end(next, true)
    setBoard(next)
    const first = next[targets[0]]
    setMessage(opened > 1 ? `${opened} cells opened.` : first.adjacent ? `${first.adjacent} nearby.` : 'Empty.')
  }

  const flag = (index: number) => {
    const cell = board[index]
    if (!cell || cell.open || status === 'won' || status === 'lost') return
    setBoard(board.map((other, at) => (at === index ? { ...other, flag: !other.flag } : other)))
    setMessage(cell.flag ? 'Flag removed.' : 'Flagged.')
  }

  const act = (index: number, asFlag = flagMode) => {
    const cell = board[index]
    if (!cell) return
    if (cell.open) {
      // Chord: a number with all its flags placed opens the rest of its neighbours.
      const around = neighbours(index)
      const flags = around.filter((other) => board[other].flag).length
      if (cell.adjacent > 0 && flags === cell.adjacent) open(around)
      else if (cell.adjacent > 0) setMessage(`${cell.adjacent} nearby, ${flags} flagged.`)
      return
    }
    if (asFlag) flag(index)
    else open([index])
  }

  const move = (index: number) => {
    setActive(index)
    cells.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(col < cols - 1 ? index + 1 : index),
      ArrowLeft: () => move(col > 0 ? index - 1 : index),
      ArrowDown: () => move(row < rows - 1 ? index + cols : index),
      ArrowUp: () => move(row > 0 ? index - cols : index),
      Home: () => move(event.ctrlKey ? 0 : row * cols),
      End: () => move(event.ctrlKey ? rows * cols - 1 : row * cols + cols - 1),
      Enter: () => act(index),
      ' ': () => act(index),
      f: () => flag(index),
      F: () => flag(index),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const flags = board.filter((cell) => cell.flag).length
  const over = status === 'won' || status === 'lost'

  const describe = (cell: Cell, index: number) => {
    const where = `Row ${Math.floor(index / cols) + 1}, column ${(index % cols) + 1}`
    if (cell.flag) return `${where}: flagged${over && !cell.mine ? ', wrongly' : ''}`
    if (!cell.open) return `${where}: hidden`
    if (cell.mine) return `${where}: mine${index === exploded ? ', exploded' : ''}`
    return `${where}: ${cell.adjacent ? `${cell.adjacent} ${cell.adjacent === 1 ? 'mine' : 'mines'} nearby` : 'empty'}`
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Difficulty"
          size="sm"
          value={difficulty}
          onValueChange={(level) => {
            setDifficulty(level)
            reset(level)
          }}
          options={[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'expert', label: 'Expert' },
          ]}
        />
        <Button size="sm" variant={flagMode ? 'accent' : 'outline'} aria-pressed={flagMode} onClick={() => setFlagMode((value) => !value)}>
          Flag mode
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-tile)] bg-surface-sunken px-3 py-2">
        <p className="m-0 text-[15px] font-extrabold text-ink tabular">
          <span className="sr-only">Mines left: </span>
          <span aria-hidden="true">💣 </span>
          {mines - flags}
        </p>
        <Button size="sm" variant="ghost" onClick={() => reset(difficulty)}>
          {status === 'lost' ? 'Try again' : status === 'won' ? 'Play again' : 'New game'}
        </Button>
        <p className="m-0 text-[15px] font-extrabold text-ink tabular">
          <span className="sr-only">Seconds: </span>
          <span aria-hidden="true">⏱ </span>
          {clock(seconds)}
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <div role="grid" aria-label="Minefield" aria-rowcount={rows} aria-colcount={cols} className="inline-flex flex-col gap-px rounded-[var(--radius-glyph)] border border-line-strong bg-line-strong p-px">
          {Array.from({ length: board.length ? rows : 0 }, (_, row) => (
            <div role="row" key={row} aria-rowindex={row + 1} className="flex gap-px">
              {Array.from({ length: cols }, (_, col) => {
                const index = row * cols + col
                const cell = board[index]
                if (!cell) return null
                return (
                  <div
                    role="gridcell"
                    key={col}
                    aria-colindex={col + 1}
                    ref={(node) => {
                      cells.current[index] = node
                    }}
                    tabIndex={index === active ? 0 : -1}
                    aria-label={describe(cell, index)}
                    onClick={() => {
                      setActive(index)
                      act(index)
                    }}
                    onContextMenu={(event: MouseEvent) => {
                      event.preventDefault()
                      setActive(index)
                      flag(index)
                    }}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={cn(
                      'flex size-7 shrink-0 cursor-pointer select-none items-center justify-center text-[13px] font-extrabold outline-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                      !cell.open && 'bg-surface-muted hover:bg-line-strong',
                      cell.open && 'bg-surface',
                      cell.open && cell.mine && index === exploded && 'bg-danger text-ink-inverse',
                      cell.open && !cell.mine && NUMBER_TONE[Math.min(4, cell.adjacent)],
                    )}
                  >
                    <span aria-hidden="true">
                      {cell.flag ? (over && !cell.mine ? '✕' : '⚑') : cell.open ? (cell.mine ? '✹' : cell.adjacent || '') : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {over && (
        <p className={cn('m-0 rounded-[var(--radius-tile)] p-3 text-center text-[13px] font-bold', status === 'won' ? 'bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-ink' : 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger')}>
          {status === 'won' ? `Cleared in ${seconds} seconds` : 'You hit a mine'}
        </p>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
