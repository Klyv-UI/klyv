import { useEffect, useRef, useState } from 'react'
import {
  AnsiOutput,
  Button,
  CronEditor,
  CspEvaluator,
  CsvImport,
  CurlConverter,
  GeoCoordinateInput,
  JsonDiff,
  JsonQuery,
  RegexTester,
  SemverRange,
  Text,
  type AnsiOutputHandle,
  type CsvImportResult,
  type GeoCoordinateInputPoint,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/* ------------------------------------------------------ geo coordinate */

const HEATHROW = { label: 'London Heathrow', lat: 51.47, lon: -0.4543 }

function GeoExample() {
  const [point, setPoint] = useState<GeoCoordinateInputPoint | null>({ lat: 40.6413, lon: -73.7781 })
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <GeoCoordinateInput label="Destination" value={point} onValueChange={setPoint} reference={HEATHROW} />
      <Readout label="value" value={point ? JSON.stringify(point) : 'null'} />
    </div>
  )
}

/* ---------------------------------------------------------------- cron */

function CronExample() {
  const [expression, setExpression] = useState('*/15 9-17 * * MON-FRI')
  const [zone, setZone] = useState('Europe/London')
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <CronEditor label="Sync schedule" value={expression} onValueChange={setExpression} timeZone={zone} onTimeZoneChange={setZone} />
      <Readout label="value" value={`${expression} (${zone})`} />
    </div>
  )
}

/** The night the clocks go back in London: 01:00–01:59 happens twice. */
const FALL_BACK = new Date(Date.UTC(2026, 9, 24, 22, 0))

/* --------------------------------------------------------------- regex */

const LOG_TEXT = `2026-09-14 09:12:03 alice.ng+billing@northwind.io signed in
2026-09-14 09:14:51 ravi@acme.co.uk exported 1,204 rows
2026-09-14 09:15:02 not-an-email@ failed validation
2026-09-14 09:20:40 support@klyv.dev replied to #4821`

/* ----------------------------------------------------------------- csv */

const INVOICES = `invoice;customer;amount;paid;issued
INV-1041;"Müller & Söhne GmbH";1.284,50;yes;03/09/2026
INV-1042;"Brasserie ""Le Coq""";312,00;yes;04/09/2026
INV-1043;"Nordlicht AB
Stockholm";2.019,99;no;05/09/2026
INV-1044;Atelier Ferro;n/a;no;06/09/2026
INV-1045;Café Olé;88,10;yes;31/09/2026
INV-1046;Studio Nine;1.020,00;yes;07/09/2026`

function bigCsv(rows: number) {
  const lines = ['id,sku,quantity,unit_price,in_stock,updated']
  for (let i = 1; i <= rows; i++) {
    lines.push(`${i},SKU-${String((i * 7919) % 100000).padStart(5, '0')},${(i * 13) % 250},${((i * 37) % 9000) / 100},${i % 3 ? 'true' : 'false'},2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`)
  }
  return lines.join('\n')
}

function CsvExample() {
  const [result, setResult] = useState<CsvImportResult | null>(null)
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3">
      <CsvImport defaultText={INVOICES} onImport={setResult} />
      <Readout label="onImport" value={result ? `${result.rows.length} rows, first: ${JSON.stringify(result.rows[0])}` : ''} />
    </div>
  )
}

function CsvLargeExample() {
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3">
      <div>
        <Button size="sm" variant="muted" onClick={() => setFile(new File([bigCsv(60000)], 'inventory.csv', { type: 'text/csv' }))}>
          Generate a 60,000-row file
        </Button>
      </div>
      <CsvImport file={file} chunkSize={128 * 1024} />
    </div>
  )
}

/* ----------------------------------------------------------- json diff */

