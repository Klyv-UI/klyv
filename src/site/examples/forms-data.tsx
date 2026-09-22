import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import {
  Button,
  CodeEditor,
  Field,
  KpiStrip,
  LikertScale,
  LogViewer,
  Receipt,
  RecurrenceEditor,
  SearchableCheckboxList,
  Text,
  TimeRangePicker,
  TrendDelta,
  WeekView,
  type KpiStripItem,
  type LikertScaleStatement,
  type LogViewerLevel,
  type LogViewerLine,
  type ReceiptLineItem,
  type RecurrenceEditorValue,
  type SearchableCheckboxListItem,
  type TimeRangePickerValue,
  type WeekViewEvent,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="break-all font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/** Deterministic noise, so every render of a demo draws the same data. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

/* ------------------------------------------------------ time range picker */

function TimeRangeExample() {
  const [hours, setHours] = useState<TimeRangePickerValue>({ start: '09:00', end: '17:30' })
  const [shift, setShift] = useState<TimeRangePickerValue>({ start: '22:00', end: '06:00' })
  return (
    <div className="flex w-full flex-col gap-6 sm:flex-row">
      <div className="flex flex-1 flex-col gap-2">
        <TimeRangePicker label="Opening hours" value={hours} onValueChange={setHours} />
        <Readout label="value" value={JSON.stringify(hours)} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <TimeRangePicker label="Night shift" startLabel="Clock in" endLabel="Clock out" allowOvernight step={60} value={shift} onValueChange={setShift} />
        <Readout label="value" value={JSON.stringify(shift)} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------ recurrence editor */

function RecurrenceExample() {
  const [rule, setRule] = useState<RecurrenceEditorValue>({
    frequency: 'weekly',
    interval: 2,
    weekdays: [1, 4],
    monthlyBy: 'date',
    monthDay: 14,
    nth: 2,
    nthWeekday: 2,
    month: 10,
    ends: 'after',
    until: '2026-12-31',
    count: 10,
  })
  const [rrule, setRRule] = useState('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=10')
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <RecurrenceEditor
        label="Design critique repeats"
        value={rule}
        onValueChange={(next, details) => {
          setRule(next)
          setRRule(details.rrule)
        }}
      />
      <Readout label="rrule" value={rrule} />
    </div>
  )
}

/* ----------------------------------------------------------- likert scale */

const ONBOARDING: LikertScaleStatement[] = [
  { id: 'setup', label: 'Setting up my workspace was straightforward', required: true },
  { id: 'docs', label: 'The documentation answered my questions', required: true },
  { id: 'invite', label: 'Inviting my team took no effort' },
  { id: 'value', label: 'I saw value in the first week', required: true },
]

function LikertExample() {
  const [answers, setAnswers] = useState<Record<string, string>>({ setup: '4' })
  const [attempted, setAttempted] = useState(false)
  const missing = ONBOARDING.filter((statement) => statement.required && !answers[statement.id]).length
  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setAttempted(true)
      }}
    >
      <LikertScale label="How was your first month?" statements={ONBOARDING} value={answers} onValueChange={setAnswers} showErrors={attempted} name="onboarding" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm">
          Send feedback
        </Button>
        <Text size="caption" tone="faint" aria-live="polite">
          {attempted ? (missing ? `${missing} required ${missing === 1 ? 'answer is' : 'answers are'} missing` : 'Thanks — all required answers are in') : 'Starred statements are required.'}
        </Text>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ code editor */

const CONFIG = `{
  "name": "billing-worker",
  "retries": 3,
  "queues": ["invoices", "refunds"],
  "backoff": {
    "initialMs": 500,
    "factor": 2
  }
}`

function CodeEditorExample() {
  const [source, setSource] = useState(CONFIG)
  const error = useMemo(() => {
    try {
      JSON.parse(source)
      return undefined
    } catch (reason) {
      return (reason as Error).message
    }
  }, [source])
  return (
    <div className="flex w-full flex-col gap-3">
      <Field label="Worker configuration" error={error} hint="JSON. Checked as you type.">
        <CodeEditor value={source} onValueChange={setSource} rows={10} />
      </Field>
    </div>
  )
}

/* ------------------------------------------------ searchable checkbox list */

const ADJECTIVES = ['swift', 'quiet', 'amber', 'silver', 'north', 'lucid', 'brave', 'coral', 'dusty', 'eager', 'fern', 'glass']
const NOUNS = ['api', 'web', 'worker', 'gateway', 'billing', 'search', 'ledger', 'mailer', 'auth', 'metrics']

const REPOSITORIES: SearchableCheckboxListItem[] = Array.from({ length: 1200 }, (_, index) => {
  const name = `${ADJECTIVES[index % ADJECTIVES.length]}-${NOUNS[Math.floor(index / ADJECTIVES.length) % NOUNS.length]}-${String(index + 1).padStart(4, '0')}`
  return { id: `repo-${index}`, label: name, description: index % 3 === 0 ? 'archived' : index % 5 === 0 ? 'private' : undefined, disabled: index % 97 === 13 }
})

function CheckboxListExample() {
  const [selected, setSelected] = useState<string[]>(['repo-0', 'repo-4', 'repo-25'])
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <SearchableCheckboxList label="Repositories" items={REPOSITORIES} value={selected} onValueChange={setSelected} placeholder="Filter 1,200 repositories" />
      <Readout label="value" value={`${selected.length} ids — ${selected.slice(0, 4).join(', ')}${selected.length > 4 ? '…' : ''}`} />
    </div>
  )
}

