'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type SolitaireSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type SolitaireDraw = 1 | 3

export interface SolitaireResult {
  moves: number
  score: number
  seconds: number
}

export interface SolitaireProps {
  /** Cards turned from the stock at a time, for the first game. The picker changes it after that. */
  defaultDraw?: SolitaireDraw
  /** Seed the shuffle to replay a deal. Leave it out for a random one each game. */
  seed?: number
  /** Called once when all four foundations are complete. */
  onWin?: (result: SolitaireResult) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Card {
  id: string
  suit: SolitaireSuit
  rank: number
  up: boolean
}

interface Table {
  stock: Card[]
  waste: Card[]
  foundations: Card[][]
  tableau: Card[][]
  score: number
  moves: number
}

/** Where cards live: `stock`, `waste`, `f0`–`f3`, `t0`–`t6`. */
type Pile = string

const SUITS: SolitaireSuit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const SYMBOL: Record<SolitaireSuit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_NAMES = ['', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king']
const red = (card: Card) => card.suit === 'hearts' || card.suit === 'diamonds'
const cardName = (card: Card) => (card.up ? `${RANK_NAMES[card.rank]} of ${card.suit}, face up` : 'face-down card')
const shortName = (card: Card) => `${RANK_NAMES[card.rank]} of ${card.suit}`
const TOP_ROW: Pile[] = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3']
const BOTTOM_ROW: Pile[] = ['t0', 't1', 't2', 't3', 't4', 't5', 't6']
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** mulberry32: small, fast, and good enough to shuffle cards reproducibly. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function deal(seed: number): Table {
  const next = random(seed)
  const deck: Card[] = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ id: `${suit}-${index + 1}`, suit, rank: index + 1, up: false })))
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1))
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  const tableau = Array.from({ length: 7 }, (_, pile) => deck.splice(0, pile + 1).map((card, index) => ({ ...card, up: index === pile })))
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, score: 0, moves: 0 }
}

const clone = (table: Table): Table => ({
  ...table,
  stock: table.stock.slice(),
  waste: table.waste.slice(),
  foundations: table.foundations.map((pile) => pile.slice()),
  tableau: table.tableau.map((pile) => pile.slice()),
})

function cardsOf(table: Table, pile: Pile): Card[] {
  if (pile === 'stock') return table.stock
  if (pile === 'waste') return table.waste
  if (pile[0] === 'f') return table.foundations[Number(pile[1])]
  return table.tableau[Number(pile[1])]
}

const top = <T,>(list: T[]) => list[list.length - 1]

/** A run can be lifted if it is face up and alternates colour going down by one. */
function isRun(cards: Card[]) {
  return cards.every((card, index) => card.up && (index === 0 || (red(card) !== red(cards[index - 1]) && card.rank === cards[index - 1].rank - 1)))
}

function canDrop(table: Table, cards: Card[], to: Pile) {
  const target = cardsOf(table, to)
  const lead = cards[0]
  if (!lead) return false
  if (to[0] === 'f') {
    if (cards.length !== 1) return false
    const head = top(target)
    return head ? head.suit === lead.suit && lead.rank === head.rank + 1 : lead.rank === 1
  }
  if (to[0] === 't') {
    const head = top(target)
    return head ? head.up && red(head) !== red(lead) && lead.rank === head.rank - 1 : lead.rank === 13
  }
  return false
}

/** Standard scoring, from the version that shipped with Windows. */
function points(from: Pile, to: Pile) {
  if (to[0] === 'f') return from[0] === 'f' ? 0 : 10
  if (from === 'waste' && to[0] === 't') return 5
  if (from[0] === 'f' && to[0] === 't') return -15
  return 0
}

/** Move `count` cards from the end of one pile to another, turning up what is uncovered. */
function moveCards(table: Table, from: Pile, count: number, to: Pile): Table {
  const next = clone(table)
  const source = cardsOf(next, from)
  const moving = source.splice(source.length - count, count)
  cardsOf(next, to).push(...moving)
  next.score = Math.max(0, next.score + points(from, to))
  const exposed = top(source)
  if (from[0] === 't' && exposed && !exposed.up) {
    source[source.length - 1] = { ...exposed, up: true }
    next.score += 5
  }
  next.moves += 1
  return next
}

function foundationFor(table: Table, card: Card): Pile | null {
  for (let index = 0; index < 4; index += 1) if (canDrop(table, [card], `f${index}`)) return `f${index}`
  return null
}

