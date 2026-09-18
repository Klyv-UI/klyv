'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Alert } from '../Alert'
import { InlineMessage } from '../InlineMessage'
import { InputOTP } from '../InputOTP'
import { CopyButton } from '../CopyButton'

export interface TwoFactorSetupProps {
  /**
   * The otpauth:// URI. On a phone it opens the authenticator app directly,
   * which is how most people will add it when the QR code is on the same screen.
   */
  otpauthUrl: string
  /**
   * The scannable code for `otpauthUrl`, drawn by a real QR encoder — a server
   * rendered image, or a component such as `qrcode.react`.
   *
   * Klyv's own `QRCode` is not used here: it draws a deterministic,
   * QR-looking pattern for mock-ups, and no authenticator can scan it. Passing
   * it an otpauth URI produced an enrolment screen nobody could complete. With
   * no code supplied, the screen offers the key and the app link instead.
   */
  qrCode?: ReactNode
  /** The same secret, for typing in by hand. */
  secret: string
  /** Check a code. Resolve with the recovery codes on success, false otherwise. */
  onVerify: (code: string) => Promise<string[] | false>
  onComplete: () => void
  onCancel?: () => void
  className?: string
}

/**
 * Turn on two-factor authentication: scan, confirm with a code, keep the
 * recovery codes.
 *
 * The third step is the one that matters and the one usually skipped. Without
 * recovery codes a lost phone is a locked account, so Done stays disabled
 * until the person says they have stored them. The secret is offered as text
 * beside the QR code, grouped in fours, because not every authenticator runs
 * on a phone with a camera.
 */
export function TwoFactorSetup({
  otpauthUrl,
  qrCode,
  secret,
  onVerify,
  onComplete,
  onCancel,
  className,
}: TwoFactorSetupProps) {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [codes, setCodes] = useState<string[] | null>(null)
  const [stored, setStored] = useState(false)

  const grouped = secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

  const verify = async (value = code) => {
    if (value.length < 6) return
    setChecking(true)
    setError(undefined)
    try {
      const result = await onVerify(value)
      if (result) setCodes(result)
      else {
        setError('That code did not match. Codes change every 30 seconds — try the current one.')
        setCode('')
      }
    } finally {
      setChecking(false)
    }
  }

  if (codes) {
    return (
      <Surface variant="card" padding="lg" className={cn('gap-5', className)}>
        <div className="flex flex-col gap-1.5">
          <Text size="caption" weight="bold" tone="faint">
            Step 3 of 3
          </Text>
          <Text as="h2" size="subtitle">
            Save your recovery codes
          </Text>
        </div>
        <Alert tone="warning">
          If you lose your phone, these are the only way back into your account. Each works once. Store them in a password manager.
        </Alert>
        <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-4 font-mono text-[13px] font-semibold text-ink sm:grid-cols-3">
          {codes.map((item) => (
            <li key={item} className="tabular">
              {item}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={codes.join('\n')} label="Copy all codes" copiedLabel="Codes copied" />
        </div>
        <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink">
          <Checkbox checked={stored} onChange={(event) => setStored(event.target.checked)} />
          I have stored these codes somewhere safe
        </label>
        <Button onClick={onComplete} disabled={!stored} className="self-start">
          Turn on two-factor
        </Button>
      </Surface>
    )
  }

  return (
    <Surface variant="card" padding="lg" className={cn('gap-6', className)}>
      <div className="flex flex-col gap-1.5">
        <Text size="caption" weight="bold" tone="faint">
          Steps 1 and 2 of 3
        </Text>
        <Text as="h2" size="subtitle">
          Set up an authenticator app
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          {qrCode ? 'Scan the code' : 'Add this account'} with an app such as 1Password, Authy or Google Authenticator,
          then enter the six digits it shows.
        </Text>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {qrCode && (
          // White on purpose, in both themes: scanners read dark on light.
          <div className="shrink-0 self-center rounded-[var(--radius-tile)] border border-line bg-white p-2 sm:self-start">
            {qrCode}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Text size="caption" weight="semibold" tone="soft">
              {qrCode ? 'Can’t scan it? Enter this key instead' : 'Enter this key in your authenticator app'}
            </Text>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-[var(--radius-6)] bg-surface-muted px-2 py-1 font-mono text-[12px] font-bold text-ink">{grouped}</code>
              <CopyButton value={secret} label="Copy key" copiedLabel="Key copied" />
            </div>
            <a
              href={otpauthUrl}
              className="w-fit text-[12px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
            >
              Open in authenticator app
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <Text size="caption" weight="semibold" tone="soft">
              Code from the app
            </Text>
            <InputOTP
              label="Six-digit code"
              value={code}
              onValueChange={(value) => {
                setCode(value)
                setError(undefined)
              }}
              onComplete={(value) => void verify(value)}
              invalid={Boolean(error)}
              disabled={checking}
            />
            {error && (
              <InlineMessage tone="danger" live>
                {error}
              </InlineMessage>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void verify()} loading={checking} disabled={code.length < 6}>
              Verify
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </Surface>
  )
}
