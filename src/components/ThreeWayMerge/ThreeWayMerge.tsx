'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { Text } from '../Text'
import { Textarea } from '../Textarea'

/** One stretch of the merge: unchanged, taken from one side, or in conflict. */
export type ThreeWayMergeRegion =
  | { kind: 'stable'; lines: string[] }
  | { kind: 'auto'; from: 'ours' | 'theirs' | 'both'; lines: string[] }
  | { kind: 'conflict'; index: number; base: string[]; ours: string[]; theirs: string[] }

export type ThreeWayMergeResolution = { use: 'ours' | 'theirs' | 'both' } | { use: 'edit'; text: string }

export interface ThreeWayMergeProps {
  /** The common ancestor. */
  base: string
  /** Your side. */
  ours: string
  /** Their side. */
  theirs: string
  /** Name of your side in markers and buttons. */
  oursLabel?: string
  /** Name of their side in markers and buttons. */
  theirsLabel?: string
  /** `diff3` also writes the base between `|||||||` and `=======` in unresolved markers, as git's diff3 style does. */
  markerStyle?: 'merge' | 'diff3'
  /** Called with the merged text and the number of conflicts still open. */
  onMergedChange?: (text: string, unresolved: number) => void
  /** Merged last, so it wins. */
  className?: string
}

/** Myers' O(ND) diff. Returns the matched line pairs [a index, b index], in order. */
export function threeWayMergeMatches(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  const max = n + m
  if (max === 0) return []
  const offset = max + 1
  let v: Int32Array = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  outer: for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) (x += 1), (y += 1)
      v[offset + k] = x
      if (x >= n && y >= m) break outer
    }
  }
  const pairs: [number, number][] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    v = trace[d]!
    const k = x - y
    const prevK = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? k + 1 : k - 1
    const prevX = v[offset + prevK]!
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) pairs.push([(x -= 1), (y -= 1)])
    if (d > 0) (x = prevX), (y = prevY)
  }
  return pairs.reverse()
}

interface Hunk {
  side: 'ours' | 'theirs'
  baseStart: number
  baseEnd: number
  sideStart: number
  sideEnd: number
}