const complete = (table: Table) => table.foundations.every((pile) => pile.length === 13)
/** With the stock and waste gone and every card face up, the rest always plays out. */
const solvable = (table: Table) => !table.stock.length && !table.waste.length && table.tableau.every((pile) => pile.every((card) => card.up))

function describePile(table: Table, pile: Pile) {
  const cards = cardsOf(table, pile)
  if (pile === 'stock') return `Stock, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}${cards.length ? '' : ', turn the waste back over'}`
  if (pile === 'waste') return `Waste${cards.length ? `, top card ${cardName(top(cards))}` : ', empty'}`
  if (pile[0] === 'f') return `Foundation ${Number(pile[1]) + 1}${cards.length ? `, ${cardName(top(cards))}` : ', empty'}`
  const down = cards.filter((card) => !card.up).length
  const up = cards.filter((card) => card.up)
  return `Tableau ${Number(pile[1]) + 1}${cards.length ? `: ${down ? `${down} face-down ${down === 1 ? 'card' : 'cards'}; ` : ''}${up.map(cardName).join('; ')}` : ', empty'}`
}

function CardFace({ card, className }: { card: Card; className?: string }) {
  if (!card.up) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 rounded-[var(--radius-6)] border border-line-strong',
          'bg-[repeating-linear-gradient(45deg,var(--color-accent-strong)_0_4px,color-mix(in_oklab,var(--color-accent)_55%,var(--color-surface))_4px_8px)]',
          className,
        )}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 flex flex-col justify-between rounded-[var(--radius-6)] border border-line-strong bg-surface p-[6%] font-bold leading-none shadow-[var(--shadow-tile)]',
        red(card) ? 'text-danger' : 'text-ink',
        className,
      )}
    >
      <span className="flex items-center gap-[2px] text-[max(10px,3.1cqw)]">
        {RANKS[card.rank]}
        <span>{SYMBOL[card.suit] + '︎'}</span>
      </span>
      <span className="self-center text-[max(14px,5.4cqw)]">{SYMBOL[card.suit] + '︎'}</span>
    </div>
  )
}

/**
 * Klondike, the solitaire most people mean.
 *
 * Every rule lives in two functions — whether a run can be lifted, and whether
 * it can land — so dragging, clicking and the keyboard all ask the same
 * question and can never disagree about what is legal. Moves are applied to a
 * copy of the table, which makes undo a stack of earlier tables rather than a
 * list of inverse operations to get wrong.
 *
 * Double-clicking (or pressing F on) a card sends it to its foundation. Once
 * the stock is empty and every card is face up the game is won in principle,
 * so Finish plays it out. Scoring is the familiar one: 10 to a foundation, 5
 * from the waste or for turning a card, −15 for taking one back, −100 for
 * recycling the stock in draw-one.
 *
 * With a keyboard, each pile is a stop: arrows move between piles, Enter picks
 * up the top card (again, to take more of the run), and Enter on another pile
 * puts it down. Cards are named in full — “7 of hearts, face up”.
 */
