import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface DescriptionItem {
  term: string
  description: ReactNode
}

export interface DescriptionListProps {
  items: DescriptionItem[]
  /** row puts term and value on one line; stack puts the value underneath. */
  layout?: 'row' | 'stack'
  divided?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Term and value pairs, as a real definition list. row is the account-detail
 * shape from the balance card; stack is for longer values that would wrap.
 */
export function DescriptionList({
  items,
  layout = 'row',
  divided = false,
  className,
}: DescriptionListProps) {
  return (
    <dl className={cn('flex flex-col', divided ? 'divide-y divide-line' : 'gap-3', className)}>
      {items.map((item) => (
        <div
          key={item.term}
          className={cn(
            layout === 'row' ? 'flex items-baseline justify-between gap-4' : 'flex flex-col gap-0.5',
            divided && 'py-2.5 first:pt-0 last:pb-0',
          )}
        >
          <dt>
            <Text as="span" size="caption" tone="faint">
              {item.term}
            </Text>
          </dt>
          <dd className="m-0 min-w-0">
            <Text as="span" tabular truncate>
              {item.description}
            </Text>
          </dd>
        </div>
      ))}
    </dl>
  )
}
