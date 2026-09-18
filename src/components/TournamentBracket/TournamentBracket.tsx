'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { PlotAnnouncer } from '../internal/plot'

export type TournamentBracketFormat = 'single' | 'double'

/** A reported score. `entrants` records who played, so a score goes stale if an earlier result changes. */
export interface TournamentBracketResult {
  top: number | null
  bottom: number | null
  entrants: [string, string]
}

export type TournamentBracketResults = Record<string, TournamentBracketResult>

export interface TournamentBracketProps {
  /** Entrants in seed order: the first is the top seed. */
  entrants: string[]
  /** Single elimination, or double with a losers' bracket and a grand final that can reset. */
  format?: TournamentBracketFormat
  /** Controlled results, keyed by match id. */
  results?: TournamentBracketResults
  /** Results when uncontrolled. */
  defaultResults?: TournamentBracketResults
  onResultsChange?: (results: TournamentBracketResults) => void
  /** Accessible name for the bracket. */
  label: string
  /** Show results without score inputs. */
  readOnly?: boolean
  /** Merged last, so it wins. */
  className?: string
}

type Source = { seed: number } | { winnerOf: string } | { loserOf: string }
type Player = string | typeof BYE | null
interface Match {
  id: string
  part: 'W' | 'L' | 'F'
  round: number
  index: number
  slots: [Source, Source]
  x: number
  y: number
  name: string
}

const BYE: unique symbol = Symbol('bye')
const W = 196
const H = 60
const GAP = 14
const COL = W + 44

/** Standard seeding order for a bracket of `size`: 1 v 16, 8 v 9, 4 v 13 … so the top seeds meet last. */
export function tournamentSeedOrder(size: number) {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((seed) => [seed, n + 1 - seed])
  }
  return order
}

function buildBracket(count: number, format: TournamentBracketFormat) {
  const k = Math.max(1, Math.ceil(Math.log2(Math.max(2, count))))
  const size = 2 ** k
  const order = tournamentSeedOrder(size)
  const matches: Match[] = []
  const add = (part: Match['part'], round: number, index: number, slots: [Source, Source], name: string) => {
    const match: Match = { id: `${part}${round}-${index}`, part, round, index, slots, x: 0, y: 0, name }
    matches.push(match)
    return match
  }
  const named = (round: number, rounds: number) =>
    round === rounds - 1 ? (format === 'double' ? 'Winners final' : 'Final') : round === rounds - 2 ? 'Semifinal' : round === rounds - 3 ? 'Quarterfinal' : `Round ${round + 1}`
  const wb: Match[][] = []
  for (let round = 0; round < k; round += 1) {
    const n = size / 2 ** (round + 1)
    wb.push(
      Array.from({ length: n }, (_, i) => {
        const slots: [Source, Source] = round === 0
          ? [{ seed: order[2 * i] }, { seed: order[2 * i + 1] }]
          : [{ winnerOf: wb[round - 1][2 * i].id }, { winnerOf: wb[round - 1][2 * i + 1].id }]
        const match = add('W', round, i, slots, named(round, k))
        match.x = round * COL
        match.y = round === 0 ? i * (H + GAP) : (wb[round - 1][2 * i].y + wb[round - 1][2 * i + 1].y) / 2
        return match
      }),
    )
  }
  const wbFinal = wb[k - 1][0]
  if (format === 'single' || k < 2) return { matches, champion: wbFinal.id, reset: null as Match | null }

  const top = size / 2 * (H + GAP) + 40
  let lb: Match[] = []
  let column = 0
  const lbRound = (slots: [Source, Source][], y: (i: number) => number) => {
    lb = slots.map((pair, i) => {
      const match = add('L', column, i, pair, `Losers round ${column + 1}`)
      match.x = column * COL
      match.y = y(i)
      return match
    })
    column += 1
  }
  lbRound(
    wb[0].filter((_, i) => i % 2 === 0).map((_, i) => [{ loserOf: wb[0][2 * i].id }, { loserOf: wb[0][2 * i + 1].id }]),
    (i) => top + i * 2 * (H + GAP),
  )
  for (let wr = 1; wr < k; wr += 1) {
    const prev = lb
    const drops = wb[wr]
    lbRound(
      prev.map((match, i) => [{ winnerOf: match.id }, { loserOf: drops[wr % 2 ? prev.length - 1 - i : i].id }]),
      (i) => prev[i].y,
    )
    if (wr < k - 1) {
      const feed = lb
      lbRound(
        feed.filter((_, i) => i % 2 === 0).map((_, i) => [{ winnerOf: feed[2 * i].id }, { winnerOf: feed[2 * i + 1].id }]),
        (i) => (feed[2 * i].y + feed[2 * i + 1].y) / 2,
      )
    }
  }
  const last = Math.max(k, column)
  const final = add('F', 0, 0, [{ winnerOf: wbFinal.id }, { winnerOf: lb[0].id }], 'Grand final')
  final.x = last * COL
  final.y = (wbFinal.y + lb[0].y) / 2
  const reset = add('F', 1, 0, [{ winnerOf: wbFinal.id }, { winnerOf: lb[0].id }], 'Grand final reset')
  reset.x = (last + 1) * COL
  reset.y = final.y
  return { matches, champion: final.id, reset }
}

