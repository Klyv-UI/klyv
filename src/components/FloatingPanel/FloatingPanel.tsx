'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Portal } from '../Portal'
import { Text } from '../Text'
import { ChevronDownIcon, ChevronUpIcon, CrossIcon } from '../internal/icons'

export interface FloatingPanelPosition {
  /** Pixels from the left edge of the viewport. */
  x: number
  /** Pixels from the top edge of the viewport. */
  y: number
}

export interface FloatingPanelProps {
  open: boolean
  /** Called by the close button, and by Escape while focus is inside the panel. */
  onClose: () => void
  /** Title in the drag bar. Becomes the accessible name. */
  title: string
  /** Panel contents. */
  children?: ReactNode
  /** Where the panel first appears. Defaults to the top right corner. */
  defaultPosition?: FloatingPanelPosition
  /** Called when a move ends, by pointer or keyboard. Store it to reopen the panel where it was left. */
  onPositionChange?: (position: FloatingPanelPosition) => void
  /** Controlled minimised state. */
  minimized?: boolean
  /** Initial minimised state when uncontrolled. */
  defaultMinimized?: boolean
  /** Called when the panel is minimised or restored. */
  onMinimizedChange?: (minimized: boolean) => void
  /** Panel width in pixels. */
  width?: number
  /** Move focus into the panel when it opens. */
  autoFocus?: boolean
  /** Merged onto the panel. */
  className?: string
}

const MARGIN = 8

/**
 * A panel that floats over the page without stopping the page — an inspector,
 * a help chat, a colour picker kept open while editing.
 *
 * It is a dialog without `aria-modal`, and that is the point: the page behind
 * stays scrollable, clickable and reachable with Tab, so there is no focus trap
 * and no scrim. Escape closes it only while focus is inside it, since a
 * non-modal panel has no claim on a key pressed somewhere else.
 *
 * It moves by its title bar, and the grip in that bar also takes arrow keys —
 * ten pixels a press, fifty with Shift — so moving it out of the way is not a
 * pointer-only privilege. It is kept inside the viewport while moving and when
 * the window shrinks, and the final position goes to a callback, so the app
 * decides whether "where I left it" survives a reload.
 */
export function FloatingPanel({
  open,
  onClose,
  title,
  children,
  defaultPosition,
  onPositionChange,
  minimized: controlledMinimized,
  defaultMinimized = false,
  onMinimizedChange,
  width = 320,
  autoFocus = true,
  className,
}: FloatingPanelProps) {
  const [position, setPosition] = useState<FloatingPanelPosition | null>(defaultPosition ?? null)
  const [uncontrolledMinimized, setUncontrolledMinimized] = useState(defaultMinimized)
  const minimized = controlledMinimized ?? uncontrolledMinimized
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number; pointer: number; moved: boolean } | null>(null)
  const positionRef = useRef(position)
  positionRef.current = position
  const titleId = useId()
  const bodyId = useId()
  const hintId = useId()

  const clamp = useCallback((next: FloatingPanelPosition): FloatingPanelPosition => {
    const panel = panelRef.current
    const w = panel?.offsetWidth ?? width
    const h = panel?.offsetHeight ?? 48
    return {
      x: Math.round(Math.min(Math.max(MARGIN, next.x), Math.max(MARGIN, window.innerWidth - w - MARGIN))),
      y: Math.round(Math.min(Math.max(MARGIN, next.y), Math.max(MARGIN, window.innerHeight - h - MARGIN))),
    }
  }, [width])

  // First placement, and focus, once the panel is on the page and can be measured.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    setPosition((current) => clamp(current ?? { x: window.innerWidth - width - 24, y: 24 }))
    if (autoFocus) panelRef.current?.focus({ preventScroll: true })
    const panel = panelRef.current
    return () => {
      if (panel?.contains(document.activeElement) || document.activeElement === document.body) previous?.focus?.()
    }
    // Only on open: a later width change is handled by the resize clamp.
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => setPosition((current) => (current ? clamp(current) : current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, clamp])

  const setMinimized = (next: boolean) => {
    if (controlledMinimized === undefined) setUncontrolledMinimized(next)
    onMinimizedChange?.(next)
  }

  const commit = (next: FloatingPanelPosition) => {
    const clamped = clamp(next)
    setPosition(clamped)
    onPositionChange?.(clamped)
  }

  if (!open) return null

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            onClose()
          }
        }}
        style={{
          position: 'fixed',
          left: position?.x ?? -9999,
          top: position?.y ?? -9999,
          width,
          zIndex: 'calc(var(--z-overlay) - 1)' as unknown as number,
        }}
        className={cn(
          'flex max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface text-ink shadow-[var(--shadow-float)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          className,
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none select-none items-center gap-1 border-b border-line bg-surface-sunken py-1 pl-1 pr-1.5 active:cursor-grabbing"
          onPointerDown={(event) => {
            if (event.button !== 0 || (event.target as HTMLElement).closest('[data-panel-control]')) return
            const current = positionRef.current ?? { x: 0, y: 0 }
            drag.current = { dx: event.clientX - current.x, dy: event.clientY - current.y, pointer: event.pointerId, moved: false }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const active = drag.current
            if (!active || active.pointer !== event.pointerId) return
            active.moved = true
            setPosition(clamp({ x: event.clientX - active.dx, y: event.clientY - active.dy }))
          }}
          onPointerUp={(event) => {
            const active = drag.current
            if (!active) return
            drag.current = null
            event.currentTarget.releasePointerCapture(event.pointerId)
            if (active.moved && positionRef.current) onPositionChange?.(positionRef.current)
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
        >
          <button
            type="button"
            aria-label={`Move ${title}`}
            aria-describedby={hintId}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 50 : 10
              const delta: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              }
              const move = delta[event.key]
              if (!move || !positionRef.current) return
              event.preventDefault()
              commit({ x: positionRef.current.x + move[0], y: positionRef.current.y + move[1] })
            }}
            className="inline-flex size-7 cursor-grab items-center justify-center rounded-[8px] text-ink-faint hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong"
          >
            <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden="true">
              {[4, 8, 12].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.25} />))}
            </svg>
          </button>
          <span id={hintId} className="sr-only">
            Use the arrow keys to move the panel. Hold Shift to move further.
          </span>
          <Text as="h2" id={titleId} size="label" weight="bold" className="min-w-0 flex-1 truncate">
            {title}
          </Text>
          <span data-panel-control="" className="flex items-center">
            <IconButton
              icon={minimized ? ChevronDownIcon : ChevronUpIcon}
              label={minimized ? 'Restore' : 'Minimise'}
              aria-expanded={!minimized}
              aria-controls={bodyId}
              size="xs"
              onClick={() => setMinimized(!minimized)}
            />
            <IconButton icon={CrossIcon} label="Close" size="xs" onClick={onClose} />
          </span>
        </div>
        <div id={bodyId} hidden={minimized} className="min-h-0 flex-1 overflow-y-auto p-3.5">
          {children}
        </div>
      </div>
    </Portal>
  )
}
