'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'

export interface SpacedRepetitionCard {
  id: string
  /** The prompt. */
  front: string
  /** The answer, shown after the reveal. */
  back: string
  /** SM-2 easiness factor. New cards start at 2.5; it never drops below 1.3. */
  ease: number
  /** Days from the last review to the next. */
  interval: number
  /** Passing reviews in a row since the last lapse. */
  repetitions: number
  /** Times a card that had been learned was forgotten. */
  lapses: number
  /** When it is next due, in epoch milliseconds. New cards use 0. */
  due: number
  /** Every review, and the ones graded 3 or better — retention is their ratio. */
  reviews: number
  passed: number
}

/** SM-2 quality: 0–2 is a failure to recall, 3 is hard, 4 is good, 5 is easy. */
export type SpacedRepetitionGrade = 0 | 1 | 2 | 3 | 4 | 5

export interface SpacedRepetitionProps {
  /** The deck, controlled. Every review replaces a card through `onCardsChange`. */
  cards?: SpacedRepetitionCard[]
  /** The deck, uncontrolled. */
  defaultCards?: SpacedRepetitionCard[]
  onCardsChange?: (cards: SpacedRepetitionCard[]) => void
  /** Called after each scheduled review with the card before and after. */
  onReview?: (before: SpacedRepetitionCard, grade: SpacedRepetitionGrade, after: SpacedRepetitionCard) => void
  /** The current time in epoch ms. Inject it to test schedules or demo the passing of days. */
  now?: number
  /** Four buttons mapped onto SM-2, or the raw 0–5 scale. */
  grading?: 'buttons' | 'scale'
  /** Days shown in the review forecast. */
  forecastDays?: number
  /** Merged last, so it wins. */
  className?: string
}

const DAY = 86_400_000

/** A new card, due immediately, with SM-2’s starting ease. */
export function spacedRepetitionCard(id: string, front: string, back: string): SpacedRepetitionCard {
  return { id, front, back, ease: 2.5, interval: 0, repetitions: 0, lapses: 0, due: 0, reviews: 0, passed: 0 }
}

/**
 * One SM-2 review, as SuperMemo published it in 1987.
 *
 * A pass (3 or more) moves the card to the next interval — 1 day, then 6, then
 * the previous interval times the ease — and adjusts the ease by
 * 0.1 − (5 − q)(0.08 + (5 − q)·0.02), floored at 1.3. A failure starts the
 * repetitions again at one day and leaves the ease alone, as the original does.
 */
export function spacedRepetitionReview(card: SpacedRepetitionCard, grade: SpacedRepetitionGrade, now: number): SpacedRepetitionCard {
  const pass = grade >= 3
  let { ease, interval, repetitions, lapses } = card
  if (pass) {
    interval = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * ease)
    repetitions += 1
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
  } else {
    if (repetitions > 0) lapses += 1
    repetitions = 0
    interval = 1
  }
  return { ...card, ease, interval, repetitions, lapses, due: now + interval * DAY, reviews: card.reviews + 1, passed: card.passed + (pass ? 1 : 0) }
}

const BUTTONS: { grade: SpacedRepetitionGrade; label: string; key: string }[] = [
  { grade: 1, label: 'Again', key: '1' },
  { grade: 3, label: 'Hard', key: '2' },
  { grade: 4, label: 'Good', key: '3' },
  { grade: 5, label: 'Easy', key: '4' },
]
const SCALE: { grade: SpacedRepetitionGrade; label: string; key: string }[] = [0, 1, 2, 3, 4, 5].map((grade) => ({
  grade: grade as SpacedRepetitionGrade,
  label: String(grade),
  key: String(grade),
}))

function spanOf(days: number) {
  if (days < 30) return `${days} d`
  if (days < 365) return `${(days / 30).toFixed(days < 300 ? 1 : 0)} mo`
  return `${(days / 365).toFixed(1)} yr`
}

