'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/time'
import { Button } from '../Button'
import { ConfirmPopover } from '../ConfirmPopover'
import { Input } from '../Input'
import { Tag } from '../Tag'
import { Text } from '../Text'

export type PasskeyManagerDeviceType = 'singleDevice' | 'multiDevice'

export interface PasskeyManagerPasskey {
  id: string
  /** What the reader calls it — “MacBook”, “Work YubiKey”. */
  name: string
  createdAt: Date
  lastUsedAt?: Date
  /** multiDevice passkeys sync through a password manager; singleDevice ones live on one authenticator. */
  deviceType: PasskeyManagerDeviceType
  /** usb, nfc, ble, internal, hybrid — as the authenticator reported them. */
  transports?: string[]
}

/** What a successful registration hands to your server for verification. */
export interface PasskeyManagerCreated {
  /** The credential from navigator.credentials.create — send its response to your server to verify. */
  credential: PublicKeyCredential
  /** The name the reader gave it. */
  name: string
  deviceType: PasskeyManagerDeviceType
  /** Whether the authenticator says the key is currently backed up (synced). */
  backedUp: boolean
  transports: string[]
}

export interface PasskeyManagerProps {
  /** The passkeys your server has on record for this account. */
  passkeys: PasskeyManagerPasskey[]
  /** Fetches fresh registration options — the challenge must come from your server, once per attempt. */
  getCreationOptions: () => Promise<PublicKeyCredentialCreationOptions>
  /** Verifies and stores the new credential. Reject to show the server’s message. */
  onCreate: (created: PasskeyManagerCreated) => void | Promise<void>
  /** Renames a passkey. */
  onRename: (id: string, name: string) => void | Promise<void>
  /** Removes a passkey from the account. */
  onRemove: (id: string) => void | Promise<void>
  /** The current moment, for relative dates in previews and tests. */
  now?: Date
  /** Merged last, so it wins. */
  className?: string
}

type Support = 'checking' | 'unsupported' | 'insecure' | 'platform' | 'roaming'

/** “Chrome on macOS” — a sensible first name for a passkey made on this device. */
function deviceName() {
  const agent = navigator.userAgent
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : 'this device'
  return `${browser} on ${os}`
}

/** Reads the backup-eligible and backup-state flags (bits 3 and 4) from authenticator data. */
function flags(response: AuthenticatorAttestationResponse) {
  const data = typeof response.getAuthenticatorData === 'function' ? new Uint8Array(response.getAuthenticatorData()) : null
  const byte = data && data.length > 32 ? data[32] : 0
  return { eligible: Boolean(byte & 0x08), backedUp: Boolean(byte & 0x10) }
}

function explain(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError') return 'The request was cancelled or timed out. Nothing was saved.'
  if (name === 'InvalidStateError') return 'This authenticator already has a passkey for your account.'
  if (name === 'SecurityError') return 'This site’s address is not allowed to register passkeys for that domain.'
  if (name === 'AbortError') return 'The request was cancelled.'
  return error instanceof Error && error.message ? error.message : 'The passkey could not be created.'
}

const KeyGlyph = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7" cy="8" r="3.5" />
    <path d="M9.5 10.5l6 6M13 14l1.8-1.8M15 16l1.5-1.5" />
  </svg>
)

function Row({ passkey, now, onRename, onRemove }: { passkey: PasskeyManagerPasskey; now: Date; onRename: PasskeyManagerProps['onRename']; onRemove: PasskeyManagerProps['onRemove'] }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(passkey.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const row = useRef<HTMLLIElement>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) field.current?.select()
  }, [editing])

  const close = () => {
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>('[data-rename]')?.focus())
  }

  const save = async () => {
    const name = draft.trim()
    if (!name) return setError('Give the passkey a name.')
    if (name === passkey.name) return close()
    setSaving(true)
    try {
      await onRename(passkey.id, name)
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not rename it.')
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') void save()
    if (event.key === 'Escape') {
      event.stopPropagation()
      setDraft(passkey.name)
      close()
    }
  }

  return (
    <li ref={row} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-soft">
        <KeyGlyph />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input ref={field} inputSize="sm" aria-label="Passkey name" value={draft} maxLength={64} invalid={Boolean(error)} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} containerClassName="min-w-0 flex-1" />
              <Button size="sm" onClick={save} loading={saving}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setDraft(passkey.name); close() }}>Cancel</Button>
            </div>
            {error && <Text size="caption" tone="danger" role="alert">{error}</Text>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Text as="span" size="body" weight="bold" className="min-w-0 break-words">{passkey.name}</Text>
            <Tag size="sm" tone={passkey.deviceType === 'multiDevice' ? 'accent' : 'neutral'}>
              {passkey.deviceType === 'multiDevice' ? 'Synced' : 'This device only'}
            </Tag>
          </div>
        )}
        <Text size="caption" tone="faint">
          {`Created ${passkey.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${passkey.lastUsedAt ? `last used ${relativeTime(passkey.lastUsedAt, now)}` : 'never used'}${passkey.transports?.length ? ` · ${passkey.transports.join(', ')}` : ''}`}
        </Text>
      </div>
      {!editing && (
        <div className="flex items-center gap-1">
          <Button data-rename="" size="sm" variant="ghost" onClick={() => { setDraft(passkey.name); setEditing(true) }} aria-label={`Rename ${passkey.name}`}>
            Rename
          </Button>
          <ConfirmPopover
            trigger={<Button size="sm" variant="ghost" aria-label={`Remove ${passkey.name}`}>Remove</Button>}
            title={`Remove “${passkey.name}”?`}
            description="You will no longer be able to sign in with it. It stays on the device or password manager until you delete it there too."
            confirmLabel="Remove"
            tone="destructive"
            align="end"
            onConfirm={() => onRemove(passkey.id)}
          />
        </div>
      )}
    </li>
  )
}

