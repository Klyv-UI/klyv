import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconTile } from '../IconTile'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export type EmptyStateSize = 'sm' | 'md'

export interface EmptyStateProps {
  /** Glyph above the title. */
  icon?: IconComponent
  /** What is missing. */
  title: string
  /** What to do about it. */
  description?: ReactNode
  /** Primary affordance — usually a Button. */
  action?: ReactNode
  /** Quieter secondary affordance beside the action. */
  secondaryAction?: ReactNode
  size?: EmptyStateSize
  /** Merged last, so it wins. */
  className?: string
}

/**
 * What a region shows when it has nothing to show. The description should say
 * what will fill the space and how, not merely that it is empty.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        size === 'sm' ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      {icon && <IconTile icon={icon} size={size === 'sm' ? 'md' : 'lg'} className="mb-1" />}
      <Text size={size === 'sm' ? 'heading' : 'subtitle'}>{title}</Text>
      {description && (
        <Text
          size="caption"
          weight="medium"
          tone="faint"
          leading="normal"
          className="max-w-[42ch]"
        >
          {description}
        </Text>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
