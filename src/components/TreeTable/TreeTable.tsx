'use client'

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ChevronRightIcon } from '../internal/icons'

export interface TreeTableRow<T> {
  id: string
  data: T
  children?: TreeTableRow<T>[]
}

export type TreeTableAggregate = 'sum' | 'avg' | 'min' | 'max' | ((values: number[]) => number)

export interface TreeTableColumn<T> {
  id: string
  header: string
  /** Reads the cell's value from a row. */
  value: (data: T) => ReactNode
  /**
   * Roll leaf values up into parent rows. The column's `value` must return a
   * number for leaves; parents show the aggregate of every leaf below them.
   */
  aggregate?: TreeTableAggregate
  /** Formats a number — used for aggregates, and for leaf values that are numbers. */
  format?: (value: number) => ReactNode
  /** Right-align figures. */
  align?: 'start' | 'end'
  /** CSS width, e.g. "120px". */
  width?: string
}

export interface TreeTableProps<T> {
  rows: TreeTableRow<T>[]
  /** The first column holds the tree: indentation and the expand control. */
  columns: TreeTableColumn<T>[]
  /** Accessible name for the table. */
  label: string
  /** Controlled expanded row ids. */
  expanded?: string[]
  /** Expanded row ids on first render when uncontrolled. */
  defaultExpanded?: string[]
  /** Called with the expanded ids after every toggle. */
  onExpandedChange?: (expanded: string[]) => void
  /** Show Expand all and Collapse all above the table. */
  showExpandControls?: boolean
  /** Called when a row is clicked, or Enter is pressed on a leaf. */
  onRowClick?: (row: TreeTableRow<T>) => void
  /** Merged last, so it wins. */
  className?: string
}

interface TreeTableVisibleRow<T> {
  row: TreeTableRow<T>
  depth: number
  parentId?: string
  position: number
  siblings: number
}

const REDUCERS = {
  sum: (values: number[]) => values.reduce((total, value) => total + value, 0),
  avg: (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0),
  min: (values: number[]) => Math.min(...values),
  max: (values: number[]) => Math.max(...values),
}

function leaves<T>(row: TreeTableRow<T>): T[] {
  return row.children?.length ? row.children.flatMap(leaves) : [row.data]
}

function parents<T>(rows: TreeTableRow<T>[]): string[] {
  return rows.flatMap((row) => (row.children?.length ? [row.id, ...parents(row.children)] : []))
}

/**
 * A table whose rows nest — cost centres inside departments, files inside
 * folders — where every level still needs the same columns.
 *
 * It is a `treegrid`: each row is announced with its level, its position among
 * its siblings and whether it is expanded, so the indentation is not the only
 * sign of the hierarchy. Rows are the unit of focus, with the tree keyboard
 * model — Up and Down move, Right expands or steps into the first child, Left
 * collapses or steps out to the parent, Home and End jump, and `*` expands
 * every sibling of the current row.
 *
 * Aggregates are computed from leaves rather than from the children's own
 * totals, so an average over a department is the average of its people and
 * not the average of its teams' averages.
 */
