/**
 * An RFC 4180 CSV reader for CsvImport, written as a state machine that can
 * be fed a file a chunk at a time: quoted fields, doubled quotes inside them,
 * CR, LF or CRLF line ends — split across chunks or not — newlines inside
 * quotes, and a byte-order mark at the start. Rows come out as string arrays
 * with the line they started on; the typing happens afterwards.
 */

export type CsvImportDelimiter = ',' | ';' | '\t' | '|'

export interface CsvImportRawRow {
  /** 1-based line the row starts on. */
  line: number
  cells: string[]
}

export interface CsvImportIssue {
  /** 1-based line in the file. */
  line: number
  /** Column name, when the problem is one cell. */
  column?: string
  message: string
}

/** Reader states. */
const S = { FieldStart: 0, Unquoted: 1, Quoted: 2, QuoteInQuoted: 3 } as const

export class CsvImportReader {
  private state: number = S.FieldStart
  private field = ''
  private row: string[] = []
  private line = 1
  private rowLine = 1
  private pendingCR = false
  private first = true
  readonly rows: CsvImportRawRow[] = []
  readonly issues: CsvImportIssue[] = []

  constructor(private readonly delimiter: string) {}

  private endField() {
    this.row.push(this.field)
    this.field = ''
    this.state = S.FieldStart
  }

  private endRow() {
    this.endField()
    // A line with nothing on it is not a row of one empty cell.
    if (!(this.row.length === 1 && this.row[0] === '')) this.rows.push({ line: this.rowLine, cells: this.row })
    this.row = []
    this.rowLine = this.line
  }

  push(chunk: string) {
    let text = chunk
    if (this.first) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
      this.first = false
    }
    const d = this.delimiter
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (this.pendingCR) {
        this.pendingCR = false
        if (c === '\n') {
          // The LF of a CRLF split across chunks. Inside quotes it is data.
          if (this.state === S.Quoted) this.field += '\n'
          continue
        }
      }
      if (this.state === S.Quoted) {
        if (c === '"') this.state = S.QuoteInQuoted
        else {
          if (c === '\n' || c === '\r') {
            this.line++
            if (c === '\r' && text[i + 1] === '\n') {
              this.field += '\r\n'
              i++
              continue
            }
            if (c === '\r' && i === text.length - 1) this.pendingCR = true
          }
          this.field += c
        }
        continue
      }
      if (this.state === S.QuoteInQuoted) {
        if (c === '"') {
          this.field += '"'
          this.state = S.Quoted
          continue
        }
        if (c !== d && c !== '\n' && c !== '\r') {
          this.issues.push({ line: this.line, message: `Text after a closing quote: “${c}”. Kept, but the field is malformed` })
          this.state = S.Unquoted
          this.field += c
          continue
        }
        this.state = S.Unquoted
      }
      if (c === d) {
        this.endField()
      } else if (c === '\n' || c === '\r') {
        this.line++
        if (c === '\r') {
          if (text[i + 1] === '\n') i++
          else if (i === text.length - 1) this.pendingCR = true
        }
        this.endRow()
      } else if (c === '"' && this.state === S.FieldStart) {
        this.state = S.Quoted
      } else {
        if (c === '"') this.issues.push({ line: this.line, message: 'A quote inside an unquoted field. Kept as a character' })
        this.field += c
        this.state = S.Unquoted
      }
    }
  }

  end() {
    if (this.state === S.Quoted) this.issues.push({ line: this.rowLine, message: 'A quoted field is never closed; it runs to the end of the file' })
    if (this.field !== '' || this.row.length || this.state === S.Quoted) this.endRow()
  }
}

/** Read a whole string at once. */
export function readCsv(text: string, delimiter: string) {
  const reader = new CsvImportReader(delimiter)
  reader.push(text)
  reader.end()
  return reader
}

/**
 * Pick the delimiter whose field count is most consistent across the first
 * lines, and greater than one — quote-aware, so a comma inside a quoted field
 * does not count.
 */
