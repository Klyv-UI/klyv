'use client'

import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { Meter } from '../Meter'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { relativeTime, useRelativeClock } from '../../lib/time'

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface Approver {
  id: string
  name: string
  /** Their part in the decision — "Finance", "Second signatory". */
  role?: string
  state: ApprovalState
  at?: Date
  /** Their reason. Required in practice for a rejection. */
  note?: string
}

export interface ApprovalChainProps {
  approvers: Approver[]
  /** Accessible name — what is being approved. */
  label: string
  /** How many approvals are needed. Defaults to everyone. */
  required?: number
  /** The current person's id, so their row gets the actions. */
  youId?: string
  /** Called when the current step is approved. */
  onApprove?: () => void
  /** Called when the current step is rejected. */
  onReject?: () => void
  /** Merged last, so it wins. */
  className?: string
}

const TONE: Record<ApprovalState, 'success' | 'danger' | 'neutral' | 'warning'> = {
  approved: 'success',
  rejected: 'danger',
  skipped: 'neutral',
  pending: 'warning',
}

const WORD: Record<ApprovalState, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Not needed',
  pending: 'Waiting',
}

/**
 * Who has signed off, who has not, and whether that is enough yet.
 *
 * Approvals are usually drawn as a `Stepper`, which is wrong in the way that
 * matters: a stepper is a sequence, and approvals are parallel. Three people can
 * be waiting at once, the second can answer before the first, and the quorum can
 * be met without everyone replying at all.
 *
 * So the state is a count against a rule — two of three — rather than a
 * position in a line. That is also the only shape that can express the case
 * every sequential version gets wrong: one rejection ends it, however many
 * approvals are already in.
 *
 * A rejection carries its reason on the row. An approval flow that records only
 * the verdict sends the requester back to ask why in another channel, which is
 * where the decision then lives instead of here.
 */
export function ApprovalChain({
  approvers,
  label,
  required,
  youId,
  onApprove,
  onReject,
  className,
}: ApprovalChainProps) {
  const now = useRelativeClock(approvers.find((person) => person.at)?.at)

  const needed = required ?? approvers.filter((person) => person.state !== 'skipped').length
  const approved = approvers.filter((person) => person.state === 'approved').length
  const rejected = approvers.find((person) => person.state === 'rejected')
  const settled = Boolean(rejected) || approved >= needed

  const you = approvers.find((person) => person.id === youId)
  const yourTurn = you?.state === 'pending' && !settled

  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text size="caption" weight="bold" role="status" aria-live="polite">
          {rejected
            ? `Rejected by ${rejected.name}`
            : approved >= needed
              ? 'Fully approved'
              : `${approved} of ${needed} approvals`}
        </Text>
        {!rejected && (
          <Meter
            value={approved}
            total={needed}
            label={`${approved} of ${needed} approvals`}
            // Meter's segments are flex-1, so it needs a width to fill —
            // without one it collapses to a few pixels of content.
            className="min-w-[120px] flex-1"
          />
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {approvers.map((person) => (
          <li key={person.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <Avatar name={person.name} size="sm" className={person.state === 'skipped' ? 'opacity-50' : ''} />

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Text as="span" size="body" truncate>
                {person.id === youId ? `${person.name} (you)` : person.name}
                {person.role && (
                  <Text as="span" size="caption" tone="faint">
                    {' · '}
                    {person.role}
                  </Text>
                )}
              </Text>
              {/* The reason lives here, not in another channel. */}
              {person.note && (
                <Text as="span" size="caption" tone={person.state === 'rejected' ? 'danger' : 'soft'} leading="normal">
                  {person.note}
                </Text>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-2">
              {person.at && (
                <Text as="span" size="micro" tone="faint">
                  {relativeTime(person.at, now)}
                </Text>
              )}
              <StatusDot tone={TONE[person.state]} label={WORD[person.state]} />
              <Text as="span" size="caption" tone={person.state === 'rejected' ? 'danger' : 'soft'}>
                {WORD[person.state]}
              </Text>
            </span>
          </li>
        ))}
      </ul>

      {yourTurn && (onApprove || onReject) && (
        <div className="flex flex-wrap gap-2">
          {onApprove && <Button onClick={onApprove}>Approve</Button>}
          {onReject && (
            <Button variant="outline" onClick={onReject}>
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
