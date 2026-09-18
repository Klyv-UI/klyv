'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type TicTacToeMark = 'X' | 'O'
export type TicTacToeOpponent = 'computer' | 'human'
export type TicTacToeWinner = TicTacToeMark | 'draw'

export interface TicTacToeProps {
  /** Who plays O. Uncontrolled starting value; the reader can switch it. */
  defaultOpponent?: TicTacToeOpponent
  /** Hide the opponent switch and fix the mode. */
  opponent?: TicTacToeOpponent
  /** How the computer plays: perfect never loses, casual blunders now and then. */
  difficulty?: 'perfect' | 'casual'
  /** Which mark opens each game. Against the computer, you are always X. */
  firstMove?: TicTacToeMark
  /** Called when a game ends. */
  onGameEnd?: (winner: TicTacToeWinner) => void
  /** Merged last, so it wins. */
  className?: string
}

type Board = (TicTacToeMark | null)[]

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

const winLine = (board: Board) =>
  LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? null

const minimax = (board: Board, turn: TicTacToeMark, depth: number): number => {
  const line = winLine(board)
  if (line) return board[line[0]] === 'O' ? 10 - depth : depth - 10
  if (board.every(Boolean)) return 0
  const scores = board.flatMap((cell, index) => {
    if (cell) return []
    const next = [...board]
    next[index] = turn
    return [minimax(next, turn === 'O' ? 'X' : 'O', depth + 1)]
  })
  return turn === 'O' ? Math.max(...scores) : Math.min(...scores)
}

const bestMove = (board: Board, difficulty: 'perfect' | 'casual') => {
  const open = board.flatMap((cell, index) => (cell ? [] : [index]))
  if (difficulty === 'casual' && Math.random() < 0.3) return open[Math.floor(Math.random() * open.length)]
  // An empty board has one best answer; searching all 9! games to find it is wasted time.
  if (open.length === 9) return 4
  let best = open[0]
  let bestScore = -Infinity
  for (const index of open) {
    const next = [...board]
    next[index] = 'O'
    const score = minimax(next, 'X', 1)
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  }
  return best
}

const ROWS = ['top', 'middle', 'bottom']
const COLS = ['left', 'centre', 'right']
const place = (index: number) => `${ROWS[Math.floor(index / 3)]} ${COLS[index % 3]}`

/**
 * Noughts and crosses that can be played entirely by keyboard or by ear.
 *
 * The board is a grid of nine buttons with one tab stop and arrow keys between
 * them, and each square is named by where it is and what is on it — “top left,
 * X” — so the position is legible without seeing it. Every move, the computer’s
 * included, is announced along with whose turn it is, and a finished game says
 * who won and along which line, which is also drawn on the board.
 *
 * The computer plays minimax: on perfect it cannot be beaten, which is the
 * honest answer for a game this small; casual lets it slip sometimes, so a win
 * is possible.
 */
