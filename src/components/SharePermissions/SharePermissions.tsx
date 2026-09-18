'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { EMAIL_PATTERN } from '../../lib/format'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { InlineMessage } from '../InlineMessage'
import { Input } from '../Input'
import { Menu } from '../Menu'
import { Select } from '../Select'
import { Text } from '../Text'
import { ChevronDownIcon, LockIcon } from '../internal/icons'

export type SharePermissionsRole = 'viewer' | 'commenter' | 'editor'
export type SharePermissionsAccess = 'restricted' | 'link'

export interface SharePermissionsPerson {
  id: string
  name: string
  email: string
  role: SharePermissionsRole
  /** The owner is listed first and can be neither demoted nor removed. */
  owner?: boolean
  avatarSrc?: string
}

export interface SharePermissionsProps {
  /** Everyone with access, owner included. */
  people: SharePermissionsPerson[]
  /** Invite someone by email. Return a promise to show progress; reject with a message to show it. */
  onInvite: (email: string, role: SharePermissionsRole) => void | Promise<void>
  /** Someone’s role was changed from their menu. */
  onRoleChange: (id: string, role: SharePermissionsRole) => void
  /** Someone was removed from their menu. */
  onRemove: (id: string) => void
  /** Who else can open it: only the people listed, or anyone holding the link. */
  generalAccess: SharePermissionsAccess
  onGeneralAccessChange: (access: SharePermissionsAccess) => void
  /** What anyone with the link can do. */
  linkRole?: SharePermissionsRole
  onLinkRoleChange?: (role: SharePermissionsRole) => void
  /** The link the copy button puts on the clipboard. */
  link: string
  /** The id of the person looking, marked “(you)”. */
  currentUserId?: string
  /** Merged last, so it wins. */
  className?: string
}

const ROLE_LABELS: Record<SharePermissionsRole, string> = {
  viewer: 'Viewer',
  commenter: 'Commenter',
  editor: 'Editor',
}

