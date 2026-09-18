import { cn } from '../../lib/cn'
import { Tag } from '../Tag'
import { Text } from '../Text'

export type DataProfileType = 'number' | 'date' | 'boolean' | 'categorical' | 'string' | 'empty'

export interface DataProfileBin {
  label: string
  count: number
}

export interface DataProfileColumn {
  name: string
  type: DataProfileType
  count: number
  /** null, undefined, NaN and empty strings. */
  missing: number
  distinct: number
  /** Numbers and dates only; dates as epoch milliseconds. */
  min?: number
  max?: number
  mean?: number
  median?: number
  /** Values outside 1.5 × IQR of the quartiles. */
  outliers?: number
  /** Most common values, for categoricals, booleans and strings. */
  top: { value: string; count: number }[]
  histogram: DataProfileBin[]
  /** Human-readable anomaly flags — mixed types, outliers, mostly null. */
  flags: string[]
}

export interface DataProfileProps {
  /** The records to profile. */
  data: Record<string, unknown>[]
  /** Columns in display order. Defaults to every key seen, in first-seen order. */
  columns?: string[]
  /** Strings with at most this many distinct values are treated as categories. */
  maxCategories?: number
  /** Histogram bins for numbers and dates. */
  bins?: number
  /** Heading level for each column's name, so the cards sit under the page's outline. */
  headingLevel?: 'h2' | 'h3' | 'h4' | 'h5'
  /** Merged last, so it wins. */
  className?: string
}

type Kind = 'number' | 'date' | 'boolean' | 'string'

const NUMERIC = /^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

const isMissing = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) || (typeof value === 'string' && value.trim() === '')

/** What a single value is, and its numeric reading where it has one. */
function classify(value: unknown): { kind: Kind; number?: number } {
  if (typeof value === 'number') return { kind: 'number', number: value }
  if (typeof value === 'boolean') return { kind: 'boolean' }
  if (value instanceof Date) return { kind: 'date', number: value.getTime() }
  const text = String(value)
  if (/^(true|false)$/i.test(text)) return { kind: 'boolean' }
  if (NUMERIC.test(text)) return { kind: 'number', number: Number(text) }
  if (ISO_DATE.test(text.trim()) && !Number.isNaN(Date.parse(text))) return { kind: 'date', number: Date.parse(text) }
  return { kind: 'string' }
}

/** R-7 quantile of an ascending array — the same method as the chart helpers, kept here so this stays a server component. */
function quantile(sorted: number[], p: number) {
  const position = (sorted.length - 1) * p
  const base = Math.floor(position)
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + (position - base) * (next - sorted[base])
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

const compact = (value: number) =>
  Math.abs(value) >= 1e6 || (Math.abs(value) < 0.01 && value !== 0)
    ? value.toPrecision(3)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })

const day = (value: number) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Profiles one column. */
function profileDataColumn(name: string, raw: unknown[], maxCategories = 12, bins = 12): DataProfileColumn {
  const present = raw.filter((value) => !isMissing(value))
  const missing = raw.length - present.length
  const classified = present.map((value) => ({ value, ...classify(value) }))
  const kinds = tally(classified.map((item) => item.kind))
  const main = (kinds[0]?.value ?? 'string') as Kind
  const flags: string[] = []

  const off = classified.length - (kinds[0]?.count ?? 0)
  if (off > 0) flags.push(`Mixed types: ${kinds.slice(1).map((kind) => `${kind.count} ${kind.value === 'string' ? 'text' : kind.value}`).join(', ')} values in a ${main} column`)
  if (raw.length > 0 && missing / raw.length > 0.5) flags.push(`Mostly empty: ${Math.round((missing / raw.length) * 100)}% missing`)

  const strings = present.map((value) => (value instanceof Date ? value.toISOString() : String(value)))
  const distinct = new Set(strings.map((value) => (main === 'boolean' ? value.toLowerCase() : value))).size
  const base = { name, count: raw.length, missing, distinct, flags, top: [] as DataProfileColumn['top'], histogram: [] as DataProfileBin[] }

  if (present.length === 0) return { ...base, type: 'empty' }

  if (main === 'number' || main === 'date') {
    const numbers = classified.filter((item) => item.kind === main).map((item) => item.number as number).sort((a, b) => a - b)
    const min = numbers[0]
    const max = numbers[numbers.length - 1]
    const q1 = quantile(numbers, 0.25)
    const q3 = quantile(numbers, 0.75)
    const fence = 1.5 * (q3 - q1)
    const outliers = numbers.filter((value) => value < q1 - fence || value > q3 + fence).length
    if (outliers > 0 && main === 'number') flags.push(`${outliers} ${outliers === 1 ? 'outlier' : 'outliers'} beyond 1.5 × IQR`)
    const count = Math.max(1, Math.min(bins, distinct))
    const width = (max - min) / count || 1
    const histogram = Array.from({ length: count }, (_, index) => {
      const from = min + index * width
      return { label: main === 'date' ? `${day(from)} – ${day(from + width)}` : `${compact(from)} – ${compact(from + width)}`, count: 0 }
    })
    for (const value of numbers) histogram[Math.min(count - 1, Math.floor((value - min) / width))].count += 1
    return {
      ...base,
      type: main,
      min,
      max,
      mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      median: quantile(numbers, 0.5),
      outliers,
      histogram,
    }
  }

  const top = tally(main === 'boolean' ? strings.map((value) => value.toLowerCase()) : strings)
  const categorical = main === 'boolean' || distinct <= maxCategories || distinct / present.length <= 0.2
  return {
    ...base,
    type: main === 'boolean' ? 'boolean' : categorical ? 'categorical' : 'string',
    top: top.slice(0, 5),
    histogram: categorical ? top.slice(0, 8).map(({ value, count }) => ({ label: value, count })) : [],
  }
}

