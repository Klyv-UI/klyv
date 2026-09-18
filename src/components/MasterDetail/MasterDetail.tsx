'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { Button } from '../Button'
import { ChevronLeftIcon } from '../internal/icons'

export interface MasterDetailItemState {
  /** This item is the one shown in the detail pane. */
  selected: boolean
}

export interface MasterDetailProps<T> {
  /** The records in the list pane. */
  items: T[]
  /** Stable id for an item. */
  itemId: (item: T) => string
  /** The item’s name — the detail pane’s heading, and the back button’s context. */
  itemLabel: (item: T) => string
  /** Content of one row. The row is already a button; do not put controls inside it. */
  renderItem: (item: T, state: MasterDetailItemState) => ReactNode
  /** The detail pane’s body, under the heading. */
  renderDetail: (item: T) => ReactNode
  /** Controlled selected id. Null for nothing selected. */
  value?: string | null
  /** Starting selection when uncontrolled. */
  defaultValue?: string | null
  /** Called with the id of the item the reader opens. */
  onValueChange?: (id: string) => void
  /** Accessible name for the list. */
  label: string
  /** Container width in pixels from which the panes sit side by side. Below it, one pane shows at a time. */
  splitAt?: number
  /** Shown in the detail pane while nothing is selected, side by side only. */
  emptyDetail?: ReactNode
  /** Label of the back button on narrow layouts. */
  backLabel?: string
  /** Heading level of the detail title. */
  headingLevel?: 2 | 3 | 4
  /** Width of the list pane when side by side, as a CSS length. */
  listWidth?: string
  /** Merged onto the wrapper. */
  className?: string
}

/**
 * A list and the record it opens, side by side when there is room and one
 * at a time when there is not.
 *
 * The switch follows the component’s own width, measured with a
 * ResizeObserver, not the viewport’s: the same inbox sits in a full page, a
 * drawer and a split view, and only its own width says which layout fits.
 *
 * On a narrow layout, opening an item hides the list, and the button the
 * reader pressed goes with it — so focus moves to the detail heading, which
 * is what a screen reader should read next. Back returns focus to the row
 * they came from, not the top of the list, so working through an inbox does
 * not mean tabbing past every message already read. Side by side, focus stays
 * in the list and the reader moves across when they choose.
 */
export function MasterDetail<T>({
  items,
  itemId,
  itemLabel,
  renderItem,
  renderDetail,
  value,
  defaultValue = null,
  onValueChange,
  label,
  splitAt = 640,
  emptyDetail = 'Select an item to see it here.',
  backLabel = 'Back',
  headingLevel = 2,
  listWidth = '18rem',
  className,
}: MasterDetailProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const [inner, setInner] = useState(defaultValue)
  const selectedId = value === undefined ? inner : value
  const selected = items.find((item) => itemId(item) === selectedId)
  const [wide, setWide] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  /** Where focus goes after the next render: the heading, or a row id. */
  const pendingFocus = useRef<'heading' | string | null>(null)

  useIsomorphicLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return
    const measure = () => setWide(node.getBoundingClientRect().width >= splitAt)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [splitAt])

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    if (target === 'heading') headingRef.current?.focus()
    else rowRefs.current.get(target)?.focus()
  })

  const open = (id: string) => {
    if (value === undefined) setInner(id)
    onValueChange?.(id)
    setShowDetail(true)
    if (!wide) pendingFocus.current = 'heading'
  }

  const back = () => {
    setShowDetail(false)
    if (selectedId) pendingFocus.current = selectedId
  }

  const narrowDetail = !wide && showDetail && Boolean(selected)
  const Heading = `h${headingLevel}` as 'h2'

  return (
    <div ref={rootRef} className={cn('flex min-h-0 w-full min-w-0', className)}>
      <div
        hidden={narrowDetail}
        className={cn('min-w-0 overflow-y-auto', wide ? 'shrink-0 border-r border-line' : 'flex-1')}
        style={wide ? { width: listWidth } : undefined}
      >
        <ul aria-label={label} className="flex flex-col gap-0.5 p-1.5">
          {items.map((item) => {
            const id = itemId(item)
            const isSelected = id === selectedId
            return (
              <li key={id}>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) rowRefs.current.set(id, node)
                    else rowRefs.current.delete(id)
                  }}
                  aria-current={isSelected || undefined}
                  onClick={() => open(id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[var(--radius-glyph)] px-3 py-2.5 text-left transition-colors',
                    'focus-visible:outline-offset-[-2px]',
                    isSelected
                      ? 'bg-[color-mix(in_oklab,var(--color-accent)_22%,var(--color-surface))] text-ink'
                      : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                  )}
                >
                  {renderItem(item, { selected: isSelected })}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div hidden={!wide && !narrowDetail} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {selected ? (
          <div className="flex flex-col gap-3 p-5">
            {!wide && (
              <Button variant="ghost" size="sm" onClick={back} className="-ml-2 self-start pl-2">
                <ChevronLeftIcon size={14} />
                {backLabel}
              </Button>
            )}
            <Heading
              ref={headingRef}
              tabIndex={-1}
              className="rounded-[6px] text-[18px] font-extrabold tracking-[-0.02em] text-ink outline-none focus-visible:outline-2"
            >
              {itemLabel(selected)}
            </Heading>
            {renderDetail(selected)}
          </div>
        ) : (
          wide && <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] font-medium text-ink-faint">{emptyDetail}</div>
        )}
      </div>
    </div>
  )
}
