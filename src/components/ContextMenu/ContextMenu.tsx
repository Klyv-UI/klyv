'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Divider } from '../Divider'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Portal } from '../Portal'
import type { MenuItem } from '../Menu'

export interface ContextMenuProps {
  /** The region that opens the menu on right-click. */
  children: ReactNode
  items: (MenuItem | 'separator')[]
  /** Accessible name for the menu. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A menu opened at the pointer with a right-click. It also opens with the
 * keyboard context-menu key and with Shift+F10, anchored to the focused
 * element — without that it is unreachable for anyone not using a mouse.
 *
 * A context menu must never be the only route to an action.
 */
export function ContextMenu({ children, items, label, className }: ContextMenuProps) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)

  const openAt = (x: number, y: number) => {
    const width = 200
    const height = Math.min(320, items.length * 40 + 8)
    setPoint({
      x: Math.min(x, window.innerWidth - width - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    })
  }

  // Escape and the layer come from the shared stack.
  const { zIndex } = useOverlayLayer({ open: point !== null, onDismiss: () => setPoint(null), kind: 'popover' })

  useEffect(() => {
    if (!point) return
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    })
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setPoint(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      // Disabled items are skipped. A browser will not focus a disabled
      // button, so landing on one left focus where it was and every later
      // press aimed at the same item — the menu simply stopped moving.
      const nodes = [
        ...(panelRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])',
        ) ?? []),
      ]
      const index = nodes.indexOf(document.activeElement as HTMLElement)
      const step = event.key === 'ArrowDown' ? 1 : -1
      nodes[(index + step + nodes.length) % nodes.length]?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [point])

  return (
    <>
      <div
        ref={regionRef}
        tabIndex={0}
        onContextMenu={(event) => {
          event.preventDefault()
          openAt(event.clientX, event.clientY)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            openAt(rect.left + 12, rect.top + 12)
          }
        }}
        className={cn('rounded-[var(--radius-tile)]', className)}
      >
        {children}
      </div>

      {point && (
        <Portal>
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: point.y, left: point.x, zIndex }}
          >
            <Surface variant="floating" className="min-w-[200px] border border-line p-1">
              <div role="menu" aria-label={label} className="flex flex-col">
                {items.map((item, index) =>
                  item === 'separator' ? (
                    <Divider key={`separator-${index}`} className="my-1" />
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      disabled={item.disabled}
                      onClick={() => {
                        item.onSelect?.()
                        setPoint(null)
                      }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                        'disabled:pointer-events-none disabled:opacity-40',
                        item.destructive
                          ? 'text-danger hover:bg-danger/10'
                          : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      {item.icon && <item.icon size={15} strokeWidth={2} aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta && (
                        <Text as="span" size="caption" tone="faint">
                          {item.meta}
                        </Text>
                      )}
                    </button>
                  ),
                )}
              </div>
            </Surface>
          </div>
        </Portal>
      )}
    </>
  )
}