/**
 * A knockout bracket generated from a seeded list: byes go to the top seeds by
 * standard seeding, and entering a score moves the winner on by itself.
 *
 * Brackets are usually drawn by hand once and then kept up to date by hand,
 * which is where the wrong team ends up in a semifinal. Here the bracket is a
 * function of the seeds and the scores, so nothing downstream can disagree
 * with a result — change an early score and every later match is recomputed,
 * and scores for pairings that no longer happen are ignored instead of
 * silently carried over. Double elimination sends each loser to the losers'
 * bracket and adds a reset if the losers' champion wins the grand final.
 * Matches are one tab stop: arrows move up and down a round and left and right
 * along the path of the winner.
 */
export function TournamentBracket({
  entrants,
  format = 'single',
  results: resultsProp,
  defaultResults = {},
  onResultsChange,
  label,
  readOnly = false,
  className,
}: TournamentBracketProps) {
  const [state, setState] = useState(defaultResults)
  const results = resultsProp ?? state
  const [focusId, setFocusId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const refs = useRef(new Map<string, HTMLDivElement>())
  const { matches, champion, reset } = useMemo(() => buildBracket(entrants.length, format), [entrants.length, format])
  const byId = new Map(matches.map((match) => [match.id, match]))

  const outcome = new Map<string, { players: [Player, Player]; winner: Player; loser: Player; played: boolean }>()
  const resolveSource = (source: Source): Player => {
    if ('seed' in source) return entrants[source.seed - 1] ?? BYE
    const done = resolve(byId.get('winnerOf' in source ? source.winnerOf : source.loserOf)!)
    return 'winnerOf' in source ? done.winner : done.loser
  }
  const resolve = (match: Match) => {
    const known = outcome.get(match.id)
    if (known) return known
    const players: [Player, Player] = [resolveSource(match.slots[0]), resolveSource(match.slots[1])]
    const [a, b] = players
    let winner: Player = null
    let loser: Player = null
    let played = false
    if (a === BYE || b === BYE) {
      if (a !== null && b !== null) [winner, loser] = (a === BYE ? [b, a] : [a, b]) as [Player, Player]
    } else if (a && b) {
      const result = results[match.id]
      if (result && result.entrants[0] === a && result.entrants[1] === b && result.top !== null && result.bottom !== null && result.top !== result.bottom) {
        played = true
        ;[winner, loser] = (result.top > result.bottom ? [a, b] : [b, a]) as [Player, Player]
      }
    }
    const done: { players: [Player, Player]; winner: Player; loser: Player; played: boolean } = { players, winner, loser, played }
    outcome.set(match.id, done)
    return done
  }
  matches.forEach(resolve)
  const grand = outcome.get(champion)!
  const needsReset = !!reset && grand.played && grand.winner === grand.players[1]
  const visible = matches.filter((match) => match !== reset || needsReset)
  const winner = needsReset ? outcome.get(reset!.id)!.winner : grand.winner
  const nameOf = (player: Player) => (player === BYE ? 'Bye' : player ?? 'To be decided')

  const setScore = (match: Match, slot: 0 | 1, raw: string) => {
    const players = outcome.get(match.id)!.players as [string, string]
    const previous = results[match.id]
    const fresh = previous && previous.entrants[0] === players[0] && previous.entrants[1] === players[1] ? previous : { top: null, bottom: null, entrants: players }
    const score = raw === '' ? null : Math.max(0, Math.floor(Number(raw)))
    const next = { ...results, [match.id]: { ...fresh, [slot === 0 ? 'top' : 'bottom']: Number.isFinite(score) ? score : null } }
    if (resultsProp === undefined) setState(next)
    onResultsChange?.(next)
  }

  const feeds = (id: string) => visible.find((match) => match.slots.some((slot) => 'winnerOf' in slot && slot.winnerOf === id))
  const move = (event: KeyboardEvent<HTMLDivElement>, match: Match) => {
    if (event.target !== event.currentTarget) return
    let target: Match | undefined
    const column = visible.filter((entry) => entry.x === match.x && entry.part === match.part).sort((a, b) => a.y - b.y)
    const at = column.indexOf(match)
    if (event.key === 'ArrowDown') target = column[at + 1]
    else if (event.key === 'ArrowUp') target = column[at - 1]
    else if (event.key === 'ArrowRight') target = feeds(match.id)
    else if (event.key === 'ArrowLeft') {
      const source = match.slots.find((slot) => 'winnerOf' in slot) as { winnerOf: string } | undefined
      target = source && byId.get(source.winnerOf)
    } else if (event.key === 'Home') target = visible[0]
    else if (event.key === 'End') target = byId.get(champion)
    else return
    event.preventDefault()
    if (!target) return
    setFocusId(target.id)
    refs.current.get(target.id)?.focus()
    const done = outcome.get(target.id)!
    setMessage(`${title(target)}: ${nameOf(done.players[0])} versus ${nameOf(done.players[1])}${done.winner ? `, ${nameOf(done.winner)} advances` : ''}.`)
  }

  const width = Math.max(...visible.map((match) => match.x)) + W + 8
  const height = Math.max(...visible.map((match) => match.y)) + H + 8
  const headers = new Map<string, { x: number; y: number; text: string }>()
  const partTop = (part: Match['part']) => Math.min(...visible.filter((match) => match.part === part).map((match) => match.y))
  for (const match of visible) {
    const text = /^(Semi|Quarter)final$/.test(match.name) ? `${match.name}s` : match.name
    headers.set(`${match.part}${match.x}`, { x: match.x, y: match.part === 'F' ? match.y : partTop(match.part), text })
  }
  const siblings = (match: Match) => matches.filter((entry) => entry.part === match.part && entry.round === match.round).length
  const title = (match: Match) => (siblings(match) > 1 ? `${match.name} ${match.index + 1}` : match.name)
  const tabTarget = focusId && visible.some((match) => match.id === focusId) ? focusId : visible[0]?.id

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {winner && winner !== BYE && (
        <p className="text-[13px] font-bold text-ink" role="status">
          Champion: <span className="rounded-full bg-accent px-2 py-0.5 text-accent-ink">{winner}</span>
        </p>
      )}
      <div className="w-full overflow-auto rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div role="group" aria-label={label} className="relative" style={{ width, height: height + 22 }}>
          <svg aria-hidden="true" width={width} height={height + 22} className="absolute left-0 top-0">
            {visible.flatMap((match) =>
              match.slots.map((slot, s) => {
                if (!('winnerOf' in slot)) return null
                const from = byId.get(slot.winnerOf)!
                if (match.part === 'F' && match.round === 1) return null
                const x1 = from.x + W
                const y1 = from.y + 22 + H / 2
                const x2 = match.x
                const y2 = match.y + 22 + (s === 0 ? H / 4 : (H * 3) / 4)
                const mid = x2 - 20
                return <path key={`${match.id}-${s}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" strokeWidth={1.5} className="stroke-line-strong" />
              }),
            )}
          </svg>
          {[...headers.values()].map((header) => (
            <span key={`${header.x}-${header.y}`} aria-hidden="true" className="absolute text-[10px] font-bold uppercase tracking-wider text-ink-faint" style={{ left: header.x, top: header.y }}>
              {header.text}
            </span>
          ))}
          {visible.map((match) => {
            const done = outcome.get(match.id)!
            const result = results[match.id]
            const live = done.played || (!!result && result.entrants[0] === done.players[0] && result.entrants[1] === done.players[1])
            const playable = !readOnly && typeof done.players[0] === 'string' && typeof done.players[1] === 'string'
            const bye = done.players.includes(BYE)
            return (
              <div
                key={match.id}
                ref={(node) => {
                  if (node) refs.current.set(match.id, node)
                  else refs.current.delete(match.id)
                }}
                role="group"
                aria-label={`${title(match)}: ${nameOf(done.players[0])} versus ${nameOf(done.players[1])}`}
                tabIndex={match.id === tabTarget ? 0 : -1}
                onKeyDown={(event) => move(event, match)}
                onFocus={() => setFocusId(match.id)}
                className={cn(
                  'absolute flex flex-col overflow-hidden rounded-[var(--radius-glyph)] border border-line-strong bg-surface-muted',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  bye && 'opacity-60',
                )}
                style={{ left: match.x, top: match.y + 22, width: W, height: H }}
              >
                {([0, 1] as const).map((slot) => {
                  const player = done.players[slot]
                  const won = done.winner !== null && done.winner === player && player !== BYE
                  const source = match.slots[slot]
                  const seed = 'seed' in source ? source.seed : null
                  const score = live ? (slot === 0 ? result?.top : result?.bottom) : null
                  return (
                    <div key={slot} className={cn('flex h-1/2 items-center gap-2 px-2', slot === 0 && 'border-b border-line', won && 'bg-accent text-accent-ink')}>
                      <span className="w-4 text-right text-[10px] font-bold tabular-nums opacity-70">{seed ?? ''}</span>
                      <span className={cn('min-w-0 flex-1 truncate text-[12px]', player === null || player === BYE ? 'font-medium italic text-ink-faint' : 'font-semibold', won && 'text-accent-ink')}>
                        {player === null && !('seed' in source)
                          ? `${'winnerOf' in source ? 'Winner' : 'Loser'} of ${title(byId.get('winnerOf' in source ? source.winnerOf : source.loserOf)!)}`
                          : nameOf(player)}
                      </span>
                      {playable ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${nameOf(player)} score, ${title(match)}`}
                          value={score ?? ''}
                          onChange={(event) => setScore(match, slot, event.target.value)}
                          className="h-6 w-10 rounded-[var(--radius-6)] border border-line bg-surface px-1 text-center text-[12px] font-bold tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-focus"
                        />
                      ) : (
                        <span className="w-10 text-center text-[12px] font-bold tabular-nums">{score ?? ''}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <PlotAnnouncer message={message} />
    </div>
  )
}
