'use client'

import { Fragment, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Field } from '../Field'
import { Select, type SelectOption } from '../Select'

export type PivotTableRecord = Record<string, string | number | null | undefined>
export type PivotTableAggregation = 'sum' | 'count' | 'avg' | 'min' | 'max'
export type PivotTableSort = 'label' | 'desc' | 'asc'

export interface PivotTableField {
  key: string
  label: string
}

export interface PivotTableMeasure extends PivotTableField {
  /** Format aggregated values. Counts always print as whole numbers. */
  format?: (value: number) => string
}

export interface PivotTableConfig {
  /** Up to two fields down the side, outer first. */
  rows: string[]
  /** Up to two fields across the top, outer first. */
  columns: string[]
  /** The measure key being aggregated. */
  measure: string
  aggregation: PivotTableAggregation
  /** Row order: by label, or by row total high-to-low or low-to-high. */
  sort: PivotTableSort
}

export interface PivotTableProps {
  /** Flat records, one per fact — an order line, a ticket, a session. */
  records: PivotTableRecord[]
  /** Fields that can become rows or columns. */
  dimensions: PivotTableField[]
  /** Numeric fields that can be aggregated. */
  measures: PivotTableMeasure[]
  /** Accessible name, and the table caption. */
  label: string
  /** The pivot. Controlled. */
  value?: PivotTableConfig
  /** Initial pivot when uncontrolled. */
  defaultValue?: Partial<PivotTableConfig>
  onValueChange?: (config: PivotTableConfig) => void
  /** Show the row, column, value and aggregation pickers above the table. */
  showConfig?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface PivotTableAcc {
  sum: number
  count: number
  min: number
  max: number
}

const AGGREGATIONS: SelectOption<PivotTableAggregation>[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]
const SORTS: SelectOption<PivotTableSort>[] = [
  { value: 'label', label: 'Label A–Z' },
  { value: 'desc', label: 'Total, high to low' },
  { value: 'asc', label: 'Total, low to high' },
]
const NONE = '__none'
const keyOf = (rows: string[], cols: string[]) => JSON.stringify([rows, cols])
const byLabel = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/**
 * Raw records turned into a cross-tab that the reader configures.
 *
 * Exports to a spreadsheet exist mostly so someone can build this pivot by
 * hand. Doing it in place — pick the rows, the columns, the measure and how to
 * aggregate it — answers “revenue by region by quarter” without leaving the
 * page. Every record is folded once into every row-prefix × column-prefix
 * bucket, so subtotals and grand totals are real aggregates of the records,
 * not sums of cells: an average of averages would be wrong, and this is not.
 *
 * Two fields deep on each axis, with nested headers that use proper
 * `colgroup` and `rowgroup` scopes, so a screen reader announces both levels.
 */
export function PivotTable({
  records,
  dimensions,
  measures,
  label,
  value,
  defaultValue,
  onValueChange,
  showConfig = true,
  className,
}: PivotTableProps) {
  const [own, setOwn] = useState<PivotTableConfig>({
    rows: defaultValue?.rows ?? dimensions.slice(0, 1).map((d) => d.key),
    columns: defaultValue?.columns ?? dimensions.slice(1, 2).map((d) => d.key),
    measure: defaultValue?.measure ?? measures[0]?.key ?? '',
    aggregation: defaultValue?.aggregation ?? 'sum',
    sort: defaultValue?.sort ?? 'label',
  })
  const config = value ?? own
  const update = (patch: Partial<PivotTableConfig>) => {
    const next = { ...config, ...patch }
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
  }
  const R = config.rows.slice(0, 2)
  const C = config.columns.slice(0, 2)
  const measure = measures.find((m) => m.key === config.measure)
  const nameOf = (key: string) => dimensions.find((d) => d.key === key)?.label ?? key

  const { buckets, rowTree, colTree } = useMemo(() => {
    const buckets = new Map<string, PivotTableAcc>()
    const rowTree = new Map<string, Set<string>>()
    const colTree = new Map<string, Set<string>>()
    const text = (record: PivotTableRecord, key: string) => String(record[key] ?? '—')
    for (const record of records) {
      const raw = Number(record[config.measure])
      if (config.aggregation !== 'count' && !Number.isFinite(raw)) continue
      const rv = R.map((key) => text(record, key))
      const cv = C.map((key) => text(record, key))
      if (rv.length) rowTree.set(rv[0], (rowTree.get(rv[0]) ?? new Set()).add(rv[1] ?? ''))
      if (cv.length) colTree.set(cv[0], (colTree.get(cv[0]) ?? new Set()).add(cv[1] ?? ''))
      for (let i = 0; i <= rv.length; i += 1) {
        for (let j = 0; j <= cv.length; j += 1) {
          const key = keyOf(rv.slice(0, i), cv.slice(0, j))
          const acc = buckets.get(key) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity }
          acc.count += 1
          if (Number.isFinite(raw)) {
            acc.sum += raw
            acc.min = Math.min(acc.min, raw)
            acc.max = Math.max(acc.max, raw)
          }
          buckets.set(key, acc)
        }
      }
    }
    return { buckets, rowTree, colTree }
  }, [records, config.measure, config.aggregation, R.join(), C.join()])