/* -------------------------------------------------------------- kpi strip */

const trend = (seed: number, base: number, drift: number) => {
  const random = seeded(seed)
  return Array.from({ length: 14 }, (_, index) => base + drift * index + (random() - 0.5) * base * 0.12)
}

const KPIS: KpiStripItem[] = [
  { label: 'Net revenue', value: '$48,210', delta: 12.4, trend: trend(3, 3000, 40) },
  { label: 'Active accounts', value: '3,982', delta: 4.1, trend: trend(7, 3700, 18) },
  { label: 'Churn', value: '2.3%', delta: -0.4, deltaFormat: 'number', deltaUnit: 'pts', inverse: true, trend: trend(11, 2.8, -0.04) },
  { label: 'p95 latency', value: '312 ms', delta: 8.9, inverse: true, trend: trend(5, 280, 2.5), hint: 'Target under 300 ms' },
]

/* ------------------------------------------------------------- week view */

const WEEK = new Date(2026, 8, 14)
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, 14 + day, hour, minute)

const MEETINGS: WeekViewEvent[] = [
  { id: 'offsite', title: 'Team offsite', start: at(3, 0), end: at(5, 0), allDay: true },
  { id: 'standup-1', title: 'Standup', start: at(0, 9, 30), end: at(0, 9, 45) },
  { id: 'plan', title: 'Sprint planning', start: at(0, 10), end: at(0, 11, 30), detail: 'Room 4' },
  { id: 'one', title: '1:1 with Priya', start: at(0, 11), end: at(0, 11, 30) },
  { id: 'standup-2', title: 'Standup', start: at(1, 9, 30), end: at(1, 9, 45) },
  { id: 'review', title: 'Design review', start: at(1, 13), end: at(1, 14, 30), detail: 'Figma', color: 'color-mix(in oklab, var(--color-warning) 30%, var(--color-surface))' },
  { id: 'interview', title: 'Interview', start: at(1, 13, 30), end: at(1, 14, 15) },
  { id: 'focus', title: 'Focus time', start: at(2, 9), end: at(2, 12), color: 'var(--color-surface-muted)' },
  { id: 'lunch', title: 'Lunch & learn', start: at(2, 12, 30), end: at(2, 13, 30) },
  { id: 'incident', title: 'Incident review', start: at(2, 15), end: at(2, 16), color: 'color-mix(in oklab, var(--color-danger) 20%, var(--color-surface))' },
  { id: 'deploy', title: 'Release window', start: at(4, 16), end: at(4, 18), detail: 'On call' },
  { id: 'migration', title: 'DB migration', start: at(5, 22), end: at(6, 2) },
]