/**
 * Passkeys for an account: add one on this device, see the ones already
 * registered, rename or remove them.
 *
 * Creating one is the real WebAuthn ceremony — `navigator.credentials.create`
 * with options your server issues (the challenge must be single-use, so it is
 * fetched per attempt), then the credential goes back to your server to verify.
 * The authenticator’s flags say whether the key syncs, which is the difference
 * between “lose the laptop, keep the passkey” and not, so each key is labelled
 * that way. Before offering anything it checks that the browser supports
 * WebAuthn, that the page is a secure context, and whether this device has a
 * built-in authenticator — so the button says what will actually happen.
 * Failures are translated: a cancelled prompt is not an error message the
 * reader needs to decode. Removing asks first, next to the row.
 */
export function PasskeyManager({ passkeys, getCreationOptions, onCreate, onRename, onRemove, now, className }: PasskeyManagerProps) {
  const [support, setSupport] = useState<Support>('checking')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [clock, setClock] = useState(() => now ?? new Date())

  useEffect(() => {
    if (now) setClock(now)
  }, [now])

  useEffect(() => {
    let live = true
    if (typeof window.PublicKeyCredential === 'undefined' || !navigator.credentials?.create) {
      setSupport('unsupported')
      return
    }
    if (!window.isSecureContext) {
      setSupport('insecure')
      return
    }
    const check = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
    if (!check) setSupport('roaming')
    else check.then((available) => live && setSupport(available ? 'platform' : 'roaming'), () => live && setSupport('roaming'))
    return () => {
      live = false
    }
  }, [])

  const create = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const publicKey = await getCreationOptions()
      const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null
      if (!credential) throw new Error('No passkey was returned.')
      const response = credential.response as AuthenticatorAttestationResponse
      const { eligible, backedUp } = flags(response)
      const transports = typeof response.getTransports === 'function' ? response.getTransports() : []
      const name = deviceName()
      await onCreate({ credential, name, deviceType: eligible ? 'multiDevice' : 'singleDevice', backedUp, transports })
      setClock(now ?? new Date())
      setMessage({ tone: 'success', text: `Passkey “${name}” added. You can rename it below.` })
    } catch (error) {
      setMessage({ tone: 'danger', text: explain(error) })
    } finally {
      setBusy(false)
    }
  }

  const available = support === 'platform' || support === 'roaming'

  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as="h3" size="heading">Passkeys</Text>
          <Text size="caption" tone="soft" leading="normal">
            {support === 'checking' && 'Checking what this browser supports…'}
            {support === 'platform' && 'Sign in with your fingerprint, face or device PIN instead of a password.'}
            {support === 'roaming' && 'This device has no built-in authenticator — you can use a phone or a security key.'}
            {support === 'unsupported' && 'This browser does not support passkeys (WebAuthn). Try a current version of Chrome, Safari, Edge or Firefox.'}
            {support === 'insecure' && 'Passkeys only work on a secure (https) page.'}
          </Text>
        </div>
        <Button onClick={create} loading={busy} disabled={!available}>
          {support === 'roaming' ? 'Add a passkey' : 'Create a passkey'}
        </Button>
      </div>

      <div role="status" className={cn(message && 'border-b border-line px-4 py-2.5')}>
        {message && <Text size="caption" weight="semibold" tone={message.tone} leading="normal">{message.text}</Text>}
      </div>

      {passkeys.length === 0 ? (
        <Text size="label" tone="faint" className="px-4 py-6 text-center">No passkeys yet. Add one to stop typing this account’s password.</Text>
      ) : (
        <ul className="flex flex-col divide-y divide-line" aria-label="Your passkeys">
          {passkeys.map((passkey) => (
            <Row key={passkey.id} passkey={passkey} now={now ?? clock} onRename={onRename} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  )
}
