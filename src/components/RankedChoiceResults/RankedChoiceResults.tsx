'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { SegmentedControl } from '../SegmentedControl'

export interface RankedChoiceResultsBallot {
  /** Candidates in order of preference. Unknown names and repeats are skipped. */
  ranking: string[]
  /** How many identical ballots this line stands for. */
  count?: number
}

export interface RankedChoiceResultsRound {
  /** Votes held by each continuing candidate this round. */
  tallies: Record<string, number>
  /** Ballots with no continuing preference left. */
  exhausted: number
  /** Candidates still in the count at the start of the round. */
  continuing: string[]
  /** Votes needed to win: more than half of the ballots still in play. */
  majority: number
  /** Votes gained this round from the previous elimination, by candidate and `exhausted`. */
  transfers: Record<string, number>
  /** Who is eliminated at the end of this round. */
  eliminated?: string
  /** How a tie for last place was settled, when there was one. */
  tieBreak?: string
  /** Set on the final round when someone has a majority. */
  winner?: string
}

export interface RankedChoiceResultsProps {
  candidates: string[]
  ballots: RankedChoiceResultsBallot[]
  /** Accessible name and heading for the results. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

/** Reads `A > B > C` lines, with an optional `12:` prefix for repeated ballots. `#` starts a comment. */
export function parseRankedBallots(text: string): RankedChoiceResultsBallot[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s*[:x×]\s*(.*)$/.exec(line)
      const body = match ? match[2] : line
      return { ranking: body.split(/\s*[>,]\s*/).map((name) => name.trim()).filter(Boolean), count: match ? Number(match[1]) : 1 }
    })
}

/**
 * Instant-runoff counting. Each round every ballot counts for its highest
 * continuing preference; if nobody holds more than half of the ballots still
 * in play, the last-placed candidate is eliminated and their ballots move on.
 *
 * Ties for last place are broken backwards: the candidate with fewer votes in
 * the most recent earlier round where the tied candidates differed goes out.
 * If they were level in every round, the one listed later in `candidates` goes.
 */
export function instantRunoff(candidates: string[], ballots: RankedChoiceResultsBallot[]) {
  const rounds: RankedChoiceResultsRound[] = []
  let continuing = [...candidates]
  let winner: string | undefined
  while (continuing.length && rounds.length <= candidates.length) {
    const tallies: Record<string, number> = Object.fromEntries(continuing.map((name) => [name, 0]))
    let exhausted = 0
    for (const ballot of ballots) {
      const choice = ballot.ranking.find((name) => name in tallies)
      if (choice) tallies[choice] += ballot.count ?? 1
      else exhausted += ballot.count ?? 1
    }
    const active = Object.values(tallies).reduce((sum, value) => sum + value, 0)
    const majority = Math.floor(active / 2) + 1
    const previous = rounds[rounds.length - 1]
    const transfers: Record<string, number> = {}
    if (previous) {
      for (const name of continuing) if (tallies[name] > previous.tallies[name]) transfers[name] = tallies[name] - previous.tallies[name]
      if (exhausted > previous.exhausted) transfers.exhausted = exhausted - previous.exhausted
    }
    const round: RankedChoiceResultsRound = { tallies, exhausted, continuing, majority, transfers }
    rounds.push(round)
    const leader = continuing.reduce((best, name) => (tallies[name] > tallies[best] ? name : best), continuing[0])
    if (active > 0 && (tallies[leader] >= majority || continuing.length === 1)) {
      round.winner = winner = leader
      break
    }
    if (active === 0) break
    const low = Math.min(...continuing.map((name) => tallies[name]))
    let tied = continuing.filter((name) => tallies[name] === low)
    if (tied.length > 1) {
      const names = tied.join(', ')
      for (let back = rounds.length - 2; back >= 0 && tied.length > 1; back -= 1) {
        const least = Math.min(...tied.map((name) => rounds[back].tallies[name]))
        tied = tied.filter((name) => rounds[back].tallies[name] === least)
      }
      round.tieBreak =
        tied.length > 1
          ? `${names} tied in every round; ${tied[tied.length - 1]} is listed last and goes out.`
          : `${names} tied for last; ${tied[0]} had fewer votes in an earlier round.`
    }
    round.eliminated = tied[tied.length - 1]
    continuing = continuing.filter((name) => name !== round.eliminated)
  }
  return { rounds, winner }
}

const number = (value: number) => value.toLocaleString()

/**
 * Ranked-choice results counted in the open: every round of an instant runoff
 * as a bar chart you can step through, where each eliminated candidate's
 * ballots went, and the whole count as a table.
 *
 * The objection people raise to ranked voting is that the result is a black
 * box. The answer is to show the count exactly as it was done — who was last,
 * how a tie was broken, and how many ballots ran out of preferences — so the
 * winner can be checked by hand from the table. The counting is exported as
 * instantRunoff, and parseRankedBallots reads `A > B > C` lines.
 */
