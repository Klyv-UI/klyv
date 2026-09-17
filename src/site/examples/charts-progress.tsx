import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  DumbbellChart,
  GameOfLife,
  GanttChart,
  MatrixHeatmap,
  ParetoChart,
  RadialBarChart,
  SegmentedControl,
  ShimmerText,
  SlopeChart,
  StepLoader,
  Text,
  UploadQueue,
  type DumbbellChartSort,
  type GanttChartTask,
  type GanttChartZoom,
  type StepLoaderStep,
  type UploadQueueFile,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ data */

const TODAY = new Date(2026, 8, 17)
const day = (month: number, date: number) => new Date(2026, month - 1, date)

const LAUNCH: GanttChartTask[] = [
  { id: 'research', lane: 'Design', label: 'User research', start: day(8, 24), end: day(9, 4), progress: 1 },
  {
    id: 'flows',
    lane: 'Design',
    label: 'Flows and wireframes',
    start: day(9, 7),
    end: day(9, 16),
    progress: 1,
    dependsOn: ['research'],
  },
  {
    id: 'visual',
    lane: 'Design',
    label: 'Visual design',
    start: day(9, 14),
    end: day(9, 25),
    progress: 0.55,
    dependsOn: ['flows'],
  },
  {
    id: 'signoff',
    lane: 'Design',
    label: 'Design sign-off',
    start: day(9, 28),
    end: day(9, 28),
    milestone: true,
    dependsOn: ['visual'],
  },
  {
    id: 'api',
    lane: 'Engineering',
    label: 'Billing API',
    start: day(9, 8),
    end: day(9, 30),
    progress: 0.4,
    dependsOn: ['flows'],
  },
  {
    id: 'ui',
    lane: 'Engineering',
    label: 'Checkout UI',
    start: day(9, 29),
    end: day(10, 16),
    progress: 0,
    dependsOn: ['signoff'],
  },
  {
    id: 'qa',
    lane: 'Engineering',
    label: 'QA and fixes',
    start: day(10, 12),
    end: day(10, 23),
    progress: 0,
    dependsOn: ['api', 'ui'],
  },
  { id: 'docs', lane: 'Launch', label: 'Help centre articles', start: day(10, 5), end: day(10, 21), progress: 0 },
  {
    id: 'beta',
    lane: 'Launch',
    label: 'Private beta',
    start: day(10, 26),
    end: day(11, 6),
    progress: 0,
    dependsOn: ['qa'],
  },
  {
    id: 'ga',
    lane: 'Launch',
    label: 'General availability',
    start: day(11, 10),
    end: day(11, 10),
    milestone: true,
    dependsOn: ['beta', 'docs'],
  },
]

const COHORTS = ['Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026']
const RETENTION: (number | null)[][] = [
  [100, 62, 51, 46, 43, 41],
  [100, 65, 54, 49, 45, null],
  [100, 59, 48, 44, null, null],
  [100, 68, 57, null, null, null],
  [100, 71, null, null, null, null],
  [100, null, null, null, null, null],
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 12 }, (_, index) => `${String(index * 2).padStart(2, '0')}:00`)
const ACTIVITY = WEEKDAYS.map((_, weekday) =>
  HOURS.map((__, slot) => {
    const hour = slot * 2
    const work = hour >= 8 && hour <= 18 ? 1 : hour >= 20 ? 0.35 : 0.08
    const weekend = weekday >= 5 ? 0.3 : 1
    return Math.round(1400 * work * weekend + ((weekday * 7 + slot * 13) % 9) * 22)
  }),
)

const TICKETS = [
  { label: 'Login issues', value: 412 },
  { label: 'Billing question', value: 318 },
  { label: 'Export failed', value: 206 },
  { label: 'Slow dashboard', value: 141 },
  { label: 'SSO setup', value: 88 },
  { label: 'Feature request', value: 64 },
  { label: 'Webhook errors', value: 41 },
  { label: 'Data deletion', value: 23 },
  { label: 'Other', value: 19 },
]

const CHANNELS = [
  { id: 'organic', label: 'Organic search', start: 3.1, end: 3.8 },
  { id: 'paid', label: 'Paid search', start: 4.6, end: 3.9 },
  { id: 'referral', label: 'Referral', start: 6.2, end: 7.4 },
  { id: 'email', label: 'Email', start: 5.0, end: 5.1 },
  { id: 'social', label: 'Social', start: 1.4, end: 1.2 },
  { id: 'direct', label: 'Direct', start: 4.9, end: 5.6 },
]

