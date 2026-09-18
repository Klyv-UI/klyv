'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Kbd } from '../Kbd'
import { Progress } from '../Progress'

export interface PairwiseRankerItem {
  id: string
  label: string
  /** A line of context under the label on each card. */
  description?: string
}

export interface PairwiseRankerProps {
  /** What is being ranked. Two or more. */
  items: PairwiseRankerItem[]
  /** The question asked of every pair. */
  question?: string
  /** Called once every item has a place, with tiers from first to last — tied items share a tier. */
  onComplete?: (ranking: string[][]) => void
  /** Merged last, so it wins. */
  className?: string
}

/** Where a binary insertion stands: tiers placed so far, the item being placed, and its search window. */
interface Step {
  tiers: string[][]
  queue: string[]
  current: string | null
  low: number
  high: number
  asked: number
}

const log2ceil = (n: number) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)))

/** Worst-case questions to insert into lists of these sizes: ⌈log₂(k+1)⌉ each. */
const worstCase = (from: number, to: number) => {
  let total = 0
  for (let size = from; size < to; size++) total += log2ceil(size + 1)
  return total
}

function start(ids: string[]): Step {
  const [first, second, ...rest] = ids
  return settle({ tiers: first ? [[first]] : [], queue: rest, current: second ?? null, low: 0, high: first ? 1 : 0, asked: 0 })
}

/** Place the current item once its window has closed, and pick the next one. */
function settle(step: Step): Step {
  let next = step
  while (next.current && next.low >= next.high) {
    const tiers = [...next.tiers]
    tiers.splice(next.low, 0, [next.current])
    const [current = null, ...queue] = next.queue
    next = { ...next, tiers, current, queue, low: 0, high: tiers.length }
  }
  return next
}

/**
 * Put a list in order by answering one easy question at a time: which of
 * these two matters more?
 *
 * Ranking twelve things at once is hard and the answer drifts with the order
 * they were read in; choosing between two is easy and consistent. Each new
 * item is placed by binary search over the ones already ranked, so the number
 * of questions grows as n·log n — twelve items take at most 33, not the 66 of
 * asking every pair — and the progress bar counts against that worst case.
 * A tie puts both in the same tier and saves questions; Skip sets an item
 * aside until the end. Every answer can be undone, and ← and → answer from
 * the keyboard.
 */
