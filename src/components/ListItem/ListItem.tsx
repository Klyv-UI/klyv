'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface ListItemProps {
  /** Glyph or avatar. */
  leading?: ReactNode
  /** The first line. */
  title: string
  /** The second, quieter line. */
  subtitle?: string
  /** Bold right-hand value — an amount, a price. */
  value?: string
  /** Muted line under the value — a due date, a timestamp. */
  meta?: string
  /** Replaces the value column entirely — a control, a badge. */
  trailing?: ReactNode
  /** Tints the row, as the dashboard does for the subscription due next. */
  highlighted?: boolean
  /** Makes the whole row a button. Adds hover and keyboard access. */
  onClick?: () => void
  /** Colour override for the value, e.g. a positive amount. */
  valueTone?: 'default' | 'success' | 'danger'
  /**
   * Element to render. Defaults to `li`, since rows normally sit in a List.
   * Use `div` when the row is already inside an `li` supplied by the caller.
   */
  as?: 'li' | 'div'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The row behind Recent transactions and Subscriptions: glyph, name over
 * caption, then a right-aligned value over its own caption.
 */
export function ListItem({
  leading,
  title,
  subtitle,
  value,
  meta,
  trailing,
  highlighted = false,
  onClick,
  valueTone = 'default',
  as: Wrapper = 'li',
  className,
}: ListItemProps) {
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1 text-left">
        <Text truncate>{title}</Text>
        {subtitle && (
          <Text size="caption" tone="faint" truncate>
            {subtitle}
          </Text>
        )}
      </span>
      {trailing ??
        (value && (
          <span className="shrink-0 text-right">
            <Text tabular tone={valueTone === 'default' ? 'default' : valueTone}>
              {value}
            </Text>
            {meta && (
              <Text size="caption" tone="faint">
                {meta}
              </Text>
            )}
          </span>
        ))}
    </>
  )

  const classes = cn(
    'flex w-full items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2.5 transition-colors',
    highlighted ? 'bg-surface-muted' : onClick && 'hover:bg-surface-sunken',
    className,
  )

  if (onClick) {
    return (
      <Wrapper>
        <button type="button" onClick={onClick} className={classes}>
          {content}
        </button>
      </Wrapper>
    )
  }

  return <Wrapper className={classes}>{content}</Wrapper>
}