const LATENCY = [
  { id: 'iad', label: 'us-east-1', start: 182, end: 141 },
  { id: 'fra', label: 'eu-central-1', start: 214, end: 168 },
  { id: 'sin', label: 'ap-southeast-1', start: 296, end: 312 },
  { id: 'gru', label: 'sa-east-1', start: 341, end: 262 },
]

const NPS = [
  { id: 'smb', label: 'Small business', from: 31, to: 44 },
  { id: 'mid', label: 'Mid-market', from: 38, to: 41 },
  { id: 'ent', label: 'Enterprise', from: 22, to: 47 },
  { id: 'edu', label: 'Education', from: 49, to: 45 },
  { id: 'gov', label: 'Public sector', from: 12, to: 29 },
  { id: 'np', label: 'Non-profit', from: 40, to: 52 },
]

/* ------------------------------------------------------------- examples */

function GanttExample() {
  const [zoom, setZoom] = useState<GanttChartZoom>('week')
  return (
    <Card title="Checkout redesign" className="w-full">
      <div className="mt-3">
        <GanttChart
          tasks={LAUNCH}
          zoom={zoom}
          onZoomChange={setZoom}
          today={TODAY}
          label="Checkout redesign plan from late August to general availability on 10 November"
        />
      </div>
    </Card>
  )
}

function RetentionExample() {
  const [values, setValues] = useState<'on' | 'off'>('on')
  return (
    <Card title="Monthly retention by signup cohort" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Printed values"
          size="sm"
          value={values}
          onValueChange={setValues}
          className="self-start"
          options={[
            { value: 'on', label: 'With values' },
            { value: 'off', label: 'Colour only' },
          ]}
        />
        <MatrixHeatmap
          rows={COHORTS}
          columns={['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5']}
          values={RETENTION}
          min={0}
          max={100}
          showValues={values === 'on'}
          valueLabel="Retained"
          format={(value) => `${Math.round(value)}%`}
          label="Share of each monthly signup cohort still active in the months after signing up"
        />
      </div>
    </Card>
  )
}

function RadialExample() {
  const [mode, setMode] = useState<'shared' | 'own'>('own')
  const teams = [
    { id: 'emea', label: 'EMEA', value: 1_120_000, max: 1_400_000 },
    { id: 'na', label: 'North America', value: 1_860_000, max: 2_000_000 },
    { id: 'apac', label: 'APAC', value: 540_000, max: 900_000 },
    { id: 'latam', label: 'LATAM', value: 310_000, max: 400_000 },
  ]
  const money = (value: number) => `$${(value / 1_000_000).toFixed(2)}M`
  return (
    <Card title="Q3 bookings against quota" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Ring scale"
          size="sm"
          value={mode}
          onValueChange={setMode}
          className="self-start"
          options={[
            { value: 'own', label: 'Each against its quota' },
            { value: 'shared', label: 'Compared with each other' },
          ]}
        />
        <RadialBarChart
          items={mode === 'own' ? teams : teams.map(({ max: _max, ...team }) => team)}
          format={money}
          totalLabel="Booked in Q3"
          label={
            mode === 'own'
              ? 'Q3 bookings by region as a share of each region’s quota'
              : 'Q3 bookings by region, compared with the largest region'
          }
        />
      </div>
    </Card>
  )
}

function SlopeExample() {
  const [tone, setTone] = useState<'direction' | 'series'>('direction')
  return (
    <Card title="Trial-to-paid conversion by channel" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Line colour"
          size="sm"
          value={tone}
          onValueChange={setTone}
          className="self-start"
          options={[
            { value: 'direction', label: 'By direction' },
            { value: 'series', label: 'By channel' },
          ]}
        />
        <SlopeChart
          items={CHANNELS}
          startLabel="Q3 2025"
          endLabel="Q3 2026"
          tone={tone}
          format={(value) => `${value.toFixed(1)}%`}
          label="Trial-to-paid conversion by acquisition channel, Q3 2025 against Q3 2026"
        />
      </div>
    </Card>
  )
}