const CONFIG_BEFORE = {
  service: 'billing-api',
  version: '2.3.0',
  replicas: 3,
  env: { LOG_LEVEL: 'info', REGION: 'eu-west-1', FEATURE_INVOICES_V2: false },
  owners: [
    { id: 'u-17', name: 'Ada Lovelace', role: 'lead' },
    { id: 'u-22', name: 'Grace Hopper', role: 'reviewer' },
    { id: 'u-31', name: 'Alan Turing', role: 'reviewer' },
  ],
  ports: [8080, 8443, 9090],
}
const CONFIG_AFTER = {
  service: 'billing-api',
  version: '2.4.0',
  replicas: 5,
  env: { LOG_LEVEL: 'info', REGION: 'eu-west-1', FEATURE_INVOICES_V2: true, RATE_LIMIT: 1200 },
  owners: [
    { id: 'u-31', name: 'Alan Turing', role: 'lead' },
    { id: 'u-17', name: 'Ada Lovelace', role: 'lead' },
    { id: 'u-40', name: 'Katherine Johnson', role: 'reviewer' },
  ],
  ports: [8080, 9090, 8443],
}

/* ---------------------------------------------------------- json query */

const STORE = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95, tags: ['quotes'] },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99, tags: ['sea', 'classic'] },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
  expensive: 10,
}

const QUERIES = [
  '$.store.book[*].author',
  '$..price',
  '$..book[-2:]',
  '$..book[?(@.price < 10 && @.tags)].title',
  "$..book[?(@.category == 'fiction' && !@.isbn)]",
  '$..book[?(@.price > $.expensive)].title',
  '$..book[?(@.author =~ /tolkien/i)]',
]

/* --------------------------------------------------------------- ansi */

const ESC = '\x1b'
const csi = (code: string) => `${ESC}[${code}`
const link = (url: string, text: string) => `${ESC}]8;;${url}${ESC}\\${text}${ESC}]8;;${ESC}\\`

function buildScript(): string[] {
  const chunks: string[] = [
    `${csi('1m')}klyv build${csi('0m')} ${csi('2m')}v4.2.0${csi('0m')}\n`,
    `${csi('36m')}info${csi('0m')}  resolving 214 packages\n`,
  ]
  for (let p = 0; p <= 100; p += 10) {
    const filled = Math.round(p / 5)
    chunks.push(`\r${csi('K')}${csi('32m')}${'█'.repeat(filled)}${csi('2m')}${'░'.repeat(20 - filled)}${csi('0m')} ${p}% downloading`)
  }
  chunks.push(`\n${csi('33m')}warn${csi('0m')}  ${csi('4m')}lodash.merge${csi('24m')} is deprecated, use ${csi('1m')}structuredClone${csi('22m')}\n`)
  // Three workers redrawing their own lines with cursor-up.
  chunks.push('worker 1  queued\nworker 2  queued\nworker 3  queued\n')
  for (let step = 1; step <= 4; step++) {
    const line = (w: number) => {
      const done = Math.min(4, step + (w === 2 ? 0 : 1))
      return `${csi('2K')}worker ${w}  ${done === 4 ? `${csi('32m')}done${csi('0m')}` : `${csi('38;5;208m')}${'▮'.repeat(done)}${csi('0m')} compiling`}`
    }
    chunks.push(`${csi('3A')}\r${line(1)}\n\r${line(2)}\n\r${line(3)}\n`)
  }
  chunks.push(`${csi('38;2;120;90;220m')}truecolor${csi('0m')} ${csi('7m')} inverse ${csi('27m')} ${csi('9m')}struck${csi('29m')} ${csi('3m')}italic${csi('23m')} ${csi('41;97m')} FAIL ${csi('0m')} 1 flaky test retried\n`)
  chunks.push(`${csi('32m')}✓${csi('0m')} built in 4.1s — ${link('https://example.com/builds/8841', 'open build #8841')} · ${link('javascript:alert(1)', 'unsafe link (not linked)')}\n`)
  return chunks
}

