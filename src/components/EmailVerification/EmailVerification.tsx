'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'
import { InputOTP } from '../InputOTP'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { CheckIcon, ExternalIcon } from '../internal/icons'

export interface EmailVerificationMailLink {
  label: string
  href: string
}

export interface EmailVerificationProps {
  /** The address the email went to. Shown masked. */
  email: string
  /** Send the email again. Reject to show the message. */
  onResend: () => void | Promise<void>
  /** Seconds to wait between sends. */
  cooldown?: number
  /** Start with the cooldown running, because an email was sent just before this screen. */
  sentOnMount?: boolean
  /** Go back and use a different address. Without it, the link is hidden. */
  onChangeEmail?: () => void
  /** Check a typed code. Resolve false or reject to mark it wrong. Without it, only the link is offered. */
  onVerifyCode?: (code: string) => boolean | void | Promise<boolean | void>
  /** Characters in the code. */
  codeLength?: number
  /** How long the link lasts, in words — “24 hours”. */
  expiresIn?: string
  /** Shortcuts to webmail. Pass [] to hide them. */
  mailLinks?: EmailVerificationMailLink[]
  /** Controlled verified state — for a link clicked in another tab. */
  verified?: boolean
  /** Shown once verified — usually a Continue button. */
  verifiedAction?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_MAIL_LINKS: EmailVerificationMailLink[] = [
  { label: 'Open Gmail', href: 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+newer_than%3A1h' },
  { label: 'Open Outlook', href: 'https://outlook.live.com/mail/0/' },
]

/** “harshil@example.com” → “ha•••••@example.com”. Enough to recognise, not enough to harvest. */
function mask(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return email
  const name = email.slice(0, at)
  const keep = name.length <= 2 ? 1 : 2
  // A fixed run of dots, so the mask does not give away the length either.
  return `${name.slice(0, keep)}•••••${email.slice(at)}`
}

/**
 * The “check your inbox” step, with every way out of it on one screen.
 *
 * People stall here for predictable reasons: the email is slow, it went to
 * spam, the address had a typo, or they are on a different device from their
 * inbox. So the screen says where it was sent (masked, since this is often a
 * shared screen), links straight to webmail, lets them resend and change the
 * address, and offers typing the code as an alternative to clicking the link.
 *
 * Resend has a visible countdown rather than a silently disabled button, which
 * both explains the wait and stops the triple-send that makes the first email
 * useless. A wrong code keeps what was typed so it can be corrected in place.
 */
export function EmailVerification({
  email,
  onResend,
  cooldown = 30,
  sentOnMount = true,
  onChangeEmail,
  onVerifyCode,
  codeLength = 6,
  expiresIn,
  mailLinks = DEFAULT_MAIL_LINKS,
  verified: controlledVerified,
  verifiedAction,
  className,
}: EmailVerificationProps) {
  const [remaining, setRemaining] = useState(sentOnMount ? cooldown : 0)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [selfVerified, setSelfVerified] = useState(false)
  const verified = controlledVerified ?? selfVerified
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (verified) heading.current?.focus()
  }, [verified])

  const resend = async () => {
    if (remaining > 0 || sending) return
    setSending(true)
    setNotice(null)
    try {
      await onResend()
      setRemaining(cooldown)
      setNotice({ tone: 'success', text: 'Sent again. It can take a minute to arrive.' })
    } catch (reason) {
      setNotice({ tone: 'danger', text: reason instanceof Error ? reason.message : 'Could not send the email. Try again.' })
    } finally {
      setSending(false)
    }
  }

  const verify = async (value: string) => {
    if (!onVerifyCode || checking) return
    setChecking(true)
    setCodeError(null)
    try {
      const ok = await onVerifyCode(value)
      if (ok === false) setCodeError('That code isn’t right. Check the latest email and try again.')
      else setSelfVerified(true)
    } catch (reason) {
      setCodeError(reason instanceof Error ? reason.message : 'That code isn’t right.')
    } finally {
      setChecking(false)
    }
  }

  const masked = mask(email)

  if (verified) {
    return (
      <Surface variant="card" className={cn('flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center', className)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
          <CheckIcon size={22} />
        </span>
        <h2 ref={heading} tabIndex={-1} className="m-0 text-[18px] font-extrabold tracking-[-0.02em] text-ink outline-none">
          Email verified
        </h2>
        <Text size="label" tone="soft" leading="normal">
          {`${masked} is confirmed. You’re all set.`}
        </Text>
        {verifiedAction}
      </Surface>
    )
  }

  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`

  return (
    <Surface variant="card" className={cn('flex w-full max-w-sm flex-col gap-5 p-6', className)}>
      <div className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="m-0 text-[18px] font-extrabold tracking-[-0.02em] text-ink outline-none">
          Check your inbox
        </h2>
        <Text size="label" tone="soft" leading="normal">
          We sent a verification link to <span className="font-bold text-ink">{masked}</span>.
          {expiresIn && ` It expires in ${expiresIn}.`}
        </Text>
      </div>

      {mailLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mailLinks.map((link) => (
            <Button key={link.href} as="a" href={link.href} target="_blank" rel="noreferrer" variant="outline" size="sm">
              {link.label}
              <ExternalIcon size={13} />
              <span className="sr-only">(opens in a new tab)</span>
            </Button>
          ))}
        </div>
      )}

      {onVerifyCode && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Text as="p" size="label" weight="bold">
            Or enter the code from the email
          </Text>
          <InputOTP
            label="Verification code"
            length={codeLength}
            value={code}
            invalid={Boolean(codeError)}
            onValueChange={(next) => {
              setCode(next)
              if (codeError) setCodeError(null)
            }}
            onComplete={(value) => void verify(value)}
          />
          {checking && (
            <InlineMessage tone="hint" live>
              Checking…
            </InlineMessage>
          )}
          {codeError && (
            <InlineMessage tone="danger" live>
              {codeError}
            </InlineMessage>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Text as="p" size="caption" tone="faint" leading="normal">
          Nothing yet? Check your spam folder, or send it again.
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="muted" size="sm" onClick={() => void resend()} loading={sending} aria-disabled={remaining > 0 || undefined}>
            {remaining > 0 ? `Resend in ${clock}` : 'Resend email'}
          </Button>
          {onChangeEmail && (
            <Button variant="ghost" size="sm" onClick={onChangeEmail}>
              Change email
            </Button>
          )}
        </div>
        {notice && (
          <InlineMessage tone={notice.tone} live>
            {notice.text}
          </InlineMessage>
        )}
      </div>
    </Surface>
  )
}