function WeekViewExample() {
  const [events, setEvents] = useState(MEETINGS)
  const [message, setMessage] = useState('Click an empty slot to add an event, or pick one.')
  const time = (date: Date) => date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex w-full flex-col gap-3">
      <WeekView
        label="Team calendar"
        events={events}
        defaultDate={WEEK}
        now={at(2, 14, 20)}
        startHour={6}
        scrollToHour={9}
        onEventSelect={(event) => setMessage(`Selected “${event.title}”, ${time(event.start)}`)}
        onSlotCreate={(start, end) => {
          setEvents((current) => [...current, { id: `new-${start.getTime()}`, title: 'New event', start, end }])
          setMessage(`Created an event at ${time(start)}`)
        }}
      />
      <Text size="caption" tone="faint" aria-live="polite">
        {message}
      </Text>
    </div>
  )
}

/* --------------------------------------------------------------- receipt */

const ORDER: ReceiptLineItem[] = [
  { id: 'kb', description: 'Low-profile keyboard', detail: 'Graphite, UK layout', quantity: 1, unitPrice: 129 },
  { id: 'cable', description: 'Braided USB-C cable', detail: '2 m', quantity: 2, unitPrice: 14.5 },
  { id: 'mat', description: 'Felt desk mat', quantity: 1, unitPrice: 39 },
]

function ReceiptExample() {
  const download = () => {
    const text = ['Northwind Supply Co.', 'Receipt no. NW-20417', ...ORDER.map((item) => `${item.quantity} × ${item.description}  ${(item.quantity * item.unitPrice).toFixed(2)}`)].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    link.download = 'receipt-NW-20417.txt'
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <Receipt
      merchant={{
        name: 'Northwind Supply Co.',
        address: '18 Canal Street, Manchester M1 3HE',
        logo: (
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[12px] bg-accent text-[15px] font-extrabold text-accent-ink">
            N
          </span>
        ),
      }}
      number="NW-20417"
      date={new Date(2026, 8, 12, 14, 32)}
      items={ORDER}
      discounts={[{ label: 'WELCOME10', amount: 19.7 }]}
      shipping={0}
      tax={{ label: 'VAT', rate: 0.2 }}
      payment={{ method: 'Visa', last4: '4242', status: 'Paid' }}
      currency="GBP"
      locale="en-GB"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print receipt">
            <Printer size={14} aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={download} aria-label="Download receipt">
            <Download size={14} aria-hidden="true" />
          </Button>
        </>
      }
      footer="Returns accepted within 30 days. Questions? help@northwind.example"
    />
  )
}

/* ------------------------------------------------------------ log viewer */

const SOURCES = ['api', 'worker', 'scheduler', 'auth', 'billing']
const MESSAGES: [LogViewerLevel, string][] = [
  ['debug', 'cache hit for key session:{id}'],
  ['info', 'GET /v1/invoices/{id} 200 in {ms}ms'],
  ['info', 'job invoice.render completed in {ms}ms'],
  ['debug', 'acquired lock queue:refunds after {ms}ms'],
  ['info', 'POST /v1/payments 201 in {ms}ms'],
  ['warn', 'retrying webhook delivery to https://hooks.acme.example (attempt 2 of 5)'],
  ['info', 'user {id} signed in with SSO'],
  ['warn', 'slow query on invoices_by_customer took {ms}ms'],
  ['error', 'payment_intent {id} failed: card_declined'],
  ['error', 'connection reset by peer while reading from redis:6379'],
]

function makeLine(index: number, random: () => number, base: number): LogViewerLine {
  const pick = random()
  const [level, template] = MESSAGES[pick < 0.9 ? Math.floor(random() * 8) : 8 + Math.floor(random() * 2)]
  return {
    id: index,
    timestamp: base + index * 480 + Math.floor(random() * 300),
    level,
    source: SOURCES[Math.floor(random() * SOURCES.length)],
    message: template.replace('{id}', Math.floor(random() * 90000 + 10000).toString(36)).replace('{ms}', String(Math.floor(random() * 900 + 4))),
  }
}

