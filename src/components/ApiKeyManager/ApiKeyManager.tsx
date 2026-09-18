'use client'

import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Alert } from '../Alert'
import { CheckboxGroup } from '../CheckboxGroup'
import { EmptyState } from '../EmptyState'
import { Field } from '../Field'
import { InlineMessage } from '../InlineMessage'
import { ConfirmDialog } from '../ConfirmDialog'
import { Modal } from '../Modal'
import { relativeTime } from '../../lib/time'
import { formatDate } from '../../lib/format'

export interface ApiKey {
  id: string
  name: string
  /** The public part — "sk_live_4f2a". The secret is never kept after creation. */
  prefix: string
  createdAt: Date
  lastUsedAt?: Date | null
  scopes?: string[]
}

export interface ApiScope {
  value: string
  label: string
  hint?: string
}

export interface ApiKeyManagerProps {
  keys: ApiKey[]
  /** Create the key server-side and return its secret, once. */
  onCreate: (input: { name: string; scopes: string[] }) => Promise<{ secret: string }>
  onRevoke: (key: ApiKey) => void | Promise<void>
  /** Offer scopes when creating. Omit for all-access keys. */
  scopes?: ApiScope[]
  defaultScopes?: string[]
  /** Most keys an account may hold. */
  limit?: number
  title?: string
  description?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}

type Step = { kind: 'closed' } | { kind: 'form' } | { kind: 'secret'; secret: string; name: string }

/**
 * Create, list and revoke API keys — the developer section of every SaaS.
 *
 * The secret is shown exactly once, in a dialog that cannot be dismissed by
 * accident: Escape and the backdrop are off, and the only way out is the button
 * that says you have copied it. It lives in component state for that moment
 * and nowhere else, which is the promise the warning makes.
 *
 * The list shows only what is safe to show — the prefix, when it was made, and
 * when it was last used. "Never used" and "last used eight months ago" are the
 * two facts that decide which key to revoke.
 */
export function ApiKeyManager({
  keys,
  onCreate,
  onRevoke,
  scopes,
  defaultScopes,
  limit,
  title = 'API keys',
  description,
  headingLevel: Heading = 'h2',
  className,
}: ApiKeyManagerProps) {
  const nameId = useId()
  const [step, setStep] = useState<Step>({ kind: 'closed' })
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<string[]>(defaultScopes ?? scopes?.map((scope) => scope.value) ?? [])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  const atLimit = limit !== undefined && keys.length >= limit

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const reset = () => {
    setStep({ kind: 'closed' })
    setName('')
    setChosen(defaultScopes ?? scopes?.map((scope) => scope.value) ?? [])
    setError(undefined)
    setCopied(false)
  }

  const create = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!name.trim()) {
      setError('Give the key a name so you can tell it apart later.')
      return
    }
    if (scopes && chosen.length === 0) {
      setError('Choose at least one scope.')
      return
    }
    setCreating(true)
    setError(undefined)
    try {
      const { secret } = await onCreate({ name: name.trim(), scopes: chosen })
      setStep({ kind: 'secret', secret, name: name.trim() })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The key could not be created.')
    } finally {
      setCreating(false)
    }
  }

  const copy = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      // Clipboard refused. The secret is on screen and selectable — nothing to do.
    }
  }

  const revoke = async () => {
    if (!revoking) return
    setRevokeBusy(true)
    try {
      await onRevoke(revoking)
    } finally {
      setRevokeBusy(false)
      setRevoking(null)
    }
  }

  const scopeLabel = (value: string) => scopes?.find((scope) => scope.value === value)?.label ?? value

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Heading className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</Heading>
          {description && (
            <Text size="label" weight="medium" tone="soft" leading="normal" className="max-w-[60ch]">
              {description}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-3">
          {limit !== undefined && (
            <Text as="span" size="caption" weight="semibold" tone="faint" tabular>
              {keys.length} of {limit}
            </Text>
          )}
          <Button size="sm" onClick={() => setStep({ kind: 'form' })} disabled={atLimit} title={atLimit ? 'Revoke a key to create another' : undefined}>
            Create key
          </Button>
        </div>
      </div>

      {keys.length === 0 ? (
        <EmptyState
          size="sm"
          title="No API keys yet"
          description="Create a key to call the API from your own code."
          className="rounded-[var(--radius-card)] border border-dashed border-line-strong"
        />
      ) : (
        <Surface as="ul" aria-label={title} variant="card" className="divide-y divide-line">
          {keys.map((key) => (
            <li
              key={key.id}
              className="grid items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <Text as="span" size="body" truncate>
                  {key.name}
                </Text>
                <span className="flex flex-wrap items-center gap-1.5">
                  <code className="rounded-[var(--radius-6)] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
                    {key.prefix}
                    <span aria-hidden="true">••••••••</span>
                    <VisuallyHidden>, rest hidden</VisuallyHidden>
                  </code>
                  {key.scopes?.map((scope) => (
                    <Tag key={scope} size="sm" tone="outline">
                      {scopeLabel(scope)}
                    </Tag>
                  ))}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Text as="span" size="caption" tone="soft">
                  Created {formatDate(key.createdAt)}
                </Text>
                <Text as="span" size="caption" tone={key.lastUsedAt ? 'faint' : 'soft'} weight={key.lastUsedAt ? 'medium' : 'semibold'}>
                  {key.lastUsedAt ? `Last used ${relativeTime(key.lastUsedAt)}` : 'Never used'}
                </Text>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRevoking(key)} className="justify-self-start hover:text-danger sm:justify-self-end">
                Revoke
                <VisuallyHidden> {key.name}</VisuallyHidden>
              </Button>
            </li>
          ))}
        </Surface>
      )}

      <Modal
        open={step.kind !== 'closed'}
        onClose={reset}
        dismissible={step.kind !== 'secret'}
        title={step.kind === 'secret' ? 'Copy your new key' : 'Create an API key'}
        description={
          step.kind === 'secret'
            ? `This is the only time the secret for “${step.name}” will be shown.`
            : 'Keys act on behalf of this workspace. Give each one only the access it needs.'
        }
        footer={
          step.kind === 'secret' ? (
            <Button onClick={reset}>I have copied it</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={() => void create()} loading={creating}>
                Create key
              </Button>
            </>
          )
        }
      >
        {step.kind === 'secret' ? (
          <div className="flex flex-col gap-3">
            <Alert tone="warning" title="Store it somewhere safe">
              For your security it cannot be shown again. If you lose it, revoke it and create a new one.
            </Alert>
            <div className="flex items-center gap-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-2 pl-3">
              <code className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold text-ink">{step.secret}</code>
              <Button size="sm" variant="outline" onClick={() => void copy(step.secret)}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <VisuallyHidden>
              <span role="status" aria-live="polite">
                {copied ? 'Key copied to the clipboard' : ''}
              </span>
            </VisuallyHidden>
          </div>
        ) : (
          <form onSubmit={(event) => void create(event)} className="flex flex-col gap-4" noValidate>
            <Field label="Name" hint="Where it will be used — “Production server”, “Zapier”." required>
              <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            </Field>
            {scopes && (
              <CheckboxGroup label="Access" options={scopes} value={chosen} onValueChange={setChosen} />
            )}
            {error && (
              <InlineMessage tone="danger" live>
                {error}
              </InlineMessage>
            )}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void revoke()}
        destructive
        busy={revokeBusy}
        title={`Revoke “${revoking?.name ?? ''}”?`}
        description="Anything using this key stops working immediately. This cannot be undone."
        confirmLabel="Revoke key"
      />
    </section>
  )
}
