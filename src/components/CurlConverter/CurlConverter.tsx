'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { CodeBlock } from '../CodeBlock'
import { Tabs } from '../Tabs'
import { Textarea } from '../Textarea'
import { parseCurl, toAxios, toFetch, toPython, type CurlConverterRequest } from './curl'

export type CurlConverterTarget = 'fetch' | 'axios' | 'python'

export interface CurlConverterProps {
  /** Controlled curl command. */
  value?: string
  /** Starting command when uncontrolled. */
  defaultValue?: string
  /** Called with the command after every edit. */
  onValueChange?: (value: string) => void
  /** Called with the request model whenever the command parses. */
  onRequestChange?: (request: CurlConverterRequest) => void
  /** Output tab shown first. */
  defaultTarget?: CurlConverterTarget
  /** Visible label for the command field. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Paste a curl command, get the same request as fetch, axios or Python
 * requests — and a list of everything that did not survive the trip.
 *
 * Commands copied from browser dev tools and API docs lean on the shell as
 * much as on curl: quotes inside quotes, line continuations, $'…' strings. So
 * the command is split by a POSIX-style tokenizer first, then each flag is
 * applied with curl’s semantics — -d makes it a POST, -G moves the data into
 * the query, --json sets two headers, -u becomes Basic auth. Flags with no
 * equivalent are listed rather than dropped quietly, because a missing -k or
 * proxy is exactly the difference someone will debug later.
 */
export function CurlConverter({
  value,
  defaultValue = '',
  onValueChange,
  onRequestChange,
  defaultTarget = 'fetch',
  label = 'curl command',
  className,
}: CurlConverterProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const command = value ?? uncontrolled
  const [target, setTarget] = useState<CurlConverterTarget>(defaultTarget)
  const parsed = useMemo(() => (command.trim() ? parseCurl(command) : null), [command])

  const set = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
    const result = next.trim() ? parseCurl(next) : null
    if (result?.ok) onRequestChange?.(result.request)
  }

  const request = parsed?.ok ? parsed.request : null
  const code = request ? { fetch: toFetch(request), axios: toAxios(request), python: toPython(request) } : null

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-cmd`} className="text-[12px] font-semibold text-ink">
          {label}
        </label>
        <Textarea
          id={`${uid}-cmd`}
          value={command}
          onChange={(event) => set(event.target.value)}
          invalid={parsed?.ok === false}
          aria-describedby={`${uid}-status`}
          rows={5}
          spellCheck={false}
          placeholder="curl https://api.example.com -H 'Accept: application/json'"
          className="font-mono text-[12px]"
        />
        <p id={`${uid}-status`} className={cn('text-[12px] font-semibold', parsed?.ok === false ? 'text-danger' : 'text-ink-soft')}>
          {!parsed ? 'Paste a command copied from a terminal, API docs or dev tools.' : parsed.ok ? `${parsed.request.method} ${parsed.request.url}` : parsed.error}
        </p>
      </div>

      {request && code && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3 text-[12px]">
            <dt className="font-semibold text-ink-faint">Method</dt>
            <dd className="font-mono font-semibold text-ink">{request.method}</dd>
            <dt className="font-semibold text-ink-faint">URL</dt>
            <dd className="break-all font-mono text-ink">{request.url}</dd>
            {request.headers.length > 0 && (
              <>
                <dt className="font-semibold text-ink-faint">Headers</dt>
                <dd className="flex flex-col font-mono text-ink">
                  {request.headers.map(([name, v], index) => (
                    <span key={index} className="break-all">
                      <span className="text-ink-soft">{name}:</span> {v}
                    </span>
                  ))}
                </dd>
              </>
            )}
            {request.auth && (
              <>
                <dt className="font-semibold text-ink-faint">Auth</dt>
                <dd className="font-mono text-ink">Basic, user {request.auth.user}</dd>
              </>
            )}
            {request.body.kind !== 'none' && (
              <>
                <dt className="font-semibold text-ink-faint">Body</dt>
                <dd className="text-ink">
                  {{ raw: 'Raw text', json: 'JSON', form: 'URL-encoded form', multipart: 'Multipart form' }[request.body.kind]}
                </dd>
              </>
            )}
          </dl>

          {request.notes.length > 0 && (
            <ul aria-label="Conversion notes" className="flex flex-col gap-1">
              {request.notes.map((note, index) => (
                <li
                  key={index}
                  className={cn(
                    'rounded-[var(--radius-10)] px-3 py-1.5 text-[12px] font-medium leading-normal',
                    note.level === 'warn' ? 'bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)] text-ink' : 'bg-surface-muted text-ink-soft',
                  )}
                >
                  <span className="font-bold">{note.level === 'warn' ? 'Check: ' : 'Note: '}</span>
                  {note.message}
                </li>
              ))}
            </ul>
          )}

          <Tabs
            label="Generated code"
            variant="underline"
            value={target}
            onValueChange={setTarget}
            items={[
              { value: 'fetch', label: 'fetch', content: <CodeBlock code={code.fetch} language="JavaScript" /> },
              { value: 'axios', label: 'axios', content: <CodeBlock code={code.axios} language="JavaScript" /> },
              { value: 'python', label: 'Python requests', content: <CodeBlock code={code.python} language="Python" highlight={false} /> },
            ]}
          />
        </>
      )}
    </div>
  )
}