function ParetoExample() {
  const [cutoff, setCutoff] = useState<'0.8' | '0.7'>('0.8')
  return (
    <Card title="Support tickets by reason, September" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Cutoff"
          size="sm"
          value={cutoff}
          onValueChange={setCutoff}
          className="self-start"
          options={[
            { value: '0.8', label: '80%' },
            { value: '0.7', label: '70%' },
          ]}
        />
        <ParetoChart
          items={TICKETS}
          cutoff={Number(cutoff)}
          valueLabel="Tickets"
          label="1,312 support tickets in September by reason, with the running share of the total"
        />
      </div>
    </Card>
  )
}

function DumbbellExample() {
  const [sort, setSort] = useState<DumbbellChartSort>('gap')
  return (
    <Card title="NPS by segment, before and after the onboarding revamp" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Sort rows"
          size="sm"
          value={sort}
          onValueChange={setSort}
          className="self-start"
          options={[
            { value: 'gap', label: 'Biggest change' },
            { value: 'to', label: 'Latest score' },
            { value: 'none', label: 'Original order' },
          ]}
        />
        <DumbbellChart
          rows={NPS}
          fromLabel="March"
          toLabel="September"
          sort={sort}
          label="Net promoter score by customer segment in March and September"
        />
      </div>
    </Card>
  )
}

const DEPLOY: { id: string; label: string; description: string; seconds: number }[] = [
  { id: 'checkout', label: 'Checking out commit', description: 'a41c9e2 · main', seconds: 1 },
  { id: 'install', label: 'Installing dependencies', description: '1,284 packages', seconds: 2.5 },
  { id: 'build', label: 'Building the app', description: 'Vite, 412 modules', seconds: 3 },
  { id: 'migrate', label: 'Running database migrations', description: '2 pending', seconds: 2 },
  { id: 'promote', label: 'Promoting to production', description: 'eu-west-1, us-east-1', seconds: 1.5 },
]

function StepLoaderExample() {
  const [fail, setFail] = useState(true)
  const [position, setPosition] = useState(0)
  const [failed, setFailed] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const failedOnce = useRef(false)

  useEffect(() => {
    if (failed || position >= DEPLOY.length) return
    const timer = window.setTimeout(() => {
      if (fail && !failedOnce.current && DEPLOY[position].id === 'migrate') {
        failedOnce.current = true
        setFailed(true)
        return
      }
      setPosition((value) => value + 1)
    }, DEPLOY[position].seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [position, failed, fail])

  const steps: StepLoaderStep[] = DEPLOY.map((step, index) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    status: index < position ? 'done' : index > position ? 'pending' : failed ? 'error' : 'active',
    error: 'Lock timeout on table “invoices” after 30s. Another migration may still be running.',
  }))

  const restart = () => {
    failedOnce.current = false
    setFailed(false)
    setPosition(0)
    setStartedAt(Date.now())
  }

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <StepLoader
        title="Deploying to production"
        steps={steps}
        startedAt={startedAt}
        onRetry={() => setFailed(false)}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={restart}>
          Restart deploy
        </Button>
        <SegmentedControl
          label="Migration outcome"
          size="sm"
          value={fail ? 'fail' : 'pass'}
          onValueChange={(value) => setFail(value === 'fail')}
          options={[
            { value: 'fail', label: 'Fails once' },
            { value: 'pass', label: 'Succeeds' },
          ]}
        />
      </div>
    </div>
  )
}

const INITIAL_UPLOADS: UploadQueueFile[] = [
  { id: 'a', name: 'Q3 board deck.pdf', size: 18_400_000, progress: 0.12, status: 'uploading' },
  { id: 'b', name: 'product-demo-final.mp4', size: 212_000_000, progress: 0.04, status: 'uploading' },
  {
    id: 'c',
    name: 'customer-interviews.zip',
    size: 64_000_000,
    progress: 0.31,
    status: 'error',
    error: 'Connection lost at 31%',
  },
  { id: 'd', name: 'logo@2x.png', size: 184_000, progress: 1, status: 'done' },
  { id: 'e', name: 'pricing-sheet.xlsx', size: 920_000, progress: 0, status: 'queued' },
]

