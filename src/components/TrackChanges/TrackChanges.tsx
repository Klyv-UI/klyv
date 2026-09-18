'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'

export type TrackChangesDecision = 'accepted' | 'rejected'

export interface TrackChangesProps {
  /** The text as it stands. */
  original: string
  /** The text with the suggested edits applied. */
  suggested: string
  /** Called with the resulting text after every decision. Undecided changes keep the original words. */
  onValueChange?: (text: string, pending: number) => void
  /** Accessible name of the document. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Op = { type: 'equal' | 'delete' | 'insert'; token: string }
type Segment = { kind: 'equal'; text: string } | { kind: 'change'; id: number; deleted: string; inserted: string }

/** Words, runs of whitespace and single punctuation marks, so a changed comma is its own change. */
const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{N}'’_-]+|[^\s\p{L}\p{N}]/gu) ?? []

/**
 * Myers’ O(ND) diff: the shortest edit script between two token lists, found by
 * walking diagonals of the edit graph one edit distance at a time, then
 * backtracked into a list of equal, deleted and inserted tokens.
 */
export function trackChangesDiff(a: string[], b: string[]): Op[] {
  const max = a.length + b.length
  const v = new Array<number>(2 * max + 2).fill(0)
  const trace: number[][] = []
  const pick = (vv: number[], k: number, d: number) => k === -d || (k !== d && vv[max + k - 1] < vv[max + k + 1])
  outer: for (let d = 0; d <= max; d++) {
    trace.push([...v])
    for (let k = -d; k <= d; k += 2) {
      let x = pick(v, k, d) ? v[max + k + 1] : v[max + k - 1] + 1
      let y = x - k
      while (x < a.length && y < b.length && a[x] === b[y]) {
        x++
        y++
      }
      v[max + k] = x
      if (x >= a.length && y >= b.length) break outer
    }
  }
  const ops: Op[] = []
  let x = a.length
  let y = b.length
  for (let d = trace.length - 1; d >= 0; d--) {
    const vv = trace[d]
    const k = x - y
    const prevK = pick(vv, k, d) ? k + 1 : k - 1
    const prevX = vv[max + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', token: a[--x] })
      y--
    }
    if (d === 0) break
    if (x === prevX) ops.push({ type: 'insert', token: b[--y] })
    else ops.push({ type: 'delete', token: a[--x] })
  }
  return ops.reverse()
}

function segment(original: string, suggested: string): Segment[] {
  const ops = trackChangesDiff(tokenize(original), tokenize(suggested))
  const out: Segment[] = []
  let id = 0
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const prev = out[out.length - 1]
    if (op.type === 'equal') {
      // Whitespace between two edits joins them into one, so a rewritten phrase reads as one change.
      const nextChange = ops.slice(i + 1).find((o) => o.type !== 'equal' || !/^\s+$/.test(o.token))
      if (prev?.kind === 'change' && /^\s+$/.test(op.token) && nextChange && nextChange.type !== 'equal') {
        prev.deleted += op.token
        prev.inserted += op.token
      } else if (prev?.kind === 'equal') prev.text += op.token
      else out.push({ kind: 'equal', text: op.token })
      continue
    }
    const change = prev?.kind === 'change' ? prev : (out[out.push({ kind: 'change', id: id++, deleted: '', inserted: '' }) - 1] as Extract<Segment, { kind: 'change' }>)
    if (op.type === 'delete') change.deleted += op.token
    else change.inserted += op.token
  }
  return out
}

const quote = (text: string) => `“${text.trim()}”`
const describe = (s: Extract<Segment, { kind: 'change' }>) =>
  s.deleted.trim() && s.inserted.trim() ? `replace ${quote(s.deleted)} with ${quote(s.inserted)}` : s.inserted.trim() ? `insert ${quote(s.inserted)}` : `delete ${quote(s.deleted)}`

/**
 * Suggested edits shown in place — struck-through deletions beside underlined
 * insertions — each accepted or rejected on its own, for reviewing an AI
 * rewrite, a colleague’s copy edit, or a contract redline.
 *
 * The changes are computed, not supplied: a word-level Myers diff between the
 * original and the suggestion, with whitespace between two edits folded in so
 * a rewritten phrase is one decision rather than five. Changes are a single
 * tab stop; arrows or J and K move between them, A or Enter accepts, R or
 * Delete rejects, U undoes, and the text that would result is reported after
 * every decision.
 */
