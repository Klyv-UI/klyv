import { useState } from 'react'
import {
  AgendaList,
  AudioPlayer,
  CodeTabs,
  EditableTable,
  EventCalendar,
  ImageAnnotator,
  Leaderboard,
  ResizableBox,
  SegmentedControl,
  Surface,
  Switch,
  Text,
  TreeTable,
  VideoPlayer,
  type AgendaListEvent,
  type EditableTableColumn,
  type EventCalendarEvent,
  type ImageAnnotatorPin,
  type LeaderboardEntry,
  type ResizableBoxSize,
  type TreeTableColumn,
  type TreeTableRow,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/* -------------------------------------------------------- event calendar */

const CALENDAR_EVENTS: EventCalendarEvent[] = [
  { id: 'e1', title: 'Q3 planning offsite', date: '2026-09-01', end: '2026-09-02', tone: 'neutral' },
  { id: 'e2', title: 'Design review', date: '2026-09-03', time: '10:00' },
  { id: 'e3', title: 'Pricing page launch', date: '2026-09-08', tone: 'success' },
  { id: 'e4', title: 'Standup', date: '2026-09-10', time: '09:15', tone: 'neutral' },
  { id: 'e5', title: 'Customer call — Northwind', date: '2026-09-10', time: '11:00' },
  { id: 'e6', title: 'Security review', date: '2026-09-10', time: '14:30', tone: 'warning' },
  { id: 'e7', title: 'Team dinner', date: '2026-09-10', time: '19:00', tone: 'neutral' },
  { id: 'e8', title: 'Release 4.2', date: '2026-09-15', tone: 'success' },
  { id: 'e9', title: 'Incident retro', date: '2026-09-16', time: '15:00', tone: 'danger' },
  { id: 'e10', title: '1:1 with Priya', date: '2026-09-17', time: '10:30' },
  { id: 'e11', title: 'Roadmap sync', date: '2026-09-17', time: '13:00', tone: 'neutral' },
  { id: 'e12', title: 'Hiring panel', date: '2026-09-17', time: '16:00', tone: 'warning' },
  { id: 'e13', title: 'Board prep', date: '2026-09-22', end: '2026-09-24', tone: 'warning' },
  { id: 'e14', title: 'Payments cutover', date: '2026-09-29', time: '06:00', tone: 'danger' },
  { id: 'e15', title: 'Monthly all-hands', date: '2026-10-01', time: '17:00' },
]

function CalendarExample() {
  const [weekStart, setWeekStart] = useState<'1' | '0'>('1')
  const [month, setMonth] = useState('2026-09')
  const [last, setLast] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Week starts on"
        size="sm"
        value={weekStart}
        onValueChange={setWeekStart}
        className="self-start"
        options={[
          { value: '1', label: 'Monday' },
          { value: '0', label: 'Sunday' },
        ]}
      />
      <EventCalendar
        events={CALENDAR_EVENTS}
        month={month}
        onMonthChange={setMonth}
        today="2026-09-17"
        weekStartsOn={weekStart === '1' ? 1 : 0}
        label="Team calendar"
        onEventClick={(event) => setLast(`event ${event.title}`)}
        onDayClick={(date) => setLast(`day ${date}`)}
      />
      <Readout label="last click" value={last} />
    </div>
  )
}

/* ------------------------------------------------------------ agenda list */

const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute)
const AGENDA_NOW = at(17, 11, 20)

const AGENDA_EVENTS: AgendaListEvent[] = [
  { id: 'a1', title: 'Standup', start: at(17, 9, 15), end: at(17, 9, 30), detail: 'Zoom', tone: 'neutral' },
  { id: 'a2', title: '1:1 with Priya', start: at(17, 10, 30), end: at(17, 11, 45), detail: 'Room 4B' },
  { id: 'a3', title: 'Roadmap sync', start: at(17, 13, 0), end: at(17, 14, 0), detail: 'Product, Design, Eng leads', tone: 'neutral' },
  { id: 'a4', title: 'Hiring panel — Staff engineer', start: at(17, 16, 0), end: at(17, 17, 0), tone: 'warning' },
  { id: 'a5', title: 'Priya out of office', start: at(18, 0), allDay: true, tone: 'neutral' },
  { id: 'a6', title: 'Customer call — Northwind', start: at(18, 11, 0), end: at(18, 11, 45), detail: 'Renewal, 240 seats' },
  { id: 'a7', title: 'Payments cutover', start: at(21, 6, 0), end: at(21, 8, 0), detail: 'War room, #inc-payments', tone: 'danger' },
  { id: 'a8', title: 'Board prep', start: at(22, 0), allDay: true, tone: 'warning' },
  { id: 'a9', title: 'Pricing experiment readout', start: at(22, 15, 30), end: at(22, 16, 0), tone: 'success' },
]

