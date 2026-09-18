'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Select } from '../Select'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { StatusPill } from '../internal/StatusPill'

export interface JwtInspectorDecoded {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  /** The raw base64url parts, for display. */
  parts: [string, string, string]
}

export type JwtInspectorSignature = 'unchecked' | 'valid' | 'invalid' | 'unsupported'

export interface JwtInspectorProps {
  /** Controlled token. */
  value?: string
  /** Starting token when uncontrolled. */
  defaultValue?: string
  /** Called as the token is edited, and after signing. */
  onValueChange?: (value: string) => void
  /** Starting verification key: an HMAC secret, a PEM public key or a JWK. */
  defaultKey?: string
  /** When set, an `aud` that does not include it is flagged. */
  audience?: string
  /** When set, a different `iss` is flagged. */
  issuer?: string
  /** Show the panel that signs HS256/384/512 test tokens. */
  allowSigning?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const toBytes = (b64url: string) => {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
const fromBytes = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const encodeJson = (value: unknown) => fromBytes(new TextEncoder().encode(JSON.stringify(value)))

/** Splits and decodes a compact JWS. Throws with a reason a person can act on. */
export function decodeJwtInspectorToken(token: string): JwtInspectorDecoded {
  const parts = token.trim().split('.')
  if (parts.length === 5) throw new Error('Five parts: this is an encrypted token (JWE), which cannot be read without the private key.')
  if (parts.length !== 3) throw new Error(`A JWT has three parts separated by dots; this has ${parts.length}.`)
  const json = (part: string, name: string) => {
    try {
      const value = JSON.parse(new TextDecoder().decode(toBytes(part))) as unknown
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
      return value as Record<string, unknown>
    } catch {
      throw new Error(`The ${name} is not base64url-encoded JSON.`)
    }
  }
  return { header: json(parts[0]!, 'header'), payload: json(parts[1]!, 'payload'), parts: parts as [string, string, string] }
}

const HASH: Record<string, string> = { '256': 'SHA-256', '384': 'SHA-384', '512': 'SHA-512' }

function algorithmFor(alg: string): { import: RsaHashedImportParams | EcKeyImportParams | HmacImportParams; verify: AlgorithmIdentifier | RsaPssParams | EcdsaParams } | null {
  const bits = alg.slice(2)
  const hash = HASH[bits]
  if (!hash) return null
  if (alg.startsWith('HS')) return { import: { name: 'HMAC', hash }, verify: 'HMAC' }
  if (alg.startsWith('RS')) return { import: { name: 'RSASSA-PKCS1-v1_5', hash }, verify: 'RSASSA-PKCS1-v1_5' }
  if (alg.startsWith('PS')) return { import: { name: 'RSA-PSS', hash }, verify: { name: 'RSA-PSS', saltLength: Number(bits) / 8 } }
  if (alg.startsWith('ES')) {
    const namedCurve = { '256': 'P-256', '384': 'P-384', '512': 'P-521' }[bits]!
    return { import: { name: 'ECDSA', namedCurve }, verify: { name: 'ECDSA', hash } }
  }
  return null
}

/** Verifies the signature with Web Crypto. JWS ECDSA signatures are raw r‖s, which is what Web Crypto expects. */
export async function verifyJwtInspectorToken(token: string, key: string): Promise<JwtInspectorSignature> {
  const { header, parts } = decodeJwtInspectorToken(token)
  const alg = String(header.alg ?? '')
  const params = algorithmFor(alg)
  if (!params) return 'unsupported'
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = toBytes(parts[2])
  let cryptoKey: CryptoKey
  const trimmed = key.trim()
  if (alg.startsWith('HS')) cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), params.import, false, ['verify'])
  else if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as JsonWebKey & { keys?: (JsonWebKey & { kid?: string })[] }
    const jwk = parsed.keys ? parsed.keys.find((entry) => entry.kid === header.kid) ?? parsed.keys[0]! : parsed
    // key_ops of ["sign"] on a published key would make an honest key unusable here.
    const clean: JsonWebKey = { ...jwk }
    delete clean.key_ops
    cryptoKey = await crypto.subtle.importKey('jwk', clean, params.import, false, ['verify'])
  } else if (/-----BEGIN PUBLIC KEY-----/.test(trimmed)) {
    const der = toBytes(trimmed.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
    cryptoKey = await crypto.subtle.importKey('spki', der, params.import, false, ['verify'])
  } else throw new Error('Give an SPKI PEM (BEGIN PUBLIC KEY), a JWK or a JWKS. Certificates and PKCS#1 keys need converting first.')
  return (await crypto.subtle.verify(params.verify, cryptoKey, signature, data)) ? 'valid' : 'invalid'
}

