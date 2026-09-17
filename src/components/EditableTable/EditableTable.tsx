'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export type EditableTableCellType = 'text' | 'number' | 'select'

export interface EditableTableOption {
  value: string
  label: string
}

export interface EditableTableColumn<T> {
  key: Extract<keyof T, string>
  header: string
  /** The editor: a text field, a number field or a native select. */
  type?: EditableTableCellType
  /** Choices for a `select` column. */
  options?: EditableTableOption[]
  /** Return a message to reject the value, or nothing to accept it. */
  validate?: (value: unknown, row: T) => string | undefined | null
  /** How the value reads when not editing. */
  format?: (value: unknown, row: T) => ReactNode
  /** Shown but never edited. */
  readOnly?: boolean
  /** Right-align figures. Number columns default to it. */
  align?: 'start' | 'end'
  /** CSS width, e.g. "120px". */
  width?: string
}

export interface EditableTableProps<T extends { id: string }> {
  columns: EditableTableColumn<T>[]
  /** Controlled rows. */
  value?: T[]
  /** Starting rows when uncontrolled. */
  defaultValue?: T[]
  /** Called with every row after a cell is committed. */
  onValueChange?: (rows: T[]) => void
  /** Accessible name for the grid. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

interface EditableTableEditing {
  row: number
  col: number
  draft: string
  error?: string
}

/**
 * A grid of values edited in place, the way a spreadsheet is: for the tables
 * people fix rather than read — price lists, allocations, seat counts.
 *
 * Focus lives on cells, and arrows move between them without editing
 * anything. Enter, F2, a double-click or simply typing opens the cell; typing
 * replaces the value, as it does in every spreadsheet. Enter commits and moves
 * down, Tab commits and moves across, Escape puts the old value back. A value
 * that fails its column's check is not committed: the editor stays open with
 * the message beside it, since a table that accepts "twelve" into a number
 * column has only moved the error somewhere harder to find.
 */
export function EditableTable<T extends { id: string }>({
  columns,
  value,
  defaultValue = [],
  onValueChange,
  label,
  className,
}: EditableTableProps<T>) {
  const [own, setOwn] = useState(defaultValue)
  const rows = value ?? own
  const [active, setActive] = useState({ row: 0, col: 0 })
  const [editing, setEditing] = useState<EditableTableEditing | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing
  const focusCell = useRef(false)
  const tableRef = useRef<HTMLTableElement>(null)
  const baseId = useId()

  const row = Math.min(active.row, rows.length - 1)
  const col = Math.min(active.col, columns.length - 1)

  useEffect(() => {
    if (!focusCell.current || editing) return
    focusCell.current = false
    tableRef.current?.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`)?.focus()
  }, [row, col, editing])

  const move = (nextRow: number, nextCol: number) => {
    focusCell.current = true
    setActive({
      row: Math.max(0, Math.min(rows.length - 1, nextRow)),
      col: Math.max(0, Math.min(columns.length - 1, nextCol)),
    })
  }

  const display = (column: EditableTableColumn<T>, item: T) => {
    const raw = item[column.key]
    if (column.format) return column.format(raw, item)
    if (column.type === 'select') return column.options?.find((option) => option.value === raw)?.label ?? String(raw ?? '')
    return raw === null || raw === undefined ? '' : String(raw)
  }

  const open = (r: number, c: number, draft?: string) => {
    const column = columns[c]
    if (column.readOnly) return
    const raw = rows[r][column.key]
    setEditing({ row: r, col: c, draft: draft ?? (raw === null || raw === undefined ? '' : String(raw)) })
  }

  /** Validates and writes the draft. Returns false when the value is refused. */
  const commit = (): boolean => {
    const current = editingRef.current
    if (!current) return true
    const column = columns[current.col]
    const item = rows[current.row]
    let next: unknown = current.draft
    if (column.type === 'number') {
      const trimmed = current.draft.trim()
      next = trimmed === '' ? null : Number(trimmed)
      if (typeof next === 'number' && Number.isNaN(next)) {
        setEditing({ ...current, error: 'Enter a number' })
        return false
      }
    }
    const error = column.validate?.(next, item)
    if (error) {
      setEditing({ ...current, error })
      return false
    }
    editingRef.current = null
    setEditing(null)
    if (next !== item[column.key]) {
      const updated = rows.map((entry, index) => (index === current.row ? { ...entry, [column.key]: next } : entry))
      if (value === undefined) setOwn(updated)
      onValueChange?.(updated)
    }
    return true
  }

  const cancel = () => {
    editingRef.current = null
    setEditing(null)
    focusCell.current = true
  }

  const onCellKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, r: number, c: number) => {
    if (event.target !== event.currentTarget) return
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(r + 1, c),
      ArrowUp: () => move(r - 1, c),
      ArrowRight: () => move(r, c + 1),
      ArrowLeft: () => move(r, c - 1),
      Home: () => (event.ctrlKey ? move(0, 0) : move(r, 0)),
      End: () => (event.ctrlKey ? move(rows.length - 1, columns.length - 1) : move(r, columns.length - 1)),
      Enter: () => open(r, c),
      F2: () => open(r, c),
    }
    const handler = keys[event.key]
    if (handler) {
      event.preventDefault()
      handler()
    } else if (printable && event.key !== ' ' && !columns[c].readOnly) {
      event.preventDefault()
      open(r, c, columns[c].type === 'select' ? undefined : event.key)
    }
  }

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    const current = editingRef.current
    if (!current) return
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (commit()) move(current.row + 1, current.col)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      if (!commit()) return
      const flat = current.row * columns.length + current.col + (event.shiftKey ? -1 : 1)
      const clamped = Math.max(0, Math.min(rows.length * columns.length - 1, flat))
      move(Math.floor(clamped / columns.length), clamped % columns.length)
    }
  }

  const onEditorBlur = () => {
    // Leaving the cell keeps a good value and drops a bad one, rather than
    // trapping focus in a field the reader has already moved away from.
    if (editingRef.current && !commit()) {
      editingRef.current = null
      setEditing(null)
    }
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-[var(--radius-tile)] border border-line bg-surface', className)}>
      <table ref={tableRef} role="grid" aria-label={label} className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                role="columnheader"
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  'border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint',
                  (column.align ?? (column.type === 'number' ? 'end' : 'start')) === 'end' ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, r) => (
            <tr key={item.id} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
              {columns.map((column, c) => {
                const isEditing = editing?.row === r && editing.col === c
                const end = (column.align ?? (column.type === 'number' ? 'end' : 'start')) === 'end'
                const standing = column.validate?.(item[column.key], item)
                const errorId = `${baseId}-${r}-${c}-error`
                const editorClass = cn(
                  'h-full w-full rounded-[6px] bg-surface px-2 py-1.5 text-[13px] font-medium text-ink outline-2 outline-focus',
                  end && 'text-right tabular-nums',
                  editing?.error && 'outline-danger',
                )
                return (
                  <td
                    key={column.key}
                    role="gridcell"
                    data-cell={`${r}-${c}`}
                    tabIndex={!editing && r === row && c === col ? 0 : -1}
                    aria-readonly={column.readOnly || undefined}
                    aria-invalid={standing ? true : undefined}
                    onFocus={(event) => {
                      if (event.target === event.currentTarget) setActive({ row: r, col: c })
                    }}
                    onKeyDown={(event) => onCellKeyDown(event, r, c)}
                    onDoubleClick={() => open(r, c)}
                    className={cn(
                      'relative h-10 px-3 py-0 font-medium text-ink',
                      'focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                      end && 'text-right tabular-nums',
                      column.readOnly ? 'text-ink-soft' : 'cursor-cell',
                      isEditing && 'px-1',
                      standing && !isEditing && 'underline decoration-danger decoration-wavy underline-offset-4',
                    )}
                  >
                    {isEditing ? (
                      <>
                        {column.type === 'select' ? (
                          <select
                            autoFocus
                            aria-label={column.header}
                            aria-describedby={editing.error ? errorId : undefined}
                            aria-invalid={editing.error ? true : undefined}
                            value={editing.draft}
                            onChange={(event) => setEditing({ ...editing, draft: event.target.value, error: undefined })}
                            onKeyDown={onEditorKeyDown}
                            onBlur={onEditorBlur}
                            className={editorClass}
                          >
                            {column.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type="text"
                            inputMode={column.type === 'number' ? 'decimal' : undefined}
                            aria-label={column.header}
                            aria-describedby={editing.error ? errorId : undefined}
                            aria-invalid={editing.error ? true : undefined}
                            value={editing.draft}
                            onChange={(event) => setEditing({ ...editing, draft: event.target.value, error: undefined })}
                            onKeyDown={onEditorKeyDown}
                            onBlur={onEditorBlur}
                            className={editorClass}
                          />
                        )}
                        {editing.error && (
                          <span
                            id={errorId}
                            role="alert"
                            className={cn(
                              'absolute left-1 z-[var(--z-raised)] whitespace-nowrap rounded-[8px] bg-danger px-2 py-1 text-left text-[11px] font-bold text-ink-inverse shadow-[var(--shadow-float)]',
                              // The last row's message opens upwards, so the scroll container does not clip it.
                              r === rows.length - 1 && r > 0 ? 'bottom-full mb-1' : 'top-full mt-1',
                            )}
                          >
                            {editing.error}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {display(column, item)}
                        {standing && <VisuallyHidden>, {standing}</VisuallyHidden>}
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