export function TrackChanges({ original, suggested, onValueChange, label = 'Suggested edits', className }: TrackChangesProps) {
  const uid = useId()
  const segments = useMemo(() => segment(original, suggested), [original, suggested])
  const changes = segments.filter((s): s is Extract<Segment, { kind: 'change' }> => s.kind === 'change')
  const [decisions, setDecisions] = useState<Record<number, TrackChangesDecision>>({})
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const refs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    setDecisions({})
    setActive(0)
  }, [segments])

  const textFor = (d: Record<number, TrackChangesDecision>) => segments.map((s) => (s.kind === 'equal' ? s.text : d[s.id] === 'accepted' ? s.inserted : s.deleted)).join('')

  const decide = (next: Record<number, TrackChangesDecision>, message: string) => {
    setDecisions(next)
    const pending = changes.filter((c) => !next[c.id]).length
    onValueChange?.(textFor(next), pending)
    setAnnouncement(`${message} ${pending === 0 ? 'All changes resolved.' : `${pending} left.`}`)
  }

  const set = (id: number, decision: TrackChangesDecision | null, focus = false) => {
    const next = { ...decisions }
    if (decision) next[id] = decision
    else delete next[id]
    decide(next, decision ? `Change ${id + 1} ${decision}.` : `Change ${id + 1} back to pending.`)
    // Move on to the next undecided change, as a reviewer would.
    if (decision) {
      const after = changes.find((c) => c.id > id && !next[c.id]) ?? changes.find((c) => !next[c.id])
      if (after) go(after.id, focus)
    }
  }

  const all = (decision: TrackChangesDecision) => decide(Object.fromEntries(changes.map((c) => [c.id, decision])), `All ${changes.length} changes ${decision}.`)

  const go = (index: number, focus = true) => {
    if (changes.length === 0) return
    const next = (index + changes.length) % changes.length
    setActive(next)
    if (focus) refs.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, id: number) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const actions: Record<string, () => void> = {
      ArrowRight: () => go(id + 1),
      ArrowDown: () => go(id + 1),
      j: () => go(id + 1),
      ArrowLeft: () => go(id - 1),
      ArrowUp: () => go(id - 1),
      k: () => go(id - 1),
      Home: () => go(0),
      End: () => go(changes.length - 1),
      a: () => set(id, 'accepted', true),
      Enter: () => set(id, 'accepted', true),
      r: () => set(id, 'rejected', true),
      Delete: () => set(id, 'rejected', true),
      Backspace: () => set(id, 'rejected', true),
      u: () => set(id, null, true),
    }
    const action = actions[key]
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    action()
  }

  const current = changes[Math.min(active, changes.length - 1)]
  const resolved = changes.filter((c) => decisions[c.id]).length

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div role="group" aria-label={label} aria-describedby={`${uid}-help`} className="whitespace-pre-wrap rounded-[var(--radius-tile)] border border-line bg-surface px-4 py-3.5 text-[14px] font-medium leading-[1.9] text-ink">
        {segments.map((s, index) => {
          if (s.kind === 'equal') return <span key={`e${index}`}>{s.text}</span>
          const decision = decisions[s.id]
          const status = decision ?? 'pending'
          return (
            <span
              key={`c${s.id}`}
              ref={(node) => {
                refs.current[s.id] = node
              }}
              role="button"
              tabIndex={s.id === current?.id ? 0 : -1}
              aria-label={`Change ${s.id + 1} of ${changes.length}: ${describe(s)}. ${status}.`}
              onClick={() => setActive(s.id)}
              onFocus={() => setActive(s.id)}
              onKeyDown={(event) => onKeyDown(event, s.id)}
              className={cn('cursor-pointer rounded-[var(--radius-4)] px-px', s.id === current?.id && 'ring-1 ring-ink-faint')}
            >
              {decision === 'accepted' ? (
                <span className="underline decoration-success decoration-dotted decoration-2 underline-offset-4">{s.inserted}</span>
              ) : decision === 'rejected' ? (
                <span className="underline decoration-ink-faint decoration-dotted decoration-2 underline-offset-4">{s.deleted}</span>
              ) : (
                <>
                  {s.deleted && <del className="bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger decoration-danger">{s.deleted}</del>}
                  {s.inserted && <ins className="bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-success decoration-success underline-offset-4">{s.inserted}</ins>}
                </>
              )}
            </span>
          )
        })}
      </div>
      <p id={`${uid}-help`} className="sr-only">
        Arrow keys move between changes. A or Enter accepts, R or Delete rejects, U undoes.
      </p>

      {changes.length === 0 ? (
        <p className="text-[12px] font-medium text-ink-faint">No differences.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12px] font-bold text-ink">
              Change {current.id + 1} of {changes.length}
              <span className="font-medium text-ink-faint">
                {' '}
                · {resolved} resolved{decisions[current.id] ? ` · ${decisions[current.id]}` : ''}
              </span>
            </span>
            <span className="truncate text-[12px] font-medium text-ink-soft">{describe(current).replace(/^./, (c) => c.toUpperCase())}</span>
          </div>
          <Button size="sm" variant="ghost" aria-label="Previous change" onClick={() => go(current.id - 1)}>
            ‹
          </Button>
          <Button size="sm" variant="ghost" aria-label="Next change" onClick={() => go(current.id + 1)}>
            ›
          </Button>
          {decisions[current.id] ? (
            <Button size="sm" variant="outline" onClick={() => set(current.id, null)}>
              Undo
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => set(current.id, 'rejected')}>
                Reject
              </Button>
              <Button size="sm" onClick={() => set(current.id, 'accepted')}>
                Accept
              </Button>
            </>
          )}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-line-strong" />
          <Button size="sm" variant="ghost" onClick={() => all('rejected')}>
            Reject all
          </Button>
          <Button size="sm" variant="muted" onClick={() => all('accepted')}>
            Accept all
          </Button>
        </div>
      )}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
