'use client'

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { SERIES_COLORS } from '../../lib/chart'
import { Badge } from '../Badge'
import { svgId } from '../internal/plot'

export interface CommitGraphCommit {
  /** Full hash. The first seven characters are shown. */
  hash: string
  /** Parent hashes, first parent first. Two or more make a merge. */
  parents: string[]
  message: string
  author: string
  /** Shown as given when a string; a Date is printed as a short date. */
  date?: Date | string
  /** Branch names pointing here — `main`, `origin/feature/login`. */
  refs?: string[]
  /** Tag names pointing here — `v2.4.0`. */
  tags?: string[]
}

export interface CommitGraphProps {
  /** Newest first, parents after their children — the order `git log --topo-order` prints. */
  commits: CommitGraphCommit[]
  /** Accessible name for the list. */
  label: string
  /** Selected commit hash. Controlled. */
  value?: string | null
  /** Initially selected hash when uncontrolled. */
  defaultValue?: string | null
  /** Called when the selection moves, by click or arrow key. */
  onValueChange?: (hash: string, commit: CommitGraphCommit) => void
  /** Height of the scrolling list in pixels. */
  maxHeight?: number
  /** Merged last, so it wins. */
  className?: string
}

const ROW = 44
const LANE = 16
const PAD = 12

interface CommitGraphRow {
  lane: number
  /** Lane slots after this commit: the hash each lane is waiting for. */
  after: (string | null)[]
  /** Lanes this commit’s extra parents continue in. */
  merges: number[]
}

/**
 * Assigns every commit a lane, the way `git log --graph` does. Each lane holds
 * the hash it expects next; a commit takes the first lane waiting for it (or a
 * free one, if it is a branch tip), frees the other lanes that were waiting for
 * it — that is where a branch closes — and hands its lane to its first parent.
 * Extra parents join the lane already waiting for them, or open a new one.
 */
export function commitGraphLanes(commits: CommitGraphCommit[]) {
  const lanes: (string | null)[] = []
  const claim = (hash: string) => {
    let slot = lanes.indexOf(null)
    if (slot === -1) slot = lanes.length
    lanes[slot] = hash
    return slot
  }
  const rows: CommitGraphRow[] = commits.map((commit) => {
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) lane = claim(commit.hash)
    lanes.forEach((hash, slot) => {
      if (hash === commit.hash && slot !== lane) lanes[slot] = null
    })
    const [first, ...rest] = commit.parents
    lanes[lane] = first ?? null
    const merges = rest.map((parent) => {
      const existing = lanes.indexOf(parent)
      return existing === -1 ? claim(parent) : existing
    })
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()
    return { lane, after: [...lanes], merges }
  })
  const width = Math.max(1, ...rows.map((row) => Math.max(row.lane + 1, row.after.length)))
  return { rows, width }
}

const curve = (x0: number, y0: number, x1: number, y1: number) =>
  x0 === x1 ? `M${x0} ${y0}V${y1}` : `M${x0} ${y0}C${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2} ${x1} ${y1}`

/**
 * Git history as lanes, beside the commit list it explains.
 *
 * A flat list of commits hides the one thing a reviewer needs from history:
 * which work came in on which branch, and where it merged. The lanes are
 * computed from parent hashes alone — no layout hints — so any `git log` output
 * can be fed in. Merge commits are hollow, branches keep their colour down the
 * page, and refs and tags sit on the commit they point at.
 *
 * The list is a listbox: one tab stop, Up and Down (and Home, End, Page keys)
 * move the selection, and each option reads as hash, refs, message and author.
 */
