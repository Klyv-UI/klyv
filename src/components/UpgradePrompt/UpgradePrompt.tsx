'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Badge } from '../Badge'
import { IconTile } from '../IconTile'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { CheckIcon, CrossIcon, LockIcon } from '../internal/icons'
import { daysUntil, plural } from '../../lib/format'

export type UpgradePromptVariant = 'card' | 'banner' | 'inline'

export interface UpgradePromptProps {
  /** card is a panel; banner spans the top of a page; inline sits where a locked feature would be. */
  variant?: UpgradePromptVariant
  title: string
  description?: ReactNode
  /** What the upgrade unlocks. card only. */
  benefits?: string[]
  /** The plan being offered — "Pro". */
  plan?: string
  icon?: IconComponent
  /** Usually an accent Button — "Upgrade to Pro". */
  action?: ReactNode
  secondaryAction?: ReactNode
  /** A running trial. The days left are worked out and shown. */
  trialEndsAt?: Date
  onDismiss?: () => void
  now?: Date
  className?: string
}

/**
 * An upsell that says what is being unlocked, in the place it is needed.
 *
 * Three placements, because an upgrade is asked for in three situations: a
 * persistent reminder across the top of the app (banner), a panel on a billing
 * or overview screen (card), and in the spot a gated feature would occupy
 * (inline) — where it is most useful and least intrusive.
 *
 * The trial countdown is derived from a date rather than passed as text, so a
 * banner cached this morning does not still say "3 days left" tomorrow.
 * Dismissible variants must be; nagging that cannot be closed is the fastest
 * way to make an upgrade prompt invisible.
 */
export function UpgradePrompt({
  variant = 'card',
  title,
  description,
  benefits = [],
  plan,
  icon,
  action,
  secondaryAction,
  trialEndsAt,
  onDismiss,
  now,
  className,
}: UpgradePromptProps) {
  const left = trialEndsAt ? Math.max(0, daysUntil(trialEndsAt, (now ?? new Date()).getTime())) : undefined
  const trialLabel =
    left === undefined ? undefined : left === 0 ? 'Trial ends today' : `${plural(left, 'day')} left in trial`

  const dismiss = onDismiss && (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        variant === 'banner' ? 'text-accent-ink/70 hover:bg-accent-strong hover:text-accent-ink' : 'text-ink-faint hover:bg-surface-muted hover:text-ink',
      )}
    >
      <CrossIcon size={13} />
    </button>
  )

  if (variant === 'banner') {
    return (
      <aside
        aria-label={title}
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-tile)] bg-accent px-4 py-2.5 text-accent-ink',
          className,
        )}
      >
        {trialLabel && (
          <span className="rounded-full bg-accent-ink/10 px-2 py-[3px] text-[10px] font-bold leading-none">
            {trialLabel}
          </span>
        )}
        <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug">
          <strong className="font-bold">{title}</strong>
          {description && <span className="text-accent-ink/75"> {description}</span>}
        </p>
        <div className="flex items-center gap-2">
          {action}
          {dismiss}
        </div>
      </aside>
    )
  }

  if (variant === 'inline') {
    return (
      <aside
        aria-label={title}
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-[var(--radius-tile)] border border-dashed border-line-strong bg-surface-sunken p-3.5',
          className,
        )}
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft shadow-[var(--shadow-tile)]">
          <LockIcon size={14} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text size="label" weight="bold">
              {title}
            </Text>
            {plan && <Badge>{plan}</Badge>}
          </div>
          {description && (
            <Text size="caption" tone="soft" leading="normal">
              {description}
            </Text>
          )}
        </div>
        {action}
      </aside>
    )
  }

  return (
    <Surface
      as="aside"
      aria-label={title}
      variant="card"
      padding="lg"
      className={cn('relative isolate gap-4 overflow-hidden', className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-28 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-accent)_32%,transparent),transparent)]"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && <IconTile icon={icon} tone="accent" />}
          <div className="flex flex-wrap items-center gap-2">
            {plan && <Badge>{plan}</Badge>}
            {trialLabel && <Badge tone="neutral">{trialLabel}</Badge>}
          </div>
        </div>
        {dismiss}
      </div>

      <div className="flex flex-col gap-1.5">
        <Text size="subtitle">{title}</Text>
        {description && (
          <Text size="body" weight="medium" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>

      {benefits.length > 0 && (
        <ul className="flex flex-col gap-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <CheckIcon size={13} strokeWidth={3} className="shrink-0 text-success" />
              <Text as="span" size="label" weight="semibold">
                {benefit}
              </Text>
            </li>
          ))}
        </ul>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </Surface>
  )
}
