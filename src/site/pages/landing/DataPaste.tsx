import { useMemo, useRef, useState } from 'react'
import { ClipboardPaste, Table2, Upload } from 'lucide-react'
import {
  AreaChart,
  BarChart,
  Button,
  CodeBlock,
  DataTable,
  PivotTable,
  StatCard,
  Tag,
  Text,
  Textarea,
  VisuallyHidden,
  cn,
  convert,
  inferColumn,
  readCsv,
  sniffDelimiter,
  type CsvImportColumn,
  type DataTableColumn,
} from 'klyv'
import { LandingSection } from './primitives'

/**
 * "Bring your own data": paste a spreadsheet and watch it become the
 * components.
 *
 * Evaluating a component library means imagining your own numbers in it. This
 * does the imagining: anything pasted — CSV, TSV, or a block of cells copied
 * straight out of a spreadsheet — is sniffed for its delimiter, read, and
 * typed column by column with the library's own CSV parser, then handed to a
 * table, a chart and a pivot. The code underneath is written for the columns
 * that were found, so it can be taken away and run.
 *
 * It is all local: the text goes from the clipboard into the parser in this
 * tab and nowhere else. A file dropped on the card is read with FileReader
 * for the same reason.
 */

/** What a parsed sheet looks like once its columns have been typed. */
interface Sheet {
  columns: CsvImportColumn[]
  rows: (string | number | boolean | null)[][]
  skipped: number
}

const SAMPLES = [
  {
    id: 'revenue',
    label: 'Revenue by region',
    text: `Month,Region,Revenue,Expenses
2026-04,EMEA,128400,74200
2026-04,Americas,196300,101800
2026-04,APAC,88100,52600
2026-05,EMEA,134900,76100
2026-05,Americas,204700,104500
2026-05,APAC,93800,55200
2026-06,EMEA,141200,78400
2026-06,Americas,218600,109300
2026-06,APAC,101500,58900`,
  },
  {
    id: 'tickets',
    label: 'Support tickets',
    text: `Week,Team,Opened,Resolved,First response (min)
W18,Billing,142,138,11
W18,Platform,96,91,19
W18,Mobile,64,70,24
W19,Billing,155,149,9
W19,Platform,88,94,17
W19,Mobile,71,66,28
W20,Billing,133,140,10
W20,Platform,102,97,21
W20,Mobile,58,61,22`,
  },
] as const

const LIMIT = 2000
const GROUPS = 40

/** Read pasted text into typed columns and converted rows. */
function parseSheet(text: string): Sheet | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const raw = readCsv(trimmed, sniffDelimiter(trimmed)).rows
  if (raw.length < 2) return null

  const header = raw[0].cells.map((cell, index) => cell.trim() || `Column ${index + 1}`)
  const body = raw.slice(1).filter((row) => row.cells.some((cell) => cell.trim() !== ''))
  if (body.length === 0) return null

  const kept = body.slice(0, LIMIT)
  const columns = header.map((name, index) =>
    inferColumn(
      name,
      kept.map((row) => row.cells[index] ?? ''),
    ),
  )
  const rows = kept.map((row) => columns.map((column, index) => convert(row.cells[index] ?? '', column).value))
  return { columns, rows, skipped: body.length - kept.length }
}