function AnsiExample() {
  const output = useRef<AnsiOutputHandle>(null)
  const [running, setRunning] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearInterval(timer.current), [])

  const run = () => {
    output.current?.clear()
    const chunks = buildScript()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce) {
      output.current?.append(chunks.join(''))
      return
    }
    setRunning(true)
    let i = 0
    timer.current = window.setInterval(() => {
      output.current?.append(chunks[i++])
      if (i >= chunks.length) {
        window.clearInterval(timer.current)
        setRunning(false)
      }
    }, 90)
  }

  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    output.current?.append(buildScript().join(''))
  }, [])

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <div>
        <Button size="sm" onClick={run} disabled={running}>
          {running ? 'Building…' : 'Run the build again'}
        </Button>
      </div>
      <AnsiOutput ref={output} label="Build output" className="h-72" />
    </div>
  )
}

const PALETTE_SAMPLE = [
  Array.from({ length: 8 }, (_, i) => `${csi(`${30 + i}m`)}color ${i}${csi('0m')}`).join('  '),
  Array.from({ length: 8 }, (_, i) => `${csi(`${90 + i}m`)}bright ${i}${csi('0m')}`).join(' '),
  Array.from({ length: 24 }, (_, i) => `${csi(`48;5;${232 + i}m`)} ${csi('0m')}`).join(''),
  Array.from({ length: 36 }, (_, i) => `${csi(`48;5;${16 + i * 6}m`)} ${csi('0m')}`).join(''),
].join('\n')

/* ---------------------------------------------------------------- curl */

const CURL = `curl -X POST 'https://api.northwind.io/v2/invoices?draft=true' \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $NORTHWIND_TOKEN" \\
  -H 'Idempotency-Key: 5f2c9a' \\
  --data-raw '{"customer":"cus_8841","lines":[{"sku":"PLAN-PRO","qty":3}],"memo":"Q3 renewal"}' \\
  --compressed -sS --max-time 20`

const CURL_SAMPLES: [string, string][] = [
  ['JSON POST', CURL],
  ['Form + basic auth', `curl -u deploy:hunter2 -L https://ci.example.com/job/build -d token=abc -d 'cause=manual run' -k`],
  ['Multipart upload', `curl https://files.example.com/upload -F 'file=@./q3-report.pdf;type=application/pdf' -F folder=finance -b 'session=9f8e; theme=dark'`],
  ['GET with -G', `curl -G https://api.example.com/search --data-urlencode 'q=coffee & cake' -d limit=20 -H 'Accept: application/json' | jq .`],
]

function CurlExample() {
  const [command, setCommand] = useState(CURL)
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3">
      <div role="group" aria-label="Sample commands" className="flex flex-wrap gap-1.5">
        {CURL_SAMPLES.map(([name, sample]) => (
          <Button key={name} size="sm" variant={command === sample ? 'accent' : 'muted'} aria-pressed={command === sample} onClick={() => setCommand(sample)}>
            {name}
          </Button>
        ))}
      </div>
      <CurlConverter value={command} onValueChange={setCommand} />
    </div>
  )
}

/* -------------------------------------------------------------- semver */

const VERSIONS = [
  '0.9.4', '1.0.0', '1.2.2', '1.2.3', '1.2.4-beta.1', '1.2.4', '1.3.0-rc.1', '1.3.0', '1.9.9', '2.0.0-alpha.3', '2.0.0', '2.1.0', '2.1.5', '3.0.0-next.0',
]
const RANGES = ['^1.2.3', '~1.2.3', '1.2 - 2.0', '>=1.2.4-beta.0 <1.3', '^0.9.0 || 2.1.x', '*']

function SemverExample() {
  const [range, setRange] = useState('^1.2.3')
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <div role="group" aria-label="Sample ranges" className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${range === r ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong'}`}
          >
            {r}
          </button>
        ))}
      </div>
      <SemverRange value={range} onValueChange={setRange} versions={VERSIONS} />
    </div>
  )
}

/* ----------------------------------------------------------------- csp */

const WEAK_CSP = `default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.example.com data:; style-src 'self' 'unsafe-inline'; img-src * data:; report-uri /csp`
const STRONG_CSP = `default-src 'self'; script-src 'nonce-rAnd0m6e7x2Qk9bLwT4pZs' 'strict-dynamic' 'unsafe-inline' https:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'; report-to csp-endpoint`

