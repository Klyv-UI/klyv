import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  ContourPlot,
  ControlChart,
  ErrorBudget,
  Field,
  FlameGraph,
  ForecastChart,
  HexbinChart,
  KaplanMeierChart,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  TimeSeriesExplorer,
  TraceWaterfall,
  ViolinPlot,
  type ControlChartViolation,
  type ErrorBudgetSample,
  type ForecastChartFit,
  type KaplanMeierChartGroup,
  type TimeSeriesExplorerRange,
  type TimeSeriesExplorerSeries,
  type TraceWaterfallSpan,
  type ViolinPlotOrientation,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ data */

/** Seeded, so every render and every visitor sees the same data. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number) {
  const u = Math.max(1e-12, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

function once<T>(make: () => T) {
  let value: T | undefined
  return () => (value ??= make())
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const EPOCH = Date.UTC(2026, 8, 1)

const shortDate = (time: number) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const dateTime = (time: number) =>
  new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const ms = (value: number) => `${Math.round(value)} ms`

const KEYBOARD =
  'The chart is one tab stop. Arrow keys step through the marks and show the tooltip, Home and End jump to either end, Escape clears.'

const CHART_BASE = [
  { name: 'label', type: 'string', description: 'Accessible name. Say what the chart shows, not what it is called.' },
  { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
]

/* ------------------------------------------------- time series explorer */

const telemetry = once((): TimeSeriesExplorerSeries[] => {
  const count = 110_000
  const random = rng(7)
  const x = new Float64Array(count)
  const p50 = new Float64Array(count)
  const p99 = new Float64Array(count)
  let drift = 0
  for (let i = 0; i < count; i += 1) {
    const t = EPOCH + i * 10_000
    x[i] = t
    const hour = (t / HOUR) % 24
    const daily = Math.sin(((hour - 9) / 24) * 2 * Math.PI)
    drift = drift * 0.995 + gaussian(random) * 0.6
    const spike = random() < 0.0008 ? 180 + random() * 420 : 0
    const incident = i > 61_000 && i < 61_900 ? 260 : 0
    p50[i] = 42 + 9 * daily + drift + gaussian(random) * 3
    p99[i] = 160 + 45 * daily + drift * 3 + gaussian(random) * 14 + spike + incident
  }
  return [
    { id: 'p99', label: 'p99 latency', x, y: p99 },
    { id: 'p50', label: 'p50 latency', x, y: p50 },
  ]
})

