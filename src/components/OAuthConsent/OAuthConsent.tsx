'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { AlertIcon, CheckIcon, LockIcon } from '../internal/icons'

export interface OAuthConsentApp {
  name: string
  /** A logo element. Without one, the app’s initial is drawn in a tile. */
  logo?: ReactNode
  /** Who built it — the company behind the app. */
  publisher?: string
  /** Whether the publisher has been verified. Unverified apps get a warning. */
  verified?: boolean
}

export interface OAuthConsentAccount {
  name: string
  email: string
  avatarSrc?: string
}

export interface OAuthConsentScope {
  id: string
  /** Plain-language permission — “See your calendar events”. */
  label: string
  /** What that means in practice. */
  description?: string
  icon?: IconComponent
  /** Grants access to private data or the ability to act for the person. Flagged and listed first. */
  sensitive?: boolean
}

export interface OAuthConsentProps {
  app: OAuthConsentApp
  /** The signed-in account access is being granted for. */
  account: OAuthConsentAccount
  scopes: OAuthConsentScope[]
  /** Where the person is sent afterwards. Only the host is shown. */
  redirectUri: string
  /** Your product, as in “wants access to your Acme account”. */
  productName?: string
  onAllow: () => void | Promise<void>
  onCancel: () => void
  /** Sign in as someone else. Without it, the switch link is hidden. */
  onSwitchAccount?: () => void
  /** The app’s privacy policy. */
  privacyUrl?: string
  /** The app’s terms of service. */
  termsUrl?: string
  /** Merged last, so it wins. */
  className?: string
}

const hostOf = (uri: string) => {
  try {
    return new URL(uri).host
  } catch {
    return uri
  }
}

/**
 * The OAuth authorisation screen: who is asking, for which account, for what.
 *
 * Consent screens get approved on reflex, so this one is arranged to be read
 * in the time it gets. The app and whether its publisher is verified come
 * first; the account comes next with a way to switch, because granting access
 * to the wrong workspace is the common mistake; then the permissions in plain
 * words, with the sensitive ones marked and moved to the top rather than left
 * at position seven. The host it will redirect to is spelled out, since a
 * look-alike domain is how consent phishing works.
 *
 * Allow and Cancel sit side by side at the same size, so declining is as easy
 * to hit as agreeing, and Allow shows it is working while the grant is saved.
 */
export function OAuthConsent({
  app,
  account,
  scopes,
  redirectUri,
  productName,
  onAllow,
  onCancel,
  onSwitchAccount,
  privacyUrl,
  termsUrl,
  className,
}: OAuthConsentProps) {
  const headingId = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ordered = [...scopes.filter((scope) => scope.sensitive), ...scopes.filter((scope) => !scope.sensitive)]

  const allow = async () => {
    setPending(true)
    setError(null)
    try {
      await onAllow()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Access could not be granted. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Surface as="section" variant="card" aria-labelledby={headingId} className={cn('flex w-full max-w-md flex-col', className)}>
      <div className="flex flex-col items-center gap-3 border-b border-line p-6 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-muted text-[22px] font-extrabold text-ink"
        >
          {app.logo ?? app.name.charAt(0).toUpperCase()}
        </span>
        <h2 id={headingId} className="m-0 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
          {`${app.name} wants access to your ${productName ? `${productName} account` : 'account'}`}
        </h2>
        {app.publisher &&
          (app.verified ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <span className="flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
                <CheckIcon size={10} strokeWidth={3} />
              </span>
              {`By ${app.publisher}, verified publisher`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-danger">
              <AlertIcon size={14} />
              {`By ${app.publisher} — not verified. Only continue if you trust it.`}
            </span>
          ))}
      </div>

      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <Avatar name={account.name} src={account.avatarSrc} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Text as="span" size="body" weight="bold" truncate>
            {account.name}
          </Text>
          <Text as="span" size="caption" tone="faint" truncate>
            {account.email}
          </Text>
        </div>
        {onSwitchAccount && (
          <Button variant="ghost" size="sm" onClick={onSwitchAccount}>
            Switch account
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6 py-5">
        <Text as="h3" size="label" weight="bold" tone="soft">
          {`This will allow ${app.name} to:`}
        </Text>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ordered.map((scope) => {
            const Icon = scope.icon ?? LockIcon
            return (
              <li key={scope.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-glyph)]',
                    scope.sensitive
                      ? 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger'
                      : 'bg-surface-muted text-ink-soft',
                  )}
                >
                  <Icon size={15} strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Text as="span" size="body" weight="bold">
                      {scope.label}
                    </Text>
                    {scope.sensitive && (
                      <Tag size="sm" tone="outline">
                        Sensitive
                      </Tag>
                    )}
                  </span>
                  {scope.description && (
                    <Text as="span" size="label" tone="soft" leading="normal">
                      {scope.description}
                    </Text>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-4 border-t border-line p-6">
        <Text as="p" size="caption" tone="faint" leading="normal">
          {`After you choose, you’ll be sent to `}
          <span className="font-mono font-bold text-ink">{hostOf(redirectUri)}</span>
          {`. You can remove this access at any time in your account settings.`}
        </Text>
        {error && (
          <InlineMessage tone="danger" live>
            {error}
          </InlineMessage>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void allow()} loading={pending}>
            Allow
          </Button>
        </div>
        {(privacyUrl || termsUrl) && (
          <Text as="p" size="caption" tone="faint" leading="normal" className="text-center">
            {`Your data will be used under ${app.name}’s `}
            {privacyUrl && (
              <a href={privacyUrl} className="font-bold text-ink underline underline-offset-2">
                privacy policy
              </a>
            )}
            {privacyUrl && termsUrl && ' and '}
            {termsUrl && (
              <a href={termsUrl} className="font-bold text-ink underline underline-offset-2">
                terms of service
              </a>
            )}
            .
          </Text>
        )}
      </div>
    </Surface>
  )
}