/* ------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'geo-coordinate-input': {
    description:
      'One field for a latitude and longitude in whatever notation the source used — decimal degrees, 51°30′26″N 0°7′39″W, N 51° 30.433′ W 0° 7.65′, with signs or hemisphere letters before or after. It is lenient about notation and strict about meaning: out-of-range values, 61 minutes, or a minus sign together with an S are errors with a reason. Underneath it reads the point back in words and in each normalised notation, ready to copy, and gives the haversine distance and initial bearing from an optional reference point.',
    sections: [
      { title: 'Example', description: 'Paste 51°30′26″N 0°7′39″W, or N 40° 38.478′ W 73° 46.686′, or type longitude first to see the error.', bare: true, Content: GeoExample },
      {
        title: 'Options',
        specimens: [
          { label: 'miles, 3 decimals', node: <GeoCoordinateInput label="Trailhead" defaultValue={{ lat: 46.8523, lon: -121.7603 }} reference={{ label: 'Seattle', lat: 47.6062, lon: -122.3321 }} unit="mi" precision={3} /> },
          { label: 'empty, DMS and geo: only', node: <GeoCoordinateInput label="Survey marker" formats={['dms', 'geo-uri']} /> },
        ],
      },
      rationale(
        'Coordinates arrive in three notations and two sign conventions, and retyping between them is where a minus sign or a minute goes missing.',
        'Parsing every common form into one value, then reading it back in words, makes the interpretation checkable before it is saved.',
        'Asset and site records, delivery addresses, field-survey forms, geofence set-up.',
        ['Field', 'Input', 'CopyButton', 'haversine'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Visible label.' },
      { name: 'value / defaultValue', type: '{ lat, lon } | null', description: 'The parsed point; null while the text does not parse.' },
      { name: 'onValueChange', type: '(value) => void', description: 'Called when the parsed point changes.' },
      { name: 'reference', type: '{ label, lat, lon }', description: 'Distance and initial bearing are measured from here.' },
      { name: 'unit', type: "'km' | 'mi'", defaultValue: "'km'", description: 'Distance unit.' },
      { name: 'precision', type: 'number', defaultValue: '6', description: 'Decimal places in the decimal output.' },
      { name: 'formats', type: "('decimal' | 'dms' | 'ddm' | 'geo-uri')[]", defaultValue: "['decimal','dms','ddm']", description: 'Notations offered for copying.' },
      { name: 'hint / placeholder / disabled', type: '…', description: 'As on Field and Input.' },
    ],
  },

  'cron-editor': {
    description:
      'A cron expression with its meaning spelled out: the schedule in plain words, the next runs as real times in a chosen IANA zone, and an error on the field that is wrong. It reads five fields or six with seconds, ranges, steps, lists, month and day names, L, W and #, and the @daily macros, and applies the day-of-month/day-of-week OR rule. Run times are found in wall-clock time and then converted, so the night the clocks change shows a moved or doubled run instead of hiding it. Each field has its own input with quick values.',
    sections: [
      { title: 'Example', description: 'Edit the expression or any single field; the quick values follow the field you last focused.', bare: true, Content: CronExample },
      {
        title: 'Daylight saving',
        description: 'Counted from 24 October 2026, the night before London’s clocks go back.',
        stack: true,
        specimens: [
          { label: 'a fixed-time job runs once', fill: true, node: <CronEditor label="Nightly export" defaultValue="30 1 * * *" defaultTimeZone="Europe/London" from={FALL_BACK} count={3} /> },
          { label: 'an every-hour job runs in both copies', fill: true, node: <CronEditor label="Queue sweep" defaultValue="*/30 * * * *" defaultTimeZone="Europe/London" from={FALL_BACK} count={6} /> },
        ],
      },
      {
        title: 'Extensions',
        stack: true,
        specimens: [
          { label: 'both day fields: either matches', fill: true, node: <CronEditor label="Payroll" defaultValue="0 9 1,15 * MON" defaultTimeZone="UTC" from={FALL_BACK} count={4} /> },
          { label: 'L, W and #', fill: true, node: <CronEditor label="Close the books" defaultValue="0 18 LW * *" defaultTimeZone="America/New_York" from={FALL_BACK} count={3} /> },
          { label: 'an error on one field', fill: true, node: <CronEditor label="Broken" defaultValue="0 25 * * FRY" defaultTimeZone="UTC" /> },
        ],
      },
      rationale(
        'Cron is read far more often than it is written, and its mistakes — a field in the wrong slot, the day OR rule, a DST night — only show up when a job runs at the wrong time.',
        'Showing the schedule in words and as real upcoming times turns a string nobody can check into something anyone can.',
        'Scheduled jobs, report delivery, backups, CI schedules, reminders.',
        ['Field', 'Input', 'Select', 'Intl.DateTimeFormat'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', defaultValue: "'0 9 * * MON-FRI'", description: 'The expression.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit, valid or not.' },
      { name: 'timeZone / defaultTimeZone', type: 'string', description: 'IANA zone the runs are computed in. Defaults to the browser’s.' },
      { name: 'onTimeZoneChange', type: '(zone: string) => void', description: 'When the zone picker changes.' },
      { name: 'timeZones', type: 'string[]', description: 'Zones offered in the picker.' },
      { name: 'count', type: 'number', defaultValue: '5', description: 'Upcoming runs listed.' },
      { name: 'from', type: 'Date', description: 'Count from this moment instead of now.' },
      { name: 'label / locale', type: 'string', description: 'Field label; locale for the run times.' },
    ],
  },

  'regex-tester': {
    description:
      'A regular expression, flags and some text, with the matches marked live and a table of every match with its numbered and named groups. The pattern is read back token by token in plain words. Shapes that backtrack exponentially — a quantified group containing another quantifier, (a+)+, or quantified branches that can start with the same character — are flagged before anything runs, and every run happens in a Worker that is terminated after a time limit, so a bad pattern cannot freeze the page.',
    sections: [
      { title: 'Example', description: 'Hover or focus a row in the table to find its match in the text.', bare: true, Content: () => <RegexTester defaultValue={'(?<user>[\\w.+-]+)@(?<domain>[\\w-]+(?:\\.[\\w-]+)+)'} defaultText={LOG_TEXT} className="max-w-[720px]" /> },
      {
        title: 'Catastrophic backtracking',
        description: 'This pattern takes seconds or minutes on 30 characters. It is flagged, and the run is stopped after 1 second.',
        bare: true,
        Content: () => <RegexTester defaultValue="^(\w+\s?)*$" defaultText="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" defaultFlags="" className="max-w-[720px]" />,
      },
      rationale(
        'A regex is written once and debugged forever, and the one that ships is sometimes the one that hangs a server on the first odd input.',
        'Explaining each token and warning about backtracking shapes catches both kinds of mistake while the pattern is still being written.',
        'Validation rules, log filters, search settings, routing and redaction rules.',
        ['Input', 'Textarea', 'Worker', 'table'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'The pattern, without slashes.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'flags / defaultFlags / onFlagsChange', type: 'string', defaultValue: "'g'", description: 'Any of g i m s u y.' },
      { name: 'text / defaultText / onTextChange', type: 'string', description: 'The test text.' },
      { name: 'timeout', type: 'number', defaultValue: '1000', description: 'Milliseconds before a run is stopped.' },
      { name: 'maxMatches', type: 'number', defaultValue: '1000', description: 'Matches collected before stopping.' },
    ],
  },

  'csv-import': {
    description:
      'Brings a CSV file into the app as typed rows, and shows its reading of the file first. The reader is an RFC 4180 state machine — quoted commas, doubled quotes, line breaks inside fields, CR, LF or CRLF, a byte-order mark — fed the file in chunks with a progress bar. It sniffs the delimiter, decides whether the first row is a header, and infers each column’s type, including decimal commas and day-first dates. Cells that do not fit their column are listed by line rather than silently turned into text.',
    sections: [
      { title: 'Example', description: 'A semicolon-separated export with decimal commas, a quoted line break and two bad cells. Paste your own, or choose a file.', bare: true, Content: CsvExample },
      { title: 'Large input', description: 'Sixty thousand rows are read in chunks, with progress, without freezing the page.', bare: true, Content: CsvLargeExample },
      rationale(
        'Splitting on commas breaks on the first quoted address, and guessing types silently turns “1.284,50” into text or into 1.2845.',
        'A real parser plus visible inference lets people see and correct the reading before thousands of rows land in the app.',
        'Contact and product imports, bank statement uploads, migration tools, bulk edits.',
        ['Button', 'Select', 'Textarea', 'progressbar', 'table'],
      ),
    ],
    props: [
      { name: 'onImport', type: '(result: CsvImportResult) => void', description: 'Pressed import: columns, typed rows, issues, delimiter.' },
      { name: 'onParsed', type: '(result: CsvImportResult) => void', description: 'After every successful read.' },
      { name: 'delimiter', type: "',' | ';' | '\\t' | '|' | 'auto'", defaultValue: "'auto'", description: 'Separator, or sniff it.' },
      { name: 'header', type: "boolean | 'auto'", defaultValue: "'auto'", description: 'Whether the first row names the columns.' },
      { name: 'previewRows', type: 'number', defaultValue: '8', description: 'Rows in the preview table.' },
      { name: 'chunkSize', type: 'number', defaultValue: '262144', description: 'Bytes read per step.' },
      { name: 'defaultText', type: 'string', description: 'Starting text in the paste box.' },
      { name: 'file', type: 'File | null', description: 'A file to read as if dropped.' },
      { name: 'importLabel', type: 'string', defaultValue: "'Import rows'", description: 'Import button label.' },
    ],
  },

  'json-diff': {
    description:
      'What changed between two JSON documents, as a change list with JSON Pointer paths and as a side-by-side tree. Objects are compared by key, arrays with a longest common subsequence, and arrays of records by their id or key, which is what turns a reordered record into one move rather than a removal and an addition. Unchanged branches fold away in the tree, and a summary counts additions, removals, changes and moves.',
    sections: [
      { title: 'Example', description: 'Edit either side. Owners are matched by id, so the reorder reads as moves.', bare: true, Content: () => <JsonDiff before={CONFIG_BEFORE} after={CONFIG_AFTER} editable beforeLabel="deploy.json (main)" afterLabel="deploy.json (branch)" className="max-w-[760px]" /> },
      { title: 'Side by side', bare: true, Content: () => <JsonDiff before={CONFIG_BEFORE} after={CONFIG_AFTER} defaultView="tree" className="max-w-[760px]" /> },
      rationale(
        'A line diff of pretty-printed JSON reports formatting noise and misses structure: a moved record looks like two unrelated edits.',
        'Comparing values, with identity for records, reports what a person means by “changed”.',
        'Config and feature-flag reviews, audit logs, API response comparison, snapshot tests.',
        ['SegmentedControl', 'Textarea', 'LCS'],
      ),
    ],
    props: [
      { name: 'before / after', type: 'unknown', description: 'The two values.' },
      { name: 'editable', type: 'boolean', defaultValue: 'false', description: 'Show both sides as editable JSON.' },
      { name: 'keys', type: 'string[]', defaultValue: "['id','key']", description: 'Identity fields for matching array records.' },
      { name: 'beforeLabel / afterLabel', type: 'string', defaultValue: "'Before' / 'After'", description: 'Side headings.' },
      { name: 'defaultView', type: "'changes' | 'tree'", defaultValue: "'changes'", description: 'Which view opens first.' },
    ],
  },

  'json-query': {
    description:
      'A JSONPath field over a document: $, dot and bracket names, wildcards, recursive descent, slices, unions and filters such as [?(@.price < 10 && @.tags)]. Filters are parsed into an expression tree and walked — no eval anywhere — so a query can only read. Results are listed by their normalised paths and marked in a tree of the document, which opens the branches that hold them; a mistake is reported at its character with a caret under it.',
    sections: [
      { title: 'Example', bare: true, Content: () => <JsonQuery data={STORE} defaultValue="$..book[?(@.price < 10 && @.tags)].title" examples={QUERIES} /> },
      { title: 'An error at its position', bare: true, Content: () => <JsonQuery data={STORE} defaultValue="$.store.book[?(@.price < )]" /> },
      rationale(
        'Finding the one field that matters in a large response means scrolling, and trying a query means leaving for another tool.',
        'Querying in place, with results shown where they sit in the document, answers both where and what.',
        'API explorers, webhook and event inspectors, log viewers, admin data tools.',
        ['Input', 'tree', 'expression parser'],
      ),
    ],
    props: [
      { name: 'data', type: 'unknown', description: 'The document.' },
      { name: 'value / defaultValue', type: 'string', defaultValue: "'$'", description: 'The JSONPath expression.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'onResultsChange', type: '(results: JsonQueryResult[]) => void', description: 'Matches, when the expression evaluates.' },
      { name: 'examples', type: 'string[]', description: 'Ready-made expressions under the field.' },
      { name: 'label', type: 'string', defaultValue: "'JSONPath'", description: 'Field label.' },
      { name: 'maxResults', type: 'number', defaultValue: '200', description: 'Results listed.' },
    ],
  },

  'ansi-output': {
    description:
      'Terminal output drawn the way a terminal would: SGR colours in 16, 256 and truecolour, bold, dim, italic, underline, inverse and strike, carriage returns that redraw a progress bar, erase-line and cursor-up for multi-line progress, and OSC 8 hyperlinks for safe URLs only. It keeps a small screen model and parses each chunk as it streams in, holding a sequence split across chunks. The 16 base colours are theme tokens, exposed as --ansi-0 to --ansi-15.',
    sections: [
      { title: 'Streaming', description: 'Each frame of the progress bars overwrites the last; only the finished lines remain.', bare: true, Content: AnsiExample },
      { title: 'Palette', description: 'The 16 colours follow the theme; the 256-colour cube and greys are fixed.', bare: true, Content: () => <AnsiOutput value={PALETTE_SAMPLE} label="Palette" copyable={false} className="max-w-[640px]" /> },
      rationale(
        'Build logs and CLIs are written for a terminal, so a plain <pre> shows escape codes and every frame of every spinner.',
        'A small screen model renders what the terminal would have shown, at a fraction of a terminal emulator’s size.',
        'CI and deploy logs, job runners, dev-tool dashboards, support consoles.',
        ['CopyButton', 'role="log"', 'screen model'],
      ),
    ],
    props: [
      { name: 'value', type: 'string', description: 'The whole output so far; an extension is streamed, anything else restarts.' },
      { name: 'ref', type: 'AnsiOutputHandle', description: '{ append(chunk), clear(), text() } for streaming.' },
      { name: 'label', type: 'string', defaultValue: "'Output'", description: 'Accessible name of the log.' },
      { name: 'maxLines', type: 'number', defaultValue: '2000', description: 'Lines kept.' },
      { name: 'follow', type: 'boolean', defaultValue: 'true', description: 'Stay at the bottom while the reader is.' },
      { name: 'wrap', type: 'boolean', defaultValue: 'false', description: 'Wrap long lines.' },
      { name: 'announce', type: 'boolean', defaultValue: 'false', description: 'Announce new output to screen readers.' },
      { name: 'palette', type: 'Partial<Record<number, string>>', description: 'Override colours 0–15.' },
      { name: 'copyable', type: 'boolean', defaultValue: 'true', description: 'Copy-as-text button.' },
    ],
  },

  'curl-converter': {
    description:
      'Paste a curl command and get the same request as fetch, axios or Python requests. The command is split by a POSIX-style tokenizer — single and double quotes, escapes, $’…’ strings, line continuations — and each flag is applied with curl’s semantics: -d makes a POST, -G moves data into the query, --json sets two headers, -F builds multipart, -u becomes Basic auth. Anything with no equivalent is listed rather than dropped.',
    sections: [
      { title: 'Example', bare: true, Content: CurlExample },
      rationale(
        'API docs and dev tools hand out curl, the codebase speaks fetch or Python, and a hand translation quietly drops a header or a flag.',
        'Parsing the shell and curl properly, and naming what did not convert, makes the translation trustworthy.',
        'API reference pages, developer portals, support tooling, request builders.',
        ['Textarea', 'Tabs', 'CodeBlock'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'The curl command.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'onRequestChange', type: '(request: CurlConverterRequest) => void', description: 'The parsed request model.' },
      { name: 'defaultTarget', type: "'fetch' | 'axios' | 'python'", defaultValue: "'fetch'", description: 'Tab shown first.' },
      { name: 'label', type: 'string', defaultValue: "'curl command'", description: 'Field label.' },
    ],
  },

  'semver-range': {
    description:
      'A semver range and the versions it lets in, worked out as npm does: versions with prerelease and build parts, comparators, caret, tilde, x-ranges, hyphen ranges and || unions. The range is shown expanded into the comparators npm evaluates, each written part is explained, and every version is marked in, out, or out only because it is a prerelease — npm includes a prerelease only when the range names one on the same major.minor.patch. The highest match is what an install would pick.',
    sections: [
      { title: 'Example', bare: true, Content: SemverExample },
      rationale(
        'Range sugar hides its bounds: ^0.2.3 stops at 0.3.0, 1.2 - 2.0 runs to the end of 2.0.x, and prereleases follow a rule most people have never read.',
        'Expanding the range and testing real versions against it makes the bounds visible before a dependency moves.',
        'Dependency and plugin settings, compatibility matrices, release tooling, API version pinning.',
        ['Field', 'Input', 'Switch'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', defaultValue: "'^1.2.3'", description: 'The range.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'versions', type: 'string[]', description: 'Versions tested against the range.' },
      { name: 'includePrerelease / defaultIncludePrerelease', type: 'boolean', defaultValue: 'false', description: 'npm’s includePrerelease option.' },
      { name: 'onIncludePrereleaseChange', type: '(include: boolean) => void', description: 'When the switch changes.' },
      { name: 'label', type: 'string', defaultValue: "'Version range'", description: 'Field label.' },
    ],
  },

  'csp-evaluator': {
    description:
      'Reads a Content-Security-Policy as a browser does and says what it allows, weakest point first. Findings carry a severity and the directive they come from: unsafe-inline and unsafe-eval, wildcards and bare schemes, data: in scripts, plain http, missing object-src and base-uri, unquoted keywords. It knows the interactions — a nonce or hash makes unsafe-inline ignored, strict-dynamic makes hosts ignored — and resolves the policy per resource type through the default-src fallback, striking out what the browser will ignore.',
    sections: [
      { title: 'Example', description: 'A policy that looks strict and is not.', bare: true, Content: () => <CspEvaluator defaultValue={WEAK_CSP} className="max-w-[760px]" /> },
      { title: 'A strict policy', description: 'Nonce plus strict-dynamic: the fallbacks for old browsers are shown as ignored.', bare: true, Content: () => <CspEvaluator defaultValue={STRONG_CSP} className="max-w-[760px]" /> },
      rationale(
        'A CSP is easy to write and hard to read: whether a source matters depends on others beside it and on which directives are missing.',
        'Resolving the policy the way the browser does, and ranking what is weak, turns a header into a reviewable decision.',
        'Security settings pages, deploy checks, header audits, compliance reviews.',
        ['Textarea', 'table', 'severity pills'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'The policy, with or without the header name.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'onReport', type: '(report: CspEvaluatorReport) => void', description: 'Findings and effective policy after each edit.' },
      { name: 'label', type: 'string', defaultValue: "'Content-Security-Policy'", description: 'Field label.' },
    ],
  },
}
