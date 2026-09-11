'use client'

import { useId, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Input } from '../Input'
import { Label } from '../Label'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { InlineMessage } from '../InlineMessage'
import { Select } from '../Select'
import type { RoleOption } from '../MemberList'
import { EMAIL_PATTERN, plural } from '../../lib/format'

export interface Invite {
  email: string
  role: string
}

export interface InviteMembersProps {
  roles: RoleOption[]
  defaultRole?: string
  onInvite: (invites: Invite[]) => void | Promise<void>
  /** Already in the workspace or already invited — caught before sending. */
  existingEmails?: string[]
  /** Seats on the plan. Inviting past them warns, or blocks without allowOverage. */
  seats?: { used: number; total: number }
  /** Extra seats are billed rather than refused. */
  allowOverage?: boolean
  label?: string
  className?: string
}

interface Draft {
  email: string
  error?: string
}

/**
 * Invite several people at once, with one role, and know what it will cost.
 *
 * Addresses become chips as they are typed, pasted or separated by commas —
 * pasting a column out of a spreadsheet is the common case and it just works.
 * Every chip is checked on the way in: malformed, a duplicate, or someone who
 * is already a member. Clicking a bad chip puts it back in the field to fix,
 * which beats deleting it and typing it again.
 *
 * Seats are checked before sending, not after. "3 seats left — this adds 2 to
 * your bill" is a decision; a failed request is a surprise.
 */
export function InviteMembers({
  roles,
  defaultRole,
  onInvite,
  existingEmails = [],
  seats,
  allowOverage = false,
  label = 'Email addresses',
  className,
}: InviteMembersProps) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [text, setText] = useState('')
  const [role, setRole] = useState(defaultRole ?? roles[0]?.value ?? '')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null)

  const existing = new Set(existingEmails.map((email) => email.toLowerCase()))

  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((part) => part.trim().replace(/^<|>$/g, '').toLowerCase())
      .filter(Boolean)
    if (parts.length === 0) return
    setResult(null)
    setDrafts((current) => {
      const seen = new Set(current.map((draft) => draft.email))
      const next = [...current]
      for (const email of parts) {
        if (seen.has(email)) continue
        seen.add(email)
        next.push({
          email,
          error: !EMAIL_PATTERN.test(email)
            ? 'Not a valid email address'
            : existing.has(email)
              ? 'Already a member or invited'
              : undefined,
        })
      }
      return next
    })
    setText('')
  }

  const valid = drafts.filter((draft) => !draft.error)
  const invalid = drafts.filter((draft) => draft.error)
  const seatsLeft = seats ? Math.max(0, seats.total - seats.used) : Infinity
  const overBy = Math.max(0, valid.length - seatsLeft)
  const blocked = overBy > 0 && !allowOverage

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      if (!text.trim()) return
      event.preventDefault()
      commit(text)
    }
    if (event.key === 'Backspace' && !text && drafts.length > 0) {
      setDrafts((current) => current.slice(0, -1))
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!/[\s,;]/.test(pasted)) return
    event.preventDefault()
    commit(`${text} ${pasted}`)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) {
      commit(text)
      return
    }
    if (valid.length === 0 || invalid.length > 0 || blocked) return
    setSending(true)
    try {
      await onInvite(valid.map((draft) => ({ email: draft.email, role })))
      setResult({ tone: 'success', message: `Invited ${plural(valid.length, 'person', 'people')}.` })
      setDrafts([])
    } catch (error) {
      setResult({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'The invitations could not be sent.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className={cn('flex flex-col gap-3', className)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <div
          onClick={() => inputRef.current?.focus()}
          className={cn(
            'flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] border bg-surface px-2 py-1.5 transition-colors focus-within:border-line-strong',
            invalid.length > 0 ? 'border-danger' : 'border-line',
          )}
        >
          <ul className="contents" aria-label="Addresses to invite">
            {drafts.map((draft) => (
              <li key={draft.email} className="contents">
                <Chip
                  size="sm"
                  label={draft.email}
                  title={draft.error ?? 'Click to edit'}
                  aria-invalid={draft.error ? true : undefined}
                  className={cn(draft.error && 'border-danger text-danger')}
                  onClick={(event) => {
                    event.stopPropagation()
                    setDrafts((current) => current.filter((item) => item.email !== draft.email))
                    setText(draft.email)
                    inputRef.current?.focus()
                  }}
                  onRemove={() => setDrafts((current) => current.filter((item) => item.email !== draft.email))}
                />
              </li>
            ))}
          </ul>
          <Input
            ref={inputRef}
            id={inputId}
            variant="bare"
            type="email"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => commit(text)}
            placeholder={drafts.length === 0 ? 'name@company.com, another@company.com' : ''}
            aria-describedby={hintId}
            containerClassName="min-w-[160px] flex-1"
            className="h-7 px-1.5 text-[13px]"
          />
        </div>
        <Text id={hintId} size="caption" tone="faint">
          Separate addresses with commas or spaces, or paste a list.
          {invalid.length > 0 && <VisuallyHidden> {plural(invalid.length, 'address')} need fixing.</VisuallyHidden>}
        </Text>
      </div>

      {invalid.length > 0 && (
        <InlineMessage tone="danger" live>
          {invalid.length === 1
            ? `${invalid[0]!.email}: ${invalid[0]!.error}. Click it to edit.`
            : `${plural(invalid.length, 'address', 'addresses')} need fixing — hover or click them to see why.`}
        </InlineMessage>
      )}

      {seats && valid.length > 0 && overBy > 0 && (
        <InlineMessage tone={allowOverage ? 'warning' : 'danger'} live>
          {allowOverage
            ? `${plural(seatsLeft, 'seat')} left. Sending adds ${plural(overBy, 'seat')} to your plan.`
            : `Only ${plural(seatsLeft, 'seat')} left on your plan. Remove ${overBy} or upgrade to invite everyone.`}
        </InlineMessage>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Role for the invited people"
          size="sm"
          value={role}
          onValueChange={setRole}
          options={roles.map((option) => ({ value: option.value, label: option.label, hint: option.description }))}
        />
        <Button type="submit" size="sm" loading={sending} disabled={valid.length === 0 || invalid.length > 0 || blocked}>
          {valid.length > 1 ? `Send ${valid.length} invites` : 'Send invite'}
        </Button>
        {seats && (
          <Text as="span" size="caption" weight="semibold" tone="faint" className="ml-auto" tabular>
            {seats.used} of {seats.total} seats used
          </Text>
        )}
      </div>

      {result && (
        <InlineMessage tone={result.tone} live>
          {result.message}
        </InlineMessage>
      )}
    </form>
  )
}