function TimeSeriesExample() {
  const series = telemetry()
  const end = series[0].x[series[0].x.length - 1]
  const [range, setRange] = useState<TimeSeriesExplorerRange>([end - 3 * DAY, end])
  const presets: [string, number][] = [
    ['Last 6 hours', 6 * HOUR],
    ['Last day', DAY],
    ['Last 3 days', 3 * DAY],
  ]
  return (
    <Card title="Checkout API latency" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map(([name, length]) => (
            <Button key={name} size="sm" variant="outline" onClick={() => setRange([end - length, end])}>
              {name}
            </Button>
          ))}
          <Text as="span" size="caption" tone="faint" className="ml-auto">
            {`${(series[0].x.length * series.length).toLocaleString()} samples, every 10 seconds`}
          </Text>
        </div>
        <TimeSeriesExplorer
          series={series}
          label="Checkout API p50 and p99 latency over 12 days"
          range={range}
          onRangeChange={setRange}
          formatX={dateTime}
          formatY={ms}
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------ forecast chart */

const signups = once(() => {
  const random = rng(11)
  const weekday = [1.12, 1.18, 1.15, 1.1, 1.0, 0.62, 0.58]
  return Array.from({ length: 112 }, (_, day) => {
    const trend = 380 + day * 2.6
    return Math.round(trend * weekday[day % 7] * (1 + gaussian(random) * 0.045))
  })
})
const FORECAST_START = Date.UTC(2026, 4, 25)

function ForecastExample() {
  const [mode, setMode] = useState<'additive' | 'multiplicative'>('multiplicative')
  const [level, setLevel] = useState<'0.8' | '0.95'>('0.8')
  const [fit, setFit] = useState<ForecastChartFit | null>(null)
  return (
    <Card title="Daily sign-ups, next two weeks" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Seasonality"
            size="sm"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'additive', label: 'Additive' },
              { value: 'multiplicative', label: 'Multiplicative' },
            ]}
          />
          <SegmentedControl
            label="Interval"
            size="sm"
            value={level}
            onValueChange={setLevel}
            options={[
              { value: '0.8', label: '80%' },
              { value: '0.95', label: '95%' },
            ]}
          />
        </div>
        <ForecastChart
          values={signups()}
          period={7}
          horizon={14}
          seasonality={mode}
          confidence={Number(level) as 0.8 | 0.95}
          onFit={setFit}
          label="Daily sign-ups for 16 weeks with a 14-day Holt–Winters forecast"
          formatX={(index) => shortDate(FORECAST_START + index * DAY)}
        />
        {fit && (
          <Text size="caption" tone="faint">
            {`Next week: ${fit.forecast.slice(0, 7).reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} sign-ups expected.`}
          </Text>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------- control chart */

const fulfilment = once(() => {
  const random = rng(23)
  return Array.from({ length: 56 }, (_, day) => {
    let value = 31 + gaussian(random) * 2.2
    if (day === 12) value += 11
    if (day >= 20 && day < 26) value += (day - 19) * 0.8
    if (day >= 36) value -= 4.5
    return Math.round(value * 10) / 10
  })
})
const FULFIL_START = Date.UTC(2026, 6, 20)

function ControlExample() {
  const [phased, setPhased] = useState(false)
  const [signals, setSignals] = useState<ControlChartViolation[]>([])
  return (
    <Card title="Warehouse pick time" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={phased} onChange={(event) => setPhased(event.target.checked)} />
            New limits after the re-slotting on {shortDate(FULFIL_START + 36 * DAY)}
          </label>
          <Text as="span" size="caption" tone="faint">
            {`${signals.length} signals`}
          </Text>
        </div>
        <ControlChart
          values={fulfilment()}
          labels={fulfilment().map((_, day) => shortDate(FULFIL_START + day * DAY))}
          phases={phased ? [36] : []}
          onViolationsChange={setSignals}
          formatY={(value) => `${value.toFixed(1)} min`}
          label="Median pick time per day, in minutes, over eight weeks"
        />
      </div>
    </Card>
  )
}

/* ----------------------------------------------------- kaplan-meier */

function cohort(seed: number, size: number, scale: number, shape: number): KaplanMeierChartGroup['subjects'] {
  const random = rng(seed)
  return Array.from({ length: size }, () => {
    const churn = scale * (-Math.log(Math.max(1e-9, random()))) ** (1 / shape)
    const observed = 2 + random() * 22
    return churn <= observed ? { time: Math.max(0.2, Math.round(churn * 10) / 10), event: true } : { time: Math.round(observed * 10) / 10, event: false }
  })
}
const cohorts = once((): KaplanMeierChartGroup[] => [
  { id: 'annual', label: 'Annual plan', subjects: cohort(3, 180, 34, 1.3) },
  { id: 'monthly', label: 'Monthly plan', subjects: cohort(5, 220, 13, 0.9) },
  { id: 'trial', label: 'Converted trial', subjects: cohort(9, 140, 9, 0.8) },
])

function SurvivalExample() {
  const [third, setThird] = useState(false)
  const [bands, setBands] = useState(true)
  const groups = third ? cohorts() : cohorts().slice(0, 2)
  return (
    <Card title="Subscription retention" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={bands} onChange={(event) => setBands(event.target.checked)} />
            95% bands
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={third} onChange={(event) => setThird(event.target.checked)} />
            Add converted trials
          </label>
        </div>
        <KaplanMeierChart
          groups={groups}
          showConfidence={bands}
          timeLabel="Months since signup"
          formatTime={(value) => String(Math.round(value * 10) / 10)}
          label="Share of customers still subscribed by months since signup, by plan"
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------ trace waterfall */

const TRACE: TraceWaterfallSpan[] = [
  { id: 'a', name: 'POST /checkout', service: 'web', start: 0, duration: 612, attributes: { 'http.method': 'POST', 'http.status_code': 200, 'user.tier': 'pro' } },
  { id: 'b', parentId: 'a', name: 'POST /api/orders', service: 'gateway', start: 14, duration: 588, attributes: { 'http.route': '/api/orders', 'net.peer': 'orders-7f9c' } },
  { id: 'c', parentId: 'b', name: 'auth.verify', service: 'auth', start: 18, duration: 22, attributes: { 'auth.method': 'session', cached: true } },
  { id: 'd', parentId: 'b', name: 'orders.create', service: 'orders', start: 44, duration: 552 },
  { id: 'e', parentId: 'd', name: 'SELECT cart_items', service: 'postgres', start: 50, duration: 38, attributes: { 'db.statement': 'SELECT * FROM cart_items WHERE cart_id = $1', rows: 4 } },
  { id: 'f', parentId: 'd', name: 'inventory.reserve', service: 'inventory', start: 92, duration: 146 },
  { id: 'g', parentId: 'f', name: 'GET stock:sku-*', service: 'redis', start: 96, duration: 9, attributes: { 'db.operation': 'MGET', keys: 4 } },
  { id: 'h', parentId: 'f', name: 'UPDATE stock', service: 'postgres', start: 110, duration: 121, attributes: { 'db.statement': 'UPDATE stock SET reserved = reserved + $1', 'lock.wait_ms': 84 } },
  { id: 'i', parentId: 'd', name: 'pricing.quote', service: 'orders', start: 92, duration: 74, attributes: { currency: 'EUR', 'tax.region': 'DE' } },
  { id: 'j', parentId: 'i', name: 'GET fx:EUR', service: 'redis', start: 98, duration: 4 },
  { id: 'k', parentId: 'd', name: 'payments.charge', service: 'payments', start: 244, duration: 318 },
  { id: 'l', parentId: 'k', name: 'POST provider /v1/charges', service: 'payments', start: 252, duration: 120, status: 'error', attributes: { 'http.status_code': 502, retry: 0 } },
  { id: 'm', parentId: 'k', name: 'POST provider /v1/charges', service: 'payments', start: 402, duration: 146, attributes: { 'http.status_code': 200, retry: 1 } },
  { id: 'n', parentId: 'd', name: 'INSERT orders', service: 'postgres', start: 566, duration: 18, attributes: { 'db.statement': 'INSERT INTO orders (...) VALUES (...)' } },
  { id: 'o', parentId: 'd', name: 'publish order.created', service: 'orders', start: 586, duration: 6, attributes: { topic: 'order.created', partition: 3 } },
  { id: 'p', parentId: 'a', name: 'render confirmation', service: 'web', start: 540, duration: 30 },
]

function TraceExample() {
  const [selected, setSelected] = useState<string | null>('h')
  return (
    <Card title="Trace 4bf92f35 · POST /checkout" className="w-full">
      <div className="mt-3">
        <TraceWaterfall spans={TRACE} label="Spans of the checkout request" selected={selected} onSelectedChange={setSelected} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------- contour plot */

const sessions = once(() => {
  const random = rng(31)
  return Array.from({ length: 900 }, (_, i) => {
    const group = i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2
    const [mx, my, sx, sy] = group === 0 ? [3.2, 4, 1.1, 1.4] : group === 1 ? [9, 14, 2.2, 3] : [5, 22, 3.5, 4]
    return { x: Math.max(0.2, mx + gaussian(random) * sx), y: Math.max(1, my + gaussian(random) * sy + (group === 1 ? gaussian(random) : 0)) }
  })
})

function ContourExample() {
  const [bandwidth, setBandwidth] = useState(1)
  const [points, setPoints] = useState(true)
  return (
    <Card title="Session length against pages viewed" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <Field label={`Bandwidth: ${bandwidth.toFixed(2)}× Scott`}>
            <Slider min={40} max={200} value={Math.round(bandwidth * 100)} onChange={(event) => setBandwidth(Number(event.target.value) / 100)} />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={points} onChange={(event) => setPoints(event.target.checked)} />
            Show sessions
          </label>
        </div>
        <ContourPlot
          points={sessions()}
          bandwidth={bandwidth}
          showPoints={points}
          xLabel="Minutes on site"
          yLabel="Pages viewed"
          label="Density of 900 sessions by minutes on site and pages viewed"
        />
      </div>
    </Card>
  )
}

/* -------------------------------------------------------- violin plot */

const onboarding = once(() => {
  const random = rng(41)
  const make = (n: number, f: () => number) => Array.from({ length: n }, () => Math.max(0.1, Math.round(f() * 10) / 10))
  return [
    { id: 'sales', label: 'Sales-led', values: make(120, () => 6 + gaussian(random) * 1.6) },
    { id: 'self', label: 'Self-serve', values: make(260, () => (random() < 0.55 ? 1.2 + gaussian(random) * 0.5 : 8 + gaussian(random) * 2.2)) },
    { id: 'partner', label: 'Partner', values: make(90, () => 3 + Math.abs(gaussian(random)) * 4.5) },
    { id: 'migration', label: 'Migration', values: make(70, () => 12 + gaussian(random) * 3) },
  ]
})

function ViolinExample() {
  const [orientation, setOrientation] = useState<ViolinPlotOrientation>('vertical')
  const [box, setBox] = useState(false)
  const [dots, setDots] = useState(true)
  return (
    <Card title="Days to first value, by acquisition route" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            label="Orientation"
            size="sm"
            value={orientation}
            onValueChange={setOrientation}
            options={[
              { value: 'vertical', label: 'Vertical' },
              { value: 'horizontal', label: 'Horizontal' },
            ]}
          />
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={box} onChange={(event) => setBox(event.target.checked)} />
            Box
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
            <Switch switchSize="sm" checked={dots} onChange={(event) => setDots(event.target.checked)} />
            Points
          </label>
        </div>
        <ViolinPlot
          groups={onboarding()}
          orientation={orientation}
          showBox={box}
          showPoints={dots}
          valueLabel="Days to first value"
          formatValue={(value) => `${Math.round(value * 10) / 10}d`}
          label="Distribution of days from signup to first value for four acquisition routes"
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------- hexbin chart */

const requests = once(() => {
  const random = rng(53)
  return Array.from({ length: 50_000 }, () => {
    const size = Math.exp(2.6 + gaussian(random) * 0.65)
    const slow = random() < 0.1
    const latency = 60 + size * 4.2 + gaussian(random) * 28 + (slow ? 140 + Math.abs(gaussian(random)) * 160 : 0)
    return { x: Math.min(100, size), y: Math.max(5, Math.min(900, latency)) }
  })
})

function HexbinExample() {
  const [scale, setScale] = useState<'linear' | 'sqrt' | 'log'>('sqrt')
  return (
    <Card title="Request size against latency" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <SegmentedControl
          label="Colour scale"
          size="sm"
          value={scale}
          onValueChange={setScale}
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'sqrt', label: 'Square root' },
            { value: 'log', label: 'Log' },
          ]}
        />
        <HexbinChart
          points={requests()}
          colorScale={scale}
          xLabel="Payload (KB)"
          yLabel="Latency (ms)"
          label="50,000 API requests binned by payload size and latency"
        />
      </div>
    </Card>
  )
}

/* -------------------------------------------------------- flame graph */

function profileText(regressed: boolean) {
  const lines: [string, number][] = [
    ['node;main;http.Server.emit;router.handle;auth.middleware;jwt.verify;crypto.verify', 420],
    ['node;main;http.Server.emit;router.handle;auth.middleware;session.load;redis.get', 160],
    ['node;main;http.Server.emit;router.handle;orders.list;db.query;pg.Client.query;socket.read', 980],
    ['node;main;http.Server.emit;router.handle;orders.list;db.query;pg.parseRows', 540],
    ['node;main;http.Server.emit;router.handle;orders.list;serialize;JSON.stringify', regressed ? 1480 : 620],
    ['node;main;http.Server.emit;router.handle;orders.list;serialize;formatMoney;Intl.NumberFormat', regressed ? 910 : 140],
    ['node;main;http.Server.emit;router.handle;orders.list;enrich;pricing.quote;fx.convert', 310],
    ['node;main;http.Server.emit;router.handle;orders.list;enrich;inventory.lookup;redis.mget', 260],
    ['node;main;http.Server.emit;router.handle;search;db.query;pg.Client.query;socket.read', 380],
    ['node;main;http.Server.emit;router.handle;search;rank;tokenize', 290],
    ['node;main;http.Server.emit;router.handle;search;rank;score;Math.log', 170],
    ['node;main;http.Server.emit;compression;zlib.deflate', regressed ? 230 : 390],
    ['node;main;http.Server.emit;logger.info;JSON.stringify', 210],
    ['node;main;timers;metrics.flush;statsd.send', 90],
    ['node;gc;scavenge', regressed ? 520 : 340],
    ['node;gc;mark-compact', 180],
  ]
  return lines.map(([stack, count]) => `${stack} ${count}`).join('\n')
}
const PROFILE_BEFORE = profileText(false)
const PROFILE_AFTER = profileText(true)

function FlameExample() {
  const [compare, setCompare] = useState(false)
  return (
    <Card title="CPU profile · orders service" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={compare} onChange={(event) => setCompare(event.target.checked)} />
          Compare with the previous release
        </label>
        <FlameGraph
          profile={PROFILE_AFTER}
          baseline={compare ? PROFILE_BEFORE : undefined}
          label="CPU samples of the orders service, folded by stack"
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------- error budget */

const traffic = once((): ErrorBudgetSample[] => {
  const random = rng(61)
  const step = 5 * 60_000
  return Array.from({ length: 18 * 288 }, (_, i) => {
    const time = EPOCH + i * step
    const hour = (time / HOUR) % 24
    const requests = Math.round(9000 + 5000 * Math.sin(((hour - 8) / 24) * 2 * Math.PI) + random() * 600)
    let ratio = 0.00035 + random() * 0.0003
    if (i >= 5 * 288 + 170 && i < 5 * 288 + 188) ratio = 0.028 + random() * 0.01
    if (i >= 12 * 288 + 40 && i < 14 * 288 + 200) ratio = 0.0031 + random() * 0.0012
    return { time, requests, errors: Math.round(requests * ratio) }
  })
})

function ErrorBudgetExample() {
  const [target, setTarget] = useState<'0.999' | '0.9995' | '0.995'>('0.999')
  const samples = traffic()
  return (
    <Card title="Checkout availability SLO" className="w-full">
      <div className="mt-3 flex flex-col gap-4">
        <SegmentedControl
          label="SLO target"
          size="sm"
          value={target}
          onValueChange={setTarget}
          options={[
            { value: '0.995', label: '99.5%' },
            { value: '0.999', label: '99.9%' },
            { value: '0.9995', label: '99.95%' },
          ]}
        />
        <ErrorBudget
          samples={samples}
          target={Number(target)}
          window={30 * DAY}
          formatTime={dateTime}
          label="Checkout availability error budget over a 30-day window, 18 days in"
        />
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------- pages */

function useStable<T>(make: () => T) {
  return useMemo(make, []) // eslint-disable-line react-hooks/exhaustive-deps
}

function SmallForecast() {
  const values = useStable(() => {
    const random = rng(71)
    return Array.from({ length: 48 }, (_, month) => Math.round((120 + month * 4.5) * (1 + 0.25 * Math.sin((month / 12) * 2 * Math.PI)) * (1 + gaussian(random) * 0.03)))
  })
  return (
    <ForecastChart
      values={values}
      period={12}
      horizon={12}
      seasonality="multiplicative"
      confidence={0.95}
      showMetrics={false}
      height={200}
      formatX={(index) => new Date(Date.UTC(2023, index, 1)).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
      label="Monthly bookings for four years with a one-year forecast"
    />
  )
}

export const demos: ExampleModule = {
  'time-series-explorer': {
    description:
      'A long time series you can actually read: a detail view, an overview strip of the whole span with a brush that sets what the detail shows, and zoom, pan and reset. Both views are downsampled with Largest-Triangle-Three-Buckets to one point per pixel column, so 220,000 samples draw as fast as 600 and the spikes survive. The tooltip reads the raw sample nearest the cursor, never the downsampled line.',
    sections: [
      {
        title: 'Twelve days at ten-second resolution',
        description:
          'Drag the brush or its edges in the overview, drag the detail view to pan, and scroll over it to zoom. The presets set the range from outside.',
        bare: true,
        Content: TimeSeriesExample,
        note: (
          <>
            The detail view is one tab stop: Left and Right move the cursor (Shift for bigger steps), plus and minus
            zoom around it, Page Up and Page Down pan, 0 resets. The brush and both of its edges are sliders.{' '}
            {motionNote('the lines appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'Monitoring data is too long to draw point by point and too spiky to average: a naive chart freezes the tab, and a bucketed mean hides the one-minute outage that was the reason for looking.',
        'LTTB keeps the visually important samples per pixel, the overview keeps you oriented while zoomed in, and the raw-point tooltip means every number read off the chart was really recorded.',
        'Latency and error dashboards, IoT and sensor feeds, trading and metrics explorers, anywhere a range needs to be found before it can be read.',
        ['IconButton', 'Button', 'ChartTooltip', 'Legend', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'series', type: 'TimeSeriesExplorerSeries[]', description: 'id, label, x (ascending positions), y and colour. Typed arrays are welcome.' },
      ...CHART_BASE,
      { name: 'range / defaultRange / onRangeChange', type: '[number, number]', defaultValue: '— / everything', description: 'Visible range of the detail view. Controlled or uncontrolled.' },
      { name: 'height', type: 'number', defaultValue: '240', description: 'Detail plot height in pixels.' },
      { name: 'overviewHeight', type: 'number', defaultValue: '56', description: 'Overview strip height in pixels.' },
      { name: 'formatX / formatY', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip formatting.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'true', description: 'Series key when there is more than one series.' },
    ],
  },
  'forecast-chart': {
    description:
      'A forecast with its uncertainty drawn in. Holt–Winters triple exponential smoothing — additive or multiplicative seasonality — is fitted to the history by a grid search and local refinement on squared one-step error, projected ahead with a prediction band from the residual variance, and scored with MAPE both on the fit and on a refit that held back the last horizon.',
    sections: [
      {
        title: 'Daily sign-ups with a weekly cycle',
        description: 'Switch the seasonality to see the fit change, and the interval to see the band widen. Hover or arrow through any day.',
        bare: true,
        Content: ForecastExample,
        note: (
          <>
            {KEYBOARD} The full history and forecast are also in a hidden table.{' '}
            {motionNote('the forecast appears at once instead of drawing out to the right.')}
          </>
        ),
      },
      {
        title: 'Monthly, multiplicative, 95%',
        description: 'Four years of monthly bookings where the summer peak grows with the business.',
        specimens: [{ label: 'period={12} seasonality="multiplicative"', fill: true, node: <SmallForecast /> }],
      },
      rationale(
        'Forecasts on dashboards are usually a straight line or a hand-tuned model, drawn without any sense of how wrong they might be.',
        'Fitted weights, a band that widens with the horizon and a held-out error figure tell the reader how much weight the right-hand side can bear.',
        'Revenue and sign-up planning, capacity and inventory forecasts, support staffing, any weekly or yearly seasonal metric.',
        ['Legend', 'ChartTooltip', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'values', type: 'number[]', description: 'Evenly spaced history, oldest first. At least two full seasons.' },
      { name: 'period', type: 'number', description: 'Season length in steps: 7 for daily data with a weekly cycle, 12 for monthly.' },
      { name: 'horizon', type: 'number', defaultValue: 'period', description: 'Steps to forecast.' },
      { name: 'seasonality', type: "'additive' | 'multiplicative'", defaultValue: "'additive'", description: 'Multiplicative needs positive values and falls back to additive otherwise.' },
      { name: 'params', type: '{ alpha, beta, gamma }', description: 'Fixed smoothing weights. Leave out to fit them.' },
      { name: 'confidence', type: '0.8 | 0.9 | 0.95 | 0.99', defaultValue: '0.8', description: 'Coverage of the prediction band.' },
      ...CHART_BASE,
      { name: 'formatX', type: '(index: number) => string', description: 'Names a step, history or forecast.' },
      { name: 'formatY', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip values.' },
      { name: 'showFitted / showMetrics', type: 'boolean', defaultValue: 'true', description: 'The one-step fitted line, and the weights and error metrics under the chart.' },
      { name: 'onFit', type: '(fit: ForecastChartFit) => void', description: 'Receives the fitted weights, forecast, band and MAPE whenever the model is refitted.' },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Plot height in pixels.' },
    ],
  },
  'control-chart': {
    description:
      'A statistical process control chart for individual measurements (XmR). The centre line and the 1σ, 2σ and 3σ zones come from the average moving range, the five Western Electric and Nelson run rules are tested inside each phase, and every point that breaks one is ringed on the chart and explained in the list below it. Phases recalculate the limits after a deliberate change.',
    sections: [
      {
        title: 'Eight weeks of pick times',
        description:
          'A one-day spike, a six-day drift and a step down after a warehouse re-slotting. Turn on the new phase to judge the new process against its own limits. Choose a signal to ring its points.',
        bare: true,
        Content: ControlExample,
        note: (
          <>
            {KEYBOARD} Each signal in the list is a button that highlights its points.{' '}
            {motionNote('points appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'Teams react to every wiggle in a metric, or to none of them, because nothing on an ordinary line chart separates a signal from routine noise.',
        'Moving-range limits and run rules are the standard, well-tested answer, and naming the rule next to each flagged point turns a red dot into a reason.',
        'Operations and fulfilment metrics, build and deploy durations, support response times, manufacturing and lab measurements.',
        ['ChartTooltip', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'values', type: 'number[]', description: 'Individual measurements in time order.' },
      { name: 'labels', type: 'string[]', description: 'Names each point: a date, a batch.' },
      ...CHART_BASE,
      { name: 'rules', type: 'ControlChartRule[]', defaultValue: 'all five', description: 'beyond-3-sigma, two-of-three-2-sigma, four-of-five-1-sigma, eight-one-side, six-trending.' },
      { name: 'phases', type: 'number[]', defaultValue: '[]', description: 'Indexes where a new phase begins; limits are recalculated from each.' },
      { name: 'showMovingRange', type: 'boolean', defaultValue: 'true', description: 'The moving-range chart under the individuals chart.' },
      { name: 'onViolationsChange', type: '(violations: ControlChartViolation[]) => void', description: 'Called when the set of signals changes.' },
      { name: 'formatY', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis, limit and tooltip values.' },
      { name: 'height', type: 'number', defaultValue: '240', description: 'Individuals chart height in pixels.' },
    ],
  },
  'kaplan-meier-chart': {
    description:
      'Survival curves estimated with Kaplan–Meier: customers still subscribed, patients still well, trials not yet converted. Censored subjects leave the risk set without counting as events and are ticked on their curve, Greenwood confidence bands and an at-risk table show how much data is behind each stretch, a dashed marker shows each median, and a log-rank test says whether the groups really differ.',
    sections: [
      {
        title: 'Retention by plan',
        description: 'Add a third cohort to see the log-rank test move to two degrees of freedom. Hover or arrow through time.',
        bare: true,
        Content: SurvivalExample,
        note: (
          <>
            {KEYBOARD} Every step of every curve, with its interval, is also in a hidden table.{' '}
            {motionNote('curves appear at once instead of drawing from left to right.')}
          </>
        ),
      },
      rationale(
        'Churn is usually reported as an average lifetime of customers who have already left, which ignores everyone still subscribed and flatters whichever plan is newest.',
        'The product-limit estimator uses the customers who have not churned yet, and the bands, ticks and at-risk counts keep the thin tail honest.',
        'Retention and churn analysis, time to conversion or activation, clinical and reliability studies, time to resolve tickets.',
        ['Legend', 'ChartTooltip', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'groups', type: 'KaplanMeierChartGroup[]', description: 'id, label, colour and subjects: { time, event } where event false means censored.' },
      ...CHART_BASE,
      { name: 'confidence', type: '0.9 | 0.95 | 0.99', defaultValue: '0.95', description: 'Coverage of the log(−log) Greenwood band.' },
      { name: 'showConfidence / showCensors / showMedian / showAtRisk', type: 'boolean', defaultValue: 'true', description: 'The band, censor ticks, median markers and the at-risk table.' },
      { name: 'timeLabel', type: 'string', description: 'The time unit, printed under the axis.' },
      { name: 'formatTime', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip times.' },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Plot height in pixels, not counting the at-risk table.' },
    ],
  },
  'trace-waterfall': {
    description:
      'One distributed trace as a waterfall: spans built into a tree from their parent ids, drawn as nested bars on a shared time axis and coloured by service. Each span carries its self time, and the critical path — the chain of work the request actually waited on — is computed backwards from the end of the trace and underlined, span by span. Rows collapse and expand, and selecting one opens its attributes.',
    sections: [
      {
        title: 'A slow checkout',
        description:
          'The payment call failed once and was retried, and a stock update waited on a row lock. Follow the dark underline to see which of them the request actually waited for.',
        bare: true,
        Content: TraceExample,
        note: (
          <>
            The rows are a tree: Up and Down move, Right expands or steps into a span, Left collapses or steps out,
            Home and End jump, Enter or Space opens the details, Escape closes them.{' '}
            {motionNote('bars appear at full length immediately instead of growing from their start.')}
          </>
        ),
      },
      rationale(
        'A trace view that only draws bars answers "what ran" but not "what made it slow": a parent is always as long as its slowest child, and parallel work hides which branch mattered.',
        'Self time and the critical path point at the spans where shaving time would actually shorten the request.',
        'APM and observability tools, request debugging, CI pipeline and build timelines, any nested timing data.',
        ['IconButton', 'Legend', 'Text'],
      ),
    ],
    props: [
      { name: 'spans', type: 'TraceWaterfallSpan[]', description: 'id, parentId, name, service, start (ms), duration (ms), status and attributes.' },
      { name: 'label', type: 'string', description: 'Accessible name for the span tree.' },
      { name: 'selected / defaultSelected / onSelectedChange', type: 'string | null', description: 'The span whose details are open. Controlled or uncontrolled.' },
      { name: 'defaultCollapsed', type: 'string[]', defaultValue: '[]', description: 'Spans whose children start hidden.' },
      { name: 'showCriticalPath', type: 'boolean', defaultValue: 'true', description: 'Underline the critical stretch of each span.' },
      { name: 'formatDuration', type: '(ms: number) => string', description: 'Durations on the axis, bars and details.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'contour-plot': {
    description:
      'Where a cloud of points is dense, drawn as nested bands. A Gaussian kernel density is estimated on a grid with Scott’s bandwidth, marching squares traces isolines at quantiles of the points’ own densities — resolving saddle cells by their centre value — and the closed rings are filled as bands, each named by the share of observations it holds.',
    sections: [
      {
        title: 'Three kinds of session',
        description: 'Narrow the bandwidth to see the clusters separate, widen it to see them merge. Hover anywhere for the region, or tab in and arrow through the bands.',
        bare: true,
        Content: ContourExample,
        note: (
          <>
            {KEYBOARD} {motionNote('bands appear at once instead of fading in from the outside.')}
          </>
        ),
      },
      rationale(
        'Past a few hundred points a scatter plot becomes a blot, and the one thing it was for — where most observations sit — is what overplotting hides.',
        'Density bands named by share ("the densest 50%") answer that directly, and a kernel estimate draws clusters without anyone choosing bins.',
        'Behavioural analytics, A/B metric pairs, geospatial or sensor readings, model embeddings, any large two-measure dataset.',
        ['Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'points', type: 'ContourPlotPoint[]', description: '{ x, y } observations.' },
      ...CHART_BASE,
      { name: 'levels', type: 'number', defaultValue: '5', description: 'Number of density bands.' },
      { name: 'bandwidth', type: 'number', defaultValue: '1', description: 'Multiplier on Scott’s rule.' },
      { name: 'gridSize', type: 'number', defaultValue: '64', description: 'Density grid resolution per axis.' },
      { name: 'showPoints', type: 'boolean', defaultValue: 'true', description: 'Draw the observations over the bands.' },
      { name: 'xLabel / yLabel', type: 'string', description: 'Axis titles.' },
      { name: 'formatX / formatY', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip formatting.' },
      { name: 'height', type: 'number', defaultValue: '300', description: 'Plot height in pixels.' },
    ],
  },
  'violin-plot': {
    description:
      'The shape of a distribution per group: a Gaussian kernel density with Silverman’s bandwidth, mirrored into a violin, with the median drawn solid and the quartiles dashed inside it. An optional slim box and jittered points — kept inside the violin’s width — add the summary and the raw data back, vertically or horizontally.',
    sections: [
      {
        title: 'Time to first value',
        description: 'Self-serve looks ordinary as a box and is plainly two groups as a violin. Toggle the box and points, or lay the chart on its side.',
        bare: true,
        Content: ViolinExample,
        note: (
          <>
            {KEYBOARD} {motionNote('violins appear at full width at once instead of opening from their centre line.')}
          </>
        ),
      },
      rationale(
        'A box plot reduces each group to five numbers, and two groups with the same five numbers can be entirely different shapes.',
        'The density shows a second mode or a long tail at a glance, and keeping the quartiles inside means nothing a box plot says is lost.',
        'Latency by region, onboarding or resolution times by segment, experiment metrics by variant, survey scores by cohort.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'groups', type: 'ViolinPlotGroup[]', description: 'id, label, values and colour.' },
      ...CHART_BASE,
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Horizontal suits long group names.' },
      { name: 'showBox / showPoints', type: 'boolean', defaultValue: 'false', description: 'A slim box plot, and the observations jittered within the violin.' },
      { name: 'bandwidth', type: 'number', defaultValue: '1', description: 'Multiplier on Silverman’s bandwidth.' },
      { name: 'valueLabel', type: 'string', description: 'Title of the value axis.' },
      { name: 'formatValue', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip values.' },
      { name: 'height', type: 'number', defaultValue: '280', description: 'Plot height in pixels.' },
    ],
  },
  'hexbin-chart': {
    description:
      'A scatter plot for when there are too many points to see: the plane is cut into pointy-top hexagons in screen space, each point is assigned by axial coordinates with cube rounding, and each hexagon is coloured by its count on a stepped accent scale. Fifty thousand points are counted in milliseconds; the radius slider is a real resolution control.',
    sections: [
      {
        title: 'Fifty thousand requests',
        description: 'Most requests are small and fast; a slow tail runs up the chart. Change the radius or the colour scale, and hover or arrow through bins.',
        bare: true,
        Content: HexbinExample,
        note: (
          <>
            {KEYBOARD} {motionNote('bins appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'Tens of thousands of points in a scatter plot draw a solid shape and cost seconds to render; transparency just moves the problem around.',
        'Counting into equal-distance hexagons is honest at any size, and only non-empty bins are drawn, so the chart stays fast.',
        'Request and query analysis, geolocation density, telemetry and sensor data, any very large two-measure dataset.',
        ['Slider', 'Legend', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'points', type: 'HexbinChartPoint[]', description: '{ x, y } observations. 50,000 is fine.' },
      ...CHART_BASE,
      { name: 'radius / defaultRadius / onRadiusChange', type: 'number', defaultValue: '— / 10', description: 'Hexagon radius in viewBox pixels. Controlled or uncontrolled.' },
      { name: 'showRadiusControl', type: 'boolean', defaultValue: 'true', description: 'The radius slider above the chart.' },
      { name: 'colorScale', type: "'linear' | 'sqrt' | 'log'", defaultValue: "'sqrt'", description: 'How counts map to colour.' },
      { name: 'steps', type: 'number', defaultValue: '7', description: 'Number of colour steps.' },
      { name: 'xLabel / yLabel', type: 'string', description: 'Axis titles.' },
      { name: 'formatX / formatY', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Axis and tooltip formatting.' },
      { name: 'height', type: 'number', defaultValue: '320', description: 'Plot height in pixels.' },
    ],
  },
  'flame-graph': {
    description:
      'A CPU or allocation profile as a flame graph. Collapsed stack samples ("a;b;c 42") are folded into a tree, each frame as wide as its samples, with self and total time in the tooltip. Click or press Enter to zoom a frame to full width, with a breadcrumb back out; search highlights every matching frame and reports the share of samples they cover; a baseline profile turns it into a differential graph, and it flips to an icicle.',
    sections: [
      {
        title: 'Orders service',
        description:
          'Search for “stringify”, click a frame to zoom, then compare with the previous release to see what grew. Red frames take a bigger share than before, green a smaller one.',
        bare: true,
        Content: FlameExample,
        note: (
          <>
            One tab stop. Left and Right move between frames on a row, Up and Down move toward the leaves or the root
            (in the direction they grow), Enter zooms, Escape zooms back out, Home returns to the zoomed frame.{' '}
            {motionNote('frames appear at once instead of fading in row by row.')}
          </>
        ),
      },
      rationale(
        'Profiles are thousands of stacks, and a table of functions sorted by time cannot show that the slow function is slow because of what it calls.',
        'Width by samples, merged stacks and self time make the expensive path obvious, and a differential view answers the real question after a regression: what changed.',
        'Performance tooling, continuous profiling, APM, build and bundle analysis, anything with hierarchical cost.',
        ['Input', 'SegmentedControl', 'Button', 'ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'profile', type: 'string', description: 'Collapsed stacks, one per line: frame;frame;frame count.' },
      { name: 'baseline', type: 'string', description: 'A profile to compare against. Frames are coloured by the change in their share.' },
      { name: 'label', type: 'string', description: 'Accessible name for the graph.' },
      { name: 'orientation / defaultOrientation / onOrientationChange', type: "'flame' | 'icicle'", defaultValue: "— / 'flame'", description: 'Grow up from the root, or hang down from it.' },
      { name: 'search / defaultSearch / onSearchChange', type: 'string', defaultValue: "— / ''", description: 'Frames whose name contains it are highlighted.' },
      { name: 'showControls', type: 'boolean', defaultValue: 'true', description: 'Search field, orientation switch and zoom breadcrumb.' },
      { name: 'rowHeight', type: 'number', defaultValue: '18', description: 'Frame row height in pixels.' },
      { name: 'unit', type: 'string', defaultValue: "'samples'", description: 'What a sample is called in the tooltip.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
  'error-budget': {
    description:
      'An SLO’s error budget, worked out: the budget in requests for the window, how much is consumed and left, the burn rate, and when it runs out at the current pace. The SRE workbook’s multi-window, multi-burn-rate alert rules are evaluated over the whole series with prefix sums, so each rule gets a lane showing exactly when it would have fired, under a budget burn-down against the ideal line.',
    sections: [
      {
        title: 'Eighteen days into a 30-day window',
        description:
          'A sharp outage on day six fires the paging rules; a slow leak around day thirteen only the ticket rules catch. Change the target to see the same traffic against a looser or stricter SLO.',
        bare: true,
        Content: ErrorBudgetExample,
        note: (
          <>
            {KEYBOARD} {motionNote('the burn-down and alert lanes appear at once instead of drawing from the left.')}
          </>
        ),
      },
      rationale(
        'Error-rate alerts page for every blip and sleep through a slow leak, and “are we within SLO” gets answered by someone doing arithmetic in a spreadsheet.',
        'Burn rate puts fast and slow failures on one scale, and multi-window rules are the proven way to page quickly without flapping.',
        'SRE and platform dashboards, status and reliability reviews, SaaS admin consoles, release gating.',
        ['ChartTooltip', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'samples', type: 'ErrorBudgetSample[]', description: 'Evenly spaced { time, requests, errors } buckets, five minutes or finer.' },
      { name: 'target', type: 'number', description: 'The SLO as a fraction: 0.999 is three nines.' },
      { name: 'window', type: 'number', defaultValue: '30 days', description: 'SLO window length in milliseconds.' },
      { name: 'windowStart', type: 'number', defaultValue: 'first sample', description: 'When the SLO window began.' },
      { name: 'alerts', type: 'ErrorBudgetAlertRule[]', defaultValue: '14.4× 1h/5m, 6× 6h/30m, 3× 1d/2h, 1× 3d/6h', description: 'Multi-window burn-rate rules: longWindow, shortWindow, burnRate, severity.' },
      ...CHART_BASE,
      { name: 'height', type: 'number', defaultValue: '200', description: 'Burn-down plot height in pixels.' },
      { name: 'formatTime', type: '(time: number) => string', description: 'Timestamps in the tooltip and alert list.' },
    ],
  },
}