  const read = (rows: string[], cols: string[]) => {
    const acc = buckets.get(keyOf(rows, cols))
    if (!acc) return null
    switch (config.aggregation) {
      case 'count':
        return acc.count
      case 'avg':
        return acc.count ? acc.sum / acc.count : null
      case 'min':
        return Number.isFinite(acc.min) ? acc.min : null
      case 'max':
        return Number.isFinite(acc.max) ? acc.max : null
      default:
        return acc.sum
    }
  }
  const format = (n: number | null) =>
    n === null ? '—' : config.aggregation === 'count' ? n.toLocaleString() : measure?.format?.(n) ?? n.toLocaleString(undefined, { maximumFractionDigits: 2 })

  const order = (values: string[], prefix: string[]) =>
    config.sort === 'label'
      ? [...values].sort(byLabel)
      : [...values].sort((a, b) => {
          const delta = (read([...prefix, a], []) ?? -Infinity) - (read([...prefix, b], []) ?? -Infinity)
          return (config.sort === 'desc' ? -delta : delta) || byLabel(a, b)
        })

  // Leaf columns, in order: each value, a subtotal per outer group when two deep, then the grand total.
  const groups = [...colTree.keys()].sort(byLabel).map((outer) => ({ outer, inner: [...colTree.get(outer)!].sort(byLabel) }))
  const leaves: { path: string[]; total: boolean }[] = []
  if (C.length === 1) groups.forEach((g) => leaves.push({ path: [g.outer], total: false }))
  if (C.length === 2)
    groups.forEach((g) => {
      g.inner.forEach((inner) => leaves.push({ path: [g.outer, inner], total: false }))
      leaves.push({ path: [g.outer], total: true })
    })
  leaves.push({ path: [], total: true })

  const aggregationName = AGGREGATIONS.find((a) => a.value === config.aggregation)!.label
  const totalLabel = `${aggregationName} of ${measure?.label ?? config.measure}`
  const cells = (rowPath: string[], strong = false) =>
    leaves.map((leaf) => (
      <td
        key={leaf.path.join('/') || 'total'}
        className={cn('px-3 py-2 text-right tabular-nums', (strong || leaf.total) && 'font-bold text-ink', leaf.total && 'bg-surface-sunken')}
      >
        {format(read(rowPath, leaf.path))}
      </td>
    ))
  const th = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint'
  const rowTh = 'px-3 py-2 text-left font-semibold text-ink'
  const outerRows = order([...rowTree.keys()], [])

