'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Checkbox } from '../Checkbox'
import { Text } from '../Text'
import { EmptyState } from '../EmptyState'
import { Pagination } from '../Pagination'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, type TableAlign } from '../Table'

export interface DataTableColumn<Row> {
  id: string
  header: string
  /** Cell contents for a row. */
  cell: (row: Row) => ReactNode
  /** Value used for sorting. Omit to make the column unsortable. */
  sortValue?: (row: Row) => string | number
  align?: TableAlign
  /** Fixed-width digits. Use for any column of figures. */
  tabular?: boolean
  width?: string
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[]
  /** The data. */
  rows: Row[]
  /** Stable identity for each row. */
  rowId: (row: Row) => string
  /** Accessible name for the table. */
  label: string
  /** Adds a selection column and reports the chosen ids. */
  selectable?: boolean
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
  /** Rows per page. Omit to show everything. */
  pageSize?: number
  /** Shown when there are no rows. */
  empty?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

type SortState = { columnId: string; direction: 'ascending' | 'descending' } | null

/**
 * Table plus the four things a data grid needs: sorting, selection, pagination
 * and an empty state. It composes Table rather than redrawing one,
 * so a plain table and a data table are visually identical.
 *
 * Sorting is announced through aria-sort on the header cell, and the header is
 * a real button, so a column can be sorted from the keyboard.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowId,
  label,
  selectable = false,
  selected = [],
  onSelectedChange,
  pageSize,
  empty,
  className,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState>(null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((entry) => entry.id === sort.columnId)
    if (!column?.sortValue) return rows
    const factor = sort.direction === 'ascending' ? 1 : -1
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a)
      const right = column.sortValue!(b)
      if (left === right) return 0
      return (left > right ? 1 : -1) * factor
    })
  }, [rows, sort, columns])

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const current = Math.min(page, pageCount)
  const visible = pageSize ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted

  const visibleIds = visible.map(rowId)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
  const someSelected = visibleIds.some((id) => selected.includes(id)) && !allSelected

  const toggleAll = (checked: boolean) => {
    if (!onSelectedChange) return
    onSelectedChange(
      checked
        ? [...new Set([...selected, ...visibleIds])]
        : selected.filter((id) => !visibleIds.includes(id)),
    )
  }

  const toggleRow = (id: string, checked: boolean) => {
    if (!onSelectedChange) return
    onSelectedChange(checked ? [...selected, id] : selected.filter((entry) => entry !== id))
  }

  const toggleSort = (columnId: string) => {
    setSort((previous) =>
      previous?.columnId === columnId && previous.direction === 'ascending'
        ? { columnId, direction: 'descending' }
        : { columnId, direction: 'ascending' },
    )
  }

  if (rows.length === 0) {
    return <div className={className}>{empty ?? <EmptyState title="Nothing to show" size="sm" />}</div>
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Table label={label}>
        <TableHead>
          <TableRow>
            {selectable && (
              <TableHeaderCell className="w-10">
                <Checkbox
                  boxSize="sm"
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </TableHeaderCell>
            )}
            {columns.map((column) => (
              <TableHeaderCell
                key={column.id}
                align={column.align}
                style={column.width ? { width: column.width } : undefined}
                sort={sort?.columnId === column.id ? sort.direction : undefined}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.id)}
                    className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink"
                  >
                    {column.header}
                    <span aria-hidden="true" className="text-[9px]">
                      {sort?.columnId === column.id ? (sort.direction === 'ascending' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((row) => {
            const id = rowId(row)
            return (
              <TableRow key={id} selected={selected.includes(id)}>
                {selectable && (
                  <TableCell>
                    <Checkbox
                      boxSize="sm"
                      aria-label={`Select row ${id}`}
                      checked={selected.includes(id)}
                      onChange={(event) => toggleRow(id, event.target.checked)}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align} tabular={column.tabular}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {(pageSize || selectable) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text size="caption" weight="semibold" tone="faint" tabular role="status" aria-live="polite">
            {selectable && selected.length > 0
              ? `${selected.length} selected`
              : `${sorted.length} rows`}
          </Text>
          {pageSize && pageCount > 1 && (
            <Pagination page={current} pageCount={pageCount} onPageChange={setPage} compact />
          )}
        </div>
      )}
    </div>
  )
}