export function CommitGraph({ commits, label, value, defaultValue = null, onValueChange, maxHeight = 440, className }: CommitGraphProps) {
  const baseId = useId()
  const base = svgId(baseId)
  const [own, setOwn] = useState<string | null>(defaultValue)
  const selectedHash = value !== undefined ? value : own
  const selected = commits.findIndex((commit) => commit.hash === selectedHash)
  const { rows, width } = useMemo(() => commitGraphLanes(commits), [commits])
  const graphWidth = width * LANE + PAD
  const xOf = (lane: number) => PAD / 2 + lane * LANE + LANE / 2
  const yOf = (row: number) => row * ROW + ROW / 2
  const colorOf = (lane: number) => SERIES_COLORS[lane % SERIES_COLORS.length]

  const select = (index: number) => {
    const commit = commits[index]
    if (!commit) return
    if (value === undefined) setOwn(commit.hash)
    onValueChange?.(commit.hash, commit)
  }

  useEffect(() => {
    if (selected < 0) return
    document.getElementById(`${base}-${selected}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, base])

  const onKeyDown = (event: KeyboardEvent) => {
    const page = Math.max(1, Math.floor(maxHeight / ROW) - 1)
    const from = selected < 0 ? -1 : selected
    const next = {
      ArrowDown: Math.min(commits.length - 1, from + 1),
      ArrowUp: Math.max(0, from - 1),
      Home: 0,
      End: commits.length - 1,
      PageDown: Math.min(commits.length - 1, from + page),
      PageUp: Math.max(0, from - page),
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
  }

  const edges: { d: string; color: string; key: string }[] = []
  rows.forEach((row, r) => {
    const before = r > 0 ? rows[r - 1].after : []
    const nextRow = rows[r + 1]
    row.after.forEach((hash, slot) => {
      if (hash === null) return
      const end = nextRow ? (commits[r + 1].hash === hash ? nextRow.lane : slot) : slot
      const y1 = nextRow ? yOf(r + 1) : yOf(r) + ROW / 2
      const fromNode = slot === row.lane || (row.merges.includes(slot) && before[slot] !== hash)
      if (fromNode) edges.push({ d: curve(xOf(row.lane), yOf(r), xOf(end), y1), color: colorOf(slot), key: `${r}-${slot}-n` })
      else {
        edges.push({ d: curve(xOf(slot), yOf(r), xOf(end), y1), color: colorOf(slot), key: `${r}-${slot}-p` })
        if (row.merges.includes(slot)) edges.push({ d: curve(xOf(row.lane), yOf(r), xOf(slot), yOf(r) + ROW / 2), color: colorOf(slot), key: `${r}-${slot}-m` })
      }
    })
  })

  const dateOf = (date?: Date | string) =>
    date instanceof Date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : date ?? ''

  return (
    <div
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={selected >= 0 ? `${base}-${selected}` : undefined}
      onKeyDown={onKeyDown}
      className={cn('relative w-full overflow-auto rounded-[var(--radius-card)] border border-line bg-surface outline-offset-2', className)}
      style={{ maxHeight }}
    >
      <svg aria-hidden="true" width={graphWidth} height={commits.length * ROW} className="pointer-events-none absolute left-0 top-0">
        {edges.map((edge) => (
          <path key={edge.key} d={edge.d} fill="none" stroke={edge.color} strokeWidth="2" strokeLinecap="round" />
        ))}
        {rows.map((row, r) => {
          const merge = commits[r].parents.length > 1
          return (
            <circle
              key={commits[r].hash}
              cx={xOf(row.lane)}
              cy={yOf(r)}
              r={r === selected ? 6 : 4.5}
              fill={merge ? 'var(--color-surface)' : colorOf(row.lane)}
              stroke={r === selected ? 'var(--color-ink)' : merge ? colorOf(row.lane) : 'var(--color-surface)'}
              strokeWidth={merge || r === selected ? 2.25 : 1.5}
            />
          )
        })}
      </svg>
      {commits.map((commit, index) => {
        const isSelected = index === selected
        return (
          <div
            key={commit.hash}
            id={`${base}-${index}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => select(index)}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 border-b border-line pr-3 last:border-b-0',
              isSelected ? 'bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)]' : 'hover:bg-surface-sunken',
            )}
            style={{ height: ROW, paddingLeft: graphWidth + 4 }}
          >
            <code className="shrink-0 font-mono text-[11px] font-bold text-ink-soft">{commit.hash.slice(0, 7)}</code>
            {commit.parents.length > 1 && <span className="sr-only">merge commit,</span>}
            {(commit.refs ?? []).map((ref) => (
              <Badge key={ref} className="shrink-0">
                {ref}
              </Badge>
            ))}
            {(commit.tags ?? []).map((tag) => (
              <Badge key={tag} tone="neutral" className="shrink-0 gap-1">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M2 2h6l6 6-6 6-6-6z" />
                  <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
                </svg>
                <span className="sr-only">tag</span>
                {tag}
              </Badge>
            ))}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{commit.message}</span>
            <span className="hidden shrink-0 text-[11px] font-medium text-ink-faint sm:inline">
              {commit.author}
              {commit.date ? ` · ${dateOf(commit.date)}` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