  const dimOptions = (exclude: string[], optional: boolean): SelectOption[] => [
    ...(optional ? [{ value: NONE, label: 'None' }] : []),
    ...dimensions.filter((d) => !exclude.includes(d.key)).map((d) => ({ value: d.key, label: d.label })),
  ]
  const setAxis = (axis: 'rows' | 'columns', index: number, key: string) => {
    const next = [...config[axis]]
    if (key === NONE) next.splice(index)
    else next[index] = key
    update({ [axis]: next.slice(0, 2) })
  }
  const picker = (title: string, axis: 'rows' | 'columns', index: number) => {
    const current = config[axis][index] ?? NONE
    const used = [...config.rows, ...config.columns].filter((key) => key !== current)
    return (
      <Field label={title}>
        <Select size="sm" fullWidth label={title} value={current} options={dimOptions(used, axis === 'columns' || index > 0)} onValueChange={(key) => setAxis(axis, index, key)} />
      </Field>
    )
  }

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      {showConfig && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {picker('Rows', 'rows', 0)}
          {R.length > 0 && picker('Then rows by', 'rows', 1)}
          {picker('Columns', 'columns', 0)}
          {C.length > 0 && picker('Then columns by', 'columns', 1)}
          <Field label="Value">
            <Select size="sm" fullWidth label="Value" value={config.measure} options={measures.map((m) => ({ value: m.key, label: m.label }))} onValueChange={(key) => update({ measure: key })} />
          </Field>
          <Field label="Aggregate">
            <Select size="sm" fullWidth label="Aggregate" value={config.aggregation} options={AGGREGATIONS} onValueChange={(aggregation) => update({ aggregation })} />
          </Field>
          <Field label="Sort rows">
            <Select size="sm" fullWidth label="Sort rows" value={config.sort} options={SORTS} onValueChange={(sort) => update({ sort })} />
          </Field>
        </div>
      )}

      <div role="region" aria-label={`${label}, scrollable`} tabIndex={0} className="w-full overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface outline-offset-2">
        <table className="w-full border-collapse text-[13px] text-ink-soft">
          <caption className="sr-only">{`${label}: ${totalLabel}${R.length ? ` by ${R.map(nameOf).join(' and ')}` : ''}${C.length ? ` across ${C.map(nameOf).join(' and ')}` : ''}`}</caption>
          <thead className="border-b border-line-strong">
            <tr>
              {(R.length ? R : ['']).map((key) => (
                <th key={key || 'all'} scope="col" rowSpan={Math.max(1, C.length)} className={cn(th, 'align-bottom')}>
                  {key ? nameOf(key) : 'Group'}
                </th>
              ))}
              {C.length === 1 && groups.map((g) => <th key={g.outer} scope="col" className={cn(th, 'text-right normal-case')}>{g.outer}</th>)}
              {C.length === 2 &&
                groups.map((g) => (
                  <th key={g.outer} scope="colgroup" colSpan={g.inner.length + 1} className={cn(th, 'border-b border-line text-center normal-case')}>
                    {g.outer}
                  </th>
                ))}
              <th scope="col" rowSpan={Math.max(1, C.length)} className={cn(th, 'bg-surface-sunken text-right align-bottom')}>
                {C.length ? 'Total' : totalLabel}
              </th>
            </tr>
            {C.length === 2 && (
              <tr>
                {groups.map((g) => (
                  <Fragment key={g.outer}>
                    {g.inner.map((inner) => (
                      <th key={inner} scope="col" className={cn(th, 'text-right normal-case')}>{inner}</th>
                    ))}
                    <th scope="col" className={cn(th, 'bg-surface-sunken text-right')}>Subtotal</th>
                  </Fragment>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {R.length === 0 && (
              <tr>
                <th scope="row" className={rowTh}>All</th>
                {cells([])}
              </tr>
            )}
            {R.length === 1 &&
              outerRows.map((outer) => (
                <tr key={outer} className="border-b border-line">
                  <th scope="row" className={rowTh}>{outer}</th>
                  {cells([outer])}
                </tr>
              ))}
            {R.length === 2 &&
              outerRows.map((outer) => {
                const inner = order([...rowTree.get(outer)!], [outer])
                return (
                  <Fragment key={outer}>
                    {inner.map((name, index) => (
                      <tr key={name} className="border-b border-line">
                        {index === 0 && (
                          <th scope="rowgroup" rowSpan={inner.length + 1} className={cn(rowTh, 'align-top')}>{outer}</th>
                        )}
                        <th scope="row" className="px-3 py-2 text-left font-medium text-ink-soft">{name}</th>
                        {cells([outer, name])}
                      </tr>
                    ))}
                    <tr className="border-b border-line-strong bg-surface-sunken">
                      <th scope="row" className="px-3 py-2 text-left font-bold text-ink">{`${outer} subtotal`}</th>
                      {cells([outer], true)}
                    </tr>
                  </Fragment>
                )
              })}
          </tbody>
          {R.length > 0 && (
            <tfoot className="border-t-2 border-line-strong">
              <tr className="bg-surface-sunken">
                <th scope="row" colSpan={R.length} className="px-3 py-2 text-left font-extrabold text-ink">Grand total</th>
                {cells([], true)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
