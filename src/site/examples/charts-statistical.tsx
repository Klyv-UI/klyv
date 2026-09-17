import { useState } from 'react'
import {
  BoxPlot,
  BulletChart,
  CandlestickChart,
  Card,
  Histogram,
  IncidentTimeline,
  ScatterChart,
  SegmentedControl,
  UptimeBar,
  WaterfallChart,
  type BoxPlotOrientation,
  type CandlestickChartCandle,
  type UptimeBarDay,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ data */

/** Seeded so every render, test run and screenshot shows the same chart. */
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

function normal(random: () => number) {
  const u = Math.max(1e-9, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

const moneyK = (value: number) =>
  Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(Math.abs(value) >= 100_000 ? 0 : 1)}k` : `$${Math.round(value)}`
const ms = (value: number) => `${Math.round(value)} ms`

const DEALS = (() => {
  const random = seeded(7)
  const segment = (id: string, label: string, count: number, size: number, days: number, seats: number) => ({
    id,
    label,
    points: Array.from({ length: count }, (_, index) => {
      const dealSize = size * (0.55 + random() * 0.9)
      return {
        x: Math.round(dealSize),
        y: Math.max(7, Math.round(days * (dealSize / size) * (0.7 + random() * 0.6))),
        size: Math.round(seats * (0.5 + random())),
        label: `${label} deal ${index + 1}`,
      }
    }),
  })
  return [
    segment('smb', 'SMB', 14, 9000, 21, 12),
    segment('mid', 'Mid-market', 12, 38000, 48, 60),
    segment('ent', 'Enterprise', 8, 96000, 104, 240),
  ]
})()

const LATENCY = (() => {
  const random = seeded(21)
  return Array.from({ length: 480 }, () => Math.round(Math.exp(4.6 + normal(random) * 0.42)))
})()

const REGIONS = (() => {
  const random = seeded(33)
  const region = (id: string, label: string, centre: number, spread: number, tail: number[]) => ({
    id,
    label,
    values: [...Array.from({ length: 60 }, () => Math.round(centre + normal(random) * spread)), ...tail],
  })
  return [
    region('iad', 'us-east-1', 84, 12, [168, 181]),
    region('fra', 'eu-central-1', 102, 16, [210]),
    region('sin', 'ap-southeast-1', 138, 22, [262, 290, 305]),
    region('gru', 'sa-east-1', 156, 30, []),
  ]
})()

const CANDLES: CandlestickChartCandle[] = (() => {
  const random = seeded(58)
  let price = 182
  const start = new Date(2026, 6, 20)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const open = price
    const close = Math.max(20, open + normal(random) * 3.2 + 0.25)
    const high = Math.max(open, close) + random() * 2.6
    const low = Math.min(open, close) - random() * 2.6
    price = close
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(1_800_000 + random() * 2_400_000 + Math.abs(close - open) * 380_000),
    }
  })
})()

const TODAY = new Date(2026, 8, 17)

function uptimeDays(seed: number, events: Record<number, Partial<UptimeBarDay>>, missing = 0): UptimeBarDay[] {
  const random = seeded(seed)
  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date(TODAY)
    date.setDate(TODAY.getDate() - (89 - index))
    if (index < missing) return { date, status: 'unknown' as const }
    const event = events[index]
    if (event) return { date, status: 'operational' as const, ...event }
    return random() > 0.985
      ? { date, status: 'degraded' as const, downtimeMinutes: 3, incidents: ['Brief spike in response times'] }
      : { date, status: 'operational' as const }
  })
}

const SERVICES = [
  {
    label: 'API',
    days: uptimeDays(3, {
      41: { status: 'outage', downtimeMinutes: 47, incidents: ['Elevated 5xx rates on write endpoints'] },
      42: { status: 'degraded', downtimeMinutes: 6, incidents: ['Elevated 5xx rates on write endpoints (monitoring)'] },
      77: { status: 'degraded', downtimeMinutes: 12, incidents: ['Slow responses from us-east-1'] },
    }),
  },
  {
    label: 'Dashboard',
    days: uptimeDays(4, {
      63: { status: 'degraded', downtimeMinutes: 0, incidents: ['Charts loading slowly for some workspaces'] },
    }),
  },
  {
    label: 'Webhooks',
    days: uptimeDays(
      5,
      {
        88: {
          status: 'outage',
          downtimeMinutes: 92,
          incidents: ['Delayed webhook deliveries', 'Retry queue backlog'],
        },
      },
      12,
    ),
  },
]

const at = (day: number, hour: number, minute: number) => new Date(2026, 8, day, hour, minute)

/* ------------------------------------------------------------- examples */

function ScatterExample() {
  const [mode, setMode] = useState<'bubble' | 'dots'>('bubble')
  const [trend, setTrend] = useState<'on' | 'off'>('on')
  const series = mode === 'bubble' ? DEALS : DEALS.map((entry) => ({ ...entry, points: entry.points.map(({ size: _size, ...point }) => point) }))
  return (
    <Card title="Deal size against sales cycle" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            label="Marks"
            size="sm"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'bubble', label: 'Bubbles by seats' },
              { value: 'dots', label: 'Dots' },
            ]}
          />
          <SegmentedControl
            label="Trend line"
            size="sm"
            value={trend}
            onValueChange={setTrend}
            options={[
              { value: 'on', label: 'Trend' },
              { value: 'off', label: 'No trend' },
            ]}
          />
        </div>
        <ScatterChart
          series={series}
          label="Closed deals in the last two quarters: annual contract value against days to close, by segment"
          xLabel="Annual contract value"
          yLabel="Days to close"
          formatX={moneyK}
          formatY={(value) => `${Math.round(value)}d`}
          formatSize={(value) => `${value} seats`}
          trendLine={trend === 'on'}
        />
      </div>
    </Card>
  )
}

const PNL = [
  { label: 'COGS', value: -138_400 },
  { label: 'Gross profit', kind: 'subtotal' as const },
  { label: 'R&D', value: -96_200 },
  { label: 'Sales', value: -71_800 },
  { label: 'G&A', value: -28_900 },
  { label: 'Other', value: 14_600 },
  { label: 'Operating income', kind: 'total' as const },
]

const MRR = [
  { label: 'New', value: 32_400 },
  { label: 'Expansion', value: 12_100 },
  { label: 'Reactivation', value: 2_300 },
  { label: 'Contraction', value: -6_800 },
  { label: 'Churn', value: -9_300 },
  { label: 'Sep MRR', kind: 'total' as const },
]

function WaterfallExample() {
  const [view, setView] = useState<'pnl' | 'mrr'>('mrr')
  return (
    <Card title={view === 'mrr' ? 'MRR bridge, August to September' : 'Q3 operating income'} className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Dataset"
          size="sm"
          value={view}
          onValueChange={setView}
          className="self-start"
          options={[
            { value: 'mrr', label: 'MRR bridge' },
            { value: 'pnl', label: 'Profit and loss' },
          ]}
        />
        {view === 'mrr' ? (
          <WaterfallChart
            start={184_200}
            startLabel="Aug MRR"
            steps={MRR}
            format={moneyK}
            label="Monthly recurring revenue moved from $184.2k in August to $214.9k in September"
          />
        ) : (
          <WaterfallChart
            start={482_000}
            startLabel="Revenue"
            steps={PNL}
            format={moneyK}
            label="Q3 revenue of $482k bridged to operating income of $161.3k"
          />
        )}
      </div>
    </Card>
  )
}

function HistogramExample() {
  const [bins, setBins] = useState<'auto' | '10' | '30'>('auto')
  const [markers, setMarkers] = useState<'both' | 'none'>('both')
  return (
    <Card title="Checkout API latency, last hour" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            label="Bins"
            size="sm"
            value={bins}
            onValueChange={setBins}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '10', label: '10 bins' },
              { value: '30', label: '30 bins' },
            ]}
          />
          <SegmentedControl
            label="Markers"
            size="sm"
            value={markers}
            onValueChange={setMarkers}
            options={[
              { value: 'both', label: 'Mean and median' },
              { value: 'none', label: 'None' },
            ]}
          />
        </div>
        <Histogram
          values={LATENCY}
          bins={bins === 'auto' ? undefined : Number(bins)}
          showMean={markers === 'both'}
          showMedian={markers === 'both'}
          format={(value) => String(Math.round(value))}
          xLabel="Response time (ms)"
          label="Distribution of 480 checkout API response times, skewed right with a long slow tail"
        />
      </div>
    </Card>
  )
}

function BoxPlotExample() {
  const [orientation, setOrientation] = useState<BoxPlotOrientation>('vertical')
  return (
    <Card title="Time to first byte by region" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Orientation"
          size="sm"
          value={orientation}
          onValueChange={setOrientation}
          className="self-start"
          options={[
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' },
          ]}
        />
        <BoxPlot
          groups={REGIONS}
          orientation={orientation}
          format={ms}
          label="Time to first byte by region: us-east-1 is fastest and tightest, sa-east-1 slowest and widest"
        />
      </div>
    </Card>
  )
}

function BulletExample() {
  return (
    <Card title="Q3 scorecard" className="w-full">
      <BulletChart
        className="mt-4"
        label="Q3 scorecard against targets"
        rows={[
          { id: 'arr', label: 'New ARR', sublabel: 'USD', value: 1_240_000, target: 1_400_000, ranges: [900_000, 1_300_000, 1_700_000] },
          { id: 'nrr', label: 'Net revenue retention', sublabel: 'Percent', value: 112, target: 110, ranges: [95, 105, 125], min: 80 },
          { id: 'pipe', label: 'Pipeline coverage', sublabel: 'Multiple of quota', value: 2.8, target: 3, ranges: [2, 3, 4] },
          { id: 'nps', label: 'NPS', sublabel: 'Score', value: 46, target: 50, ranges: [20, 40, 70] },
        ]}
        rangeLabels={['Poor', 'On track', 'Strong']}
      />
    </Card>
  )
}

function CandlestickExample() {
  const [volume, setVolume] = useState<'on' | 'off'>('on')
  return (
    <Card title="ACME · daily" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="Volume pane"
          size="sm"
          value={volume}
          onValueChange={setVolume}
          className="self-start"
          options={[
            { value: 'on', label: 'With volume' },
            { value: 'off', label: 'Price only' },
          ]}
        />
        <CandlestickChart
          candles={CANDLES}
          showVolume={volume === 'on'}
          format={(value) => value.toFixed(2)}
          formatVolume={(value) => `${(value / 1_000_000).toFixed(2)}M`}
          label="ACME daily prices over six weeks, from 182.00 to the most recent close"
        />
      </div>
    </Card>
  )
}

function UptimeExample() {
  return (
    <Card title="System status" className="w-full">
      <div className="mt-4 flex flex-col gap-6">
        {SERVICES.map((service, index) => (
          <UptimeBar
            key={service.label}
            label={service.label}
            days={service.days}
            showLegend={index === SERVICES.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}

function IncidentExample() {
  return (
    <div className="grid w-full gap-4 lg:grid-cols-2">
      <Card className="w-full">
        <IncidentTimeline
          title="Delayed webhook deliveries"
          severity="major"
          components={['Webhooks', 'Retry queue']}
          now={at(16, 15, 40)}
          updates={[
            { id: 'w1', status: 'investigating', at: at(16, 13, 52), message: 'We are investigating reports of webhooks arriving up to 20 minutes late.' },
            { id: 'w2', status: 'identified', at: at(16, 14, 21), message: 'A stalled consumer left the retry queue backed up. We have restarted it and are draining the backlog.' },
            { id: 'w3', status: 'monitoring', at: at(16, 15, 5), message: 'New deliveries are on time. Roughly 40,000 delayed events are still being sent, oldest first.' },
          ]}
        />
      </Card>
      <Card className="w-full">
        <IncidentTimeline
          title="Elevated API error rates"
          severity="critical"
          components={['API', 'Dashboard']}
          startedAt={at(9, 8, 58)}
          updates={[
            { id: 'a4', status: 'resolved', at: at(9, 10, 12), message: 'Error rates have been normal for 30 minutes. A full review will follow.' },
            { id: 'a1', status: 'investigating', at: at(9, 9, 4), message: 'Some write requests are failing with 503 errors.' },
            { id: 'a3', status: 'monitoring', at: at(9, 9, 41), message: 'The failover has completed and error rates are back to baseline.' },
            { id: 'a2', status: 'identified', at: at(9, 9, 18), message: 'A primary database node in us-east-1 became unresponsive. We are failing over.' },
          ]}
        />
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- pages */

const CHART_BASE = [
  { name: 'label', type: 'string', description: 'Accessible name. Say what the chart shows, not what it is called.' },
  { name: 'height', type: 'number', description: 'Chart height in pixels. The width always fills the container.' },
  { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
]

const KEYBOARD =
  'The chart is one tab stop. Arrow keys step through the marks and show the tooltip, Home and End jump to either end, Escape clears. Every value is also in a visually hidden table.'

export const demos: ExampleModule = {
  'scatter-chart': {
    description:
      'Two measures against each other, one dot per observation, with an optional third as bubble size and an optional least-squares trend line per series. Bubble area — not radius — follows the size, because the eye reads area; neither axis is forced to zero, because position rather than length carries the value.',
    sections: [
      {
        title: 'Deals by segment',
        description: 'Hover a point or tab to the chart and use the arrow keys. Toggle bubbles and the trend line.',
        bare: true,
        Content: ScatterExample,
        note: (
          <>
            {KEYBOARD} {motionNote('points appear at full size immediately instead of growing in.')}
          </>
        ),
      },
      rationale(
        'Correlation questions — do bigger deals take longer, does latency rise with payload — get answered with two line charts side by side, which cannot show the relationship at all.',
        'A scatter is the only common chart that plots one measure against another. The trend line is drawn only across the data it was fitted to, so it never extrapolates.',
        'Sales analytics, performance investigations, pricing research, any “does X move with Y” question.',
        ['ChartTooltip', 'Legend', 'VisuallyHidden', 'SERIES_COLORS'],
      ),
    ],
    props: [
      { name: 'series', type: 'ScatterChartSeries[]', description: 'id, label, points ({ x, y, size?, label? }) and an optional colour.' },
      ...CHART_BASE,
      { name: 'xLabel / yLabel', type: 'string', description: 'Axis titles; also used in the tooltip and table.' },
      { name: 'trendLine', type: 'boolean', defaultValue: 'false', description: 'Least-squares line through each series.' },
      { name: 'radius', type: '[number, number]', defaultValue: '[3.5, 16]', description: 'Smallest and largest bubble radius.' },
      { name: 'formatX / formatY / formatSize', type: '(value: number) => string', description: 'Formatters for axes, tooltip and table.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'true', description: 'Series key, shown when there is more than one series.' },
    ],
  },

  'waterfall-chart': {
    description:
      'How a starting figure became an ending one, as floating bars that each start where the previous one ended. Subtotals and totals are computed from the steps rather than typed in, so the bridge always adds up; increases take the accent, decreases the danger tone, and every bar prints its signed change so direction never rests on colour.',
    sections: [
      {
        title: 'Two bridges',
        description: 'Switch datasets, then hover or arrow through the bars.',
        bare: true,
        Content: WaterfallExample,
        note: motionNote('bars appear at their final length instead of growing from their base.'),
      },
      rationale(
        'A table of increases and decreases makes the reader do the running sum; a stacked bar hides which items moved the total most.',
        'The waterfall keeps the running level visible at every step, with connectors carrying it across, so the biggest movers are the longest bars.',
        'MRR and ARR bridges, profit-and-loss summaries, budget variance, headcount changes.',
        ['ChartTooltip', 'Legend', 'VisuallyHidden', 'accent and danger tokens'],
      ),
    ],
    props: [
      { name: 'steps', type: 'WaterfallChartStep[]', description: 'label, signed value, and kind: change (default), subtotal or total.' },
      { name: 'start / startLabel', type: 'number / string', defaultValue: "— / 'Start'", description: 'Opening value, drawn as the first bar.' },
      ...CHART_BASE,
      { name: 'format', type: '(value: number) => string', description: 'Formatter for axis, bar labels and tooltip.' },
      { name: 'showValues / showConnectors / showLegend', type: 'boolean', defaultValue: 'true', description: 'Bar labels, dashed level connectors, and the key.' },
    ],
  },

  histogram: {
    description:
      'The shape of a distribution, from raw values. With no instruction it picks a bin count by Sturges’ rule and snaps the width to a round number, so the edges read 50, 100, 150 rather than 47.3, 94.6. Mean and median markers are optional, because on skewed data the gap between them is the finding and on symmetric data it is noise.',
    sections: [
      {
        title: 'Latency distribution',
        description: 'Change the bin count and the markers; hover or arrow through the bins.',
        bare: true,
        Content: HistogramExample,
        note: motionNote('bars appear at their final height instead of rising.'),
      },
      rationale(
        'An average latency of 110 ms hides whether most requests take 100 ms or half take 20 ms and half take 200 ms.',
        'A histogram shows the whole shape. Taking raw values means binning is done one consistent way, and bars touch because the bins are a continuous range.',
        'Performance dashboards, order values, session lengths, survey scores — any measure where the spread matters.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'values', type: 'number[]', description: 'Raw observations. Non-finite values are ignored.' },
      { name: 'bins', type: 'number', defaultValue: 'Sturges', description: 'Approximate bin count, rounded to a nice width.' },
      { name: 'binWidth', type: 'number', description: 'Exact bin width. Wins over bins.' },
      ...CHART_BASE,
      { name: 'showMean / showMedian', type: 'boolean', defaultValue: 'false', description: 'Vertical markers with their values.' },
      { name: 'xLabel', type: 'string', description: 'Axis title.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for bin edges and markers.' },
      { name: 'color', type: 'string', defaultValue: 'var(--color-accent-strong)', description: 'Bar colour.' },
    ],
  },

  'box-plot': {
    description:
      'Distributions side by side: the middle half as a box, the median as a line, whiskers to the furthest values within 1.5 IQR, and everything beyond as individual dots. Give it raw values and it computes the summary; give it a five-number summary when the values are too many to ship to the browser.',
    sections: [
      {
        title: 'Regions compared',
        description: 'Flip the orientation. Hover or arrow through the groups for the five numbers.',
        bare: true,
        Content: BoxPlotExample,
        note: motionNote('boxes appear in place instead of expanding from their median.'),
      },
      rationale(
        'Comparing groups by their averages hides the thing that usually matters — that one region is not slower on average but far less predictable.',
        'A box plot puts centre, spread and outliers for many groups in one small chart, and draws the outliers one by one because the slow tail is often what someone is looking for.',
        'Latency by region, deal size by rep, test scores by cohort, build times by runner.',
        ['ChartTooltip', 'VisuallyHidden', 'SERIES_COLORS'],
      ),
    ],
    props: [
      { name: 'groups', type: 'BoxPlotGroup[]', description: 'id, label, and either values or a summary ({ min, q1, median, q3, max, outliers? }).' },
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Horizontal suits long category names.' },
      ...CHART_BASE,
      { name: 'format', type: '(value: number) => string', description: 'Formatter for the value axis and tooltip.' },
    ],
  },

  'bullet-chart': {
    description:
      'Stephen Few’s bullet graph: a measure, its target and its qualitative range in the space of a line of text. The ranges are shades of ink, darkest for the worst, so the graph survives greyscale and colour-blindness; the figure and target are printed beside the bar, and each row stacks on a shared layout.',
    sections: [
      {
        title: 'Scorecard',
        description: 'Four measures on their own scales, each read against its own target.',
        bare: true,
        Content: BulletExample,
        note: motionNote('bars appear at their value instead of growing from the left.'),
      },
      {
        title: 'Anatomy',
        specimens: [
          {
            label: 'Below target',
            fill: true,
            node: <BulletChart label="Below target example" rows={[{ id: 'a', label: 'Signups', value: 620, target: 800, ranges: [500, 750, 1000] }]} />,
          },
          {
            label: 'Past target',
            fill: true,
            node: <BulletChart label="Past target example" rows={[{ id: 'b', label: 'Uptime SLO', sublabel: 'Percent', value: 99.96, target: 99.9, ranges: [99.5, 99.9, 100], min: 99 }]} format={(value) => value.toFixed(2)} />,
          },
        ],
        stack: true,
      },
      rationale(
        'Dashboard gauges spend a dial’s worth of space on one number and still do not say whether it is good.',
        'The bullet graph encodes value, target and qualitative range in one row, so a dozen KPIs fit where two gauges did and can be compared down the column.',
        'Executive scorecards, OKR reviews, SLO summaries, quota attainment.',
        ['Text', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'rows', type: 'BulletChartRow[]', description: 'id, label, sublabel?, value, target?, ranges (ascending upper bounds), min?.' },
      { name: 'label', type: 'string', description: 'Accessible name for the stack of measures.' },
      { name: 'rangeLabels', type: 'string[]', defaultValue: "['Poor', 'Satisfactory', 'Good']", description: 'Names of the ranges, used in each row’s spoken summary.' },
      { name: 'format', type: '(value: number) => string', description: 'Formatter for value, target and ticks.' },
      { name: 'showAxis', type: 'boolean', defaultValue: 'true', description: 'Tick labels under each bar.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'candlestick-chart': {
    description:
      'Open, high, low and close per period, with an optional volume pane. Rising candles are hollow and falling ones solid as well as green and red, so the direction reads without hue. The crosshair tracks the pointer on both axes and prints the price level on the axis; from the keyboard it steps candle by candle and rests on the close.',
    sections: [
      {
        title: 'Six weeks of daily prices',
        description: 'Move across the chart for the crosshair and O/H/L/C, or tab in and use the arrows.',
        bare: true,
        Content: CandlestickExample,
        note: motionNote('candles appear in place instead of stretching open.'),
      },
      rationale(
        'A line of closing prices hides the intraday range and whether each period rose or fell — the two things traders and treasury teams read first.',
        'Candles pack four prices and a direction into one mark; the hollow/solid convention predates colour screens and still works without it.',
        'Market data, crypto and FX dashboards, and any OHLC-shaped metric such as daily min/max latency.',
        ['ChartTooltip', 'VisuallyHidden', 'success and danger tokens'],
      ),
    ],
    props: [
      { name: 'candles', type: 'CandlestickChartCandle[]', description: 'date, open, high, low, close, volume?. Oldest first.' },
      ...CHART_BASE,
      { name: 'showVolume', type: 'boolean', defaultValue: 'true', description: 'Volume pane, when candles carry volume.' },
      { name: 'format / formatVolume', type: '(value: number) => string', description: 'Formatters for prices and volume.' },
    ],
  },

  'uptime-bar': {
    description:
      'A status-page row: one thin bar per day coloured by its declared status — operational, degraded, outage, or no data — with the incidents behind each day in its tooltip and the uptime for the period beside the name. Days with no data are left out of the percentage rather than counted as up or down.',
    sections: [
      {
        title: 'Status page',
        description: 'Ninety days per service. Hover a bar, or tab to a row and use the arrow keys. Webhooks has no data for its first twelve days.',
        bare: true,
        Content: UptimeExample,
        note: (
          <>
            {KEYBOARD} {motionNote('bars appear at full height instead of rising in sequence.')}
          </>
        ),
      },
      rationale(
        'A single uptime figure hides whether the lost minutes were one bad afternoon or a week of flakiness, and says nothing about what happened.',
        'One bar per day shows the pattern, and attaching incidents to days lets the row answer “what was that red bar?” without leaving the page. Where StatusStrip colours by a measured ratio, this shows the status that was published.',
        'Public status pages, internal service catalogues, vendor dashboards, SLA reports.',
        ['Legend', 'Text', 'VisuallyHidden', 'status tokens'],
      ),
    ],
    props: [
      { name: 'days', type: 'UptimeBarDay[]', description: 'date, status, incidents?, downtimeMinutes?. Oldest first.' },
      { name: 'label', type: 'string', description: 'The service or component name.' },
      { name: 'uptime', type: 'number', description: 'Percentage to print. Computed from days when omitted.' },
      { name: 'from / to', type: 'string', defaultValue: "'N days ago' / 'Today'", description: 'Captions under each end.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'false', description: 'Status key — show it once under a stack of rows.' },
      { name: 'height', type: 'number', defaultValue: '32', description: 'Bar height in pixels.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'incident-timeline': {
    description:
      'One incident as a status page tells it: severity, affected components, how long it has lasted, and every update newest first. Each update’s status is a word as well as a dot, and an incident still open says “Ongoing for” and counts to now rather than printing a duration that looks final.',
    sections: [
      {
        title: 'Open and resolved',
        description: 'The right-hand incident’s updates are passed out of order; the component sorts them.',
        bare: true,
        Content: IncidentExample,
      },
      rationale(
        'Incident updates posted as free text in a chat or a changelog bury the current state under the history, and leave “is it fixed?” unanswered.',
        'Newest first puts the current state where someone arriving mid-incident looks, with the four standard statuses as labels and the duration computed from the updates themselves.',
        'Public status pages, internal incident channels, post-incident reports, customer-facing notices.',
        ['StatusPill', 'StatusDot', 'Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'title', type: 'string', description: 'The incident name.' },
      { name: 'severity', type: "'maintenance' | 'minor' | 'major' | 'critical'", description: 'Shown as a badge.' },
      { name: 'updates', type: 'IncidentTimelineUpdate[]', description: 'id, status, at (Date), message. Any order.' },
      { name: 'components', type: 'string[]', description: 'Affected components.' },
      { name: 'startedAt', type: 'Date', description: 'Start of impact, if before the first update.' },
      { name: 'now', type: 'Date', defaultValue: 'new Date()', description: 'Reference time for an open incident.' },
      { name: 'headingLevel', type: "'h2' | 'h3' | 'h4'", defaultValue: "'h3'", description: 'Element for the title.' },
      { name: 'formatTime', type: '(date: Date) => string', description: 'Timestamp formatter.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
}
