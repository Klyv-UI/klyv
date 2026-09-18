'use client'

import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Select } from '../Select'
import { Textarea } from '../Textarea'
import {
  CsvImportReader,
  convert,
  inferColumn,
  looksLikeHeader,
  sniffDelimiter,
  type CsvImportColumn,
  type CsvImportDelimiter,
  type CsvImportIssue,
  type CsvImportRawRow,
  type CsvImportValue,
} from './csv'

export interface CsvImportResult {
  /** Columns in file order, with their inferred types. */
  columns: CsvImportColumn[]
  /** Typed rows keyed by column name: numbers, booleans, ISO date strings, text, or null for empty. */
  rows: Record<string, CsvImportValue>[]
  /** Problems found, by line. */
  issues: CsvImportIssue[]
  delimiter: CsvImportDelimiter
  /** Whether the delimiter was sniffed rather than given. */
  sniffed: boolean
  /** Whether the first row was read as column names. */
  hasHeader: boolean
}

export interface CsvImportProps {
  /** Called with the typed rows when the import button is pressed. */
  onImport?: (result: CsvImportResult) => void
  /** Called after every successful read, before import. */
  onParsed?: (result: CsvImportResult) => void
  /** Field separator, or `auto` to sniff it from the first lines. */
  delimiter?: CsvImportDelimiter | 'auto'
  /** Whether the first row names the columns, or `auto` to decide from the data. */
  header?: boolean | 'auto'
  /** Rows shown in the preview table. */
  previewRows?: number
  /** Bytes read per step when streaming a file. */
  chunkSize?: number
  /** Text in the paste box at first — handy for demos. */
  defaultText?: string
  /** A file to read as if it had been dropped; a new File object reads again. */
  file?: File | null
  /** Label of the import button. */
  importLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

type Source = { kind: 'file'; file: File } | { kind: 'text'; text: string }

const DELIMITERS: { value: CsvImportDelimiter | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Detect' },
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe' },
]
const DELIMITER_NAME: Record<CsvImportDelimiter, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' }
const TYPE_LABEL = { number: 'number', boolean: 'yes/no', date: 'date', string: 'text', empty: 'empty' }

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function readSlice(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

/** Unique, non-empty names: blank headers get a position, repeats get a suffix. */
function names(cells: string[], width: number) {
  const seen = new Map<string, number>()
  return Array.from({ length: width }, (_, index) => {
    const base = cells[index]?.trim() || `Column ${index + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count > 1 ? `${base} ${count}` : base
  })
}

/**
 * Brings a CSV file into the app as typed rows, and shows its reading of the
 * file before anything is committed.
 *
 * The reader is a real RFC 4180 state machine rather than a split on commas,
 * so quoted commas, doubled quotes and line breaks inside a field survive, and
 * it is fed the file in chunks with a progress bar, so a 50 MB export does not
 * freeze the tab. Everything a spreadsheet leaves implicit is inferred and
 * shown: the delimiter, whether the first row is a header, and each column’s
 * type — including decimal commas and day-first dates. Cells that do not fit
 * their column are listed by line instead of silently becoming text.
 */
export function CsvImport({
  onImport,
  onParsed,
  delimiter = 'auto',
  header = 'auto',
  previewRows = 8,
  chunkSize = 256 * 1024,
  defaultText = '',
  file,
  importLabel = 'Import rows',
  className,
}: CsvImportProps) {
  const uid = useId()
  const [text, setText] = useState(defaultText)
  const [source, setSource] = useState<Source | null>(defaultText ? { kind: 'text', text: defaultText } : null)
  const [delimiterChoice, setDelimiterChoice] = useState<CsvImportDelimiter | 'auto'>(delimiter)
  const [headerChoice, setHeaderChoice] = useState<'auto' | 'yes' | 'no'>(header === 'auto' ? 'auto' : header ? 'yes' : 'no')
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [imported, setImported] = useState(false)
  const run = useRef(0)
  useEffect(() => {
    if (file) setSource({ kind: 'file', file })
  }, [file])
  const onParsedRef = useRef(onParsed)
  onParsedRef.current = onParsed

  useEffect(() => {
    if (!source) return
    const id = ++run.current
    const live = () => run.current === id
    setFailure(null)
    setImported(false)

    const read = async () => {
      let reader: CsvImportReader | null = null
      let chosen: CsvImportDelimiter = ','
      const feed = (chunk: string) => {
        if (!reader) {
          chosen = delimiterChoice === 'auto' ? sniffDelimiter(chunk) : delimiterChoice
          reader = new CsvImportReader(chosen)
        }
        reader.push(chunk)
      }
      if (source.kind === 'text') {
        for (let offset = 0; offset < source.text.length; offset += chunkSize) {
          feed(source.text.slice(offset, offset + chunkSize))
          setProgress(Math.min(1, (offset + chunkSize) / source.text.length) * 0.8)
          await tick()
          if (!live()) return
        }
      } else {
        if (typeof TextDecoder === 'undefined') throw new Error('This browser cannot decode files.')
        const decoder = new TextDecoder('utf-8')
        const { file } = source
        for (let offset = 0; offset < file.size; offset += chunkSize) {
          const buffer = await readSlice(file.slice(offset, offset + chunkSize))
          if (!live()) return
          feed(decoder.decode(buffer, { stream: offset + chunkSize < file.size }))
          setProgress(Math.min(1, (offset + chunkSize) / file.size) * 0.8)
          await tick()
        }
      }
      const done = reader ?? new CsvImportReader(chosen)
      done.end()
      const raw: CsvImportRawRow[] = done.rows
      const issues: CsvImportIssue[] = [...done.issues]
      const hasHeader = headerChoice === 'auto' ? looksLikeHeader(raw) : headerChoice === 'yes'
      const body = hasHeader ? raw.slice(1) : raw
      const width = Math.max(0, ...raw.slice(0, 1000).map((row) => row.cells.length))
      const columnNames = names(hasHeader ? raw[0].cells : [], width)
      const sample = body.slice(0, 1000)
      const columns = columnNames.map((name, c) => inferColumn(name, sample.map((row) => row.cells[c] ?? '')))

      // Typing is chunked as well, so a big file keeps the page responsive.
      const rows: Record<string, CsvImportValue>[] = []
      for (let start = 0; start < body.length; start += 5000) {
        for (const row of body.slice(start, start + 5000)) {
          if (row.cells.length !== width) {
            issues.push({ line: row.line, message: `${row.cells.length} field${row.cells.length === 1 ? '' : 's'}; the file has ${width}` })
          }
          const record: Record<string, CsvImportValue> = {}
          columns.forEach((column, c) => {
            const cell = convert(row.cells[c] ?? '', column)
            record[column.name] = cell.value
            if (cell.error) issues.push({ line: row.line, column: column.name, message: cell.error })
          })
          rows.push(record)
        }
        setProgress(0.8 + 0.2 * Math.min(1, (start + 5000) / Math.max(1, body.length)))
        await tick()
        if (!live()) return
      }
      issues.sort((a, b) => a.line - b.line)
      const next: CsvImportResult = { columns, rows, issues, delimiter: chosen, sniffed: delimiterChoice === 'auto', hasHeader }
      setResult(next)
      setProgress(null)
      onParsedRef.current?.(next)
    }
    read().catch((error: unknown) => {
      if (!live()) return
      setProgress(null)
      setFailure(error instanceof Error ? error.message : 'The file could not be read.')
    })
    return () => {
      run.current++
    }
  }, [source, delimiterChoice, headerChoice, chunkSize])

  const takeFile = (file: File | undefined) => {
    if (file) setSource({ kind: 'file', file })
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    takeFile(event.dataTransfer.files[0])
  }

  const reading = progress !== null
  const preview = result?.rows.slice(0, previewRows) ?? []
  const shown = (value: CsvImportValue) => (value === null ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value))

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-4 py-5 text-center transition-colors',
          dragging ? 'border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)]' : 'border-line-strong bg-surface-sunken',
        )}
      >
        <p className="text-[13px] font-semibold text-ink">Drop a .csv or .tsv file here</p>
        <label htmlFor={`${uid}-file`} className="cursor-pointer rounded-full bg-surface-muted px-3.5 py-2 text-[12px] font-bold text-ink transition-colors hover:bg-line-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
          Choose a file
          <input id={`${uid}-file`} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="sr-only" onChange={(event) => takeFile(event.target.files?.[0])} />
        </label>
        {source?.kind === 'file' && <p className="text-[11px] font-medium text-ink-faint">{source.file.name} · {(source.file.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-paste`} className="text-[12px] font-semibold text-ink">
          Or paste rows
        </label>
        <Textarea id={`${uid}-paste`} value={text} onChange={(event) => setText(event.target.value)} rows={4} spellCheck={false} className="font-mono text-[12px]" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="muted" onClick={() => setSource({ kind: 'text', text })} disabled={!text.trim()}>
            Read pasted rows
          </Button>
          <Select label="Delimiter" size="sm" options={DELIMITERS} value={delimiterChoice} onValueChange={setDelimiterChoice} align="start" />
          <Select
            label="Header row"
            size="sm"
            align="start"
            options={[
              { value: 'auto', label: 'Header: detect' },
              { value: 'yes', label: 'First row is a header' },
              { value: 'no', label: 'No header row' },
            ]}
            value={headerChoice}
            onValueChange={setHeaderChoice}
          />
        </div>
      </div>

      {reading && (
        <div className="flex items-center gap-3">
          <div role="progressbar" aria-label="Reading the file" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-accent-strong" style={{ width: `${progress * 100}%` }} />
          </div>
          <Button size="sm" variant="ghost" onClick={() => {
            run.current++
            setProgress(null)
          }}>
            Cancel
          </Button>
        </div>
      )}
      {failure && <p role="alert" className="text-[12px] font-semibold text-danger">{failure}</p>}

      {result && !reading && (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-[12px] font-medium text-ink-soft">
            <span className="font-bold text-ink">{result.rows.length.toLocaleString()} rows</span> · {result.columns.length} columns · {DELIMITER_NAME[result.delimiter]}-separated
            {result.sniffed ? ' (detected)' : ''} · {result.hasHeader ? 'first row read as names' : 'no header row'}
            {result.issues.length > 0 && <span className="font-semibold text-danger"> · {result.issues.length} problem{result.issues.length === 1 ? '' : 's'}</span>}
          </p>
          {result.columns.length > 0 && (
            <div tabIndex={0} role="region" aria-label="Preview of the first rows" className="max-h-72 overflow-auto rounded-[var(--radius-tile)] border border-line">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column.name} scope="col" className="whitespace-nowrap px-3 py-2 align-bottom">
                        <span className="block text-[12px] font-bold text-ink">{column.name}</span>
                        <span className="block text-[10px] font-semibold text-ink-faint">
                          {TYPE_LABEL[column.type]}
                          {column.type === 'number' && column.decimal === ',' ? ', decimal comma' : ''}
                          {column.type === 'date' && column.dateOrder !== 'iso' ? `, ${column.dateOrder === 'dmy' ? 'day first' : 'month first'}` : ''}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-t border-line">
                      {result.columns.map((column) => (
                        <td key={column.name} className={cn('whitespace-nowrap px-3 py-1.5 text-ink', (column.type === 'number' || column.type === 'date') && 'font-mono tabular-nums', column.type === 'number' && 'text-right')}>
                          {shown(row[column.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.issues.length > 0 && (
            <details className="rounded-[var(--radius-tile)] border border-line">
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-ink">Problems by line ({result.issues.length})</summary>
              <ul className="flex max-h-48 flex-col gap-1 overflow-auto border-t border-line p-3">
                {result.issues.slice(0, 200).map((issue, index) => (
                  <li key={index} className="text-[12px] font-medium text-ink-soft">
                    <span className="font-mono font-semibold text-ink">Line {issue.line}</span>
                    {issue.column ? `, ${issue.column}` : ''}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              disabled={result.rows.length === 0}
              onClick={() => {
                onImport?.(result)
                setImported(true)
              }}
            >
              {importLabel}
            </Button>
            <span role="status" className="text-[12px] font-medium text-ink-soft">
              {imported ? `${result.rows.length.toLocaleString()} rows imported` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
