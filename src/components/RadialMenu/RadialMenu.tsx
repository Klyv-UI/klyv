'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { PlusIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface RadialAction {
  id: string
  /** Always required: it names the button whether or not it is shown. */
  label: string
  icon: IconComponent
  onSelect?: () => void
  disabled?: boolean
  /** Marks the destructive one, so it reads differently before it is chosen. */
  tone?: 'default' | 'danger'
}

/** Which way a stack fans out from its trigger. */
export type RadialMenuDirection = 'up' | 'down' | 'left' | 'right'

export interface RadialMenuProps {
  /** The actions, nearest the trigger (or first around the arc) first. */
  actions: RadialAction[]
  /** Accessible name for the trigger — "Create". */
  label: string
  /** Trigger glyph. Turned while open, so a plus becomes a cross. */
  icon?: IconComponent
  /** `arc` fans the actions around the trigger; `stack` lines them up as a floating action button’s speed dial. */
  layout?: 'arc' | 'stack'
  /** Which way a stack fans out. Ignored by the arc. */
  direction?: RadialMenuDirection
  /** `visible` prints each label beside its action; `hover` shows it on hover and focus only. Defaults to `visible` for a stack and `hover` for an arc. */
  labels?: 'visible' | 'hover'
  /** Distance from the centre to each action on the arc, in pixels. */
  radius?: number
  /** Degrees. 0 points right, -90 points up. Arc only. */
  startAngle?: number
  /** Degrees the arc is spread across. 360 makes a full wheel. */
  sweep?: number
  /** Controlled open state. */
  open?: boolean
  /** Starting state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when it opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** Merged onto the root, last, so it wins. Position a stack here — `fixed bottom-6 right-6`. */
  className?: string
}

const NEXT: Record<RadialMenuDirection, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const PREV: Record<RadialMenuDirection, string> = { up: 'ArrowDown', down: 'ArrowUp', left: 'ArrowRight', right: 'ArrowLeft' }

const STACK: Record<RadialMenuDirection, string> = {
  up: 'bottom-full mb-3 flex-col-reverse left-1/2 -translate-x-1/2',
  down: 'top-full mt-3 flex-col left-1/2 -translate-x-1/2',
  left: 'right-full mr-3 flex-row-reverse top-1/2 -translate-y-1/2',
  right: 'left-full ml-3 flex-row top-1/2 -translate-y-1/2',
}

/** Per-item stagger, in milliseconds. */
const STAGGER = { arc: 40, stack: 30 }
/** Item transition length, so the menu stays visible until the last one has closed. */
const DURATION = { arc: 320, stack: 150 }

/**
 * Actions that fan out from a trigger — on an arc around it, or stacked in one
 * direction as a floating action button’s speed dial.
 *
 * The arc exists for a reason beyond looking good: every action is the same
 * distance from the pointer, so no item is cheaper to reach than another. The
 * stack is for the screen with one obvious primary action and a few close
 * relatives — New, then New folder, Upload, Scan. More than about five and
 * either should be a Menu: a ring or column of round buttons stops being
 * faster to scan than a list of words.
 *
 * Items move with transforms, so opening is one composited `translate` and
 * `scale` per item with a staggered delay that runs outward on open and inward
 * on close — which is what makes it read as one object rather than five.
 *
 * Both follow the menu-button pattern. The trigger reports `aria-expanded`,
 * opening moves focus to the first action, arrow keys walk the actions, Home
 * and End jump to either end, Escape closes and puts focus back on the trigger,
 * and Tab or a click elsewhere closes it. Every action is named by its label
 * even when the label is only shown on hover.
 */
