'use client'

import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Textarea } from '../Textarea'
import { findRisks, runRegex, tokenizeRegex, type RegexTesterMatch, type RegexTesterRunResult } from './regex'

export interface RegexTesterProps {
  /** Controlled pattern, without slashes. */
  value?: string
  /** Starting pattern when uncontrolled. */
  defaultValue?: string
  /** Called with the pattern after every edit. */
  onValueChange?: (value: string) => void
  /** Controlled flags, e.g. `'gi'`. */
  flags?: string
  /** Starting flags when uncontrolled. */
  defaultFlags?: string
  /** Called with the flags string when a flag is toggled. */
  onFlagsChange?: (flags: string) => void
  /** Controlled test text. */
  text?: string
  /** Starting test text when uncontrolled. */
  defaultText?: string
  /** Called with the test text after every edit. */
  onTextChange?: (text: string) => void
  /** Milliseconds a run may take before it is stopped. */
  timeout?: number
  /** Most matches collected before the run stops. */
  maxMatches?: number
  /** Merged last, so it wins. */
  className?: string
}

const FLAGS: [string, string][] = [
  ['g', 'global'],
  ['i', 'ignore case'],
  ['m', 'multiline'],
  ['s', 'dot matches newline'],
  ['u', 'unicode'],
  ['y', 'sticky'],
]

type Status =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: RegexTesterRunResult }
  | { kind: 'timeout' }
  | { kind: 'refused' }

function workerFor(): Worker | null {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null
  try {
    const source = `var runRegex = ${runRegex.toString()};\nself.onmessage = function (e) { var d = e.data; self.postMessage(d === 'ping' ? 'pong' : runRegex(d.source, d.flags, d.text, d.max, d.budget)) }`
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const worker = new Worker(url)
    URL.revokeObjectURL(url)
    return worker
  } catch {
    return null
  }
}

/**
 * Whether Workers actually run here. Some embedded browsers and locked-down
 * pages construct a Worker that never starts; without this check every run
 * there would time out and be blamed on the pattern. Asked once per page.
 */
let probe: Promise<boolean> | null = null
function workersRun(): Promise<boolean> {
  probe ??= new Promise((resolve) => {
    const worker = workerFor()
    if (!worker) return resolve(false)
    const timer = setTimeout(() => {
      worker.terminate()
      resolve(false)
    }, 1500)
    worker.onmessage = () => {
      clearTimeout(timer)
      worker.terminate()
      resolve(true)
    }
    worker.onerror = () => {
      clearTimeout(timer)
      worker.terminate()
      resolve(false)
    }
    worker.postMessage('ping')
  })
  return probe
}

const TINTS = ['bg-[color-mix(in_oklab,var(--color-accent)_45%,transparent)]', 'bg-[color-mix(in_oklab,var(--syntax-type)_22%,transparent)]']

/**
 * A regular expression, some text, and everything in between: live matches
 * marked in the text, a table of every match with its numbered and named
 * groups, and the pattern read back token by token in plain words.
 *
 * It also refuses to let the pattern hang the page. Shapes that backtrack
 * exponentially — a quantified group with a quantifier inside, (a+)+, or
 * quantified branches that can start the same way, (a|ab)* — are flagged
 * before anything runs, and every run happens in a Worker the page kills after
 * `timeout` milliseconds. Without Workers it runs on the page only when the
 * pattern has no such shape, and says so when it will not.
 */
