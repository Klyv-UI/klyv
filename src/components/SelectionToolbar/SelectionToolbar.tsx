'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { useOverlayLayer } from '../../lib/overlay'
import { Portal } from '../Portal'
import type { IconComponent } from '../../lib/types'

export interface SelectionToolbarContext {
  /** The selected text. */
  text: string
  /** A copy of the selected range, taken when the toolbar appeared. */
  range: Range
  /** Puts the selection back — needed before `execCommand` once focus has moved to the toolbar. */
  restore: () => void
}

export interface SelectionToolbarAction {
  id: string
  /** Accessible name and tooltip. */
  label: string
  icon?: IconComponent
  /** Display hint, e.g. "⌘B". Wire the shortcut yourself. */
  shortcut?: string
  /** Shown pressed — the selection is already bold. */
  active?: boolean
  disabled?: boolean
  onSelect: (context: SelectionToolbarContext) => void
}

export interface SelectionToolbarProps {
  /** The content a selection is watched in — an article, a contenteditable editor. */
  children: ReactNode
  /** The buttons, left to right. */
  actions: SelectionToolbarAction[]
  /** Accessible name for the toolbar. */
  label?: string
  /** The key that moves focus into the toolbar while it shows, as `event.key` with modifiers: "Alt+F10". */
  shortcut?: string
  /** Hide the toolbar after an action runs. */
  closeOnAction?: boolean
  /** Merged onto the container around the content. */
  className?: string
}

interface Placement {
  top: number
  left: number
  below: boolean
}

const GAP = 8

function matchesShortcut(event: globalThis.KeyboardEvent, shortcut: string) {
  const parts = shortcut.split('+')
  const key = parts.pop()!.toLowerCase()
  const want = (name: string) => parts.some((part) => part.toLowerCase() === name)
  return (
    event.key.toLowerCase() === key &&
    event.altKey === want('alt') &&
    event.shiftKey === want('shift') &&
    (event.ctrlKey || event.metaKey) === (want('ctrl') || want('meta') || want('mod'))
  )
}

/**
 * A few actions floating over the text someone has just selected — bold, link,
 * comment — in the place their eyes already are.
 *
 * A fixed toolbar at the top of a long document is a trip away from the
 * sentence being edited. This appears above the selection, from the range’s own
 * rectangle, flips below it when there is no room, and follows it on scroll.
 * It goes when the selection collapses or Escape is pressed.
 *
 * A toolbar that only the pointer can reach is a toolbar half its readers
 * cannot use, so it is a real `toolbar`: Alt+F10 — the shortcut editors
 * already use for this — moves focus into it, arrows move between buttons with
 * one tab stop, and Escape puts focus back where it came from. Actions receive
 * the selected text, the range, and a way to restore the selection, since
 * moving focus into the toolbar is exactly what clears it in an editor.
 */
export function SelectionToolbar({
  children,
  actions,
  label = 'Text formatting',
  shortcut = 'Alt+F10',
  closeOnAction = true,
  className,
}: SelectionToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [selection, setSelection] = useState<{ text: string; range: Range } | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [active, setActive] = useState(0)

  const open = selection !== null
  const hide = useCallback(() => {
    setSelection(null)
    setPlacement(null)
  }, [])

  const { zIndex } = useOverlayLayer({
    open,
    kind: 'popover',
    onDismiss: () => {
      const target = toolbarRef.current?.contains(document.activeElement) ? returnFocus.current : null
      hide()
      target?.focus()
    },
  })

  useEffect(() => {
    const onChange = () => {
      // Focus inside the toolbar keeps it up, whatever the selection did.
      if (toolbarRef.current?.contains(document.activeElement)) return
      const current = document.getSelection()
      const container = containerRef.current
      if (!current || current.isCollapsed || current.rangeCount === 0 || !container) return hide()
      const range = current.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return hide()
      const text = current.toString()
      if (!text.trim()) return hide()
      setSelection({ text, range: range.cloneRange() })
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [hide])

  const place = useCallback(() => {
    const toolbar = toolbarRef.current
    if (!selection || !toolbar) return
    // Environments without layout (jsdom) have no range geometry; the toolbar then sits at the corner.
    if (typeof selection.range.getBoundingClientRect !== 'function') return setPlacement({ top: GAP, left: GAP, below: true })
    const rect = selection.range.getBoundingClientRect()
    const width = toolbar.offsetWidth
    const height = toolbar.offsetHeight
    const below = rect.top - height - GAP < 0
    const left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - GAP)
    setPlacement({ top: below ? rect.bottom + GAP : rect.top - height - GAP, left, below })
  }, [selection])

  useIsomorphicLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!matchesShortcut(event, shortcut)) return
      event.preventDefault()
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      toolbarRef.current?.querySelectorAll<HTMLElement>('button')[active]?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, shortcut, active])

  const restore = () => {
    if (!selection) return
    const current = document.getSelection()
    current?.removeAllRanges()
    current?.addRange(selection.range)
  }

  const run = (action: SelectionToolbarAction) => {
    if (!selection || action.disabled) return
    const context = { text: selection.text, range: selection.range, restore }
    const back = returnFocus.current
    action.onSelect(context)
    if (!closeOnAction) return
    hide()
    if (toolbarRef.current?.contains(document.activeElement)) back?.focus()
  }

  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = actions.length
    const moves: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: count - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = (moves[event.key] + count) % count
    setActive(next)
    toolbarRef.current?.querySelectorAll<HTMLElement>('button')[next]?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {children}
      {/* Said once as the toolbar appears, not on every change of selection. */}
      <span role="status" className="sr-only">
        {open ? `${label} available. Press ${shortcut} to reach it.` : ''}
      </span>
      {open && (
        <Portal>
          <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={label}
            aria-orientation="horizontal"
            onKeyDown={onToolbarKeyDown}
            style={{ position: 'fixed', top: placement?.top ?? -9999, left: placement?.left ?? -9999, zIndex }}
            className={cn(
              'flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-float)]',
              'transition-opacity duration-100 motion-reduce:transition-none',
              placement ? 'opacity-100' : 'opacity-0',
            )}
          >
            {actions.map((action, index) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  aria-label={Icon ? action.label : undefined}
                  aria-pressed={action.active}
                  title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                  tabIndex={index === active ? 0 : -1}
                  disabled={action.disabled}
                  // Pressing must not collapse the selection it acts on.
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setActive(index)}
                  onClick={() => run(action)}
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-[12px] font-semibold text-ink-soft transition-colors',
                    'hover:bg-surface-muted hover:text-ink disabled:opacity-40',
                    action.active && 'bg-accent-soft text-ink',
                  )}
                >
                  {Icon ? <Icon size={15} aria-hidden="true" /> : action.label}
                </button>
              )
            })}
          </div>
        </Portal>
      )}
    </div>
  )
}
