import { useEffect, useState } from 'react'
import {
  Button,
  DaySchedule,
  LiveChart,
  StatusStrip,
  Surface,
  Text,
  TreeMap,
  type ScheduleEvent,
  type StatusInterval,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const SPEND = [
  { id: 'housing', label: 'Housing', value: 1250 },
  { id: 'groceries', label: 'Groceries', value: 480 },
  { id: 'transport', label: 'Transport', value: 190 },
  { id: 'subs', label: 'Subscriptions', value: 213 },
  { id: 'eating', label: 'Eating out', value: 168 },
  { id: 'health', label: 'Health', value: 142 },
  { id: 'utilities', label: 'Utilities', value: 128 },
  { id: 'clothes', label: 'Clothes', value: 96 },
  { id: 'books', label: 'Books', value: 62 },
  { id: 'gifts', label: 'Gifts', value: 54 },
  { id: 'travel', label: 'Travel', value: 48 },
  { id: 'fees', label: 'Fees', value: 22 },
]

const INTERVALS: StatusInterval[] = Array.from({ length: 60 }, (_, index) => {
  const day = 60 - index
  if (index < 4) return { id: `${day} days ago`, uptime: 0, missing: true }
  if (index === 21) return { id: `${day} days ago`, uptime: 0.82, detail: 'Card authorisations delayed, 3h 12m' }
  if (index === 22) return { id: `${day} days ago`, uptime: 0.973, detail: 'Recovering' }
  if (index === 40 || index === 41) return { id: `${day} days ago`, uptime: 0.991, detail: 'Elevated latency' }
  return { id: `${day} days ago`, uptime: 1 }
})

/** Seeded so every render, test run and screenshot shows the same strip. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TODAY = new Date(2026, 8, 17)

function statusDays(seed: number, events: Record<number, Partial<StatusInterval>>, missing = 0): StatusInterval[] {
  const random = seeded(seed)
  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date(TODAY)
    date.setDate(TODAY.getDate() - (89 - index))
    const id = `day-${index}`
    if (index < missing) return { id, date, status: 'unknown' as const }
    const event = events[index]
    if (event) return { id, date, status: 'operational' as const, ...event }
    return random() > 0.985
      ? { id, date, status: 'degraded' as const, downtimeMinutes: 3, incidents: ['Brief spike in response times'] }
      : { id, date, status: 'operational' as const }
  })
}

const SERVICES = [
  {
    label: 'API',
    intervals: statusDays(3, {
      41: { status: 'outage', downtimeMinutes: 47, incidents: ['Elevated 5xx rates on write endpoints'] },
      42: { status: 'degraded', downtimeMinutes: 6, incidents: ['Elevated 5xx rates on write endpoints (monitoring)'] },
      77: { status: 'degraded', downtimeMinutes: 12, incidents: ['Slow responses from us-east-1'] },
    }),
  },
  {
    label: 'Dashboard',
    intervals: statusDays(4, {
      63: { status: 'degraded', downtimeMinutes: 0, incidents: ['Charts loading slowly for some workspaces'] },
    }),
  },
  {
    label: 'Webhooks',
    intervals: statusDays(
      5,
      { 88: { status: 'outage', downtimeMinutes: 92, incidents: ['Delayed webhook deliveries', 'Retry queue backlog'] } },
      12,
    ),
  },
]

const AGENDA: ScheduleEvent[] = [
  { id: '1', title: 'Month-end close', start: '09:00', end: '11:30', detail: 'Finance', color: 'var(--color-accent-soft)' },
  { id: '2', title: 'Standup', start: '09:30', end: '09:45', detail: 'Team' },
  { id: '3', title: 'Reconciliation review', start: '10:00', end: '10:45' },
  { id: '4', title: 'Lunch', start: '12:30', end: '13:15', tentative: true },
  { id: '5', title: 'Card scheme call', start: '14:00', end: '15:00', detail: 'External', color: 'var(--color-accent-soft)' },
  { id: '6', title: 'Design review', start: '14:30', end: '15:30' },
  { id: '7', title: 'Focus block', start: '16:00', end: '18:00' },
  { id: '8', title: 'Retro', start: '17:00', end: '17:45', tentative: true },
]

const money = (value: number) => `$${value.toLocaleString('en-US')}`

/* ----------------------------------------------------------- specimens */

function LiveChartExample() {
  const [values, setValues] = useState<number[]>(() =>
    Array.from({ length: 30 }, (_, index) => 240 + Math.sin(index / 3) * 40 + Math.random() * 20),
  )
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setValues((current) => {
        const last = current[current.length - 1] ?? 250
        const next = Math.max(80, Math.min(520, last + (Math.random() - 0.48) * 70))
        return [...current.slice(-79), next]
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="gap-1">
        <LiveChart
          values={values}
          label="Authorisations per minute"
          interval={1000}
          window={40}
          threshold={{ value: 450, label: 'the alert level' }}
          format={(value) => `${Math.round(value)}/min`}
        />
      </Surface>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setRunning((value) => !value)}>
          {running ? 'Pause the feed' : 'Resume the feed'}
        </Button>
        <Text size="caption" tone="faint">
          One sample a second. React renders once per sample, not once per frame.
        </Text>
      </div>
    </div>
  )
}

function TreeMapExample() {
  const [picked, setPicked] = useState<string | null>(null)
  const total = SPEND.reduce((sum, node) => sum + node.value, 0)

  return (
    <div className="flex w-full flex-col gap-2">
      <Surface variant="card" padding="lg" className="gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Text size="heading">September spending</Text>
          <Text size="caption" tone="faint" tabular>
            {money(total)} across {SPEND.length} categories
          </Text>
        </div>
        <TreeMap
          nodes={SPEND}
          label="Spending by category"
          format={money}
          onSelect={(node) => setPicked(node.label)}
        />
      </Surface>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {picked ? `Opened ${picked}.` : 'Every tile is a button. Twelve categories in a donut would be unreadable.'}
      </Text>
    </div>
  )
}

function StatusExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full gap-5">
      <StatusStrip
        intervals={INTERVALS}
        label="Card authorisations"
        from="60 days ago"
        to="Today"
      />
      <StatusStrip
        intervals={INTERVALS.map((interval, index) => ({
          ...interval,
          uptime: index === 30 ? 0.94 : interval.missing ? 0 : 1,
          detail: index === 30 ? 'Scheduled maintenance, 1h 26m' : undefined,
        }))}
        label="Transfers"
        from="60 days ago"
        to="Today"
      />
    </Surface>
  )
}

function DeclaredStatusExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full gap-6">
      {SERVICES.map((service, index) => (
        <StatusStrip
          key={service.label}
          label={service.label}
          intervals={service.intervals}
          from="90 days ago"
          to="Today"
          height={32}
          showLegend={index === SERVICES.length - 1}
        />
      ))}
    </Surface>
  )
}

function ScheduleExample() {
  const [opened, setOpened] = useState<string | null>(null)

  return (
    <div className="flex w-full flex-col gap-2">
      <Surface variant="card" padding="lg" className="gap-3">
        <Text size="heading">Today</Text>
        <DaySchedule
          events={AGENDA}
          label="Today’s schedule"
          from={8}
          to={19}
          onSelect={(event) => setOpened(event.title)}
        />
      </Surface>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {opened
          ? `Opened ${opened}.`
          : 'Three overlapping clusters. The 16:00 focus block keeps its width until the retro overlaps it.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

const STRIP_KEYBOARD =
  'The strip is one tab stop. Arrow keys step through the intervals and show the tip, Home and End jump to either end, Escape clears. Every value is also in a visually hidden table.'

export const demos: ExampleModule = {
  'live-chart': {
    description:
      'A line that scrolls as new samples arrive. The path is redrawn only when a sample lands; the scrolling between samples is one CSS transition on the group transform — so the line glides continuously while React renders once per sample.',
    sections: [
      {
        title: 'Example',
        description: 'One sample a second, with a threshold line. Pause it to see the path hold still.',
        bare: true,
        Content: LiveChartExample,
        note: motionNote('the scroll stops and the chart steps sample by sample; the reading is unaffected.'),
      },
      rationale(
        'A chart of live data redrawn on every frame burns a frame budget to show a number that only changes once a second.',
        'Separating the two — path on sample, movement on transition — keeps it smooth for a fraction of the cost, and easing the scale stops a new maximum making every earlier reading look wrong.',
        'An operations dashboard, a rate monitor, a queue depth, anything with a live feed behind it.',
        ['VisuallyHidden', 'SVG', 'usePrefersReducedMotion', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'values', type: 'number[]', description: 'Newest last. Push to it as samples arrive.' },
      { name: 'window / interval', type: 'number / number', defaultValue: '40 / 1000', description: 'Samples on screen, and the milliseconds between them — the scroll is timed from this.' },
      { name: 'domain', type: '[number, number]', description: 'Fixed scale. Omit and it eases towards the window bounds.' },
      { name: 'threshold', type: '{ value, label }', description: 'A limit line, also named in the live region when crossed.' },
      { name: 'area / color / format', type: 'boolean / string / fn', description: 'Appearance and the value readout.' },
    ],
  },

  'status-strip': {
    description:
      'The uptime strip from a status page: one bar per interval, coloured by how much of it was healthy — a ratio from a monitor — or by the status a person declared, with the incidents behind it. A declared status wins over any ratio. Missing data is its own state, never an outage — the distinction between “we were down” and “we were not watching” is the one a status page exists to make.',
    sections: [
      {
        title: 'Two services',
        description: 'Measured ratios. Hover any bar, or tab to a strip and use the arrow keys. The first four intervals have no data at all.',
        bare: true,
        Content: StatusExample,
        note: (
          <>
            {STRIP_KEYBOARD} {motionNote('bars appear at full height instead of rising in sequence.')}
          </>
        ),
      },
      {
        title: 'Declared status & incidents',
        description:
          'Ninety days per service, each with the status that was published and the incidents behind it. Uptime comes from the downtime minutes. Webhooks has no data for its first twelve days, and those days are left out of the percentage.',
        bare: true,
        Content: DeclaredStatusExample,
        note: (
          <>
            {STRIP_KEYBOARD} {motionNote('bars appear at full height instead of rising in sequence.')}
          </>
        ),
      },
      rationale(
        'Uptime is normally reported as a single percentage, which hides whether the missing 0.4% was one bad afternoon or a slow leak over a month.',
        'A bar per interval shows the shape, and attaching incidents to intervals lets the strip answer “what was that red bar?” without leaving the page. Every figure is in the tip, a live region and a hidden table, so colour is never the only carrier.',
        'A status page, an operations dashboard, an SLA report, a service detail panel.',
        ['Legend', 'Text', 'VisuallyHidden', 'status tokens'],
      ),
    ],
    props: [
      {
        name: 'intervals',
        type: 'StatusInterval[]',
        description:
          'Oldest first. id plus uptime 0–1 or status (operational, degraded, outage, unknown), with optional incidents, downtimeMinutes, date, detail, and `missing` for no data.',
      },
      { name: 'label', type: 'string', description: 'The service name. Also the accessible name.' },
      { name: 'uptime', type: 'number', description: 'Uptime to print, 0–1. Averaged from the measured intervals when omitted.' },
      {
        name: 'degraded / down',
        type: 'number / number',
        defaultValue: '0.995 / 0.9',
        description: 'Thresholds for the two unhealthy states. A declared status beats them.',
      },
      { name: 'from / to', type: 'string / string', description: 'Captions at each end of the strip.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'false', description: 'Status key — show it once under a stack of strips.' },
      { name: 'height', type: 'number', defaultValue: '34', description: 'Bar height. Widths are flexible.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'tree-map': {
    description:
      'Part-to-whole by area, laid out so every tile is close to square. A naive treemap slices strips off one edge and produces slivers whose area cannot be judged and whose labels do not fit; the squarified algorithm closes a row the moment adding another value would make it less square.',
    sections: [
      {
        title: 'Twelve categories',
        description: 'Tiles are buttons here. Labels are drawn only where they fit, so nothing is clipped mid-word.',
        bare: true,
        Content: TreeMapExample,
        note: motionNote('unchanged — only the hover dimming is a transition, and it is not required.'),
      },
      rationale(
        'A donut answers a handful of slices well and a long tail not at all — twelve categories in one is a ring of unreadable slivers with a legend doing all the work.',
        'A treemap shows the whole distribution at once, and squarifying is what makes the areas comparable rather than a row of splinters.',
        'A spending breakdown, a storage report, a portfolio, a bundle-size analysis.',
        ['VisuallyHidden', 'Text', 'accent and surface tokens'],
      ),
    ],
    props: [
      { name: 'nodes', type: 'TreeMapNode[]', description: 'id, label, value and an optional colour.' },
      { name: 'onSelect', type: '(node) => void', description: 'Supplying it turns every tile into a real button.' },
      { name: 'width / height', type: 'number / number', defaultValue: '620 / 300', description: 'Layout box. The rendered element keeps the ratio and fills its column.' },
      { name: 'showShare / format', type: 'boolean / fn', defaultValue: 'true / String', description: 'Percentage beside the value, and value formatting.' },
    ],
  },

  'day-schedule': {
    description:
      'A day as a column of hours, with events placed on it and overlaps resolved. Overlapping events are grouped into clusters and each cluster split into as many columns as its busiest moment needs — splitting by the number of events instead makes three events that merely share a morning each a third as wide.',
    sections: [
      {
        title: 'A working day',
        description: 'Three clusters, two tentative holds, and a line at the current time.',
        bare: true,
        Content: ScheduleExample,
        note: motionNote('unchanged — the only movement is the current-time line, once a minute.'),
      },
      rationale(
        'Overlap is the entire difficulty of a day view, and the two common shortcuts — stacking events or dividing the width by the count — both misrepresent how busy the day actually is.',
        'Clusters plus first-fit columns give the right width to each event and keep a long meeting on the left, which is what makes the column scannable.',
        'A calendar day view, a room booking sheet, a shift planner, an agenda panel.',
        ['Text', 'VisuallyHidden', 'line and accent tokens'],
      ),
    ],
    props: [
      { name: 'events', type: 'ScheduleEvent[]', description: 'title, "HH:MM" start and end, detail, colour, and `tentative`.' },
      { name: 'from / to', type: 'number / number', defaultValue: '8 / 20', description: 'First and last hour drawn.' },
      { name: 'hourHeight', type: 'number', defaultValue: '52', description: 'Pixels per hour — everything is positioned from minutes.' },
      { name: 'showNow', type: 'boolean', defaultValue: 'true', description: 'Current-time line, updated on a minute timer.' },
      { name: 'onSelect', type: '(event) => void', description: 'Supplying it turns every event into a button.' },
    ],
  },
}