function AgendaExample() {
  const [chosen, setChosen] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="md" className="w-full max-w-[460px]">
        <AgendaList events={AGENDA_EVENTS} now={AGENDA_NOW} maxHeight={380} label="Your week" onEventClick={(event) => setChosen(event.title)} />
      </Surface>
      <Readout label="chosen" value={chosen} />
    </div>
  )
}

/* ------------------------------------------------------------- tree table */

interface BudgetLine {
  name: string
  headcount?: number
  budget?: number
  utilisation?: number
}

const leaf = (id: string, name: string, headcount: number, budget: number, utilisation: number): TreeTableRow<BudgetLine> => ({
  id,
  data: { name, headcount, budget, utilisation },
})

const BUDGET: TreeTableRow<BudgetLine>[] = [
  {
    id: 'eng',
    data: { name: 'Engineering' },
    children: [
      { id: 'platform', data: { name: 'Platform' }, children: [leaf('infra', 'Infrastructure', 9, 1_420_000, 0.92), leaf('data', 'Data', 6, 910_000, 0.81)] },
      { id: 'product-eng', data: { name: 'Product engineering' }, children: [leaf('web', 'Web', 12, 1_640_000, 0.88), leaf('mobile', 'Mobile', 7, 980_000, 0.74)] },
    ],
  },
  {
    id: 'gtm',
    data: { name: 'Go to market' },
    children: [leaf('sales', 'Sales', 14, 1_870_000, 0.95), leaf('marketing', 'Marketing', 8, 1_150_000, 0.69), leaf('success', 'Customer success', 6, 640_000, 0.83)],
  },
  leaf('ga', 'G&A', 5, 720_000, 0.77),
]

const BUDGET_COLUMNS: TreeTableColumn<BudgetLine>[] = [
  { id: 'name', header: 'Team', value: (data) => data.name },
  { id: 'headcount', header: 'Headcount', value: (data) => data.headcount, aggregate: 'sum', align: 'end', width: '110px' },
  {
    id: 'budget',
    header: 'Budget',
    value: (data) => data.budget,
    aggregate: 'sum',
    align: 'end',
    width: '130px',
    format: (value) => `$${(value / 1_000_000).toFixed(2)}M`,
  },
  {
    id: 'utilisation',
    header: 'Utilisation',
    value: (data) => data.utilisation,
    aggregate: 'avg',
    align: 'end',
    width: '120px',
    format: (value) => `${Math.round(value * 100)}%`,
  },
]

function TreeTableExample() {
  const [expanded, setExpanded] = useState(['eng'])
  return (
    <div className="flex w-full flex-col gap-3">
      <TreeTable rows={BUDGET} columns={BUDGET_COLUMNS} label="2027 budget by team" expanded={expanded} onExpandedChange={setExpanded} />
      <Readout label="expanded" value={expanded.join(', ')} />
    </div>
  )
}

/* --------------------------------------------------------- editable table */

interface PriceRow {
  id: string
  sku: string
  name: string
  price: number | null
  stock: number | null
  status: string
}

const PRICE_ROWS: PriceRow[] = [
  { id: 'r1', sku: 'KB-001', name: 'Walnut desk shelf', price: 89, stock: 42, status: 'active' },
  { id: 'r2', sku: 'KB-002', name: 'Felt desk mat', price: 34, stock: 180, status: 'active' },
  { id: 'r3', sku: 'KB-003', name: 'Monitor arm', price: 149, stock: 0, status: 'backorder' },
  { id: 'r4', sku: 'KB-004', name: 'Cable tray', price: 24.5, stock: 96, status: 'draft' },
  { id: 'r5', sku: 'KB-005', name: 'Task lamp', price: 119, stock: 17, status: 'active' },
]

