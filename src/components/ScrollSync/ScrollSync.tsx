'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ScrollSyncMode = 'proportional' | 'anchor'
export type ScrollSyncAxis = 'vertical' | 'horizontal' | 'both'

export interface ScrollSyncProps {
  /** The panes, anywhere below. Only `ScrollSyncPane`s take part. */
  children: ReactNode
  /**
   * `proportional` matches how far through each pane is. `anchor` lines up elements
   * that share a `data-sync-anchor` value and interpolates between them.
   */
  mode?: ScrollSyncMode
  /** Which scroll direction to keep in step. */
  axis?: ScrollSyncAxis
  /** Turn syncing off without unmounting anything. */
  enabled?: boolean
}

export interface ScrollSyncPaneProps {
  children: ReactNode
  /** Accessible name. The pane is a focusable region so keyboard users can scroll it. */
  label: string
  /** Merged onto the pane. Give it a height and it scrolls. */
  className?: string
}

interface Store {
  panes: Set<HTMLElement>
  /** Positions we set ourselves, so the scroll event they cause is not passed on again. */
  expected: Map<HTMLElement, { top: number; left: number }>
  options: { mode: ScrollSyncMode; axis: ScrollSyncAxis; enabled: boolean }
}

const ScrollSyncContext = createContext<Store | null>(null)

type Axis = 'top' | 'left'

const max = (pane: HTMLElement, axis: Axis) =>
  axis === 'top' ? pane.scrollHeight - pane.clientHeight : pane.scrollWidth - pane.clientWidth

/** Anchor positions in the pane’s own scroll coordinates. */
function anchors(pane: HTMLElement, axis: Axis) {
  const box = pane.getBoundingClientRect()
  const found = new Map<string, number>()
  pane.querySelectorAll<HTMLElement>('[data-sync-anchor]').forEach((element) => {
    const key = element.dataset.syncAnchor
    if (!key || found.has(key)) return
    const rect = element.getBoundingClientRect()
    found.set(key, axis === 'top' ? rect.top - box.top + pane.scrollTop : rect.left - box.left + pane.scrollLeft)
  })
  return found
}

/**
 * Where `target` should be when `source` is at `position`, by matching anchors.
 *
 * Pairs are the start, every anchor both panes share (kept only while they
 * increase in both), and the end. The source position falls between two pairs,
 * and the target gets the same fraction of the way between their partners —
 * so a long section on one side and a short one on the other still arrive
 * together at the next heading.
 */
function anchorTarget(source: HTMLElement, target: HTMLElement, axis: Axis, position: number) {
  const from = anchors(source, axis)
  const to = anchors(target, axis)
  const sourceMax = max(source, axis)
  const targetMax = max(target, axis)
  const pairs: [number, number][] = [[0, 0]]
  const shared = [...from.entries()].filter(([key]) => to.has(key)).sort((a, b) => a[1] - b[1])
  for (const [key, at] of shared) {
    const partner = to.get(key)!
    const last = pairs[pairs.length - 1]
    if (at > last[0] && partner > last[1] && at < sourceMax && partner < targetMax) pairs.push([at, partner])
  }
  pairs.push([Math.max(sourceMax, pairs[pairs.length - 1][0] + 1), Math.max(targetMax, pairs[pairs.length - 1][1])])
  for (let index = 0; index < pairs.length - 1; index += 1) {
    const [a, b] = [pairs[index], pairs[index + 1]]
    if (position <= b[0]) return a[1] + ((position - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
  }
  return targetMax
}

function follow(store: Store, source: HTMLElement) {
  const { mode, axis } = store.options
  const axes: Axis[] = axis === 'both' ? ['top', 'left'] : [axis === 'vertical' ? 'top' : 'left']
  store.panes.forEach((pane) => {
    if (pane === source) return
    const next = { top: pane.scrollTop, left: pane.scrollLeft }
    for (const along of axes) {
      const position = along === 'top' ? source.scrollTop : source.scrollLeft
      const range = max(source, along)
      next[along] =
        mode === 'anchor'
          ? anchorTarget(source, pane, along, position)
          : range > 0
            ? (position / range) * max(pane, along)
            : 0
    }
    if (Math.abs(next.top - pane.scrollTop) < 1 && Math.abs(next.left - pane.scrollLeft) < 1) return
    pane.scrollTop = next.top
    pane.scrollLeft = next.left
    // Read back: the browser clamps and rounds, and the echo carries its value, not ours.
    store.expected.set(pane, { top: pane.scrollTop, left: pane.scrollLeft })
  })
}

/**
 * Keeps several scroll containers in step — a diff’s two sides, source and
 * preview, a translation beside its original.
 *
 * The obvious version (on scroll, set the others) loops: setting a pane’s
 * position fires its scroll event, which sets the first pane, which fires
 * again, and the panes shudder. Here every position written is remembered,
 * and the scroll event it produces is recognised as an echo and dropped, so
 * only scrolls a person made propagate.
 *
 * Proportional mode matches the fraction scrolled. Anchor mode lines up
 * elements with the same `data-sync-anchor` and interpolates between them, so
 * panes whose sections differ in length still reach each heading together.
 * Each pane is a named, focusable region, so it can be scrolled from the keyboard.
 */
export function ScrollSync({ children, mode = 'proportional', axis = 'vertical', enabled = true }: ScrollSyncProps) {
  const [store] = useState<Store>(() => ({ panes: new Set(), expected: new Map(), options: { mode, axis, enabled } }))
  store.options = { mode, axis, enabled }

  // Re-enabling lines everything up with the first pane rather than waiting for a scroll.
  const wasEnabled = useRef(enabled)
  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      const [first] = store.panes
      if (first) follow(store, first)
    }
    wasEnabled.current = enabled
  }, [enabled, store, mode, axis])

  return <ScrollSyncContext.Provider value={store}>{children}</ScrollSyncContext.Provider>
}

/** One scroll container in a `ScrollSync`. */
export function ScrollSyncPane({ children, label, className }: ScrollSyncPaneProps) {
  const store = useContext(ScrollSyncContext)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pane = ref.current
    if (!pane || !store) return
    store.panes.add(pane)
    const onScroll = () => {
      const echo = store.expected.get(pane)
      if (echo) {
        store.expected.delete(pane)
        if (Math.abs(echo.top - pane.scrollTop) < 2 && Math.abs(echo.left - pane.scrollLeft) < 2) return
      }
      if (store.options.enabled) follow(store, pane)
    }
    pane.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      pane.removeEventListener('scroll', onScroll)
      store.panes.delete(pane)
      store.expected.delete(pane)
    }
  }, [store])

  return (
    // A scrollable region has to be reachable by keyboard to be scrolled by keyboard.
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn('overflow-auto overscroll-contain [scroll-behavior:auto]', className)}
    >
      {children}
    </div>
  )
}
