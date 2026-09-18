'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

export interface AnchorNavItem {
  /** Element id to scroll to, without the hash. */
  id: string
  label: string
}

export interface AnchorNavProps {
  items: AnchorNavItem[]
  /** Accessible name for the list. */
  label?: string
  /** Offset from the top when deciding which section is current, in pixels. */
  offset?: number
  orientation?: 'vertical' | 'horizontal'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * In-page navigation with scroll spy. The active item is derived from what is
 * actually on screen rather than from the last click, so it stays correct when
 * the reader scrolls by hand.
 *
 * Clicking scrolls smoothly and then moves focus to the section, so a keyboard
 * user is not left at the top of the document after jumping.
 */
export function AnchorNav({
  items,
  label = 'On this page',
  offset = 96,
  orientation = 'vertical',
  className,
}: AnchorNavProps) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const onScroll = () => {
      let current = items[0]?.id
      for (const item of items) {
        const element = document.getElementById(item.id)
        if (element && element.getBoundingClientRect().top - offset <= 0) current = item.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [items, offset])

  const go = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    element.setAttribute('tabindex', '-1')
    element.focus({ preventScroll: true })
  }

  return (
    <nav aria-label={label} className={className}>
      <ul
        className={cn(
          'flex list-none gap-1',
          orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center',
        )}
      >
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  go(item.id)
                }}
                className={cn(
                  'block rounded-[var(--radius-8)] px-2.5 py-1.5 text-[12px] transition-colors',
                  orientation === 'vertical' && 'border-l-2 pl-3',
                  current
                    ? cn('font-bold text-ink', orientation === 'vertical' ? 'border-l-accent-strong' : 'bg-surface-muted')
                    : cn(
                        'font-medium text-ink-faint hover:text-ink',
                        orientation === 'vertical' && 'border-l-line',
                      ),
                )}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
