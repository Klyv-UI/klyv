'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type SudokuDifficulty = 'easy' | 'medium' | 'hard'

export interface SudokuResult {
  seconds: number
  hints: number
  difficulty: SudokuDifficulty
}

export interface SudokuProps {
  /** Difficulty of the first puzzle. The picker changes it after that. */
  defaultDifficulty?: SudokuDifficulty
  /**
   * A fixed puzzle as 81 characters, row by row, with `0` or `.` for blanks. It
   * must have exactly one solution. Leave it out to generate puzzles.
   */
  puzzle?: string
  /** Called once when the grid is filled correctly. */
  onSolve?: (result: SudokuResult) => void
  /** Merged last, so it wins. */
  className?: string
}

const CLUES: Record<SudokuDifficulty, number> = { easy: 38, medium: 31, hard: 25 }
const ALL = 0b1111111110
const rowOf = (index: number) => Math.floor(index / 9)
const colOf = (index: number) => index % 9
const boxOf = (index: number) => Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3)
const PEERS = Array.from({ length: 81 }, (_, index) =>
  Array.from({ length: 81 }, (_, other) => other).filter(
    (other) => other !== index && (rowOf(other) === rowOf(index) || colOf(other) === colOf(index) || boxOf(other) === boxOf(index)),
  ),
)
const bits = (mask: number) => {
  let count = 0
  for (let value = mask; value; value &= value - 1) count += 1
  return count
}
const shuffled = <T,>(items: T[]) => {
  const out = items.slice()
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[swap]] = [out[swap], out[index]]
  }
  return out
}

/**
 * Backtracking with bitmasks, always branching on the cell with the fewest
 * candidates. Stops at `limit` solutions — two is enough to prove a puzzle is
 * not unique — and keeps the first one it finds.
 */
function search(grid: number[], limit: number, random = false) {
  const cells = grid.slice()
  const rows = new Array(9).fill(0)
  const cols = new Array(9).fill(0)
  const boxes = new Array(9).fill(0)
  for (let index = 0; index < 81; index += 1) {
    const bit = cells[index] ? 1 << cells[index] : 0
    if (!bit) continue
    if ((rows[rowOf(index)] | cols[colOf(index)] | boxes[boxOf(index)]) & bit) return { count: 0, solution: null }
    rows[rowOf(index)] |= bit
    cols[colOf(index)] |= bit
    boxes[boxOf(index)] |= bit
  }
  let count = 0
  let solution: number[] | null = null
  const solve = (): boolean => {
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let index = 0; index < 81; index += 1) {
      if (cells[index]) continue
      const mask = ALL & ~(rows[rowOf(index)] | cols[colOf(index)] | boxes[boxOf(index)])
      const size = bits(mask)
      if (size === 0) return false
      if (size < bestCount) [best, bestMask, bestCount] = [index, mask, size]
    }
    if (best === -1) {
      count += 1
      solution ??= cells.slice()
      return count >= limit
    }
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => bestMask & (1 << digit))
    for (const digit of random ? shuffled(digits) : digits) {
      const bit = 1 << digit
      cells[best] = digit
      rows[rowOf(best)] |= bit
      cols[colOf(best)] |= bit
      boxes[boxOf(best)] |= bit
      if (solve()) return true
      cells[best] = 0
      rows[rowOf(best)] &= ~bit
      cols[colOf(best)] &= ~bit
      boxes[boxOf(best)] &= ~bit
    }
    return false
  }
  solve()
  return { count, solution: solution as number[] | null }
}

/** A random full grid, then clues removed one by one while the answer stays unique. */
function generate(difficulty: SudokuDifficulty) {
  const solution = search(new Array(81).fill(0), 1, true).solution!
  const puzzle = solution.slice()
  let clues = 81
  for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
    if (clues <= CLUES[difficulty]) break
    const kept = puzzle[index]
    puzzle[index] = 0
    if (search(puzzle, 2).count === 1) clues -= 1
    else puzzle[index] = kept
  }
  return { puzzle, solution }
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

interface Game {
  givens: number[]
  solution: number[]
  values: number[]
  notes: number[]
}

/**
 * A playable sudoku: generated puzzles with one solution each, pencil notes,
 * conflicts, hints, a check and a timer.
 *
 * Puzzles are made rather than shipped. A random grid is filled by
 * backtracking, then clues are taken out one at a time and put back whenever
 * the solver finds a second answer — a sudoku with two solutions cannot be
 * reasoned through, only guessed, so uniqueness is checked on every removal.
 *
 * The board is an ARIA grid with one tab stop. Each cell is named with its row,
 * column and box, its digit or notes, and whether it clashes, since the
 * row-column-box relationship is the whole game and a screen reader cannot see
 * the thick lines. Digits type in; N switches to notes; Backspace clears.
 * Conflicts show as you type, but wrong-but-legal digits are only revealed when
 * you ask for a check.
 */
