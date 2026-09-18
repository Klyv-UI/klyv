'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon, ChevronRightIcon } from '../internal/icons'

interface MenubarItemBase {
  id: string
  label: string
  /** Right-aligned hint, e.g. "⌘S". Display only — wire the shortcut yourself. */
  shortcut?: string
  disabled?: boolean
}

export interface MenubarActionItem extends MenubarItemBase {
  type?: 'item'
  onSelect?: () => void
}

export interface MenubarCheckboxItem extends MenubarItemBase {
  type: 'checkbox'
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export interface MenubarSubmenuItem extends MenubarItemBase {
  type: 'submenu'
  items: MenubarEntry[]
}

export type MenubarEntry = MenubarActionItem | MenubarCheckboxItem | MenubarSubmenuItem | 'separator'

export interface MenubarMenu {
  id: string
  /** The word on the bar — File, Edit, View. */
  label: string
  items: MenubarEntry[]
}

export interface MenubarProps {
  /** The top-level menus, left to right. */
  menus: MenubarMenu[]
  /** Accessible name for the bar. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

type MenubarEdge = 'first' | 'last' | null

const ITEM =
  'flex w-full items-center gap-2.5 rounded-[var(--radius-10)] px-2.5 py-1.5 text-left text-[13px] font-semibold text-ink-soft outline-none transition-colors ' +
  'hover:bg-surface-muted hover:text-ink focus:bg-surface-muted focus:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-expanded:bg-surface-muted'

interface PanelProps {
  entries: MenubarEntry[]
  labelledBy: string
  edge: MenubarEdge
  /** Escape, or Left in a submenu. */
  onBack: () => void
  /** Left or Right that should move along the bar. */
  onAcross: (step: 1 | -1) => void
  /** An item was chosen: close everything. */
  onDone: () => void
  nested?: boolean
}

/** One dropdown, and recursively its submenus. */
function MenubarPanel({ entries, labelledBy, edge, onBack, onAcross, onDone, nested = false }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<{ id: string; edge: MenubarEdge } | null>(null)
  const baseId = useId()

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>(':scope > [role="none"] > [data-menubar-item]:not([aria-disabled="true"])') ?? [])