export function RadialMenu({
  actions,
  label,
  icon: Icon = PlusIcon,
  layout = 'arc',
  direction = 'up',
  labels,
  radius = 92,
  startAngle = -90,
  sweep = 180,
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  className,
}: RadialMenuProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = controlled ?? uncontrolled
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const pendingFocus = useRef<number | null>(null)
  const menuId = useId()
  const stack = layout === 'stack'
  const showLabels = (labels ?? (stack ? 'visible' : 'hover')) === 'visible'

  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }
  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  const enabled = () => actions.map((action, index) => (action.disabled ? -1 : index)).filter((index) => index >= 0)

  const openAndFocus = () => {
    pendingFocus.current = enabled()[0] ?? null
    setOpen(true)
  }
  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    if (pendingFocus.current !== null) {
      itemsRef.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenRef.current(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // One item sits at each end of the sweep; a full circle drops the duplicate.
  const step = actions.length <= 1 ? 0 : sweep >= 360 ? sweep / actions.length : sweep / (actions.length - 1)
  const pointAt = (index: number) => {
    const angle = ((startAngle + step * index) * Math.PI) / 180
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  }

  // Which arrows walk the actions: along the stack, or around the arc.
  const forward = stack ? [NEXT[direction]] : ['ArrowRight', 'ArrowDown']
  const backward = stack ? [PREV[direction]] : ['ArrowLeft', 'ArrowUp']
  const opensFrom = stack ? [NEXT[direction], PREV[direction]] : ['ArrowUp', 'ArrowDown']

  const first = pointAt(0)
  const last = pointAt(Math.max(0, actions.length - 1))
  const orientation = stack
    ? direction === 'up' || direction === 'down'
      ? 'vertical'
      : 'horizontal'
    : Math.abs(last.x - first.x) > Math.abs(last.y - first.y)
      ? 'horizontal'
      : 'vertical'

  const onRootKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      // Handled here, so an overlay behind the menu does not close as well.
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (opensFrom.includes(event.key)) {
      event.preventDefault()
      openAndFocus()
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const order = enabled()
    const at = order.indexOf(itemsRef.current.indexOf(document.activeElement as HTMLButtonElement))
    const go = (position: number) => itemsRef.current[order[(position + order.length) % order.length]]?.focus()

    if (event.key === 'Tab') {
      setOpen(false)
    } else if (order.length && (forward.includes(event.key) || backward.includes(event.key))) {
      event.preventDefault()
      go(at + (forward.includes(event.key) ? 1 : -1))
    } else if (order.length && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      go(event.key === 'Home' ? 0 : order.length - 1)
    }
  }

  const stagger = STAGGER[layout]
  // Hidden only once the last item has finished closing, so the inward stagger is seen.
  const hideAfter = DURATION[layout] + stagger * Math.max(0, actions.length - 1)

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)} onKeyDown={onRootKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close(false) : openAndFocus())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'relative z-10 inline-flex items-center justify-center rounded-full shadow-[var(--shadow-float)]',
          stack
            ? 'size-14 bg-accent text-accent-ink transition-colors hover:bg-accent-strong'
            : 'size-12 bg-ink text-ink-inverse transition-transform duration-[var(--duration-slow)] motion-reduce:transition-none',
          !stack && open && 'rotate-[135deg]',
        )}
      >
        <Icon
          size={stack ? 22 : 20}
          strokeWidth={2.25}
          aria-hidden="true"
          className={cn(
            stack && 'transition-transform duration-200 motion-reduce:transition-none',
            stack && open && 'rotate-45',
          )}
        />
      </button>

      <ul
        id={menuId}
        role="menu"
        aria-label={label}
        aria-orientation={orientation}
        onKeyDown={onMenuKeyDown}
        className={cn(
          'm-0 list-none p-0',
          stack ? cn('absolute z-[var(--z-sticky)] flex gap-3', STACK[direction]) : 'absolute inset-0',
          !open && 'invisible',
        )}
        style={{ transition: open ? 'none' : `visibility 0s linear ${hideAfter}ms` }}
      >
        {actions.map((action, index) => {
          const ActionIcon = action.icon
          const delay = `${(open ? index : actions.length - 1 - index) * stagger}ms`
          const point = pointAt(index)
          return (
            <li
              key={action.id}
              role="none"
              className={cn('group/radial flex items-center justify-center', stack ? 'relative' : 'absolute left-0 top-0')}
            >
              <button
                ref={(node) => {
                  itemsRef.current[index] = node
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={action.label}
                disabled={action.disabled}
                onClick={() => {
                  action.onSelect?.()
                  close(true)
                }}
                className={cn(
                  'inline-flex items-center justify-center rounded-full shadow-[var(--shadow-float)]',
                  'disabled:pointer-events-none',
                  open && 'disabled:opacity-40',
                  action.tone === 'danger' ? 'text-danger' : 'text-ink',
                  stack
                    ? cn(
                        'size-10 bg-shell hover:bg-surface-muted',
                        'transition-[opacity,transform,background-color] duration-150 motion-reduce:transition-none',
                        open ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                      )
                    : cn(
                        'size-11 border border-line bg-surface',
                        'motion-safe-only transition-[transform,opacity] duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
                        open ? 'opacity-100' : 'opacity-0',
                      ),
                )}
                style={
                  stack
                    ? { transitionDelay: open ? delay : '0ms' }
                    : {
                        transform: open
                          ? `translate3d(calc(${point.x}px + 0.125rem), calc(${point.y}px + 0.125rem), 0) scale(1)`
                          : 'translate3d(0.125rem, 0.125rem, 0) scale(0.4)',
                        // Outward on open, inward on close — one object, not five.
                        transitionDelay: delay,
                      }
                }
              >
                <ActionIcon size={17} strokeWidth={2.25} aria-hidden="true" />
              </button>
              {stack ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute whitespace-nowrap rounded-[10px] bg-ink px-2.5 py-1.5 text-[11px] font-semibold leading-none text-ink-inverse shadow-[var(--shadow-float)]',
                    'transition-opacity duration-150 motion-reduce:transition-none',
                    orientation === 'vertical' ? 'right-full mr-3' : 'bottom-full mb-2',
                    showLabels && open
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/radial:opacity-100 group-has-[:focus-visible]/radial:opacity-100',
                  )}
                >
                  {action.label}
                </span>
              ) : (
                <Text
                  as="span"
                  size="micro"
                  weight="bold"
                  tone="soft"
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute whitespace-nowrap transition-opacity motion-reduce:transition-none',
                    showLabels && open
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/radial:opacity-100 group-has-[:focus-visible]/radial:opacity-100',
                  )}
                  style={{
                    // Under its action: the item's offset plus a line below its 44px circle.
                    transform: `translate3d(calc(${open ? point.x : 0}px + 0.125rem), calc(${open ? point.y : 0}px + 2.25rem), 0)`,
                  }}
                >
                  {action.label}
                </Text>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