const PRICE_COLUMNS: EditableTableColumn<PriceRow>[] = [
  { key: 'sku', header: 'SKU', readOnly: true, width: '90px' },
  { key: 'name', header: 'Product', validate: (value) => (String(value ?? '').trim() ? undefined : 'A product needs a name') },
  {
    key: 'price',
    header: 'Price',
    type: 'number',
    width: '110px',
    format: (value) => (typeof value === 'number' ? `$${value.toFixed(2)}` : ''),
    validate: (value) => (typeof value !== 'number' || value <= 0 ? 'Price must be above zero' : undefined),
  },
  {
    key: 'stock',
    header: 'Stock',
    type: 'number',
    width: '90px',
    validate: (value) => (value !== null && (!Number.isInteger(value) || (value as number) < 0) ? 'Stock is a whole number' : undefined),
  },
  {
    key: 'status',
    header: 'Status',
    type: 'select',
    width: '130px',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
      { value: 'backorder', label: 'Backorder' },
    ],
  },
]

function EditableTableExample() {
  const [rows, setRows] = useState(PRICE_ROWS)
  const value = rows.reduce((total, row) => total + (row.price ?? 0) * (row.stock ?? 0), 0)
  return (
    <div className="flex w-full flex-col gap-3">
      <EditableTable columns={PRICE_COLUMNS} value={rows} onValueChange={setRows} label="Price list" />
      <Readout label="stock value" value={`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
    </div>
  )
}

/* ------------------------------------------------------------ leaderboard */

const PEOPLE: LeaderboardEntry[] = [
  { id: 'u1', name: 'Amara Okafor', detail: 'EMEA', score: 184_200, previousRank: 2 },
  { id: 'u2', name: 'Jonas Weber', detail: 'EMEA', score: 176_900, previousRank: 1 },
  { id: 'u3', name: 'Lucía Romero', detail: 'LATAM', score: 151_300, previousRank: 3 },
  { id: 'u4', name: 'Kenji Sato', detail: 'APAC', score: 142_750, previousRank: 7 },
  { id: 'u5', name: 'Grace Liu', detail: 'NA West', score: 142_750, previousRank: 4 },
  { id: 'u6', name: 'Noah Bennett', detail: 'NA East', score: 131_000, previousRank: 'new' },
  { id: 'u7', name: 'Fatima Zahra', detail: 'EMEA', score: 118_400, previousRank: 5 },
  { id: 'u8', name: 'Oliver Hughes', detail: 'UK&I', score: 102_900, previousRank: 8 },
  { id: 'u9', name: 'Maya Patel', detail: 'APAC', score: 97_600, previousRank: 6 },
  { id: 'u10', name: 'Diego Alvarez', detail: 'LATAM', score: 84_100, previousRank: 12 },
  { id: 'u11', name: 'Sofia Rossi', detail: 'EMEA', score: 79_800, previousRank: 10 },
  { id: 'u12', name: 'You', detail: 'NA West', score: 61_250, previousRank: 15 },
  { id: 'u13', name: 'Ethan Brooks', detail: 'NA East', score: 55_400, previousRank: 11 },
]

const currency = (score: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(score)

function LeaderboardExample() {
  const [podium, setPodium] = useState(true)
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-[12px] font-semibold text-ink-soft">
        <Switch checked={podium} onChange={(event) => setPodium(event.target.checked)} />
        Podium
      </label>
      <Surface variant="card" padding="md" className="w-full max-w-[460px]">
        <Leaderboard entries={PEOPLE} limit={8} podium={podium} currentUserId="u12" formatScore={currency} unit="closed revenue" label="Q3 closed revenue" />
      </Surface>
    </div>
  )
}

/* --------------------------------------------------------------- code tabs */

const INSTALL = [
  { value: 'npm', label: 'npm', code: 'npm install klyvui' },
  { value: 'pnpm', label: 'pnpm', code: 'pnpm add klyvui' },
  { value: 'yarn', label: 'yarn', code: 'yarn add klyvui' },
  { value: 'bun', label: 'bun', code: 'bun add klyvui' },
]

const RUN = [
  { value: 'npm', label: 'npm', code: 'npx klyvui init\nnpm run dev' },
  { value: 'pnpm', label: 'pnpm', code: 'pnpm dlx klyvui init\npnpm dev' },
  { value: 'yarn', label: 'yarn', code: 'yarn dlx klyvui init\nyarn dev' },
]

const FILES = [
  {
    value: 'app',
    label: 'App.tsx',
    highlight: true,
    code: "import { Button } from 'klyvui'\nimport 'klyvui/styles.css'\n\nexport function App() {\n  return <Button onClick={() => alert('Hi')}>Say hello</Button>\n}",
  },
  {
    value: 'css',
    label: 'index.css',
    code: "@import 'tailwindcss';\n@import 'klyvui/preset.css';\n\n:root {\n  --color-accent: oklch(0.9 0.2 125);\n}",
  },
]

function CodeTabsExample() {
  const [manager, setManager] = useState('npm')
  return (
    <div className="flex w-full flex-col gap-3">
      <Text size="caption" tone="soft">
        Both blocks share a storage key: pick pnpm in one and the other follows.
      </Text>
      <CodeTabs items={INSTALL} storageKey="klyv-docs-package-manager" label="Install with" onValueChange={setManager} />
      <CodeTabs items={RUN} storageKey="klyv-docs-package-manager" label="Set up with" />
      <Readout label="package manager" value={manager} />
    </div>
  )
}

function CodeFilesExample() {
  return <CodeTabs items={FILES} label="Files" numbered className="w-full" />
}

/* ------------------------------------------------------------------ media */

const CAPTIONS = `data:text/vtt;charset=utf-8,${encodeURIComponent(
  'WEBVTT\n\n00:00.000 --> 00:02.500\nA flower opens in the morning light.\n\n00:02.500 --> 00:05.000\nA bee arrives for the pollen.\n',
)}`

function VideoExample() {
  return (
    <div className="w-full max-w-[640px]">
      <VideoPlayer
        title="Flower time-lapse"
        src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        tracks={[{ src: CAPTIONS, srcLang: 'en', label: 'English', kind: 'captions', default: true }]}
      />
    </div>
  )
}

const WAVE = Array.from({ length: 64 }, (_, index) => {
  const envelope = 0.35 + 0.4 * Math.abs(Math.sin(index / 9))
  return Math.min(1, envelope + 0.25 * Math.abs(Math.sin(index * 1.7)))
})

const COVER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#1c2a16"/><circle cx="24" cy="24" r="12" fill="#c8f24e"/><circle cx="24" cy="24" r="4" fill="#1c2a16"/></svg>',
)}`

function AudioExample() {
  return (
    <div className="flex w-full flex-wrap items-start gap-4">
      <AudioPlayer
        className="max-w-[420px]"
        title="Shipping on Fridays"
        subtitle="The Changelog Hour · Episode 42"
        artwork={COVER}
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        waveform={WAVE}
        chapters={[
          { start: 0, title: 'Cold open' },
          { start: 48, title: 'Why Friday deploys got a bad name' },
          { start: 151, title: 'Feature flags as a safety net' },
          { start: 262, title: 'Listener questions' },
        ]}
      />
      <AudioPlayer className="max-w-[320px]" title="Voice note from Priya" subtitle="Today, 10:42" src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" />
    </div>
  )
}

/* -------------------------------------------------------- image annotator */

const MOCKUP = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
<rect width="640" height="400" fill="#f6f7f4"/>
<rect x="0" y="0" width="640" height="52" fill="#ffffff"/>
<rect x="24" y="18" width="84" height="16" rx="8" fill="#17191c"/>
<rect x="440" y="16" width="72" height="20" rx="10" fill="#e3e5e3"/>
<rect x="524" y="14" width="92" height="24" rx="12" fill="#c8f24e"/>
<rect x="170" y="92" width="300" height="260" rx="20" fill="#ffffff" stroke="#eeefee"/>
<rect x="200" y="122" width="150" height="18" rx="9" fill="#17191c"/>
<rect x="200" y="150" width="220" height="10" rx="5" fill="#c9ccc9"/>
<rect x="200" y="186" width="240" height="38" rx="19" fill="#f4f5f5"/>
<rect x="200" y="236" width="240" height="38" rx="19" fill="#f4f5f5"/>
<rect x="200" y="294" width="240" height="38" rx="19" fill="#c8f24e"/>
</svg>`)}`

const INITIAL_PINS: ImageAnnotatorPin[] = [
  { id: 'p1', x: 88.4, y: 6.5, note: 'Two primary buttons in the header — demote "Sign in".' },
  { id: 'p2', x: 50, y: 77.5, note: 'Button label says "Continue" but this is the last step.' },
]

function AnnotatorExample() {
  const [pins, setPins] = useState(INITIAL_PINS)
  return (
    <div className="flex w-full flex-col gap-3">
      <ImageAnnotator src={MOCKUP} alt="Sign-up page mockup with a header and a three-field form" value={pins} onValueChange={setPins} />
      <Readout label="value" value={pins.map((pin, index) => `${index + 1}@${pin.x},${pin.y}`).join('  ')} />
    </div>
  )
}

/* ---------------------------------------------------------- resizable box */

function ResizableExample() {
  const [size, setSize] = useState<ResizableBoxSize>({ width: 340, height: 210 })
  const [locked, setLocked] = useState<'free' | 'locked'>('free')
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Aspect ratio"
        size="sm"
        value={locked}
        onValueChange={setLocked}
        className="self-start"
        options={[
          { value: 'free', label: 'Free (Shift locks)' },
          { value: 'locked', label: 'Always locked' },
        ]}
      />
      <div className="w-full overflow-hidden pb-3 pr-3">
        <ResizableBox size={size} onResize={setSize} minWidth={200} minHeight={120} maxWidth={560} maxHeight={360} lockAspectRatio={locked === 'locked'} label="preview">
          <div className="flex size-full flex-col items-center justify-center gap-1 bg-surface-sunken p-4 text-center">
            <Text size="heading">Chart preview</Text>
            <Text size="caption" tone="faint" tabular>
              {size.width} × {size.height}
            </Text>
          </div>
        </ResizableBox>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ demos */

export const demos: ExampleModule = {
  'event-calendar': {
    description:
      'A month of events as chips on a fixed-height grid, for content calendars, rotas and launch plans. A busy day shows its first chips and “+n more”, which opens the whole day in a popover, so one packed Thursday never makes the rest of the month jump. The grid has one tab stop with the date keyboard model — arrows, Home and End, PageUp and PageDown — and Tab from a day walks into that day’s events only.',
    sections: [
      { title: 'Example', description: 'September, with an overloaded 10th and a three-day board prep.', bare: true, Content: CalendarExample },
      rationale(
        'A plain date picker grid has no room for events, and a full scheduling suite is far more than a team calendar needs.',
        'Fixed-height days with an overflow popover keep the month readable at a glance, and the keyboard model matches Calendar, so nothing has to be relearned.',
        'Content and release calendars, on-call rotas, marketing plans, booking overviews.',
        ['Popover', 'IconButton', 'Button', 'grid'],
      ),
    ],
    props: [
      { name: 'events', type: 'EventCalendarEvent[]', description: '{ id, title, date, end?, time?, tone? } — dates as yyyy-mm-dd, end inclusive.' },
      { name: 'month / defaultMonth', type: 'string', description: 'The month shown, as yyyy-mm.' },
      { name: 'onMonthChange', type: '(month: string) => void', description: 'Prev, next, Today, or the keyboard crossing a month.' },
      { name: 'weekStartsOn', type: '0 | 1', defaultValue: '1', description: 'Sunday or Monday first.' },
      { name: 'maxPerDay', type: 'number', defaultValue: '2', description: 'Chips before “+n more”.' },
      { name: 'onEventClick', type: '(event) => void', description: 'A chip was chosen, in the grid or the popover.' },
      { name: 'onDayClick', type: '(date: string) => void', description: 'A day was clicked, or Enter was pressed on it.' },
      { name: 'today', type: 'string', defaultValue: 'system date', description: 'yyyy-mm-dd to treat as today.' },
      { name: 'label', type: 'string', defaultValue: "'Events'", description: 'Grid name; the month is appended.' },
    ],
  },

  'agenda-list': {
    description:
      'The coming days as a list grouped under sticky day headings — the calendar view that works on a phone and in a sidebar. Days without events are skipped, the nearest are named Today and Tomorrow with the date beside them, all-day events lead their day, and today carries a now line with the event in progress marked.',
    sections: [
      { title: 'Example', description: 'It is 11:20 on Thursday: the 1:1 is under way, the standup is over.', bare: true, Content: AgendaExample },
      rationale(
        'A month grid on a narrow screen is a page of empty squares, and a flat list of events loses the sense of which day is which.',
        'Grouping by day with relative names answers the question people actually ask — what is next — and skipping empty days keeps a quiet week short.',
        'Mobile calendars, dashboard sidebars, “your day” panels, booking confirmations.',
        ['Text', 'VisuallyHidden', 'sticky headers'],
      ),
    ],
    props: [
      { name: 'events', type: 'AgendaListEvent[]', description: '{ id, title, start, end?, allDay?, detail?, tone? } — dates as Date or ISO string.' },
      { name: 'now', type: 'Date', defaultValue: 'the clock', description: 'What Today and the now line measure from; re-read each minute when omitted.' },
      { name: 'onEventClick', type: '(event) => void', description: 'Makes events buttons.' },
      { name: 'stickyHeaders', type: 'boolean', defaultValue: 'true', description: 'Pin each day heading while its events scroll.' },
      { name: 'maxHeight', type: 'number', description: 'Scroll inside at this height, in px.' },
      { name: 'empty', type: 'ReactNode', defaultValue: "'Nothing scheduled.'", description: 'Shown with no events.' },
      { name: 'label', type: 'string', defaultValue: "'Agenda'", description: 'Region name.' },
    ],
  },

  'tree-table': {
    description:
      'Rows that nest — teams inside departments — with the same columns at every level. It is a treegrid: each row announces its level, position and expanded state; Up and Down move, Right expands or steps in, Left collapses or steps out, Enter toggles and * expands siblings. Parent rows can roll up their leaves with sum, avg, min, max or your own function, computed from the leaves so an average is never an average of averages.',
    sections: [
      { title: 'Example', description: 'A budget where department totals and utilisation are aggregated from teams.', bare: true, Content: TreeTableExample },
      rationale(
        'A tree view has no columns, and a flat table has to repeat the department on every row and still cannot total it.',
        'One row focus with the tree keyboard model is predictable, and aggregates from leaves stay correct however deep the tree is.',
        'Budgets and cost centres, file sizes by folder, org charts with metrics, nested task lists with estimates.',
        ['Button', 'treegrid', 'ChevronRightIcon'],
      ),
    ],
    props: [
      { name: 'rows', type: 'TreeTableRow<T>[]', description: '{ id, data, children? }.' },
      { name: 'columns', type: 'TreeTableColumn<T>[]', description: '{ id, header, value, aggregate?, format?, align?, width? }. The first column holds the tree.' },
      { name: 'label', type: 'string', description: 'Accessible name for the table.' },
      { name: 'expanded / defaultExpanded', type: 'string[]', description: 'Expanded row ids.' },
      { name: 'onExpandedChange', type: '(ids: string[]) => void', description: 'After every toggle.' },
      { name: 'showExpandControls', type: 'boolean', defaultValue: 'true', description: 'Expand all and Collapse all.' },
      { name: 'onRowClick', type: '(row) => void', description: 'A leaf was clicked or had Enter pressed.' },
    ],
  },

  'editable-table': {
    description:
      'A spreadsheet-style table edited in place. Arrows move between cells without editing; Enter, F2, double-click or just typing opens a cell (typing replaces the value). Enter commits and moves down, Tab commits and moves across, Escape restores. Columns are text, number or select, each with its own check — a value that fails stays open with the message beside it instead of being saved.',
    sections: [
      { title: 'Example', description: 'Try typing “twelve” into Stock, or clearing a product name.', bare: true, Content: EditableTableExample },
      rationale(
        'Editing a row through a modal form is slow for tables that are corrected many cells at a time.',
        'The spreadsheet keyboard model is the one people already know, and per-cell validation refuses bad values at the moment they are typed.',
        'Price lists, stock counts, budget allocations, bulk user edits, translation tables.',
        ['grid', 'native select', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'columns', type: 'EditableTableColumn<T>[]', description: '{ key, header, type?, options?, validate?, format?, readOnly?, align?, width? }.' },
      { name: 'value / defaultValue', type: 'T[]', description: 'Rows, each with an id.' },
      { name: 'onValueChange', type: '(rows: T[]) => void', description: 'Every row, after a cell commits.' },
      { name: 'label', type: 'string', description: 'Accessible name for the grid.' },
    ],
  },

  leaderboard: {
    description:
      'A ranking with movement arrows, an optional podium for the top three and the reader’s own row always in view. Ties share a rank (1, 2, 2, 4); arrows carry their meaning in words for screen readers; and when you are outside the top N your row is pinned beneath the list after a break rather than hidden.',
    sections: [
      { title: 'Example', description: 'Top eight by closed revenue, with you at twelfth.', bare: true, Content: LeaderboardExample },
      rationale(
        'A plain ranked table leaves most readers scrolling to find themselves, and a coloured arrow alone says nothing to a screen reader.',
        'Pinning the current user answers the first question anyone asks of a leaderboard, and the podium is CSS order over the same list so reading order stays 1, 2, 3.',
        'Sales contests, gamified onboarding, contributor boards, class and fitness challenges.',
        ['Avatar', 'VisuallyHidden', 'ordered list'],
      ),
    ],
    props: [
      { name: 'entries', type: 'LeaderboardEntry[]', description: '{ id, name, score, avatar?, detail?, previousRank? } — previousRank may be "new".' },
      { name: 'limit', type: 'number', defaultValue: '10', description: 'Ranks listed.' },
      { name: 'currentUserId', type: 'string', description: 'Highlighted, and pinned when outside the limit.' },
      { name: 'podium', type: 'boolean', defaultValue: 'false', description: 'Raise the top three.' },
      { name: 'formatScore', type: '(score: number) => string', defaultValue: 'toLocaleString', description: 'Score text.' },
      { name: 'unit', type: 'string', defaultValue: "'points'", description: 'Read after each score.' },
      { name: 'label', type: 'string', description: 'Accessible name for the ranking.' },
    ],
  },

  'code-tabs': {
    description:
      'One snippet in several forms — npm, pnpm and yarn, or a set of files — in tabs above a CodeBlock with a copy button. Give blocks the same storageKey and choosing pnpm in one switches all of them and is remembered next visit; a block without that tab keeps its own choice. Storage access is guarded, so private windows simply do not remember.',
    sections: [
      { title: 'Package managers', bare: true, Content: CodeTabsExample },
      { title: 'Files', description: 'Without a storage key, with line numbers and highlighting per tab.', bare: true, Content: CodeFilesExample },
      rationale(
        'Docs that repeat the package-manager choice on every block make readers pick it again and again.',
        'A shared key turns one choice into a site-wide preference without a settings page, and the code is still CodeBlock so it looks like every other snippet.',
        'Install instructions, framework variants, client and server pairs, language switchers in API docs.',
        ['CodeBlock', 'CopyButton', 'Surface', 'tablist'],
      ),
    ],
    props: [
      { name: 'items', type: 'CodeTabsItem[]', description: '{ value, label, code, highlight? }.' },
      { name: 'value / defaultValue', type: 'string', description: 'Selected tab.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Chosen here or synced from another block.' },
      { name: 'storageKey', type: 'string', description: 'Remember and share the choice under this key.' },
      { name: 'label', type: 'string', description: 'Accessible name for the tab list.' },
      { name: 'numbered', type: 'boolean', defaultValue: 'false', description: 'Line numbers.' },
    ],
  },

  'video-player': {
    description:
      'A video with library controls under the picture: play, a seek slider that reads “0:03 of 0:05”, mute and volume, captions, a speed menu and full screen. Controls never auto-hide. The YouTube shortcuts — Space or K, J and L, arrows, M, F, C — work only while focus is inside the player, and each announces what it did.',
    sections: [
      { title: 'Example', description: 'Click the picture or a control, then try K, J, L, M or C.', bare: true, Content: VideoExample },
      rationale(
        'Native controls look different in every browser, and most custom players hide their controls and swallow keys page-wide.',
        'Real buttons and range inputs keep every control labelled, and scoping shortcuts to the player means a second video or a text field never catches them.',
        'Product tours, course lessons, feature announcements, recorded demos and webinars.',
        ['IconButton', 'Slider', 'Menu', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'src', type: 'string', description: 'The video file.' },
      { name: 'title', type: 'string', description: 'Names the player.' },
      { name: 'poster', type: 'string', description: 'Image before playback.' },
      { name: 'tracks', type: 'VideoPlayerTrack[]', description: '{ src, srcLang, label, kind?, default? } WebVTT files.' },
      { name: 'rates', type: 'number[]', defaultValue: '[0.5 … 2]', description: 'Speeds in the menu.' },
      { name: 'skip', type: 'number', defaultValue: '10', description: 'Seconds J and L move.' },
      { name: 'loop', type: 'boolean', defaultValue: 'false', description: 'Restart at the end.' },
    ],
  },

  'audio-player': {
    description:
      'Spoken audio with play, a seek bar, the time and a speed menu. Given waveform data, the waveform is the seek bar — a real range input lies over the bars, so the keyboard gets a slider and the pointer drags the picture. Chapters list under the controls with the playing one marked.',
    sections: [
      { title: 'Example', description: 'A podcast episode with a waveform and chapters, and a plain voice note.', bare: true, Content: AudioExample },
      rationale(
        'The native audio element is unstyled and inconsistent, and long episodes are navigated by topic, which it cannot do.',
        'Four controls cover what people use on spoken audio, and reusing Waveform makes progress visible without drawing a second chart.',
        'Podcasts, voice notes in chat, call recordings, audio lessons, text-to-speech previews.',
        ['Waveform', 'Slider', 'Menu', 'IconButton'],
      ),
    ],
    props: [
      { name: 'src', type: 'string', description: 'The audio file.' },
      { name: 'title / subtitle', type: 'string', description: 'The two lines; title also names the player.' },
      { name: 'artwork', type: 'string', description: 'Decorative cover image.' },
      { name: 'waveform', type: 'number[]', description: 'Bar heights 0–1; becomes the seek bar.' },
      { name: 'chapters', type: 'AudioPlayerChapter[]', description: '{ start (seconds), title }.' },
      { name: 'rates', type: 'number[]', defaultValue: '[0.75 … 2]', description: 'Speeds in the menu.' },
    ],
  },

  'image-annotator': {
    description:
      'Numbered pins on an image with a note for each in a list beside it. Click to drop a pin, or focus the image, move the crosshair with the arrows (Shift for bigger steps) and press Enter. A focused pin moves with the arrows and Delete removes it; selecting a pin highlights its note and the other way round. Positions are percentages, so pins stay put at any size.',
    sections: [
      { title: 'Example', description: 'Design review feedback on a sign-up mockup.', bare: true, Content: AnnotatorExample },
      rationale(
        'Feedback on a screenshot usually arrives as “the button top right”, and drawing tools that do better are mouse-only.',
        'Numbered pins tie each note to a spot, a keyboard crosshair makes placement possible without a pointer, and percentages survive any resize.',
        'Design review, bug reports with screenshots, site inspections, photo tagging, floor-plan notes.',
        ['Textarea', 'IconButton', 'VisuallyHidden', 'live region'],
      ),
    ],
    props: [
      { name: 'src / alt', type: 'string', description: 'The image and its description.' },
      { name: 'value / defaultValue', type: 'ImageAnnotatorPin[]', description: '{ id, x, y, note } with x and y as percentages.' },
      { name: 'onValueChange', type: '(pins) => void', description: 'After each add, move, edit or delete.' },
      { name: 'readOnly', type: 'boolean', defaultValue: 'false', description: 'Show pins and notes only.' },
    ],
  },

  'resizable-box': {
    description:
      'A box with right, bottom and corner handles. Each handle is a focusable separator carrying the size it changes, so it is announced and moved with the arrow keys; Home and End go to the limits. Shift keeps the proportions from the start of the resize, on the pointer and the keyboard alike, and lockAspectRatio makes that permanent.',
    sections: [
      { title: 'Example', description: 'Drag or focus a handle; hold Shift to keep the ratio.', bare: true, Content: ResizableExample },
      rationale(
        'CSS resize gives one corner, no limits a reader can discover, no keyboard and no event to save the size from.',
        'Separators with values are the ARIA pattern for exactly this, and Shift for aspect ratio is the convention from every design tool.',
        'Embed and chart previews, resizable notes and panels, responsive-design testers, image crops.',
        ['separator', 'pointer capture'],
      ),
    ],
    props: [
      { name: 'size / defaultSize', type: 'ResizableBoxSize', defaultValue: '{ width: 320, height: 200 }', description: 'Pixels.' },
      { name: 'onResize', type: '(size) => void', description: 'Every movement and key press.' },
      { name: 'onResizeEnd', type: '(size) => void', description: 'When a drag ends, and after each key press.' },
      { name: 'minWidth / minHeight', type: 'number', defaultValue: '80 / 60', description: 'Lower limits.' },
      { name: 'maxWidth / maxHeight', type: 'number', defaultValue: '1200 / 800', description: 'Upper limits.' },
      { name: 'handles', type: "('right' | 'bottom' | 'corner')[]", defaultValue: 'all three', description: 'Which handles to draw.' },
      { name: 'lockAspectRatio', type: 'boolean', defaultValue: 'false', description: 'Always keep proportions.' },
      { name: 'step', type: 'number', defaultValue: '10', description: 'Pixels per arrow key.' },
      { name: 'label', type: 'string', defaultValue: "'box'", description: 'Names the handles: “Resize preview width”.' },
    ],
  },
}
