'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { ConfirmDialog } from '../ConfirmDialog'
import { DesktopIcon, PhoneIcon } from '../internal/icons'
import { relativeTime } from '../../lib/time'

export interface UserSession {
  id: string
  /** "Chrome on macOS". */
  device: string
  kind?: 'desktop' | 'mobile'
  location?: string
  ip?: string
  lastActive: Date
  /** The session this page is being viewed in. */
  current?: boolean
}

export interface SessionListProps {
  sessions: UserSession[]
  onRevoke: (session: UserSession) => void | Promise<void>
  /** Sign out everywhere except here. */
  onRevokeOthers?: () => void | Promise<void>
  label?: string
  className?: string
}

const ACTIVE_WINDOW = 5 * 60_000

/**
 * Where this account is signed in, and a way to end any of it.
 *
 * The current session is pinned first and marked "This device", and cannot be
 * revoked from here — that is signing out, and it has its own button.
 * Location and IP are shown because "a phone in a city I have never been to"
 * is the whole reason anyone opens this list.
 */
export function SessionList({ sessions, onRevoke, onRevokeOthers, label = 'Active sessions', className }: SessionListProps) {
  const [pending, setPending] = useState<UserSession | 'others' | null>(null)
  const [busy, setBusy] = useState(false)

  const ordered = [...sessions].sort((a, b) =>
    a.current ? -1 : b.current ? 1 : b.lastActive.getTime() - a.lastActive.getTime(),
  )
  const others = sessions.filter((session) => !session.current).length

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    try {
      if (pending === 'others') await onRevokeOthers?.()
      else await onRevoke(pending)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Surface as="ul" aria-label={label} variant="card" className="divide-y divide-line">
        {ordered.map((session) => {
          const Icon = session.kind === 'mobile' ? PhoneIcon : DesktopIcon
          const recent = Date.now() - session.lastActive.getTime() < ACTIVE_WINDOW
          return (
            <li key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-glyph)]',
                  session.current ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink',
                )}
              >
                <Icon size={17} strokeWidth={2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="span" size="body">
                    {session.device}
                  </Text>
                  {session.current && (
                    <Tag size="sm" tone="accent">
                      This device
                    </Tag>
                  )}
                </div>
                <Text as="span" size="caption" tone="faint">
                  {[session.location, session.ip, session.current || recent ? 'Active now' : `Active ${relativeTime(session.lastActive)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
              {!session.current && (
                <Button size="sm" variant="ghost" onClick={() => setPending(session)} className="hover:text-danger">
                  Revoke
                  <VisuallyHidden> {session.device}</VisuallyHidden>
                </Button>
              )}
            </li>
          )
        })}
      </Surface>

      {onRevokeOthers && others > 0 && (
        <Button size="sm" variant="outline" onClick={() => setPending('others')} className="self-start">
          Sign out of {others} other {others === 1 ? 'session' : 'sessions'}
        </Button>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void confirm()}
        destructive
        busy={busy}
        title={pending === 'others' ? 'Sign out everywhere else?' : `Sign out ${pending?.device ?? ''}?`}
        description={
          pending === 'others'
            ? 'Every other browser and device will need to sign in again. This one stays signed in.'
            : 'That device will need to sign in again. If you do not recognise it, change your password too.'
        }
        confirmLabel={pending === 'others' ? 'Sign out others' : 'Revoke session'}
      />
    </div>
  )
}
