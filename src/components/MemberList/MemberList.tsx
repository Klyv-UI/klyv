'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { type StatusDotTone } from '../StatusDot'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { SearchField } from '../SearchField'
import { Select } from '../Select'
import { ConfirmDialog } from '../ConfirmDialog'
import { StatusPill } from '../internal/StatusPill'
import { plural } from '../../lib/format'

export type MemberStatus = 'active' | 'invited' | 'suspended'

export interface Member {
  id: string
  name: string
  email: string
  avatarSrc?: string
  /** A RoleOption value. */
  role: string
  status?: MemberStatus
  /** "Active 3 hours ago". */
  lastActive?: string
}

export interface RoleOption {
  value: string
  label: string
  description?: string
}

export interface MemberListProps {
  members: Member[]
  roles: RoleOption[]
  /** The signed-in person, marked "You". */
  currentUserId?: string
  /** The role that must never reach zero holders. */
  ownerRole?: string
  /** Whether the viewer may change roles and remove people. */
  canManage?: boolean
  onRoleChange?: (memberId: string, role: string) => void
  onRemove?: (member: Member) => void | Promise<void>
  onResendInvite?: (member: Member) => void
  /** Search by name or email. On by default past eight people. */
  searchable?: boolean
  label?: string
  className?: string
}

const STATUS: Record<Exclude<MemberStatus, 'active'>, { label: string; tone: StatusDotTone }> = {
  invited: { label: 'Invited', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
}

/**
 * The people in a workspace, their roles, and the controls to change both.
 *
 * It enforces the one rule every team screen needs and most forget: a
 * workspace cannot lose its last owner. The last owner's role and remove
 * controls are disabled with the reason on screen — discovering it through a
 * 409 after the dialog has closed is how people end up locked out of their own
 * billing.
 *
 * Removal always confirms, naming the person; pending invitations can be sent
 * again from the row that shows them as pending.
 */
export function MemberList({
  members,
  roles,
  currentUserId,
  ownerRole = 'owner',
  canManage = true,
  onRoleChange,
  onRemove,
  onResendInvite,
  searchable,
  label = 'Members',
  className,
}: MemberListProps) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState<string | null>(null)

  const showSearch = searchable ?? members.length > 8
  const owners = members.filter((member) => member.role === ownerRole && member.status !== 'invited')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(needle))
  }, [members, query])

  const roleLabel = (value: string) => roles.find((role) => role.value === value)?.label ?? value

  const confirmRemove = async () => {
    if (!pending || !onRemove) return
    setBusy(true)
    try {
      await onRemove(pending)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text size="caption" weight="bold" tone="faint" role="status" aria-live="polite">
          {query ? `${visible.length} of ${plural(members.length, 'member')}` : plural(members.length, 'member')}
        </Text>
        {showSearch && (
          <SearchField
            value={query}
            onValueChange={setQuery}
            label="Search members"
            placeholder="Search by name or email"
            inputSize="sm"
            containerClassName="w-full sm:w-[260px]"
          />
        )}
      </div>

      <ul aria-label={label} className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center">
            <Text size="label" tone="faint">
              No one matches “{query}”.
            </Text>
          </li>
        )}
        {visible.map((member) => {
          const you = member.id === currentUserId
          const lastOwner = member.role === ownerRole && owners.length <= 1 && member.status !== 'invited'
          const manageable = canManage && !lastOwner
          const status = member.status && member.status !== 'active' ? STATUS[member.status] : undefined

          return (
            <li
              key={member.id}
              className="grid items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_170px_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} src={member.avatarSrc} size="sm" />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Text as="span" size="body" truncate>
                      {member.name}
                    </Text>
                    {you && <Tag size="sm">You</Tag>}
                    {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
                  </div>
                  <Text as="span" size="caption" tone="faint" truncate>
                    {member.email}
                    {member.lastActive && member.status !== 'invited' ? ` · ${member.lastActive}` : ''}
                  </Text>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {manageable && onRoleChange ? (
                  <Select
                    label={`Role for ${member.name}`}
                    size="sm"
                    fullWidth
                    value={member.role}
                    onValueChange={(role) => onRoleChange(member.id, role)}
                    options={roles.map((role) => ({ value: role.value, label: role.label, hint: role.description }))}
                  />
                ) : (
                  <Text as="span" size="label" weight="semibold" tone="soft">
                    {roleLabel(member.role)}
                  </Text>
                )}
                {lastOwner && canManage && (
                  <Text as="span" size="micro" weight="semibold" tone="faint">
                    Every workspace needs an owner
                  </Text>
                )}
              </div>

              <div className="flex items-center justify-end gap-1">
                {member.status === 'invited' && onResendInvite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onResendInvite(member)
                      setResent(member.id)
                    }}
                  >
                    {resent === member.id ? 'Sent' : 'Resend'}
                  </Button>
                )}
                {canManage && onRemove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={lastOwner}
                    onClick={() => setPending(member)}
                    className="hover:text-danger"
                  >
                    {member.status === 'invited' ? 'Revoke' : you ? 'Leave' : 'Remove'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void confirmRemove()}
        destructive
        busy={busy}
        title={
          pending?.status === 'invited'
            ? `Revoke the invitation to ${pending.email}?`
            : pending?.id === currentUserId
              ? 'Leave this workspace?'
              : `Remove ${pending?.name ?? ''}?`
        }
        description={
          pending?.status === 'invited'
            ? 'The link in their email will stop working. You can invite them again later.'
            : pending?.id === currentUserId
              ? 'You will lose access immediately and need a new invitation to come back.'
              : 'They lose access immediately. Anything they created stays in the workspace.'
        }
        confirmLabel={pending?.status === 'invited' ? 'Revoke invitation' : pending?.id === currentUserId ? 'Leave' : 'Remove'}
      />
    </div>
  )
}
