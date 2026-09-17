'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { usePrefersReducedMotion } from '../../lib/motion'

export type AnimatedListAnimation = 'fade' | 'slide-up' | 'slide-right' | 'scale'

const HIDDEN: Record<AnimatedListAnimation, string> = {
  fade: 'opacity-0',
  'slide-up': 'opacity-0 translate-y-2',
  'slide-right': 'opacity-0 -translate-x-3',
  scale: 'opacity-0 scale-95',
}

type Phase = 'enter' | 'present' | 'exit'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

interface Entry<T> {
  key: string
  item: T
  phase: Phase
}

export interface AnimatedListProps<T> {
  /** The items as they are now. Add and remove freely; the list animates the difference. */
  items: T[]
  /** A stable identity per item — an id, never the index. */
  getKey: (item: T) => string
  /** Renders one item's content. It is wrapped in the list item for you. */
  renderItem: (item: T) => ReactNode
  /** How items arrive and leave. */
  animation?: AnimatedListAnimation
  /** Length of each transition, in ms. */
  duration?: number
  /** Animate the items present on first render as well. */
  animateInitial?: boolean
  /** `ul`, `ol`, or a plain `div` with `div` rows. */
  as?: 'ul' | 'ol' | 'div'
  /** Accessible name for the list. */
  'aria-label'?: string
  /** Merged onto the list element. */
  className?: string
  /** Merged onto every row. */
  itemClassName?: string
}

/** Merge the previous rows with the new items, keeping leaving rows where they were. */
function reconcile<T>(previous: Entry<T>[], items: T[], getKey: (item: T) => string): Entry<T>[] {
  const nextKeys = new Set(items.map(getKey))
  const previousKeys = new Set(previous.map((entry) => entry.key))
  const result: Entry<T>[] = []
  let cursor = 0

  for (const item of items) {
    const key = getKey(item)
    // Carry leaving rows that sat before this item across, in place.
    while (cursor < previous.length && !nextKeys.has(previous[cursor].key)) {
      result.push({ ...previous[cursor], phase: 'exit' })
      cursor += 1
    }
    if (cursor < previous.length && previous[cursor].key === key) cursor += 1
    const before = previous.find((entry) => entry.key === key)
    result.push({ key, item, phase: previousKeys.has(key) && before?.phase !== 'exit' ? before!.phase : 'enter' })
  }
  for (; cursor < previous.length; cursor += 1) {
    if (!nextKeys.has(previous[cursor].key)) result.push({ ...previous[cursor], phase: 'exit' })
  }
  return result
}

/**
 * A list that animates what changed, and only that.
 *
 * Rendering `items.map` removes a row the instant it leaves the array, so no
 * exit can run and the rows below jump up. This keeps a removed row mounted
 * while it fades and folds its height to zero, then drops it — the neighbours
 * close the gap smoothly. A new row starts collapsed and hidden and opens into
 * place. Rows are matched by `getKey`, never by position, so removing the
 * third item animates the third item and not the last.
 *
 * A leaving row is hidden from assistive technology straight away, and if it
 * held focus, focus moves to the row that takes its place. Under reduced
 * motion rows appear and disappear at once.
 */
export function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  animation = 'slide-up',
  duration = 220,
  animateInitial = false,
  as = 'ul',
  'aria-label': ariaLabel,
  className,
  itemClassName,
}: AnimatedListProps<T>) {
  const reduced = usePrefersReducedMotion()
  const [entries, setEntries] = useState<Entry<T>[]>(() =>
    items.map((item) => ({ key: getKey(item), item, phase: animateInitial ? 'enter' : 'present' })),
  )
  const listRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  const time = reduced ? 0 : duration

  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useIsomorphicLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const next = reconcile(entriesRef.current, items, getKey)
    setEntries(next)

    // Focus inside a leaving row would be stranded on a node hidden from
    // assistive technology. Hand it to the row that takes its place.
    const list = listRef.current
    const active = document.activeElement
    const row = active && list?.contains(active) ? active.closest<HTMLElement>('[data-animated-row]') : null
    const index = row ? next.findIndex((entry) => entry.key === row.dataset.animatedRow) : -1
    if (!list || index < 0 || next[index].phase !== 'exit') return
    const heir =
      next.slice(index + 1).find((entry) => entry.phase !== 'exit') ??
      next.slice(0, index).reverse().find((entry) => entry.phase !== 'exit')
    queueMicrotask(() => {
      const rows = [...list.querySelectorAll<HTMLElement>('[data-animated-row]')]
      const target = heir && rows.find((node) => node.dataset.animatedRow === heir.key)
      ;(target?.querySelector<HTMLElement>(FOCUSABLE) ?? list).focus()
    })
  }, [items])

  const entering = entries
    .filter((entry) => entry.phase === 'enter')
    .map((entry) => entry.key)
    .join('|')
  const exiting = entries
    .filter((entry) => entry.phase === 'exit')
    .map((entry) => entry.key)
    .join('|')

  // Two frames: one to paint the hidden starting state, one to transition from it.
  useEffect(() => {
    if (!entering) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() =>
        setEntries((current) => current.map((entry) => (entry.phase === 'enter' ? { ...entry, phase: 'present' } : entry))),
      )
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [entering])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => setEntries((current) => current.filter((entry) => entry.phase !== 'exit')), time)
    return () => clearTimeout(timer)
  }, [exiting, time])

  const List = as
  const Row = as === 'div' ? 'div' : 'li'

  return (
    <List ref={listRef as never} aria-label={ariaLabel} tabIndex={-1} className={cn('flex flex-col outline-none', className)}>
      {entries.map((entry) => {
        const shown = entry.phase === 'present'
        return (
          <Row
            key={entry.key}
            data-animated-row={entry.key}
            aria-hidden={entry.phase === 'exit' || undefined}
            className={cn(
              'grid ease-out',
              time > 0 && 'transition-[grid-template-rows,opacity,translate,scale]',
              shown ? 'grid-rows-[1fr] opacity-100' : cn('grid-rows-[0fr]', HIDDEN[animation]),
              entry.phase === 'exit' && 'pointer-events-none',
            )}
            style={time > 0 ? { transitionDuration: `${time}ms` } : undefined}
          >
            <div className={cn('min-h-0', !shown && 'overflow-hidden', itemClassName)}>{renderItem(entry.item)}</div>
          </Row>
        )
      })}
    </List>
  )
}
