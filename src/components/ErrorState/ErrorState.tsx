import type { ReactNode } from 'react'
import { EmptyState, type EmptyStateSize } from '../EmptyState'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'
import { AlertIcon } from '../internal/icons'

export interface ErrorStateProps {
  /** What went wrong. */
  title?: string
  /** What to do about it. */
  description?: ReactNode
  /** Glyph above the title. */
  icon?: IconComponent
  /** Retry affordance — usually a Button. */
  action?: ReactNode
  /** Technical detail, shown small and monospaced under the copy. */
  detail?: string
  /** Compact for a card, roomy for a page. */
  size?: EmptyStateSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * EmptyState for a failure rather than an absence. It is announced as an alert
 * and always offers a way forward, because a dead end with no retry is the one
 * error state a user cannot act on.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'The data could not be loaded. Try again, or come back in a moment.',
  icon = AlertIcon,
  action,
  detail,
  size = 'md',
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={className}>
      <EmptyState
        icon={icon}
        title={title}
        size={size}
        description={
          <>
            {description}
            {detail && (
              <Text
                as="span"
                size="caption"
                tone="faint"
                className="mt-2 block font-mono"
              >
                {detail}
              </Text>
            )}
          </>
        }
        action={action}
      />
    </div>
  )
}