const endOfDay = (time: number) => {
  const date = new Date(time)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

interface Turn {
  id: string
  /** A re-run of a card already scheduled this session — SM-2 repeats anything below 4 until it sticks. */
  drill: boolean
}

/**
 * Flashcards on the SM-2 schedule.
 *
 * SM-2 is small enough to read in one sitting and still the base of most
 * spaced-repetition tools, so it is implemented exactly rather than
 * approximated: the ease formula, the 1-then-6-day start, and the rule that a
 * failure resets the run but not the ease. Its other rule is kept too — any
 * card answered below 4 comes back at the end of the session until it is
 * answered well, without being rescheduled a second time.
 *
 * The deck is plain data the caller owns, so it can be stored anywhere, and
 * the clock is a prop, so a schedule can be tested — or demonstrated — by
 * moving `now` forward instead of waiting a week. Each grade button shows the
 * interval it would set, the same preview dedicated apps give.
 */
export function SpacedRepetition({
  cards: cardsProp,
  defaultCards = [],
  onCardsChange,
  onReview,
  now: nowProp,
  grading = 'buttons',
  forecastDays = 14,
  className,
}: SpacedRepetitionProps) {
  const [inner, setInner] = useState(defaultCards)
  const cards = cardsProp ?? inner
  const [queue, setQueue] = useState<Turn[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [message, setMessage] = useState('')
  const revealRef = useRef<HTMLDivElement>(null)
  const gradeRef = useRef<HTMLDivElement>(null)
  const id = useId()
  /** Where focus goes once the controls an action swapped in exist: the answer button, or the default grade. */
  const focusNext = useRef<'reveal' | 'grade' | null>(null)
  const studyRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focusNext.current) return
    const target =
      focusNext.current === 'grade'
        ? gradeRef.current?.querySelector<HTMLButtonElement>('[data-default]')
        : revealRef.current?.querySelector('button')
    focusNext.current = null
    // Session over: nothing to answer, so focus lands on the study panel rather than the page.
    ;(target ?? studyRef.current)?.focus()
  })
  const now = nowProp ?? Date.now()
  const today = endOfDay(now)

  const due = cards.filter((card) => card.due <= today).sort((a, b) => a.due - b.due)
  const turn = queue?.[0]
  const card = turn ? cards.find((item) => item.id === turn.id) : undefined
  const options = grading === 'buttons' ? BUTTONS : SCALE

  const setCards = (next: SpacedRepetitionCard[]) => {
    if (cardsProp === undefined) setInner(next)
    onCardsChange?.(next)
  }

  const start = () => {
    setQueue(due.map((item) => ({ id: item.id, drill: false })))
    setDone(0)
    setRevealed(false)
    setMessage(`${due.length} ${due.length === 1 ? 'card' : 'cards'} to review.`)
    focusNext.current = 'reveal'
  }

  const reveal = () => {
    if (!card) return
    setRevealed(true)
    setMessage(`Answer: ${card.back}`)
    focusNext.current = 'grade'
  }

  const grade = (value: SpacedRepetitionGrade) => {
    if (!card || !turn || !queue) return
    let rest = queue.slice(1)
    let note = ''
    if (!turn.drill) {
      const after = spacedRepetitionReview(card, value, now)
      setCards(cards.map((item) => (item.id === card.id ? after : item)))
      onReview?.(card, value, after)
      note = `Next review in ${spanOf(after.interval)}.`
    }
    if (value < 4) {
      rest = [...rest, { id: card.id, drill: true }]
      note += ' It will come back this session.'
    }
    setQueue(rest)
    setDone(done + 1)
    setRevealed(false)
    setMessage(`${note.trim()}${rest.length ? ` ${rest.length} left.` : ' Session complete.'}`)
    focusNext.current = 'reveal'
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!card || event.ctrlKey || event.metaKey || event.altKey) return
    const option = revealed ? options.find((item) => item.key === event.key) : undefined
    if (option) {
      event.preventDefault()
      grade(option.grade)
    }
  }

  // Stats and the forecast read the deck as it stands.
  const fresh = cards.filter((item) => item.reviews === 0).length
  const learned = cards.filter((item) => item.repetitions > 0).length
  const reviews = cards.reduce((sum, item) => sum + item.reviews, 0)
  const passed = cards.reduce((sum, item) => sum + item.passed, 0)
  const startOfToday = endOfDay(now) - DAY + 1
  const forecast = Array.from({ length: forecastDays }, (_, day) => {
    const from = startOfToday + day * DAY
    const count = cards.filter((item) => (day === 0 ? item.due < from + DAY : item.due >= from && item.due < from + DAY)).length
    return { day, count, label: new Date(from).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }
  })
  const peak = Math.max(1, ...forecast.map((item) => item.count))

  return (
    <div className={cn('flex w-full max-w-[560px] flex-col gap-4', className)} onKeyDown={onKeyDown}>
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Due today', due.length],
          ['New', fresh],
          ['Learned', learned],
          ['Retention', reviews ? `${Math.round((passed / reviews) * 100)}%` : '—'],
        ].map(([name, value]) => (
          <div key={name} className="flex flex-col gap-0.5 rounded-[var(--radius-tile)] bg-surface-muted px-3 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{name}</dt>
            <dd className="m-0 text-[18px] font-extrabold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section ref={studyRef} tabIndex={-1} aria-labelledby={`${id}-study`} className="flex min-h-[220px] outline-none flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-study`} className="m-0 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
            Study
          </h3>
          {queue && card && (
            <span className="text-[12px] font-semibold tabular-nums text-ink-soft">
              {done} done · {queue.length} left{turn?.drill ? ' · repeat' : ''}
            </span>
          )}
        </div>

        {!queue || !card ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="m-0 text-[14px] font-bold text-ink">
              {queue ? 'Session complete.' : due.length ? `${due.length} ${due.length === 1 ? 'card is' : 'cards are'} due.` : 'Nothing due today.'}
            </p>
            {queue && <p className="m-0 text-[12px] font-medium text-ink-soft">{due.length ? `${due.length} still due — start another round.` : 'Come back when the forecast says so.'}</p>}
            {due.length > 0 && (
              <Button size="sm" onClick={start}>
                {queue ? 'Study again' : 'Start studying'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="m-0 text-center text-[22px] font-extrabold leading-tight text-ink">{card.front}</p>
            {revealed ? (
              <>
                <div className="h-px bg-line" aria-hidden="true" />
                <p className="m-0 text-center text-[16px] font-semibold text-ink-soft">{card.back}</p>
                <div ref={gradeRef} role="group" aria-label="How well did you remember?" className={cn('mt-auto grid gap-2', grading === 'buttons' ? 'grid-cols-4' : 'grid-cols-6')}>
                  {options.map((option) => {
                    const preview = turn?.drill ? 'repeat' : spanOf(spacedRepetitionReview(card, option.grade, now).interval)
                    return (
                      <button
                        key={option.grade}
                        type="button"
                        data-default={option.grade === 4 || undefined}
                        aria-keyshortcuts={option.key}
                        aria-label={`${option.label}${grading === 'scale' ? ` out of 5` : ''}, next review ${turn?.drill ? 'unchanged' : `in ${preview}`}`}
                        onClick={() => grade(option.grade)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-[var(--radius-10)] px-2 py-2 text-[13px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                          option.grade < 3
                            ? 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_22%,transparent)]'
                            : option.grade === 4
                              ? 'bg-accent text-accent-ink hover:bg-accent-strong'
                              : 'bg-surface-muted text-ink hover:bg-line-strong',
                        )}
                      >
                        {option.label}
                        <span className="text-[11px] font-semibold tabular-nums opacity-75">{preview}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div ref={revealRef} className="mt-auto flex">
                <Button fullWidth variant="outline" onClick={reveal} aria-keyshortcuts="Space">
                  Show answer
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby={`${id}-forecast`} className="flex flex-col gap-2">
        <h3 id={`${id}-forecast`} className="m-0 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
          Reviews over the next {forecastDays} days
        </h3>
        <ol className="m-0 flex h-[96px] list-none items-end gap-1 p-0">
          {forecast.map((item) => (
            <li key={item.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold tabular-nums text-ink-soft" aria-hidden="true">
                {item.count || ''}
              </span>
              <span
                aria-hidden="true"
                className={cn('w-full rounded-t-[var(--radius-6)]', item.day === 0 ? 'bg-accent-strong' : 'bg-[color-mix(in_oklab,var(--color-accent)_55%,var(--color-surface-muted))]')}
                style={{ height: `${Math.max(item.count ? 6 : 2, (item.count / peak) * 64)}px` }}
              />
              <span className="sr-only">
                {item.day === 0 ? 'Today' : item.label}: {item.count} {item.count === 1 ? 'review' : 'reviews'}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex justify-between text-[10px] font-semibold text-ink-faint" aria-hidden="true">
          <span>Today</span>
          <span>{forecast[forecast.length - 1]?.label}</span>
        </div>
      </section>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
