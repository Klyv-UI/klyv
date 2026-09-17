'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { ChevronDownIcon, ChevronUpIcon, CrossIcon, PlusIcon } from '../internal/icons'

export interface RepeaterFieldRowContext<T> {
  /** Position in the list, from 0. */
  index: number
  /** Merges a patch into this row. */
  update: (patch: Partial<T>) => void
  /** A stable prefix for ids inside the row, so labels keep pointing at the right input after a move. */
  idPrefix: string
}

export interface RepeaterFieldProps<T extends object> {
  /** Controlled rows. */
  value?: T[]
  /** Starting rows when uncontrolled. */
  defaultValue?: T[]
  /** Called with every row after each add, edit, move and removal. */
  onValueChange?: (rows: T[]) => void
  /** Builds the blank row that Add appends. */
  createRow: () => T
  /** Draws the fields of one row. */
  renderRow: (row: T, context: RepeaterFieldRowContext<T>) => ReactNode
  /** Legend for the whole list — “Contacts”. */
  label: string
  /** What one row is, in lower case — used in button names and announcements: “Remove contact 2”. */
  itemLabel?: string
  /** Fewest rows. Remove is disabled at this count. */
  min?: number
  /** Most rows. Add is disabled at this count. */
  max?: number
  /** Text on the add button. Defaults to “Add” and the item label. */
  addLabel?: string
  /** Show the move buttons. */
  reorderable?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A list of the same few fields, repeated as many times as the reader needs —
 * the contacts on an account, the line items on a quote, the redirect URIs of
 * an app.
 *
 * The hard part of these lists is not the adding; it is where focus goes. A
 * new row takes focus in its first field, so the reader types straight on. A
 * removed row hands focus to the row that took its place, or the one above, or
 * the Add button — never to the page body, which is where it lands when the
 * button that had it is deleted. Moving a row keeps focus on the button that
 * moved it. Each change is announced, because none of these is visible to
 * someone who cannot see the list re-order.
 *
 * Rows keep a stable key of their own, so an input’s half-typed state and its
 * label stay with the row as it moves.
 */
export function RepeaterField<T extends object>({
  value,
  defaultValue,
  onValueChange,
  createRow,
  renderRow,
  label,
  itemLabel = 'item',
  min = 0,
  max,
  addLabel,
  reorderable = true,
  disabled = false,
  className,
}: RepeaterFieldProps<T>) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState<T[]>(() => defaultValue ?? Array.from({ length: min }, createRow))
  const rows = value ?? uncontrolled
  const [announcement, setAnnouncement] = useState('')
  const rootRef = useRef<HTMLFieldSetElement>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)
  const keys = useRef<number[]>([])
  const pendingFocus = useRef<{ key: number; target: 'first' | 'up' | 'down' } | 'add' | null>(null)

  // Keys follow the rows. Operations below reorder them in step; a length
  // change from outside is padded or trimmed at the end.
  while (keys.current.length < rows.length) keys.current.push(nextKey.current++)
  if (keys.current.length > rows.length) keys.current.length = rows.length

  const commit = (next: T[], nextKeys: number[]) => {
    keys.current = nextKeys
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  useEffect(() => {
    const request = pendingFocus.current
    if (!request) return
    pendingFocus.current = null
    if (request === 'add') return addRef.current?.querySelector('button')?.focus()
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-repeater-key="${request.key}"]`)
    if (!row) return
    if (request.target === 'first') return row.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const wanted = row.querySelector<HTMLButtonElement>(`[data-repeater-move="${request.target}"]:not([disabled])`)
    // At the top the up button disables itself; focus crosses to its partner.
    ;(wanted ?? row.querySelector<HTMLElement>('[data-repeater-move]:not([disabled])'))?.focus()
  })

  const noun = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)
  const canAdd = !disabled && (max === undefined || rows.length < max)
  const canRemove = !disabled && rows.length > min

  const add = () => {
    if (!canAdd) return
    const key = nextKey.current++
    pendingFocus.current = { key, target: 'first' }
    commit([...rows, createRow()], [...keys.current, key])
    setAnnouncement(`${noun} ${rows.length + 1} added. ${rows.length + 1} ${rows.length + 1 === 1 ? itemLabel : `${itemLabel}s`}.`)
  }

  const remove = (index: number) => {
    if (!canRemove) return
    const nextKeys = keys.current.filter((_, i) => i !== index)
    const neighbour = nextKeys[index] ?? nextKeys[index - 1]
    pendingFocus.current = neighbour === undefined ? 'add' : { key: neighbour, target: 'first' }
    commit(
      rows.filter((_, i) => i !== index),
      nextKeys,
    )
    setAnnouncement(`${noun} ${index + 1} removed. ${rows.length - 1} left.`)
  }

  const move = (index: number, step: -1 | 1) => {
    const target = index + step
    if (disabled || target < 0 || target >= rows.length) return
    const swap = <V,>(list: V[]) => {
      const copy = [...list]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    }
    pendingFocus.current = { key: keys.current[index], target: step === -1 ? 'up' : 'down' }
    commit(swap(rows), swap(keys.current))
    setAnnouncement(`${noun} moved to position ${target + 1} of ${rows.length}.`)
  }

  const update = (index: number, patch: Partial<T>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    commit(next, keys.current)
  }

  return (
    <fieldset ref={rootRef} disabled={disabled} className={cn('flex min-w-0 flex-col gap-2', disabled && 'opacity-60', className)}>
      <legend className="mb-2 text-[13px] font-bold text-ink">{label}</legend>

      {rows.length === 0 && <p className="rounded-[var(--radius-tile)] border border-dashed border-line-strong px-4 py-3 text-[12px] font-medium text-ink-faint">No {itemLabel}s yet.</p>}

      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const key = keys.current[index]
          const name = `${itemLabel} ${index + 1}`
          return (
            <li key={key} data-repeater-key={key} className="rounded-[var(--radius-tile)] border border-line bg-surface p-3">
              <div role="group" aria-label={`${noun} ${index + 1}`} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-2.5 w-4 shrink-0 text-right text-[12px] font-bold tabular-nums text-ink-faint">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">{renderRow(row, { index, update: (patch) => update(index, patch), idPrefix: `${uid}-${key}` })}</div>
                <div className="flex shrink-0 items-center gap-0.5 self-center">
                  {reorderable && (
                    <>
                      <IconButton icon={ChevronUpIcon} size="xs" label={`Move ${name} up`} data-repeater-move="up" disabled={disabled || index === 0} onClick={() => move(index, -1)} />
                      <IconButton icon={ChevronDownIcon} size="xs" label={`Move ${name} down`} data-repeater-move="down" disabled={disabled || index === rows.length - 1} onClick={() => move(index, 1)} />
                    </>
                  )}
                  <IconButton icon={CrossIcon} size="xs" label={`Remove ${name}`} disabled={!canRemove} onClick={() => remove(index)} />
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div ref={addRef} className="flex items-center gap-3">
        <Button variant="outline" size="sm" disabled={!canAdd} onClick={add} className="gap-1.5 self-start">
          <PlusIcon size={14} />
          {addLabel ?? `Add ${itemLabel}`}
        </Button>
        {max !== undefined && (
          <span className="text-[12px] font-medium tabular-nums text-ink-faint">
            {rows.length} of {max}
          </span>
        )}
      </div>

      <span role="status" className="sr-only">
        {announcement}
      </span>
    </fieldset>
  )
}
