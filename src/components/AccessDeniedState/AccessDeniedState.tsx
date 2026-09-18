'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { Text } from '../Text'
import { CheckIcon, LockIcon } from '../internal/icons'

export type AccessDeniedStateHeadingLevel = 'h1' | 'h2' | 'h3'
export type AccessDeniedStateRequestStatus = 'idle' | 'pending' | 'sent'

export interface AccessDeniedStateOwner {
  /** Full name, shown and used for the avatar initials. */
  name: string
  /** Shown under the name, so the reader knows who exactly to ask. */
  email?: string
  /** Avatar image. */
  avatarSrc?: string
}

export interface AccessDeniedStateProps {
  /** What the reader tried to open — "Q3 board deck". */
  resource: string
  /** What kind of thing it is, for the sentence — "document", "project". */
  resourceType?: string
  /** Headline. */
  title?: string
  /** Replaces the default explanation. */
  description?: ReactNode
  /** Who can grant access. */
  owner?: AccessDeniedStateOwner
  /** Sends the request. Return a promise to show it pending; a rejection shows its message. Omit to hide the button. */
  onRequestAccess?: () => void | Promise<void>
  /** Controlled request status — pass sent when a request already exists. */
  requestStatus?: AccessDeniedStateRequestStatus
  /** The account the reader is signed in with. */
  account?: string
  /** Where switching account goes. */
  switchAccountHref?: string
  /** Called when switching account is chosen, for an app that handles it in place. */
  onSwitchAccount?: () => void
  /** The title's heading level. */
  headingLevel?: AccessDeniedStateHeadingLevel
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The body of a 403: you reached something real, and you are not allowed in.
 *
 * "Access denied" on its own tells the reader nothing they can act on. This
 * names what they tried to open, who owns it, and the account they are using —
 * because the most common cause is simply being signed in as the wrong person.
 * The request button turns into a sent state in place and keeps focus, so a
 * keyboard reader is not dropped to the top of the page when it changes, and
 * the change is announced.
 */
export function AccessDeniedState({
  resource,
  resourceType = 'page',
  title = 'You need access',
  description,
  owner,
  onRequestAccess,
  requestStatus,
  account,
  switchAccountHref,
  onSwitchAccount,
  headingLevel = 'h1',
  className,
}: AccessDeniedStateProps) {
  const [internal, setInternal] = useState<AccessDeniedStateRequestStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const status = requestStatus ?? internal
  const Heading = headingLevel

  // The button keeps focus through every state. A disabled button drops it to the page, so the
  // pending and sent states are aria-disabled instead.

  const request = async () => {
    if (status !== 'idle' || !onRequestAccess) return
    setError(null)
    setInternal('pending')
    try {
      await onRequestAccess()
      setInternal('sent')
    } catch (reason) {
      setInternal('idle')
      setError(reason instanceof Error ? reason.message : 'The request could not be sent. Try again.')
    }
  }

  const switchable = Boolean(switchAccountHref || onSwitchAccount)
  const switchClass =
    'rounded-full px-1 font-bold text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

  return (
    <div className={cn('mx-auto flex w-full max-w-[460px] flex-col items-center gap-5 px-4 py-10 text-center', className)}>
      <span
        aria-hidden="true"
        className="inline-flex size-14 items-center justify-center rounded-full bg-surface-muted text-ink-soft"
      >
        <LockIcon size={24} strokeWidth={1.75} />
      </span>

      <div className="flex flex-col items-center gap-2">
        <Text as={Heading} size="title">
          {title}
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          {description ?? (
            <>
              You don’t have permission to open the {resourceType}{' '}
              <strong className="font-bold text-ink">{resource}</strong>.
              {owner ? ' Ask its owner to share it with you.' : ' Ask someone who manages it to share it with you.'}
            </>
          )}
        </Text>
      </div>

      {owner && (
        <div className="flex w-full items-center gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-3 text-left">
          <Avatar name={owner.name} src={owner.avatarSrc} size="md" />
          <div className="min-w-0 flex-1">
            <Text size="caption" tone="faint" weight="semibold">
              Owner
            </Text>
            <Text size="body" className="truncate">
              {owner.name}
            </Text>
            {owner.email && (
              <Text size="label" tone="soft" className="truncate">
                {owner.email}
              </Text>
            )}
          </div>
        </div>
      )}

      {onRequestAccess && (
        <div className="flex flex-col items-center gap-2">
          <Button
            aria-disabled={status !== 'idle' || undefined}
            aria-busy={status === 'pending' || undefined}
            onClick={request}
            className={cn(status === 'sent' && 'aria-disabled:opacity-100 bg-success/12 text-success')}
          >
            {status === 'pending' && <Spinner size="md" />}
            {status === 'sent' && <CheckIcon size={14} />}
            {status === 'sent' ? 'Request sent' : status === 'pending' ? 'Sending request' : 'Request access'}
          </Button>
          <Text role="status" aria-live="polite" size="label" tone="soft" leading="normal">
            {status === 'sent'
              ? `${owner ? owner.name : 'The owner'} will get an email. You’ll hear back when they respond.`
              : ''}
          </Text>
          {error && (
            <Text role="alert" size="label" tone="danger" weight="semibold">
              {error}
            </Text>
          )}
        </div>
      )}

      {(account || switchable) && (
        <Text size="label" tone="soft" leading="normal">
          {account && (
            <>
              Signed in as <strong className="font-bold text-ink">{account}</strong>.{' '}
            </>
          )}
          {switchAccountHref ? (
            <a href={switchAccountHref} onClick={onSwitchAccount} className={switchClass}>
              Switch account
            </a>
          ) : (
            onSwitchAccount && (
              <button type="button" onClick={onSwitchAccount} className={switchClass}>
                Switch account
              </button>
            )
          )}
        </Text>
      )}
    </div>
  )
}
