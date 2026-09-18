'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { CopyButton } from '../CopyButton'
import { FilterBuilder, type FilterCondition, type FilterField, type FilterMatch } from '../FilterBuilder'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Select } from '../Select'
import { Switch } from '../Switch'
import { Text } from '../Text'
import { CrossIcon, PlusIcon } from '../internal/icons'

export interface SqlBuilderColumn {
  name: string
  type: 'number' | 'text' | 'date' | 'boolean'
}

/** `column` on this table references `references` on `table`. */
export interface SqlBuilderForeignKey {
  column: string
  table: string
  references: string
}

export interface SqlBuilderTable {
  name: string
  columns: SqlBuilderColumn[]
  foreignKeys?: SqlBuilderForeignKey[]
}

export type SqlBuilderDialect = 'postgres' | 'mysql'
export type SqlBuilderAggregate = 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface SqlBuilderQuery {
  /** Chosen tables; the first is the FROM table. */
  tables: string[]
  /** Per joined table: join type, and optionally which foreign key to join on. */
  joins: Record<string, { type: 'inner' | 'left'; edge?: string }>
  /** `table.column`, or `*` for COUNT(*). */
  columns: { id: string; aggregate: SqlBuilderAggregate }[]
  /** null groups automatically by every selected column that is not aggregated. */
  groupBy: string[] | null
  where: FilterCondition[]
  match: FilterMatch
  orderBy: { column: string; direction: 'asc' | 'desc' }[]
  limit: string
}

export interface SqlBuilderProps {
  /** Tables, columns and foreign keys. Joins are found along the keys. */
  schema: SqlBuilderTable[]
  /** Controlled query. */
  value?: SqlBuilderQuery
  /** Starting query when uncontrolled. */
  defaultValue?: SqlBuilderQuery
  /** Called with the query after every change. */
  onValueChange?: (value: SqlBuilderQuery) => void
  /** Quoting rules to start with. */
  defaultDialect?: SqlBuilderDialect
  /** Called with the generated SQL and any validation errors. */
  onSqlChange?: (sql: string, errors: string[]) => void
  /** Merged last, so it wins. */
  className?: string
}

/** One foreign key, walkable in either direction. */
export interface SqlBuilderEdge {
  id: string
  a: string
  aColumn: string
  b: string
  bColumn: string
}

export interface SqlBuilderJoinStep {
  table: string
  edge: SqlBuilderEdge
  /** Added only to reach a chosen table. */
  via: boolean
  /** Every key that could join this table to the ones before it. */
  candidates: SqlBuilderEdge[]
}

const edgesOf = (schema: SqlBuilderTable[]): SqlBuilderEdge[] =>
  schema.flatMap((table) =>
    (table.foreignKeys ?? []).map((fk) => ({ id: `${table.name}.${fk.column}->${fk.table}.${fk.references}`, a: table.name, aColumn: fk.column, b: fk.table, bColumn: fk.references })),
  )
const other = (edge: SqlBuilderEdge, table: string) => (edge.a === table ? edge.b : edge.a)

/** Plans the joins: from the tables joined so far, breadth-first along foreign keys to each chosen table. */
export function planSqlBuilderJoins(schema: SqlBuilderTable[], query: SqlBuilderQuery): { steps: SqlBuilderJoinStep[]; errors: string[] } {
  const edges = edgesOf(schema)
  const [root, ...rest] = query.tables
  const joined = new Set(root ? [root] : [])
  const steps: SqlBuilderJoinStep[] = []
  const errors: string[] = []
  const candidatesFor = (table: string) => edges.filter((edge) => (edge.a === table && joined.has(edge.b)) || (edge.b === table && joined.has(edge.a)))
  for (const target of rest) {
    if (joined.has(target)) {
      const step = steps.find((s) => s.table === target)
      if (step) step.via = false
      continue
    }
    const override = query.joins[target]?.edge
    const direct = candidatesFor(target).find((edge) => edge.id === override)
    let path: SqlBuilderEdge[] | null = direct ? [direct] : null
    if (!path) {
      const previous = new Map<string, SqlBuilderEdge | null>([...joined].map((table) => [table, null]))
      const queue = [...joined]
      while (queue.length && !previous.has(target)) {
        const table = queue.shift()!
        for (const edge of edges.filter((e) => e.a === table || e.b === table)) {
          const next = other(edge, table)
          if (!previous.has(next)) previous.set(next, edge), queue.push(next)
        }
      }
      if (previous.has(target)) {
        path = []
        for (let at = target; previous.get(at); at = other(previous.get(at)!, at)) path.unshift(previous.get(at)!)
      }
    }
    if (!path) {
      errors.push(`No foreign-key path joins ${target} to ${[...joined].join(', ')}.`)
      continue
    }
    for (const edge of path) {
      const table = joined.has(edge.a) ? edge.b : edge.a
      steps.push({ table, edge, via: table !== target, candidates: candidatesFor(table) })
      joined.add(table)
    }
  }
  return { steps, errors }
}