function LogViewerExample() {
  const [lines, setLines] = useState(() => {
    const random = seeded(42)
    const base = new Date(2026, 8, 17, 9, 0).getTime()
    return Array.from({ length: 5000 }, (_, index) => makeLine(index, random, base))
  })
  const [streaming, setStreaming] = useState(true)

  useEffect(() => {
    if (!streaming) return
    const random = seeded(Date.now() % 100000)
    const timer = window.setInterval(() => {
      setLines((current) => [...current, makeLine(current.length, random, new Date(2026, 8, 17, 9, 0).getTime())])
    }, 900)
    return () => window.clearInterval(timer)
  }, [streaming])

  return (
    <div className="flex w-full flex-col gap-3">
      <LogViewer label="billing-worker logs" lines={lines} height={340} />
      <div>
        <Button variant="outline" size="sm" onClick={() => setStreaming((on) => !on)}>
          {streaming ? 'Stop the stream' : 'Resume the stream'}
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'time-range-picker': {
    description:
      'A start and an end time that know about each other. The end list only offers times after the start, moving the start carries the end with it so the length survives, and the duration is shown and announced as it changes. With allowOvernight an end at or before the start is read as the next day, which the field and the duration both say.',
    sections: [
      { title: 'Example', description: 'Move the opening time and watch the close follow. The night shift ends the next morning.', bare: true, Content: TimeRangeExample },
      {
        title: 'States',
        specimens: [
          { label: 'empty', node: <TimeRangePicker label="Delivery window" className="w-[340px]" /> },
          { label: 'step 15', node: <TimeRangePicker label="Meeting" step={15} defaultValue={{ start: '14:15', end: '14:45' }} className="w-[340px]" /> },
          { label: 'disabled', node: <TimeRangePicker label="Quiet hours" disabled defaultValue={{ start: '20:00', end: '23:00' }} className="w-[340px]" /> },
        ],
      },
      rationale(
        'Two unrelated time fields let a range end before it starts, and the form only finds out on submit — or never, for a night shift that genuinely does.',
        'Constraining the second list and carrying the length removes the error rather than reporting it; overnight is a stated mode, not a silent guess.',
        'Opening hours, delivery windows, shifts, quiet hours, maintenance windows.',
        ['TimePicker', 'Label', 'Popover'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: '{ start: string; end: string }', description: '24-hour HH:mm strings. Empty strings are unset.' },
      { name: 'onValueChange', type: '(value) => void', description: 'After either end changes, with the whole range.' },
      { name: 'label', type: 'string', description: 'Names the pair as a group.' },
      { name: 'startLabel / endLabel', type: 'string', defaultValue: "'Starts' / 'Ends'", description: 'Visible labels of the two pickers.' },
      { name: 'step', type: '15 | 30 | 60', defaultValue: '30', description: 'Minutes between options, and the shortest range.' },
      { name: 'allowOvernight', type: 'boolean', defaultValue: 'false', description: 'An end at or before the start means the next day.' },
      { name: 'hideDuration', type: 'boolean', defaultValue: 'false', description: 'Drops the duration line.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks both pickers.' },
    ],
  },

  'recurrence-editor': {
    description:
      'The “Repeats” part of an event form. Frequency and interval read as one phrase, weekly shows day toggles, monthly offers both “on day 14” and “on the second Tuesday”, and the series can end never, on a date, or after a count. It always finishes with the rule as a sentence, and hands the caller the same rule as an RFC 5545 RRULE string.',
    sections: [
      { title: 'Example', description: 'Every change updates the sentence and the RRULE below.', bare: true, Content: RecurrenceExample },
      {
        title: 'Frequencies',
        specimens: [
          { label: 'monthly, by weekday', node: <RecurrenceEditor label="Board meeting repeats" defaultValue={{ frequency: 'monthly', monthlyBy: 'weekday', nth: -1, nthWeekday: 5 }} className="w-[340px]" /> },
          { label: 'yearly, showRRule', node: <RecurrenceEditor label="Renewal repeats" showRRule defaultValue={{ frequency: 'yearly', month: 3, monthDay: 31, ends: 'on', until: '2030-03-31' }} className="w-[340px]" /> },
        ],
      },
      rationale(
        'Recurrence controls depend on each other, and nobody can tell what rule they built until the calendar fills with the wrong meetings.',
        'A sentence is the only readback everyone understands, and RRULE is the format every calendar backend already expands.',
        'Event and meeting forms, reminders, scheduled reports, subscription and billing cycles.',
        ['NumberInput', 'Select', 'Radio', 'DatePicker'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'RecurrenceEditorValue', description: 'frequency, interval, weekdays, monthlyBy, monthDay, nth, nthWeekday, month, ends, until, count. defaultValue may be partial.' },
      { name: 'onValueChange', type: '(value, { summary, rrule }) => void', description: 'After every change, with the sentence and the RRULE string.' },
      { name: 'label', type: 'string', defaultValue: "'Repeats'", description: 'Names the group.' },
      { name: 'showRRule', type: 'boolean', defaultValue: 'false', description: 'Prints the RRULE under the sentence.' },
    ],
  },

  'likert-scale': {
    description:
      'A survey matrix of statements against one agreement scale. Every row is a radiogroup of native radios named by its statement, and every radio carries its own option label, so arrow keys move along a row and each stop is announced properly. The layout follows its container: a grid when there is room, one card per statement when there is not. Required rows are starred, counted in the progress line, and flagged after a submit attempt.',
    sections: [
      { title: 'Example', description: 'Send it with a required row unanswered to see the errors. Narrow the window to see the cards.', bare: true, Content: LikertExample },
      {
        title: 'Custom scale',
        specimens: [
          {
            label: 'three options, no progress',
            fill: true,
            node: (
              <LikertScale
                label="How often do you use these?"
                showProgress={false}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'sometimes', label: 'Sometimes' },
                  { value: 'daily', label: 'Daily' },
                ]}
                statements={[
                  { id: 'search', label: 'Global search' },
                  { id: 'shortcuts', label: 'Keyboard shortcuts' },
                ]}
                defaultValue={{ search: 'daily' }}
              />
            ),
          },
        ],
      },
      rationale(
        'Survey grids are usually tables of unlabelled radios: fine to look at, meaningless to a screen reader, and impossible to use on a phone.',
        'Per-radio labels and one DOM for both layouts keep it accessible and responsive without a second implementation.',
        'Product surveys, onboarding and NPS follow-ups, course evaluations, employee pulse checks.',
        ['input type=radio', 'Container queries'],
      ),
    ],
    props: [
      { name: 'statements', type: '{ id; label; required? }[]', description: 'Rows, each one radiogroup.' },
      { name: 'options', type: '{ value; label }[]', defaultValue: 'five-point agreement', description: 'Columns, in scale order.' },
      { name: 'value / defaultValue', type: 'Record<string, string>', description: 'Answers keyed by statement id.' },
      { name: 'onValueChange', type: '(value) => void', description: 'With every answer after one changes.' },
      { name: 'label', type: 'string', description: 'The question the matrix asks.' },
      { name: 'showProgress', type: 'boolean', defaultValue: 'true', description: 'Answered count and bar.' },
      { name: 'showErrors', type: 'boolean', defaultValue: 'false', description: 'Flags unanswered required rows. Set after a submit attempt.' },
      { name: 'name', type: 'string', description: 'Form name prefix; rows submit as name[id].' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks every row.' },
    ],
  },

  'code-editor': {
    description:
      'A textarea that behaves enough like an editor for JSON, config and snippets: a line-number gutter kept in step with the scroll, Tab and Shift+Tab to indent and outdent the selected lines, Enter that keeps the indent and opens blocks between brackets, and paired brackets and quotes. It is still a textarea, so Field, forms and assistive tech treat it as one. Tab is trapped for indenting, so the way out is stated under it: press Esc, then Tab.',
    sections: [
      { title: 'Example', description: 'Select a few lines and press Tab or Shift+Tab. Break the JSON to see the error.', bare: true, Content: CodeEditorExample },
      {
        title: 'States',
        specimens: [
          { label: 'readOnly', fill: true, node: <CodeEditor label="Generated webhook payload" readOnly rows={4} defaultValue={'{\n  "event": "invoice.paid",\n  "id": "evt_1Q2w3E"\n}'} /> },
          { label: 'showStatus false', fill: true, node: <CodeEditor label="Snippet" showStatus={false} rows={3} defaultValue={'const total = items\n  .map((item) => item.price)\n  .reduce((a, b) => a + b, 0)'} /> },
        ],
      },
      rationale(
        'Pasting JSON into a plain textarea means indenting with the space bar and counting lines to find the error.',
        'A full code editor is hundreds of kilobytes and breaks form semantics; a textarea with the handful of editor keys covers config fields.',
        'Webhook payloads, feature-flag rules, JSON settings, custom CSS fields, query snippets.',
        ['textarea', 'Field conventions'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'The source text.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit, including indents.' },
      { name: 'label', type: 'string', description: 'Accessible name when no Field supplies one.' },
      { name: 'rows', type: 'number', defaultValue: '12', description: 'Visible lines before it scrolls.' },
      { name: 'tabSize', type: 'number', defaultValue: '2', description: 'Spaces per indent.' },
      { name: 'showStatus', type: 'boolean', defaultValue: 'true', description: 'Line and column, and the Esc-then-Tab hint.' },
      { name: 'invalid / disabled / readOnly', type: 'boolean', description: 'Field forwards invalid and disabled.' },
      { name: 'containerClassName', type: 'string', description: 'Classes for the frame.' },
    ],
  },

  'searchable-checkbox-list': {
    description:
      'Many checkboxes behind a filter. “Select all” acts on what is shown, with a mixed state that describes the same set; the selected count always counts everything; and “Show selected only” answers what was ticked. Only the rows in view are rendered, so a list of thousands stays instant, and arrow keys move between rows.',
    sections: [
      { title: 'Example', description: '1,200 repositories. Filter to “billing”, select all shown, then show selected only.', bare: true, Content: CheckboxListExample },
      rationale(
        'A long list of checkboxes is unusable without search, and “select all” next to a filter usually means the whole list, which nobody intended.',
        'Real checkboxes keep keyboard and screen-reader behaviour standard; windowing keeps thousands of them cheap.',
        'Repository and project access, notification topics, country and region lists, export columns, recipients.',
        ['Checkbox', 'Input', 'Switch'],
      ),
    ],
    props: [
      { name: 'items', type: '{ id; label; description?; disabled? }[]', description: 'Every option.' },
      { name: 'value / defaultValue', type: 'string[]', description: 'Ticked ids.' },
      { name: 'onValueChange', type: '(value: string[]) => void', description: 'Ticked ids in item order.' },
      { name: 'label', type: 'string', description: 'Names the list and its filter.' },
      { name: 'placeholder', type: 'string', defaultValue: "'Filter'", description: 'Filter placeholder.' },
      { name: 'height', type: 'number', defaultValue: '280', description: 'Scrolling list height in pixels.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks the whole control.' },
    ],
  },

  'kpi-strip': {
    description:
      'Headline figures in one row, divided by hairlines instead of boxed into cards, so they read as one period seen several ways. Each is a label, a value and a TrendDelta against the previous period, with an optional sparkline. Metrics where down is good set inverse. The rules survive wrapping, so a narrow screen gets a tidy grid.',
    sections: [
      { title: 'Framed, with trends', bare: true, Content: () => <KpiStrip label="Last 30 days" comparison="vs previous 30 days" items={KPIS} framed className="w-full" /> },
      {
        title: 'Bare',
        specimens: [
          {
            label: 'no sparklines',
            fill: true,
            node: (
              <KpiStrip
                label="Today"
                items={[
                  { label: 'Orders', value: '1,284', delta: 6.2 },
                  { label: 'Refunds', value: '19', delta: 3, deltaFormat: 'number', inverse: true },
                  { label: 'Conversion', value: '3.8%', delta: 0 },
                ]}
              />
            ),
          },
        ],
      },
      rationale(
        'Rows of metric cards spend most of their space on borders and shadows, and a delta with no baseline is a number with no meaning.',
        'A strip is denser and reads as one summary; the comparison is spoken with every delta so none is heard without its baseline.',
        'Dashboard headers, report summaries, campaign and experiment results, billing overviews.',
        ['TrendDelta', 'Sparkline'],
      ),
    ],
    props: [
      { name: 'items', type: 'KpiStripItem[]', description: 'label, value, delta, deltaFormat, deltaUnit, inverse, trend, hint.' },
      { name: 'label', type: 'string', description: 'Names the strip.' },
      { name: 'comparison', type: 'string', description: 'What every delta is against, read with each.' },
      { name: 'minItemWidth', type: 'number', defaultValue: '168', description: 'Width before the row wraps.' },
      { name: 'framed', type: 'boolean', defaultValue: 'false', description: 'Draws the strip as a card.' },
    ],
  },

  'trend-delta': {
    description:
      'An inline change: sign, figure and arrow. The arrow always follows the sign and inverse only changes the colour, so falling latency points down and is green. Screen readers hear “down 3.2 percent vs last week” instead of the symbols, and colour is never the only signal.',
    sections: [
      {
        title: 'Tones',
        specimens: [
          { label: 'positive', node: <TrendDelta value={12.4} /> },
          { label: 'negative', node: <TrendDelta value={-3.2} /> },
          { label: 'inverse', hint: 'latency fell', node: <TrendDelta value={-18} inverse /> },
          { label: 'flat', node: <TrendDelta value={0.04} flatThreshold={0.05} /> },
          { label: 'tone neutral', node: <TrendDelta value={7} tone="neutral" /> },
        ],
      },
      {
        title: 'Formats',
        specimens: [
          { label: 'number', node: <TrendDelta value={-3} format="number" /> },
          { label: 'unit', node: <TrendDelta value={1.25} format="number" decimals={2} unit="pts" /> },
          { label: 'context', node: <TrendDelta value={4.8} context="vs last week" /> },
          { label: 'pill, md', node: <TrendDelta value={22.5} variant="pill" size="md" /> },
          { label: 'no arrow', node: <TrendDelta value={-9.1} showArrow={false} variant="pill" /> },
        ],
      },
      rationale(
        'Deltas get colour-coded by sign, which is wrong for every metric where down is good, and read out as “minus sign”.',
        'Separating direction from judgement fixes the colours; a spoken sentence fixes the reading.',
        'Metric cards and strips, table cells, pricing changes, experiment results.',
        ['Inline SVG', 'sr-only text'],
      ),
    ],
    props: [
      { name: 'value', type: 'number', description: 'The change. Sign is the direction.' },
      { name: 'format', type: "'percent' | 'number'", defaultValue: "'percent'", description: 'Adds % and reads “percent”, or not.' },
      { name: 'decimals', type: 'number', defaultValue: '1', description: 'Most fraction digits.' },
      { name: 'unit', type: 'string', description: 'After a number delta.' },
      { name: 'inverse', type: 'boolean', defaultValue: 'false', description: 'Down is good. Changes colour, not the arrow.' },
      { name: 'tone', type: "'auto' | 'positive' | 'negative' | 'neutral'", defaultValue: "'auto'", description: 'Overrides the colour.' },
      { name: 'flatThreshold', type: 'number', defaultValue: '0', description: 'At or below this size counts as no change.' },
      { name: 'context / showContext', type: 'string / boolean', description: 'Comparison text, shown and read, or read only.' },
      { name: 'showArrow', type: 'boolean', defaultValue: 'true', description: 'Draws the arrow.' },
      { name: 'size / variant', type: "'sm' | 'md' / 'text' | 'pill'", defaultValue: "'sm' / 'text'", description: 'Text size and treatment.' },
      { name: 'locale', type: 'string', description: 'Number formatting locale.' },
    ],
  },

  'week-view': {
    description:
      'Seven days on an hour grid. Overlapping events share columns only as far as their busiest moment needs, events past midnight are clipped into each day, all-day events have their own row, and a now line marks the current minute. Events are one tab stop, walked with arrow keys and named with their day and times; clicking empty grid reports the slot for creating an event.',
    sections: [
      { title: 'Example', description: 'Click an empty slot to add an event. Tab to the events and use the arrow keys.', bare: true, Content: WeekViewExample },
      rationale(
        'A list of events hides how a week actually fills up, and a month grid has no room for times or clashes.',
        'The overlap layout is the same one DaySchedule uses, so a day and a week never disagree about the same meetings.',
        'Team and room calendars, booking back-offices, shift planning, interview schedules.',
        ['IconButton', 'DaySchedule layout'],
      ),
    ],
    props: [
      { name: 'events', type: 'WeekViewEvent[]', description: 'id, title, start, end, allDay, color, detail.' },
      { name: 'date / defaultDate', type: 'Date', description: 'Any day in the week shown.' },
      { name: 'onDateChange', type: '(weekStart: Date) => void', description: 'After previous, next or today.' },
      { name: 'weekStartsOn', type: '0 | 1', defaultValue: '1', description: 'Sunday or Monday.' },
      { name: 'startHour / endHour', type: 'number', defaultValue: '0 / 24', description: 'Hours drawn.' },
      { name: 'scrollToHour', type: 'number', defaultValue: '8', description: 'Scrolled into view on mount.' },
      { name: 'hourHeight / height', type: 'number', defaultValue: '44 / 440', description: 'Pixels per hour, and grid height.' },
      { name: 'slotMinutes', type: '15 | 30 | 60', defaultValue: '30', description: 'Snap and length of a created slot.' },
      { name: 'onEventSelect', type: '(event) => void', description: 'When an event is activated.' },
      { name: 'onSlotCreate', type: '(start: Date, end: Date) => void', description: 'Empty-grid click.' },
      { name: 'now', type: 'Date', description: 'Fixes the now line; otherwise the clock, each minute.' },
      { name: 'locale / label', type: 'string', description: 'Date formatting and the region name.' },
    ],
  },

  receipt: {
    description:
      'An order receipt that works on screen and on paper from the same markup. Totals are derived from the line items, discounts, shipping and tax, so the column always adds up. Line items are a real table, amounts use the currency and locale given, and printing drops the actions, the card chrome and the theme so dark mode still prints black on white.',
    sections: [
      { title: 'Example', description: 'Print uses the print styles; Download saves a text copy.', bare: true, Content: ReceiptExample },
      rationale(
        'Receipts are rebuilt per screen with hand-summed totals, and a dark-mode receipt prints as pale grey on white.',
        'Deriving every total removes arithmetic drift, and print styles belong with the component rather than every page that shows one.',
        'Order confirmations, billing history, point-of-sale screens, expense attachments.',
        ['table', 'print: variants'],
      ),
    ],
    props: [
      { name: 'merchant', type: '{ name; address?; logo? }', description: 'Who was paid.' },
      { name: 'number / date', type: 'string / Date | string', description: 'Receipt number and payment date.' },
      { name: 'items', type: 'ReceiptLineItem[]', description: 'description, detail, quantity, unitPrice.' },
      { name: 'discounts', type: '{ label; amount }[]', description: 'Positive amounts off the subtotal.' },
      { name: 'shipping', type: 'number', description: '0 shows “Free”.' },
      { name: 'tax', type: '{ label; rate?; amount? }', description: 'Rate applies after discounts; amount wins.' },
      { name: 'payment', type: '{ method; last4?; status? }', description: 'How it was paid.' },
      { name: 'currency / locale', type: 'string', defaultValue: "'USD' / reader’s", description: 'Amount and date formatting.' },
      { name: 'actions / footer', type: 'ReactNode', description: 'Print or download buttons (hidden in print), and a closing line.' },
    ],
  },

  'log-viewer': {
    description:
      'A log tail with timestamps, level chips, level filters with counts, search that filters and marks matches, a wrap toggle, and copy per line. Following the newest line pauses as soon as you scroll up, counts what arrived since, and offers one button back. Unwrapped lines are windowed, so five thousand lines cost what forty do; wrapping shows the newest thousand and says so.',
    sections: [
      { title: 'Example', description: '5,000 lines with a new one arriving every second. Scroll up to pause following, search “declined”, turn off debug.', bare: true, Content: LogViewerExample },
      rationale(
        'Log panes that always jump to the newest line make the error that just scrolled past unreadable, and rendering every line freezes the tab.',
        'Pausing on scroll respects the reader; windowing fixed-height rows keeps it smooth with thousands of lines and no dependency.',
        'Deploy and build output, job runs, webhook debugging, admin consoles, support tooling.',
        ['Input', 'Switch', 'Windowed rows'],
      ),
    ],
    props: [
      { name: 'lines', type: 'LogViewerLine[]', description: 'id, timestamp, level, message, source. Oldest first; append to stream.' },
      { name: 'label', type: 'string', defaultValue: "'Logs'", description: 'Names the log region and search.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Scrolling height in pixels.' },
      { name: 'defaultLevels', type: 'LogViewerLevel[]', defaultValue: 'all', description: 'Levels shown at first.' },
      { name: 'defaultFollow', type: 'boolean', defaultValue: 'true', description: 'Start pinned to the newest line.' },
      { name: 'defaultWrap', type: 'boolean', defaultValue: 'false', description: 'Start wrapped.' },
    ],
  },
}
