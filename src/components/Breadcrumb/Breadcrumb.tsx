'use client'

import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { ChevronRightIcon } from '../internal/icons'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** Collapse the middle when there are more than this many. */
  maxItems?: number
  /** Accessible name for the trail. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const ELLIPSIS: BreadcrumbItem = { label: '...' }

/**
 * The path back up to the root. The last item is the current page: it is not a
 * link, and carries aria-current so it is announced as the destination rather
 * than as one more step.
 *
 * Long trails collapse in the middle, since the first and last items are the
 * two that actually orient the reader.
 */
export function Breadcrumb({ items, maxItems = 4, label = 'Breadcrumb', className }: BreadcrumbProps) {
  const shown =
    items.length > maxItems
      ? [items[0], ELLIPSIS, ...items.slice(items.length - (maxItems - 2))]
      : items

  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ol className="flex list-none flex-wrap items-center gap-1.5">
        {shown.map((item, index) => {
          const last = index === shown.length - 1
          const isEllipsis = item === ELLIPSIS
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="flex min-w-0 items-center">
                {last ? (
                  <Text as="span" size="caption" weight="bold" aria-current="page" truncate>
                    {item.label}
                  </Text>
                ) : isEllipsis ? (
                  <Text as="span" size="caption" weight="medium" tone="faint">
                    {item.label}
                  </Text>
                ) : item.href ? (
                  <a href={item.href} onClick={item.onClick} className="truncate rounded-[6px] text-[11px] font-medium text-ink-soft transition-colors hover:text-ink">
                    {item.label}
                  </a>
                ) : item.onClick ? (
                  // Without an href a link is not focusable, so an action-only crumb is a button.
                  <button type="button" onClick={item.onClick} className="truncate rounded-[6px] text-[11px] font-medium text-ink-soft transition-colors hover:text-ink">
                    {item.label}
                  </button>
                ) : (
                  <Text as="span" size="caption" weight="medium" tone="soft" truncate>
                    {item.label}
                  </Text>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="flex items-center text-ink-faint">
                  <ChevronRightIcon size={12} />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
