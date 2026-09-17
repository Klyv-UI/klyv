'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { RelativeTime } from '../RelativeTime'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { CheckIcon } from '../internal/icons'

export interface CommentThreadAuthor {
  id: string
  name: string
  avatarSrc?: string
}

export interface CommentThreadReaction {
  emoji: string
  count: number
  /** Whether the current person is one of the count. */
  reacted: boolean
}

export interface CommentThreadComment {
  id: string
  author: CommentThreadAuthor
  body: string
  createdAt: Date | number | string
  /** Set once the body has been changed after posting. */
  editedAt?: Date | number | string
  reactions?: CommentThreadReaction[]
  replies?: CommentThreadComment[]
}

export interface CommentThreadProps {
  /** Top-level comments, oldest first. The caller owns the tree. */
  comments: CommentThreadComment[]
  /** Whose comments get Edit and Delete. */
  currentUserId: string
  /** A reply to a comment, or a new top-level comment when `parentId` is null. */
  onReply: (parentId: string | null, body: string) => void
  onEdit?: (id: string, body: string) => void
  onDelete?: (id: string) => void
  /** Toggles one reaction for the current person. Omit to hide reactions. */
  onReact?: (id: string, emoji: string) => void
  /** The reactions offered on every comment. */
  reactionChoices?: string[]
  /** Nesting stops here. Replying at the deepest level answers the parent, with a mention. */
  maxDepth?: number
  /** Resolved threads hide their composers and read as settled. */
  resolved?: boolean
  /** Shows the Resolve / Reopen control. */
  onResolvedChange?: (resolved: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

function InlineComposer({ label, initial = '', submitLabel, onSubmit, onCancel }: { label: string; initial?: string; submitLabel: string; onSubmit: (body: string) => void; onCancel?: () => void }) {
  const [body, setBody] = useState(initial)
  const submit = () => {
    if (!body.trim()) return
    onSubmit(body.trim())
    setBody('')
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault()
      onCancel()
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submit()
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={2} aria-label={label} value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={onKeyDown} autoFocus={Boolean(onCancel)} placeholder={label} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

const count = (list: CommentThreadComment[] = []): number => list.reduce((sum, item) => sum + 1 + count(item.replies), 0)

/**
 * Discussion attached to something — a document, a design, a line of code.
 *
 * Nesting is capped, three levels by default. Unlimited threading reads well for
 * the first two replies and then becomes a staircase too narrow to read on a
 * laptop, let alone a phone. Past the cap, Reply answers the parent and starts
 * with an @mention, which keeps who-is-talking-to-whom without another indent.
 *
 * Editing and deleting appear only on the current person’s comments, and delete
 * asks once, inline, rather than in a modal: it is a small, local decision and a
 * dialog would take the reader out of the conversation to make it. Resolving
 * keeps the thread readable but removes every composer, so a settled discussion
 * is not quietly reopened by a stray reply.
 */
export function CommentThread({
  comments,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onReact,
  reactionChoices = ['👍', '🎉', '👀'],
  maxDepth = 3,
  resolved = false,
  onResolvedChange,
  className,
}: CommentThreadProps) {
  const baseId = useId()
  const [replying, setReplying] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapsed = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderComment = (comment: CommentThreadComment, depth: number, parentId: string | null) => {
    const own = comment.author.id === currentUserId
    const replies = comment.replies ?? []
    const hidden = collapsed.has(comment.id)
    const repliesId = `${baseId}-replies-${comment.id}`
    const replyTarget = depth < maxDepth - 1 ? comment.id : parentId
    const reactions = reactionChoices.map((emoji) => comment.reactions?.find((item) => item.emoji === emoji) ?? { emoji, count: 0, reacted: false })

    return (
      <li key={comment.id} className="flex flex-col gap-3">
        <article aria-label={`Comment by ${comment.author.name}`} className="flex gap-2.5">
          <Avatar name={comment.author.name} src={comment.author.avatarSrc} size="xs" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Text as="p" size="caption" tone="faint" className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[12px] font-bold text-ink">{comment.author.name}</span>
              <RelativeTime date={comment.createdAt} unitStyle="short" />
              {comment.editedAt && <span>(edited)</span>}
            </Text>

            {editing === comment.id ? (
              <InlineComposer
                label="Edit comment"
                initial={comment.body}
                submitLabel="Save"
                onSubmit={(body) => {
                  onEdit?.(comment.id, body)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <Text as="p" size="body" weight="medium" leading="normal" className="whitespace-pre-wrap break-words">
                {comment.body}
              </Text>
            )}

            <div className="-ml-2 flex flex-wrap items-center gap-0.5">
              {onReact &&
                reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    aria-pressed={reaction.reacted}
                    aria-label={`React with ${reaction.emoji}${reaction.count ? `, ${reaction.count}` : ''}`}
                    onClick={() => onReact(comment.id, reaction.emoji)}
                    disabled={resolved}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-semibold tabular-nums transition-colors disabled:opacity-60',
                      reaction.reacted ? 'bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] text-ink' : 'text-ink-soft hover:bg-surface-muted',
                      !reaction.count && !reaction.reacted && 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    {reaction.count > 0 && <span aria-hidden="true">{reaction.count}</span>}
                  </button>
                ))}
              {!resolved && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplying(replying === comment.id ? null : comment.id)} aria-expanded={replying === comment.id}>
                  Reply
                </Button>
              )}
              {own && !resolved && onEdit && editing !== comment.id && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(comment.id)}>
                  Edit
                </Button>
              )}
              {own && onDelete &&
                (confirming === comment.id ? (
                  <span className="inline-flex items-center gap-1 pl-2 text-[12px] font-semibold text-ink-soft">
                    Delete this comment?
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-danger" onClick={() => onDelete(comment.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConfirming(null)} autoFocus>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConfirming(comment.id)}>
                    Delete
                  </Button>
                ))}
            </div>

            {replying === comment.id && !resolved && (
              <InlineComposer
                key={`${comment.id}-${replyTarget === comment.id ? '' : 'mention'}`}
                label={`Reply to ${comment.author.name}`}
                initial={replyTarget === comment.id ? '' : `@${comment.author.name} `}
                submitLabel="Reply"
                onSubmit={(body) => {
                  onReply(replyTarget, body)
                  setReplying(null)
                }}
                onCancel={() => setReplying(null)}
              />
            )}

            {replies.length > 0 && (
              <button
                type="button"
                aria-expanded={!hidden}
                aria-controls={repliesId}
                onClick={() => toggleCollapsed(comment.id)}
                className="self-start text-[12px] font-bold text-ink-soft hover:text-ink"
              >
                {hidden ? `Show ${count(replies)} ${count(replies) === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
              </button>
            )}
          </div>
        </article>

        {replies.length > 0 && (
          <ul id={repliesId} hidden={hidden} className="ml-3.5 flex flex-col gap-4 border-l border-line pl-5">
            {replies.map((reply) => renderComment(reply, depth + 1, comment.id))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <section aria-label="Comments" className={cn('flex flex-col gap-4', resolved && 'opacity-80', className)}>
      <header className="flex items-center justify-between gap-3">
        <Text as="h3" size="heading" className="flex items-center gap-2">
          {count(comments)} {count(comments) === 1 ? 'comment' : 'comments'}
          {resolved && (
            <Badge tone="neutral" className="gap-1">
              <CheckIcon size={10} />
              Resolved
            </Badge>
          )}
        </Text>
        {onResolvedChange && (
          <Button size="sm" variant={resolved ? 'outline' : 'muted'} onClick={() => onResolvedChange(!resolved)}>
            {resolved ? 'Reopen' : 'Resolve'}
          </Button>
        )}
      </header>

      <ul className="flex flex-col gap-5">{comments.map((comment) => renderComment(comment, 0, null))}</ul>

      {!resolved && <InlineComposer label="Add a comment" submitLabel="Comment" onSubmit={(body) => onReply(null, body)} />}
    </section>
  )
}
