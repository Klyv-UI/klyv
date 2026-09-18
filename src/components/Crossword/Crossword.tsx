'use client'

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'

export type CrosswordDirection = 'across' | 'down'

export interface CrosswordPuzzle {
  /** One string per row. Letters are the answers; `#` is a block. */
  grid: string[]
  /** Clues keyed by the number printed in the entry’s first cell. Numbers are worked out from the grid. */
  across: Record<number, string>
  down: Record<number, string>
}

export interface CrosswordProps {
  puzzle: CrosswordPuzzle
  /** Called once when every letter is correct. */
  onComplete?: () => void
  /** Accessible name for the grid. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Entry {
  number: number
  direction: CrosswordDirection
  cells: number[]
  clue: string
}

/** Numbers the grid the way printed crosswords do, and lists every entry in both directions. */
function layout(puzzle: CrosswordPuzzle) {
  const rows = puzzle.grid.length
  const cols = Math.max(...puzzle.grid.map((row) => row.length))
  const answer = Array.from({ length: rows * cols }, (_, index) => (puzzle.grid[Math.floor(index / cols)][index % cols] ?? '#').toUpperCase())
  const open = (row: number, col: number) => row >= 0 && col >= 0 && row < rows && col < cols && answer[row * cols + col] !== '#'
  const numbers: number[] = new Array(rows * cols).fill(0)
  const entries: Entry[] = []
  let next = 1
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) {
      if (!open(row, col)) continue
      const across = !open(row, col - 1) && open(row, col + 1)
      const down = !open(row - 1, col) && open(row + 1, col)
      if (!across && !down) continue
      numbers[row * cols + col] = next
      for (const [direction, starts, dx, dy] of [
        ['across', across, 1, 0],
        ['down', down, 0, 1],
      ] as const) {
        if (!starts) continue
        const cells: number[] = []
        for (let y = row, x = col; open(y, x); y += dy, x += dx) cells.push(y * cols + x)
        entries.push({ number: next, direction, cells, clue: puzzle[direction][next] ?? '' })
      }
      next += 1
    }
  return { rows, cols, answer, numbers, entries }
}

/**
 * A crossword from data: a grid of answers and two lists of clues, with the
 * numbering worked out from the blocks.
 *
 * Typing fills a letter and moves along the current entry; Space or clicking
 * the active cell turns the direction; Enter jumps to the next clue. The clue
 * lists stay in step with the cursor — the active clue is marked, and the
 * crossing clue is shown too — and choosing a clue takes you to its first empty
 * square. Checking marks wrong letters without fixing them; revealing fills them
 * in and marks them as given away.
 *
 * Every square is a real text input, so a phone brings up its keyboard and a
 * screen reader hears the square’s position and both of its clue numbers, with
 * the active clue as its description.
 */