/** Signs a payload with an HMAC secret — for test tokens, never for production keys. */
export async function signJwtInspectorToken(payload: Record<string, unknown>, secret: string, alg: 'HS256' | 'HS384' | 'HS512' = 'HS256') {
  const input = `${encodeJson({ alg, typ: 'JWT' })}.${encodeJson(payload)}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: HASH[alg.slice(2)]! }, false, ['sign'])
  return `${input}.${fromBytes(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)))}`
}

const CLAIMS: Record<string, string> = {
  iss: 'Issuer — who created and signed it',
  sub: 'Subject — who it is about',
  aud: 'Audience — who is meant to accept it',
  exp: 'Expires — reject it from this moment',
  nbf: 'Not before — reject it until this moment',
  iat: 'Issued at',
  jti: 'Token id — lets a server refuse a replay',
  alg: 'Signing algorithm',
  typ: 'Media type',
  kid: 'Key id — which key signed it',
}

const relative = (seconds: number) => {
  const abs = Math.abs(seconds)
  const text = abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.floor(abs / 60)}m ${abs % 60}s` : abs < 86400 ? `${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m` : `${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`
  return seconds >= 0 ? `in ${text}` : `${text} ago`
}

/**
 * Reads a JSON Web Token, explains it, and checks it — in the browser, so the
 * token never goes to a third-party site to be pasted into.
 *
 * The status is the answer a developer is actually after: valid, expired, not
 * yet valid, bad signature, or unchecked because no key was given. Times are
 * shown as dates with a live countdown rather than as epoch seconds. Signatures
 * are verified with Web Crypto — HMAC secrets, and RSA or ECDSA public keys as
 * PEM or JWK — and `alg: none` is called out as the forgery it usually is.
 */