export function RegexTester({
  value,
  defaultValue = '',
  onValueChange,
  flags,
  defaultFlags = 'g',
  onFlagsChange,
  text,
  defaultText = '',
  onTextChange,
  timeout = 1000,
  maxMatches = 1000,
  className,
}: RegexTesterProps) {
  const uid = useId()
  const [patternState, setPatternState] = useState(defaultValue)
  const [flagState, setFlagState] = useState(defaultFlags)
  const [textState, setTextState] = useState(defaultText)
  const pattern = value ?? patternState
  const flagText = flags ?? flagState
  const sample = text ?? textState
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [active, setActive] = useState<number | null>(null)

  const { tokens, error: syntax } = useMemo(() => tokenizeRegex(pattern, flagText.includes('u')), [pattern, flagText])
  const risks = useMemo(() => (syntax ? [] : findRisks(tokens, flagText)), [tokens, syntax, flagText])
  const engineError = useMemo(() => {
    try {
      new RegExp(pattern, flagText)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, [pattern, flagText])
  const names = useMemo(() => {
    const map = new Map<number, string>()
    tokens.forEach((token) => token.capture && token.name && map.set(token.capture, token.name))
    return map
  }, [tokens])
  const captureCount = tokens.filter((token) => token.capture).length

  useEffect(() => {
    setActive(null)
    if (!pattern || engineError) {
      setStatus({ kind: 'idle' })
      return
    }
    let worker: Worker | null = null
    let timer = 0
    let cancelled = false
    const debounce = window.setTimeout(async () => {
      setStatus({ kind: 'running' })
      const background = await workersRun()
      if (cancelled) return
      worker = background ? workerFor() : null
      if (!worker) {
        // No Worker to terminate: run here only if nothing can explode.
        if (risks.some((risk) => risk.severity === 'high')) setStatus({ kind: 'refused' })
        else setStatus({ kind: 'done', result: runRegex(pattern, flagText, sample, maxMatches, timeout) })
        return
      }
      worker.onmessage = (event: MessageEvent<RegexTesterRunResult>) => {
        window.clearTimeout(timer)
        setStatus({ kind: 'done', result: event.data })
        worker?.terminate()
      }
      worker.postMessage({ source: pattern, flags: flagText, text: sample, max: maxMatches, budget: timeout })
      timer = window.setTimeout(() => {
        worker?.terminate()
        setStatus({ kind: 'timeout' })
      }, timeout)
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(debounce)
      window.clearTimeout(timer)
      worker?.terminate()
    }
  }, [pattern, flagText, sample, engineError, risks, maxMatches, timeout])

  const setPattern = (next: string) => {
    if (value === undefined) setPatternState(next)
    onValueChange?.(next)
  }
  const toggleFlag = (flag: string) => {
    const next = FLAGS.map(([f]) => f)
      .filter((f) => (f === flag ? !flagText.includes(f) : flagText.includes(f)))
      .join('')
    if (flags === undefined) setFlagState(next)
    onFlagsChange?.(next)
  }
  const setSample = (next: string) => {
    if (text === undefined) setTextState(next)
    onTextChange?.(next)
  }

  const matches: RegexTesterMatch[] = status.kind === 'done' && status.result.ok ? status.result.matches : []
  const riskAt = (start: number, end: number) => risks.find((risk) => start < risk.end && end > risk.start)

  let statusText = ''
  if (!pattern) statusText = 'Type a pattern to start.'
  else if (engineError || syntax) statusText = syntax?.message ?? engineError ?? ''
  else if (status.kind === 'running') statusText = 'Matching…'
  else if (status.kind === 'timeout') statusText = `Stopped after ${timeout} ms — the pattern is backtracking too much on this text. See the warning above.`
  else if (status.kind === 'refused') statusText = 'Not run: this browser cannot run the match in the background, and the pattern has a shape that can hang the page.'
  else if (status.kind === 'done') {
    const { result } = status
    statusText = !result.ok
      ? result.error ?? 'The pattern failed.'
      : `${result.matches.length}${result.capped ? '+' : ''} match${result.matches.length === 1 ? '' : 'es'} in ${result.ms} ms${result.capped ? ` — stopped at ${result.matches.length}` : ''}`
  }
  const statusBad = !!(engineError || syntax || status.kind === 'timeout' || status.kind === 'refused')

  // The text with every match marked; zero-length matches show as a caret.
  const highlighted: ReactNode[] = []
  let cursor = 0
  matches.forEach((match, index) => {
    if (match.index < cursor) return
    highlighted.push(sample.slice(cursor, match.index))
    highlighted.push(
      <mark
        key={index}
        className={cn(
          'rounded-[var(--radius-2)] text-ink',
          match.text === '' ? 'inline-block h-[1.1em] w-0.5 align-text-bottom bg-accent-strong' : TINTS[index % 2],
          active === index && 'outline-2 outline-ink',
        )}
      >
        {match.text}
      </mark>,
    )
    cursor = match.index + match.text.length
  })
  highlighted.push(sample.slice(cursor))

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-pattern`} className="text-[12px] font-semibold text-ink">
          Pattern
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`${uid}-pattern`}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            invalid={!!(engineError || syntax)}
            aria-describedby={`${uid}-status`}
            spellCheck={false}
            autoComplete="off"
            leading={<span className="font-mono text-[13px]">/</span>}
            trailing={<span className="font-mono text-[13px]">/{flagText}</span>}
            containerClassName="min-w-[220px] flex-1"
            className="pr-16 font-mono"
          />
          <div role="group" aria-label="Flags" className="flex gap-1">
            {FLAGS.map(([flag, name]) => (
              <button
                key={flag}
                type="button"
                aria-pressed={flagText.includes(flag)}
                title={name}
                onClick={() => toggleFlag(flag)}
                className={cn(
                  'size-8 rounded-full border font-mono text-[12px] font-bold transition-colors',
                  flagText.includes(flag) ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                )}
              >
                {flag}
                <span className="sr-only">, {name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {risks.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Backtracking warnings">
          {risks.map((risk, index) => (
            <li
              key={index}
              className={cn(
                'rounded-[var(--radius-10)] px-3 py-2 text-[12px] font-medium leading-normal text-ink',
                risk.severity === 'high' ? 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]' : 'bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)]',
              )}
            >
              <span className={cn('font-bold', risk.severity === 'high' ? 'text-danger' : 'text-ink')}>
                {risk.severity === 'high' ? 'Can hang: ' : 'Can be slow: '}
              </span>
              <code className="font-mono font-semibold">{pattern.slice(risk.start, risk.end)}</code> — {risk.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-text`} className="text-[12px] font-semibold text-ink">
          Test text
        </label>
        <Textarea id={`${uid}-text`} value={sample} onChange={(event) => setSample(event.target.value)} rows={4} spellCheck={false} className="font-mono text-[12px]" />
      </div>

      <p id={`${uid}-status`} role="status" className={cn('text-[12px] font-semibold', statusBad ? 'text-danger' : 'text-ink-soft')}>
        {statusText}
      </p>

      {matches.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            <span id={`${uid}-marked`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Matches in the text
            </span>
            <pre tabIndex={0} role="region" aria-labelledby={`${uid}-marked`} className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3 font-mono text-[12px] leading-relaxed text-ink-soft">
              {highlighted}
            </pre>
          </div>
          <div className="max-h-64 overflow-auto rounded-[var(--radius-tile)] border border-line">
            <table className="w-full border-collapse text-left text-[12px]">
              <caption className="sr-only">Every match with its position and groups</caption>
              <thead className="sticky top-0 bg-surface-muted text-[11px] font-bold text-ink-soft">
                <tr>
                  <th scope="col" className="px-3 py-2">#</th>
                  <th scope="col" className="px-3 py-2">Match</th>
                  <th scope="col" className="px-3 py-2">At</th>
                  {captureCount > 0 && <th scope="col" className="px-3 py-2">Groups</th>}
                </tr>
              </thead>
              <tbody>
                {matches.map((match, index) => (
                  <tr
                    key={index}
                    tabIndex={0}
                    onFocus={() => setActive(index)}
                    onMouseEnter={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className={cn('border-t border-line align-top', active === index && 'bg-surface-sunken')}
                  >
                    <td className="px-3 py-1.5 tabular-nums text-ink-faint">{index + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-ink">{match.text === '' ? <span className="text-ink-faint">(empty)</span> : match.text}</td>
                    <td className="px-3 py-1.5 tabular-nums text-ink-soft">
                      {match.index}–{match.index + match.text.length}
                    </td>
                    {captureCount > 0 && (
                      <td className="px-3 py-1.5">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                          {match.groups.map((group, g) => (
                            <Fragment key={g}>
                              <dt className="font-semibold text-ink-faint">{names.get(g + 1) ?? g + 1}</dt>
                              <dd className="font-mono text-ink">{group === undefined ? <span className="text-ink-faint">did not take part</span> : `“${group}”`}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tokens.length > 0 && (
        <details className="group rounded-[var(--radius-tile)] border border-line" open>
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-ink">What the pattern says</summary>
          <ol className="flex flex-col gap-1 border-t border-line p-3">
            {tokens.map((token, index) => (
              <li
                key={index}
                style={{ paddingInlineStart: `${token.depth * 16}px` }}
                className={cn('flex items-baseline gap-2.5 text-[12px] leading-normal', riskAt(token.start, token.end) && 'text-danger')}
              >
                <code className="shrink-0 rounded-[var(--radius-4)] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">{token.text}</code>
                <span className={cn('font-medium', riskAt(token.start, token.end) ? 'text-danger' : 'text-ink-soft')}>{token.explain}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