function Bars({ column }: { column: DataProfileColumn }) {
  const bins = column.histogram
  if (!bins.length) return null
  const peak = Math.max(...bins.map((bin) => bin.count), 1)
  const categorical = column.type === 'categorical' || column.type === 'boolean'
  const summary = categorical
    ? bins.map((bin) => `${bin.label} ${bin.count}`).join(', ')
    : `${bins.length} bins from ${bins[0].label.split(' – ')[0]} to ${bins[bins.length - 1].label.split(' – ')[1]}; tallest ${peak}`
  return (
    <svg viewBox={`0 0 ${bins.length * 10} 40`} preserveAspectRatio="none" className="h-10 w-full" role="img" aria-label={`Distribution of ${column.name}: ${summary}`}>
      {bins.map((bin, index) => {
        const height = (bin.count / peak) * 38
        return (
          <rect key={index} x={index * 10 + 1} y={40 - Math.max(height, bin.count ? 1.5 : 0)} width={8} height={Math.max(height, bin.count ? 1.5 : 0)} rx={1} className={categorical && index > 0 ? 'fill-[color-mix(in_oklab,var(--color-accent)_45%,transparent)]' : 'fill-accent'}>
            <title>{`${bin.label}: ${bin.count}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

const TYPE_LABEL: Record<DataProfileType, string> = {
  number: 'number',
  date: 'date',
  boolean: 'boolean',
  categorical: 'category',
  string: 'text',
  empty: 'empty',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="truncate text-[12px] font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/**
 * A first look at a dataset, one card per column — the checks you would
 * otherwise type into a notebook before trusting it.
 *
 * Each column’s type is inferred from its values rather than trusted from a
 * header: numeric strings count as numbers, ISO strings as dates, and a text
 * column with few distinct values is a category. Missing values (null, empty,
 * NaN) are counted apart, and the card flags what usually breaks an analysis
 * later — a column that mixes types, outliers beyond 1.5 × IQR, a column that
 * is mostly empty. Numbers and dates get range, mean, median and a histogram;
 * categories get their commonest values.
 */
export function DataProfile({ data, columns, maxCategories = 12, bins = 12, headingLevel = 'h3', className }: DataProfileProps) {
  const names = columns ?? [...new Set(data.flatMap((row) => Object.keys(row)))]
  const profiles = names.map((name) => profileDataColumn(name, data.map((row) => row[name]), maxCategories, bins))
  const cells = data.length * names.length
  const missing = profiles.reduce((sum, column) => sum + column.missing, 0)
  const flagged = profiles.filter((column) => column.flags.length).length

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Text size="label" tone="soft">
        {`${data.length.toLocaleString()} rows · ${names.length} columns · ${cells ? ((missing / cells) * 100).toFixed(1) : 0}% of cells missing · ${flagged} ${flagged === 1 ? 'column' : 'columns'} flagged`}
      </Text>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((column) => {
          const isDate = column.type === 'date'
          const show = (value?: number) => (value === undefined ? '—' : isDate ? day(value) : compact(value))
          const missingShare = column.count ? column.missing / column.count : 0
          return (
            <li key={column.name} className="flex flex-col gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <Text as={headingLevel} size="body" className="min-w-0 break-all font-mono text-[13px]">{column.name}</Text>
                <Tag size="sm" tone={column.type === 'empty' ? 'outline' : 'neutral'}>{TYPE_LABEL[column.type]}</Tag>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-medium text-ink-soft">
                  <span>{`${(missingShare * 100).toFixed(missingShare > 0 && missingShare < 0.01 ? 1 : 0)}% missing`}</span>
                  <span>{`${column.distinct.toLocaleString()} distinct`}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                  <div className={cn('h-full rounded-full', missingShare > 0.5 ? 'bg-danger' : 'bg-ink-faint')} style={{ width: `${missingShare * 100}%` }} />
                </div>
              </div>
              {(column.type === 'number' || isDate) && (
                <dl className="grid grid-cols-4 gap-2">
                  <Stat label="Min" value={show(column.min)} />
                  <Stat label="Max" value={show(column.max)} />
                  <Stat label="Mean" value={show(column.mean)} />
                  <Stat label="Median" value={show(column.median)} />
                </dl>
              )}
              <Bars column={column} />
              {column.type !== 'number' && !isDate && column.top.length > 0 && (
                <ol className="flex flex-col gap-0.5 text-[12px]" aria-label={`Most common values in ${column.name}`}>
                  {column.top.slice(0, 3).map((item) => (
                    <li key={item.value} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-ink-soft">{item.value}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">{item.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
              {column.flags.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label={`Warnings for ${column.name}`}>
                  {column.flags.map((flag) => (
                    <li key={flag} className="rounded-[8px] bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)] px-2 py-1 text-[11px] font-semibold text-[color-mix(in_oklab,var(--color-warning)_40%,var(--color-ink))]">
                      {flag}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