const LINK_VERBS: Record<SharePermissionsRole, string> = {
  viewer: 'view',
  commenter: 'comment',
  editor: 'edit',
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as SharePermissionsRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

/**
 * The body of a share dialog: invite, see who has access, set the link.
 *
 * It is controlled end to end — the people list and the link setting live with
 * the caller, because both are server state and a share panel that edits its
 * own copy is one refresh away from lying. What the panel owns is the parts
 * that are easy to get wrong: an invite is checked as an email and against the
 * people already listed before it is sent, the owner has no menu at all rather
 * than a menu of disabled options, and every change is announced, so removing
 * someone from a keyboard is not a silent disappearance.
 *
 * Each person’s role and removal share one Menu, because they are the same
 * decision — what can this person do — and a separate delete button beside
 * every row is a mis-click waiting to happen.
 */
export function SharePermissions({
  people,
  onInvite,
  onRoleChange,
  onRemove,
  generalAccess,
  onGeneralAccessChange,
  linkRole = 'viewer',
  onLinkRoleChange,
  link,
  currentUserId,
  className,
}: SharePermissionsProps) {
  const headingId = useId()
  const accessHeadingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SharePermissionsRole>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')

  const ordered = [...people].sort((a, b) => Number(Boolean(b.owner)) - Number(Boolean(a.owner)))

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    if (people.some((person) => person.email.toLowerCase() === address)) {
      setError(`${address} already has access.`)
      return
    }
    setError(null)
    setSending(true)
    try {
      await onInvite(address, role)
      setEmail('')
      setNotice(`Invited ${address} as ${ROLE_LABELS[role].toLowerCase()}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The invitation could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <form onSubmit={(event) => void invite(event)} noValidate className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="email"
            inputSize="sm"
            aria-label="Invite by email"
            placeholder="Add people by email"
            autoComplete="off"
            value={email}
            invalid={Boolean(error)}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
            containerClassName="min-w-[180px] flex-1"
          />
          <Select
            label="Role for the invited person"
            size="sm"
            value={role}
            onValueChange={setRole}
            options={ROLE_OPTIONS}
          />
          <Button type="submit" size="sm" loading={sending} disabled={!email.trim()}>
            Invite
          </Button>
        </div>
        {error && (
          <InlineMessage tone="danger" live>
            {error}
          </InlineMessage>
        )}
      </form>

      <section aria-labelledby={headingId} className="flex flex-col gap-2">
        <Text id={headingId} as="h3" size="label" weight="bold" tone="soft">
          People with access
        </Text>
        <ul className="flex flex-col">
          {ordered.map((person) => {
            const you = person.id === currentUserId
            return (
              <li key={person.id} className="flex items-center gap-3 py-2">
                <span aria-hidden="true" className="flex">
                  <Avatar name={person.name} src={person.avatarSrc} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">
                    {person.name}
                    {you && <span className="font-medium text-ink-faint"> (you)</span>}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-ink-faint">{person.email}</span>
                </span>
                {person.owner ? (
                  <Text as="span" size="label" weight="semibold" tone="faint" className="px-3">
                    Owner
                  </Text>
                ) : (
                  <Menu
                    label={`Access for ${person.name}`}
                    align="end"
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-haspopup="menu"
                        aria-label={`${person.name}: ${ROLE_LABELS[person.role]}. Change access`}
                      >
                        {ROLE_LABELS[person.role]}
                        <ChevronDownIcon size={13} />
                      </Button>
                    }
                    items={[
                      ...ROLE_OPTIONS.map((option) => ({
                        id: option.value,
                        label: option.label,
                        selected: option.value === person.role,
                        onSelect: () => {
                          if (option.value === person.role) return
                          onRoleChange(person.id, option.value)
                          setNotice(`${person.name} is now ${option.label.toLowerCase()}.`)
                        },
                      })),
                      'separator' as const,
                      {
                        id: 'remove',
                        label: 'Remove access',
                        destructive: true,
                        onSelect: () => {
                          onRemove(person.id)
                          setNotice(`Removed ${person.name}.`)
                          // The row, and the menu's trigger with it, is gone — so focus needs somewhere to land.
                          window.setTimeout(() => inputRef.current?.focus(), 0)
                        },
                      },
                    ]}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby={accessHeadingId} className="flex flex-col gap-2">
        <Text id={accessHeadingId} as="h3" size="label" weight="bold" tone="soft">
          General access
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              generalAccess === 'link' ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink-soft',
            )}
          >
            {generalAccess === 'link' ? (
              <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="8" cy="8" r="6.25" />
                <path d="M1.75 8h12.5" />
                <path d="M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.25 5.4 8S6.2 3.65 8 1.75z" />
              </svg>
            ) : (
              <LockIcon size={15} />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <Select
              label="Who can open this"
              size="sm"
              variant="pill"
              value={generalAccess}
              onValueChange={(next) => {
                onGeneralAccessChange(next)
                setNotice(
                  next === 'link' ? 'Anyone with the link can now open this.' : 'Only people with access can open this.',
                )
              }}
              options={[
                { value: 'restricted', label: 'Restricted' },
                { value: 'link', label: 'Anyone with the link' },
              ]}
            />
            <Text size="caption" tone="faint" className="px-1">
              {generalAccess === 'link'
                ? `Anyone on the internet with the link can ${LINK_VERBS[linkRole]}.`
                : 'Only people listed above can open with the link.'}
            </Text>
          </div>
          {generalAccess === 'link' && onLinkRoleChange && (
            <Select
              label="What anyone with the link can do"
              size="sm"
              value={linkRole}
              onValueChange={onLinkRoleChange}
              options={ROLE_OPTIONS}
            />
          )}
        </div>
      </section>

      <div className="flex justify-end border-t border-line pt-4">
        <CopyButton value={link} label="Copy link" copiedLabel="Link copied" />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {notice}
      </span>
    </div>
  )
}
