'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Field } from '../Field'
import { Input } from '../Input'
import { Switch } from '../Switch'
import { compare, formatSet, parseRange, parseVersion, satisfies, type SemverRangeVerdict, type SemverRangeVersion } from './semver'

export interface SemverRangeProps {
  /** Controlled range, e.g. `^1.2.3 || >=2.1 <3`. */
  value?: string
  /** Starting range when uncontrolled. */
  defaultValue?: string
  /** Called with the range after every edit. */
  onValueChange?: (value: string) => void
  /** Published versions to test against the range. */
  versions: string[]
  /** Controlled npm `includePrerelease` option. */
  includePrerelease?: boolean
  /** Starting option when uncontrolled. */
  defaultIncludePrerelease?: boolean
  /** Called when the prerelease switch changes. */
  onIncludePrereleaseChange?: (include: boolean) => void
  /** Visible label for the range field. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Row {
  text: string
  version: SemverRangeVersion | null
  verdict: SemverRangeVerdict | null
}

/**
 * A semver range and the versions it lets in, worked out the way npm does
 * it — so `^0.2.3` stops before 0.3.0, `1.2 - 2.0` runs to the end of 2.0.x,
 * and `1.3.0-rc.1` stays out of `^1.2.3` unless the range names a prerelease
 * of 1.3.0.
 *
 * Ranges are read far more than written, and the sugar hides the bounds. So
 * the range is shown expanded into the comparators npm evaluates, with each
 * written part explained, and every version is marked in, out, or out only
 * because it is a prerelease — the rule that surprises people most. The
 * highest match is what `npm install` would pick.
 */
export function SemverRange({
  value,
  defaultValue = '^1.2.3',
  onValueChange,
  versions,
  includePrerelease,
  defaultIncludePrerelease = false,
  onIncludePrereleaseChange,
  label = 'Version range',
  className,
}: SemverRangeProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const [preState, setPreState] = useState(defaultIncludePrerelease)
  const range = value ?? uncontrolled
  const pre = includePrerelease ?? preState
  const parsed = useMemo(() => parseRange(range), [range])

  const rows: Row[] = useMemo(() => {
    const list = versions.map((text) => {
      const version = parseVersion(text)
      return { text, version, verdict: version && parsed.ok ? satisfies(version, parsed.sets, pre) : null }
    })
    return list.sort((a, b) => (a.version && b.version ? compare(b.version, a.version) : a.version ? -1 : b.version ? 1 : 0))
  }, [versions, parsed, pre])
  const best = rows.find((row) => row.verdict?.ok)
  const matching = rows.filter((row) => row.verdict?.ok).length

  const set = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }
  const setPre = (next: boolean) => {
    if (includePrerelease === undefined) setPreState(next)
    onIncludePrereleaseChange?.(next)
  }

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={label} error={parsed.ok ? undefined : parsed.error} className="min-w-[220px] flex-1">
          <Input value={range} onChange={(event) => set(event.target.value)} spellCheck={false} autoComplete="off" className="font-mono" />
        </Field>
        <label className="flex h-10 items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={pre} onChange={(event) => setPre(event.target.checked)} />
          Include prereleases
        </label>
      </div>

      {parsed.ok && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">What npm reads</span>
          {parsed.sets.map((s, index) => (
            <div key={index} className="flex flex-col gap-1">
              <p className="text-[12px] font-medium text-ink-soft">
                {parsed.sets.length > 1 && <span className="font-semibold text-ink">{index === 0 ? 'Either ' : 'or '}</span>}
                <code className="rounded-[var(--radius-4)] bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] font-semibold text-ink">{formatSet(s)}</code>
              </p>
              <ul className="flex flex-col gap-0.5 pl-3">
                {s.notes.map((note, n) => (
                  <li key={n} className="text-[12px] font-medium leading-normal text-ink-soft">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!pre && <p className="text-[11px] font-medium leading-normal text-ink-faint">Prereleases match only when a comparator in the same set names a prerelease of the same major.minor.patch.</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p id={`${uid}-summary`} role="status" className="text-[12px] font-semibold text-ink-soft">
          {parsed.ok ? (
            <>
              {matching} of {versions.length} versions match
              {best ? (
                <>
                  {' '}· highest <span className="font-mono text-ink">{best.text}</span>
                </>
              ) : null}
            </>
          ) : (
            'Fix the range to test versions.'
          )}
        </p>
        <ul aria-labelledby={`${uid}-summary`} className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
          {rows.map((row) => {
            const ok = row.verdict?.ok
            const status = !row.version ? 'not a valid version' : !row.verdict ? '' : row.verdict.ok ? (parsed.ok && parsed.sets.length > 1 ? `matches set ${row.verdict.set + 1}` : 'matches') : row.verdict.reason === 'prerelease' ? 'in range, but a prerelease' : 'outside the range'
            return (
              <li key={row.text} className={cn('flex items-center gap-3 px-3 py-1.5', row === best && 'bg-[color-mix(in_oklab,var(--color-accent)_22%,transparent)]')}>
                <span
                  aria-hidden="true"
                  className={cn('flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', ok ? 'bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-success' : 'bg-surface-muted text-ink-faint')}
                >
                  {ok ? '✓' : '–'}
                </span>
                <span className={cn('min-w-0 flex-1 truncate font-mono text-[12px]', ok ? 'font-semibold text-ink' : 'text-ink-soft')}>{row.text}</span>
                {row === best && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">highest match</span>}
                <span className={cn('text-[11px] font-medium', row.verdict && !row.verdict.ok && row.verdict.reason === 'prerelease' ? 'text-ink' : 'text-ink-faint', !row.version && 'text-danger')}>{status}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