function UploadQueueExample() {
  const [files, setFiles] = useState(INITIAL_UPLOADS)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFiles((current) => {
        let slots = 2 - current.filter((file) => file.status === 'uploading').length
        return current.map((file): UploadQueueFile => {
          if (file.status === 'queued' && slots > 0) {
            slots -= 1
            return { ...file, status: 'uploading' }
          }
          if (file.status !== 'uploading') return file
          const progress = Math.min(1, file.progress + 9_000_000 / file.size / 2.5)
          return { ...file, progress, status: progress >= 1 ? 'done' : 'uploading' }
        })
      })
    }, 400)
    return () => window.clearInterval(timer)
  }, [])

  const update = (id: string, change: Partial<UploadQueueFile>) =>
    setFiles((current) => current.map((file) => (file.id === id ? { ...file, ...change } : file)))

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <UploadQueue
        files={files}
        label="Project uploads"
        onPause={(id) => update(id, { status: 'paused' })}
        onResume={(id) => update(id, { status: 'uploading' })}
        onRetry={(id) => update(id, { status: 'queued', error: undefined })}
        onCancel={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
        onClearCompleted={() => setFiles((current) => current.filter((file) => file.status !== 'done'))}
      />
      <Button size="sm" variant="outline" className="self-start" onClick={() => setFiles(INITIAL_UPLOADS)}>
        Reset uploads
      </Button>
    </div>
  )
}

