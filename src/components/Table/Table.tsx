import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface TableProps {
  /** TableHead and TableBody. */
  children: ReactNode
  /** Accessible name. Required unless a visible heading already names it. */
  label?: string
  /** Tint alternate body rows. */
  striped?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A semantic table styled on the line and surface tokens. Compositional on
 * purpose: sorting, selection and pagination belong to DataTable,
 * which builds on this.
 *
 * The wrapper scrolls horizontally so a wide table never widens the page.
 */
export function Table({ children, label, striped = false, className }: TableProps) {
  return (
    // `relative` makes this the containing block for visually-hidden cell text,
    // which is absolutely positioned — without it that text escapes the scroll
    // and widens the whole page on a phone.
    <div className="relative w-full overflow-x-auto">
      <table
        aria-label={label}
        className={cn(
          'w-full border-collapse text-left',
          striped && '[&>tbody>tr:nth-child(even)]:bg-surface-sunken',
          className,
        )}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line">{children}</thead>
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export interface TableRowProps {
  children: ReactNode
  /** Marks the row as the current selection. */
  selected?: boolean
  className?: string
}

export function TableRow({ children, selected = false, className }: TableRowProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        'border-b border-line transition-colors last:border-0',
        selected && 'bg-surface-muted',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export type TableAlign = 'left' | 'right' | 'center'

const ALIGN: Record<TableAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign
  /** Current sort direction, when the column is sorted. */
  sort?: 'ascending' | 'descending'
}

export function TableHeaderCell({
  children,
  align = 'left',
  sort,
  className,
  ...props
}: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      aria-sort={sort}
      className={cn(
        'px-4 py-3 text-[11px] font-bold uppercase leading-none tracking-wider text-ink-faint',
        ALIGN[align],
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign
  /** Fixed-width digits, for any column of figures. */
  tabular?: boolean
}

export function TableCell({
  children,
  align = 'left',
  tabular = false,
  className,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-[13px] font-medium leading-tight text-ink',
        ALIGN[align],
        tabular && 'tabular',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