export function Solitaire({ defaultDraw = 1, seed, onWin, className }: SolitaireProps) {
  const [draw, setDraw] = useState<SolitaireDraw>(defaultDraw)
  const [table, setTable] = useState<Table>(() => deal(seed ?? 1))
  const [history, setHistory] = useState<Table[]>([])
  const [seconds, setSeconds] = useState(0)
  const [started, setStarted] = useState(false)
  const [focus, setFocus] = useState<Pile>('stock')
  const [held, setHeld] = useState<{ pile: Pile; count: number } | null>(null)
  const [drag, setDrag] = useState<{ pile: Pile; count: number; x: number; y: number; dx: number; dy: number; active: boolean; pointer: number; width: number } | null>(null)
  const [message, setMessage] = useState('')
  const [finishing, setFinishing] = useState(false)
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const pileRefs = useRef(new Map<Pile, HTMLDivElement>())
  const reported = useRef(false)

  const won = complete(table)

  // A random deal happens after mount, so server and client agree on the first frame.
  const newGame = (drawCount = draw) => {
    setTable(deal(seed ?? Math.floor(Math.random() * 2 ** 32)))
    setHistory([])
    setSeconds(0)
    setStarted(false)
    setHeld(null)
    setFinishing(false)
    setDraw(drawCount)
    reported.current = false
  }
  useEffect(() => {
    if (seed === undefined) newGame(defaultDraw)
  }, [])

  useEffect(() => {
    if (!started || won) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [started, won])

  useEffect(() => {
    if (!won || reported.current) return
    reported.current = true
    setMessage(`All four foundations complete. Won in ${table.moves} moves, score ${table.score}.`)
    onWin?.({ moves: table.moves, score: table.score, seconds })
  }, [won])

  const commit = (next: Table, words: string) => {
    setHistory((stack) => [...stack.slice(-199), table])
    setTable(next)
    setStarted(true)
    setHeld(null)
    setMessage(words)
  }

  const turnStock = () => {
    if (table.stock.length) {
      const next = clone(table)
      const count = Math.min(draw, next.stock.length)
      const turned = next.stock.splice(next.stock.length - count, count).reverse().map((card) => ({ ...card, up: true }))
      next.waste.push(...turned)
      next.moves += 1
      commit(next, `Turned ${turned.map(shortName).join(', ')}.`)
    } else if (table.waste.length) {
      const next = clone(table)
      next.stock = next.waste.reverse().map((card) => ({ ...card, up: false }))
      next.waste = []
      next.score = Math.max(0, next.score - (draw === 1 ? 100 : 20))
      next.moves += 1
      commit(next, 'Waste turned back into the stock.')
    } else setMessage('The stock and waste are both empty.')
  }

  const tryMove = (from: Pile, count: number, to: Pile) => {
    const cards = cardsOf(table, from).slice(-count)
    if (from === to || !isRun(cards) || !canDrop(table, cards, to)) {
      setMessage(`${cards[0] ? shortName(cards[0]) : 'That'} cannot go there.`)
      return false
    }
    const next = moveCards(table, from, count, to)
    const exposed = from[0] === 't' ? top(cardsOf(next, from)) : null
    const turned = exposed && !top(cardsOf(table, from).slice(0, -count))?.up ? ` Turned up ${shortName(exposed)}.` : ''
    const place = to[0] === 'f' ? `foundation ${Number(to[1]) + 1}` : `tableau ${Number(to[1]) + 1}`
    commit(next, `${shortName(cards[0])}${count > 1 ? ` and ${count - 1} more` : ''} to ${place}.${turned}`)
    return true
  }

  const toFoundation = (from: Pile) => {
    const card = top(cardsOf(table, from))
    const target = card?.up ? foundationFor(table, card) : null
    if (!card || !target) {
      setMessage(card?.up ? `${shortName(card)} cannot go to a foundation yet.` : 'No card to send.')
      return
    }
    tryMove(from, 1, target)
  }

  // Finish: one card per tick, lowest first, so the play-out can be followed. Instant under reduced motion.
  useEffect(() => {
    if (!finishing) return
    if (won) {
      setFinishing(false)
      return
    }
    const step = (current: Table) => {
      const piles = ['waste', ...BOTTOM_ROW]
      let best: { pile: Pile; target: Pile; rank: number } | null = null
      for (const pile of piles) {
        const card = top(cardsOf(current, pile))
        const target = card && foundationFor(current, card)
        if (card && target && (!best || card.rank < best.rank)) best = { pile, target, rank: card.rank }
      }
      return best ? moveCards(current, best.pile, 1, best.target) : null
    }
    if (reduced) {
      let current = table
      for (let next = step(current); next; next = step(current)) current = next
      commit(current, 'Finished.')
      setFinishing(false)
      return
    }
    const timer = window.setTimeout(() => {
      const next = step(table)
      if (next) {
        setTable(next)
      } else setFinishing(false)
    }, 70)
    return () => window.clearTimeout(timer)
  }, [finishing, table, reduced, won])

  const activatePile = (pile: Pile) => {
    if (finishing) return
    if (pile === 'stock') {
      setHeld(null)
      turnStock()
      return
    }
    const cards = cardsOf(table, pile)
    if (held) {
      if (held.pile === pile) {
        // Again on the same pile reaches one card further into its run.
        const more = held.count + 1
        if (pile[0] === 't' && more <= cards.length && isRun(cards.slice(-more))) {
          setHeld({ pile, count: more })
          setMessage(`Holding ${more} cards from ${shortName(cards[cards.length - more])}.`)
        } else {
          setHeld(null)
          setMessage('Put back.')
        }
        return
      }
      tryMove(held.pile, held.count, pile)
      return
    }
    const card = top(cards)
    if (!card?.up) {
      setMessage(`${describePile(table, pile)}.`)
      return
    }
    setHeld({ pile, count: 1 })
    setMessage(`Picked up ${shortName(card)}. Choose a pile to put it on, or press Enter again for more of the run.`)
  }

  const onPileKeyDown = (event: KeyboardEvent<HTMLDivElement>, pile: Pile) => {
    const inTop = TOP_ROW.indexOf(pile)
    const row = inTop >= 0 ? TOP_ROW : BOTTOM_ROW
    const index = row.indexOf(pile)
    const go = (target: Pile) => {
      event.preventDefault()
      setFocus(target)
      pileRefs.current.get(target)?.focus()
    }
    if (event.key === 'ArrowRight') go(row[Math.min(row.length - 1, index + 1)])
    else if (event.key === 'ArrowLeft') go(row[Math.max(0, index - 1)])
    else if (event.key === 'ArrowDown' && inTop >= 0) go(BOTTOM_ROW[Math.min(6, index + (index > 1 ? 1 : 0))])
    else if (event.key === 'ArrowUp' && inTop < 0) go(TOP_ROW[Math.max(0, index - (index > 2 ? 1 : 0))])
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activatePile(pile)
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      toFoundation(pile)
    } else if (event.key === 'Escape' && held) {
      event.preventDefault()
      setHeld(null)
      setMessage('Put back.')
    }
  }

  /* ---------------------------------------------------------------- drag */

  const pileAt = (x: number, y: number) => {
    for (const [pile, node] of pileRefs.current) {
      const box = node.getBoundingClientRect()
      const bottom = pile[0] === 't' ? Math.max(box.bottom, box.top + box.height * 3) : box.bottom
      if (x >= box.left && x <= box.right && y >= box.top && y <= bottom) return pile
    }
    return null
  }

  const onCardPointerDown = (event: PointerEvent<HTMLDivElement>, pile: Pile, count: number) => {
    if (event.button !== 0 || finishing) return
    const cards = cardsOf(table, pile).slice(-count)
    if (!isRun(cards)) return
    event.stopPropagation()
    const box = event.currentTarget.getBoundingClientRect()
    setDrag({ pile, count, x: event.clientX, y: event.clientY, dx: event.clientX - box.left, dy: event.clientY - box.top, active: false, pointer: event.pointerId, width: box.width })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return
    if (!drag.active) rootRef.current?.setPointerCapture(event.pointerId)
    setDrag({ ...drag, x: event.clientX, y: event.clientY, active: true })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return
    setDrag(null)
    if (!drag.active) return
    const target = pileAt(event.clientX, event.clientY)
    if (target && target !== drag.pile) tryMove(drag.pile, drag.count, target)
  }

  const rootBox = rootRef.current?.getBoundingClientRect()
  const lifted = (pile: Pile, fromEnd: number) => !!drag?.active && drag.pile === pile && fromEnd < drag.count

  const renderPile = (pile: Pile) => {
    const cards = cardsOf(table, pile)
    const fanned = pile[0] === 't'
    const heldHere = held?.pile === pile
    const offsets: number[] = []
    let offset = 0
    for (const card of cards) {
      offsets.push(offset)
      offset += card.up ? 6.2 : 2.2
    }
    const visible = pile === 'waste' ? cards.slice(-Math.max(1, draw)) : fanned ? cards : cards.slice(-1)
    const start = cards.length - visible.length
    return (
      <div
        key={pile}
        ref={(node) => {
          if (node) pileRefs.current.set(pile, node)
          else pileRefs.current.delete(pile)
        }}
        role="button"
        data-pile={pile}
        tabIndex={focus === pile ? 0 : -1}
        aria-label={`${describePile(table, pile)}${heldHere ? `. Holding ${held!.count}` : held ? '. Put held cards here' : ''}`}
        aria-pressed={heldHere || undefined}
        onFocus={() => setFocus(pile)}
        onClick={() => activatePile(pile)}
        onDoubleClick={() => {
          if (pile === 'stock') return
          setHeld(null)
          toFoundation(pile)
        }}
        onKeyDown={(event) => onPileKeyDown(event, pile)}
        className={cn(
          'relative aspect-[5/7] w-full cursor-pointer rounded-[var(--radius-6)] outline-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          !cards.length && 'border-2 border-dashed border-line-strong',
          heldHere && 'outline-2 outline-offset-2 outline-accent-strong',
        )}
      >
        {!cards.length && pile[0] === 'f' && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[max(12px,4cqw)] font-bold text-ink-faint">
            A
          </span>
        )}
        {!cards.length && pile === 'stock' && table.waste.length > 0 && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[max(14px,5cqw)] text-ink-faint">
            {'↻'}
          </span>
        )}
        {visible.map((card, index) => {
          const position = start + index
          const fromEnd = cards.length - 1 - position
          const heldCard = heldHere && fromEnd < held!.count
          return (
            <div
              key={card.id}
              aria-hidden="true"
              onPointerDown={(event) => card.up && pile !== 'stock' && (pile === 'waste' || pile[0] === 'f' ? fromEnd === 0 : true) && onCardPointerDown(event, pile, fromEnd + 1)}
              className={cn('absolute inset-x-0 aspect-[5/7] touch-none', lifted(pile, fromEnd) && 'opacity-0')}
              style={{
                top: fanned ? `calc(${offsets[position]} * 1cqw)` : 0,
                left: pile === 'waste' ? `calc(${index} * 2.4cqw)` : 0,
                transform: heldCard ? 'translateY(-4px)' : undefined,
              }}
            >
              <CardFace card={card} className={heldCard ? 'border-accent-strong' : undefined} />
            </div>
          )
        })}
      </div>
    )
  }

  const tallest = Math.max(...table.tableau.map((pile) => pile.reduce((sum, card) => sum + (card.up ? 6.2 : 2.2), 0)))

  return (
    <div className={cn('flex w-full max-w-[640px] flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Cards to turn"
          size="sm"
          value={String(draw) as '1' | '3'}
          onValueChange={(value) => newGame(Number(value) as SolitaireDraw)}
          options={[
            { value: '1', label: 'Draw 1' },
            { value: '3', label: 'Draw 3' },
          ]}
        />
        <p className="m-0 flex gap-3 text-[12px] font-semibold text-ink-soft tabular-nums">
          <span>
            Moves <strong className="text-ink">{table.moves}</strong>
          </span>
          <span>
            Score <strong className="text-ink">{table.score}</strong>
          </span>
          <span>
            <span className="sr-only">Time </span>
            <strong className="text-ink">{clock(seconds)}</strong>
          </span>
        </p>
      </div>

      <div
        ref={rootRef}
        role="group"
        aria-label="Solitaire table. Arrow keys move between piles, Enter picks up and puts down, F sends a card to its foundation."
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        className="relative select-none rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--color-accent)_16%,var(--color-surface-sunken))] p-3 [container-type:inline-size]"
      >
        <div className="grid grid-cols-7 gap-[1.6cqw]">
          {renderPile('stock')}
          {renderPile('waste')}
          <div aria-hidden="true" />
          {renderPile('f0')}
          {renderPile('f1')}
          {renderPile('f2')}
          {renderPile('f3')}
        </div>
        <div className="mt-[3cqw] grid grid-cols-7 gap-[1.6cqw]" style={{ paddingBottom: `calc(${tallest} * 1cqw)` }}>
          {BOTTOM_ROW.map(renderPile)}
        </div>

        {drag?.active && rootBox && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20"
            style={{ left: drag.x - rootBox.left - drag.dx, top: drag.y - rootBox.top - drag.dy, width: drag.width }}
          >
            {cardsOf(table, drag.pile)
              .slice(-drag.count)
              .map((card, index) => (
                <div key={card.id} className="absolute inset-x-0 aspect-[5/7]" style={{ top: `calc(${index * 6.2} * 1cqw)` }}>
                  <CardFace card={card} className="shadow-[var(--shadow-float)]" />
                </div>
              ))}
          </div>
        )}

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--color-surface)_84%,transparent)]">
            <p className="m-0 text-[22px] font-extrabold text-ink">You won</p>
            <p className="m-0 text-[13px] font-semibold text-ink-soft">
              {table.moves} moves · score {table.score} · {clock(seconds)}
            </p>
            <Button size="sm" onClick={() => newGame()}>
              Deal again
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!history.length || finishing}
          onClick={() => {
            setTable(history[history.length - 1])
            setHistory(history.slice(0, -1))
            setHeld(null)
            setMessage('Move undone.')
          }}
        >
          Undo
        </Button>
        <Button size="sm" variant={solvable(table) && !won ? 'accent' : 'outline'} disabled={!solvable(table) || won || finishing}
          onClick={() => {
            setHistory((stack) => [...stack, table])
            setFinishing(true)
          }}
        >
          Finish
        </Button>
        <Button size="sm" variant="ghost" onClick={() => newGame()}>
          New deal
        </Button>
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
