'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Popover } from '../Popover'
import { Spinner } from '../Spinner'
import { CheckIcon, ChevronRightIcon, SelectorIcon } from '../internal/icons'

export interface CascadeSelectOption {
  value: string
  label: string
  /** The next column. Leave undefined and pass `loadChildren` to fetch it on demand. */
  children?: CascadeSelectOption[]
  /** Marks a final choice, so no children are looked for. */
  isLeaf?: boolean
  disabled?: boolean
}

export interface CascadeSelectProps {
  /** The first column. */
  options: CascadeSelectOption[]
  /** Controlled path of values, first column first. */
  value?: string[]
  /** Starting path when uncontrolled. */
  defaultValue?: string[]
  /** Called with the chosen path and the options along it. */
  onValueChange?: (value: string[], options: CascadeSelectOption[]) => void
  /** Fetches the children of an option that has none yet. Resolve an empty array for a leaf. */
  loadChildren?: (option: CascadeSelectOption, path: string[]) => Promise<CascadeSelectOption[]>
  /** Accessible name for the trigger and the panel. */
  label: string
  /** Shown on the trigger while nothing is chosen. */
  placeholder?: string
  /** Placed between the labels of the path on the trigger. */
  separator?: string
  /** Let a choice stop part-way down — “all of California” — rather than only at a leaf. */
  allowParentSelection?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Marks the control as failing validation. */
  invalid?: boolean
  /** Goes on the trigger, so a Field label points at it. */
  id?: string
  /** Merged onto the trigger. */
  className?: string
}

/**
 * Picking a place in a hierarchy one level at a time — country, then region,
 * then city — with every level visible side by side.
 *
 * Three chained Selects make the reader open, choose and move on three times,
 * and reset silently when an earlier choice changes. Columns show the whole
 * path at once: pointing at an option opens the next column, Right steps into
 * it, Left steps back, and Enter on a final option chooses the path. Each
 * column is a listbox, so where the reader is and how deep they have gone is
 * announced rather than implied by position.
 *
 * Children can arrive later: pass `loadChildren` and a column shows a spinner
 * while it fetches, and each branch is only fetched once.
 */
