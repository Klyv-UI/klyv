'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Text } from '../Text'

export interface MemoryGameCard {
  /** Identifies the pair. Each card is dealt twice. */
  id: string
  /** What is drawn on the face — an emoji or an icon. */
  face: ReactNode
  /** The face in words, for the announcement and the card’s name. */
  label: string
}

export interface MemoryGameResult {
  moves: number
  seconds: number
}

export interface MemoryGameProps {
  /** One entry per pair. Eight makes a four-by-four board. */
  cards: MemoryGameCard[]
  /** Cards per row. */
  columns?: number
  /** Deal in a random order. Turn off for a fixed board in tests. */
  shuffle?: boolean
  /** How long a mismatched pair stays face up, in milliseconds. */
  mismatchDelay?: number
  /** Called once every pair is found. */
  onWin?: (result: MemoryGameResult) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Dealt {
  key: string
  pair: string
  face: ReactNode
  label: string
}

const deal = (cards: MemoryGameCard[], shuffle: boolean): Dealt[] => {
  const deck = cards.flatMap((card) => [0, 1].map((copy) => ({ key: `${card.id}-${copy}`, pair: card.id, face: card.face, label: card.label })))
  if (!shuffle) return deck
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  return deck
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Pairs, face down: turn two over, keep them if they match.
 *
 * It is a real grid, so arrow keys move between cards and only one card is a
 * tab stop; every flip is announced — “Fox”, then “Fox: a match” — because a
 * card game played by ear needs to hear what was turned over. The timer starts
 * on the first flip, not on load, so reading the rules is free. Under reduced
 * motion the cards change face without turning, and a mismatched pair can be
 * dismissed early by picking the next card rather than waiting it out.
 */
export function MemoryGame({ cards, columns = 4, shuffle = true, mismatchDelay = 900, onWin, className }: MemoryGameProps) {
  const [deck, setDeck] = useState(() => deal(cards, false))
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [active, setActive] = useState(0)
  const [message, setMessage] = useState('')
  const reduced = usePrefersReducedMotion()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const hideTimer = useRef<number>()

  const won = deck.length > 0 && found.length * 2 === deck.length

  const restart = useCallback(() => {
    window.clearTimeout(hideTimer.current)
    setDeck(deal(cards, shuffle))
    setOpen([])
    setFound([])
    setMoves(0)
    setSeconds(0)
    setRunning(false)
    setActive(0)
    setMessage('')
  }, [cards, shuffle])

  // Shuffled after mount, so the server and the first client render agree.
  useEffect(() => {
    restart()
  }, [restart])

  useEffect(() => {
    if (!running || won) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, won])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const flip = (index: number) => {
    const card = deck[index]
    if (!card || won || found.includes(card.pair) || open.includes(index)) return
    setRunning(true)

    // A mismatched pair still showing is put away by the next pick.
    const showing = open.length === 2 ? [] : open
    window.clearTimeout(hideTimer.current)

    if (showing.length === 0) {
      setOpen([index])
      setMessage(card.label)
      return
    }

    const first = deck[showing[0]]
    const nextMoves = moves + 1
    setMoves(nextMoves)
    setOpen([showing[0], index])

    if (first.pair === card.pair) {
      const nextFound = [...found, card.pair]
      setFound(nextFound)
      setOpen([])
      if (nextFound.length * 2 === deck.length) {
        setMessage(`${card.label}: a match. All ${nextFound.length} pairs found in ${nextMoves} moves and ${clock(seconds)}.`)
        onWin?.({ moves: nextMoves, seconds })
      } else {
        setMessage(`${card.label}: a match. ${nextFound.length} of ${deck.length / 2} pairs found.`)
      }
    } else {
      setMessage(`${card.label}. No match with ${first.label}.`)
      hideTimer.current = window.setTimeout(() => setOpen([]), mismatchDelay)
    }
  }

  const rows = Math.ceil(deck.length / columns)
  const move = (index: number) => {
    const next = Math.max(0, Math.min(deck.length - 1, index))
    setActive(next)
    buttons.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const row = Math.floor(index / columns)
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(index + 1),
      ArrowLeft: () => move(index - 1),
      ArrowDown: () => move(index + columns),
      ArrowUp: () => move(index - columns),
      Home: () => move(event.ctrlKey ? 0 : row * columns),
      End: () => move(event.ctrlKey ? deck.length - 1 : Math.min(deck.length - 1, row * columns + columns - 1)),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  return (
    <div className={cn('flex w-full max-w-[520px] flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="m-0 flex gap-5">
          {[
            ['Moves', String(moves)],
            ['Time', clock(seconds)],
            ['Pairs', `${found.length}/${deck.length / 2}`],
          ].map(([term, detail]) => (
            <div key={term} className="flex flex-col gap-1">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
              <dd className="m-0 text-[15px] font-extrabold leading-none text-ink tabular">{detail}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={restart}>
          {won ? 'Play again' : 'Restart'}
        </Button>
      </div>

      <div role="grid" aria-label="Memory cards" aria-rowcount={rows} aria-colcount={columns} className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, row) => (
          <div role="row" key={row} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {deck.slice(row * columns, row * columns + columns).map((card, offset) => {
              const index = row * columns + offset
              const matched = found.includes(card.pair)
              const up = matched || open.includes(index)
              return (
                <div role="gridcell" key={card.key} className="[perspective:600px]">
                  <button
                    ref={(node) => {
                      buttons.current[index] = node
                    }}
                    type="button"
                    tabIndex={index === active ? 0 : -1}
                    aria-label={up ? `${card.label}${matched ? ', matched' : ''}` : `Card ${index + 1}, face down`}
                    aria-disabled={matched || undefined}
                    onClick={() => {
                      setActive(index)
                      flip(index)
                    }}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={cn(
                      'relative block aspect-square w-full rounded-[var(--radius-tile)] [transform-style:preserve-3d]',
                      // Under reduced motion the card changes face in place instead of turning.
                      !reduced && 'transition-transform duration-300 ease-out motion-reduce:transition-none',
                      up && '[transform:rotateY(180deg)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-[var(--radius-tile)] [backface-visibility:hidden]',
                        'border border-accent-strong bg-accent text-accent-ink',
                        'bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-ink)_14%,transparent)_1.5px,transparent_1.5px)] bg-[length:12px_12px]',
                      )}
                    >
                      <span className="text-[18px] font-extrabold opacity-60">?</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-[var(--radius-tile)] border text-[clamp(22px,6vw,34px)] [backface-visibility:hidden] [transform:rotateY(180deg)]',
                        matched ? 'border-line bg-surface-sunken opacity-70' : 'border-line-strong bg-surface shadow-[var(--shadow-tile)]',
                      )}
                    >
                      {card.face}
                    </span>
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

      {won && (
        <div className="flex flex-col items-center gap-1 rounded-[var(--radius-tile)] bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] p-4 text-center">
          <Text as="p" size="heading">
            All pairs found
          </Text>
          <Text size="caption" tone="soft">{`${moves} moves in ${clock(seconds)}`}</Text>
        </div>
      )}
    </div>
  )
}
