'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'
import { Textarea } from '../Textarea'

export type RedactorType = 'email' | 'phone' | 'card' | 'iban' | 'secret' | 'jwt' | 'ip' | 'manual'

export interface RedactorFinding {
  /** Stable across edits elsewhere in the text: type, value and occurrence. */
  key: string
  type: RedactorType
  start: number
  end: number
  text: string
  /** 0–1. Checksummed matches (Luhn, mod-97) and known key prefixes score highest. */
  confidence: number
  /** Why it was flagged, e.g. "Visa, Luhn valid". */
  reason: string
}

export type RedactorStyle = 'label' | 'mask'

export interface RedactorProps {
  /** Controlled source text. */
  value?: string
  /** Starting text when uncontrolled. */
  defaultValue?: string
  /** Called as the source text is edited. */
  onValueChange?: (value: string) => void
  /** Findings at or above this are marked for redaction to begin with; below it they wait for review. */
  autoAccept?: number
  /** `[REDACTED:email]` or a same-length mask. */
  defaultStyle?: RedactorStyle
  /** Called with the redacted text whenever it changes. */
  onRedactedChange?: (text: string, findings: RedactorFinding[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const luhn = (digits: string) => {
  let sum = 0
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return sum % 10 === 0
}

/** ISO 13616: move the first four characters to the end, letters to numbers, remainder mod 97 must be 1. */
const ibanValid = (raw: string) => {
  const iban = raw.replace(/\s+/g, '').toUpperCase()
  if (iban.length < 15 || iban.length > 34) return false
  const moved = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of moved) {
    const value = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

const cardBrand = (digits: string) =>
  /^4/.test(digits) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(digits) ? 'Mastercard' : /^3[47]/.test(digits) ? 'Amex' : /^6(011|5)/.test(digits) ? 'Discover' : 'Card'

const base64urlJson = (part: string) => {
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))) as Record<string, unknown>
  } catch {
    return null
  }
}

const entropy = (text: string) => {
  const counts = new Map<string, number>()
  for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1)
  let bits = 0
  counts.forEach((count) => (bits -= (count / text.length) * Math.log2(count / text.length)))
  return bits
}

interface Detector {
  type: RedactorType
  pattern: RegExp
  /** Returns confidence and a reason, or null to reject the match. */
  check: (match: RegExpExecArray) => { confidence: number; reason: string; start?: number; text?: string } | null
}

const DETECTORS: Detector[] = [
  { type: 'jwt', pattern: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g, check: (m) => (base64urlJson(m[0].split('.')[0]!)?.alg ? { confidence: 0.99, reason: 'JWT with a readable header' } : { confidence: 0.7, reason: 'JWT-shaped' }) },
  {
    type: 'secret',
    pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{40,}|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{35}/g,
    check: (m) => {
      const prefix = /^(sk|rk|pk)_/.test(m[0]) ? 'Stripe key' : /^gh|^github/.test(m[0]) ? 'GitHub token' : /^A[KS]IA/.test(m[0]) ? 'AWS access key id' : /^xox/.test(m[0]) ? 'Slack token' : 'Google API key'
      return { confidence: m[0].startsWith('pk_') ? 0.8 : 0.98, reason: prefix }
    },
  },
  {
    type: 'secret',
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["']?([^\s"']{12,})/gi,
    check: (m) => {
      const value = m[1]!
      const bits = entropy(value)
      return bits < 3.2 ? null : { confidence: bits > 4 ? 0.85 : 0.6, reason: `Assigned secret, ${bits.toFixed(1)} bits/char`, start: m.index + m[0].length - value.length, text: value }
    },
  },
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, check: () => ({ confidence: 0.97, reason: 'Email address' }) },
  {
    type: 'card',
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    check: (m) => {
      const digits = m[0].replace(/\D/g, '')
      return luhn(digits) ? { confidence: 0.98, reason: `${cardBrand(digits)}, Luhn valid` } : null
    },
  },
  { type: 'iban', pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, check: (m) => (ibanValid(m[0]) ? { confidence: 0.98, reason: `IBAN (${m[0].slice(0, 2)}), mod-97 valid` } : null) },
  {
    type: 'ip',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-fA-F]{1,4}:){2,7}(?::|[0-9a-fA-F]{1,4})\b/g,
    check: (m) => {
      if (m[0].includes('.')) {
        const octets = m[0].split('.').map(Number)
        if (octets.some((octet) => octet > 255)) return null
        const internal = octets[0] === 10 || octets[0] === 127 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
        return { confidence: internal ? 0.7 : 0.9, reason: internal ? 'Private IPv4' : 'Public IPv4' }
      }
      // Times like 10:30:45 have the same shape; an address has hex letters, a `::` or many groups.
      const groups = m[0].split(':').filter(Boolean).length
      return groups >= 3 && (groups >= 5 || m[0].includes('::') || /[a-f]/i.test(m[0])) ? { confidence: 0.8, reason: 'IPv6' } : null
    },
  },
  {
    type: 'phone',
    pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]\d{2,4}){1,4}\b|\+\d{8,15}\b/g,
    check: (m) => {
      const digits = m[0].replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) return null
      if (/^\d{4}-\d{2}-\d{2}$/.test(m[0])) return null
      return m[0].startsWith('+') ? { confidence: 0.92, reason: 'International number' } : { confidence: digits.length >= 10 ? 0.75 : 0.55, reason: 'Phone-shaped number' }
    },
  },
]