export function TreeTable<T>({
  rows,
  columns,
  label,
  expanded,
  defaultExpanded = [],
  onExpandedChange,
  showExpandControls = true,
  onRowClick,
  className,
}: TreeTableProps<T>) {
  const [own, setOwn] = useState(defaultExpanded)
  const open = useMemo(() => new Set(expanded ?? own), [expanded, own])
  const [active, setActive] = useState(0)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  const setOpen = (next: Set<string>) => {
    const list = [...next]
    if (expanded === undefined) setOwn(list)
    onExpandedChange?.(list)
  }

  const visible = useMemo(() => {
    const walk = (list: TreeTableRow<T>[], depth: number, parentId?: string): TreeTableVisibleRow<T>[] =>
      list.flatMap((row, index) => [
        { row, depth, parentId, position: index + 1, siblings: list.length },
        ...(row.children?.length && open.has(row.id) ? walk(row.children, depth + 1, row.id) : []),
      ])
    return walk(rows, 1)
  }, [rows, open])

  const current = Math.min(active, visible.length - 1)

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(visible.length - 1, index))
    setActive(next)
    rowRefs.current[next]?.focus()
  }

  const toggle = (id: string, to?: boolean) => {
    const next = new Set(open)
    if (to ?? !next.has(id)) next.add(id)
    else next.delete(id)
    setOpen(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    const item = visible[index]
    const hasChildren = Boolean(item.row.children?.length)
    const isOpen = open.has(item.row.id)
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(index + 1),
      ArrowUp: () => focusRow(index - 1),
      Home: () => focusRow(0),
      End: () => focusRow(visible.length - 1),
      ArrowRight: () => {
        if (hasChildren && !isOpen) toggle(item.row.id, true)
        else if (hasChildren) focusRow(index + 1)
      },
      ArrowLeft: () => {
        if (hasChildren && isOpen) toggle(item.row.id, false)
        else if (item.parentId) focusRow(visible.findIndex((entry) => entry.row.id === item.parentId))
      },
      Enter: () => (hasChildren ? toggle(item.row.id) : onRowClick?.(item.row)),
      '*': () => {
        const siblings = visible.filter((entry) => entry.parentId === item.parentId && entry.row.children?.length)
        setOpen(new Set([...open, ...siblings.map((entry) => entry.row.id)]))
      },
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const cellValue = (column: TreeTableColumn<T>, row: TreeTableRow<T>) => {
    if (column.aggregate && row.children?.length) {
      const values = leaves(row)
        .map((data) => column.value(data))
        .filter((value): value is number => typeof value === 'number')
      const reduce = typeof column.aggregate === 'function' ? column.aggregate : REDUCERS[column.aggregate]
      const total = values.length ? reduce(values) : null
      return total === null ? null : (column.format?.(total) ?? total.toLocaleString())
    }
    const value = column.value(row.data)
    return typeof value === 'number' ? (column.format?.(value) ?? value.toLocaleString()) : value
  }

  const allParents = parents(rows)

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {showExpandControls && allParents.length > 0 && (
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(allParents))} disabled={allParents.every((id) => open.has(id))}>
            Expand all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())} disabled={open.size === 0}>
            Collapse all
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[var(--radius-tile)] border border-line bg-surface">
        <table role="treegrid" aria-label={label} className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  role="columnheader"
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint',
                    column.align === 'end' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, index) => {
              const hasChildren = Boolean(item.row.children?.length)
              const isOpen = open.has(item.row.id)
              return (
                <tr
                  key={item.row.id}
                  ref={(node) => {
                    rowRefs.current[index] = node
                  }}
                  tabIndex={index === current ? 0 : -1}
                  aria-level={item.depth}
                  aria-posinset={item.position}
                  aria-setsize={item.siblings}
                  aria-expanded={hasChildren ? isOpen : undefined}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onFocus={() => setActive(index)}
                  onClick={() => (hasChildren ? toggle(item.row.id) : onRowClick?.(item.row))}
                  className={cn(
                    'cursor-default transition-colors hover:bg-surface-sunken [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                    hasChildren && 'cursor-pointer',
                  )}
                >
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.id}
                      role="gridcell"
                      className={cn(
                        'px-3 py-2 tabular-nums',
                        column.align === 'end' ? 'text-right' : 'text-left',
                        hasChildren ? 'font-bold text-ink' : 'font-medium text-ink-soft',
                      )}
                    >
                      {columnIndex === 0 ? (
                        <span className="flex items-center gap-1.5" style={{ paddingLeft: (item.depth - 1) * 20 }}>
                          <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-ink-faint">
                            {hasChildren && (
                              <ChevronRightIcon
                                size={13}
                                className={cn('transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none', isOpen && 'rotate-90')}
                              />
                            )}
                          </span>
                          <span className="min-w-0 truncate">{cellValue(column, item.row)}</span>
                        </span>
                      ) : (
                        cellValue(column, item.row)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
