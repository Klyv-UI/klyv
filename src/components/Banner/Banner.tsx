'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'
import { CrossIcon } from '../internal/icons'

export type BannerTone = 'accent' | 'neutral' | 'ink'

const TONES: Record<BannerTone, { surface: string; title: string; body: string }> = {
  // Solid, not /75: the accent's label is picked to clear 4.5:1 and no more, so
  // fading it is what puts it under. Weight separates body from title instead.
  accent: { surface: 'bg-accent', title: 'text-accent-ink', body: 'text-accent-ink' },
  neutral: { surface: 'bg-surface-muted', title: 'text-ink', body: 'text-ink-soft' },
  ink: { surface: 'bg-ink', title: 'text-ink-inverse', body: 'text-ink-inverse/70' },
}

export interface BannerProps {
  tone?: BannerTone
  /** Heading for the message. */
  title: string
  /** The message body. */
  children?: ReactNode
  /** Glyph before the message. */
  icon?: IconComponent
  /** Right-aligned affordance, usually a Button. */
  action?: ReactNode
  onDismiss?: () => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A full-width announcement across the top of a region. Distinct from Alert:
 * Alert reports the state of something on the page, a Banner announces
 * something about the product, and it fills its container edge to edge.
 */
export function Banner({
  tone = 'accent',
  title,
  children,
  icon: Icon,
  action,
  onDismiss,
  className,
}: BannerProps) {
  const styles = TONES[tone]

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-tile)] px-4 py-3',
        styles.surface,
        className,
      )}
    >
      {Icon && (
        <span className={cn('shrink-0', styles.title)}>
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Text size="body" className={styles.title}>
          {title}
        </Text>
        {children && (
          <Text size="caption" weight="medium" leading="normal" className={cn('mt-0.5', styles.body)}>
            {children}
          </Text>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <IconButton
          icon={CrossIcon}
          label="Dismiss announcement"
          size="sm"
          onClick={onDismiss}
          className={cn('-mr-1 shrink-0', styles.title)}
        />
      )}
    </div>
  )
}