/** Every finding in `text`, overlaps resolved in favour of the more confident, then the longer, match. */
export function detectRedactorFindings(text: string): RedactorFinding[] {
  const raw: Omit<RedactorFinding, 'key'>[] = []
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0
    for (let m = detector.pattern.exec(text); m; m = detector.pattern.exec(text)) {
      const verdict = detector.check(m)
      if (!verdict) continue
      const start = verdict.start ?? m.index
      const value = verdict.text ?? m[0]
      raw.push({ type: detector.type, start, end: start + value.length, text: value, confidence: verdict.confidence, reason: verdict.reason })
    }
  }
  raw.sort((a, b) => b.confidence - a.confidence || b.end - b.start - (a.end - a.start))
  const kept: Omit<RedactorFinding, 'key'>[] = []
  for (const finding of raw) if (!kept.some((other) => finding.start < other.end && other.start < finding.end)) kept.push(finding)
  kept.sort((a, b) => a.start - b.start)
  const seen = new Map<string, number>()
  return kept.map((finding) => {
    const id = `${finding.type}:${finding.text}`
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    return { ...finding, key: `${id}#${n}` }
  })
}

/** Applies accepted findings to `text`. */
export function applyRedactor(text: string, findings: RedactorFinding[], style: RedactorStyle): string {
  let out = ''
  let cursor = 0
  for (const finding of [...findings].sort((a, b) => a.start - b.start)) {
    if (finding.start < cursor) continue
    out += text.slice(cursor, finding.start)
    out += style === 'label' ? `[REDACTED:${finding.type}]` : finding.text.replace(/[^\s\-.@:()]/g, '•')
    cursor = finding.end
  }
  return out + text.slice(cursor)
}

/**
 * Finds personal data and secrets in text, asks before removing any of it, and
 * shows exactly what will leave.
 *
 * Pattern matching alone flags every long number as a card, so the detectors
 * check what can be checked: card numbers must pass Luhn, IBANs mod-97, a JWT
 * must have a header that decodes, a secret assigned to `token=` must look
 * random. Each finding carries its confidence and the reason, confident ones
 * start accepted and the rest wait for a person, and anything the patterns
 * missed can be added by selecting it. Nothing is redacted that was not shown
 * first.
 */
