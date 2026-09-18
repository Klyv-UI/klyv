'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'

export type SeatMapStatus = 'available' | 'taken' | 'held'

export interface SeatMapSeat {
  /** Unique across the whole venue. */
  id: string
  /** What is printed on the ticket: `12`. */
  number: number | string
  /** Position in seat widths from the section’s left edge. Defaults to the seat’s place in its row. */
  x?: number
  /** Position in row heights from the section’s top. Defaults to the row’s place in the section. */
  y?: number
  status?: SeatMapStatus
  /** Id of a price tier. */
  tier: string
}

export interface SeatMapRow {
  /** Row name: `C`. */
  label: string
  seats: SeatMapSeat[]
  /** Shifts every auto-placed seat right by this many seat widths — for curved or staggered rows. */
  offset?: number
}

export interface SeatMapSection {
  id: string
  name: string
  rows: SeatMapRow[]
  /** Where the section starts, in seat widths from the left of the map. */
  x?: number
}

export interface SeatMapTier {
  id: string
  label: string
  price: number
}

export interface SeatMapProps {
  sections: SeatMapSection[]
  /** Up to four tiers, drawn in the accent, success, warning and soft ink colours. */
  tiers: SeatMapTier[]
  /** Controlled seat ids. */
  value?: string[]
  /** Starting seat ids when uncontrolled. */
  defaultValue?: string[]
  /** Called with the chosen seat ids after every change. */
  onValueChange?: (seats: string[]) => void
  /** Most seats in one order. */
  maxSeats?: number
  /** Refuse to continue while a choice strands a single empty seat between two taken ones. */
  noSingleGaps?: boolean
  /** Label over the top of the map. */
  stageLabel?: string
  /** ISO 4217 code for prices. */
  currency?: string
  /** Shows a Continue button, enabled once the choice is valid. */
  onConfirm?: (seats: string[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const PITCH = 24
const SIZE = 18
const TIER_FILL = ['fill-accent-strong', 'fill-success', 'fill-warning', 'fill-ink-soft']
const TIER_BG = ['bg-accent-strong', 'bg-success', 'bg-warning', 'bg-ink-soft']

interface Placed {
  seat: SeatMapSeat
  section: SeatMapSection
  row: SeatMapRow
  x: number
  y: number
}

/**
 * A venue drawn from data — sections, rows and seats, each with a status and
 * a price tier — where people pick their own seats up to a limit, for any
 * booking flow where where you sit matters as much as how many.
 *
 * Each section is one tab stop; inside it the arrows move seat to seat the way
 * the eye does, left and right along a row and up and down to the nearest seat
 * in the next one, and Space takes or releases a seat. Every seat is named in
 * full — section, row, number, tier, price — so the map works without being
 * seen. The optional single-gap rule is the one box offices enforce: a choice
 * that strands one empty seat between two occupied ones is flagged, with the
 * seat named, before anyone can continue.
 */
export function SeatMap({
  sections,
  tiers,
  value,
  defaultValue = [],
  onValueChange,
  maxSeats = 6,
  noSingleGaps = false,
  stageLabel = 'Stage',
  currency = 'GBP',
  onConfirm,
  className,
}: SeatMapProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const chosen = useMemo(() => new Set(value ?? uncontrolled), [value, uncontrolled])
  const [active, setActive] = useState<Record<string, string>>({})
  const [announcement, setAnnouncement] = useState('')
  const refs = useRef<Record<string, SVGGElement | null>>({})

  const { placed, height, width } = useMemo(() => {
    const list: Placed[] = []
    let top = 2.5
    for (const section of sections) {
      section.rows.forEach((row, r) =>
        row.seats.forEach((seat, i) => list.push({ seat, section, row, x: (section.x ?? 0) + (seat.x ?? (row.offset ?? 0) + i) + 1, y: top + (seat.y ?? r) })),
      )
      top += Math.max(0, ...list.filter((p) => p.section === section).map((p) => p.y - top)) + 2.4
    }
    return { placed: list, height: top - 1, width: Math.max(1, ...list.map((p) => p.x)) + 1 }
  }, [sections])

  const price = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  const tierIndex = (id: string) => Math.max(0, tiers.findIndex((t) => t.id === id))
  const tierOf = (id: string) => tiers[tierIndex(id)]
  const free = (p: Placed) => (p.seat.status ?? 'available') === 'available'
  const nameOf = (p: Placed) => `${p.section.name}, row ${p.row.label}, seat ${p.seat.number}`

  // A stranded seat: free, not chosen, with an occupied neighbour directly on each side and at least one of them chosen.
  const strandedSeats = noSingleGaps
    ? placed.filter((p) => {
        if (!free(p) || chosen.has(p.seat.id)) return false
        const beside = (dx: number) => placed.find((q) => q.row === p.row && Math.abs(q.x - (p.x + dx)) < 0.01)
        const [l, r] = [beside(-1), beside(1)]
        const occupied = (q?: Placed) => Boolean(q && (!free(q) || chosen.has(q.seat.id)))
        return occupied(l) && occupied(r) && (chosen.has(l!.seat.id) || chosen.has(r!.seat.id))
      })
    : []

  const toggle = (p: Placed) => {
    if (!free(p)) return setAnnouncement(`${nameOf(p)} is ${p.seat.status === 'held' ? 'on hold' : 'taken'}.`)
    const on = chosen.has(p.seat.id)
    if (!on && chosen.size >= maxSeats) return setAnnouncement(`You can choose up to ${maxSeats} seats. Release one first.`)
    const next = on ? [...chosen].filter((id) => id !== p.seat.id) : [...chosen, p.seat.id]
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
    setAnnouncement(`${nameOf(p)} ${on ? 'released' : 'chosen'}. ${next.length} of ${maxSeats} seats.`)
  }

  const onKeyDown = (section: SeatMapSection, current: Placed) => (event: KeyboardEvent) => {
    const mine = placed.filter((p) => p.section === section)
    const sameRow = mine.filter((p) => p.row === current.row).sort((a, b) => a.x - b.x)
    const rowYs = [...new Set(mine.map((p) => p.y))].sort((a, b) => a - b)
    const nearestIn = (y: number) => mine.filter((p) => p.y === y).sort((a, b) => Math.abs(a.x - current.x) - Math.abs(b.x - current.x))[0]
    const i = sameRow.indexOf(current)
    const ry = rowYs.indexOf(current.y)
    const moves: Record<string, () => Placed | undefined> = {
      ArrowLeft: () => sameRow[i - 1],
      ArrowRight: () => sameRow[i + 1],
      ArrowUp: () => (ry > 0 ? nearestIn(rowYs[ry - 1]) : undefined),
      ArrowDown: () => (ry < rowYs.length - 1 ? nearestIn(rowYs[ry + 1]) : undefined),
      Home: () => sameRow[0],
      End: () => sameRow[sameRow.length - 1],
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      return toggle(current)
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const target = move()
    if (!target) return
    setActive((a) => ({ ...a, [section.id]: target.seat.id }))
    refs.current[target.seat.id]?.focus()
  }

  const picked = placed.filter((p) => chosen.has(p.seat.id))
  const total = picked.reduce((sum, p) => sum + (tierOf(p.seat.tier)?.price ?? 0), 0)

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <svg viewBox={`0 0 ${width * PITCH} ${height * PITCH}`} role="group" aria-label="Seat map" className="w-full select-none">
        <rect x={PITCH} y={4} width={(width - 1) * PITCH - PITCH} height={PITCH * 0.9} rx={8} className="fill-surface-muted" />
        <text x={(width * PITCH) / 2} y={4 + PITCH * 0.6} textAnchor="middle" className="fill-ink-soft text-[11px] font-bold uppercase tracking-widest">
          {stageLabel}
        </text>
        {sections.map((section) => {
          const mine = placed.filter((p) => p.section === section)
          const stop = active[section.id] ?? mine.find(free)?.seat.id ?? mine[0]?.seat.id
          const top = Math.min(...mine.map((p) => p.y))
          const left = Math.min(...mine.map((p) => p.x))
          return (
            <g key={section.id} role="group" aria-label={`${section.name}, ${mine.filter(free).length} seats free`}>
              <text x={left * PITCH} y={(top - 0.55) * PITCH} className="fill-ink-faint text-[10px] font-bold uppercase tracking-wider">
                {section.name}
              </text>
              {section.rows.map((row) => {
                const first = mine.find((p) => p.row === row)
                return first ? (
                  <text key={row.label} x={(left - 0.6) * PITCH} y={first.y * PITCH + 4} textAnchor="middle" aria-hidden="true" className="fill-ink-faint text-[10px] font-semibold">
                    {row.label}
                  </text>
                ) : null
              })}
              {mine.map((p) => {
                const on = chosen.has(p.seat.id)
                const status = p.seat.status ?? 'available'
                const tier = tierOf(p.seat.tier)
                const cx = p.x * PITCH
                const cy = p.y * PITCH
                return (
                  <g
                    key={p.seat.id}
                    ref={(node) => {
                      refs.current[p.seat.id] = node
                    }}
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={status !== 'available' || undefined}
                    aria-label={`${nameOf(p)}, ${status === 'available' ? `${tier?.label ?? ''} ${tier ? price(tier.price) : ''}` : status === 'held' ? 'on hold' : 'taken'}`}
                    tabIndex={p.seat.id === stop ? 0 : -1}
                    onClick={() => {
                      setActive((a) => ({ ...a, [section.id]: p.seat.id }))
                      toggle(p)
                    }}
                    onFocus={() => setActive((a) => ({ ...a, [section.id]: p.seat.id }))}
                    onKeyDown={onKeyDown(section, p)}
                    className={cn('group outline-none', status === 'available' ? 'cursor-pointer' : 'cursor-not-allowed')}
                  >
                    <rect x={cx - SIZE / 2 - 3} y={cy - SIZE / 2 - 3} width={SIZE + 6} height={SIZE + 6} rx={8} className="fill-none stroke-focus opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
                    <rect
                      x={cx - SIZE / 2}
                      y={cy - SIZE / 2}
                      width={SIZE}
                      height={SIZE}
                      rx={5}
                      strokeWidth={1.5}
                      strokeDasharray={status === 'held' ? '3 2' : undefined}
                      className={cn(
                        on ? 'fill-ink stroke-ink' : status === 'taken' ? 'fill-line-strong stroke-line-strong' : status === 'held' ? 'fill-surface stroke-ink-faint' : cn(TIER_FILL[tierIndex(p.seat.tier) % 4], 'stroke-transparent group-hover:stroke-ink'),
                      )}
                    />
                    {on && <path d={`M${cx - 4.5} ${cy + 0.5}l3 3 6-6.5`} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-ink-inverse" />}
                    {status === 'taken' && <path d={`M${cx - 3.5} ${cy - 3.5}l7 7M${cx + 3.5} ${cy - 3.5}l-7 7`} strokeWidth={1.5} strokeLinecap="round" className="stroke-ink-faint" />}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-ink-soft">
        {tiers.map((tier, index) => (
          <li key={tier.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-[var(--radius-4)]', TIER_BG[index % 4])} />
            {tier.label} <span className="font-semibold tabular-nums text-ink">{price(tier.price)}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[var(--radius-4)] bg-ink" />
          Your seats
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[var(--radius-4)] bg-line-strong" />
          Taken
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[var(--radius-4)] border border-dashed border-ink-faint" />
          On hold
        </li>
      </ul>

      <div className="flex flex-col gap-3 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">
            {picked.length} of {maxSeats} seats
          </span>
          <span className="text-[18px] font-extrabold tabular-nums text-ink">{price(total)}</span>
        </div>
        {picked.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <li key={p.seat.id} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-ink">
                {p.section.name} {p.row.label}
                {p.seat.number} <span className="font-medium text-ink-faint">· {tierOf(p.seat.tier)?.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[12px] font-medium text-ink-faint">Choose seats on the map. Arrow keys move between seats; Space chooses.</span>
        )}
        {strandedSeats.length > 0 && (
          <InlineMessage tone="warning">
            {`Please don’t leave a single empty seat: ${strandedSeats.map((p) => `${p.section.name} ${p.row.label}${p.seat.number}`).join(', ')}.`}
          </InlineMessage>
        )}
        {onConfirm && (
          <Button disabled={picked.length === 0 || strandedSeats.length > 0} onClick={() => onConfirm([...chosen])} className="self-end">
            Continue
          </Button>
        )}
      </div>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
