import { useEffect, useState } from 'react'
import {
  AnimatedGrid,
  BeeswarmChart,
  Button,
  Card,
  CohortRetention,
  Meteors,
  NetworkGraph,
  OrgChart,
  SegmentedControl,
  SignalStrength,
  StreamGraph,
  SunburstChart,
  Text,
  TranscriptView,
  type AnimatedGridVariant,
  type BeeswarmChartPoint,
  type CohortRetentionCohort,
  type MeteorsTone,
  type NetworkGraphLink,
  type NetworkGraphNode,
  type OrgChartPerson,
  type StreamGraphOffset,
  type SunburstChartNode,
  type TranscriptViewLine,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ data */

/** Deterministic noise, so every render of the docs shows the same data. */
const noise = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

const TRANSCRIPT: TranscriptViewLine[] = [
  { id: 't1', start: 0, speaker: 'Priya (Klyv)', text: 'Thanks for making time. Could you start by walking me through how your team closes the month today?' },
  { id: 't2', start: 7, speaker: 'Marcus (Northwind)', text: 'Sure. We export invoices from billing, then someone reconciles them against the bank feed in a spreadsheet.' },
  { id: 't3', start: 15, speaker: 'Marcus (Northwind)', text: 'It usually takes three people about four days, and most of that is chasing failed payments.' },
  { id: 't4', start: 23, speaker: 'Priya (Klyv)', text: 'Four days is a lot. Where does the spreadsheet break down first?' },
  { id: 't5', start: 29, speaker: 'Marcus (Northwind)', text: 'Refunds. A partial refund shows up as a separate line and nobody knows which invoice it belongs to.' },
  { id: 't6', start: 37, speaker: 'Marcus (Northwind)', text: 'So we match them by amount and date, and that is wrong often enough that we check every one by hand.' },
  { id: 't7', start: 46, speaker: 'Priya (Klyv)', text: 'If refunds carried the original invoice number, would that remove the manual check?' },
  { id: 't8', start: 53, speaker: 'Marcus (Northwind)', text: 'Most of it. We would still review anything over five thousand dollars, but that is a handful a month.' },
  { id: 't9', start: 61, speaker: 'Aiko (Northwind)', text: 'Can I add something? The other half of the time goes on currency. We bill in euros and report in dollars.' },
  { id: 't10', start: 70, speaker: 'Aiko (Northwind)', text: 'The exchange rate in billing never matches the rate the bank used, so every euro invoice is a few cents off.' },
  { id: 't11', start: 79, speaker: 'Priya (Klyv)', text: 'That is useful. Do you book the difference somewhere, or write it off?' },
  { id: 't12', start: 85, speaker: 'Aiko (Northwind)', text: 'We write it off under a thousand dollars a month. Above that the auditors want an explanation.' },
  { id: 't13', start: 93, speaker: 'Priya (Klyv)', text: 'And the failed payments Marcus mentioned — how do you find out one has failed?' },
  { id: 't14', start: 100, speaker: 'Marcus (Northwind)', text: 'An email from the payment provider. It lands in a shared inbox and whoever sees it first retries the card.' },
  { id: 't15', start: 109, speaker: 'Marcus (Northwind)', text: 'Sometimes two people retry the same card, and then the customer gets charged twice and we issue a refund.' },
  { id: 't16', start: 118, speaker: 'Priya (Klyv)', text: 'Which becomes another refund to reconcile. I can see why the month takes four days.' },
  { id: 't17', start: 125, speaker: 'Aiko (Northwind)', text: 'Exactly. If retries happened automatically and refunds linked back, we could close in a day.' },
  { id: 't18', start: 133, speaker: 'Priya (Klyv)', text: 'Great. Let me show you the reconciliation view we are building and you can tell me what is missing.' },
]
const TRANSCRIPT_END = 140

const SPEND: SunburstChartNode = {
  id: 'all',
  label: 'Cloud spend',
  children: [
    {
      id: 'compute',
      label: 'Compute',
      children: [
        {
          id: 'api',
          label: 'API',
          children: [
            { id: 'api-prod', label: 'Production', value: 18400 },
            { id: 'api-stage', label: 'Staging', value: 3100 },
          ],
        },
        {
          id: 'workers',
          label: 'Workers',
          children: [
            { id: 'wk-import', label: 'Imports', value: 7200 },
            { id: 'wk-email', label: 'Email', value: 2400 },
            { id: 'wk-reports', label: 'Reports', value: 4100 },
          ],
        },
        { id: 'ci', label: 'CI runners', value: 5300 },
      ],
    },
    {
      id: 'data',
      label: 'Data',
      children: [
        {
          id: 'postgres',
          label: 'Postgres',
          children: [
            { id: 'pg-primary', label: 'Primary', value: 9800 },
            { id: 'pg-replicas', label: 'Replicas', value: 6200 },
          ],
        },
        { id: 'warehouse', label: 'Warehouse', value: 8700 },
        { id: 'redis', label: 'Redis', value: 2100 },
      ],
    },
    {
      id: 'storage',
      label: 'Storage',
      children: [
        { id: 's3-uploads', label: 'Uploads', value: 4300 },
        { id: 's3-backups', label: 'Backups', value: 3600 },
        { id: 's3-logs', label: 'Logs', value: 1900 },
      ],
    },
    {
      id: 'network',
      label: 'Network',
      children: [
        { id: 'cdn', label: 'CDN', value: 3900 },
        { id: 'egress', label: 'Egress', value: 2700 },
      ],
    },
    { id: 'observability', label: 'Monitoring', value: 4600 },
  ],
}

const SERVICES: NetworkGraphNode[] = [
  { id: 'web', label: 'web', group: 'Edge' },
  { id: 'mobile', label: 'mobile-bff', group: 'Edge' },
  { id: 'gateway', label: 'api-gateway', group: 'Edge' },
  { id: 'auth', label: 'auth', group: 'Core' },
  { id: 'billing', label: 'billing', group: 'Core' },
  { id: 'accounts', label: 'accounts', group: 'Core' },
  { id: 'search', label: 'search', group: 'Core' },
  { id: 'notify', label: 'notifications', group: 'Core' },
  { id: 'reports', label: 'reports', group: 'Core' },
  { id: 'pg', label: 'postgres', group: 'Data' },
  { id: 'redis', label: 'redis', group: 'Data' },
  { id: 'queue', label: 'queue', group: 'Data' },
  { id: 'warehouse', label: 'warehouse', group: 'Data' },
  { id: 'elastic', label: 'elastic', group: 'Data' },
  { id: 'stripe', label: 'Stripe', group: 'Third party' },
  { id: 'postmark', label: 'Postmark', group: 'Third party' },
  { id: 'twilio', label: 'Twilio', group: 'Third party' },
]

const CALLS: NetworkGraphLink[] = [
  ['web', 'gateway'],
  ['mobile', 'gateway'],
  ['gateway', 'auth'],
  ['gateway', 'billing'],
  ['gateway', 'accounts'],
  ['gateway', 'search'],
  ['gateway', 'reports'],
  ['auth', 'redis'],
  ['auth', 'accounts'],
  ['accounts', 'pg'],
  ['billing', 'pg'],
  ['billing', 'stripe'],
  ['billing', 'queue'],
  ['queue', 'notify'],
  ['notify', 'postmark'],
  ['notify', 'twilio'],
  ['search', 'elastic'],
  ['reports', 'warehouse'],
  ['warehouse', 'pg'],
  ['accounts', 'queue'],
].map(([source, target]) => ({ source, target }))

const ORG: OrgChartPerson = {
  id: 'ceo',
  name: 'Elena Marsh',
  title: 'Chief Executive',
  children: [
    {
      id: 'cto',
      name: 'Daniel Okafor',
      title: 'CTO',
      children: [
        {
          id: 'eng-platform',
          name: 'Sofia Lindqvist',
          title: 'Eng Manager, Platform',
          children: [
            { id: 'p1', name: 'Tomás Reyes', title: 'Staff Engineer' },
            { id: 'p2', name: 'Hana Sato', title: 'Senior Engineer' },
            { id: 'p3', name: 'Oliver Grant', title: 'Engineer' },
          ],
        },
        {
          id: 'eng-product',
          name: 'Kwame Mensah',
          title: 'Eng Manager, Product',
          children: [
            { id: 'q1', name: 'Isla Fraser', title: 'Senior Engineer' },
            { id: 'q2', name: 'Arjun Mehta', title: 'Engineer' },
          ],
        },
      ],
    },
    {
      id: 'cpo',
      name: 'Maya Whitfield',
      title: 'VP Product',
      children: [
        { id: 'pm1', name: 'Lucas Moreau', title: 'Product Manager' },
        {
          id: 'design',
          name: 'Noor Haddad',
          title: 'Head of Design',
          children: [
            { id: 'd1', name: 'Felix Braun', title: 'Product Designer' },
            { id: 'd2', name: 'Chloe Park', title: 'Researcher' },
          ],
        },
      ],
    },
    {
      id: 'cro',
      name: 'James Holloway',
      title: 'VP Sales',
      children: [
        { id: 's1', name: 'Grace Adeyemi', title: 'Account Executive' },
        { id: 's2', name: 'Mateo Rossi', title: 'Account Executive' },
        { id: 's3', name: 'Emma Novak', title: 'Sales Engineer' },
      ],
    },
  ],
}

const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']
const COMPANIES = ['Acme', 'Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Stark', 'Wayne', 'Wonka']
const DEALS: BeeswarmChartPoint[] = PLANS.flatMap((plan, planIndex) =>
  Array.from({ length: [26, 24, 18, 12][planIndex] }, (_, index) => {
    const base = [4, 11, 24, 50][planIndex]
    const spread = [4, 7, 12, 26][planIndex]
    const value = Math.round((base + (noise(index, planIndex + 1) + noise(index, planIndex + 9) - 1) * spread) * 10) / 10
    return {
      id: `${plan}-${index}`,
      group: plan,
      value: Math.max(0.6, value),
      label: `${COMPANIES[(index + planIndex * 3) % COMPANIES.length]} ${plan === 'Enterprise' ? 'Group' : 'Labs'} ${index + 1}`,
    }
  }),
)

const COHORTS: CohortRetentionCohort[] = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((month, index) => {
  const size = Math.round(820 + noise(index, 3) * 640)
  const periods = 7 - index
  const retained = Array.from({ length: periods }, (_, period) => {
    if (period === 0) return size
    const share = 0.44 + index * 0.025 + 0.5 * Math.exp(-period * 0.9) - period * 0.012
    return Math.round(size * Math.min(0.98, share + (noise(index * 7 + period, 5) - 0.5) * 0.04))
  })
  return { label: `${month} 2026`, size, retained }
})

const WEEKS = Array.from({ length: 16 }, (_, index) => `W${index + 23}`)
const USAGE = [
  { id: 'dashboards', label: 'Dashboards', base: 420, trend: 6 },
  { id: 'reports', label: 'Reports', base: 310, trend: -8 },
  { id: 'alerts', label: 'Alerts', base: 120, trend: 14 },
  { id: 'exports', label: 'Exports', base: 200, trend: 1 },
  { id: 'ai', label: 'AI assistant', base: 20, trend: 34 },
].map((stream, streamIndex) => ({
  id: stream.id,
  label: stream.label,
  values: WEEKS.map((_, week) =>
    Math.max(0, Math.round(stream.base + stream.trend * week + (noise(week, streamIndex + 2) - 0.5) * stream.base * 0.3)),
  ),
}))

/* ------------------------------------------------------------- examples */

function TranscriptExample() {
  const [time, setTime] = useState(20)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setTime((value) => {
        if (value + 0.5 >= TRANSCRIPT_END) {
          setPlaying(false)
          return TRANSCRIPT_END
        }
        return value + 0.5
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [playing])

  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  return (
    <Card title="Customer interview — Northwind finance team" className="w-full max-w-[640px]">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause' : 'Play at 2×'}
          </Button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <div className="h-full rounded-full bg-accent-strong" style={{ width: `${(time / TRANSCRIPT_END) * 100}%` }} />
          </div>
          <Text as="span" size="caption" weight="semibold" tone="soft" tabular>
            {clock(time)} / {clock(TRANSCRIPT_END)}
          </Text>
        </div>
        <TranscriptView
          lines={TRANSCRIPT}
          currentTime={time}
          onSeek={(seconds) => setTime(seconds)}
          height={320}
          label="Interview transcript"
        />
      </div>
    </Card>
  )
}

function SunburstExample() {
  const [zoomed, setZoomed] = useState('all')
  return (
    <Card title="Cloud spend, August" className="w-full max-w-[520px]">
      <div className="mt-3 flex flex-col gap-3">
        <SunburstChart
          data={SPEND}
          onZoom={setZoomed}
          valueLabel="Spend"
          format={(value) => `$${(value / 1000).toFixed(1)}k`}
          label="August cloud spend of $88,300 by category, service and environment"
        />
        <Text size="caption" tone="faint" leading="normal">
          onZoom: <code>{zoomed}</code>
        </Text>
      </div>
    </Card>
  )
}

function NetworkExample() {
  const [selected, setSelected] = useState<string | null>(null)
  const node = SERVICES.find((service) => service.id === selected)
  return (
    <Card title="Service dependencies" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <NetworkGraph
          nodes={SERVICES}
          links={CALLS}
          onNodeSelect={setSelected}
          label="Which services call which, from the web and mobile clients down to data stores and third parties"
        />
        <Text size="caption" tone="soft" leading="normal" aria-live="polite">
          {node ? `Selected: ${node.label} (${node.group})` : 'Click a service, or focus the graph and press Enter.'}
        </Text>
      </div>
    </Card>
  )
}

function OrgExample() {
  const [selected, setSelected] = useState<string>()
  return (
    <div className="flex w-full flex-col gap-2">
      <OrgChart data={ORG} selected={selected} onSelect={setSelected} label="Company organisation" />
      <Text size="caption" tone="faint">
        Drag the background to pan. Use the buttons, or focus the viewport and press plus, minus or 0, to zoom.
      </Text>
    </div>
  )
}

function BeeswarmExample() {
  const [selected, setSelected] = useState<string | null>('Growth-4')
  const deal = DEALS.find((point) => point.id === selected)
  return (
    <Card title="Annual contract value by plan" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <BeeswarmChart
          points={DEALS}
          groups={PLANS}
          selected={selected}
          onSelect={setSelected}
          valueLabel="ACV"
          format={(value) => `$${value}k`}
          label="Annual contract value of 80 accounts, grouped by plan"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Text size="caption" tone="soft" aria-live="polite">
            {deal ? `Highlighted: ${deal.label}, ${deal.group}, $${deal.value}k` : 'Nothing highlighted'}
          </Text>
          {deal && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function CohortExample() {
  return (
    <Card title="Monthly active retention by signup cohort" className="w-full">
      <div className="mt-3">
        <CohortRetention
          cohorts={COHORTS}
          label="Share of each 2026 signup cohort still active in each month after signing up"
        />
      </div>
    </Card>
  )
}

function StreamExample() {
  const [offset, setOffset] = useState<StreamGraphOffset>('wiggle')
  return (
    <Card title="Weekly active users by feature" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Baseline"
          size="sm"
          value={offset}
          onValueChange={setOffset}
          className="self-start"
          options={[
            { value: 'wiggle', label: 'Wiggle' },
            { value: 'silhouette', label: 'Silhouette' },
          ]}
        />
        <StreamGraph
          series={USAGE}
          categories={WEEKS}
          offset={offset}
          label="Weekly active users of five features over sixteen weeks; the AI assistant grows from almost nothing"
        />
      </div>
    </Card>
  )
}

function SignalExample() {
  const [bars, setBars] = useState(3)
  useEffect(() => {
    const timer = window.setInterval(() => setBars((value) => (value === 4 ? 1 : value + 1)), 2000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="flex w-full max-w-[420px] items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
      <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Text size="label" weight="bold">
          Weekly design review
        </Text>
        <Text size="caption" tone="faint">
          6 people · 24:13
        </Text>
      </div>
      <SignalStrength value={bars} label="Connection" showLabel />
    </div>
  )
}

function MeteorsExample() {
  const [tone, setTone] = useState<MeteorsTone>('ink')
  const [paused, setPaused] = useState(false)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Tone"
          size="sm"
          value={tone}
          onValueChange={setTone}
          options={[
            { value: 'ink', label: 'Ink' },
            { value: 'accent', label: 'Accent' },
          ]}
        />
        <Button size="sm" variant="outline" onClick={() => setPaused((value) => !value)}>
          {paused ? 'Play' : 'Pause'}
        </Button>
      </div>
      <div className="relative flex min-h-[260px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        <Meteors tone={tone} paused={paused} count={16} />
        <Text as="h3" size="title" className="relative max-w-[20ch]">
          Ship the release notes before the launch
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="relative max-w-[44ch]">
          The streaks fall behind this text and ignore the pointer, so the button still works.
        </Text>
        <Button size="sm" className="relative">
          Write release notes
        </Button>
      </div>
    </div>
  )
}

function GridExample() {
  const [variant, setVariant] = useState<AnimatedGridVariant>('lines')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Pattern"
        size="sm"
        value={variant}
        onValueChange={setVariant}
        className="self-start"
        options={[
          { value: 'lines', label: 'Lines' },
          { value: 'dots', label: 'Dots' },
        ]}
      />
      <div className="relative flex min-h-[280px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-app p-8 text-center">
        <AnimatedGrid variant={variant} lit={variant === 'dots' ? 16 : 10} />
        <Text as="h3" size="display" className="relative max-w-[18ch]">
          Every metric, one grid away
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="relative max-w-[42ch]">
          A few cells light up and fade on each beat. The edges fade out through a mask, so the pattern never frames the
          heading.
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- pages */

const CHART_BASE = [
  { name: 'label', type: 'string', description: 'Accessible name. Say what the chart shows, not what it is called.' },
  { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
]

const LAYER_BASE = [
  { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the effect where it is.' },
  {
    name: 'className',
    type: 'string',
    description: 'Merged last. The layer fills its nearest positioned ancestor, so give the container position.',
  },
]

export const demos: ExampleModule = {
  'transcript-view': {
    description:
      'A timed transcript that follows playback: the line being spoken is highlighted and kept in view, clicking a line seeks to it, and search highlights matches in place. Following pauses as soon as the reader scrolls or arrows through lines, with a button to jump back, because a transcript that drags you to the playhead while you read ahead is one people stop using.',
    sections: [
      {
        title: 'Interview playback',
        description:
          'Press play, then scroll the transcript: following pauses until you choose “Back to current line”. Search for “refund” and step through the matches with Enter.',
        bare: true,
        Content: TranscriptExample,
        note: (
          <>
            Lines are one tab stop; Up and Down move between them, Home and End jump to the ends, Enter seeks. In the
            search field, Enter and Shift+Enter step through matches.{' '}
            {motionNote('the list jumps to the current line instead of scrolling smoothly.')}
          </>
        ),
      },
      rationale(
        'Recordings of calls, interviews and meetings are skimmed through their transcript, but a static wall of text loses the link back to the moment it was said.',
        'Tying lines to time makes the transcript the navigation for the recording, and pausing the follow keeps it readable while the audio plays on.',
        'Call recordings, research repositories, podcast and video pages, meeting notes, support QA.',
        ['SearchField', 'IconButton', 'Button'],
      ),
    ],
    props: [
      { name: 'lines', type: 'TranscriptViewLine[]', description: 'id, start (seconds), optional end, speaker and text.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list of lines.' },
      { name: 'currentTime', type: 'number', description: 'Playback position in seconds; drives the highlight and follow.' },
      { name: 'onSeek', type: '(time: number, line) => void', description: 'Called when a line is clicked or activated.' },
      { name: 'searchable', type: 'boolean', defaultValue: 'true', description: 'Show the search field and match stepper.' },
      { name: 'autoScroll', type: 'boolean', defaultValue: 'true', description: 'Keep the current line in view.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Maximum height of the scrolling list.' },
      { name: 'formatTime', type: '(seconds: number) => string', defaultValue: 'm:ss', description: 'Timestamp format.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'sunburst-chart': {
    description:
      'A hierarchy as concentric rings: the whole in the centre, each level one ring out, every arc as wide as its share of its parent. Only three rings are drawn at a time; clicking a branch zooms into it with a breadcrumb back up, so deep trees stay hoverable instead of turning into slivers.',
    sections: [
      {
        title: 'Cloud spend by service',
        description: 'Hover an arc for its value and share. Click Compute or Data to zoom in, then use the breadcrumb or the centre to zoom out.',
        bare: true,
        Content: SunburstExample,
        note: (
          <>
            One tab stop. Left and Right move round a ring, Down steps out to the first child, Up back to the parent,
            Enter zooms into a branch, Backspace zooms out, Escape clears. The whole tree is also a hidden nested list.{' '}
            {motionNote('rings appear at once instead of growing in.')}
          </>
        ),
      },
      rationale(
        'Nested breakdowns — spend by team by service, storage by folder — end up as indented tables where proportions have to be computed in your head.',
        'Arc length shows share at every level at once, and zooming keeps deep trees usable without drawing unreadable outer rings.',
        'Cloud and budget breakdowns, disk usage, taxonomy coverage, funnel paths, org headcount.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'data', type: 'SunburstChartNode', description: 'Root node: id, label, value (leaves), children, colour.' },
      ...CHART_BASE,
      { name: 'depth', type: 'number', defaultValue: '3', description: 'Rings drawn outward from the node in focus.' },
      { name: 'size', type: 'number', defaultValue: '320', description: 'Largest rendered size; shrinks with its container.' },
      { name: 'valueLabel', type: 'string', defaultValue: "'Value'", description: 'Names the measure in the tooltip.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for centre, tooltip and hidden list.' },
      { name: 'onZoom', type: '(id: string) => void', description: 'Called with the id now in the centre.' },
    ],
  },
  'network-graph': {
    description:
      'Nodes and links laid out by a small built-in force simulation that runs a fixed number of steps and then stops, so the graph settles into a readable picture instead of drifting forever. Drag a node to pin it, hover or arrow to one to light its neighbours, and read every connection in the hidden list.',
    sections: [
      {
        title: 'Service dependency map',
        description: 'Watch it untangle, then drag a service somewhere else. Hovering fades everything that is not connected.',
        bare: true,
        Content: NetworkExample,
        note: (
          <>
            One tab stop. Arrow keys step through nodes with their connections announced, Enter selects, Escape
            clears. Every node and what it connects to is also a hidden list.{' '}
            {motionNote('the simulation runs to completion in one go, and the settled layout appears without animating.')}
          </>
        ),
      },
      rationale(
        'Relationships — which service calls which, who works with whom — are hard to see in a table of pairs, and graph libraries add hundreds of kilobytes for a diagram.',
        'A few dozen lines of forces give a stable, deterministic layout for small graphs, and highlighting neighbours answers the usual question: what touches this?',
        'Service maps, integration diagrams, data lineage, collaboration networks, knowledge graphs.',
        ['Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'nodes', type: 'NetworkGraphNode[]', description: 'id, label and an optional group for colour.' },
      { name: 'links', type: 'NetworkGraphLink[]', description: 'Undirected source / target id pairs.' },
      ...CHART_BASE,
      { name: 'height', type: 'number', defaultValue: '380', description: 'Height in viewBox pixels.' },
      { name: 'ticks', type: 'number', defaultValue: '300', description: 'Simulation steps before the layout settles.' },
      { name: 'linkDistance', type: 'number', defaultValue: '60', description: 'Resting length of a link.' },
      { name: 'showLabels', type: 'boolean', defaultValue: 'true', description: 'Print labels under nodes.' },
      { name: 'onNodeSelect', type: '(id: string) => void', description: 'Click or Enter on a node.' },
    ],
  },
  'org-chart': {
    description:
      'A reporting structure as top-down cards joined by elbow connectors, inside a pan and zoom viewport. Each subtree is laid out as wide as it needs and centred over its reports, teams expand and collapse, and the cards are a real tree for keyboard and screen reader users.',
    sections: [
      {
        title: 'Company organisation',
        description: 'Click a manager to open or close their team. Tab into the tree and use the arrow keys; the view pans to follow.',
        bare: true,
        Content: OrgExample,
        note: (
          <>
            The chart is one tab stop. Up and Down move through visible people, Right opens a team or steps into it,
            Left closes it or steps out to the manager, Enter or Space selects and toggles.{' '}
            {motionNote('the count chevron flips without rotating. Cards never slide, so connectors and cards always agree.')}
          </>
        ),
      },
      rationale(
        'Directories list people alphabetically, which answers “who is Hana” but not “who does Hana work with” or “how big is Platform”.',
        'Cards laid out by reporting line show team shape at a glance, and collapsing keeps a large company legible.',
        'Company directories, HR tools, account maps for enterprise sales, approval hierarchies.',
        ['PanZoom', 'Avatar', 'IconButton'],
      ),
    ],
    props: [
      { name: 'data', type: 'OrgChartPerson', description: 'Root person: id, name, title, avatar and children.' },
      { name: 'label', type: 'string', description: 'Accessible name for the tree.' },
      { name: 'defaultExpanded', type: 'string[]', description: 'Ids open on first render.' },
      { name: 'defaultDepth', type: 'number', defaultValue: '2', description: 'Levels open when defaultExpanded is omitted.' },
      { name: 'selected / onSelect', type: 'string / (id: string) => void', description: 'Selected person, controlled or not.' },
      { name: 'height', type: 'number', defaultValue: '440', description: 'Viewport height in pixels.' },
      { name: 'wheelZoom', type: 'boolean', defaultValue: 'false', description: 'Zoom with the mouse wheel.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'beeswarm-chart': {
    description:
      'Every observation as a dot on one axis, packed sideways just enough that none overlap, with one row per group. The swarm is widest where values are densest, so the distribution shows without binning, and every outlier stays a dot you can hover, name and highlight.',
    sections: [
      {
        title: 'Deal size by plan',
        description: 'Hover a dot for the account. Click one to highlight it; click it again to clear.',
        bare: true,
        Content: BeeswarmExample,
        note: (
          <>
            One tab stop. Arrow keys step through points row by row in value order, Enter highlights, Escape clears the
            cursor. The line in each row is its median.{' '}
            {motionNote('dots appear in place instead of popping in.')}
          </>
        ),
      },
      rationale(
        'Averages and box plots hide how many observations there are and where individual ones sit, which is exactly what “where does this account fall” needs.',
        'One dot per observation keeps counts and outliers visible, and packing instead of jitter makes the shape honest and repeatable.',
        'Deal sizes, response times, salaries by level, test scores, latency per endpoint.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'points', type: 'BeeswarmChartPoint[]', description: 'id, value, and optional group and label.' },
      ...CHART_BASE,
      { name: 'groups', type: 'string[]', description: 'Row order. Defaults to first appearance.' },
      { name: 'valueLabel', type: 'string', description: 'Axis title and tooltip label.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for ticks and tooltip.' },
      { name: 'radius / rowHeight', type: 'number / number', defaultValue: '4 / 64', description: 'Dot size and row height.' },
      { name: 'showMedian', type: 'boolean', defaultValue: 'true', description: 'Median line in each row.' },
      { name: 'selected / onSelect', type: 'string | null / (id) => void', description: 'Highlighted point, controlled or not.' },
    ],
  },
  'cohort-retention': {
    description:
      'The SaaS retention triangle as a real table: one row per signup cohort, one column per month since signup, each cell shaded by the share still active. A size-weighted average row counts only cohorts old enough for each month, and the grid switches between percent and head count in place.',
    sections: [
      {
        title: 'Monthly retention',
        description: 'Switch to Users to see head counts. Tab into the grid and move with the arrow keys.',
        bare: true,
        Content: CohortExample,
        note: (
          <>
            One tab stop. Arrow keys move between cells, Home and End along a row, Ctrl+Home and Ctrl+End to the
            corners. Row and column headers are announced with every cell.{' '}
            {motionNote('cells appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'A single retention number mixes old and new customers, so it cannot tell you whether the product is getting better at keeping people.',
        'Cohorts separate when someone joined from how long they stayed; shading down a column shows at a glance whether newer cohorts hold on better.',
        'Subscription analytics, onboarding experiments, pricing change reviews, investor updates.',
        ['SegmentedControl'],
      ),
    ],
    props: [
      { name: 'cohorts', type: 'CohortRetentionCohort[]', description: 'label, size, and retained counts per period.' },
      { name: 'label', type: 'string', description: 'Accessible name for the grid.' },
      { name: 'periodLabel', type: '(period: number) => string', defaultValue: 'Month n', description: 'Column headings.' },
      { name: 'mode / defaultMode / onModeChange', type: "'percent' | 'count'", defaultValue: "— / 'percent'", description: 'Controlled or uncontrolled.' },
      { name: 'showModeToggle', type: 'boolean', defaultValue: 'true', description: 'The percent / users switch.' },
      { name: 'showAverage', type: 'boolean', defaultValue: 'true', description: 'Weighted average row.' },
      { name: 'formatCount', type: '(value: number) => string', description: 'Formatter for sizes and counts.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'stream-graph': {
    description:
      'Series stacked around a moving centre line with smooth edges, for how a mix changes over time. The default wiggle baseline cancels the average slope of the layers, so a change in one stream is not misread as a change in every stream above it. Hover a stream to isolate it; the legend toggles streams on and off.',
    sections: [
      {
        title: 'Feature usage over sixteen weeks',
        description: 'Hover to see every stream’s value that week. Toggle Reports off in the legend and watch the others re-centre.',
        bare: true,
        Content: StreamExample,
        note: (
          <>
            One tab stop. Left and Right move along time, Up and Down between streams, Home and End to either end,
            Escape clears. Legend entries are toggle buttons.{' '}
            {motionNote('streams appear at full height instead of growing from the centre line.')}
          </>
        ),
      },
      rationale(
        'Stacked area charts make every layer above a growing one look like it grew too, and line charts of many series tangle.',
        'A centred, wiggle-minimised stack keeps each stream’s own thickness readable over time while still showing the whole.',
        'Feature adoption, traffic by source, listening by genre, topic volume, headcount by team over time.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'series', type: 'StreamGraphSeries[]', description: 'id, label, values per category and optional colour.' },
      { name: 'categories', type: 'string[]', description: 'Labels along the x axis.' },
      ...CHART_BASE,
      { name: 'offset', type: "'wiggle' | 'silhouette'", defaultValue: "'wiggle'", description: 'Baseline algorithm.' },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Plot height in viewBox pixels.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for the tooltip and table.' },
      { name: 'defaultHidden / onHiddenChange', type: 'string[] / (ids) => void', description: 'Streams hidden by the legend.' },
    ],
  },
  'signal-strength': {
    description:
      'Connection quality as four rising bars with an optional quality word, announced as one image: “Connection: good, 3 of 4 bars”. Colour follows quality by default, but the word or the accessible text always says it too, so colour is never the only signal.',
    sections: [
      {
        title: 'In a call header',
        description: 'The connection changes every two seconds.',
        bare: true,
        Content: SignalExample,
      },
      {
        title: 'Levels',
        specimens: [0, 1, 2, 3, 4].map((value) => ({
          label: `value={${value}}`,
          node: <SignalStrength value={value} showLabel />,
        })),
      },
      {
        title: 'Sizes and neutral tone',
        specimens: [
          { label: "size='sm'", node: <SignalStrength value={3} size="sm" /> },
          { label: "size='md'", node: <SignalStrength value={3} /> },
          { label: "size='lg'", node: <SignalStrength value={3} size="lg" /> },
          { label: "tone='neutral'", node: <SignalStrength value={2} tone="neutral" label="Wi-Fi" showLabel /> },
        ],
      },
      rationale(
        'Call and device UIs need to say “your connection is the problem” in a glance, without a paragraph or a number people cannot interpret.',
        'Four rising bars are already learned from every phone, and pairing them with a word makes the reading unambiguous.',
        'Video calls, device dashboards, IoT fleets, sync status, offline-capable apps.',
        ['colour tokens'],
      ),
    ],
    props: [
      { name: 'value', type: 'number', description: 'Lit bars, 0–4. Rounded and clamped.' },
      { name: 'label', type: 'string', defaultValue: "'Signal'", description: 'First word of the accessible text.' },
      { name: 'showLabel', type: 'boolean', defaultValue: 'false', description: 'Print the quality word beside the bars.' },
      { name: 'qualityLabels', type: '[string × 5]', defaultValue: 'no signal … excellent', description: 'Words for 0 to 4 bars.' },
      { name: 'tone', type: "'auto' | 'neutral'", defaultValue: "'auto'", description: 'Colour by quality, or ink.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: 'Bar height 12, 16 or 20px.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  meteors: {
    description:
      'Thin streaks falling diagonally behind content, as a layer that fills its positioned parent. Each meteor is a transform and opacity animation with its own speed and delay, positions are seeded so server and client agree, and the shower pauses while it is scrolled off screen.',
    sections: [
      {
        title: 'Behind a call to action',
        description: 'Switch tone, or pause the shower. The streaks never take the pointer.',
        bare: true,
        Content: MeteorsExample,
        note: motionNote('nothing moves; the meteors are drawn as faint fixed streaks so the texture remains.'),
      },
      rationale(
        'Launch and empty-state panels can feel flat, but most decorative motion is heavy, grabs the pointer or ignores the reduced-motion preference.',
        'A handful of compositor-only animations gives movement for almost no cost, and it stops itself off screen.',
        'Launch banners, hero sections, empty states, upgrade prompts, dark marketing panels.',
        ['Web Animations API', 'IntersectionObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'count', type: 'number', defaultValue: '14', description: 'Number of streaks.' },
      { name: 'speed', type: 'number', defaultValue: '1', description: 'Speed multiplier.' },
      { name: 'angle', type: 'number', defaultValue: '145', description: 'Direction of travel in degrees.' },
      { name: 'length', type: 'number', defaultValue: '90', description: 'Tail length in pixels.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: "'ink'", description: 'Streak colour from the theme.' },
      ...LAYER_BASE,
    ],
  },
  'animated-grid': {
    description:
      'A quiet grid or dot pattern behind content, with a few cells softly lighting up in the accent and fading out again. The grid is one SVG pattern and only a small pool of lit cells are elements, faded by CSS transitions; a radial mask fades the edges on any surface.',
    sections: [
      {
        title: 'Hero background',
        description: 'Switch between lines and dots.',
        bare: true,
        Content: GridExample,
        note: motionNote('the same cells stay lit and nothing changes.'),
      },
      rationale(
        'Hero sections want texture that says “product” without competing with the headline, and animated backgrounds are often a canvas loop running while off screen.',
        'A pattern plus a handful of fading cells is almost free to render, and the timer stops when the layer is out of view or the tab is hidden.',
        'Landing heroes, feature sections, sign-in backgrounds, empty dashboards.',
        ['SVG pattern', 'CSS transitions', 'IntersectionObserver'],
      ),
    ],
    props: [
      { name: 'variant', type: "'lines' | 'dots'", defaultValue: "'lines'", description: 'Grid lines or intersection dots.' },
      { name: 'cellSize', type: 'number', defaultValue: '36', description: 'Cell size in pixels.' },
      { name: 'lit', type: 'number', defaultValue: '10', description: 'Cells lit at any moment.' },
      { name: 'interval', type: 'number', defaultValue: '1400', description: 'Milliseconds between changes.' },
      { name: 'fade', type: 'boolean', defaultValue: 'true', description: 'Radial fade towards the edges.' },
      ...LAYER_BASE,
    ],
  },
}
