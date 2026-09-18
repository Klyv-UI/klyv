'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ChevronDownIcon, ChevronUpIcon } from '../internal/icons'

export interface ShowMoreListProps<T> {
  /** Every item. Only the first `initialCount` render until the list is expanded. */
  items: T[]
  /** Stable key for an item. */
  itemKey: (item: T) => string
  /** Content of one list item. */
  renderItem: (item: T, index: number) => ReactNode
  /** How many show while collapsed. */
  initialCount?: number
  /** Controlled expanded state. */
  expanded?: boolean
  /** Starting expanded state when uncontrolled. */
  defaultExpanded?: boolean
  /** Called when the reader shows all or shows fewer. */
  onExpandedChange?: (expanded: boolean) => void
  /** Accessible name for the list. */
  label?: string
  /** Numbered list instead of bulleted semantics. */
  ordered?: boolean
  /** Label of the expand button, given the total. */
  showAllLabel?: (total: number) => string
  /** Label of the collapse button. */
  showFewerLabel?: string
  /** Merged onto the list element. */
  listClassName?: string
  /** Merged onto the wrapper. */
  className?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The first few items of a long list, and a button that reveals the rest.
 *
 * The button names the total — “Show all 24” — so the reader can decide
 * whether it is worth it before pressing. It carries `aria-expanded` and
 * points at the list with `aria-controls`.
 *
 * Revealing items below the button’s own position is the easy part to get
 * wrong: focus stays on the button, which now sits after twenty new items,
 * and a keyboard reader has to walk backwards to find them. So focus moves
 * to the first newly revealed item — its own link or button if it has one,
 * otherwise the item itself — which is also where a screen reader should
 * start reading. Collapsing leaves focus on the button, which stays put.
 *
 * Hidden items are not rendered rather than hidden with CSS, so they are
 * out of the tab order and out of find-in-page alike.
 */
export function ShowMoreList<T>({
  items,
  itemKey,
  renderItem,
  initialCount = 5,
  expanded: controlled,
  defaultExpanded = false,
  onExpandedChange,
  label,
  ordered = false,
  showAllLabel = (total) => `Show all ${total}`,
  showFewerLabel = 'Show fewer',
  listClassName,
  className,
}: ShowMoreListProps<T>) {
  const [inner, setInner] = useState(defaultExpanded)
  const expanded = controlled ?? inner
  const listId = useId()
  const listRef = useRef<HTMLUListElement & HTMLOListElement>(null)
  const focusFirstRevealed = useRef(false)

  const collapsible = items.length > initialCount
  const visible = expanded || !collapsible ? items : items.slice(0, initialCount)

  useEffect(() => {
    if (!focusFirstRevealed.current || !expanded) return
    focusFirstRevealed.current = false
    const item = listRef.current?.children[initialCount] as HTMLElement | undefined
    if (!item) return
    ;(item.querySelector<HTMLElement>(FOCUSABLE) ?? item).focus()
  }, [expanded, initialCount])

  const toggle = () => {
    const next = !expanded
    focusFirstRevealed.current = next
    if (controlled === undefined) setInner(next)
    onExpandedChange?.(next)
  }

  const List = ordered ? 'ol' : 'ul'

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <List ref={listRef} id={listId} aria-label={label} className={cn('flex w-full flex-col', listClassName)}>
        {visible.map((item, index) => (
          <li
            key={itemKey(item)}
            // Only revealed items take programmatic focus; nothing here enters the tab order.
            tabIndex={index >= initialCount ? -1 : undefined}
            className="rounded-[var(--radius-glyph)] outline-offset-[-2px]"
          >
            {renderItem(item, index)}
          </li>
        ))}
      </List>
      {collapsible && (
        <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={listId} onClick={toggle} className="-ml-1">
          {expanded ? showFewerLabel : showAllLabel(items.length)}
          {expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </Button>
      )}
    </div>
  )
}
