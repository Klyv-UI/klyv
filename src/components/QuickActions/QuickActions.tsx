'use client'

import { useEffect } from 'react'
import { cn } from '../../lib/cn'
import { Kbd } from '../Kbd'
import { Text } from '../Text'
import { PressScale } from '../PressScale'
import { Ripple } from '../Ripple'
import { Tooltip } from '../Tooltip'
import type { IconComponent } from '../../lib/types'

export interface QuickAction {
  id: string
  label: string
  icon: IconComponent
  /** Marks the primary action. Exactly one, or none. */
  primary?: boolean
  /** Single character. Pressing it with the modifier runs the action. */
  shortcut?: string
  /** Longer description, shown as a tooltip. */
  hint?: string
  disabled?: boolean
  onSelect: () => void
}

export interface QuickActionsProps {
  actions: QuickAction[]
  /** Accessible name for the group. */
  label?: string
  /** Register the shortcuts on the document. */
  shortcuts?: boolean
  /** Modifier the shortcuts require. */
  modifier?: 'meta' | 'alt' | 'none'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The icon-over-label action row from the balance card, generalised.
 *
 * The dashboard repeats this shape wherever a surface has three or four primary
 * verbs, and it is the one row a user hits most often — so it gets the
 * accelerators the rest of the library does not: optional keyboard shortcuts
 * bound while it is mounted, with the key shown on the control rather than
 * hidden in a help page.
 *
 * Ripple and PressScale give it touch feedback without touching the button
 * underneath, which keeps its focus ring and semantics intact.
 */
export function QuickActions({
  actions,
  label = 'Quick actions',
  shortcuts = false,
  modifier = 'meta',
  className,
}: QuickActionsProps) {
  useEffect(() => {
    if (!shortcuts) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      const held =
        modifier === 'none' ||
        (modifier === 'meta' && (event.metaKey || event.ctrlKey)) ||
        (modifier === 'alt' && event.altKey)
      if (!held) return

      const match = actions.find(
        (action) => !action.disabled && action.shortcut?.toLowerCase() === event.key.toLowerCase(),
      )
      if (!match) return
      event.preventDefault()
      match.onSelect()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [actions, shortcuts, modifier])

  const modifierGlyph = modifier === 'meta' ? '⌘' : modifier === 'alt' ? '⌥' : ''

  return (
    <ul role="list" aria-label={label} className={cn('flex items-start justify-between gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon
        const control = (
          <PressScale disabled={action.disabled} className="w-full">
            <Ripple
              disabled={action.disabled}
              color={action.primary ? 'rgba(22, 32, 12, 0.14)' : undefined}
              className="w-full rounded-[var(--radius-tile)]"
            >
              <button
                type="button"
                disabled={action.disabled}
                onClick={action.onSelect}
                aria-keyshortcuts={
                  shortcuts && action.shortcut
                    ? `${modifier === 'meta' ? 'Meta+' : modifier === 'alt' ? 'Alt+' : ''}${action.shortcut.toUpperCase()}`
                    : undefined
                }
                className={cn(
                  'flex h-11 w-full items-center justify-center rounded-[var(--radius-tile)] transition-colors',
                  'disabled:pointer-events-none disabled:opacity-40',
                  action.primary
                    ? 'bg-accent text-accent-ink hover:bg-accent-strong'
                    : 'bg-surface-muted text-ink hover:bg-line-strong',
                )}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">{action.label}</span>
              </button>
            </Ripple>
          </PressScale>
        )

        return (
          <li key={action.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {action.hint ? (
              <Tooltip content={action.hint} className="w-full">
                {control}
              </Tooltip>
            ) : (
              control
            )}
            <span className="flex items-center gap-1">
              <Text as="span" size="caption" weight="semibold" truncate>
                {action.label}
              </Text>
              {shortcuts && action.shortcut && (
                <Kbd>
                  {modifierGlyph}
                  {action.shortcut.toUpperCase()}
                </Kbd>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
