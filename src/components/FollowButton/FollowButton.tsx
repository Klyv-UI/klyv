'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon, PlusIcon } from '../internal/icons'
import { Spinner } from '../Spinner'

export type FollowButtonSize = 'sm' | 'md'

export interface FollowButtonProps {
  /** Whether the reader follows, when controlled. */
  following?: boolean
  /** Starting state when uncontrolled. */
  defaultFollowing?: boolean
  /** Save the change. The button shows as pending until the promise settles; a rejection leaves the state as it was. */
  onFollowingChange?: (following: boolean) => void | Promise<void>
  /** Called with the reason when saving fails. */
  onError?: (reason: unknown) => void
  /** Who or what is followed — "Ada Lovelace". Becomes part of the accessible name: "Follow Ada Lovelace". */
  name?: string
  /** Follower count to show beside the button. Omit to hide it. Should already include the reader. */
  followerCount?: number
  /** The noun for the count. */
  countNoun?: string
  size?: FollowButtonSize
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Follow, Following, and an Unfollow that only shows when it is about to happen.
 *
 * Showing "Following" is the state; showing "Unfollow" is the action. The
 * button shows the state at rest and the action on hover or keyboard focus,
 * reddened, so nobody unfollows a colleague by clicking a word that told them
 * they already followed. Straight after following, with the pointer still on
 * the button, it keeps saying Following until the pointer leaves — otherwise
 * the very click that followed would be greeted by an offer to undo it.
 *
 * To assistive tech none of that flicker exists: the name stays "Follow Ada
 * Lovelace" and `aria-pressed` carries the state, since a name that changes
 * with the state is announced as a contradiction. Both labels occupy the same
 * grid cell, so the button never changes width under the pointer. The change
 * waits on `onFollowingChange` with a spinner, because follows are cheap to
 * retry and a follower count that jumps back is confusing.
 */
export function FollowButton({
  following: controlled,
  defaultFollowing = false,
  onFollowingChange,
  onError,
  name,
  followerCount,
  countNoun = 'followers',
  size = 'md',
  disabled = false,
  className,
}: FollowButtonProps) {
  const [own, setOwn] = useState(defaultFollowing)
  const [pending, setPending] = useState(false)
  const [settled, setSettled] = useState(true)
  const [ownCount, setOwnCount] = useState<number | null>(null)
  const countId = useId()
  const following = controlled ?? own
  const count = followerCount === undefined ? undefined : (ownCount ?? followerCount)

  const toggle = async () => {
    if (pending || disabled) return
    const next = !following
    setPending(true)
    try {
      await onFollowingChange?.(next)
      if (controlled === undefined) {
        setOwn(next)
        if (followerCount !== undefined) setOwnCount(Math.max(0, (count ?? 0) + (next ? 1 : -1)))
      }
      if (next) setSettled(false)
    } catch (reason) {
      onError?.(reason)
    } finally {
      setPending(false)
    }
  }

  const revealUnfollow = following && settled && !pending
  const glyph = size === 'sm' ? 13 : 14

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <button
        type="button"
        aria-pressed={following}
        aria-label={name ? `Follow ${name}` : 'Follow'}
        aria-describedby={count === undefined ? undefined : countId}
        aria-busy={pending || undefined}
        disabled={disabled}
        onClick={() => void toggle()}
        onMouseLeave={() => setSettled(true)}
        onBlur={() => setSettled(true)}
        className={cn(
          'group inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none transition-colors disabled:pointer-events-none disabled:opacity-40',
          size === 'sm' ? 'h-8 px-3.5 text-[12px]' : 'h-10 px-5 text-[13px]',
          following
            ? cn(
                'border border-line-strong bg-surface text-ink',
                revealUnfollow &&
                  'hover:border-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] hover:text-danger focus-visible:border-danger focus-visible:text-danger',
              )
            : 'border border-transparent bg-accent text-accent-ink hover:bg-accent-strong',
          pending && 'pointer-events-none',
        )}
      >
        <span aria-hidden="true" className="grid items-center">
          {[
            { key: 'follow', text: 'Follow', icon: <PlusIcon size={glyph} />, shown: !following },
            { key: 'following', text: 'Following', icon: <CheckIcon size={glyph} />, shown: following, hideOnReveal: revealUnfollow },
            { key: 'unfollow', text: 'Unfollow', icon: null, shown: false, showOnReveal: revealUnfollow },
          ].map((label) => (
            <span
              key={label.key}
              className={cn(
                'col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5',
                label.shown ? 'visible' : 'invisible',
                label.hideOnReveal && 'group-hover:invisible group-focus-visible:invisible',
                label.showOnReveal && 'group-hover:visible group-focus-visible:visible',
              )}
            >
              {pending && (label.shown || label.hideOnReveal) ? <Spinner size="sm" /> : label.icon}
              {label.text}
            </span>
          ))}
        </span>
      </button>
      {count !== undefined && (
        <span id={countId} className="text-[12px] font-semibold tabular-nums text-ink-soft">
          <span className="font-extrabold text-ink">{count.toLocaleString()}</span> {count === 1 ? countNoun.replace(/s$/, '') : countNoun}
        </span>
      )}
    </span>
  )
}
