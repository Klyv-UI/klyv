'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { relativeTime } from '../../lib/time'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { IconButton } from '../IconButton'
import { InlineMessage } from '../InlineMessage'
import { Menu } from '../Menu'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { ChevronUpIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export type QuestionQueueSort = 'top' | 'newest'
export type QuestionQueueAction = 'answer' | 'reopen' | 'pin' | 'unpin' | 'hide'

export interface QuestionQueueQuestion {
  id: string
  text: string
  /** Who asked. Omit for an anonymous question. */
  author?: string
  votes: number
  /** Whether the person looking has upvoted it. */
  voted?: boolean
  answered?: boolean
  /** Pinned questions sit above the rest — the one being answered now. */
  pinned?: boolean
  /** Hidden by a host. Left out of the list. */
  hidden?: boolean
  createdAt: Date
}

export interface QuestionQueueProps {
  questions: QuestionQueueQuestion[]
  /** Submit a question. Return a promise to show progress; reject with a message to show it. */
  onAsk: (text: string, options: { anonymous: boolean }) => void | Promise<void>
  /** Upvote toggled. `voted` is the new state. */
  onVote: (id: string, voted: boolean) => void
  /** Show the moderation menu on every question. */
  isHost?: boolean
  /** A host acted on a question. */
  onModerate?: (id: string, action: QuestionQueueAction) => void
  /** Order (controlled). */
  sort?: QuestionQueueSort
  /** Initial order when uncontrolled. */
  defaultSort?: QuestionQueueSort
  onSortChange?: (sort: QuestionQueueSort) => void
  /** Longest question accepted. */
  maxLength?: number
  /** Allow asking without a name. */
  allowAnonymous?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const snippet = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text)

const DotsIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="12.5" cy="8" r="1.4" />
  </svg>
)

/**
 * Live Q&A for a talk, an all-hands or a webinar: ask, upvote, answer.
 *
 * The order is what makes it work. Pinned questions — the one on stage right
 * now — come first, open questions follow by votes or by time, and answered
 * ones sink to the bottom still visible, so nobody asks the same thing again.
 * Votes are toggles with a pressed state rather than one-way counters, because
 * a mis-tap has to be undoable.
 *
 * New questions arriving from other people are announced politely, batched
 * into one sentence when several land together, and never for the reader’s
 * own submission — they already know. Moderation lives in one menu per
 * question and only for hosts, so the audience view stays a list of questions.
 */
