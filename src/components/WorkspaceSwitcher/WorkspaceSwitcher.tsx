'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Divider } from '../Divider'
import { Text } from '../Text'
import { Popover } from '../Popover'
import { SearchField } from '../SearchField'
import { CheckIcon, PlusIcon, SelectorIcon } from '../internal/icons'
import { useRovingFocus } from '../../lib/roving'

export interface Workspace {
  id: string
  name: string
  /** "Pro", "Free trial". */
  plan?: string
  /** Logo. Falls back to the first letter on the accent. */
  logo?: ReactNode
}

export interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  value: string
  onValueChange: (id: string) => void
  onCreate?: () => void
  createLabel?: string
  /** Accessible name for the list. */
  label?: string
  /** Show a search field once there are more than this many. */
  searchThreshold?: number
  /** Stretch the trigger to its container — the top of a sidebar. */
  fullWidth?: boolean
  className?: string
}

function WorkspaceMark({ workspace, size = 28 }: { workspace: Workspace; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-8)] bg-accent text-[12px] font-extrabold text-accent-ink [&_img]:size-full [&_img]:object-cover [&_svg]:size-[60%]"
      style={{ width: size, height: size }}
    >
      {workspace.logo ?? workspace.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Switch between the organisations, teams or projects one account belongs to —
 * the control at the top of every multi-tenant sidebar.
 *
 * A listbox in a popover, not a menu: it has a current value and choosing one
 * changes it. Arrow keys move, Enter chooses, Escape returns focus to the
 * trigger, and past a handful of workspaces a search appears, because an agency
 * with forty clients scrolls a list exactly once before asking for one.
 */
export function WorkspaceSwitcher({
  workspaces,
  value,
  onValueChange,
  onCreate,
  createLabel = 'Create workspace',
  label = 'Workspaces',
  searchThreshold = 6,
  fullWidth = false,
  className,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const current = workspaces.find((workspace) => workspace.id === value) ?? workspaces[0]
  const searchable = workspaces.length > searchThreshold

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(needle)) : workspaces
  }, [query, workspaces])

  const roving = useRovingFocus(visible.length)

  useEffect(() => {
    if (!open) return
    setQuery('')
    const selected = Math.max(0, workspaces.findIndex((workspace) => workspace.id === value))
    roving.setActive(selected)
    // Portal mounts synchronously, so the options exist by the time this runs.
    // No animation frame: a frame never arrives in a tab that is not painting,
    // and focus would silently stay on the trigger.
    if (searchable) searchRef.current?.focus({ preventScroll: true })
    else roving.focus(selected)
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (id: string) => {
    if (id !== value) onValueChange(id)
    close(true)
  }

  if (!current) return null

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close(true))}
      label={label}
      className="w-[min(300px,calc(100vw-24px))] p-1.5"
      trigger={
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'flex h-12 min-w-0 items-center gap-2.5 rounded-[var(--radius-tile)] border border-line bg-surface pl-2 pr-2.5 text-left shadow-[var(--shadow-tile)] transition-colors hover:border-line-strong',
            fullWidth && 'w-full',
            className,
          )}
        >
          <WorkspaceMark workspace={current} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Text as="span" size="body" truncate>
              {current.name}
            </Text>
            {current.plan && (
              <Text as="span" size="caption" tone="faint" truncate>
                {current.plan}
              </Text>
            )}
          </span>
          <SelectorIcon size={14} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        {searchable && (
          <SearchField
            ref={searchRef}
            value={query}
            onValueChange={setQuery}
            label="Find a workspace"
            placeholder="Find a workspace"
            inputSize="sm"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                roving.focus(0)
              }
            }}
          />
        )}

        <Text size="caption" weight="bold" tone="faint" className="px-2 pb-0.5 pt-1.5 uppercase tracking-wider">
          {label}
        </Text>

        {visible.length === 0 ? (
          <Text size="caption" tone="faint" className="px-2 py-2">
            No workspace matches “{query}”.
          </Text>
        ) : (
          <ul role="listbox" aria-label={label} onKeyDown={roving.onKeyDown} className="flex max-h-[280px] flex-col overflow-y-auto">
            {visible.map((workspace, index) => {
              const selected = workspace.id === value
              return (
                <li
                  key={workspace.id}
                  ref={roving.register(index)}
                  role="option"
                  aria-selected={selected}
                  tabIndex={index === roving.active ? 0 : -1}
                  onClick={() => choose(workspace.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose(workspace.id)
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-10)] px-2 py-1.5 outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
                >
                  <WorkspaceMark workspace={workspace} size={24} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Text as="span" size="label" weight="semibold" truncate>
                      {workspace.name}
                    </Text>
                    {workspace.plan && (
                      <Text as="span" size="micro" weight="semibold" tone="faint">
                        {workspace.plan}
                      </Text>
                    )}
                  </span>
                  {selected && <CheckIcon size={14} className="shrink-0 text-ink" />}
                </li>
              )
            })}
          </ul>
        )}

        {onCreate && (
          <>
            <Divider className="my-1" />
            <button
              type="button"
              onClick={() => {
                close(false)
                onCreate()
              }}
              className="flex items-center gap-2.5 rounded-[var(--radius-10)] px-2 py-2 text-left text-[12px] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <span className="inline-flex size-6 items-center justify-center rounded-[var(--radius-8)] border border-dashed border-line-strong">
                <PlusIcon size={12} />
              </span>
              {createLabel}
            </button>
          </>
        )}
      </div>
    </Popover>
  )
}