export function CascadeSelect({
  options,
  value,
  defaultValue = [],
  onValueChange,
  loadChildren,
  label,
  placeholder = 'Choose…',
  separator = ' / ',
  allowParentSelection = false,
  disabled = false,
  invalid = false,
  id,
  className,
}: CascadeSelectProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selected = value ?? uncontrolled
  const [open, setOpen] = useState(false)
  // The highlighted chain while browsing. Starts from the chosen path.
  const [trail, setTrail] = useState<string[]>(selected)
  const [column, setColumn] = useState(0)
  const [loaded, setLoaded] = useState<Record<string, CascadeSelectOption[]>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  const keyOf = (path: string[]) => JSON.stringify(path)
  const childrenOf = (option: CascadeSelectOption, path: string[]) => option.children ?? loaded[keyOf(path)]
  const isLeaf = (option: CascadeSelectOption, path: string[]) => {
    if (option.isLeaf) return true
    const children = childrenOf(option, path)
    return children ? children.length === 0 : !loadChildren
  }

  // Resolve the trail into columns: each chosen option opens the next list.
  const columns: { options: CascadeSelectOption[]; path: string[] }[] = [{ options, path: [] }]
  const along: CascadeSelectOption[] = []
  for (let depth = 0; depth < trail.length; depth += 1) {
    const option = columns[depth]?.options.find((candidate) => candidate.value === trail[depth])
    if (!option) break
    along.push(option)
    const path = trail.slice(0, depth + 1)
    const children = childrenOf(option, path)
    if (children?.length) columns.push({ options: children, path })
    else break
  }

  const request = (option: CascadeSelectOption, path: string[]) => {
    const key = keyOf(path)
    if (!loadChildren || option.isLeaf || option.children || loaded[key] || loading === key) return
    setLoading(key)
    loadChildren(option, path)
      .then((children) => setLoaded((current) => ({ ...current, [key]: children })))
      .catch(() => setLoaded((current) => ({ ...current, [key]: [] })))
      .finally(() => setLoading((current) => (current === key ? null : current)))
  }

  // Keep the trigger text when options are async and not in memory: the labels
  // are remembered at the moment of choosing.
  const chosenLabels: string[] = []
  let level: CascadeSelectOption[] | undefined = options
  selected.forEach((part, index) => {
    const option: CascadeSelectOption | undefined = level?.find((candidate) => candidate.value === part)
    chosenLabels.push(option?.label ?? labels[index] ?? part)
    level = option && childrenOf(option, selected.slice(0, index + 1))
  })

  const highlight = (depth: number, option: CascadeSelectOption) => {
    const path = [...trail.slice(0, depth), option.value]
    setTrail(path)
    if (!option.disabled) request(option, path)
  }

  const commit = (path: string[], chain: CascadeSelectOption[]) => {
    if (value === undefined) setUncontrolled(path)
    setLabels(chain.map((option) => option.label))
    onValueChange?.(path, chain)
    setOpen(false)
  }

  const activate = (depth: number, option: CascadeSelectOption) => {
    if (option.disabled) return
    const path = [...trail.slice(0, depth), option.value]
    const chain = [...along.slice(0, depth), option]
    if (isLeaf(option, path) || allowParentSelection) {
      commit(path, chain)
      return
    }
    highlight(depth, option)
    setColumn(depth + 1)
  }

  // Opening starts browsing from the chosen path, in the same update as the
  // panel appears — an effect a render later lost a race with the first focus.
  const openPanel = (next: boolean) => {
    if (disabled) return
    if (next) {
      setTrail(selected)
      setColumn(Math.max(0, selected.length - 1))
    }
    setOpen(next)
  }

  // A column asked for before its children arrive waits; focus follows once they do.
  const focusColumn = Math.min(column, columns.length - 1)
  useEffect(() => {
    if (open) columnRefs.current[focusColumn]?.focus({ preventScroll: true })
  }, [open, focusColumn])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, depth: number) => {
    const list = columns[depth].options
    const index = list.findIndex((option) => option.value === trail[depth])
    const option = list[index]
    const moveTo = (next: number) => {
      const target = list[(next + list.length) % list.length]
      if (target) highlight(depth, target)
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveTo(index + 1),
      ArrowUp: () => moveTo(index < 0 ? list.length - 1 : index - 1),
      Home: () => moveTo(0),
      End: () => moveTo(list.length - 1),
      ArrowRight: () => {
        if (option && !option.disabled && !isLeaf(option, trail.slice(0, depth + 1))) setColumn(depth + 1)
      },
      ArrowLeft: () => depth > 0 && setColumn(depth - 1),
      Enter: () => option && activate(depth, option),
      ' ': () => option && activate(depth, option),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const loadingColumn = loading !== null && loading === keyOf(trail) && !columns.some((entry) => keyOf(entry.path) === loading)

  return (
    <Popover
      open={open}
      onOpenChange={openPanel}
      label={label}
      placement="bottom"
      align="start"
      className="max-w-[calc(100vw-24px)] overflow-x-auto p-0"
      trigger={
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${uid}-column-0` : undefined}
          aria-label={id ? undefined : label}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              openPanel(true)
            }
          }}
          className={cn(
            'flex h-10 w-full min-w-[220px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-left text-[13px] font-medium text-ink transition-colors',
            'hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40',
            invalid && 'border-danger',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', selected.length === 0 && 'text-ink-faint')}>
            {selected.length ? chosenLabels.join(separator) : placeholder}
          </span>
          <SelectorIcon size={14} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      <div className="flex divide-x divide-line">
        {columns.map((entry, depth) => {
          const active = entry.options.findIndex((option) => option.value === trail[depth])
          return (
            <div
              key={keyOf(entry.path) || 'root'}
              ref={(node) => {
                columnRefs.current[depth] = node
              }}
              role="listbox"
              id={`${uid}-column-${depth}`}
              tabIndex={depth === focusColumn ? 0 : -1}
              aria-label={depth === 0 ? label : along[depth - 1]?.label}
              aria-activedescendant={active >= 0 ? `${uid}-${depth}-${active}` : undefined}
              onKeyDown={(event) => onKeyDown(event, depth)}
              onFocus={() => setColumn(depth)}
              className="flex max-h-[260px] w-[180px] shrink-0 flex-col overflow-y-auto p-1 outline-none focus-visible:bg-surface-sunken"
            >
              {entry.options.map((option, index) => {
                const path = [...entry.path, option.value]
                const leaf = isLeaf(option, path)
                const inTrail = index === active
                const chosen = keyOf(path) === keyOf(selected.slice(0, path.length)) && selected.length === path.length
                return (
                  <div
                    key={option.value}
                    id={`${uid}-${depth}-${index}`}
                    role="option"
                    aria-selected={inTrail}
                    aria-disabled={option.disabled || undefined}
                    onMouseEnter={() => !option.disabled && !leaf && highlight(depth, option)}
                    onClick={() => {
                      setColumn(depth)
                      activate(depth, option)
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] font-semibold transition-colors',
                      inTrail ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
                      inTrail && depth === focusColumn && 'ring-1 ring-ink-faint',
                      option.disabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {chosen && <CheckIcon size={13} className="shrink-0" />}
                    {!leaf && <ChevronRightIcon size={13} className="shrink-0 text-ink-faint" />}
                  </div>
                )
              })}
            </div>
          )
        })}
        {loadingColumn && (
          <div role="status" className="flex w-[180px] shrink-0 items-center justify-center gap-2 p-4 text-[12px] font-medium text-ink-faint">
            <Spinner size="sm" />
            Loading…
          </div>
        )}
      </div>
    </Popover>
  )
}
