'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { CheckIcon, ChevronDownIcon } from '../internal/icons'

export type VersionSwitcherStatus = 'latest' | 'prerelease' | 'deprecated'

export interface VersionSwitcherVersion {
  /** Identifier passed to `onValueChange` — usually the version string. */
  value: string
  /** What the reader sees — "v3.2". */
  label: string
  /** Marks the current release, a preview, or a line that no longer gets fixes. */
  status?: VersionSwitcherStatus
  /** A short note beside the label — a release date, "LTS". */
  hint?: string
}

const TAG: Record<VersionSwitcherStatus, string> = {
  latest: 'Latest',
  prerelease: 'Pre-release',
  deprecated: 'Deprecated',
}

function StatusTag({ status }: { status?: VersionSwitcherStatus }) {
  if (!status) return null
  return (
    <Badge tone={status === 'latest' ? 'accent' : 'neutral'} className="shrink-0">
      {TAG[status]}
    </Badge>
  )
}

export interface VersionSwitcherProps {
  /** Every published version, newest first. */
  versions: VersionSwitcherVersion[]
  /** The version being read, when controlled. */
  value?: string
  /** The starting version, when uncontrolled. Defaults to the one marked latest. */
  defaultValue?: string
  /** Called with the chosen version — navigate to its docs here. */
  onValueChange?: (value: string) => void
  /** Accessible name for the trigger and the list. */
  label?: string
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the trigger. */
  className?: string
}

const latestOf = (versions: VersionSwitcherVersion[]) =>
  versions.find((version) => version.status === 'latest') ?? versions[0]

/**
 * Picks which version of the docs to read.
 *
 * Readers land on old docs from search results all the time, and the only
 * clue is usually a number they do not know is old. So the status travels
 * with every version — Latest in the accent, Pre-release and Deprecated as
 * neutral tags — in the list and in the trigger. Pair it with
 * VersionSwitcherNotice at the top of the page, which says in a sentence that
 * this is not the current version and links to the one that is.
 *
 * The list is a listbox with Select's keyboard model: arrows, Home, End,
 * Enter, and Escape back to the trigger.
 */
export function VersionSwitcher({
  versions,
  value: controlled,
  defaultValue,
  onValueChange,
  label = 'Documentation version',
  placement = 'bottom',
  align = 'start',
  className,
}: VersionSwitcherProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? latestOf(versions)?.value)
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const value = controlled ?? uncontrolled
  const current = versions.find((version) => version.value === value)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      ;(list?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const choose = (next: string) => {
    if (controlled === undefined) setUncontrolled(next)
    onValueChange?.(next)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    const target =
      event.key === 'ArrowDown'
        ? nodes[(index + 1) % nodes.length]
        : event.key === 'ArrowUp'
          ? nodes[(index - 1 + nodes.length) % nodes.length]
          : event.key === 'Home'
            ? nodes[0]
            : event.key === 'End'
              ? nodes[nodes.length - 1]
              : null
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      label={label}
      className="max-h-[320px] w-[240px] overflow-y-auto p-1"
      trigger={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-2 text-[12px] font-bold leading-none text-ink transition-colors hover:border-line-strong',
            className,
          )}
        >
          <span className="sr-only">{label}: </span>
          <span className="tabular-nums">{current?.label}</span>
          <StatusTag status={current?.status} />
          <ChevronDownIcon size={14} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      <div ref={listRef} role="listbox" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col">
        {versions.map((version) => {
          const selected = version.value === value
          return (
            <button
              key={version.value}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={selected}
              onClick={() => choose(version.value)}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-10)] px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                selected ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              )}
            >
              <span className={cn('tabular-nums', version.status === 'deprecated' && 'text-ink-faint')}>{version.label}</span>
              <StatusTag status={version.status} />
              {version.hint && <span className="ml-auto truncate text-[11px] font-medium text-ink-faint">{version.hint}</span>}
              <span className={cn('flex size-3.5 shrink-0', !version.hint && 'ml-auto')}>
                {selected && <CheckIcon size={14} className="text-ink" />}
              </span>
            </button>
          )
        })}
      </div>
    </Popover>
  )
}

export interface VersionSwitcherNoticeProps {
  /** The same list the switcher uses. */
  versions: VersionSwitcherVersion[]
  /** The version being read. Nothing renders when it is the latest. */
  value: string
  /** Where the latest docs live — the same page in the latest version, where it exists. */
  latestHref: string
  /** Replaces the default sentence. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The sentence at the top of an old page: which version this is, and a link to
 * the current one. It renders nothing on the latest version, so it can sit in
 * the docs layout unconditionally.
 */
export function VersionSwitcherNotice({ versions, value, latestHref, children, className }: VersionSwitcherNoticeProps) {
  const latest = latestOf(versions)
  const current = versions.find((version) => version.value === value)
  if (!current || !latest || current.value === latest.value) return null

  const sentence =
    current.status === 'prerelease'
      ? `You’re reading the docs for ${current.label}, a pre-release. Details may change before it ships.`
      : current.status === 'deprecated'
        ? `You’re reading the docs for ${current.label}, which is deprecated and no longer receives fixes.`
        : `You’re reading the docs for ${current.label}, which is not the latest version.`

  return (
    <div
      role="note"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-tile)] border border-line bg-surface-sunken px-3.5 py-2.5 text-[12px] font-medium text-ink-soft',
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children ?? sentence}</span>
      <a
        href={latestHref}
        className="shrink-0 font-bold text-ink underline decoration-[color-mix(in_oklab,var(--color-accent)_70%,var(--color-ink))] decoration-2 underline-offset-2 hover:decoration-ink"
      >
        Go to {latest.label} (latest)
      </a>
    </div>
  )
}