export function Crossword({ puzzle, onComplete, label = 'Crossword', className }: CrosswordProps) {
  const { rows, cols, answer, numbers, entries } = useMemo(() => layout(puzzle), [puzzle])
  const [letters, setLetters] = useState<string[]>(() => answer.map(() => ''))
  const [active, setActive] = useState(() => answer.findIndex((letter) => letter !== '#'))
  const [direction, setDirection] = useState<CrosswordDirection>('across')
  const [wrong, setWrong] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const lists = useRef<Record<CrosswordDirection, HTMLOListElement | null>>({ across: null, down: null })
  const done = useRef(false)
  const clueId = useId()

  useEffect(() => {
    setLetters(answer.map(() => ''))
    setWrong(new Set())
    setRevealed(new Set())
    done.current = false
  }, [answer])

  const entryAt = (index: number, dir: CrosswordDirection) => entries.find((entry) => entry.direction === dir && entry.cells.includes(index))
  // A square that only runs one way puts the cursor in that direction.
  const current = entryAt(active, direction) ?? entryAt(active, direction === 'across' ? 'down' : 'across')
  const dir = current?.direction ?? direction
  const crossing = entryAt(active, dir === 'across' ? 'down' : 'across')

  // Keep the active clue visible inside its list without scrolling the page.
  useEffect(() => {
    for (const entry of [current, crossing]) {
      if (!entry) continue
      const list = lists.current[entry.direction]
      const item = list?.querySelector<HTMLElement>(`[data-clue="${entry.number}"]`)
      if (!list || !item) continue
      if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
      else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [current, crossing])

  const complete = letters.every((letter, index) => answer[index] === '#' || letter === answer[index])
  useEffect(() => {
    if (!complete || done.current || letters.every((letter) => !letter)) return
    done.current = true
    setMessage('Puzzle complete. Every answer is correct.')
    onComplete?.()
  }, [complete, letters, onComplete])

  const focus = (index: number, nextDirection = dir) => {
    setActive(index)
    setDirection(nextDirection)
    inputs.current[index]?.focus()
  }

  const setLetter = (index: number, letter: string) => {
    setLetters((current) => current.map((value, at) => (at === index ? letter : value)))
    if (wrong.has(index)) setWrong((current) => new Set([...current].filter((at) => at !== index)))
  }

  const advance = (step: 1 | -1) => {
    if (!current) return
    const position = current.cells.indexOf(active)
    const target = current.cells[position + step]
    if (target !== undefined) focus(target)
  }

  const moveBy = (dx: number, dy: number) => {
    let row = Math.floor(active / cols) + dy
    let col = (active % cols) + dx
    while (row >= 0 && col >= 0 && row < rows && col < cols) {
      if (answer[row * cols + col] !== '#') return focus(row * cols + col, dx ? 'across' : 'down')
      row += dy
      col += dx
    }
  }

  const jump = (step: 1 | -1) => {
    const ordered = [...entries.filter((entry) => entry.direction === 'across'), ...entries.filter((entry) => entry.direction === 'down')]
    const at = current ? ordered.indexOf(current) : -1
    const next = ordered[(at + step + ordered.length) % ordered.length]
    choose(next)
  }

  const choose = (entry: Entry) => {
    const empty = entry.cells.find((index) => !letters[index]) ?? entry.cells[0]
    focus(empty, entry.direction)
  }

  const type = (index: number, letter: string) => {
    if (revealed.has(index)) return advance(1)
    setLetter(index, letter.toUpperCase())
    advance(1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault()
      return type(index, event.key)
    }
    const keys: Record<string, () => void> = {
      ArrowRight: () => (dir === 'across' ? moveBy(1, 0) : setDirection('across')),
      ArrowLeft: () => (dir === 'across' ? moveBy(-1, 0) : setDirection('across')),
      ArrowDown: () => (dir === 'down' ? moveBy(0, 1) : setDirection('down')),
      ArrowUp: () => (dir === 'down' ? moveBy(0, -1) : setDirection('down')),
      ' ': () => setDirection(dir === 'across' ? 'down' : 'across'),
      Enter: () => jump(event.shiftKey ? -1 : 1),
      Backspace: () => {
        if (letters[index] && !revealed.has(index)) setLetter(index, '')
        else {
          advance(-1)
          const previous = current?.cells[current.cells.indexOf(index) - 1]
          if (previous !== undefined && !revealed.has(previous)) setLetter(previous, '')
        }
      },
      Delete: () => !revealed.has(index) && setLetter(index, ''),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  // Phones and IMEs deliver text through input events rather than key presses.
  const onChange = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const letter = event.target.value.replace(/[^a-z]/gi, '').slice(-1)
    if (letter) type(index, letter)
  }

  const scope = (kind: 'letter' | 'word' | 'puzzle') =>
    kind === 'letter' ? [active] : kind === 'word' ? (current?.cells ?? []) : answer.map((letter, index) => (letter === '#' ? -1 : index)).filter((index) => index >= 0)

  const check = (kind: 'letter' | 'word' | 'puzzle') => {
    const bad = scope(kind).filter((index) => letters[index] && letters[index] !== answer[index])
    setWrong((current) => new Set([...current, ...bad]))
    setMessage(bad.length ? `${bad.length} wrong ${bad.length === 1 ? 'letter' : 'letters'} marked.` : 'No wrong letters.')
  }

  const reveal = (kind: 'letter' | 'word' | 'puzzle') => {
    const cells = scope(kind).filter((index) => letters[index] !== answer[index])
    setLetters((current) => current.map((value, index) => (cells.includes(index) ? answer[index] : value)))
    setRevealed((current) => new Set([...current, ...cells]))
    setWrong((current) => new Set([...current].filter((index) => !cells.includes(index))))
    setMessage(`${cells.length} ${cells.length === 1 ? 'letter' : 'letters'} revealed.`)
  }

  const describeCell = (index: number) => {
    const parts = (['across', 'down'] as const)
      .map((way) => {
        const entry = entryAt(index, way)
        return entry && `${entry.number} ${way}, letter ${entry.cells.indexOf(index) + 1} of ${entry.cells.length}`
      })
      .filter(Boolean)
    const state = wrong.has(index) ? ', wrong' : revealed.has(index) ? ', revealed' : ''
    return `Row ${Math.floor(index / cols) + 1}, column ${(index % cols) + 1}: ${parts.join('; ')}${state}`
  }

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <p id={clueId} className="m-0 min-h-10 rounded-[var(--radius-tile)] bg-[color-mix(in_oklab,var(--color-accent)_22%,transparent)] px-3 py-2.5 text-[13px] font-semibold text-ink">
        {current ? (
          <>
            <span className="font-extrabold">
              {current.number} {current.direction === 'across' ? 'Across' : 'Down'}
            </span>{' '}
            {current.clue} <span className="text-ink-soft">({current.cells.length})</span>
          </>
        ) : (
          'Choose a square'
        )}
      </p>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div role="grid" aria-label={label} aria-rowcount={rows} aria-colcount={cols} className="grid w-full max-w-[420px] shrink-0 gap-px border border-ink bg-ink" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: rows }, (_, row) => (
            <div role="row" key={row} aria-rowindex={row + 1} className="contents">
              {Array.from({ length: cols }, (_, col) => {
                const index = row * cols + col
                if (answer[index] === '#') return <div role="gridcell" key={col} aria-colindex={col + 1} aria-label="Block" className="aspect-square bg-ink" />
                const inWord = current?.cells.includes(index)
                return (
                  <div role="gridcell" key={col} aria-colindex={col + 1} className="relative aspect-square">
                    {numbers[index] > 0 && (
                      <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0 z-[1] text-[clamp(7px,1.6vw,10px)] font-bold leading-tight text-ink-soft">
                        {numbers[index]}
                      </span>
                    )}
                    <input
                      ref={(node) => {
                        inputs.current[index] = node
                      }}
                      value={letters[index]}
                      onChange={(event) => onChange(event, index)}
                      onKeyDown={(event) => onKeyDown(event, index)}
                      onFocus={() => setActive(index)}
                      onClick={() => {
                        if (index === active) setDirection(dir === 'across' ? 'down' : 'across')
                      }}
                      tabIndex={index === active ? 0 : -1}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={2}
                      aria-label={describeCell(index)}
                      aria-describedby={index === active ? clueId : undefined}
                      aria-invalid={wrong.has(index) || undefined}
                      className={cn(
                        'block size-full cursor-pointer rounded-none border-0 p-0 pt-[10%] text-center text-[clamp(13px,3.6vw,20px)] font-bold uppercase caret-transparent outline-none',
                        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                        index === active
                          ? 'bg-accent text-accent-ink'
                          : inWord
                            ? 'bg-[color-mix(in_oklab,var(--color-accent)_32%,var(--color-surface))] text-ink'
                            : 'bg-surface text-ink',
                        wrong.has(index) && 'text-danger line-through',
                        revealed.has(index) && 'text-[color-mix(in_oklab,var(--color-accent-strong)_40%,var(--color-ink))]',
                      )}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {(['across', 'down'] as const).map((way) => (
            <section key={way} className="flex min-w-0 flex-col gap-1.5">
              <h3 className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{way === 'across' ? 'Across' : 'Down'}</h3>
              <ol
                ref={(node) => {
                  lists.current[way] = node
                }}
                className="relative m-0 flex max-h-[260px] list-none flex-col gap-0.5 overflow-y-auto p-0"
              >
                {entries
                  .filter((entry) => entry.direction === way)
                  .map((entry) => {
                    const isCurrent = entry === current
                    const isCrossing = entry === crossing
                    const filled = entry.cells.every((index) => letters[index])
                    return (
                      <li key={entry.number} data-clue={entry.number}>
                        <button
                          type="button"
                          aria-current={isCurrent ? 'true' : undefined}
                          onClick={() => choose(entry)}
                          className={cn(
                            'flex w-full gap-2 rounded-[var(--radius-glyph)] px-2 py-1.5 text-left text-[12px] leading-snug',
                            isCurrent ? 'bg-accent text-accent-ink' : isCrossing ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted',
                            filled && !isCurrent && 'text-ink-faint',
                          )}
                        >
                          <span className="w-5 shrink-0 font-extrabold">{entry.number}</span>
                          <span className={cn(filled && !isCurrent && 'line-through decoration-1')}>{entry.clue}</span>
                        </button>
                      </li>
                    )
                  })}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(
          [
            ['Check', check],
            ['Reveal', reveal],
          ] as const
        ).map(([name, run]) => (
          <div key={name} role="group" aria-label={name} className="flex items-center gap-1">
            <span aria-hidden="true" className="mr-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {name}
            </span>
            {(['letter', 'word', 'puzzle'] as const).map((kind) => (
              <Button key={kind} size="sm" variant="outline" onClick={() => run(kind)} aria-label={`${name} ${kind}`}>
                {kind[0].toUpperCase() + kind.slice(1)}
              </Button>
            ))}
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
