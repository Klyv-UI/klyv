'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Skeleton } from '../Skeleton'
import { Surface } from '../Surface'
import { Card } from '../Card'
import { FilterBar, type FilterChip } from '../FilterBar'
import { SearchField } from '../SearchField'
import { DataTable, type DataTableColumn } from '../DataTable'
import { StateView, type ViewStatus } from '../StateView'
import type { IconComponent } from '../../lib/types'

export interface DataExplorerProps<Row> {
  /** Rows to display. undefined means still loading. */
  rows: Row[] | undefined
  /** Column definitions, passed through to DataTable. */
  columns: DataTableColumn<Row>[]
  /** Stable identity for each row. */
  rowId: (row: Row) => string
  /** Title shown in the card header. */
  title: string
  /** Accessible name for the table. Defaults to the title. */
  label?: string
  /** Quick filter toggles. */
  filters?: FilterChip[]
  /** Decides whether a row matches the active filters. */
  matchesFilter?: (row: Row, active: string[]) => boolean
  /** Fields searched by the search field. */
  searchIn?: (row: Row) => string
  /** Placeholder for the search field. */
  searchPlaceholder?: string
  /** Explicit status. Omit and it is derived from `rows`. */
  status?: ViewStatus
  onRetry?: ReactNode
  /** Copy for the no-data case, before any filtering. */
  emptyTitle?: string
  /** Second line of the no-data case. */
  emptyDescription?: string
  /** Glyph for the no-data case. */
  emptyIcon?: IconComponent
  /** Extra controls in the header — an export button, a date range. */
  actions?: ReactNode
  pageSize?: number
  selectable?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A whole list screen: search, quick filters, a sortable and selectable table,
 * and the four data states — in one component.
 *
 * Every list page in an application ends up rebuilding this, and each rebuild
 * drifts: one forgets the empty state, another filters but never announces the
 * new count, a third loses the search on a filter change. Assembling it once
 * from FilterBar, SearchField, DataTable and StateView means the wiring between
 * them is decided in a single place.
 *
 * It distinguishes two empty states, which is the detail most implementations
 * miss: no data at all is a different message from no data matching the current
 * filters, and only the second one should offer to clear them.
 */
export function DataExplorer<Row>({
  rows,
  columns,
  rowId,
  title,
  label,
  filters = [],
  matchesFilter,
  searchIn,
  searchPlaceholder = 'Search',
  status,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  actions,
  pageSize = 8,
  selectable = false,
  className,
}: DataExplorerProps<Row>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const filtered = useMemo(() => {
    if (!rows) return undefined
    const normalised = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (active.length > 0 && matchesFilter && !matchesFilter(row, active)) return false
      if (normalised && searchIn && !searchIn(row).toLowerCase().includes(normalised)) return false
      return true
    })
  }, [rows, query, active, matchesFilter, searchIn])

  const narrowed = active.length > 0 || query.trim().length > 0
  const clearAll = () => {
    setActive([])
    setQuery('')
  }

  const skeleton = (
    <div className="flex flex-col gap-2 py-2">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-1">
          <Skeleton width="28%" />
          <Skeleton width="18%" className="h-2.5" />
          <Skeleton width="16%" className="h-2.5" />
          <Skeleton width={70} className="ml-auto" />
        </div>
      ))}
    </div>
  )

  return (
    <Card title={title} action={actions} className={cn('gap-3', className)}>
      <div className="flex flex-col gap-3">
        {searchIn && (
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            label={`Search ${title.toLowerCase()}`}
          />
        )}
        {(filters.length > 0 || filtered) && (
          <FilterBar
            filters={filters}
            value={active}
            onValueChange={setActive}
            resultCount={filtered?.length}
            resultLabel="results"
            onClear={narrowed ? clearAll : undefined}
            label={`Filter ${title.toLowerCase()}`}
          />
        )}
      </div>

      <StateView
        data={filtered}
        status={status}
        skeleton={skeleton}
        onRetry={onRetry}
        empty={
          narrowed
            ? {
                title: 'No matches',
                description: 'Nothing matches the current search and filters.',
                action: (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="h-8 rounded-full border border-line-strong px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-muted"
                  >
                    Clear filters
                  </button>
                ),
              }
            : { title: emptyTitle, description: emptyDescription, icon: emptyIcon }
        }
      >
        {(data) => (
          <Surface variant="card" padding="none" className="border-0 shadow-none">
            <DataTable
              label={label ?? title}
              columns={columns}
              rows={data}
              rowId={rowId}
              pageSize={pageSize}
              selectable={selectable}
              selected={selected}
              onSelectedChange={setSelected}
            />
          </Surface>
        )}
      </StateView>
    </Card>
  )
}
