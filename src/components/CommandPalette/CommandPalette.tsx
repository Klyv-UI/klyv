'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Input } from '../Input'
import { Kbd } from '../Kbd'
import { Text } from '../Text'
import { EmptyState } from '../EmptyState'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import { Spinner } from '../Spinner'
import { SearchIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface Command {
  id: string
  label: string
  /** A second line under the label — where it lives, or what it does. */
  description?: string
  /** Group heading this command appears under. */
  group?: string
  icon?: IconComponent
  /** Extra terms that should match this command. */
  keywords?: string[]
  /** Shortcut hint, e.g. ['⌘', 'K']. */
  shortcut?: string[]
  /** Leave the palette open after running — for a command that changes the palette itself, like a recent search. */
  keepOpen?: boolean
  onSelect: () => void
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Command[]
  /**
   * Replace the built-in matching. Receives every command and the raw query,
   * and returns the ones to show in the order to show them; groups appear in
   * the order their first command does.
   */
  filter?: (commands: Command[], query: string) => Command[]
  /** Control the query from outside. Leave unset and the palette keeps its own. */
  query?: string
  onQueryChange?: (query: string) => void
  /** The commands are still arriving. Shown in place of the empty state. */
  loading?: boolean
  /** Placeholder for the search field. */
  placeholder?: string
  /** Accessible name for the dialog. */
  label?: string
  /** Shown when nothing matches. */
  emptyMessage?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Keyboard-first command launcher.
 *
 * Matching is a plain case-insensitive substring over the label, group and
 * keywords — predictable enough that a user learns which prefix reaches which
 * command, which is the whole value of a palette. A caller with a larger or
 * messier index can pass its own `filter` to rank instead.
 *
 * Focus stays in the input while arrows move the active row, tracked with
 * aria-activedescendant, so typing never has to stop to navigate.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  filter,
  query: controlledQuery,
  onQueryChange,
  loading = false,
  placeholder = 'Search commands',
  label = 'Command palette',
  emptyMessage = 'No commands match',
  className,
}: CommandPaletteProps) {
  const [ownQuery, setOwnQuery] = useState('')
  const query = controlledQuery ?? ownQuery
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const onQueryChangeRef = useRef(onQueryChange)
  onQueryChangeRef.current = onQueryChange
  const setQuery = (next: string) => {
    if (controlledQuery === undefined) setOwnQuery(next)
    onQueryChangeRef.current?.(next)
  }

  const filtered = useMemo(() => {
    if (filter) return filter(commands, query)
    const normalised = query.trim().toLowerCase()
    if (!normalised) return commands
    return commands.filter((command) =>
      [command.label, command.group ?? '', ...(command.keywords ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalised),
    )
  }, [commands, query, filter])

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const command of filtered) {
      const key = command.group ?? 'Commands'
      const bucket = map.get(key)
      if (bucket) bucket.push(command)
      else map.set(key, [command])
    }
    return [...map.entries()]
  }, [filtered])

  const flat = groups.flatMap(([, entries]) => entries)

  useEffect(() => setActive(0), [query, open])

  // A closed palette starts empty next time.
  useEffect(() => {
    if (open) return
    setOwnQuery('')
    onQueryChangeRef.current?.('')
  }, [open])

  // Scroll lock, Escape and the layer come from the shared stack.
  const { zIndex } = useOverlayLayer({ open, onDismiss: onClose })
  const listId = useId()

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (command: Command) => {
    command.onSelect()
    if (!command.keepOpen) onClose()
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((previous) => (previous + step + flat.length) % Math.max(1, flat.length))
    } else if (event.key === 'Enter' && flat[active]) {
      event.preventDefault()
      run(flat[active])
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(Math.max(0, flat.length - 1))
    }
  }

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[12vh]" style={{ zIndex }}>
        <button
          type="button"
          aria-label="Close command palette"
          tabIndex={-1}
          onClick={onClose}
          className="fixed inset-0 cursor-default bg-scrim"
        />
        <FocusTrap className="relative w-full max-w-[520px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cn(
              'flex max-h-[60dvh] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line',
              'bg-surface shadow-[var(--shadow-window)]',
              className,
            )}
          >
            <div className="border-b border-line p-2">
              <Input
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={flat[active] ? `command-${flat[active].id}` : undefined}
                aria-label={placeholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                leading={<SearchIcon size={15} />}
                trailing={<Kbd>Esc</Kbd>}
              />
            </div>

            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-busy={loading || undefined}
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {groups.map(([group, entries]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <Text size="caption" weight="bold" tone="faint" className="px-2 py-1 uppercase tracking-wider">
                    {group}
                  </Text>
                  {entries.map((command) => {
                    const index = flat.indexOf(command)
                    const isActive = index === active
                    const Icon = command.icon
                    return (
                      <div
                        key={command.id}
                        id={`command-${command.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onPointerEnter={() => setActive(index)}
                        onClick={() => run(command)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-10)] px-2.5 py-2 transition-colors',
                          isActive ? 'bg-surface-muted' : '',
                        )}
                      >
                        {Icon && (
                          <Icon size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-soft" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Text as="span" size="body" weight="semibold" tone={isActive ? 'default' : 'soft'} truncate>
                            {command.label}
                          </Text>
                          {command.description && (
                            <Text as="span" size="caption" tone="faint" truncate>
                              {command.description}
                            </Text>
                          )}
                        </span>
                        {command.shortcut && (
                          <span className="flex shrink-0 gap-1">
                            {command.shortcut.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              {flat.length === 0 &&
                (loading ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Spinner size="sm" label="Loading" />
                    <Text as="span" size="caption" tone="faint" aria-hidden="true">
                      Loading…
                    </Text>
                  </div>
                ) : (
                  <EmptyState size="sm" title={emptyMessage} description={`Nothing matches “${query}”.`} />
                ))}
            </div>

            <div className="flex items-center gap-3 border-t border-line px-3 py-2">
              <Hint keys={['↑', '↓']} label="Navigate" />
              <Hint keys={['↵']} label="Run" />
              <Hint keys={['Esc']} label="Close" />
            </div>
          </div>
        </FocusTrap>
      </div>
    </Portal>
  )
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <Text as="span" size="caption" tone="faint">
        {label}
      </Text>
    </span>
  )
}
