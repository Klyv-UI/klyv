'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Switch } from '../Switch'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { Field } from '../Field'
import { InlineMessage } from '../InlineMessage'
import { Select } from '../Select'
import { CopyButton } from '../CopyButton'

export interface SsoConfig {
  provider: string
  /** The identity provider's sign-in URL. */
  ssoUrl: string
  /** The identity provider's entity ID (issuer). */
  entityId: string
  /** PEM-encoded X.509 signing certificate. */
  certificate: string
  /** Require SSO for everyone on the verified domains. */
  enforced: boolean
}

export interface SsoSetupProps {
  value: SsoConfig
  onChange: (value: SsoConfig) => void
  /** What the identity provider needs from us. */
  serviceProvider: { acsUrl: string; entityId: string; metadataUrl?: string }
  providers?: { value: string; label: string }[]
  onTest: (config: SsoConfig) => Promise<{ ok: boolean; message: string }>
  onSave: (config: SsoConfig) => void | Promise<void>
  /** Domains whose members enforcement applies to. */
  domains?: string[]
  className?: string
}

const DEFAULT_PROVIDERS = [
  { value: 'okta', label: 'Okta' },
  { value: 'entra', label: 'Microsoft Entra ID' },
  { value: 'google', label: 'Google Workspace' },
  { value: 'custom', label: 'Other SAML 2.0 provider' },
]

const signature = (config: SsoConfig) => `${config.ssoUrl}|${config.entityId}|${config.certificate.trim()}`

/**
 * SAML single sign-on, set up in the order it actually happens: give the
 * identity provider our values, paste back theirs, test, then enforce.
 *
 * Enforcement stays locked until a test has passed against exactly the values
 * on screen. Turning on "SSO required" with a wrong certificate locks the
 * entire organisation out, admins included — the most expensive support
 * ticket a SaaS can receive — so editing any field after a test re-locks it.
 */
export function SsoSetup({
  value,
  onChange,
  serviceProvider,
  providers = DEFAULT_PROVIDERS,
  onTest,
  onSave,
  domains = [],
  className,
}: SsoSetupProps) {
  const enforceId = useId()
  const [result, setResult] = useState<{ ok: boolean; message: string; for: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<SsoConfig>) => onChange({ ...value, ...patch })
  const passed = result?.ok === true && result.for === signature(value)

  const urlError = value.ssoUrl && !/^https:\/\//.test(value.ssoUrl) ? 'Must be an https:// URL.' : undefined
  const certError =
    value.certificate && !value.certificate.includes('BEGIN CERTIFICATE') ? 'Paste the whole certificate, including the BEGIN and END lines.' : undefined
  const complete = Boolean(value.ssoUrl && value.entityId && value.certificate) && !urlError && !certError

  const test = async () => {
    setTesting(true)
    try {
      const outcome = await onTest(value)
      setResult({ ...outcome, for: signature(value) })
    } finally {
      setTesting(false)
    }
  }

  const heading = (step: number, text: string) => (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-ink">{step}</span>
      <Text as="h3" size="heading">
        {text}
      </Text>
    </div>
  )

  const spRows = [
    { label: 'ACS URL', value: serviceProvider.acsUrl },
    { label: 'Entity ID', value: serviceProvider.entityId },
    ...(serviceProvider.metadataUrl ? [{ label: 'Metadata URL', value: serviceProvider.metadataUrl }] : []),
  ]

  return (
    <Surface variant="card" className={cn('divide-y divide-line', className)}>
      <section className="flex flex-col gap-4 p-5">
        {heading(1, 'Add us to your identity provider')}
        <dl className="flex flex-col gap-2">
          {spRows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1.5 rounded-[var(--radius-glyph)] bg-surface-sunken p-3 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-28 shrink-0 text-[12px] font-bold text-ink-soft">{row.label}</dt>
              {/* The copy control lives inside the definition: a dl row may hold
                  only terms and definitions. */}
              <dd className="m-0 flex min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold text-ink">{row.value}</span>
                <CopyButton value={row.value} label={`Copy ${row.label}`} copiedLabel={`${row.label} copied`} iconOnly className="shrink-0" />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-4 p-5">
        {heading(2, 'Paste your identity provider’s details')}
        <Field label="Identity provider">
          <Select label="Identity provider" value={value.provider} onValueChange={(provider) => set({ provider })} options={providers} fullWidth />
        </Field>
        <Field label="Single sign-on URL" error={urlError}>
          <Input value={value.ssoUrl} onChange={(event) => set({ ssoUrl: event.target.value })} placeholder="https://" autoComplete="off" />
        </Field>
        <Field label="Identity provider entity ID">
          <Input value={value.entityId} onChange={(event) => set({ entityId: event.target.value })} autoComplete="off" />
        </Field>
        <Field label="X.509 signing certificate" error={certError}>
          <Textarea
            rows={4}
            value={value.certificate}
            onChange={(event) => set({ certificate: event.target.value })}
            placeholder="-----BEGIN CERTIFICATE-----"
            className="font-mono text-[11px]"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 p-5">
        {heading(3, 'Test, then enforce')}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void test()} loading={testing} disabled={!complete}>
            Test connection
          </Button>
          {result && (
            <InlineMessage tone={result.ok && passed ? 'success' : result.ok ? 'warning' : 'danger'} live>
              {result.ok && !passed ? 'Settings changed since the last test — test again.' : result.message}
            </InlineMessage>
          )}
        </div>

        <div className="flex items-start justify-between gap-6 rounded-[var(--radius-tile)] border border-line p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={enforceId} className="text-[13px] font-bold text-ink">
              Require SSO to sign in
            </label>
            <Text size="caption" tone="soft" leading="normal">
              {passed
                ? `Everyone${domains.length ? ` with an ${domains.map((domain) => `@${domain}`).join(' or ')} address` : ''} must sign in through your identity provider. Passwords stop working.`
                : 'Available once a test has passed with the settings above, so a wrong certificate cannot lock everyone out.'}
            </Text>
          </div>
          <Switch
            id={enforceId}
            checked={value.enforced && passed}
            disabled={!passed}
            onChange={(event) => set({ enforced: event.target.checked })}
          />
        </div>

        <Button
          className="self-start"
          loading={saving}
          disabled={!complete}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave({ ...value, enforced: value.enforced && passed })
            } finally {
              setSaving(false)
            }
          }}
        >
          Save SSO settings
        </Button>
      </section>
    </Surface>
  )
}