export function JwtInspector({ value, defaultValue = '', onValueChange, defaultKey = '', audience, issuer, allowSigning = true, className }: JwtInspectorProps) {
  const uid = useId()
  const [own, setOwn] = useState(defaultValue)
  const token = value ?? own
  const setToken = (next: string) => {
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
  }
  const [key, setKey] = useState(defaultKey)
  const [signature, setSignature] = useState<JwtInspectorSignature | 'error'>('unchecked')
  const [signatureNote, setSignatureNote] = useState('')
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const hasSubtle = typeof globalThis.crypto !== 'undefined' && Boolean(globalThis.crypto.subtle)

  const decoded = useMemo(() => {
    if (!token.trim()) return null
    try {
      return { ok: true as const, value: decodeJwtInspectorToken(token) }
    } catch (error) {
      return { ok: false as const, error: (error as Error).message }
    }
  }, [token])

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let live = true
    setSignatureNote('')
    if (!decoded?.ok || !key.trim() || !hasSubtle) return setSignature('unchecked')
    verifyJwtInspectorToken(token, key)
      .then((result) => live && setSignature(result))
      .catch((error: Error) => {
        if (!live) return
        setSignature('error')
        setSignatureNote(error.message || 'The key could not be used with this algorithm.')
      })
    return () => {
      live = false
    }
  }, [token, key, decoded, hasSubtle])

  const header = decoded?.ok ? decoded.value.header : {}
  const payload = decoded?.ok ? decoded.value.payload : {}
  const alg = String(header.alg ?? '')
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null
  const expired = exp !== null && now >= exp
  const early = nbf !== null && now < nbf
  const audiences = Array.isArray(payload.aud) ? payload.aud.map(String) : payload.aud !== undefined ? [String(payload.aud)] : []
  const warnings = [
    alg.toLowerCase() === 'none' && 'alg is “none”: the token is unsigned and anyone could have written it. Never accept one.',
    audience && !audiences.includes(audience) && `aud does not include ${audience}.`,
    issuer && payload.iss !== issuer && `iss is not ${issuer}.`,
    decoded?.ok && exp === null && 'No exp claim: this token never expires.',
  ].filter(Boolean) as string[]

  const [tone, verdict] = !decoded
    ? (['neutral', 'Paste a token'] as const)
    : !decoded.ok
      ? (['danger', 'Malformed'] as const)
      : alg.toLowerCase() === 'none'
        ? (['danger', 'Unsigned'] as const)
        : signature === 'invalid'
          ? (['danger', 'Invalid signature'] as const)
          : expired
            ? (['warning', signature === 'valid' ? 'Expired (signature valid)' : 'Expired'] as const)
            : early
              ? (['warning', 'Not yet valid'] as const)
              : signature === 'valid'
                ? (['success', 'Valid'] as const)
                : (['neutral', 'Signature not checked'] as const)

  const [signAlg, setSignAlg] = useState<'HS256' | 'HS384' | 'HS512'>('HS256')
  const [signPayload, setSignPayload] = useState(() => {
    const t = Math.floor(Date.now() / 1000)
    return JSON.stringify({ sub: 'user_123', name: 'Ada Lovelace', aud: 'api.example.com', iat: t, exp: t + 120 }, null, 2)
  })
  const [signSecret, setSignSecret] = useState('change-me-to-a-long-random-secret')
  const [signError, setSignError] = useState('')
  const sign = async () => {
    setSignError('')
    try {
      const next = await signJwtInspectorToken(JSON.parse(signPayload) as Record<string, unknown>, signSecret, signAlg)
      setToken(next)
      setKey(signSecret)
    } catch (error) {
      setSignError(error instanceof SyntaxError ? 'The payload is not valid JSON.' : (error as Error).message)
    }
  }

  const claimRows = (object: Record<string, unknown>) =>
    Object.entries(object).map(([name, claim]) => {
      const time = ['exp', 'nbf', 'iat'].includes(name) && typeof claim === 'number'
      return (
        <div key={name} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-line px-3 py-2 first:border-t-0">
          <dt className="font-mono text-[12px] font-bold text-ink">{name}</dt>
          <dd className="min-w-0 break-words font-mono text-[12px] text-ink">
            {typeof claim === 'string' ? claim : JSON.stringify(claim)}
            {time && (
              <span className="ml-2 font-sans font-semibold text-ink-soft">
                {new Date((claim as number) * 1000).toLocaleString()} · {relative((claim as number) - now)}
              </span>
            )}
          </dd>
          {CLAIMS[name] && <dd className="col-start-2 text-[11px] font-medium text-ink-faint">{CLAIMS[name]}</dd>}
        </div>
      )
    })

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${uid}-token`} className="text-[12px] font-semibold text-ink-soft">
            Token
          </label>
          <span role="status">
            <StatusPill tone={tone}>{verdict}</StatusPill>
          </span>
        </div>
        <Textarea id={`${uid}-token`} rows={4} spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} className="break-all font-mono text-[12px]" />
        {decoded?.ok && (
          <p aria-hidden="true" className="break-all font-mono text-[11px] leading-[1.6]">
            <span className="text-danger">{decoded.value.parts[0]}</span>.<span className="text-success">{decoded.value.parts[1]}</span>.
            <span className="text-[color-mix(in_oklab,var(--color-accent-strong)_45%,var(--color-ink))]">{decoded.value.parts[2]}</span>
          </p>
        )}
        {decoded && !decoded.ok && (
          <Text size="caption" tone="danger" role="alert">
            {decoded.error}
          </Text>
        )}
      </div>

      {warnings.length > 0 && (
        <ul aria-label="Warnings" className="flex flex-col gap-1 rounded-[var(--radius-tile)] border border-warning bg-[color-mix(in_oklab,var(--color-warning)_12%,transparent)] px-3 py-2">
          {warnings.map((warning) => (
            <li key={warning} className="text-[12px] font-semibold text-ink">
              {warning}
            </li>
          ))}
        </ul>
      )}

      {decoded?.ok && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div role="group" aria-label="Header" className="flex flex-col gap-1.5">
            <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
              Header
            </Text>
            <dl className="rounded-[var(--radius-tile)] border border-line bg-surface">{claimRows(header)}</dl>
          </div>
          <div role="group" aria-label="Payload" className="flex flex-col gap-1.5">
            <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
              Payload
            </Text>
            <dl className="rounded-[var(--radius-tile)] border border-line bg-surface">{claimRows(payload)}</dl>
          </div>
        </div>
      )}

      <div role="group" aria-label="Verify signature" className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-key`} className="text-[12px] font-semibold text-ink-soft">
          {alg.startsWith('HS') ? 'Secret' : 'Public key (PEM or JWK)'}
        </label>
        <Textarea id={`${uid}-key`} rows={alg.startsWith('HS') ? 1 : 4} spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} className="font-mono text-[12px]" />
        <Text size="caption" tone={signature === 'valid' ? 'success' : signature === 'invalid' || signature === 'error' ? 'danger' : 'faint'}>
          {!hasSubtle
            ? 'Signature checks need Web Crypto, which browsers only offer on HTTPS or localhost.'
            : signature === 'valid'
              ? `Signature verified with ${alg}.`
              : signature === 'invalid'
                ? 'The signature does not match this key. The token was altered, or signed with another key.'
                : signature === 'unsupported'
                  ? `${alg || 'This algorithm'} cannot be checked here. HS, RS, PS and ES algorithms can.`
                  : signature === 'error'
                    ? signatureNote
                    : 'Add the key to check the signature.'}
        </Text>
      </div>

      {allowSigning && (
        <details className="rounded-[var(--radius-tile)] border border-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-bold text-ink">Sign a test token</summary>
          <div className="flex flex-col gap-2 border-t border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                label="Signing algorithm"
                size="sm"
                value={signAlg}
                onValueChange={setSignAlg}
                options={[
                  { value: 'HS256', label: 'HS256' },
                  { value: 'HS384', label: 'HS384' },
                  { value: 'HS512', label: 'HS512' },
                ]}
              />
              <Input aria-label="Signing secret" inputSize="sm" value={signSecret} onChange={(event) => setSignSecret(event.target.value)} containerClassName="min-w-0 flex-1" />
            </div>
            <Textarea aria-label="Payload to sign" rows={6} spellCheck={false} value={signPayload} onChange={(event) => setSignPayload(event.target.value)} className="font-mono text-[12px]" />
            {signError && (
              <Text size="caption" tone="danger" role="alert">
                {signError}
              </Text>
            )}
            <Button size="sm" className="self-start" disabled={!hasSubtle} onClick={() => void sign()}>
              Sign and inspect
            </Button>
          </div>
        </details>
      )}
    </div>
  )
}
