'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'
import { CrossIcon } from '../internal/icons'

export type AlertTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, { surface: string; mark: string }> = {
  neutral: { surface: 'border-line bg-surface-sunken', mark: 'bg-ink-faint' },
  accent: { surface: 'border-accent-soft bg-accent-soft/50', mark: 'bg-accent-strong' },
  success: { surface: 'border-line bg-surface-sunken', mark: 'bg-success' },
  warning: { surface: 'border-line bg-surface-sunken', mark: 'bg-warning' },
  danger: { surface: 'border-line bg-surface-sunken', mark: 'bg-danger' },
}

/** Danger and warning are assertive; the rest are polite. */
const LIVE: Record<AlertTone, 'polite' | 'assertive'> = {
  neutral: 'polite',
  accent: 'polite',
  success: 'polite',
  warning: 'assertive',
  danger: 'assertive',
}

export interface AlertProps {
  tone?: AlertTone
  /** Heading for the message. */
  title?: string
  /** The message body. */
  children?: ReactNode
  /** Glyph shown before the text. */
  icon?: IconComponent
  /** Right-aligned affordance — usually a Button. */
  action?: ReactNode
  /** Adds a dismiss control. */
  onDismiss?: () => void
  /** Announce when it appears. Leave off for content present on load. */
  live?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A persistent message block. The tone is carried by a coloured rail rather
 * than by a full colour wash, so an alert sits inside a card without competing
 * with it — and so tone is never the only signal.
 */
export function Alert({
  tone = 'neutral',
  title,
  children,
  icon: Icon,
  action,
  onDismiss,
  live = false,
  className,
}: AlertProps) {
  const styles = TONES[tone]

  return (
    <div
      role={live ? 'alert' : undefined}
      aria-live={live ? LIVE[tone] : undefined}
      className={cn(
        'relative flex items-start gap-3 overflow-hidden rounded-[var(--radius-tile)] border p-3.5 pl-4',
        styles.surface,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', styles.mark)} />
      {Icon && (
        <span className="mt-0.5 shrink-0 text-ink-soft">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <Text size="body">{title}</Text>}
        {children && (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className={title ? 'mt-0.5' : undefined}>
            {children}
          </Text>
        )}
      </div>
      {action}
      {onDismiss && (
        <IconButton
          icon={CrossIcon}
          label="Dismiss"
          size="xs"
          onClick={onDismiss}
          className="-mr-1 -mt-1 shrink-0"
        />
      )}
    </div>
  )
}
