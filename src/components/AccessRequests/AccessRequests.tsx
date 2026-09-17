'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { EmptyState } from '../EmptyState'
import { Field } from '../Field'
import { Modal } from '../Modal'
import { Select } from '../Select'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { CheckIcon } from '../internal/icons'

export interface AccessRequestsItem {
  id: string
  name: string
  email: string
  avatarSrc?: string
  /** The role asked for — an AccessRequestsRole value. */
  role: string
  /** What they want access to, when it is not the whole workspace. */
  resource?: string
  /** Their note to the approver. */
  message?: string
  /** When they asked, already formatted — “2 hours ago”. */
  requestedAt?: string
}

export interface AccessRequestsRole {
  value: string
  label: string
}

export interface AccessRequestsApproval {
  id: string
  /** The role granted, which may differ from the one requested. */
  role: string
}

export interface AccessRequestsProps {
  /** Pending requests. Remove them once decided. */
  requests: AccessRequestsItem[]
  /** Roles an approver can grant. */
  roles: AccessRequestsRole[]
  /** Called with each approved request and the role granted. */
  onApprove: (approvals: AccessRequestsApproval[]) => void | Promise<void>
  /** Called with the denied ids and the optional reason sent to the requesters. */
  onDeny: (ids: string[], reason: string) => void | Promise<void>
  /** Name of the thing being joined, for the copy. */
  resourceName?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The queue of people asking to be let in, and one decision for each.
 *
 * Approving grants the role in the row, which starts as the one requested but
 * can be lowered first — the most common edit is “yes, but as a viewer”, and a
 * separate trip to the member list afterwards is how people end up with more
 * access than anyone meant to give. Denying asks for an optional reason that is
 * sent to the requester, since a silent no just produces the same request
 * again. Selecting rows turns both actions into bulk actions.
 */
export function AccessRequests({ requests, roles, onApprove, onDeny, resourceName = 'this workspace', className }: AccessRequestsProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [granted, setGranted] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string[]>([])
  const [denying, setDenying] = useState<string[] | null>(null)
  const [reason, setReason] = useState('')

  const ids = requests.map((request) => request.id)
  const chosen = selected.filter((id) => ids.includes(id))
  const all = chosen.length > 0 && chosen.length === ids.length
  const roleOf = (request: AccessRequestsItem) => granted[request.id] ?? request.role
  const labelOf = (value: string) => roles.find((role) => role.value === value)?.label ?? value
  const nameOf = (id: string) => requests.find((request) => request.id === id)?.name ?? 'this person'

  const settle = async (target: string[], action: () => void | Promise<void>) => {
    setBusy((current) => [...current, ...target])
    try {
      await action()
      setSelected((current) => current.filter((id) => !target.includes(id)))
    } finally {
      setBusy((current) => current.filter((id) => !target.includes(id)))
    }
  }

  const approve = (target: string[]) =>
    void settle(target, () =>
      onApprove(requests.filter((request) => target.includes(request.id)).map((request) => ({ id: request.id, role: roleOf(request) }))),
    )

  const confirmDeny = async () => {
    if (!denying) return
    const target = denying
    setDenying(null)
    await settle(target, () => onDeny(target, reason.trim()))
    setReason('')
  }

  if (requests.length === 0) {
    return (
      <Surface variant="card" className={className}>
        <EmptyState
          icon={CheckIcon}
          size="sm"
          title="No pending requests"
          description={`When someone asks to join ${resourceName}, their request appears here for you to approve or deny.`}
        />
      </Surface>
    )
  }

  return (
    <Surface variant="card" className={cn('flex flex-col', className)}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            boxSize="sm"
            checked={all}
            indeterminate={chosen.length > 0 && !all}
            onChange={() => setSelected(all ? [] : ids)}
          />
          <Text as="span" size="label" weight="semibold" tone="soft">
            {chosen.length ? `${chosen.length} selected` : plural(requests.length, 'pending request')}
          </Text>
        </label>
        {chosen.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDenying(chosen)}>
              {`Deny ${chosen.length}`}
            </Button>
            <Button size="sm" onClick={() => approve(chosen)}>
              {`Approve ${chosen.length}`}
            </Button>
          </div>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {requests.map((request) => {
          const role = roleOf(request)
          const working = busy.includes(request.id)
          return (
            <li key={request.id} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', working && 'opacity-60')}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox
                  boxSize="sm"
                  className="mt-3"
                  aria-label={`Select request from ${request.name}`}
                  checked={chosen.includes(request.id)}
                  disabled={working}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked ? [...current, request.id] : current.filter((id) => id !== request.id),
                    )
                  }
                />
                <Avatar name={request.name} src={request.avatarSrc} size="md" />
                <div className="flex min-w-0 flex-col gap-1">
                  <Text as="span" size="body" truncate>
                    {request.name}
                  </Text>
                  <Text as="span" size="caption" tone="faint" truncate>
                    {[request.email, request.requestedAt].filter(Boolean).join(' · ')}
                  </Text>
                  <Text as="span" size="caption" tone="soft" leading="normal">
                    {`Asked for ${labelOf(request.role)} access${request.resource ? ` to ${request.resource}` : ''}`}
                  </Text>
                  {request.message && (
                    <blockquote className="m-0 mt-1 border-l-2 border-line-strong pl-3">
                      <Text as="span" size="caption" weight="medium" tone="soft" leading="normal">
                        {request.message}
                      </Text>
                    </blockquote>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[76px] sm:pl-0">
                <div className="flex flex-col items-end gap-1">
                  <Select
                    label={`Role for ${request.name}`}
                    size="sm"
                    options={roles}
                    value={role}
                    onValueChange={(next) => setGranted((current) => ({ ...current, [request.id]: next }))}
                    disabled={working}
                  />
                  {role !== request.role && (
                    <Text as="span" size="micro" weight="semibold" tone="faint">
                      {`Changed from ${labelOf(request.role)}`}
                    </Text>
                  )}
                </div>
                <Button size="sm" variant="ghost" disabled={working} onClick={() => setDenying([request.id])} aria-label={`Deny ${request.name}`}>
                  Deny
                </Button>
                <Button size="sm" loading={working} onClick={() => approve([request.id])} aria-label={`Approve ${request.name} as ${labelOf(role)}`}>
                  Approve
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <Modal
        open={denying !== null}
        onClose={() => setDenying(null)}
        size="sm"
        title={denying && denying.length > 1 ? `Deny ${denying.length} requests?` : `Deny ${nameOf(denying?.[0] ?? '')}?`}
        description="They will be told their request was declined. They can ask again later."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDenying(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void confirmDeny()} className="bg-danger text-white hover:bg-danger/90">
              Deny access
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)" hint="Included in the email they receive.">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Modal>
    </Surface>
  )
}
