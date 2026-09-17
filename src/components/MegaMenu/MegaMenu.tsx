'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { ChevronDownIcon } from '../internal/icons'

export interface MegaMenuLink {
  label: string
  href: string
  /** One line under the label saying what is behind it. */
  description?: string
  icon?: IconComponent
  /** Small marker after the label — "New". */
  badge?: ReactNode
}

export interface MegaMenuGroup {
  heading: string
  links: MegaMenuLink[]
}

export interface MegaMenuSection {
  id: string
  /** The word on the bar. */
  label: string
  /** A section with no groups is a plain link. */
  href?: string
  groups?: MegaMenuGroup[]
  /** A strip along the bottom of the panel — a featured post, "See all". */
  footer?: ReactNode
}

export interface MegaMenuProps {
  sections: MegaMenuSection[]
  /** Accessible name for the navigation landmark. */
  label: string
  /** Milliseconds the pointer must rest on a trigger before its panel opens. */
  openDelay?: number
  /** Milliseconds of grace after the pointer leaves before the panel closes. */
  closeDelay?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Top-level site navigation whose sections open into wide panels of grouped,
 * described links — the Products / Solutions / Resources bar on a marketing site.
 *
 * It is a disclosure, not a menu. The panels hold ordinary links that Tab walks
 * through in order, and each trigger is a button reporting `aria-expanded`.
 * The ARIA menu roles would announce "menu" and switch a screen reader into a
 * mode where Tab no longer reaches the links, which is wrong for navigation.
 *
 * Hover opens a panel only after the pointer has rested for `openDelay`, so
 * sweeping across the bar on the way to something else does not flash every
 * panel, and leaving it has a `closeDelay` of grace so a diagonal move from
 * trigger to panel does not drop it. Click and keyboard ignore both delays.
 * Only one panel is open at a time; Escape closes it and puts focus back on its
 * trigger, and focus leaving the navigation closes it too.
 */
export function MegaMenu({ sections, label, openDelay = 150, closeDelay = 200, className }: MegaMenuProps) {
  const [open, setOpen] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({})
  const baseId = useId()

  const schedule = (next: string | null, delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), delay)
  }
  const now = (next: string | null) => {
    window.clearTimeout(timer.current)
    setOpen(next)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      const trigger = triggers.current[open]
      const hadFocus = navRef.current?.contains(document.activeElement)
      now(null)
      if (hadFocus) trigger?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) now(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const onTriggerKeyDown = (event: KeyboardEvent, section: MegaMenuSection, panelId: string) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    now(section.id)
    requestAnimationFrame(() => document.getElementById(panelId)?.querySelector<HTMLElement>('a')?.focus())
  }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn('relative', className)}
      onBlur={(event) => {
        if (open && !navRef.current?.contains(event.relatedTarget as Node | null)) now(null)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' && open) schedule(null, closeDelay)
      }}
    >
      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {sections.map((section) => {
          const panelId = `${baseId}-${section.id}`
          const isOpen = open === section.id
          const itemClass = cn(
            'inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold leading-none transition-colors',
            isOpen ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
          )

          if (!section.groups?.length) {
            return (
              <li key={section.id}>
                <a href={section.href ?? '#'} className={itemClass}>
                  {section.label}
                </a>
              </li>
            )
          }

          return (
            <li
              key={section.id}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse') return
                // Moving between triggers while a panel is up swaps at once;
                // only the first open waits for intent.
                if (open && open !== section.id) schedule(section.id, 60)
                else schedule(section.id, open === section.id ? 0 : openDelay)
              }}
            >
              <button
                ref={(node) => {
                  triggers.current[section.id] = node
                }}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => now(isOpen ? null : section.id)}
                onKeyDown={(event) => onTriggerKeyDown(event, section, panelId)}
                className={itemClass}
              >
                {section.label}
                <ChevronDownIcon
                  size={13}
                  aria-hidden="true"
                  className={cn('text-ink-faint transition-transform duration-150 motion-reduce:transition-none', isOpen && 'rotate-180')}
                />
              </button>
              <div
                id={panelId}
                hidden={!isOpen}
                className="absolute left-0 right-0 top-full z-[var(--z-popover)] pt-2"
              >
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-float)]">
                  <div
                    className="grid gap-6 p-5"
                    style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}
                  >
                    {section.groups.map((group) => {
                      const headingId = `${panelId}-${group.heading.replace(/\W+/g, '-')}`
                      return (
                        <div key={group.heading} className="flex flex-col gap-2">
                          <p id={headingId} className="m-0 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                            {group.heading}
                          </p>
                          <ul aria-labelledby={headingId} className="m-0 flex list-none flex-col gap-0.5 p-0">
                            {group.links.map((link) => {
                              const Icon = link.icon
                              return (
                                <li key={link.href + link.label}>
                                  <a
                                    href={link.href}
                                    onClick={() => now(null)}
                                    className="flex items-start gap-3 rounded-[var(--radius-tile)] p-2 transition-colors hover:bg-surface-muted"
                                  >
                                    {Icon && (
                                      <span
                                        aria-hidden="true"
                                        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-glyph)] bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-ink"
                                      >
                                        <Icon size={17} strokeWidth={2} aria-hidden="true" />
                                      </span>
                                    )}
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                                        {link.label}
                                        {link.badge}
                                      </span>
                                      {link.description && (
                                        <span className="text-[12px] font-medium leading-snug text-ink-soft">{link.description}</span>
                                      )}
                                    </span>
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                  {section.footer && <div className="border-t border-line bg-surface-muted px-5 py-3">{section.footer}</div>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
