'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export interface RadialAction {
  id: string
  label: string
  icon: IconComponent
  onSelect?: () => void
  disabled?: boolean
  /** Marks the destructive one, so it reads differently before it is chosen. */
  tone?: 'default' | 'danger'
}

export interface RadialMenuProps {
  actions: RadialAction[]
  /** Accessible name for the trigger. */
  label: string
  /** Trigger glyph. */
  icon: IconComponent
  /** Distance from the centre to each action, in pixels. */
  radius?: number
  /** Degrees. 0 points right, -90 points up. */
  startAngle?: number
  /** Degrees the actions are spread across. 360 makes a full wheel. */
  sweep?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Actions that fan out on an arc around their trigger.
 *
 * The arc exists for a reason beyond looking good: on a radial layout every
 * action is the same distance from the pointer, so no item is cheaper to reach
 * than another. A vertical menu always favours its first item.
 *
 * Each item is placed with a transform rather than `top`/`left`, so opening is
 * one composited `translate` and `scale` per item with a staggered delay — and
 * the stagger runs outward on open and inward on close, which is what makes it
 * read as one object rather than five.
 *
 * It is a real menu: Escape closes, an outside click closes, arrow keys move
 * around the arc, and the trigger keeps focus so the whole thing is reachable
 * without a pointer.
 */
export function RadialMenu({
  actions,
  label,
  icon: Icon,
  radius = 92,
  startAngle = -90,
  sweep = 180,
  open,
  onOpenChange,
  className,
}: RadialMenuProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])

  const isOpen = open ?? uncontrolled
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) itemsRef.current[0]?.focus()
    else setActive(0)
  }, [isOpen])

  // One item sits at each end of the sweep; a full circle drops the duplicate.
  const step =
    actions.length <= 1 ? 0 : sweep >= 360 ? sweep / actions.length : sweep / (actions.length - 1)

  const move = (delta: number) => {
    const next = (active + delta + actions.length) % actions.length
    setActive(next)
    itemsRef.current[next]?.focus()
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setOpen(!isOpen)}
        className={cn(
          'relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-[var(--shadow-float)] transition-transform duration-[var(--duration-slow)]',
          isOpen && 'rotate-[135deg]',
        )}
      >
        <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>

      <div
        role="menu"
        aria-label={label}
        aria-hidden={!isOpen}
        className={cn('pointer-events-none absolute inset-0', isOpen && 'pointer-events-auto')}
      >
        {actions.map((action, index) => {
          const angle = ((startAngle + step * index) * Math.PI) / 180
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          return (
            <button
              key={action.id}
              ref={(node) => {
                itemsRef.current[index] = node
              }}
              type="button"
              role="menuitem"
              tabIndex={isOpen && index === active ? 0 : -1}
              disabled={action.disabled || !isOpen}
              onFocus={() => setActive(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  move(1)
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  move(-1)
                }
              }}
              onClick={() => {
                action.onSelect?.()
                setOpen(false)
              }}
              className={cn(
                'group/radial absolute left-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-float)]',
                'motion-safe-only transition-[transform,opacity] duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
                'disabled:opacity-0',
                action.tone === 'danger' ? 'text-danger' : 'text-ink',
                isOpen ? 'opacity-100' : 'opacity-0',
              )}
              style={{
                transform: isOpen
                  ? `translate3d(calc(${x}px + 0.125rem), calc(${y}px + 0.125rem), 0) scale(1)`
                  : 'translate3d(0.125rem, 0.125rem, 0) scale(0.4)',
                // Outward on open, inward on close — one object, not five.
                transitionDelay: `${(isOpen ? index : actions.length - 1 - index) * 40}ms`,
              }}
            >
              <action.icon size={17} strokeWidth={2.25} aria-hidden="true" />
              <Text
                as="span"
                size="micro"
                weight="bold"
                tone="soft"
                className="pointer-events-none absolute -bottom-5 whitespace-nowrap opacity-0 transition-opacity group-hover/radial:opacity-100 group-focus-visible/radial:opacity-100"
              >
                {action.label}
              </Text>
            </button>
          )
        })}
      </div>
    </div>
  )
}