export function PairwiseRanker({ items, question = 'Which matters more?', onComplete, className }: PairwiseRankerProps) {
  const uid = useId()
  const ids = items.map((item) => item.id)
  const key = ids.join('|')
  const [history, setHistory] = useState<Step[]>(() => [start(ids)])
  const [keyUsed, setKeyUsed] = useState(key)
  if (keyUsed !== key) {
    setKeyUsed(key)
    setHistory([start(ids)])
  }
  const step = history[history.length - 1]
  const byId = new Map(items.map((item) => [item.id, item]))
  const done = step.current === null
  const mid = Math.floor((step.low + step.high) / 2)
  const against = step.current ? step.tiers[mid]?.[0] : undefined
  // Alternate sides, so the item being placed is not always on the left.
  const flipped = step.asked % 2 === 1
  const left = (flipped ? against : step.current) ?? undefined
  const right = (flipped ? step.current : against) ?? undefined

  const placed = step.tiers.reduce((sum, tier) => sum + tier.length, 0)
  const remainingNow = step.current ? log2ceil(step.high - step.low + 1) : 0
  const maximum = step.asked + remainingNow + worstCase(placed + 1, items.length)
  const bound = worstCase(1, items.length)

  const push = (next: Step) => setHistory((list) => [...list, settle(next)])
  const choose = (winner: string | undefined) => {
    if (!step.current || !winner) return
    const currentWins = winner === step.current
    push({ ...step, asked: step.asked + 1, ...(currentWins ? { high: mid } : { low: mid + 1 }) })
  }
  const tie = () => {
    if (!step.current || against === undefined) return
    const tiers = step.tiers.map((tier, index) => (index === mid ? [...tier, step.current!] : tier))
    const [current = null, ...queue] = step.queue
    push({ ...step, tiers, current, queue, low: 0, high: tiers.length, asked: step.asked + 1 })
  }
  const skip = () => {
    if (!step.current || step.queue.length === 0) return
    const [current, ...queue] = step.queue
    push({ ...step, current, queue: [...queue, step.current], low: 0, high: step.tiers.length })
  }
  const undo = () => setHistory((list) => (list.length > 1 ? list.slice(0, -1) : list))
  const restart = () => setHistory([start(ids)])

  const reported = useRef<Step | null>(null)
  const complete = useRef(onComplete)
  complete.current = onComplete
  useEffect(() => {
    if (done && reported.current !== step) {
      reported.current = step
      complete.current?.(step.tiers)
    }
  }, [done, step])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
    const keys: Record<string, () => void> = {
      ArrowLeft: () => choose(left),
      ArrowRight: () => choose(right),
      ArrowDown: tie,
      t: tie,
      s: skip,
      Backspace: undo,
      z: () => (event.ctrlKey || event.metaKey) && undo(),
    }
    const handler = done ? undefined : keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const card = (id: string | undefined, side: 'left' | 'right') => {
    const item = id ? byId.get(id) : undefined
    if (!item) return null
    return (
      <button
        type="button"
        onClick={() => choose(id)}
        aria-keyshortcuts={side === 'left' ? 'ArrowLeft' : 'ArrowRight'}
        className="flex min-h-[112px] flex-1 flex-col items-start justify-between gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-4 text-left shadow-[var(--shadow-tile)] transition-colors hover:border-accent-strong hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-bold text-ink">{item.label}</span>
          {item.description && <span className="text-[12px] font-medium text-ink-soft">{item.description}</span>}
        </span>
        <Kbd>{side === 'left' ? '←' : '→'}</Kbd>
      </button>
    )
  }

  let rank = 1
  return (
    <section aria-labelledby={`${uid}-question`} onKeyDown={onKeyDown} className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`${uid}-question`} className="text-[15px] font-bold text-ink">
            {done ? 'Your ranking' : question}
          </h3>
          <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-faint">
            {done ? `${step.asked} questions` : `Question ${step.asked + 1} of at most ${maximum}`}
          </span>
        </div>
        <Progress label="Ranking progress" value={done ? 1 : step.asked / Math.max(1, maximum)} max={1} />
        <p className="text-[12px] font-medium text-ink-faint">
          {items.length} items · at most {bound} questions by binary insertion, against {(items.length * (items.length - 1)) / 2} for every pair
        </p>
      </div>

      {!done ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label="Choose one">
            {card(left, 'left')}
            {card(right, 'right')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={tie} aria-keyshortcuts="T">
              Equal
            </Button>
            <Button size="sm" variant="ghost" onClick={skip} disabled={step.queue.length === 0} aria-keyshortcuts="S">
              Skip for now
            </Button>
            <Button size="sm" variant="ghost" onClick={undo} disabled={history.length < 2} aria-keyshortcuts="Backspace">
              Undo
            </Button>
            <span className="ml-auto text-[11px] font-medium text-ink-faint">
              <Kbd>←</Kbd> <Kbd>→</Kbd> choose · <Kbd>T</Kbd> equal · <Kbd>S</Kbd> skip · <Kbd>⌫</Kbd> undo
            </span>
          </div>
          <p className="sr-only" aria-live="polite">
            {left && right ? `${byId.get(left)?.label} or ${byId.get(right)?.label}?` : ''}
          </p>
        </>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {step.tiers.map((tier) => {
              const position = rank
              rank += tier.length
              return (
                <li key={tier.join()} className="flex items-center gap-3 rounded-[var(--radius-tile)] border border-line bg-surface px-3 py-2">
                  <span className="w-6 shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-accent-strong">{position}</span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-ink">
                    {tier.map((id) => (
                      <span key={id}>{byId.get(id)?.label}</span>
                    ))}
                    {tier.length > 1 && <span className="text-[11px] font-medium text-ink-faint">(tied)</span>}
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={restart}>
              Start again
            </Button>
            <Button size="sm" variant="ghost" onClick={undo} disabled={history.length < 2}>
              Undo last answer
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