export function Redactor({ value, defaultValue = '', onValueChange, autoAccept = 0.85, defaultStyle = 'label', onRedactedChange, className }: RedactorProps) {
  const [own, setOwn] = useState(defaultValue)
  const text = value ?? own
  const [decisions, setDecisions] = useState<Record<string, boolean>>({})
  const [manual, setManual] = useState<RedactorFinding[]>([])
  const [style, setStyle] = useState<RedactorStyle>(defaultStyle)
  const [selection, setSelection] = useState<[number, number] | null>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)

  const setText = (next: string) => {
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
    setManual([])
  }

  const detected = useMemo(() => detectRedactorFindings(text), [text])
  const findings = [...detected.filter((finding) => !manual.some((m) => finding.start < m.end && m.start < finding.end)), ...manual].sort((a, b) => a.start - b.start)
  const accepted = (finding: RedactorFinding) => decisions[finding.key] ?? (finding.type === 'manual' || finding.confidence >= autoAccept)
  const chosen = findings.filter(accepted)
  const redacted = applyRedactor(text, chosen, style)

  const report = useRef(onRedactedChange)
  report.current = onRedactedChange
  const chosenRef = useRef(chosen)
  chosenRef.current = chosen
  useEffect(() => report.current?.(redacted, chosenRef.current), [redacted])

  const readSelection = () => {
    const field = sourceRef.current
    if (!field) return
    setSelection(field.selectionEnd > field.selectionStart ? [field.selectionStart, field.selectionEnd] : null)
  }

  const addManual = () => {
    if (!selection) return
    const [start, end] = selection
    setManual((list) => [...list.filter((m) => m.end <= start || m.start >= end), { key: `manual:${start}-${end}`, type: 'manual', start, end, text: text.slice(start, end), confidence: 1, reason: 'Selected by hand' }])
    setSelection(null)
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([redacted], { type: 'text/plain' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'redacted.txt' })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const before = () => {
    const parts = []
    let cursor = 0
    for (const finding of findings) {
      parts.push(text.slice(cursor, finding.start))
      parts.push(
        <mark
          key={finding.key}
          className={cn(
            'rounded-[var(--radius-hair)] text-ink',
            accepted(finding) ? 'bg-[color-mix(in_oklab,var(--color-danger)_22%,transparent)]' : 'bg-[color-mix(in_oklab,var(--color-warning)_25%,transparent)] underline decoration-dotted',
          )}
        >
          {finding.text}
        </mark>,
      )
      cursor = finding.end
    }
    parts.push(text.slice(cursor))
    return parts
  }

  const counts = `${findings.length} found · ${chosen.length} to redact · ${findings.length - chosen.length} kept`

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={sourceRef}
          aria-label="Text to redact"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onSelect={readSelection}
          onKeyUp={readSelection}
          onMouseUp={readSelection}
          className="font-mono text-[12.5px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!selection} onClick={addManual}>
            Redact selection
          </Button>
          <Text as="span" size="caption" tone="faint">
            Select text the detectors missed, then add it.
          </Text>
        </div>
      </div>

      <section aria-label="Findings" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text size="label" weight="bold" role="status">
            {counts}
          </Text>
          <SegmentedControl
            label="Redaction style"
            size="sm"
            value={style}
            onValueChange={setStyle}
            options={[
              { value: 'label', label: '[REDACTED:type]' },
              { value: 'mask', label: 'Mask ••••' },
            ]}
          />
        </div>
        {findings.length === 0 ? (
          <Text size="caption" tone="faint">
            Nothing that looks like personal data or a secret.
          </Text>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
            {findings.map((finding) => (
              <li key={finding.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{finding.type}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{finding.text}</code>
                <Text as="span" size="caption" tone="soft" className="w-44 shrink-0 max-sm:w-auto">
                  {finding.reason} · {Math.round(finding.confidence * 100)}%
                </Text>
                <span role="group" aria-label={`Decision for ${finding.type} ${finding.text}`} className="flex gap-1">
                  {[true, false].map((redact) => (
                    <button
                      key={String(redact)}
                      type="button"
                      aria-pressed={accepted(finding) === redact}
                      onClick={() => setDecisions((current) => ({ ...current, [finding.key]: redact }))}
                      className={cn(
                        'h-7 rounded-full px-2.5 text-[11px] font-bold transition-colors',
                        accepted(finding) === redact ? (redact ? 'bg-danger text-ink-inverse' : 'bg-ink text-ink-inverse') : 'border border-line text-ink-soft hover:border-line-strong',
                      )}
                    >
                      {redact ? 'Redact' : 'Keep'}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section aria-label="Before" className="flex min-w-0 flex-col gap-1.5">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Before
          </Text>
          <div className="whitespace-pre-wrap break-words rounded-[var(--radius-tile)] border border-line bg-surface p-3 font-mono text-[12px] leading-[1.7] text-ink">{before()}</div>
        </section>
        <section aria-label="After" className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
              After
            </Text>
            <span className="flex gap-1.5">
              <CopyButton value={redacted} size="sm" />
              <Button size="sm" variant="outline" onClick={download}>
                Download .txt
              </Button>
            </span>
          </div>
          <div className="whitespace-pre-wrap break-words rounded-[var(--radius-tile)] bg-surface-sunken p-3 font-mono text-[12px] leading-[1.7] text-ink">{redacted}</div>
        </section>
      </div>
    </div>
  )
}
