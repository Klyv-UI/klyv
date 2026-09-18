'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Avatar } from '../Avatar'
import { Text } from '../Text'
import { TypingIndicator } from '../TypingIndicator'
import { CheckIcon, ChevronDownIcon } from '../internal/icons'

export type ChatThreadStatus = 'sending' | 'sent' | 'read'

export interface ChatThreadAuthor {
  id: string
  /** Full name — the avatar initials and the group heading. */
  name: string
  avatarSrc?: string
}

export interface ChatThreadMessage {
  id: string
  author: ChatThreadAuthor
  /** The message itself. Plain text or rich content. */
  body: ReactNode
  /** When it was sent — a Date, a timestamp or an ISO string. */
  sentAt: Date | number | string
  /** Delivery state. Only shown on the current person’s own messages. */
  status?: ChatThreadStatus
}

export interface ChatThreadProps {
  /** Oldest first. */
  messages: ChatThreadMessage[]
  /** Whose messages sit on the right, in the accent. */
  currentUserId: string
  /** Names of the people typing right now. Rendered with TypingIndicator. */
  typing?: string[]
  /** Accessible name for the log. */
  label?: string
  /** Messages further apart than this start a new group, in minutes. */
  groupGap?: number
  /** Distance from the bottom, in pixels, that still counts as “at the bottom”. */
  pinThreshold?: number
  /** Merged last, so it wins. Give the thread a height here. */
  className?: string
}

const STATUS_TEXT: Record<ChatThreadStatus, string> = { sending: 'Sending…', sent: 'Sent', read: 'Read' }

const time = (value: Date) => value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function dayLabel(value: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (value.toDateString() === today.toDateString()) return 'Today'
  if (value.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return value.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

interface Group {
  key: string
  day?: string
  author: ChatThreadAuthor
  at: Date
  items: ChatThreadMessage[]
}

function groupMessages(messages: ChatThreadMessage[], gapMinutes: number): Group[] {
  const groups: Group[] = []
  let lastDay = ''
  for (const message of messages) {
    const at = new Date(message.sentAt)
    const day = at.toDateString()
    const previous = groups[groups.length - 1]
    const lastAt = previous ? new Date(previous.items[previous.items.length - 1].sentAt) : null
    const continues =
      previous && day === lastDay && previous.author.id === message.author.id && lastAt && at.getTime() - lastAt.getTime() <= gapMinutes * 60_000
    if (continues) previous.items.push(message)
    else groups.push({ key: message.id, day: day !== lastDay ? dayLabel(at) : undefined, author: message.author, at, items: [message] })
    lastDay = day
  }
  return groups
}

/**
 * A conversation, read the way people read one: runs of messages from the same
 * person collapse under one avatar and one timestamp, and a new day gets a
 * divider rather than a date on every bubble.
 *
 * It follows the conversation only while the reader is at the bottom. Someone
 * who has scrolled up to reread something is not yanked back down when a reply
 * arrives — the thread counts what they have missed and offers a button to jump.
 * Sending your own message is the exception: you have just acted, so you see it.
 *
 * The list is a `log` with polite announcements, so new messages are read out
 * without interrupting, and it is focusable so the keyboard can scroll it.
 */
export function ChatThread({
  messages,
  currentUserId,
  typing = [],
  label = 'Conversation',
  groupGap = 5,
  pinThreshold = 48,
  className,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const seen = useRef(messages.length)
  const [unread, setUnread] = useState(0)
  const reduced = usePrefersReducedMotion()

  const toBottom = (smooth: boolean) => {
    const node = scrollRef.current
    if (!node) return
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: node.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' })
    } else {
      node.scrollTop = node.scrollHeight
    }
  }

  const onScroll = () => {
    const node = scrollRef.current
    if (!node) return
    pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight <= pinThreshold
    if (pinned.current) setUnread(0)
  }

  useIsomorphicLayoutEffect(() => {
    const added = messages.slice(seen.current)
    seen.current = messages.length
    const mine = added.some((message) => message.author.id === currentUserId)
    if (pinned.current || mine) {
      toBottom(false)
      pinned.current = true
      setUnread(0)
    } else if (added.length) {
      setUnread((count) => count + added.length)
    }
  }, [messages])

  // Typing appearing at the bottom should not push the latest message out of view.
  useEffect(() => {
    if (pinned.current) toBottom(false)
  }, [typing.length])

  const groups = groupMessages(messages, groupGap)

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[var(--radius-tile)] p-4"
      >
        {groups.map((group) => {
          const own = group.author.id === currentUserId
          const last = group.items[group.items.length - 1]
          return (
            <div key={group.key} className="flex flex-col gap-3">
              {group.day && (
                <div className="flex items-center gap-3" role="separator" aria-label={group.day}>
                  <span className="h-px flex-1 bg-line" />
                  <Text as="span" size="caption" weight="semibold" tone="faint">
                    {group.day}
                  </Text>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={cn('flex items-start gap-2.5', own && 'flex-row-reverse')}>
                {!own && <Avatar name={group.author.name} src={group.author.avatarSrc} size="xs" />}
                <div className={cn('flex min-w-0 max-w-[78%] flex-col gap-1', own ? 'items-end' : 'items-start')}>
                  <Text as="span" size="caption" tone="faint" className="flex gap-1.5">
                    {!own && <span className="font-bold text-ink-soft">{group.author.name}</span>}
                    <time dateTime={group.at.toISOString()}>{time(group.at)}</time>
                  </Text>
                  {group.items.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'whitespace-pre-wrap break-words px-3.5 py-2 text-[13px] font-medium leading-normal',
                        own ? 'rounded-[var(--radius-18)] rounded-tr-[var(--radius-6)] bg-accent text-accent-ink' : 'rounded-[var(--radius-18)] rounded-tl-[var(--radius-6)] bg-surface-muted text-ink',
                        message.status === 'sending' && 'opacity-60',
                      )}
                    >
                      {message.body}
                    </div>
                  ))}
                  {own && last.status && (
                    <Text as="span" size="micro" tone="faint" className="inline-flex items-center gap-1">
                      {last.status !== 'sending' && (
                        <span className={cn('inline-flex', last.status === 'read' && 'text-ink-soft')} aria-hidden="true">
                          <CheckIcon size={11} />
                          {last.status === 'read' && <CheckIcon size={11} className="-ml-1.5" />}
                        </span>
                      )}
                      {STATUS_TEXT[last.status]}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {typing.length > 0 && <TypingIndicator names={typing} size="sm" />}
      </div>

      {unread > 0 && (
        <button
          type="button"
          onClick={() => {
            toBottom(true)
            pinned.current = true
            setUnread(0)
          }}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-bold text-ink-inverse shadow-[var(--shadow-float)]"
        >
          <ChevronDownIcon size={13} />
          {unread === 1 ? '1 new message' : `${unread} new messages`}
        </button>
      )}
    </div>
  )
}