export function Sudoku({ defaultDifficulty = 'easy', puzzle, onSolve, className }: SudokuProps) {
  const [difficulty, setDifficulty] = useState(defaultDifficulty)
  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const [pencil, setPencil] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [hints, setHints] = useState(0)
  const [wrong, setWrong] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const reported = useRef(false)

  const start = useCallback(
    (level: SudokuDifficulty) => {
      let made: { puzzle: number[]; solution: number[] }
      if (puzzle) {
        const givens = puzzle.replace(/\./g, '0').split('').map(Number)
        const result = givens.length === 81 && !givens.some(Number.isNaN) ? search(givens, 2) : null
        if (!result || result.count !== 1) {
          setError('This puzzle does not have exactly one solution, so it cannot be played.')
          return
        }
        made = { puzzle: givens, solution: result.solution! }
      } else made = generate(level)
      setGame({ givens: made.puzzle, solution: made.solution, values: made.puzzle.slice(), notes: new Array(81).fill(0) })
      setError('')
      setSeconds(0)
      setHints(0)
      setWrong(new Set())
      setActive(made.puzzle.findIndex((value) => value === 0))
      reported.current = false
      setMessage(`New ${level} puzzle, ${made.puzzle.filter(Boolean).length} clues.`)
    },
    [puzzle],
  )

  // Generated after mount, so the server render and the first client render agree.
  useEffect(() => {
    start(defaultDifficulty)
  }, [start, defaultDifficulty])

  const solved = !!game && game.values.every((value, index) => value === game.solution[index])

  const playing = !!game && !solved
  useEffect(() => {
    if (!playing) return
    // The clock stops while the tab is hidden: time away is not time spent solving.
    const timer = window.setInterval(() => {
      if (!document.hidden) setSeconds((value) => value + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (!solved || reported.current) return
    reported.current = true
    setMessage(`Solved in ${clock(seconds)}${hints ? ` with ${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''}.`)
    onSolve?.({ seconds, hints, difficulty })
  }, [solved, seconds, hints, difficulty, onSolve])

  if (error) return <p className={cn('text-[13px] font-medium text-danger', className)}>{error}</p>

  const conflicts = new Set<number>()
  if (game)
    game.values.forEach((value, index) => {
      if (value && PEERS[index].some((peer) => game.values[peer] === value)) conflicts.add(index)
    })

  const update = (index: number, change: (game: Game) => void) => {
    if (!game || game.givens[index] || solved) return
    const next = { ...game, values: game.values.slice(), notes: game.notes.slice() }
    change(next)
    setGame(next)
    setWrong((current) => {
      if (!current.has(index)) return current
      const copy = new Set(current)
      copy.delete(index)
      return copy
    })
  }

  const enter = (index: number, digit: number, asNote = pencil) => {
    if (!game || game.givens[index]) return setMessage('That cell is a clue.')
    if (asNote) {
      if (game.values[index]) return setMessage('Clear the digit before adding notes.')
      update(index, (next) => (next.notes[index] ^= 1 << digit))
      return setMessage(`Note ${digit} ${game.notes[index] & (1 << digit) ? 'removed' : 'added'}.`)
    }
    update(index, (next) => {
      next.values[index] = digit
      next.notes[index] = 0
      // A placed digit rules itself out of every peer's notes.
      for (const peer of PEERS[index]) next.notes[peer] &= ~(1 << digit)
    })
    const clash = PEERS[index].some((peer) => game.values[peer] === digit)
    setMessage(`${digit}${clash ? ', conflicts with another cell' : ''}.`)
  }

  const clear = (index: number) => {
    update(index, (next) => {
      next.values[index] = 0
      next.notes[index] = 0
    })
    setMessage('Cleared.')
  }

  const move = (index: number) => {
    const next = Math.max(0, Math.min(80, index))
    setActive(next)
    cells.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const digit = /^Digit[1-9]$|^Numpad[1-9]$/.test(event.code) ? Number(event.code.slice(-1)) : Number(event.key)
    if (digit >= 1 && digit <= 9 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      return enter(index, digit, pencil !== event.shiftKey)
    }
    const row = rowOf(index)
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(colOf(index) === 8 ? index : index + 1),
      ArrowLeft: () => move(colOf(index) === 0 ? index : index - 1),
      ArrowDown: () => move(row === 8 ? index : index + 9),
      ArrowUp: () => move(row === 0 ? index : index - 9),
      Home: () => move(event.ctrlKey ? 0 : row * 9),
      End: () => move(event.ctrlKey ? 80 : row * 9 + 8),
      Backspace: () => clear(index),
      Delete: () => clear(index),
      '0': () => clear(index),
      n: () => togglePencil(),
      N: () => togglePencil(),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const togglePencil = () => {
    setPencil((value) => !value)
    setMessage(pencil ? 'Notes off.' : 'Notes on.')
  }

  const hint = () => {
    if (!game || solved) return
    const target =
      !game.givens[active] && game.values[active] !== game.solution[active]
        ? active
        : shuffled(game.values.map((value, index) => (value !== game.solution[index] ? index : -1)).filter((index) => index >= 0))[0]
    if (target === undefined) return
    enter(target, game.solution[target], false)
    setHints((value) => value + 1)
    move(target)
    setMessage(`Hint: row ${rowOf(target) + 1}, column ${colOf(target) + 1} is ${game.solution[target]}.`)
  }

  const check = () => {
    if (!game) return
    const bad = new Set(game.values.map((value, index) => (value && value !== game.solution[index] ? index : -1)).filter((index) => index >= 0))
    setWrong(bad)
    const left = game.values.filter((value) => !value).length
    setMessage(bad.size ? `${bad.size} ${bad.size === 1 ? 'digit is' : 'digits are'} wrong, marked in the grid.` : `No mistakes so far. ${left} cells to go.`)
  }

  const focused = game?.values[active] ?? 0

  return (
    <div className={cn('flex w-full max-w-[460px] flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!puzzle && (
          <SegmentedControl
            label="Difficulty"
            size="sm"
            value={difficulty}
            onValueChange={(level) => {
              setDifficulty(level)
              start(level)
            }}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        )}
        <p className="m-0 text-[13px] font-extrabold text-ink tabular">
          <span className="sr-only">Time </span>
          {clock(seconds)}
        </p>
      </div>

      <div role="grid" aria-label="Sudoku" aria-rowcount={9} aria-colcount={9} aria-busy={!game || undefined} className="grid aspect-square w-full grid-rows-9 overflow-hidden rounded-[var(--radius-tile)] border-2 border-ink bg-surface">
        {Array.from({ length: 9 }, (_, row) => (
          <div role="row" key={row} aria-rowindex={row + 1} className="grid grid-cols-9">
            {Array.from({ length: 9 }, (_, col) => {
              const index = row * 9 + col
              const value = game?.values[index] ?? 0
              const given = !!game?.givens[index]
              const notes = game?.notes[index] ?? 0
              const clash = conflicts.has(index)
              const bad = wrong.has(index)
              const related = rowOf(active) === row || colOf(active) === col || boxOf(active) === boxOf(index)
              const noteList = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => notes & (1 << digit))
              return (
                <div
                  role="gridcell"
                  key={col}
                  aria-colindex={col + 1}
                  ref={(node) => {
                    cells.current[index] = node
                  }}
                  tabIndex={index === active ? 0 : -1}
                  aria-readonly={given || undefined}
                  aria-invalid={clash || bad || undefined}
                  aria-label={`Row ${row + 1}, column ${col + 1}, box ${boxOf(index) + 1}: ${
                    value ? `${value}${given ? ', clue' : ''}` : noteList.length ? `empty, notes ${noteList.join(' ')}` : 'empty'
                  }${clash ? ', conflict' : ''}${bad ? ', wrong' : ''}`}
                  onClick={() => move(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center justify-center border-line-strong text-[clamp(15px,4.6vw,22px)] outline-none',
                    col % 3 === 2 && col < 8 ? 'border-r-2 border-r-ink' : col < 8 && 'border-r',
                    row % 3 === 2 && row < 8 ? 'border-b-2 border-b-ink' : row < 8 && 'border-b',
                    clash || bad
                      ? 'bg-[color-mix(in_oklab,var(--color-danger)_16%,transparent)]'
                      : index === active
                        ? 'bg-[color-mix(in_oklab,var(--color-accent)_55%,transparent)]'
                        : value && value === focused
                          ? 'bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)]'
                          : related && 'bg-surface-sunken',
                    given ? 'font-extrabold' : 'font-semibold',
                    clash || bad ? 'text-danger' : given ? 'text-ink' : 'text-[color-mix(in_oklab,var(--color-accent-strong)_45%,var(--color-ink))]',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                  )}
                >
                  {value ? (
                    <span aria-hidden="true">{value}</span>
                  ) : (
                    <span aria-hidden="true" className="grid size-full grid-cols-3 p-0.5 text-[clamp(7px,2vw,10px)] font-semibold leading-none text-ink-soft">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <span key={digit} className="flex items-center justify-center">
                          {notes & (1 << digit) ? digit : ''}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-9 gap-1" role="group" aria-label="Number pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            aria-label={`${pencil ? 'Note' : 'Enter'} ${digit}`}
            // Keeps focus on the grid, so typing and tapping can be mixed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => enter(active, digit)}
            className="h-10 rounded-[var(--radius-glyph)] border border-line-strong bg-surface text-[15px] font-bold text-ink hover:bg-surface-muted"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={pencil ? 'accent' : 'outline'} aria-pressed={pencil} onMouseDown={(event) => event.preventDefault()} onClick={togglePencil}>
          Notes
        </Button>
        <Button size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => clear(active)}>
          Erase
        </Button>
        <Button size="sm" variant="outline" onClick={hint} disabled={solved}>
          Hint
        </Button>
        <Button size="sm" variant="outline" onClick={check} disabled={solved}>
          Check
        </Button>
        <Button size="sm" variant="ghost" onClick={() => start(difficulty)}>
          New puzzle
        </Button>
      </div>

      {solved && (
        <p className="m-0 rounded-[var(--radius-tile)] bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] p-3 text-center text-[13px] font-bold text-ink">
          Solved in {clock(seconds)}
          {hints ? ` · ${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''}
        </p>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