export function sniffDelimiter(sample: string): CsvImportDelimiter {
  const candidates: CsvImportDelimiter[] = [',', ';', '\t', '|']
  let best: CsvImportDelimiter = ','
  let bestScore = 0
  // Cut at the last complete line so a chunk boundary does not skew the counts.
  const cut = sample.length > 4096 ? sample.slice(0, sample.lastIndexOf('\n', 65536) + 1 || sample.length) : sample
  for (const d of candidates) {
    const rows = readCsv(cut, d).rows.slice(0, 30)
    if (rows.length === 0) continue
    const counts = new Map<number, number>()
    rows.forEach((row) => counts.set(row.cells.length, (counts.get(row.cells.length) ?? 0) + 1))
    const [fields, frequency] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    if (fields < 2) continue
    const score = (frequency / rows.length) * 100 + Math.min(fields, 20)
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

/* ------------------------------------------------------------- typing */

export type CsvImportColumnType = 'number' | 'boolean' | 'date' | 'string' | 'empty'

export interface CsvImportColumn {
  name: string
  type: CsvImportColumnType
  /** For numbers: which mark is the decimal point. */
  decimal?: '.' | ','
  /** For dates: how the day and month are ordered. */
  dateOrder?: 'iso' | 'dmy' | 'mdy'
  /** Share of non-empty cells that fit the type, 0–1. */
  confidence: number
}

/** Share of non-empty cells that must fit a type for the column to take it. */
const FIT = 0.8

const TRUE = new Set(['true', 'yes', 'y', 't'])
const FALSE = new Set(['false', 'no', 'n', 'f'])

const DOT_NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[-+]?\d+)?$/i
const COMMA_NUMBER = /^[-+]?(?:\d{1,3}(?:[.\xa0 ]\d{3})+|\d+)(?:,\d+)?$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/

export function toNumber(raw: string, decimal: '.' | ','): number | null {
  const text = raw.trim().replace(/^\((.*)\)$/, '-$1')
  if (decimal === '.') return DOT_NUMBER.test(text) ? Number(text.replace(/,/g, '')) : null
  return COMMA_NUMBER.test(text) ? Number(text.replace(/[.\xa0 ]/g, '').replace(',', '.')) : null
}

const validDate = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate()

export function toDate(raw: string, order: 'iso' | 'dmy' | 'mdy'): string | null {
  const text = raw.trim()
  const iso = ISO_DATE.exec(text)
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]) ? text : null
  if (order === 'iso') return null
  const slash = SLASH_DATE.exec(text)
  if (!slash) return null
  const [d, m] = order === 'dmy' ? [+slash[1], +slash[2]] : [+slash[2], +slash[1]]
  const y = +slash[3]
  return validDate(y, m, d) ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
}

/**
 * Infer a column’s type from its values. A type is kept if four in five
 * non-empty cells fit it; the rest become per-row errors rather than turning
 * the whole column into text.
 */
export function inferColumn(name: string, values: string[]): CsvImportColumn {
  const filled = values.map((v) => v.trim()).filter((v) => v !== '')
  if (filled.length === 0) return { name, type: 'empty', confidence: 1 }
  const share = (test: (v: string) => boolean) => filled.filter(test).length / filled.length
  const bool = share((v) => TRUE.has(v.toLowerCase()) || FALSE.has(v.toLowerCase()))
  if (bool >= FIT) return { name, type: 'boolean', confidence: bool }
  // "1,5" and "1.234,5" say comma; "1,234.5" says dot. Choose the reading that fits more.
  const dot = share((v) => toNumber(v, '.') !== null)
  const comma = share((v) => toNumber(v, ',') !== null)
  // A tie ("1,234" alone) reads as thousands, the more common convention in data exports.
  const commaWins = comma > dot
  const num = Math.max(dot, comma)
  if (num >= FIT) return { name, type: 'number', decimal: commaWins ? ',' : '.', confidence: num }
  const iso = share((v) => toDate(v, 'iso') !== null)
  if (iso >= FIT) return { name, type: 'date', dateOrder: 'iso', confidence: iso }
  const slashes = filled.map((v) => SLASH_DATE.exec(v)).filter(Boolean) as RegExpExecArray[]
  if (slashes.length / filled.length >= FIT) {
    // A first part over 12 can only be a day; a second part over 12 only a month-first date.
    const order = slashes.some((m) => +m[2] > 12) && !slashes.some((m) => +m[1] > 12) ? 'mdy' : 'dmy'
    const fit = share((v) => toDate(v, order) !== null)
    if (fit >= FIT) return { name, type: 'date', dateOrder: order, confidence: fit }
  }
  return { name, type: 'string', confidence: 1 }
}

export type CsvImportValue = string | number | boolean | null

/** One cell to its typed value, or an error message. */
export function convert(raw: string, column: CsvImportColumn): { value: CsvImportValue; error?: string } {
  const text = raw.trim()
  if (text === '') return { value: null }
  if (column.type === 'number') {
    const n = toNumber(text, column.decimal ?? '.')
    return n === null ? { value: raw, error: `“${text}” is not a number` } : { value: n }
  }
  if (column.type === 'boolean') {
    const lower = text.toLowerCase()
    return TRUE.has(lower) ? { value: true } : FALSE.has(lower) ? { value: false } : { value: raw, error: `“${text}” is not yes or no` }
  }
  if (column.type === 'date') {
    const d = toDate(text, column.dateOrder ?? 'iso')
    return d === null ? { value: raw, error: `“${text}” is not a date` } : { value: d }
  }
  return { value: raw }
}

/**
 * Whether the first row names the columns: every cell filled and distinct,
 * and none of them fits the type its column has below it.
 */
export function looksLikeHeader(rows: CsvImportRawRow[]): boolean {
  if (rows.length < 2) return false
  const [head, ...body] = rows
  const cells = head.cells.map((c) => c.trim())
  if (cells.some((c) => c === '') || new Set(cells.map((c) => c.toLowerCase())).size !== cells.length) return false
  const sample = body.slice(0, 200)
  let typedColumns = 0
  for (let c = 0; c < cells.length; c++) {
    const column = inferColumn('', sample.map((row) => row.cells[c] ?? ''))
    if (column.type === 'string' || column.type === 'empty') continue
    typedColumns++
    if (!convert(cells[c], column).error) return false
  }
  // All text columns: a header if the first row repeats nowhere below.
  if (typedColumns === 0) return !sample.some((row) => row.cells.some((cell, c) => cell.trim() === cells[c]))
  return true
}