export function RankedChoiceResults({ candidates, ballots, label, className }: RankedChoiceResultsProps) {
  const headingId = useId()
  const { rounds, winner } = useMemo(() => instantRunoff(candidates, ballots), [candidates, ballots])
  const [picked, setPicked] = useState<number | null>(null)
  const index = Math.min(picked ?? rounds.length - 1, rounds.length - 1)
  const round = rounds[index]
  const total = ballots.reduce((sum, ballot) => sum + (ballot.count ?? 1), 0)
  const out = (name: string) => rounds.findIndex((entry) => entry.eliminated === name)

  if (!round) {
    return <p className={cn('text-[12px] font-medium text-ink-soft', className)}>No ballots to count yet.</p>
  }
  const prior = rounds[index - 1]
  const max = Math.max(round.majority, ...Object.values(round.tallies), 1)
  const moved = prior?.eliminated ? Object.entries(round.transfers) : []
  const movedTotal = moved.reduce((sum, [, value]) => sum + value, 0)

  return (
    <section aria-labelledby={headingId} className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-[15px] font-bold text-ink">
            {label}
          </h3>
          <p className="text-[12px] font-medium text-ink-soft">
            {number(total)} ballots ·{' '}
            {winner ? (
              <>
                <strong className="font-bold text-ink">{winner}</strong> wins in round {rounds.length} with{' '}
                {number(rounds[rounds.length - 1].tallies[winner])} votes
              </>
            ) : (
              'no winner'
            )}
          </p>
        </div>
        {rounds.length > 1 && (
          <SegmentedControl
            size="sm"
            label="Round"
            value={String(index)}
            onValueChange={(value) => setPicked(Number(value))}
            options={rounds.map((_, i) => ({ value: String(i), label: `Round ${i + 1}` }))}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {`Round ${index + 1}: ${candidates
          .filter((name) => name in round.tallies)
          .map((name) => `${name} ${round.tallies[name]}`)
          .join(', ')}.${round.eliminated ? ` ${round.eliminated} is eliminated.` : ''}${round.winner ? ` ${round.winner} wins.` : ''}`}
      </p>
      <div className="flex flex-col gap-2">
        {candidates.map((name) => {
          const inRound = name in round.tallies
          const votes = round.tallies[name] ?? 0
          const gained = round.transfers[name] ?? 0
          const eliminatedAt = out(name)
          return (
            <div key={name} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3">
              <span className={cn('truncate text-[12px] font-semibold', inRound ? 'text-ink' : 'text-ink-faint line-through')}>{name}</span>
              <div className="relative h-5 rounded-[var(--radius-4)] bg-track">
                {inRound && (
                  <>
                    <div
                      className={cn('absolute inset-y-0 left-0 rounded-l-[var(--radius-4)]', round.winner === name ? 'bg-accent-strong' : 'bg-ink-soft')}
                      style={{ width: `${((votes - gained) / max) * 100}%` }}
                    />
                    {gained > 0 && (
                      <div
                        className="absolute inset-y-0 bg-accent"
                        style={{ left: `${((votes - gained) / max) * 100}%`, width: `${(gained / max) * 100}%` }}
                      />
                    )}
                  </>
                )}
                <div aria-hidden="true" className="absolute -inset-y-1 w-px bg-danger" style={{ left: `${(round.majority / max) * 100}%` }} />
              </div>
              <span className="text-right text-[12px] font-bold tabular-nums text-ink">
                {inRound ? number(votes) : `out R${eliminatedAt + 1}`}
                {gained > 0 && <span className="ml-1 text-[10px] font-semibold text-success">+{number(gained)}</span>}
              </span>
            </div>
          )
        })}
        <p className="text-[11px] font-medium text-ink-faint">
          <span className="mr-1 inline-block h-2.5 w-px bg-danger align-middle" /> {number(round.majority)} to win this round ·{' '}
          {number(round.exhausted)} exhausted
          {round.eliminated && ` · ${round.eliminated} is eliminated`}
          {round.winner && ` · ${round.winner} has a majority`}
        </p>
        {round.tieBreak && <p className="text-[11px] font-semibold text-warning">Tie-break: {round.tieBreak}</p>}
      </div>

      {prior?.eliminated && movedTotal > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-tile)] bg-surface-muted p-3">
          <span className="text-[12px] font-semibold text-ink">
            {number(prior.tallies[prior.eliminated])} ballots from {prior.eliminated} moved on
          </span>
          <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
            {moved.map(([to, value], i) => (
              <div
                key={to}
                className={cn(to === 'exhausted' ? 'bg-ink-faint' : i % 2 ? 'bg-accent-strong' : 'bg-ink')}
                style={{ width: `${(value / movedTotal) * 100}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {moved.map(([to, value]) => (
              <li key={to} className="text-[11px] font-medium text-ink-soft">
                {to === 'exhausted' ? 'Exhausted' : `To ${to}`}: <strong className="font-bold text-ink">{number(value)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <caption className="sr-only">{label}: votes in every round</caption>
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th scope="col" className="py-1.5 pr-3 text-left font-semibold">
                Candidate
              </th>
              {rounds.map((_, i) => (
                <th key={i} scope="col" className={cn('px-2 py-1.5 text-right font-semibold', i === index && 'text-ink')}>
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...candidates, 'Exhausted'].map((name) => (
              <tr key={name} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-ink">
                  {name}
                </th>
                {rounds.map((entry, i) => {
                  const value = name === 'Exhausted' ? entry.exhausted : entry.tallies[name]
                  const gain = entry.transfers[name === 'Exhausted' ? 'exhausted' : name]
                  return (
                    <td
                      key={i}
                      className={cn(
                        'px-2 py-1.5 text-right tabular-nums',
                        entry.winner === name ? 'font-bold text-ink' : value === undefined ? 'text-ink-faint' : 'font-medium text-ink-soft',
                        i === index && 'bg-surface-muted',
                      )}
                    >
                      {value === undefined ? '—' : number(value)}
                      {gain ? <span className="ml-1 text-[10px] text-success">+{number(gain)}</span> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
