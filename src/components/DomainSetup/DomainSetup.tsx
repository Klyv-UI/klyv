'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { CopyButton } from '../CopyButton'
import { Field } from '../Field'
import { Input } from '../Input'
import { InlineMessage } from '../InlineMessage'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { StatusPill } from '../internal/StatusPill'

export type DomainSetupRecordStatus = 'pending' | 'verified' | 'failed'

export interface DomainSetupRecord {
  id: string
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'
  /** Host name, as DNS providers ask for it — `@`, `www`, `_verify`. */
  name: string
  value: string
  status: DomainSetupRecordStatus
  /** Why it failed — “Found 76.76.21.9, expected 76.76.21.21”. */
  detail?: string
}

export type DomainSetupSslStatus = 'waiting' | 'provisioning' | 'active' | 'failed'

export interface DomainSetupProps {
  /** The connected domain, or null before one is added. */
  domain: string | null
  /** Records to add at the DNS provider, with their latest check result. */
  records: DomainSetupRecord[]
  /** Certificate state. Issued once every record verifies. */
  sslStatus?: DomainSetupSslStatus
  /** Called with a normalised domain. A rejection shows its message. */
  onAdd: (domain: string) => void | Promise<void>
  /** Re-check DNS. Update `records` with the results. */
  onVerify: () => void | Promise<void>
  /** Disconnect the domain, after confirmation. */
  onRemove: () => void | Promise<void>
  /** Shown as the field placeholder. */
  placeholder?: string
  /** Merged last, so it wins. */
  className?: string
}

const DOMAIN = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/

/** Pasted URLs are the common case: strip the scheme, path and trailing dot. */
function normaliseDomainSetupInput(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '')
}

const RECORD_TONE = { pending: 'neutral', verified: 'success', failed: 'danger' } as const
const RECORD_LABEL = { pending: 'Not found yet', verified: 'Verified', failed: 'Failed' }
const SSL: Record<DomainSetupSslStatus, { tone: 'neutral' | 'warning' | 'success' | 'danger'; label: string; copy: string }> = {
  waiting: { tone: 'neutral', label: 'Waiting for DNS', copy: 'A certificate is issued automatically once every record verifies.' },
  provisioning: { tone: 'warning', label: 'Issuing', copy: 'Issuing a certificate. This usually takes a few minutes.' },
  active: { tone: 'success', label: 'Active', copy: 'HTTPS is on. The certificate renews itself.' },
  failed: { tone: 'danger', label: 'Failed', copy: 'The certificate could not be issued. Check for a CAA record that blocks it.' },
}

/**
 * Connecting a custom domain: say which one, add the records, check, done.
 *
 * Each record carries its own result rather than one pass or fail for the
 * lot, because the usual failure is one wrong record out of three and “DNS
 * not verified” does not say which. Values are copied with a button — hand-typed
 * DNS values are where the typo comes from — and pasted URLs are trimmed down
 * to the domain. DNS changes take time to spread, so the pending state says
 * “not found yet” rather than “failed”. Removing the domain asks first, since
 * it takes the site offline at that address.
 */
export function DomainSetup({
  domain,
  records,
  sslStatus = 'waiting',
  onAdd,
  onVerify,
  onRemove,
  placeholder = 'app.example.com',
  className,
}: DomainSetupProps) {
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const normalised = normaliseDomainSetupInput(draft)
  const invalid = normalised.length > 0 && !DOMAIN.test(normalised)
  const verified = records.filter((record) => record.status === 'verified').length

  if (!domain) {
    return (
      <Surface variant="card" padding="lg" className={cn('flex flex-col gap-4', className)}>
        <form
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={async (event) => {
            event.preventDefault()
            setTouched(true)
            if (!normalised || invalid) return
            setAdding(true)
            setAddError(null)
            try {
              await onAdd(normalised)
              setDraft('')
              setTouched(false)
            } catch (error) {
              setAddError(error instanceof Error ? error.message : 'The domain could not be added.')
            } finally {
              setAdding(false)
            }
          }}
        >
          <Field
            label="Custom domain"
            hint="A subdomain you own. You will add DNS records for it next."
            error={addError ?? (touched && invalid ? `“${normalised}” is not a domain name.` : touched && !normalised ? 'Enter a domain.' : undefined)}
            className="flex-1"
          >
            <Input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setAddError(null)
              }}
              onBlur={() => draft && setTouched(true)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
          </Field>
          <Button type="submit" loading={adding} className="sm:mt-[22px]">
            Add domain
          </Button>
        </form>
      </Surface>
    )
  }

  return (
    <Surface variant="card" className={cn('flex flex-col divide-y divide-line', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <Text as="h3" size="heading" className="break-all">
            {domain}
          </Text>
          <Text size="caption" tone="faint" role="status">
            {`${verified} of ${records.length} records verified`}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Remove
          </Button>
          <Button
            size="sm"
            variant={verified === records.length ? 'outline' : 'accent'}
            loading={checking}
            onClick={async () => {
              setChecking(true)
              try {
                await onVerify()
              } finally {
                setChecking(false)
              }
            }}
          >
            {checking ? 'Checking' : 'Verify DNS'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <Text size="body" weight="medium" tone="soft" leading="normal">
          Add these records at your DNS provider. Changes can take up to an hour to be seen.
        </Text>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {records.map((record) => (
            <li key={record.id} className="flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Text as="span" size="label" weight="bold">
                  {`${record.type} record`}
                </Text>
                <StatusPill tone={checking && record.status !== 'verified' ? 'warning' : RECORD_TONE[record.status]}>
                  {checking && record.status !== 'verified' ? 'Checking' : RECORD_LABEL[record.status]}
                </StatusPill>
              </div>
              <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                {[
                  ['Name', record.name],
                  ['Value', record.value],
                ].map(([term, text]) => (
                  <div key={term} className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-glyph)] bg-surface-sunken p-2.5">
                    <dt className="text-[11px] font-bold text-ink-faint">{term}</dt>
                    <dd className="m-0 flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold text-ink">{text}</span>
                      <CopyButton value={text} iconOnly size="sm" label={`Copy ${record.type} ${term.toLowerCase()}`} copiedLabel={`${term} copied`} />
                    </dd>
                  </div>
                ))}
              </dl>
              {record.status === 'failed' && record.detail && !checking && <InlineMessage tone="danger">{record.detail}</InlineMessage>}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex flex-col gap-1">
          <Text as="span" size="label" weight="bold">
            SSL certificate
          </Text>
          <Text as="span" size="caption" tone="faint" leading="normal">
            {SSL[sslStatus].copy}
          </Text>
        </div>
        <StatusPill tone={SSL[sslStatus].tone}>{SSL[sslStatus].label}</StatusPill>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Remove ${domain}?`}
        description="The site stops answering at this address straight away. The DNS records can stay; add the domain again to reconnect."
        confirmLabel="Remove domain"
        destructive
        busy={removing}
        onConfirm={async () => {
          setRemoving(true)
          try {
            await onRemove()
            setConfirming(false)
          } finally {
            setRemoving(false)
          }
        }}
      />
    </Surface>
  )
}