function ShimmerExample() {
  const [thinking, setThinking] = useState(true)
  useEffect(() => {
    if (!thinking) return
    const timer = window.setTimeout(() => setThinking(false), 4000)
    return () => window.clearTimeout(timer)
  }, [thinking])
  return (
    <Card className="w-full max-w-[520px]">
      <div className="flex flex-col gap-3">
        <Text size="label" weight="semibold">
          Summarise last week’s churned accounts
        </Text>
        <div aria-live="polite">
          {thinking ? (
            <ShimmerText className="text-[13px] font-semibold">Reading 42 cancellation notes…</ShimmerText>
          ) : (
            <Text size="body" weight="medium" tone="soft" leading="normal">
              Most churn came from annual plans on the Starter tier citing missing SSO. Three accounts moved to a
              competitor after the price change.
            </Text>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setThinking(true)}
          disabled={thinking}
        >
          Ask again
        </Button>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- pages */

const CHART_BASE = [
  { name: 'label', type: 'string', description: 'Accessible name. Say what the chart shows, not what it is called.' },
  { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
]

const KEYBOARD =
  'The chart is one tab stop. Arrow keys step through the marks and show the tooltip, Home and End jump to either end, Escape clears. Every value is also in a visually hidden table.'

export const demos: ExampleModule = {
  'gantt-chart': {
    description:
      'A plan as bars on a calendar: tasks grouped by lane, progress filled inside each bar, arrows from what has to finish first, diamonds for milestones and a line for today. The timeline is drawn in real pixels and scrolls, rather than squeezing months into the card, so switching between day, week and month zoom changes the scale without ever making the plan unreadable.',
    sections: [
      {
        title: 'Launch plan',
        description: 'Switch zoom, scroll the timeline, and hover a bar or tab to the chart and use the arrow keys.',
        bare: true,
        Content: GanttExample,
        note: (
          <>
            {KEYBOARD} The timeline scrolls to keep the focused task in view.{' '}
            {motionNote('bars appear at full length immediately instead of growing from their start date.')}
          </>
        ),
      },
      rationale(
        'Project plans end up as spreadsheets of dates, where “what is late” and “what is blocked by it” have to be worked out by reading every row.',
        'Bars against a calendar show overlap and slack at a glance, and dependency arrows show the knock-on effect of a slip before anyone asks.',
        'Roadmaps, launch plans, migration schedules, agency and client timelines.',
        ['SegmentedControl', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      {
        name: 'tasks',
        type: 'GanttChartTask[]',
        description: 'id, label, lane, start, end, progress (0–1), dependsOn (ids) and milestone.',
      },
      ...CHART_BASE,
      {
        name: 'zoom / defaultZoom / onZoomChange',
        type: "'day' | 'week' | 'month'",
        defaultValue: "— / 'week'",
        description: 'Pixels per day. Controlled or uncontrolled.',
      },
      {
        name: 'showZoomControl',
        type: 'boolean',
        defaultValue: 'true',
        description: 'The day / week / month switch above the chart.',
      },
      {
        name: 'today',
        type: 'Date',
        defaultValue: 'new Date()',
        description: 'Where the today line sits. Pass it when rendering on a server.',
      },
      {
        name: 'showTaskList',
        type: 'boolean',
        defaultValue: 'true',
        description: 'The column of task names; without it, names print beside the bars.',
      },
      { name: 'rowHeight', type: 'number', defaultValue: '34', description: 'Row height in pixels.' },
    ],
  },
  'matrix-heatmap': {
    description:
      'A rows-by-columns grid coloured on one stepped accent scale, with a legend, a tooltip per cell and optional printed values. Steps are mixed from the accent into the surface, so the ramp follows the theme; printed values switch to accent ink on the strong end so they stay readable at every step.',
    sections: [
      {
        title: 'Cohort retention',
        description:
          'Hover a cell, or tab to the grid and move with the arrow keys. Empty cells are months that have not happened yet.',
        bare: true,
        Content: RetentionExample,
        note: (
          <>
            One tab stop. Arrow keys move in two dimensions, Home and End jump along the row, Ctrl+Home and Ctrl+End to
            the corners, Escape clears. The full grid is also a hidden table.{' '}
            {motionNote('cells appear at once instead of fading in.')}
          </>
        ),
      },
      {
        title: 'Six steps, angled column labels',
        description: 'When column names do not fit their cells the labels angle rather than overlap.',
        specimens: [
          {
            label: 'steps={6}',
            fill: true,
            node: (
              <MatrixHeatmap
                rows={WEEKDAYS}
                columns={HOURS}
                values={ACTIVITY}
                steps={6}
                cellHeight={24}
                valueLabel="Sessions"
                label="Sessions by weekday and two-hour slot, busiest on weekday working hours"
              />
            ),
          },
        ],
      },
      rationale(
        'Tables of percentages hide their pattern: a cohort that retains worse, or an hour that is always busy, only shows up after reading every cell.',
        'Colour carries the pattern and the legend states what each step means; the numbers stay one hover, one arrow key or one toggle away.',
        'Cohort retention, activity by hour and weekday, correlation matrices, feature usage by plan.',
        ['ChartTooltip', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'rows / columns', type: 'string[]', description: 'Labels down the side and across the top.' },
      { name: 'values', type: '(number | null)[][]', description: 'One array per row; null is a cell with no data.' },
      ...CHART_BASE,
      { name: 'steps', type: 'number', defaultValue: '5', description: 'Colour steps between min and max.' },
      {
        name: 'min / max',
        type: 'number',
        defaultValue: 'data range',
        description: 'Fix the ends of the scale, e.g. 0 and 100 for percentages.',
      },
      {
        name: 'showValues',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Print values inside cells, with ink chosen per step.',
      },
      {
        name: 'valueLabel',
        type: 'string',
        defaultValue: "'Value'",
        description: 'Names the measure in the legend and tooltip.',
      },
      { name: 'cellHeight', type: 'number', defaultValue: '30', description: 'Row height in viewBox pixels.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for cells, legend and tooltip.' },
    ],
  },
  'radial-bar-chart': {
    description:
      'Concentric rings, one per category, each filling toward its own maximum or a shared one, with labels at the start of each ring, the total in the centre and a legend. Every ring starts at twelve o’clock so the eye compares how far round each one reaches.',
    sections: [
      {
        title: 'Bookings against quota',
        description:
          'Switch between each ring against its own quota and all rings on one scale. Hover a ring to put its figure in the centre.',
        bare: true,
        Content: RadialExample,
        note: (
          <>
            {KEYBOARD} {motionNote('rings are drawn at their final length immediately.')}
          </>
        ),
      },
      rationale(
        'A handful of progress bars against different targets turn into a column of near-identical strips that says little at dashboard size.',
        'Rings pack several targets into a compact square with the total where the eye lands, and the legend carries the exact figures.',
        'Quota by region, goals by team, storage by type, a small set of OKRs on an overview.',
        ['Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      {
        name: 'items',
        type: 'RadialBarChartItem[]',
        description: 'id, label, value, and optional max and colour per ring.',
      },
      ...CHART_BASE,
      {
        name: 'max',
        type: 'number',
        defaultValue: 'largest value',
        description: 'Value of a full ring, for rings without their own max.',
      },
      { name: 'sweep', type: 'number', defaultValue: '270', description: 'Degrees a full ring covers.' },
      {
        name: 'showTotal / totalLabel',
        type: 'boolean / string',
        defaultValue: "true / 'Total'",
        description: 'Centre figure and caption.',
      },
      {
        name: 'showLabels / showLegend',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Ring labels and the key underneath.',
      },
      {
        name: 'size',
        type: 'number',
        defaultValue: '280',
        description: 'Largest rendered size; shrinks with its container.',
      },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for centre, tooltip and legend.' },
    ],
  },
  'slope-chart': {
    description:
      'Change between two moments for many items: a line per item from its earlier value to its later one, labelled at both ends. Labels that would collide are nudged apart with a short leader back to the true point, and hovering or arrowing to an item fades the rest.',
    sections: [
      {
        title: 'Conversion by channel',
        description: 'Colour by direction or by channel, then hover or arrow through the lines.',
        bare: true,
        Content: SlopeExample,
        note: (
          <>
            {KEYBOARD} {motionNote('lines are drawn in full immediately.')}
          </>
        ),
      },
      {
        title: 'Lower is better',
        description: 'higherIsBetter={false} flips the tone, so a falling latency reads as good news.',
        specimens: [
          {
            label: 'p95 latency, ms',
            fill: true,
            node: (
              <SlopeChart
                items={LATENCY}
                startLabel="August"
                endLabel="September"
                higherIsBetter={false}
                height={240}
                format={(value) => `${Math.round(value)} ms`}
                label="p95 latency by region, August against September"
              />
            ),
          },
        ],
      },
      rationale(
        'Before-and-after comparisons are usually drawn as paired bars, which leave the reader to subtract every pair to find what changed.',
        'The slope is the change, so risers, fallers and crossings are visible before any number is read; direction tone says which way is good.',
        'Year-over-year metrics, rankings before and after a change, A/B results across segments.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'items', type: 'SlopeChartItem[]', description: 'id, label, start, end and an optional colour.' },
      { name: 'startLabel / endLabel', type: 'string', description: 'Column headings for the two moments.' },
      ...CHART_BASE,
      {
        name: 'tone',
        type: "'direction' | 'series'",
        defaultValue: "'direction'",
        description: 'Colour by rise and fall, or walk the series colours.',
      },
      {
        name: 'higherIsBetter',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Flip the direction tone for costs, churn and latency.',
      },
      { name: 'height', type: 'number', defaultValue: '300', description: 'Chart height in pixels.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for labels, tooltip and table.' },
    ],
  },
  'pareto-chart': {
    description:
      'Categories sorted largest first as bars, with the cumulative share as a line on its own 0–100% axis and a dashed reference at the cutoff. Bars after the cutoff is reached are muted rather than dropped, so the vital few stand out and the long tail still reads as a tail.',
    sections: [
      {
        title: 'Tickets by reason',
        description: 'Change the cutoff and watch which bars stay in the vital few. Hover or arrow through the bars.',
        bare: true,
        Content: ParetoExample,
        note: (
          <>
            {KEYBOARD} {motionNote('bars appear at full height and the line appears at once.')}
          </>
        ),
      },
      rationale(
        'A ranked bar chart says what is biggest but not where to stop, so teams spread effort across ten causes when three account for most of the problem.',
        'The running total answers “how many of these do we need to fix”, and muting everything past the cutoff makes the answer visible without reading the axis.',
        'Support ticket reasons, defect causes, churn reasons, cost breakdowns.',
        ['Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'items', type: 'ParetoChartItem[]', description: 'label and value, in any order.' },
      ...CHART_BASE,
      {
        name: 'cutoff',
        type: 'number',
        defaultValue: '0.8',
        description: 'Cumulative share that marks the vital few.',
      },
      {
        name: 'valueLabel',
        type: 'string',
        defaultValue: "'Value'",
        description: 'Names the measure in the legend, tooltip and table.',
      },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Chart height in pixels.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'true', description: 'The key under the chart.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for the left axis and tooltip.' },
    ],
  },
  'dumbbell-chart': {
    description:
      'Two values per category as two dots joined by a bar — before and after, or one group against another. It spends its ink on the gap rather than on the distance from zero both values share, and can sort by the size of the gap so the biggest movers come first.',
    sections: [
      {
        title: 'NPS by segment',
        description: 'Sort by the biggest change or the latest score, then hover or arrow through the rows.',
        bare: true,
        Content: DumbbellExample,
        note: (
          <>
            {KEYBOARD} {motionNote('bars and dots appear in place immediately.')}
          </>
        ),
      },
      rationale(
        'Grouped bars make two close values look almost identical and two distant ones only slightly different, because most of each bar is shared length.',
        'The connecting bar is the gap itself; sorting by it answers “where did we move most” directly.',
        'Survey scores before and after, pay or pricing gaps between groups, plan against actual per team.',
        ['Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'rows', type: 'DumbbellChartRow[]', description: 'id, label, from and to.' },
      {
        name: 'fromLabel / toLabel',
        type: 'string',
        description: 'Names of the two values, used in the legend, tooltip and table.',
      },
      ...CHART_BASE,
      {
        name: 'sort',
        type: "'none' | 'gap' | 'to'",
        defaultValue: "'none'",
        description: 'Keep order, or sort largest first by gap or by the second value.',
      },
      {
        name: 'zeroBased',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Start the axis at zero instead of hugging the data.',
      },
      { name: 'rowHeight', type: 'number', defaultValue: '32', description: 'Row height in viewBox pixels.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'true', description: 'The key under the chart.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for the axis and tooltip.' },
    ],
  },
  'step-loader': {
    description:
      'A background process shown as its steps — pending, active, done or failed — with the current step and elapsed time in the header, a retry on the step that failed, and a list that collapses without losing the one line that matters. The current step is announced as it changes, once per step rather than once per second.',
    sections: [
      {
        title: 'A deploy',
        description:
          'The migration fails the first time; press Retry step to carry on, or make it succeed and restart.',
        bare: true,
        Content: StepLoaderExample,
        note: motionNote(
          'the active step’s spinner is the only continuous motion; the list opens and closes without animating.',
        ),
      },
      rationale(
        'A single spinner for a three-minute job gives no sense of progress, and when it fails the reader cannot tell which part failed or whether retrying is safe.',
        'Named steps turn waiting into progress, and a failure lands on the step that caused it with its reason and a retry beside it.',
        'Deploys, imports, workspace provisioning, AI agent runs, onboarding setup jobs.',
        ['Button', 'Collapse', 'Spinner', 'Text'],
      ),
    ],
    props: [
      {
        name: 'steps',
        type: 'StepLoaderStep[]',
        description: "id, label, status ('pending' | 'active' | 'done' | 'error'), description and error.",
      },
      { name: 'title', type: 'string', description: 'Heading and accessible name for the process.' },
      {
        name: 'startedAt',
        type: 'Date | number',
        description: 'Start of the elapsed timer; it runs while a step is active.',
      },
      { name: 'onRetry', type: '(id: string) => void', description: 'Adds a retry to a failed step.' },
      {
        name: 'open / defaultOpen / onOpenChange',
        type: 'boolean',
        defaultValue: '— / true',
        description: 'Whether the step list is shown. Controlled or uncontrolled.',
      },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'upload-queue': {
    description:
      'Every upload in flight in one panel: per-file progress with pause, resume, cancel and retry, the whole queue’s percentage in the header weighted by bytes, a clear-completed action, and a pill when collapsed. Inline in a page, or pinned to the corner of the viewport with floating.',
    sections: [
      {
        title: 'A live queue',
        description:
          'Uploads progress on their own, two at a time. Pause one, retry the failure, collapse the panel to a pill.',
        bare: true,
        Content: UploadQueueExample,
        note: (
          <>Focus moves between the collapse button and the pill as the panel changes shape, so it is never dropped.</>
        ),
      },
      rationale(
        'Uploads started from a form are lost when the reader navigates away, and progress bars scattered across a page cannot say how much is left overall.',
        'One queue owns every file, weights overall progress by size, and keeps failures and finished rows visible until the reader deals with them.',
        'File managers, media libraries, data imports, attachment-heavy editors.',
        ['Progress', 'IconButton', 'Button', 'Text'],
      ),
    ],
    props: [
      {
        name: 'files',
        type: 'UploadQueueFile[]',
        description:
          "id, name, size (bytes), progress (0–1), status ('queued' | 'uploading' | 'paused' | 'done' | 'error') and error.",
      },
      { name: 'title', type: 'string', defaultValue: 'a count', description: 'Panel heading.' },
      { name: 'label', type: 'string', defaultValue: "'Uploads'", description: 'Accessible name for the region.' },
      {
        name: 'floating',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Pin to the bottom-right corner of the viewport.',
      },
      {
        name: 'collapsed / defaultCollapsed / onCollapsedChange',
        type: 'boolean',
        defaultValue: '— / false',
        description: 'Collapse to a pill. Controlled or uncontrolled.',
      },
      {
        name: 'onPause / onResume / onCancel / onRetry',
        type: '(id: string) => void',
        description: 'Each adds its control to the rows it applies to.',
      },
      {
        name: 'onClearCompleted',
        type: '() => void',
        description: 'Adds Clear completed once something has finished.',
      },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'shimmer-text': {
    description:
      'Text with a band of light passing across it, for labels like “Thinking…” while work is in flight. The glyphs are a window onto a moving gradient built only from ink tokens, so it stays real, selectable, readable text in both themes — and plain soft ink under reduced motion, in forced colours, or when paused.',
    sections: [
      {
        title: 'While an answer is written',
        description: 'The label shimmers until the answer arrives. Ask again to replay it.',
        bare: true,
        Content: ShimmerExample,
        note: motionNote('the text is plain soft ink with no sweep.'),
      },
      {
        title: 'Tones and speeds',
        specimens: [
          { label: "tone='ink'", node: <ShimmerText className="text-[14px] font-semibold">Thinking…</ShimmerText> },
          {
            label: "tone='accent'",
            node: (
              <ShimmerText tone="accent" className="text-[14px] font-semibold">
                Searching 12 sources
              </ShimmerText>
            ),
          },
          {
            label: 'speed={4}',
            node: (
              <ShimmerText speed={4} className="text-[14px] font-semibold">
                Generating summary
              </ShimmerText>
            ),
          },
          {
            label: 'paused',
            node: (
              <ShimmerText paused className="text-[14px] font-semibold">
                Summary ready
              </ShimmerText>
            ),
          },
        ],
      },
      rationale(
        'A spinner beside “Thinking…” says the same thing twice, and the two drift apart when one is updated without the other.',
        'The label itself carries the activity with no extra element and no duplicate text for a screen reader, and every gradient stop is a readable ink.',
        'AI responses in progress, search and generation states, inline loading labels in buttons and rows.',
        ['tokens'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The label.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: "'ink'", description: 'Colour of the travelling band.' },
      { name: 'speed', type: 'number', defaultValue: '2', description: 'Seconds per sweep.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Plain text, for when the work is done.' },
      { name: 'as', type: 'ElementType', defaultValue: "'span'", description: 'Render as another element.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'game-of-life': {
    description:
      'Conway’s Game of Life on a canvas, with play, pause, step, clear, randomise and a speed slider. Draw by clicking or dragging, or tab to the board and toggle cells from the keyboard. It pauses when scrolled out of view, starts paused under reduced motion, and reads its colours from the tokens every frame, so it follows the theme and accent.',
    sections: [
      {
        title: 'Playground',
        description: 'Drag across the board to draw, or focus it and use the arrow keys and Space.',
        bare: true,
        Content: () => (
          <Card className="w-full">
            <GameOfLife />
          </Card>
        ),
        note: motionNote('the board starts paused; it only moves after Play or Step.'),
      },
      rationale(
        'Generative demos are usually a canvas with no controls and no way in from the keyboard, running forever whether anyone is looking or not.',
        'The board keeps its state outside React, stops when it is off screen, and treats keyboard drawing and announcements as part of the toy rather than an afterthought.',
        'Empty states, 404 pages, teaching material, a playful corner of a developer product.',
        ['Button', 'Slider', 'Text'],
      ),
    ],
    props: [
      { name: 'columns / rows', type: 'number', defaultValue: '48 / 28', description: 'Board size in cells.' },
      { name: 'density', type: 'number', defaultValue: '0.28', description: 'Share of cells alive after randomising.' },
      {
        name: 'defaultSpeed',
        type: 'number',
        defaultValue: '10',
        description: 'Generations per second to start with.',
      },
      {
        name: 'autoPlay',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Run on mount, unless reduced motion is on.',
      },
      { name: 'wrap', type: 'boolean', defaultValue: 'true', description: 'Edges wrap to the opposite side.' },
      {
        name: 'label',
        type: 'string',
        defaultValue: "'Game of Life board'",
        description: 'Accessible name for the board.',
      },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
}