function hunks(base: string[], side: string[], name: Hunk['side']): Hunk[] {
  const out: Hunk[] = []
  let i = 0
  let j = 0
  for (const [bi, si] of [...threeWayMergeMatches(base, side), [base.length, side.length] as [number, number]]) {
    if (bi > i || si > j) out.push({ side: name, baseStart: i, baseEnd: bi, sideStart: j, sideEnd: si })
    i = bi + 1
    j = si + 1
  }
  return out
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((line, i) => line === b[i])

/**
 * diff3: diff base against each side, then walk both sets of changed hunks in
 * base order. Hunks that overlap or touch form one region; a region changed on
 * one side takes that side, a region changed identically on both is a false
 * conflict, and anything else is a real one.
 */
export function threeWayMergeRegions(base: string[], ours: string[], theirs: string[]): ThreeWayMergeRegion[] {
  const all = [...hunks(base, ours, 'ours'), ...hunks(base, theirs, 'theirs')].sort((a, b) => a.baseStart - b.baseStart || a.baseEnd - b.baseEnd)
  const regions: ThreeWayMergeRegion[] = []
  let cursor = 0
  let conflicts = 0
  for (let i = 0; i < all.length; ) {
    const group = [all[i]!]
    let end = all[i]!.baseEnd
    for (i += 1; i < all.length && all[i]!.baseStart <= end; i += 1) {
      group.push(all[i]!)
      end = Math.max(end, all[i]!.baseEnd)
    }
    const start = group[0]!.baseStart
    if (start > cursor) regions.push({ kind: 'stable', lines: base.slice(cursor, start) })
    // Each side's text for the whole region: its hunks, widened by the unchanged base lines around them.
    const sideText = (name: Hunk['side'], lines: string[]) => {
      const own = group.filter((hunk) => hunk.side === name)
      if (own.length === 0) return null
      const first = own[0]!
      const last = own[own.length - 1]!
      return lines.slice(first.sideStart - (first.baseStart - start), last.sideEnd + (end - last.baseEnd))
    }
    const a = sideText('ours', ours)
    const b = sideText('theirs', theirs)
    if (a && !b) regions.push({ kind: 'auto', from: 'ours', lines: a })
    else if (b && !a) regions.push({ kind: 'auto', from: 'theirs', lines: b })
    else if (a && b && same(a, b)) regions.push({ kind: 'auto', from: 'both', lines: a })
    else regions.push({ kind: 'conflict', index: conflicts++, base: base.slice(start, end), ours: a!, theirs: b! })
    cursor = end
  }
  if (cursor < base.length) regions.push({ kind: 'stable', lines: base.slice(cursor) })
  return regions
}

const split = (text: string) => (text === '' ? [] : text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'))

/**
 * Merges two edits of one text against their common ancestor, the way git does
 * before it gives up and writes conflict markers.
 *
 * Everything that can be decided is decided: lines only one side touched are
 * taken from that side, and a change both sides made the same way is not a
 * conflict. What is left is shown side by side with the four answers people
 * actually give — mine, theirs, both, or rewrite it — and a conflict left open
 * is written out with git's markers, so the output is always a file git would
 * recognise rather than a half-merged guess.
 */
export function ThreeWayMerge({
  base,
  ours,
  theirs,
  oursLabel = 'ours',
  theirsLabel = 'theirs',
  markerStyle = 'merge',
  onMergedChange,
  className,
}: ThreeWayMergeProps) {
  const regions = useMemo(() => threeWayMergeRegions(split(base), split(ours), split(theirs)), [base, ours, theirs])
  const conflicts = regions.filter((region): region is Extract<ThreeWayMergeRegion, { kind: 'conflict' }> => region.kind === 'conflict')
  const [resolutions, setResolutions] = useState<Record<number, ThreeWayMergeResolution>>({})
  const [editing, setEditing] = useState<number | null>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  useEffect(() => setResolutions({}), [regions])

  const resolved = (region: Extract<ThreeWayMergeRegion, { kind: 'conflict' }>): string[] | null => {
    const choice = resolutions[region.index]
    if (!choice) return null
    if (choice.use === 'edit') return split(choice.text)
    return choice.use === 'both' ? [...region.ours, ...region.theirs] : region[choice.use]
  }

  const output = regions
    .flatMap((region) => {
      if (region.kind !== 'conflict') return region.lines
      const lines = resolved(region)
      if (lines) return lines
      return [
        `<<<<<<< ${oursLabel}`,
        ...region.ours,
        ...(markerStyle === 'diff3' ? ['||||||| base', ...region.base] : []),
        '=======',
        ...region.theirs,
        `>>>>>>> ${theirsLabel}`,
      ]
    })
    .join('\n')
  const open = conflicts.filter((region) => !resolutions[region.index]).length

  const onChangeRef = useRef(onMergedChange)
  onChangeRef.current = onMergedChange
  useEffect(() => onChangeRef.current?.(output, open), [output, open])

  const jump = (direction: 1 | -1) => {
    const focused = cardRefs.current.findIndex((node) => node?.contains(document.activeElement))
    const order = conflicts.map((region) => region.index)
    const unresolvedFirst = order.filter((i) => !resolutions[i])
    const pool = unresolvedFirst.length ? unresolvedFirst : order
    const target =
      direction === 1 ? pool.find((i) => i > focused) ?? pool[0] : [...pool].reverse().find((i) => i < focused || focused === -1) ?? pool[pool.length - 1]
    const node = target === undefined ? null : cardRefs.current[target]
    node?.focus()
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const set = (index: number, resolution: ThreeWayMergeResolution | null) =>
    setResolutions((current) => {
      const next = { ...current }
      if (resolution) next[index] = resolution
      else delete next[index]
      return next
    })

  const lines = (list: string[], tone?: string) => (
    <pre className={cn('overflow-x-auto whitespace-pre-wrap break-words px-3 py-1.5 font-mono text-[12px] leading-[1.6]', tone)}>
      {list.length ? list.join('\n') : <span className="italic text-ink-faint">(nothing)</span>}
    </pre>
  )

  const autoCount = regions.filter((region) => region.kind === 'auto').length

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Text as="p" size="label" weight="semibold" tone="soft" role="status" className="flex-1">
          {autoCount} change{autoCount === 1 ? '' : 's'} merged cleanly · {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
          {conflicts.length > 0 && (open ? `, ${open} open` : ', all resolved')}
        </Text>
        <Button size="sm" variant="outline" disabled={conflicts.length === 0} onClick={() => jump(-1)}>
          Previous conflict
        </Button>
        <Button size="sm" variant="outline" disabled={conflicts.length === 0} onClick={() => jump(1)}>
          Next conflict
        </Button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {regions.map((region, i) => {
          if (region.kind === 'stable') {
            const long = region.lines.length > 6
            return (
              <div key={i} className="text-ink-soft">
                {lines(long ? region.lines.slice(0, 2) : region.lines)}
                {long && (
                  <>
                    <Text size="caption" tone="faint" className="px-3">
                      … {region.lines.length - 4} unchanged lines
                    </Text>
                    {lines(region.lines.slice(-2))}
                  </>
                )}
              </div>
            )
          }
          if (region.kind === 'auto') {
            return (
              <div key={i} className="border-l-4 border-success bg-[color-mix(in_oklab,var(--color-success)_8%,transparent)]">
                <Text size="micro" weight="bold" tone="success" className="px-3 pt-1.5 uppercase tracking-wider">
                  {region.from === 'both' ? 'Same change on both sides' : `Taken from ${region.from === 'ours' ? oursLabel : theirsLabel}`}
                </Text>
                {lines(region.lines)}
              </div>
            )
          }
          const choice = resolutions[region.index]
          const result = resolved(region)
          return (
            <section
              key={i}
              ref={(node) => void (cardRefs.current[region.index] = node)}
              tabIndex={-1}
              aria-label={`Conflict ${region.index + 1} of ${conflicts.length}`}
              className={cn('flex flex-col gap-2 border-y border-l-4 p-3', choice ? 'border-l-success border-y-line' : 'border-l-danger border-y-line bg-[color-mix(in_oklab,var(--color-danger)_6%,transparent)]')}
            >
              <Text size="label" weight="bold" tone={choice ? 'success' : 'danger'}>
                Conflict {region.index + 1} of {conflicts.length} · {choice ? `resolved (${choice.use})` : 'open'}
              </Text>
              {result && editing !== region.index ? (
                <div className="rounded-[var(--radius-tile)] border border-line bg-surface">{lines(result)}</div>
              ) : editing === region.index ? (
                <Textarea
                  aria-label={`Edit the result of conflict ${region.index + 1}`}
                  rows={Math.max(3, region.ours.length + region.theirs.length)}
                  className="font-mono text-[12px]"
                  value={choice?.use === 'edit' ? choice.text : [...region.ours, ...region.theirs].join('\n')}
                  onChange={(event) => set(region.index, { use: 'edit', text: event.target.value })}
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(['ours', 'theirs'] as const).map((side) => (
                    <div key={side} className="min-w-0 rounded-[var(--radius-tile)] border border-line bg-surface">
                      <Text size="caption" weight="bold" tone="faint" className="border-b border-line px-3 py-1.5">
                        {side === 'ours' ? oursLabel : theirsLabel}
                      </Text>
                      {lines(region[side])}
                    </div>
                  ))}
                </div>
              )}
              {region.base.length > 0 && !result && editing !== region.index && (
                <details className="text-ink-soft">
                  <summary className="cursor-pointer text-[12px] font-semibold">Base ({region.base.length} line{region.base.length === 1 ? '' : 's'})</summary>
                  {lines(region.base)}
                </details>
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Resolve conflict ${region.index + 1}`}>
                {(['ours', 'theirs', 'both'] as const).map((use) => (
                  <Button
                    key={use}
                    size="sm"
                    variant={choice?.use === use ? 'accent' : 'outline'}
                    aria-pressed={choice?.use === use}
                    onClick={() => {
                      setEditing(null)
                      set(region.index, { use })
                    }}
                  >
                    {use === 'ours' ? `Use ${oursLabel}` : use === 'theirs' ? `Use ${theirsLabel}` : 'Use both'}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={editing === region.index ? 'accent' : 'outline'}
                  aria-pressed={editing === region.index}
                  onClick={() => {
                    if (editing === region.index) return setEditing(null)
                    set(region.index, { use: 'edit', text: (result ?? [...region.ours, ...region.theirs]).join('\n') })
                    setEditing(region.index)
                  }}
                >
                  {editing === region.index ? 'Done editing' : 'Edit'}
                </Button>
                {choice && (
                  <Button size="sm" variant="ghost" onClick={() => set(region.index, null)}>
                    Reopen
                  </Button>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Text size="label" weight="bold">
            Merged result
          </Text>
          <CopyButton value={output} size="sm" />
        </div>
        <pre role="group" aria-label="Merged result" tabIndex={0} className="max-h-72 overflow-auto rounded-[var(--radius-tile)] bg-surface-sunken p-3 font-mono text-[12px] leading-[1.6] text-ink">
          {output}
        </pre>
      </div>
    </div>
  )
}