export function DataPaste() {
  const [text, setText] = useState<string>(SAMPLES[0].text)
  const [source, setSource] = useState<string>(SAMPLES[0].label)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const sheet = useMemo(() => parseSheet(text), [text])
  const numeric = sheet ? sheet.columns.map((column, index) => ({ column, index })).filter((entry) => entry.column.type === 'number') : []
  const labels = sheet ? sheet.columns.map((column, index) => ({ column, index })).filter((entry) => entry.column.type !== 'number') : []

  const [labelPick, setLabelPick] = useState<number | null>(null)
  const labelIndex = labelPick !== null && sheet?.columns[labelPick] ? labelPick : (labels[0]?.index ?? null)
  const measures = numeric.slice(0, 3)

  const take = (next: string, from: string) => {
    setText(next)
    setSource(from)
    setLabelPick(null)
  }

  const readFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => take(String(reader.result ?? ''), file.name)
    reader.readAsText(file)
  }

  return (
    <LandingSection
      id="your-data"
      index={13}
      eyebrow="Your data"
      title="Paste your own numbers."
      tail="Watch them become the components."
      lede="Copy a block of cells out of a spreadsheet and drop it in. The columns are sniffed and typed by the library's own CSV parser, then handed to a real table, chart and pivot — with the code for your columns underneath. It never leaves this tab."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* What they paste. */}
        <div
          onDragEnter={(event) => {
            if (Array.from(event.dataTransfer.types).includes('Files')) setDragging(true)
          }}
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault()
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            readFile(event.dataTransfer.files[0])
          }}
          className={cn(
            'flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border-2 border-dashed bg-surface p-4 transition-colors sm:p-5',
            dragging ? 'border-accent-strong bg-accent-soft/40' : 'border-line',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => take(sample.text, sample.label)}
                aria-pressed={source === sample.label}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  source === sample.label
                    ? 'border-transparent bg-accent text-accent-ink'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {sample.label}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="ml-auto">
              <Upload size={14} aria-hidden />
              CSV file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                readFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <Text as="span" size="label" weight="semibold">
              Your data
            </Text>
            <Text as="span" size="caption" tone="faint">
              CSV, TSV, or cells copied from a spreadsheet. Drop a file on this card too.
            </Text>
            <Textarea
              rows={12}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setSource('what you pasted')
              }}
              className="font-mono text-[12px]"
            />
          </label>

          {sheet && (
            <div className="flex flex-wrap items-center gap-1.5">
              {sheet.columns.map((column, index) => (
                <Tag key={`${column.name}-${index}`} size="sm" tone={column.type === 'number' ? 'accent' : 'outline'}>
                  {column.name} · {column.type}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* What it becomes. */}
        <div className="flex min-w-0 flex-col gap-3">
          {!sheet || measures.length === 0 || labelIndex === null ? (
            <Empty hasSheet={Boolean(sheet)} />
          ) : (
            <Rendered sheet={sheet} labelIndex={labelIndex} measures={measures} source={source} onLabelPick={setLabelPick} labels={labels} />
          )}
        </div>
      </div>
    </LandingSection>
  )
}

/** Honest about what is missing, rather than an empty frame. */
function Empty({ hasSheet }: { hasSheet: boolean }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-ink">
        <ClipboardPaste size={24} aria-hidden />
      </span>
      <Text as="p" size="heading" className="text-[17px]">
        {hasSheet ? 'No number column found' : 'Nothing to read yet'}
      </Text>
      <Text size="caption" tone="soft" className="max-w-[42ch]">
        {hasSheet
          ? 'A chart and a pivot both need something to measure. Add a column of figures — the first row is read as the header.'
          : 'Paste a header row and at least one row under it, or pick one of the samples.'}
      </Text>
    </div>
  )
}

/** The visitor's data, in the components. */
function Rendered({
  sheet,
  labelIndex,
  measures,
  source,
  labels,
  onLabelPick,
}: {
  sheet: Sheet
  labelIndex: number
  measures: { column: CsvImportColumn; index: number }[]
  source: string
  labels: { column: CsvImportColumn; index: number }[]
  onLabelPick: (index: number) => void
}) {
  const labelColumn = sheet.columns[labelIndex]
  const isDate = labelColumn.type === 'date'

  // One point per label, summed: a sheet is usually longer than a chart wants,
  // and a category repeated down the rows is the normal shape of an export.
  const grouped = useMemo(() => {
    const order: string[] = []
    const sums = new Map<string, number[]>()
    for (const row of sheet.rows) {
      const key = String(row[labelIndex] ?? '—')
      if (!sums.has(key)) {
        sums.set(key, measures.map(() => 0))
        order.push(key)
      }
      const bucket = sums.get(key)!
      measures.forEach((measure, slot) => {
        const value = row[measure.index]
        if (typeof value === 'number' && Number.isFinite(value)) bucket[slot] += value
      })
    }
    const categories = order.slice(0, GROUPS)
    return {
      categories,
      series: measures.map((measure, slot) => ({
        id: measure.column.name,
        label: measure.column.name,
        values: categories.map((key) => sums.get(key)![slot]),
      })),
      hidden: order.length - categories.length,
    }
  }, [sheet, labelIndex, measures])

  const first = grouped.series[0]
  const total = first.values.reduce((sum, value) => sum + value, 0)
  const average = total / Math.max(1, first.values.length)
  const format = (value: number) =>
    Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k` : value.toFixed(Math.abs(value) < 10 ? 1 : 0)

  const tableColumns: DataTableColumn<{ id: string; cells: Sheet['rows'][number] }>[] = sheet.columns.map((column, index) => ({
    id: `${column.name}-${index}`,
    header: column.name,
    cell: (row) => formatCell(row.cells[index]),
    sortValue: (row) => {
      const value = row.cells[index]
      return typeof value === 'number' ? value : String(value ?? '')
    },
    align: column.type === 'number' ? 'right' : undefined,
    tabular: column.type === 'number',
  }))
  const tableRows = sheet.rows.map((cells, index) => ({ id: String(index), cells }))

  const Chart = isDate ? AreaChart : BarChart
  const records = sheet.rows.map((cells) => Object.fromEntries(sheet.columns.map((column, index) => [column.name, cells[index] as string | number | null])))
  const dimensions = labels.map((entry) => ({ key: entry.column.name, label: entry.column.name }))
  const pivotMeasures = measures.map((entry) => ({ key: entry.column.name, label: entry.column.name, format }))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span" size="caption" tone="soft">
          Charting
        </Text>
        {labels.length > 1 &&
          labels.map((entry) => (
            <button
              key={entry.index}
              type="button"
              aria-pressed={entry.index === labelIndex}
              onClick={() => onLabelPick(entry.index)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                entry.index === labelIndex ? 'border-line-strong bg-surface text-ink' : 'border-transparent text-ink-soft hover:text-ink',
              )}
            >
              by {entry.column.name}
            </button>
          ))}
        <Text as="span" size="caption" tone="faint" className="ml-auto">
          {sheet.rows.length} rows{sheet.skipped > 0 && ` (first ${LIMIT} of ${sheet.rows.length + sheet.skipped})`} from {source}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard title={`Total ${first.label}`} value={format(total)} caption={`Across ${grouped.categories.length} ${labelColumn.name.toLowerCase()} values`} />
        <StatCard title={`Average ${first.label}`} value={format(average)} caption={`Per ${labelColumn.name.toLowerCase()}`} />
        <StatCard title="Columns" value={String(sheet.columns.length)} caption={`${measures.length} measured`} className="hidden sm:flex" />
      </div>

      <figure className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <figcaption className="flex items-center justify-between gap-3">
          <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
            {isDate ? '<AreaChart />' : '<BarChart />'}
          </Text>
          {grouped.hidden > 0 && (
            <Text as="span" size="micro" tone="faint">
              first {GROUPS} of {grouped.categories.length + grouped.hidden}
            </Text>
          )}
        </figcaption>
        <Chart
          series={grouped.series}
          categories={grouped.categories}
          format={format}
          height={240}
          label={`${grouped.series.map((entry) => entry.label).join(' and ')} by ${labelColumn.name}`}
        />
      </figure>

      <figure className="flex flex-col gap-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <figcaption className="flex items-center gap-2">
          <Table2 size={13} aria-hidden className="text-ink-faint" />
          <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
            {'<DataTable />'}
          </Text>
        </figcaption>
        <DataTable columns={tableColumns} rows={tableRows} rowId={(row) => row.id} pageSize={6} label={`${source}, as a table`} />
      </figure>

      {dimensions.length > 0 && (
        <figure className="flex flex-col gap-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <figcaption className="flex items-center gap-2">
            <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
              {'<PivotTable />'}
            </Text>
            <Text as="span" size="micro" tone="faint">
              drag the fields to re-cut it
            </Text>
          </figcaption>
          <PivotTable
            records={records}
            dimensions={dimensions}
            measures={pivotMeasures}
            defaultValue={{ rows: [dimensions[0].key], columns: dimensions[1] ? [dimensions[1].key] : [], measure: pivotMeasures[0].key }}
            label={`${source}, pivoted`}
          />
        </figure>
      )}

      <div className="flex flex-col gap-2">
        <Text as="span" size="label" weight="semibold">
          The code, for your columns
        </Text>
        <CodeBlock language="tsx" code={snippet(grouped, labelColumn.name, isDate)} />
        <VisuallyHidden>
          <span role="status" aria-live="polite">
            {sheet.rows.length} rows read, {measures.length} measured columns found.
          </span>
        </VisuallyHidden>
      </div>
    </>
  )
}

const formatCell = (value: string | number | boolean | null) =>
  value === null || value === undefined ? '—' : typeof value === 'number' ? value.toLocaleString() : String(value)

/** The chart they are looking at, as code they can paste, with their data in it. */
function snippet(
  grouped: { categories: string[]; series: { id: string; label: string; values: number[] }[] },
  labelName: string,
  isDate: boolean,
): string {
  const cut = 8
  const categories = grouped.categories.slice(0, cut)
  const more = grouped.categories.length - categories.length
  const name = isDate ? 'AreaChart' : 'BarChart'
  const series = grouped.series
    .map((entry) => `  { id: '${entry.id}', label: '${entry.label}', values: [${entry.values.slice(0, cut).join(', ')}${more > 0 ? ', /* … */' : ''}] },`)
    .join('\n')
  return `import { ${name} } from 'klyv'

const categories = [${categories.map((value) => `'${value}'`).join(', ')}${more > 0 ? `, /* … ${more} more */` : ''}]

const series = [
${series}
]

<${name} series={series} categories={categories} label="${grouped.series.map((entry) => entry.label).join(' and ')} by ${labelName}" />`
}
