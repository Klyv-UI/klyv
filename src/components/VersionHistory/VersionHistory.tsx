'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { ConfirmPopover } from '../ConfirmPopover'
import { Switch } from '../Switch'
import { Text } from '../Text'

export interface VersionHistoryVersion {
  id: string
  createdAt: Date
  author: { name: string; avatarSrc?: string }
  /** A name someone gave this version — “Sent to legal”. Unnamed versions are autosaves. */
  name?: string
  /** What changed, in a few words. */
  summary?: string
}

export interface VersionHistoryProps {
  /** Every version, in any order. The newest is treated as the current one. */
  versions: VersionHistoryVersion[]
  /** Selected version id (controlled). Selecting is previewing. */
  value?: string
  /** Initially selected version id when uncontrolled. Defaults to the current version. */
  defaultValue?: string
  /** Called when a version is selected — load its preview here. */
  onValueChange?: (id: string) => void
  /** Whether the preview shows changes against the current version (controlled). */
  compare?: boolean
  /** Initial compare state when uncontrolled. */
  defaultCompare?: boolean
  onCompareChange?: (compare: boolean) => void
  /** Restore a version. Return a promise to hold the confirmation open until it settles. */
  onRestore: (id: string) => void | Promise<void>
  /** Start with only named versions shown. */
  defaultNamedOnly?: boolean
  /** Today, for the Today and Yesterday headings. */
  now?: Date
  /** Merged last, so it wins. */
  className?: string
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

function dayLabel(date: Date, now: Date) {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(now)) return 'Today'
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday'
  return formatDate(date, date.getFullYear() !== now.getFullYear())
}

const timeOf = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const describe = (version: VersionHistoryVersion) =>
  version.name ? `“${version.name}”` : `the ${timeOf(version.createdAt)} version`

/**
 * A document’s past, grouped by day, with a way back.
 *
 * Selecting a version is previewing it, and nothing more — the list reports the
 * id and the caller loads the preview, so browsing history can never change
 * the document. Restoring is a separate, confirmed step, and the confirmation
 * says that the current state is kept as a version, because “restore” sounds
 * destructive and people hesitate over it.
 *
 * Long histories are mostly autosaves. The named-only switch cuts the list to
 * the versions someone chose to mark, which is usually what is being looked
 * for. Up and Down move through the versions, Home and End jump to the ends.
 */
export function VersionHistory({
  versions,
  value,
  defaultValue,
  onValueChange,
  compare: controlledCompare,
  defaultCompare = false,
  onCompareChange,
  onRestore,
  defaultNamedOnly = false,
  now = new Date(),
  className,
}: VersionHistoryProps) {
  const namedId = useId()
  const compareId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const sorted = [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const currentId = sorted[0]?.id

  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? currentId)
  const selected = value ?? uncontrolled
  const [uncontrolledCompare, setUncontrolledCompare] = useState(defaultCompare)
  const compare = controlledCompare ?? uncontrolledCompare
  const [namedOnly, setNamedOnly] = useState(defaultNamedOnly)

  const select = (id: string) => {
    if (value === undefined) setUncontrolled(id)
    onValueChange?.(id)
  }
  const setCompare = (next: boolean) => {
    if (controlledCompare === undefined) setUncontrolledCompare(next)
    onCompareChange?.(next)
  }

  const visible = sorted.filter((version) => !namedOnly || version.name || version.id === currentId)
  const groups: { key: string; label: string; items: VersionHistoryVersion[] }[] = []
  for (const version of visible) {
    const key = dayKey(version.createdAt)
    const group = groups[groups.length - 1]
    if (group?.key === key) group.items.push(version)
    else groups.push({ key, label: dayLabel(version.createdAt, now), items: [version] })
  }

  const chosen = sorted.find((version) => version.id === selected)
  const isCurrent = selected === currentId
  // One tab stop for the list: the selected version, or the first shown when the filter hides it.
  const tabStop = visible.some((version) => version.id === selected) ? selected : visible[0]?.id

  const onKeyDown = (event: KeyboardEvent) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-version]') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : index + (event.key === 'ArrowDown' ? 1 : -1)
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, next))]
    target?.focus()
    if (target?.dataset.version) select(target.dataset.version)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <Text as="h3" size="heading">
          Version history
        </Text>
        <label
          htmlFor={namedId}
          className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-soft"
        >
          Only named versions
          <Switch
            id={namedId}
            switchSize="sm"
            checked={namedOnly}
            onChange={(event) => setNamedOnly(event.target.checked)}
          />
        </label>
      </div>

      <div ref={listRef} onKeyDown={onKeyDown} className="flex flex-col gap-3">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
            <Text as="h4" size="caption" weight="bold" tone="faint" className="px-2 uppercase tracking-wider">
              {group.label}
            </Text>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((version) => {
                const active = version.id === selected
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      data-version={version.id}
                      aria-pressed={active}
                      tabIndex={version.id === tabStop ? 0 : -1}
                      onClick={() => select(version.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-[var(--radius-field)] px-2 py-2 text-left transition-colors',
                        active ? 'bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)]' : 'hover:bg-surface-muted',
                      )}
                    >
                      <span aria-hidden="true" className="mt-0.5 flex">
                        <Avatar name={version.author.name} src={version.author.avatarSrc} size="xs" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-bold text-ink">
                          {version.name ?? timeOf(version.createdAt)}
                          {version.id === currentId && (
                            <span className="text-[11px] font-semibold text-ink-faint">Current version</span>
                          )}
                        </span>
                        <span className="truncate text-[11px] font-medium text-ink-faint">
                          {version.name ? `${timeOf(version.createdAt)} · ` : ''}
                          {version.author.name}
                          {version.summary ? ` · ${version.summary}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <label
          htmlFor={compareId}
          className={cn(
            'flex items-center gap-2 text-[12px] font-semibold text-ink-soft',
            isCurrent ? 'opacity-50' : 'cursor-pointer',
          )}
        >
          <Switch
            id={compareId}
            switchSize="sm"
            checked={compare && !isCurrent}
            disabled={isCurrent}
            onChange={(event) => setCompare(event.target.checked)}
          />
          Compare with current
        </label>
        <div className="ml-auto">
          {chosen && !isCurrent ? (
            <ConfirmPopover
              title="Restore this version?"
              description={`The document goes back to ${describe(chosen)}. What is there now is kept in the history.`}
              confirmLabel="Restore"
              align="end"
              placement="top"
              onConfirm={() => onRestore(chosen.id)}
              trigger={<Button size="sm">Restore this version</Button>}
            />
          ) : (
            <Text as="span" size="caption" tone="faint">
              Select an earlier version to restore it
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}