export function TicTacToe({
  defaultOpponent = 'computer',
  opponent: fixedOpponent,
  difficulty = 'perfect',
  firstMove = 'X',
  onGameEnd,
  className,
}: TicTacToeProps) {
  const [chosen, setChosen] = useState<TicTacToeOpponent>(defaultOpponent)
  const opponent = fixedOpponent ?? chosen
  const [board, setBoard] = useState<Board>(() => Array(9).fill(null))
  const [turn, setTurn] = useState<TicTacToeMark>(firstMove)
  const [active, setActive] = useState(4)
  const [message, setMessage] = useState('')
  const [score, setScore] = useState({ X: 0, O: 0, draw: 0 })
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const onGameEndRef = useRef(onGameEnd)
  onGameEndRef.current = onGameEnd

  const line = winLine(board)
  const full = board.every(Boolean)
  const over = Boolean(line) || full
  const computerTurn = opponent === 'computer' && turn === 'O' && !over
  const name = (mark: TicTacToeMark) => (opponent === 'computer' ? (mark === 'X' ? 'You' : 'Computer') : mark)

  const play = (index: number) => {
    if (board[index] || over) return
    const next = [...board]
    next[index] = turn
    const won = winLine(next)
    const nextTurn = turn === 'X' ? 'O' : 'X'
    setBoard(next)
    setTurn(nextTurn)

    const who = opponent === 'computer' ? (turn === 'X' ? 'You' : 'Computer') : turn
    const moved = `${who} played ${turn} ${place(index)}.`
    if (won) {
      const winner = next[won[0]] as TicTacToeMark
      setScore((current) => ({ ...current, [winner]: current[winner] + 1 }))
      setMessage(`${moved} ${opponent === 'computer' ? (winner === 'X' ? 'You win' : 'Computer wins') : `${winner} wins`}, ${place(won[0])} to ${place(won[2])}.`)
      onGameEndRef.current?.(winner)
    } else if (next.every(Boolean)) {
      setScore((current) => ({ ...current, draw: current.draw + 1 }))
      setMessage(`${moved} Draw.`)
      onGameEndRef.current?.('draw')
    } else {
      setMessage(`${moved} ${opponent === 'computer' ? (nextTurn === 'X' ? 'Your turn.' : '') : `${nextTurn} to play.`}`.trim())
    }
  }

  // The computer answers after a short beat, so its move reads as a reply rather than as part of yours.
  useEffect(() => {
    if (!computerTurn) return
    const timer = window.setTimeout(() => play(bestMove(board, difficulty)), 420)
    return () => window.clearTimeout(timer)
  })

  const restart = (nextOpponent = opponent) => {
    setBoard(Array(9).fill(null))
    setTurn(firstMove)
    setMessage(`New game. ${nextOpponent === 'computer' ? (firstMove === 'X' ? 'Your turn.' : 'Computer to play.') : `${firstMove} to play.`}`)
  }

  const move = (index: number) => {
    setActive(index)
    buttons.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(row * 3 + Math.min(2, col + 1)),
      ArrowLeft: () => move(row * 3 + Math.max(0, col - 1)),
      ArrowDown: () => move(Math.min(2, row + 1) * 3 + col),
      ArrowUp: () => move(Math.max(0, row - 1) * 3 + col),
      Home: () => move(event.ctrlKey ? 0 : row * 3),
      End: () => move(event.ctrlKey ? 8 : row * 3 + 2),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const status = line
    ? opponent === 'computer'
      ? board[line[0]] === 'X'
        ? 'You win'
        : 'Computer wins'
      : `${board[line[0]]} wins`
    : full
      ? 'Draw'
      : computerTurn
        ? 'Computer is thinking…'
        : opponent === 'computer'
          ? 'Your turn — you are X'
          : `${turn} to play`

  return (
    <div className={cn('flex w-full max-w-[340px] flex-col gap-4', className)}>
      {!fixedOpponent && (
        <SegmentedControl
          label="Opponent"
          size="sm"
          fullWidth
          value={opponent}
          onValueChange={(value) => {
            setChosen(value)
            setScore({ X: 0, O: 0, draw: 0 })
            restart(value)
          }}
          options={[
            { value: 'computer', label: 'Vs computer' },
            { value: 'human', label: 'Two players' },
          ]}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[14px] font-bold text-ink">
          {status}
        </p>
        <dl className="m-0 flex gap-3 text-[12px]">
          {(
            [
              [name('X'), score.X],
              ['Draw', score.draw],
              [name('O'), score.O],
            ] as const
          ).map(([term, value]) => (
            <div key={term} className="flex gap-1">
              <dt className="text-ink-faint">{term}</dt>
              <dd className="m-0 font-bold tabular text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div role="grid" aria-label="Tic-tac-toe board" aria-rowcount={3} aria-colcount={3} className="grid grid-rows-3 gap-2">
        {[0, 1, 2].map((row) => (
          <div role="row" key={row} className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((col) => {
              const index = row * 3 + col
              const mark = board[index]
              const winning = line?.includes(index)
              return (
                <div role="gridcell" key={col}>
                  <button
                    ref={(node) => {
                      buttons.current[index] = node
                    }}
                    type="button"
                    tabIndex={index === active ? 0 : -1}
                    aria-label={`${place(index)}, ${mark ?? 'empty'}${winning ? ', winning line' : ''}`}
                    aria-disabled={Boolean(mark) || over || computerTurn || undefined}
                    onClick={() => {
                      setActive(index)
                      if (!computerTurn) play(index)
                    }}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={cn(
                      'flex aspect-square w-full items-center justify-center rounded-[var(--radius-tile)] border text-[40px] font-extrabold leading-none transition-colors motion-reduce:transition-none',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
                      winning
                        ? 'border-accent-strong bg-accent text-accent-ink'
                        : mark
                          ? 'border-line-strong bg-surface text-ink'
                          : 'border-line bg-surface-sunken text-ink hover:bg-surface-muted',
                      over && !winning && 'opacity-60',
                    )}
                  >
                    <span aria-hidden="true">{mark === 'O' ? '○' : mark === 'X' ? '✕' : ''}</span>
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>

      <Button variant={over ? 'accent' : 'outline'} onClick={() => restart()} className="self-start">
        {over ? 'Play again' : 'Restart'}
      </Button>
    </div>
  )
}
