'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { PlusIcon } from '../internal/icons'

export interface SpeedDialAction {
  id: string
  /** Always required: it names the button whether or not it is shown. */
  label: string
  icon: IconComponent
  onSelect?: () => void
  disabled?: boolean
}

export type SpeedDialDirection = 'up' | 'down' | 'left' | 'right'

export interface SpeedDialProps {
  /** The secondary actions, nearest the trigger first. */
  actions: SpeedDialAction[]
  /** Accessible name for the trigger — "Create". */
  label: string
  /** Trigger glyph. Rotated an eighth of a turn while open, so a plus becomes a cross. */
  icon?: IconComponent
  /** Which way the actions fan out from the trigger. */
  direction?: SpeedDialDirection
  /** `visible` prints each label beside its action; `hover` shows it on hover and focus only. */
  labels?: 'visible' | 'hover'
  /** Controlled open state. */
  open?: boolean
  /** Starting state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when it opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** Merged onto the root. Position it here — `fixed bottom-6 right-6`. */
  className?: string
}

const NEXT: Record<SpeedDialDirection, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const PREV: Record<SpeedDialDirection, string> = { up: 'ArrowDown', down: 'ArrowUp', left: 'ArrowRight', right: 'ArrowLeft' }

const LIST: Record<SpeedDialDirection, string> = {
  up: 'bottom-full mb-3 flex-col-reverse left-1/2 -translate-x-1/2',
  down: 'top-full mt-3 flex-col left-1/2 -translate-x-1/2',
  left: 'right-full mr-3 flex-row-reverse top-1/2 -translate-y-1/2',
  right: 'left-full ml-3 flex-row top-1/2 -translate-y-1/2',
}

/**
 * A floating action button that opens into a short list of related actions.
 *
 * It is for the screen that has one obvious primary action with a few close
 * relatives — New, then New folder, Upload, Scan. More than about five and it
 * should be a Menu: a column of round buttons stops being faster to scan than
 * a list of words.
 *
 * It follows the menu-button pattern. The trigger reports `aria-expanded`,
 * opening moves focus to the nearest action, arrow keys in the direction of
 * travel walk outward, Escape closes and puts focus back on the trigger, and
 * Tab or a click elsewhere closes it. Every action is named by its label even
 * when the label is only shown on hover, so an icon-only dial is never a row of
 * unnamed buttons.
 */
export function SpeedDial({
  actions,
  label,
  icon: Icon = PlusIcon,
  direction = 'up',
  labels = 'visible',
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  className,
}: SpeedDialProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = controlled ?? uncontrolled
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const pendingFocus = useRef<number | null>(null)
  const menuId = useId()
  const vertical = direction === 'up' || direction === 'down'

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

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === NEXT[direction] || event.key === PREV[direction]) {
      event.preventDefault()
      openAndFocus()
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const order = enabled()
    const at = order.indexOf(itemsRef.current.indexOf(document.activeElement as HTMLButtonElement))
    const go = (position: number) => itemsRef.current[order[(position + order.length) % order.length]]?.focus()

    if (event.key === 'Escape') {
      // Handled here, so an overlay behind the dial does not close as well.
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') {
      setOpen(false)
    } else if (order.length && (event.key === NEXT[direction] || event.key === PREV[direction])) {
      event.preventDefault()
      go(at + (event.key === NEXT[direction] ? 1 : -1))
    } else if (order.length && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      go(event.key === 'Home' ? 0 : order.length - 1)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <ul
        id={menuId}
        role="menu"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        onKeyDown={onMenuKeyDown}
        className={cn('absolute z-[var(--z-sticky)] m-0 flex list-none gap-3 p-0', LIST[direction], !open && 'invisible')}
      >
        {actions.map((action, index) => {
          const ActionIcon = action.icon
          return (
            <li key={action.id} role="none" className="group relative flex items-center justify-center">
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
                style={{ transitionDelay: open ? `${index * 30}ms` : '0ms' }}
                className={cn(
                  'inline-flex size-10 items-center justify-center rounded-full bg-shell text-ink shadow-[var(--shadow-float)]',
                  'transition-[opacity,transform,background-color] duration-150 hover:bg-surface-muted motion-reduce:transition-none',
                  'disabled:pointer-events-none disabled:opacity-40',
                  open ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                )}
              >
                <ActionIcon size={17} strokeWidth={2} aria-hidden="true" />
              </button>
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute whitespace-nowrap rounded-[10px] bg-ink px-2.5 py-1.5 text-[11px] font-semibold leading-none text-ink-inverse shadow-[var(--shadow-float)]',
                  'transition-opacity duration-150 motion-reduce:transition-none',
                  vertical ? 'right-full mr-3' : 'bottom-full mb-2',
                  labels === 'visible' && open
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
                )}
              >
                {action.label}
              </span>
            </li>
          )
        })}
      </ul>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close(false) : openAndFocus())}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[var(--shadow-float)] transition-colors hover:bg-accent-strong"
      >
        <Icon
          size={22}
          strokeWidth={2.25}
          aria-hidden="true"
          className={cn('transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-45')}
        />
      </button>
    </div>
  )
}