const quoter = (dialect: SqlBuilderDialect) => (name: string) => (dialect === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`)
const literal = (value: string, dialect: SqlBuilderDialect) => `'${(dialect === 'mysql' ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''")}'`

/** SQL text and every reason it would fail, from the query. */
export function buildSqlBuilderQuery(schema: SqlBuilderTable[], query: SqlBuilderQuery, dialect: SqlBuilderDialect): { sql: string; errors: string[] } {
  if (query.tables.length === 0) return { sql: '', errors: ['Choose at least one table.'] }
  const q = quoter(dialect)
  const { steps, errors } = planSqlBuilderJoins(schema, query)
  const reachable = new Set([query.tables[0]!, ...steps.map((step) => step.table)])
  const typeOf = (id: string) => schema.find((t) => t.name === id.split('.')[0])?.columns.find((c) => c.name === id.split('.')[1])?.type
  const column = (id: string) => id.split('.').map(q).join('.')
  const columns = query.columns.filter((c) => c.id === '*' || reachable.has(c.id.split('.')[0]!))
  const aggregated = columns.filter((c) => c.aggregate !== 'none')
  const plain = columns.filter((c) => c.aggregate === 'none' && c.id !== '*').map((c) => c.id)
  const groupBy = aggregated.length ? query.groupBy ?? plain : query.groupBy ?? []

  for (const c of aggregated) if ((c.aggregate === 'sum' || c.aggregate === 'avg') && typeOf(c.id) !== 'number') errors.push(`${c.aggregate.toUpperCase()} needs a number column; ${c.id} is not one.`)
  if (aggregated.length || groupBy.length) for (const id of plain) if (!groupBy.includes(id)) errors.push(`${id} must be grouped or aggregated.`)

  const select = columns.length
    ? columns.map((c) => (c.id === '*' ? `COUNT(*) AS ${q('count')}` : c.aggregate === 'none' ? column(c.id) : `${c.aggregate.toUpperCase()}(${column(c.id)}) AS ${q(`${c.aggregate}_${c.id.split('.')[1]}`)}`))
    : ['*']
  const lines = [`SELECT ${select.join(',\n       ')}`, `FROM ${q(query.tables[0]!)}`]
  for (const step of steps) {
    const type = query.joins[step.table]?.type === 'left' ? 'LEFT JOIN' : 'JOIN'
    lines.push(`${type} ${q(step.table)} ON ${column(`${step.edge.a}.${step.edge.aColumn}`)} = ${column(`${step.edge.b}.${step.edge.bColumn}`)}`)
  }

  const conditions = query.where.flatMap((condition) => {
    if (!reachable.has(condition.field.split('.')[0]!)) return []
    const target = column(condition.field)
    const v = condition.value
    const number = () => {
      if (v.trim() === '' || !Number.isFinite(Number(v))) errors.push(`“${v}” is not a number for ${condition.field}.`)
      return String(Number(v))
    }
    switch (condition.operator) {
      case 'empty': return [`(${target} IS NULL OR ${target} = '')`]
      case 'not_empty': return [`${target} <> ''`]
      case 'contains': return v ? [`${target} LIKE ${literal(`%${v}%`, dialect)}`] : []
      case 'starts_with': return v ? [`${target} LIKE ${literal(`${v}%`, dialect)}`] : []
      case 'is': return v ? [`${target} = ${typeOf(condition.field) === 'boolean' ? v.toUpperCase() : literal(v, dialect)}`] : []
      case 'is_not': return v ? [`${target} <> ${typeOf(condition.field) === 'boolean' ? v.toUpperCase() : literal(v, dialect)}`] : []
      case 'before': return v ? [`${target} < ${literal(v, dialect)}`] : []
      case 'after': return v ? [`${target} > ${literal(v, dialect)}`] : []
      default: {
        if (v === '') return []
        const op = { eq: '=', neq: '<>', gt: '>', lt: '<' }[condition.operator] ?? '='
        return [`${target} ${op} ${number()}`]
      }
    }
  })
  if (conditions.length) lines.push(`WHERE ${conditions.join(query.match === 'all' ? '\n  AND ' : '\n   OR ')}`)
  if (groupBy.length) lines.push(`GROUP BY ${groupBy.map(column).join(', ')}`)
  const order = query.orderBy.filter((o) => o.column && reachable.has(o.column.split('.')[0]!))
  for (const o of order) if (groupBy.length && !groupBy.includes(o.column)) errors.push(`Ordering by ${o.column} needs it in GROUP BY.`)
  if (order.length) lines.push(`ORDER BY ${order.map((o) => `${column(o.column)} ${o.direction.toUpperCase()}`).join(', ')}`)
  if (query.limit.trim()) {
    if (!/^\d+$/.test(query.limit.trim()) || Number(query.limit) === 0) errors.push('Limit must be a whole number above zero.')
    else lines.push(`LIMIT ${Number(query.limit)}`)
  }
  return { sql: `${lines.join('\n')};`, errors }
}

const EMPTY: SqlBuilderQuery = { tables: [], joins: {}, columns: [], groupBy: null, where: [], match: 'all', orderBy: [], limit: '100' }
const AGGREGATES: { value: SqlBuilderAggregate; label: string }[] = [
  { value: 'none', label: 'Value' },
  { value: 'count', label: 'COUNT' },
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
]

/**
 * A query builder that knows the schema, so choosing two tables is enough to
 * get the join right.
 *
 * Joins are found by walking the foreign keys breadth-first from the tables
 * already in the query, so the shortest path wins and any table in between is
 * added and labelled as such; when a pair has more than one key between them —
 * billing and shipping address — the key can be chosen. Grouping follows the
 * select list unless it is set by hand, and the SQL is written as you go with
 * identifiers quoted for the chosen dialect, beside the list of reasons the
 * database would refuse it.
 */
export function SqlBuilder({ schema, value, defaultValue = EMPTY, onValueChange, defaultDialect = 'postgres', onSqlChange, className }: SqlBuilderProps) {
  const uid = useId()
  const [own, setOwn] = useState(defaultValue)
  const query = value ?? own
  const [dialect, setDialect] = useState<SqlBuilderDialect>(defaultDialect)
  const update = (patch: Partial<SqlBuilderQuery>) => {
    const next = { ...query, ...patch }
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
  }

  const { steps } = planSqlBuilderJoins(schema, query)
  const { sql, errors } = buildSqlBuilderQuery(schema, query, dialect)
  const inQuery = [...(query.tables[0] ? [query.tables[0]] : []), ...steps.map((step) => step.table)]
  const allColumns = inQuery.flatMap((name) => (schema.find((t) => t.name === name)?.columns ?? []).map((c) => ({ id: `${name}.${c.name}`, type: c.type })))
  const aggregating = query.columns.some((c) => c.aggregate !== 'none')
  const autoGroup = query.columns.filter((c) => c.aggregate === 'none' && c.id !== '*').map((c) => c.id)

  const report = useRef(onSqlChange)
  report.current = onSqlChange
  const errorKey = errors.join('|')
  useEffect(() => report.current?.(sql, errorKey ? errorKey.split('|') : []), [sql, errorKey])

  const fields: FilterField[] = allColumns.map((c) => ({
    id: c.id,
    label: c.id,
    type: c.type === 'boolean' ? 'select' : c.type,
    ...(c.type === 'boolean' ? { options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }] } : {}),
  }))

  const toggleTable = (name: string, on: boolean) => {
    const tables = on ? [...query.tables, name] : query.tables.filter((t) => t !== name)
    update({ tables, columns: query.columns.filter((c) => c.id === '*' || tables.includes(c.id.split('.')[0]!) || on) })
  }
  const setColumn = (id: string, aggregate: SqlBuilderAggregate | null) =>
    update({ columns: aggregate === null ? query.columns.filter((c) => c.id !== id) : query.columns.some((c) => c.id === id) ? query.columns.map((c) => (c.id === id ? { id, aggregate } : c)) : [...query.columns, { id, aggregate }] })

  const heading = (text: string) => (
    <Text as="h3" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
      {text}
    </Text>
  )

  return (
    <div className={cn('grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', className)}>
      <div className="flex min-w-0 flex-col gap-5">
        <section className="flex flex-col gap-2" aria-labelledby={`${uid}-tables`}>
          <span id={`${uid}-tables`}>{heading('Tables')}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {schema.map((table) => (
              <label key={table.name} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Checkbox boxSize="sm" checked={query.tables.includes(table.name)} onChange={(event) => toggleTable(table.name, event.target.checked)} />
                {table.name}
                {query.tables[0] === table.name && <span className="text-[10px] font-bold uppercase text-ink-faint">from</span>}
              </label>
            ))}
          </div>
          {steps.length > 0 && (
            <ol aria-label="Joins" className="flex flex-col gap-1.5">
              {steps.map((step) => (
                <li key={step.table} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-tile)] bg-surface-sunken px-2.5 py-1.5">
                  <SegmentedControl
                    label={`Join type for ${step.table}`}
                    size="sm"
                    value={query.joins[step.table]?.type ?? 'inner'}
                    onValueChange={(type) => update({ joins: { ...query.joins, [step.table]: { ...query.joins[step.table], type } } })}
                    options={[
                      { value: 'inner', label: 'Inner' },
                      { value: 'left', label: 'Left' },
                    ]}
                  />
                  <Text as="span" size="label" weight="bold">
                    {step.table}
                  </Text>
                  {step.via && <span className="text-[10px] font-bold uppercase text-ink-faint">added to connect</span>}
                  {step.candidates.length > 1 && !step.via ? (
                    <Select
                      label={`Key joining ${step.table}`}
                      size="sm"
                      value={step.edge.id}
                      onValueChange={(edge) => update({ joins: { ...query.joins, [step.table]: { type: query.joins[step.table]?.type ?? 'inner', edge } } })}
                      options={step.candidates.map((edge) => ({ value: edge.id, label: `on ${edge.a}.${edge.aColumn} = ${edge.b}.${edge.bColumn}` }))}
                    />
                  ) : (
                    <Text as="span" size="caption" tone="soft" className="font-mono">
                      on {step.edge.a}.{step.edge.aColumn} = {step.edge.b}.{step.edge.bColumn}
                    </Text>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {inQuery.length > 0 && (
          <section className="flex flex-col gap-2" aria-labelledby={`${uid}-columns`}>
            <span id={`${uid}-columns`}>{heading('Columns')}</span>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Checkbox boxSize="sm" checked={query.columns.some((c) => c.id === '*')} onChange={(event) => setColumn('*', event.target.checked ? 'count' : null)} />
              COUNT(*)
            </label>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {allColumns.map((c) => {
                const chosen = query.columns.find((item) => item.id === c.id)
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[12px] text-ink">
                      <Checkbox boxSize="sm" checked={Boolean(chosen)} onChange={(event) => setColumn(c.id, event.target.checked ? 'none' : null)} />
                      <span className="truncate">{c.id}</span>
                    </label>
                    {chosen && (
                      <Select label={`Aggregate for ${c.id}`} size="sm" value={chosen.aggregate} onValueChange={(aggregate) => setColumn(c.id, aggregate)} options={AGGREGATES} />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {(aggregating || query.groupBy) && (
          <section className="flex flex-col gap-2" aria-labelledby={`${uid}-group`}>
            <span id={`${uid}-group`}>{heading('Group by')}</span>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Switch switchSize="sm" checked={query.groupBy === null} onChange={(event) => update({ groupBy: event.target.checked ? null : autoGroup })} />
              Group by every column that is not aggregated
            </label>
            {query.groupBy === null ? (
              <Text size="caption" tone="soft" className="font-mono">
                {autoGroup.length ? autoGroup.join(', ') : 'Nothing to group — the whole result is one row.'}
              </Text>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {allColumns.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 font-mono text-[12px] text-ink">
                    <Checkbox
                      boxSize="sm"
                      checked={query.groupBy!.includes(c.id)}
                      onChange={(event) => update({ groupBy: event.target.checked ? [...query.groupBy!, c.id] : query.groupBy!.filter((id) => id !== c.id) })}
                    />
                    {c.id}
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        {inQuery.length > 0 && (
          <section className="flex flex-col gap-2" aria-labelledby={`${uid}-where`}>
            <span id={`${uid}-where`}>{heading('Where')}</span>
            <FilterBuilder label="Where conditions" fields={fields} value={query.where} onChange={(where) => update({ where })} match={query.match} onMatchChange={(match) => update({ match })} />
          </section>
        )}

        {inQuery.length > 0 && (
          <section className="flex flex-col gap-2" aria-labelledby={`${uid}-order`}>
            <span id={`${uid}-order`}>{heading('Order and limit')}</span>
            {query.orderBy.map((o, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  label={`Order ${i + 1} column`}
                  size="sm"
                  value={o.column}
                  onValueChange={(column) => update({ orderBy: query.orderBy.map((item, j) => (j === i ? { ...item, column } : item)) })}
                  options={allColumns.map((c) => ({ value: c.id, label: c.id }))}
                />
                <SegmentedControl
                  label={`Order ${i + 1} direction`}
                  size="sm"
                  value={o.direction}
                  onValueChange={(direction) => update({ orderBy: query.orderBy.map((item, j) => (j === i ? { ...item, direction } : item)) })}
                  options={[
                    { value: 'asc', label: 'Asc' },
                    { value: 'desc', label: 'Desc' },
                  ]}
                />
                <IconButton icon={CrossIcon} size="xs" label={`Remove order ${i + 1}`} onClick={() => update({ orderBy: query.orderBy.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => update({ orderBy: [...query.orderBy, { column: allColumns[0]!.id, direction: 'asc' }] })}>
                <PlusIcon size={14} /> Order by
              </Button>
              <Input aria-label="Limit" inputSize="sm" inputMode="numeric" value={query.limit} placeholder="No limit" onChange={(event) => update({ limit: event.target.value })} containerClassName="w-28" />
            </div>
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            label="SQL dialect"
            size="sm"
            value={dialect}
            onValueChange={setDialect}
            options={[
              { value: 'postgres', label: 'PostgreSQL' },
              { value: 'mysql', label: 'MySQL' },
            ]}
          />
          <CopyButton value={sql} size="sm" />
        </div>
        <pre role="region" aria-label="Generated SQL" tabIndex={0} className="min-h-40 overflow-x-auto rounded-[var(--radius-tile)] bg-surface-sunken p-3 font-mono text-[12px] leading-[1.6] text-ink">
          {sql || '-- Choose a table to start.'}
        </pre>
        <div role="status" aria-label="Validation">
        <ul className="flex flex-col gap-1">
          {errors.map((error) => (
            <li key={error} className="text-[12px] font-semibold text-danger">
              {error}
            </li>
          ))}
          {errors.length === 0 && sql && <li className="text-[12px] font-semibold text-success">Valid for {dialect === 'postgres' ? 'PostgreSQL' : 'MySQL'}.</li>}
        </ul>
        </div>
      </div>
    </div>
  )
}
