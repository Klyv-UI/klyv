'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Textarea } from '../Textarea'
import { evaluateCsp, type CspEvaluatorReport, type CspEvaluatorSeverity } from './csp'

export interface CspEvaluatorProps {
  /** Controlled policy text: the header value, with or without the header name. */
  value?: string
  /** Starting policy when uncontrolled. */
  defaultValue?: string
  /** Called with the policy after every edit. */
  onValueChange?: (value: string) => void
  /** Called with the review whenever the policy changes. */
  onReport?: (report: CspEvaluatorReport) => void
  /** Visible label for the policy field. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const SEVERITY: Record<CspEvaluatorSeverity, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] text-danger' },
  medium: { label: 'Medium', className: 'bg-[color-mix(in_oklab,var(--color-warning)_20%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_40%,var(--color-ink))]' },
  low: { label: 'Low', className: 'bg-surface-muted text-ink-soft' },
  info: { label: 'Info', className: 'bg-surface-muted text-ink-faint' },
}

/**
 * Reads a Content-Security-Policy the way a browser does and says what it
 * actually allows, weakest point first.
 *
 * A CSP is easy to write and hard to read: whether 'unsafe-inline' matters
 * depends on whether a nonce sits beside it, whether a host allowlist counts
 * depends on 'strict-dynamic', and what governs fonts depends on which
 * directives are missing. So besides the findings — each with a severity and
 * the directive it came from — the policy is resolved per resource type
 * through the default-src fallback, with the sources the browser will ignore
 * struck through and the reason given.
 */
export function CspEvaluator({ value, defaultValue = '', onValueChange, onReport, label = 'Content-Security-Policy', className }: CspEvaluatorProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const policy = value ?? uncontrolled
  const report = useMemo(() => evaluateCsp(policy), [policy])

  const set = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
    onReport?.(evaluateCsp(next))
  }
  const counts = (['high', 'medium', 'low', 'info'] as const).map((severity) => [severity, report.findings.filter((f) => f.severity === severity).length] as const)

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-policy`} className="text-[12px] font-semibold text-ink">
          {label}
        </label>
        <Textarea
          id={`${uid}-policy`}
          value={policy}
          onChange={(event) => set(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="default-src 'self'; script-src 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'"
          className="font-mono text-[12px]"
        />
      </div>

      <p role="status" className="flex flex-wrap gap-1.5">
        {counts.map(([severity, n]) => (
          <span key={severity} className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', n ? SEVERITY[severity].className : 'bg-surface-muted text-ink-faint')}>
            {n} {SEVERITY[severity].label.toLowerCase()}
          </span>
        ))}
      </p>

      <div className="flex flex-col gap-1.5">
        <h3 id={`${uid}-findings`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Findings
        </h3>
        {report.findings.length === 0 ? (
          <p className="text-[12px] font-medium text-ink-soft">Nothing to flag.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
            {report.findings.map((finding, index) => (
              <li key={index} className="flex items-start gap-3 px-3 py-2">
                <span className={cn('mt-px w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold', SEVERITY[finding.severity].className)}>
                  {SEVERITY[finding.severity].label}
                </span>
                <span className="min-w-0 text-[12px] font-medium leading-normal text-ink-soft">
                  <code className="font-mono font-semibold text-ink">{finding.directive}</code> — {finding.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 id={`${uid}-effective`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Effective policy by resource type
        </h3>
        <div tabIndex={0} role="group" aria-labelledby={`${uid}-effective`} className="overflow-x-auto rounded-[var(--radius-tile)] border border-line">
          <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
            <thead className="bg-surface-muted text-[11px] font-bold text-ink-soft">
              <tr>
                <th scope="col" className="px-3 py-2">Resource</th>
                <th scope="col" className="px-3 py-2">Governed by</th>
                <th scope="col" className="px-3 py-2">Allowed sources</th>
              </tr>
            </thead>
            <tbody>
              {report.effective.map((row) => (
                <tr key={row.type} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-1.5 font-medium">
                    <span className="block font-mono text-[11px] font-semibold text-ink">{row.type}</span>
                    <span className="block text-[11px] text-ink-faint">{row.label}</span>
                  </th>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-ink-soft">
                    {row.from ?? <span className="font-sans font-semibold text-danger">nothing — unrestricted</span>}
                    {row.from && row.from !== row.type && <span className="block font-sans text-ink-faint">fallback</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <ul className="flex flex-wrap gap-1">
                      {row.from && row.sources.length === 0 && <li className="text-[11px] text-ink-faint">(empty list: nothing allowed)</li>}
                      {row.sources.map((source, index) => (
                        <li key={index}>
                          <code
                            title={source.ignored}
                            className={cn(
                              'inline-block rounded-[var(--radius-4)] px-1.5 py-0.5 font-mono text-[11px]',
                              source.ignored ? 'bg-surface-muted text-ink-faint line-through' : 'bg-surface-sunken text-ink',
                            )}
                          >
                            {source.text}
                          </code>
                          {source.ignored && <span className="sr-only"> ({source.ignored})</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.effective.some((row) => row.sources.some((s) => s.ignored)) && (
          <p className="text-[11px] font-medium text-ink-faint">Struck-through sources are ignored by the browser; hover one for the reason.</p>
        )}
      </div>
    </div>
  )
}