export function QuestionQueue({
  questions,
  onAsk,
  onVote,
  isHost = false,
  onModerate,
  sort: controlledSort,
  defaultSort = 'top',
  onSortChange,
  maxLength = 280,
  allowAnonymous = true,
  className,
}: QuestionQueueProps) {
  const fieldId = useId()
  const countId = useId()
  const anonymousId = useId()
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncontrolledSort, setUncontrolledSort] = useState(defaultSort)
  const sort = controlledSort ?? uncontrolledSort
  const [announcement, setAnnouncement] = useState('')

  const headingRef = useRef<HTMLHeadingElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const ownText = useRef<string | null>(null)

  useEffect(() => {
    const ids = new Set(questions.map((question) => question.id))
    if (seen.current === null) {
      seen.current = ids
      return
    }
    const fresh = questions.filter(
      (question) => !seen.current!.has(question.id) && !question.hidden && question.text !== ownText.current,
    )
    seen.current = ids
    if (fresh.length === 1) setAnnouncement(`New question: ${fresh[0]!.text}`)
    else if (fresh.length > 1) setAnnouncement(plural(fresh.length, 'new question'))
  }, [questions])

  const setSort = (next: QuestionQueueSort) => {
    if (controlledSort === undefined) setUncontrolledSort(next)
    onSortChange?.(next)
  }

  const ordered = questions
    .filter((question) => !question.hidden)
    .sort((a, b) => {
      const rank = (question: QuestionQueueQuestion) => (question.pinned ? 0 : question.answered ? 2 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (sort === 'top' && a.votes !== b.votes) return b.votes - a.votes
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const question = text.trim()
    if (!question) {
      setError('Write a question first.')
      return
    }
    setSending(true)
    setError(null)
    ownText.current = question
    try {
      await onAsk(question, { anonymous: allowAnonymous && anonymous })
      setText('')
      setAnnouncement('Your question was posted.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The question could not be posted.')
    } finally {
      setSending(false)
    }
  }

  const moderate = (question: QuestionQueueQuestion, action: QuestionQueueAction) => {
    onModerate?.(question.id, action)
    if (action !== 'hide') return
    setAnnouncement('Question hidden.')
    // The question and its menu trigger are gone, so focus goes to the list heading instead of the page.
    window.setTimeout(() => headingRef.current?.focus(), 0)
  }

  const left = maxLength - text.length

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-[12px] font-bold text-ink">
          Ask a question
        </label>
        <Textarea
          id={fieldId}
          rows={2}
          value={text}
          maxLength={maxLength}
          invalid={Boolean(error)}
          aria-describedby={countId}
          placeholder="What would you like to know?"
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
        />
        {error && (
          <InlineMessage tone="danger" live>
            {error}
          </InlineMessage>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {allowAnonymous && (
            <label
              htmlFor={anonymousId}
              className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-soft"
            >
              <Checkbox
                id={anonymousId}
                boxSize="sm"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
              />
              Ask anonymously
            </label>
          )}
          <Text
            id={countId}
            as="span"
            size="caption"
            tone={left < 20 ? 'danger' : 'faint'}
            tabular
            className="ml-auto"
          >
            {left} characters left
          </Text>
          <Button type="submit" size="sm" loading={sending}>
            Post question
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 ref={headingRef} tabIndex={-1} className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">
          {plural(ordered.length, 'question')}
        </h3>
        <SegmentedControl
          label="Sort questions"
          size="sm"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'newest', label: 'Newest' },
          ]}
        />
      </div>

      {ordered.length === 0 ? (
        <Text size="label" tone="faint" className="py-6 text-center">
          No questions yet. Be the first to ask.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((question) => (
            <li
              key={question.id}
              className={cn(
                'flex items-start gap-3 rounded-[var(--radius-tile)] border p-3',
                question.pinned
                  ? 'border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)]'
                  : 'border-line bg-surface',
                question.answered && 'opacity-70',
              )}
            >
              <button
                type="button"
                aria-pressed={Boolean(question.voted)}
                aria-label={`Upvote “${snippet(question.text)}”, ${plural(question.votes, 'vote')}`}
                onClick={() => onVote(question.id, !question.voted)}
                className={cn(
                  'flex w-11 shrink-0 flex-col items-center rounded-[var(--radius-field)] border py-1',
                  'text-[12px] font-bold transition-colors',
                  question.voted
                    ? 'border-accent-strong bg-accent text-accent-ink'
                    : 'border-line text-ink-soft hover:bg-surface-muted',
                )}
              >
                <ChevronUpIcon size={14} />
                <span className="tabular-nums">{question.votes}</span>
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Text size="body" weight="semibold" leading="normal" className="break-words">
                  {question.text}
                </Text>
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="span" size="caption" tone="faint">
                    {question.author ?? 'Anonymous'} · {relativeTime(question.createdAt)}
                  </Text>
                  {question.pinned && <Badge>Pinned</Badge>}
                  {question.answered && <Badge tone="neutral">Answered</Badge>}
                </div>
              </div>
              {isHost && onModerate && (
                <Menu
                  label="Moderate question"
                  align="end"
                  trigger={
                    <IconButton
                      icon={DotsIcon}
                      label={`Moderate “${snippet(question.text)}”`}
                      size="xs"
                      aria-haspopup="menu"
                    />
                  }
                  items={[
                    question.answered
                      ? { id: 'reopen', label: 'Mark as unanswered', onSelect: () => moderate(question, 'reopen') }
                      : { id: 'answer', label: 'Mark as answered', onSelect: () => moderate(question, 'answer') },
                    question.pinned
                      ? { id: 'unpin', label: 'Unpin', onSelect: () => moderate(question, 'unpin') }
                      : { id: 'pin', label: 'Pin to top', onSelect: () => moderate(question, 'pin') },
                    'separator',
                    { id: 'hide', label: 'Hide question', destructive: true, onSelect: () => moderate(question, 'hide') },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
