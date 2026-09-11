import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { StatusDot, type StatusDotTone } from '../StatusDot'
import { Text } from '../Text'

export interface TimelineItem {
  id: string
  title: string
  /** Timestamp or short qualifier, shown above the title. */
  meta?: string
  description?: ReactNode
  tone?: StatusDotTone
}

export interface TimelineProps {
  items: TimelineItem[]
  /** Accessible name for the sequence. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * An ordered sequence of events. The connector is drawn between the markers
 * rather than through them, so a long description never breaks the line.
 */
export function Timeline({ items, label, className }: TimelineProps) {
  return (
    <ol aria-label={label} className={cn('flex list-none flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-5 items-center">
              <StatusDot tone={item.tone ?? 'neutral'} size="md" />
            </span>
            {index < items.length - 1 && <span className="w-px flex-1 bg-line-strong" />}
          </div>
          <div className={cn('min-w-0 flex-1', index < items.length - 1 && 'pb-4')}>
            {item.meta && (
              <Text size="caption" tone="faint">
                {item.meta}
              </Text>
            )}
            <Text>{item.title}</Text>
            {item.description && (
              <Text size="caption" tone="soft" leading="normal" className="mt-1">
                {item.description}
              </Text>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