  useEffect(() => {
    if (!edge) return
    const list = items()
    ;(edge === 'first' ? list[0] : list[list.length - 1])?.focus()
  }, [edge])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    const current = list[index]
    const entry = entries.find((item) => item !== 'separator' && current?.dataset.menubarItem === item.id)
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        handled()
        list[(index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus()
        break
      case 'Home':
      case 'End':
        handled()
        ;(event.key === 'Home' ? list[0] : list[list.length - 1])?.focus()
        break
      case 'ArrowRight':
        handled()
        if (entry && entry !== 'separator' && entry.type === 'submenu') setSub({ id: entry.id, edge: 'first' })
        else onAcross(1)
        break
      case 'ArrowLeft':
        handled()
        if (nested) onBack()
        else onAcross(-1)
        break
      case 'Escape':
        handled()
        onBack()
        break
      case 'Tab':
        onDone()
        break
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-labelledby={labelledBy}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className={cn(
        'absolute z-[var(--z-popover)] flex min-w-[220px] flex-col rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]',
        nested ? '-top-1 left-full ml-1' : 'left-0 top-full mt-1.5',
      )}
    >
      {entries.map((entry, index) => {
        if (entry === 'separator') return <div key={`separator-${index}`} role="separator" className="-mx-1 my-1 h-px bg-line" />

        const id = `${baseId}-${entry.id}`
        const open = entry.type === 'submenu' && sub?.id === entry.id
        const content: ReactNode = (
          <>
            <span className="flex size-4 shrink-0 items-center justify-center">
              {entry.type === 'checkbox' && entry.checked && <CheckIcon size={14} aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.shortcut && <span className="text-[11px] font-medium tabular-nums text-ink-faint">{entry.shortcut}</span>}
            {entry.type === 'submenu' && <ChevronRightIcon size={13} aria-hidden="true" className="text-ink-faint" />}
          </>
        )

        return (
          <div key={entry.id} role="none" className="relative">
            <button
              id={id}
              type="button"
              tabIndex={-1}
              data-menubar-item={entry.id}
              role={entry.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={entry.type === 'checkbox' ? entry.checked : undefined}
              aria-haspopup={entry.type === 'submenu' ? 'menu' : undefined}
              aria-expanded={entry.type === 'submenu' ? open : undefined}
              aria-disabled={entry.disabled || undefined}
              onPointerEnter={(event) => {
                event.currentTarget.focus()
                setSub(entry.type === 'submenu' ? { id: entry.id, edge: null } : null)
              }}
              onClick={() => {
                if (entry.disabled) return
                if (entry.type === 'submenu') return setSub({ id: entry.id, edge: 'first' })
                if (entry.type === 'checkbox') entry.onCheckedChange(!entry.checked)
                else entry.onSelect?.()
                onDone()
              }}
              className={ITEM}
            >
              {content}
            </button>
            {open && entry.type === 'submenu' && (
              <MenubarPanel
                nested
                entries={entry.items}
                labelledBy={id}
                edge={sub.edge}
                onAcross={onAcross}
                onDone={onDone}
                onBack={() => {
                  setSub(null)
                  document.getElementById(id)?.focus()
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The File / Edit / View bar of a desktop application, for web apps that are
 * one — editors, design tools, consoles.
 *
 * It follows the WAI-ARIA menubar pattern closely, because people who use one
 * bring years of muscle memory from their operating system. The bar is a single
 * tab stop; Left and Right move along it; Down, Enter or Space opens a menu at
 * its first item and Up at its last. Once a menu is open, Left and Right move
 * to the neighbouring menu and open it, and pointing at another title switches
 * menus without a second click. Right opens a submenu and Left closes it.
 * Escape closes one level and returns focus to what opened it.
 *
 * Checkable items are `menuitemcheckbox` with `aria-checked`, so "Show ruler,
 * checked" is announced rather than a tick nobody can see.
 *
 * It does not reuse Menu: Menu is a single popover with a flat item list, and a
 * menubar needs focus to cross between sibling menus and into nested ones.
 */
export function Menubar({ menus, label, className }: MenubarProps) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState<{ index: number; edge: MenubarEdge } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const move = (index: number, keepOpen: boolean) => {
    const next = (index + menus.length) % menus.length
    setActive(next)
    if (keepOpen) setOpen({ index: next, edge: 'first' })
    else triggers.current[next]?.focus()
  }

  const close = () => {
    const index = open?.index ?? active
    setOpen(null)
    triggers.current[index]?.focus()
  }

  const onTriggerKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(index + 1, false),
      ArrowLeft: () => move(index - 1, false),
      Home: () => move(0, false),
      End: () => move(menus.length - 1, false),
      ArrowDown: () => setOpen({ index, edge: 'first' }),
      Enter: () => setOpen({ index, edge: 'first' }),
      ' ': () => setOpen({ index, edge: 'first' }),
      ArrowUp: () => setOpen({ index, edge: 'last' }),
    }
    const handler = keys[event.key]
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      return close()
    }
    if (!handler) return
    event.preventDefault()
    handler()
  }

  return (
    <div
      ref={rootRef}
      role="menubar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn('relative flex items-center gap-0.5 rounded-full bg-surface-muted p-0.5', className)}
    >
      {menus.map((menu, index) => {
        const id = `${baseId}-${menu.id}`
        const isOpen = open?.index === index
        return (
          <div key={menu.id} role="none" className="relative">
            <button
              ref={(node) => {
                triggers.current[index] = node
              }}
              id={id}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => onTriggerKeyDown(event, index)}
              onClick={() => {
                setActive(index)
                setOpen(isOpen ? null : { index, edge: null })
              }}
              onPointerEnter={() => {
                if (!open || isOpen) return
                setActive(index)
                setOpen({ index, edge: null })
                triggers.current[index]?.focus()
              }}
              className={cn(
                'inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold leading-none transition-colors',
                isOpen ? 'bg-surface text-ink shadow-[var(--shadow-tile)]' : 'text-ink-soft hover:bg-surface hover:text-ink',
              )}
            >
              {menu.label}
            </button>
            {isOpen && (
              <MenubarPanel
                key={menu.id}
                entries={menu.items}
                labelledBy={id}
                edge={open.edge}
                onBack={close}
                onDone={close}
                onAcross={(step) => move(index + step, true)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
