import { useEffect, useState, type ReactNode } from 'react'
import {
  Button,
  ChoroplethMap,
  ChordDiagram,
  ClickHeatmap,
  CommitGraph,
  Field,
  ImageDiff,
  ParallelCoordinates,
  PivotTable,
  SegmentedControl,
  SequenceDiagram,
  Slider,
  Text,
  Textarea,
  VennDiagram,
  WordCloud,
  type ChoroplethMapFeature,
  type ChoroplethMapFeatureCollection,
  type ChoroplethMapProjection,
  type ClickHeatmapPoint,
  type CommitGraphCommit,
  type ImageDiffResult,
  type ParallelCoordinatesBrushes,
  type ParallelCoordinatesRecord,
  type PivotTableConfig,
  type PivotTableRecord,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ shared */

/** Seeded PRNG so every demo draws the same data on every visit. */
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

const CHART_BASE = [
  { name: 'label', type: 'string', description: 'Accessible name. Say what the chart shows, not what it is called.' },
  { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
]

function Readout({ children }: { children: ReactNode }) {
  return (
    <Text size="caption" tone="faint">
      {children}
    </Text>
  )
}

/* ------------------------------------------------------------------ chord */

const TEAMS = ['Design', 'Product', 'Engineering', 'QA', 'Support']
const HANDOFFS = [
  [4, 22, 38, 3, 6],
  [18, 6, 52, 9, 14],
  [26, 20, 12, 61, 8],
  [2, 7, 44, 3, 5],
  [5, 31, 19, 11, 7],
]

const PLANS = ['Free', 'Starter', 'Pro', 'Enterprise']
const PLAN_MOVES = [
  [0, 410, 120, 6],
  [35, 0, 260, 18],
  [8, 64, 0, 71],
  [0, 2, 12, 0],
]

/* --------------------------------------------------------------- sequence */

const LOGIN_FLOW = `# Sign in with SSO
participant Browser
participant App as Web app
participant IdP as Identity provider
participant API

Browser->+App: GET /dashboard
App-->Browser: 302 to IdP, with state
Browser->+IdP: Authorize request
note over IdP: User signs in, MFA if required
IdP-->-Browser: 302 back with code
Browser->App: GET /callback?code
App->+IdP: Exchange code for tokens
IdP-->-App: ID token + refresh token
alt token is valid
  App->+API: Fetch workspace
  API-->-App: Workspace JSON
  App-->Browser: Dashboard
else signature fails
  App-->Browser: 401, sign in again
end
loop every 50 minutes
  App->IdP: Refresh token
end
deactivate App`

const BROKEN_FLOW = `participant Client
Client->Server Place order
Server-->Client: 201 Created
else payment failed
Server->Queue: Enqueue receipt
end`

function SequenceEditor() {
  const [source, setSource] = useState(LOGIN_FLOW)
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Field label="Diagram source" hint="Edit a line to see the diagram and the error list update as you type.">
        <Textarea value={source} onChange={(event) => setSource(event.target.value)} rows={18} spellCheck={false} className="font-mono text-[12px]" />
      </Field>
      <SequenceDiagram source={source} label="Signing in with SSO, from the browser request to the refreshed token" />
    </div>
  )
}

/* -------------------------------------------------------------- parallel */

const LAPTOP_DIMENSIONS = [
  { key: 'price', label: 'Price', format: (v: number) => `$${Math.round(v).toLocaleString()}` },
  { key: 'weight', label: 'Weight', format: (v: number) => `${v.toFixed(1)} kg` },
  { key: 'battery', label: 'Battery', format: (v: number) => `${Math.round(v)} h` },
  { key: 'cpu', label: 'CPU score', format: (v: number) => `${Math.round(v / 100) / 10}k` },
  { key: 'rating', label: 'Rating', domain: [1, 5] as [number, number], format: (v: number) => v.toFixed(1) },
]

const LAPTOP_BRANDS = ['Aster', 'Brio', 'Corvo', 'Dune', 'Eon', 'Fjord', 'Gale', 'Halo']
const LAPTOPS: ParallelCoordinatesRecord[] = (() => {
  const next = seeded(11)
  return Array.from({ length: 42 }, (_, index) => {
    const tier = next()
    const price = 520 + tier * 2600 + next() * 300
    const weight = 2.4 - tier * 1.1 + next() * 0.5
    const battery = 6 + tier * 9 + next() * 5 - (weight < 1.4 ? 2 : 0)
    const cpu = 3200 + tier * 9000 + next() * 2500
    const rating = Math.min(5, 2.6 + tier * 1.6 + (next() - 0.4) * 1.2)
    return {
      id: `laptop-${index}`,
      label: `${LAPTOP_BRANDS[index % LAPTOP_BRANDS.length]} ${13 + (index % 4)}” ${String.fromCharCode(65 + (index % 7))}${index + 1}`,
      values: { price, weight, battery, cpu, rating },
    }
  })
})()

function ParallelExample() {
  const [brushes, setBrushes] = useState<ParallelCoordinatesBrushes>({ battery: [14, 22] })
  const [order, setOrder] = useState(LAPTOP_DIMENSIONS.map((d) => d.key))
  const kept = LAPTOPS.filter((laptop) =>
    Object.entries(brushes).every(([key, [low, high]]) => laptop.values[key] >= low && laptop.values[key] <= high),
  )
  const cheapest = [...kept].sort((a, b) => a.values.price - b.values.price).slice(0, 3)
  return (
    <div className="flex w-full flex-col gap-3">
      <ParallelCoordinates
        dimensions={LAPTOP_DIMENSIONS}
        records={LAPTOPS}
        order={order}
        onOrderChange={setOrder}
        brushes={brushes}
        onBrushesChange={setBrushes}
        noun="laptop"
        label="42 laptops by price, weight, battery life, CPU score and rating"
      />
      <Readout>
        Cheapest that match: {cheapest.length ? cheapest.map((l) => `${l.label} (${LAPTOP_DIMENSIONS[0].format(l.values.price)})`).join(', ') : 'none'}
      </Readout>
    </div>
  )
}

/* ------------------------------------------------------------------ venn */

const PLATFORMS = [
  { id: 'web', label: 'Web', size: 18400 },
  { id: 'ios', label: 'iOS', size: 9100 },
  { id: 'android', label: 'Android', size: 7300 },
]
const PLATFORM_OVERLAPS = [
  { sets: ['web', 'ios'], size: 4200 },
  { sets: ['web', 'android'], size: 3100 },
  { sets: ['ios', 'android'], size: 380 },
  { sets: ['web', 'ios', 'android'], size: 210 },
]

/* ------------------------------------------------------------ word cloud */

const FEEDBACK = [
  ['export', 184], ['dark mode', 142], ['search', 131], ['slow', 118], ['pricing', 96], ['integrations', 92],
  ['mobile app', 88], ['onboarding', 74], ['SSO', 71], ['keyboard shortcuts', 64], ['notifications', 60], ['CSV', 58],
  ['reports', 55], ['permissions', 52], ['offline', 47], ['API limits', 44], ['templates', 41], ['calendar', 38],
  ['filters', 36], ['billing', 34], ['audit log', 31], ['Slack', 30], ['bulk edit', 28], ['comments', 26], ['undo', 24],
  ['tags', 22], ['sharing', 21], ['charts', 19], ['time zones', 18], ['webhooks', 17], ['support', 16], ['emoji', 12],
  ['fonts', 11], ['sounds', 9], ['printing', 8],
].map(([text, weight]) => ({ text: text as string, weight: weight as number }))

function WordCloudExample() {
  const [seed, setSeed] = useState(7)
  const [rotation, setRotation] = useState<'0' | '0.3'>('0')
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          label="Rotation"
          value={rotation}
          onValueChange={setRotation}
          options={[
            { value: '0', label: 'Horizontal' },
            { value: '0.3', label: 'Some vertical' },
          ]}
        />
        <Button size="sm" variant="outline" onClick={() => setSeed((value) => value + 1)}>
          New layout
        </Button>
        <Readout>seed {seed}</Readout>
      </div>
      <WordCloud
        words={FEEDBACK}
        seed={seed}
        rotation={Number(rotation)}
        valueLabel="Mentions"
        label="Themes in 1,900 feature requests from the last quarter; export, dark mode and search lead"
      />
    </div>
  )
}

/* ---------------------------------------------------------- click heatmap */

const PAGE = { width: 1200, height: 760 }
const CLICKS: ClickHeatmapPoint[] = (() => {
  const next = seeded(3)
  const gauss = () => (next() + next() + next() - 1.5) / 1.5
  const cluster = (x: number, y: number, spreadX: number, spreadY: number, count: number) =>
    Array.from({ length: count }, () => ({ x: x + gauss() * spreadX, y: y + gauss() * spreadY }))
  return [
    ...cluster(533, 350, 60, 14, 220), // primary call to action
    ...cluster(705, 350, 45, 12, 60), // secondary
    ...cluster(913, 40, 25, 8, 90), // Pricing in the nav
    ...cluster(1108, 40, 35, 9, 70), // Sign in
    ...cluster(600, 682, 90, 14, 85), // middle plan
    ...cluster(253, 682, 80, 14, 30),
    ...cluster(947, 682, 80, 14, 22),
    ...cluster(600, 255, 220, 20, 40), // people clicking the headline
    ...Array.from({ length: 70 }, () => ({ x: next() * PAGE.width, y: next() * PAGE.height })),
  ]
})()

function MockPage() {
  const bar = 'rounded-full bg-line-strong'
  return (
    <div aria-hidden="true" className="flex size-full flex-col bg-surface text-[0px]">
      <div className="flex h-[10.5%] items-center gap-[2%] border-b border-line px-[4%]">
        <span className="h-[34%] w-[9%] rounded-md bg-ink" />
        <span className="flex-1" />
        {['w-[6%]', 'w-[7%]', 'w-[6%]'].map((w, i) => (
          <span key={i} className={`h-[18%] ${w} ${bar}`} />
        ))}
        <span className="h-[48%] w-[8%] rounded-full border border-line-strong" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-[3%] px-[10%]">
        <span className="h-[6%] w-[62%] rounded-full bg-ink" />
        <span className="h-[3%] w-[44%] rounded-full bg-ink-faint" />
        <div className="mt-[2%] flex w-full justify-center gap-[2%]">
          <span className="h-[34px] w-[20%] max-h-[5vw] rounded-full bg-accent" />
          <span className="h-[34px] w-[12%] max-h-[5vw] rounded-full border border-line-strong" />
        </div>
      </div>
      <div className="grid h-[30%] grid-cols-3 gap-[3%] px-[8%] pb-[4%]">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex flex-col justify-end rounded-lg border p-[6%] ${i === 1 ? 'border-accent-strong' : 'border-line'}`}>
            <span className="h-[14%] w-full rounded-full bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

function HeatmapExample() {
  const [radius, setRadius] = useState(28)
  const [intensity, setIntensity] = useState(1.2)
  return (
    <div className="flex w-full flex-col gap-4">
      <ClickHeatmap
        points={CLICKS}
        width={PAGE.width}
        height={PAGE.height}
        radius={radius}
        intensity={intensity}
        label="Clicks on the pricing landing page, 1–14 September"
      >
        <MockPage />
      </ClickHeatmap>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Radius: ${radius}px`}>
          <Slider min={10} max={70} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
        </Field>
        <Field label={`Intensity: ${intensity.toFixed(1)}×`}>
          <Slider min={5} max={30} value={intensity * 10} onChange={(event) => setIntensity(Number(event.target.value) / 10)} />
        </Field>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ choropleth */

const PROVINCES = [
  'Harrowmere', 'Tollbridge', 'Ashvale', 'Eastreach',
  'Wendover', 'Marrow Downs', 'Kestrel', 'Saltmarsh',
  'Lowfield', 'Brannock', 'Greyhaven', 'Southcape',
]

/** A made-up island of twelve provinces: a jittered 4 × 3 grid, so neighbours share edges, plus one offshore isle. */
const KESTREL_ISLAND: ChoroplethMapFeatureCollection = (() => {
  const next = seeded(29)
  const cols = 4
  const rows = 3
  const vertex: [number, number][][] = []
  for (let r = 0; r <= rows; r += 1) {
    vertex.push([])
    for (let c = 0; c <= cols; c += 1) {
      const edge = r === 0 || r === rows || c === 0 || c === cols
      const lon = 4 + c * 3.2 + (next() - 0.5) * (edge ? 1.6 : 1.4)
      const lat = 58 - r * 2.8 + (next() - 0.5) * (edge ? 1.2 : 1)
      vertex[r].push([Number(lon.toFixed(2)), Number(lat.toFixed(2))])
    }
  }
  const features: ChoroplethMapFeature[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c
      const ring = [vertex[r][c], vertex[r][c + 1], vertex[r + 1][c + 1], vertex[r + 1][c], vertex[r][c]]
      const name = PROVINCES[index]
      if (name === 'Southcape') {
        const isle = [[17.6, 49.9], [19.1, 50.3], [19.4, 49.2], [18.1, 48.9], [17.6, 49.9]]
        features.push({ type: 'Feature', id: name, properties: { name }, geometry: { type: 'MultiPolygon', coordinates: [[ring], [isle]] } })
      } else features.push({ type: 'Feature', id: name, properties: { name }, geometry: { type: 'Polygon', coordinates: [ring] } })
    }
  }
  return { type: 'FeatureCollection', features }
})()

const SIGNUPS: Record<string, number> = {
  Harrowmere: 4.2, Tollbridge: 6.8, Ashvale: 3.1, Eastreach: 9.4, Wendover: 12.6, 'Marrow Downs': 7.3,
  Kestrel: 18.9, Saltmarsh: 5.5, Lowfield: 2.2, Brannock: 8.1, Southcape: 14.7,
}

function ChoroplethExample() {
  const [projection, setProjection] = useState<ChoroplethMapProjection>('mercator')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        size="sm"
        label="Projection"
        value={projection}
        onValueChange={setProjection}
        options={[
          { value: 'mercator', label: 'Mercator' },
          { value: 'equirectangular', label: 'Equirectangular' },
        ]}
      />
      <ChoroplethMap
        data={KESTREL_ISLAND}
        values={SIGNUPS}
        projection={projection}
        valueLabel="Signups per 1,000"
        format={(value) => value.toFixed(1)}
        label="Signups per 1,000 residents by province; Kestrel and Southcape lead, Greyhaven has no data"
      />
    </div>
  )
}

/* ---------------------------------------------------------- commit graph */

const HISTORY: CommitGraphCommit[] = [
  { hash: 'e41c09ab7f', parents: ['9b0d2e4c11'], message: 'WIP: usage alert thresholds', author: 'Priya Natarajan', date: '2h ago', refs: ['feature/usage-alerts'] },
  { hash: '7f3a2c9e0d', parents: ['9b0d2e4c11', 'c8e1f07a33'], message: 'Merge pull request #212 from feature/billing-portal', author: 'Tomás Reyes', date: '5h ago', refs: ['HEAD → main', 'origin/main'] },
  { hash: '9b0d2e4c11', parents: ['5d71aa0e92'], message: 'Bump dependencies', author: 'Renovate', date: 'yesterday' },
  { hash: 'c8e1f07a33', parents: ['a2b94dd510'], message: 'Add invoice download to the billing portal', author: 'Mei Tanaka', date: 'yesterday' },
  { hash: 'a2b94dd510', parents: ['1e6f3b77c4'], message: 'Billing portal: list invoices with status', author: 'Mei Tanaka', date: '2 days ago' },
  { hash: '5d71aa0e92', parents: ['0c4d8e1f5a'], message: 'Release 2.4.0', author: 'Tomás Reyes', date: '3 days ago', tags: ['v2.4.0'] },
  { hash: '1e6f3b77c4', parents: ['0c4d8e1f5a'], message: 'Scaffold the billing portal route', author: 'Mei Tanaka', date: '4 days ago' },
  { hash: '0c4d8e1f5a', parents: ['66a0b3c2e8', 'f9d2c4a716'], message: 'Merge pull request #208 from fix/login-redirect', author: 'Priya Natarajan', date: '5 days ago' },
  { hash: '66a0b3c2e8', parents: ['2d8e5f09b3'], message: 'Update the changelog', author: 'Tomás Reyes', date: '6 days ago' },
  { hash: 'f9d2c4a716', parents: ['2d8e5f09b3'], message: 'Keep the return URL through SSO sign-in', author: 'Jonas Berg', date: '6 days ago', refs: ['origin/fix/login-redirect'] },
  { hash: '2d8e5f09b3', parents: ['b7e3a1c045'], message: 'Add audit log export', author: 'Aisha Khan', date: '1 week ago' },
  { hash: 'b7e3a1c045', parents: ['4a9c7e2d18', '8e2f6b1a90'], message: 'Merge pull request #201 from feature/dark-mode', author: 'Aisha Khan', date: '1 week ago' },
  { hash: '4a9c7e2d18', parents: ['d3b0f58e27'], message: 'Tighten the CSP headers', author: 'Jonas Berg', date: '8 days ago' },
  { hash: '8e2f6b1a90', parents: ['d3b0f58e27'], message: 'Dark mode tokens for every surface', author: 'Mei Tanaka', date: '9 days ago' },
  { hash: 'd3b0f58e27', parents: ['0a1b2c3d4e'], message: 'Release 2.3.0', author: 'Tomás Reyes', date: '2 weeks ago', tags: ['v2.3.0'] },
  { hash: '0a1b2c3d4e', parents: [], message: 'Initial billing module', author: 'Aisha Khan', date: '3 weeks ago' },
]

function CommitExample() {
  const [hash, setHash] = useState<string | null>('7f3a2c9e0d')
  const commit = HISTORY.find((entry) => entry.hash === hash)
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <CommitGraph commits={HISTORY} value={hash} onValueChange={setHash} label="Commits on main and open branches" maxHeight={420} />
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Selected commit
        </Text>
        {commit ? (
          <>
            <Text size="body">{commit.message}</Text>
            <Readout>
              <code className="font-mono text-ink">{commit.hash}</code> · {commit.author} · {String(commit.date)}
            </Readout>
            <Readout>
              {commit.parents.length > 1
                ? `Merge of ${commit.parents.map((p) => p.slice(0, 7)).join(' and ')}`
                : commit.parents.length
                  ? `Parent ${commit.parents[0].slice(0, 7)}`
                  : 'Root commit'}
            </Readout>
          </>
        ) : (
          <Readout>Nothing selected.</Readout>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ pivot */

const DEALS: PivotTableRecord[] = (() => {
  const next = seeded(5)
  const regions = ['Americas', 'EMEA', 'APAC']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const plans = ['Starter', 'Pro', 'Enterprise']
  const channels = ['Self-serve', 'Sales-led']
  return Array.from({ length: 160 }, () => {
    const plan = plans[Math.floor(next() ** 1.4 * plans.length)]
    const channel = plan === 'Enterprise' || next() < 0.2 ? 'Sales-led' : channels[0]
    const seats = Math.round((plan === 'Enterprise' ? 60 : plan === 'Pro' ? 14 : 4) * (0.5 + next() * 1.5))
    const price = plan === 'Enterprise' ? 540 : plan === 'Pro' ? 180 : 60
    return {
      region: regions[Math.floor(next() * regions.length)],
      quarter: quarters[Math.floor(next() * quarters.length)],
      plan,
      channel,
      seats,
      revenue: Math.round(seats * price * (0.8 + next() * 0.3)),
    }
  })
})()

const DIMENSIONS = [
  { key: 'region', label: 'Region' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'plan', label: 'Plan' },
  { key: 'channel', label: 'Channel' },
]
const MEASURES = [
  { key: 'revenue', label: 'Revenue', format: (v: number) => `$${(v / 1000).toFixed(1)}k` },
  { key: 'seats', label: 'Seats', format: (v: number) => Math.round(v).toLocaleString() },
]

function PivotExample() {
  const [config, setConfig] = useState<PivotTableConfig>({
    rows: ['region', 'plan'],
    columns: ['quarter'],
    measure: 'revenue',
    aggregation: 'sum',
    sort: 'desc',
  })
  return (
    <div className="flex w-full flex-col gap-3">
      <PivotTable records={DEALS} dimensions={DIMENSIONS} measures={MEASURES} value={config} onValueChange={setConfig} label="Closed deals, 2026" />
      <Readout>
        <code className="font-mono text-ink">{JSON.stringify(config)}</code>
      </Readout>
    </div>
  )
}

/* ------------------------------------------------------------- image diff */

/** Draws a small settings card on a canvas; `changed` nudges a button, recolours a badge and lengthens a line. */
function drawCard(changed: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 400
  const c = canvas.getContext('2d')
  if (!c) return null
  const round = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    c.beginPath()
    c.roundRect(x, y, w, h, r)
    c.fillStyle = fill
    c.fill()
  }
  c.fillStyle = '#f6f7f4'
  c.fillRect(0, 0, 640, 400)
  round(40, 36, 560, 328, 20, '#ffffff')
  round(72, 72, 48, 48, 14, '#e6fbb0')
  round(140, 78, 190, 14, 7, '#17191c')
  round(140, 102, changed ? 250 : 210, 10, 5, '#a3aa9b')
  round(470, 78, 96, 26, 13, changed ? '#f5a524' : '#c8f24e')
  for (let i = 0; i < 3; i += 1) {
    round(72, 158 + i * 44, 360, 12, 6, '#e3e5e3')
    round(520, 152 + i * 44, 44, 24, 12, i === 1 && changed ? '#e3e5e3' : '#b9e93a')
  }
  round(changed ? 404 : 400, 300, 164, 40, 20, '#17191c')
  round(72, 300, 110, 40, 20, '#f4f5f5')
  return canvas.toDataURL('image/png')
}

function ImageDiffExample() {
  const [images, setImages] = useState<[string, string] | null | 'unsupported'>(null)
  const [threshold, setThreshold] = useState(0.1)
  const [result, setResult] = useState<ImageDiffResult | null>(null)
  useEffect(() => {
    const before = drawCard(false)
    const after = drawCard(true)
    setImages(before && after ? [before, after] : 'unsupported')
  }, [])
  if (images === 'unsupported') return <Readout>This demo draws its two images on a canvas, which this browser does not provide.</Readout>
  if (!images) return <Readout>Drawing the two versions…</Readout>
  return (
    <div className="flex w-full flex-col gap-4">
      <ImageDiff
        before={images[0]}
        after={images[1]}
        beforeLabel="main"
        afterLabel="This branch"
        threshold={threshold}
        onDiff={setResult}
        label="Visual regression check for the notification settings card"
      />
      <Field label={`Threshold: ${threshold.toFixed(2)}`} hint={result ? `${result.changed.toLocaleString()} pixels over the threshold.` : undefined}>
        <Slider min={1} max={50} value={Math.round(threshold * 100)} onChange={(event) => setThreshold(Number(event.target.value) / 100)} />
      </Field>
    </div>
  )
}

/* ------------------------------------------------------------------ demos */

export const demos: ExampleModule = {
  'chord-diagram': {
    description:
      'Flows between a handful of groups in both directions, laid out as a circle: each group is an arc as long as everything it sends, and each ribbon is as wide at either end as what that end sends to the other. The chord layout is computed, not approximated — group angles from row totals, subgroup angles from each cell, quadratic ribbons through the centre — and hovering or arrowing to a group fades every ribbon it is not part of.',
    sections: [
      {
        title: 'Team handoffs',
        description: 'Tickets handed from one team to another last quarter. Hover a team, or tab to the chart and use the arrow keys.',
        bare: true,
        Content: () => <ChordDiagram labels={TEAMS} matrix={HANDOFFS} label="Ticket handoffs between five teams last quarter; Engineering to QA is the largest flow" />,
        note: (
          <>
            One tab stop; arrow keys step through groups and Escape clears. The full matrix is a hidden table.{' '}
            {motionNote('ribbons appear at once instead of fading in.')}
          </>
        ),
      },
      {
        title: 'Plan migrations',
        description: 'Customers moving between plans. A ribbon takes the colour of whichever side sends more, so upgrades and downgrades read apart.',
        specimens: [
          {
            label: 'colors, padAngle={0.06}',
            fill: true,
            node: (
              <ChordDiagram
                labels={PLANS}
                matrix={PLAN_MOVES}
                padAngle={0.06}
                size={360}
                colors={['var(--color-ink-faint)', 'var(--color-success)', 'var(--color-accent-strong)', 'var(--color-ink)']}
                label="Customers moving between plans this year; most movement is Free to Starter"
              />
            ),
          },
        ],
      },
      rationale(
        'A Sankey reads one way, so it cannot show work going from engineering to design and back again, and a matrix of numbers hides which flows dominate.',
        'Arc length and ribbon width carry the totals and the pairs at once; highlighting a group isolates its flows without a second chart.',
        'Team handoffs, plan migrations, traffic between services, trade between regions — five to twelve groups.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'labels', type: 'string[]', description: 'One name per group, in matrix order.' },
      { name: 'matrix', type: 'number[][]', description: 'Square flow matrix; matrix[i][j] is what group i sends to group j.' },
      ...CHART_BASE,
      { name: 'size', type: 'number', defaultValue: '420', description: 'Largest rendered size in pixels.' },
      { name: 'padAngle', type: 'number', defaultValue: '0.045', description: 'Gap between group arcs, in radians.' },
      { name: 'colors', type: 'string[]', defaultValue: 'SERIES_COLORS', description: 'One CSS colour per group.' },
      { name: 'format', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Formats flows in the tooltip and table.' },
    ],
  },

  'sequence-diagram': {
    description:
      'A sequence diagram written as text and drawn as SVG: participants, solid and dashed arrows, notes, alt/opt/loop blocks and activation bars. The parser reports every line it cannot read with its line number while still drawing the rest, and the same events become a numbered list that is the diagram for anyone who cannot see it.',
    sections: [
      {
        title: 'Live editor',
        description: 'Change the source on the left. Tab to the diagram and use the arrow keys to step through its messages.',
        bare: true,
        Content: SequenceEditor,
        note: (
          <>
            Syntax: <code>participant A as Name</code>, <code>A-&gt;B: text</code>, <code>A--&gt;B: reply</code>,{' '}
            <code>A-&gt;+B</code> / <code>B--&gt;-A</code> to activate and deactivate, <code>note over A,B: text</code>,{' '}
            <code>alt</code> / <code>else</code> / <code>opt</code> / <code>loop</code> … <code>end</code>.
          </>
        ),
      },
      {
        title: 'Errors and transcript',
        stack: true,
        specimens: [
          {
            label: 'Syntax errors are listed with line numbers',
            fill: true,
            node: <SequenceDiagram source={BROKEN_FLOW} label="Order placement, with three syntax errors" />,
          },
          {
            label: 'showTranscript',
            fill: true,
            node: (
              <SequenceDiagram
                showTranscript
                source={'participant Job as Nightly job\nparticipant S3\nJob->S3: List new exports\nS3-->Job: 14 objects\nJob->Job: Compress\nnote right of Job: Skips files under 1 KB\nJob->S3: Upload archive'}
                label="Nightly export archiving"
              />
            ),
          },
        ],
      },
      rationale(
        'Sequence diagrams drawn in a design tool go stale the first time the flow changes, and nobody reviews a PNG in a pull request.',
        'Text lives beside the code and changes with it; the parser is strict enough to point at the broken line and forgiving enough to keep drawing.',
        'Architecture docs, API guides, incident write-ups, onboarding pages.',
        ['VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'source', type: 'string', description: 'The diagram text, one statement per line. # starts a comment.' },
      { name: 'label', type: 'string', description: 'Accessible name for the diagram.' },
      { name: 'showTranscript', type: 'boolean', defaultValue: 'false', description: 'Print the numbered text version visibly as well.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'parallel-coordinates': {
    description:
      'Many measures at once: one vertical axis per measure and one line per record. Drag along any axis to brush a range; brushes on several axes combine, lines outside them fade, and the count of what is left updates. Axes reorder by dragging their header or with the arrow keys on it, because only neighbouring axes show a correlation.',
    sections: [
      {
        title: 'Choosing a laptop',
        description: 'Battery is already brushed to 14–22 hours. Drag on another axis to narrow it further, or click an axis without dragging to clear it.',
        bare: true,
        Content: ParallelExample,
        note: (
          <>
            On an axis header: Left and Right move the axis, Up and Down move its brush, Shift resizes, Escape clears. The
            chart is one tab stop that steps through the selected lines. {motionNote('lines appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'Five measures across forty options is a table nobody can read and five scatter plots nobody can join up.',
        'Brushing turns the chart into a filter you can see: the lines that survive every range are the answer, and their shape shows the trade-offs.',
        'Comparing plans, instances, candidates or products on several numeric criteria; exploring experiment results.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'dimensions', type: 'ParallelCoordinatesDimension[]', description: 'One axis each: key, label, optional domain and format.' },
      { name: 'records', type: 'ParallelCoordinatesRecord[]', description: 'One line each: id, label, values by dimension key, optional colour.' },
      ...CHART_BASE,
      { name: 'height', type: 'number', defaultValue: '300', description: 'Plot height in pixels.' },
      { name: 'order / defaultOrder / onOrderChange', type: 'string[]', description: 'Axis order, left to right. Controlled or uncontrolled.' },
      { name: 'brushes / defaultBrushes / onBrushesChange', type: 'Record<string, [number, number]>', description: 'Kept range per axis. Controlled or uncontrolled.' },
      { name: 'noun', type: 'string', defaultValue: "'record'", description: 'What a line is called in the selected count.' },
    ],
  },

  'venn-diagram': {
    description:
      'Two or three sets and their overlaps, with areas that mean something: each circle’s area is its set’s size, and each pair sits exactly as far apart as it takes for the lens between them to have the overlap’s area — found numerically, since the lens-area formula has no inverse. Every region is labelled with its exclusive count at the point furthest from any edge, and highlights on hover or arrow key.',
    sections: [
      {
        title: 'Where people use the product',
        description: 'Monthly active users by platform. Hover a region or tab to the chart and use the arrow keys.',
        bare: true,
        Content: () => (
          <VennDiagram sets={PLATFORMS} intersections={PLATFORM_OVERLAPS} label="Monthly active users on web, iOS and Android; few people use both mobile apps" />
        ),
        note: (
          <>
            With three sets the pairwise overlaps are exact and the centre region is as close as circles allow; the
            printed counts are always exact. {motionNote('circles appear at full size instead of growing in.')}
          </>
        ),
      },
      {
        title: 'Two sets',
        specimens: [
          {
            label: 'sets={2}',
            fill: true,
            node: (
              <VennDiagram
                height={240}
                sets={[
                  { id: 'news', label: 'Newsletter', size: 12800 },
                  { id: 'paid', label: 'Paying', size: 3400, color: 'var(--color-success)' },
                ]}
                intersections={[{ sets: ['news', 'paid'], size: 2100 }]}
                label="Newsletter subscribers and paying customers; most paying customers read the newsletter"
              />
            ),
          },
        ],
      },
      rationale(
        'Most Venn diagrams are equal circles with numbers typed in, which says less than the numbers alone.',
        'Proportional circles let the eye compare sets and overlaps before reading a single figure; the counts are there to confirm.',
        'Audience overlap, feature adoption across platforms, users in several segments.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'sets', type: 'VennDiagramSet[]', description: 'Two or three sets: id, label, size, optional colour.' },
      { name: 'intersections', type: 'VennDiagramIntersection[]', description: 'Inclusive overlap sizes by set ids. A missing pair means no overlap.' },
      ...CHART_BASE,
      { name: 'height', type: 'number', defaultValue: '300', description: 'Plot height in pixels.' },
      { name: 'format', type: '(value: number) => string', defaultValue: 'formatTick', description: 'Formats counts.' },
    ],
  },

  'word-cloud': {
    description:
      'Words sized by weight and packed without overlapping: each word walks out along an Archimedean spiral until its box collides with nothing, and a word that finds no room is left out and said so. Font size follows the square root of weight so area tracks it, and a seed makes the layout repeatable. The list beneath, ordered by weight, is the accessible and the precise version.',
    sections: [
      {
        title: 'Feature request themes',
        description: 'Change the rotation or ask for a new layout. The same seed always gives the same cloud.',
        bare: true,
        Content: WordCloudExample,
        note: (
          <>
            One tab stop; arrow keys step through words by weight. {motionNote('words appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'A list of themes with counts is precise but flat; the few that matter do not stand out from the long tail.',
        'Size carries emphasis at a glance, and the ordered list keeps the exact numbers one step away.',
        'Feedback themes, search terms, tags, survey free text — as a summary next to the table, not instead of it.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'words', type: 'WordCloudWord[]', description: 'Text and weight per word.' },
      ...CHART_BASE,
      { name: 'height', type: 'number', defaultValue: '320', description: 'Plot height in pixels.' },
      { name: 'fontSize', type: '[number, number]', defaultValue: '[12, 52]', description: 'Smallest and largest font size.' },
      { name: 'rotation', type: 'number', defaultValue: '0', description: 'Share of words turned 90°, from 0 to 1.' },
      { name: 'seed', type: 'number', defaultValue: '7', description: 'Same seed, same layout.' },
      { name: 'maxWords', type: 'number', defaultValue: '80', description: 'Draw at most this many words, heaviest first.' },
      { name: 'format / valueLabel', type: 'function / string', description: 'How weights are printed and what they measure.' },
    ],
  },

  'click-heatmap': {
    description:
      'Where people click, as heat over what they clicked on. Each click adds a Gaussian kernel to an intensity buffer; the buffer is normalised to its peak and mapped through a ramp built from the status tokens, then drawn on a canvas, so the heat follows the theme. The dots can be switched back on, and the hottest spots are named in words with their share of clicks.',
    sections: [
      {
        title: 'Pricing landing page',
        description: 'About 690 clicks over a wireframe of the page. Change the kernel radius and intensity, or show each click.',
        bare: true,
        Content: HeatmapExample,
        note: <>The canvas is decorative; the hotspot list below it is the accessible summary, and the frame is one tab stop that steps through the hotspots.</>,
      },
      rationale(
        'Past a few hundred clicks, dots pile into one blot and the busiest button looks no busier than a quiet one.',
        'Summed kernels show density, not just presence, and the named hotspots say what the picture says.',
        'Landing pages, onboarding screens, dashboards — anywhere you record click coordinates.',
        ['Switch', 'ChartTooltip'],
      ),
    ],
    props: [
      { name: 'points', type: 'ClickHeatmapPoint[]', description: 'Clicks as x, y and optional weight, in the coordinate space below.' },
      { name: 'width / height', type: 'number', description: 'The coordinate space the clicks were recorded in; sets the aspect ratio.' },
      { name: 'children', type: 'ReactNode', description: 'What was clicked on, drawn beneath the heat.' },
      ...CHART_BASE,
      { name: 'radius', type: 'number', defaultValue: '36', description: 'Kernel standard deviation, in coordinate units.' },
      { name: 'intensity', type: 'number', defaultValue: '1', description: 'Multiplies the heat before colouring.' },
      { name: 'showPoints / defaultShowPoints / onShowPointsChange', type: 'boolean', defaultValue: 'false', description: 'Draw each click as a dot.' },
      { name: 'hotspots', type: 'number', defaultValue: '3', description: 'How many hotspots to name.' },
    ],
  },

  'choropleth-map': {
    description:
      'Regions shaded by a value, straight from GeoJSON. The projection — Mercator or equirectangular — is implemented here and fitted to the viewport from the data’s own bounds, so no map library or tile server is involved. Values fall into a few equal steps with a legend, and arrow keys move to the nearest region in that direction.',
    sections: [
      {
        title: 'Signups by province',
        description: 'A made-up island of twelve provinces, one with an offshore isle and one with no data. Switch the projection to see the fit change.',
        bare: true,
        Content: ChoroplethExample,
        note: (
          <>
            One tab stop; arrow keys move between neighbouring regions, Home and End to the first and last, Escape clears.
            Every value is in a hidden table. {motionNote('regions appear at once instead of fading in.')}
          </>
        ),
      },
      rationale(
        'A table of regions hides geography: neighbouring provinces that behave alike, or one that is out of line with its neighbours.',
        'Stepped shades match to a legend at a glance, and the map fits whatever GeoJSON it is given — a country, a city, a warehouse floor.',
        'Sales territories, regional adoption, incidents by data centre region, anything keyed by area.',
        ['ChartTooltip', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'data', type: 'ChoroplethMapFeatureCollection', description: 'GeoJSON FeatureCollection of Polygons and MultiPolygons.' },
      { name: 'values', type: 'Record<string, number>', description: 'Value per feature key. Missing keys are shown as no data.' },
      ...CHART_BASE,
      { name: 'featureKey / featureName', type: '(feature) => string', description: 'How to key and name a feature. Defaults to id and properties.name.' },
      { name: 'projection', type: "'mercator' | 'equirectangular'", defaultValue: "'mercator'", description: 'How longitude and latitude map to the plane.' },
      { name: 'steps', type: 'number', defaultValue: '5', description: 'Colour steps between the lowest and highest value.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Plot height in pixels.' },
      { name: 'format / valueLabel', type: 'function / string', description: 'How values are printed and what they measure.' },
    ],
  },

  'commit-graph': {
    description:
      'Git history as lanes beside the commits they explain. Lanes are assigned from parent hashes alone, the way git log --graph does, so merges curve back into their branch, branch tips open new lanes, and each branch keeps its colour down the page. Refs and tags sit on the commit they point at, and the list is a listbox you move through with the arrow keys.',
    sections: [
      {
        title: 'A week on main',
        description: 'Two merged branches, a release tag and an open feature branch. Click a commit or tab in and use Up and Down.',
        bare: true,
        Content: CommitExample,
        note: <>One tab stop; Up, Down, Home, End and the Page keys move the selection. Merge commits are hollow and announced as merges.</>,
      },
      rationale(
        'A flat list of commits hides which work arrived on which branch and where it merged — exactly what a reviewer or release manager needs.',
        'Lanes computed from parents work on any history without layout hints; the graph sits beside readable rows instead of replacing them.',
        'Repository browsers, deploy pickers, release notes tooling, audit views of configuration history.',
        ['Badge'],
      ),
    ],
    props: [
      { name: 'commits', type: 'CommitGraphCommit[]', description: 'Newest first, children before parents: hash, parents, message, author, date, refs, tags.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list.' },
      { name: 'value / defaultValue / onValueChange', type: 'string | null', description: 'Selected hash. Controlled or uncontrolled.' },
      { name: 'maxHeight', type: 'number', defaultValue: '440', description: 'Height of the scrolling list.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'pivot-table': {
    description:
      'Raw records turned into a cross-tab the reader configures: row fields, column fields, the value and how to aggregate it — sum, count, average, minimum or maximum. Every record is folded into every row-prefix and column-prefix bucket, so subtotals and grand totals are real aggregates of the records rather than sums of cells, and an average stays an average.',
    sections: [
      {
        title: 'Closed deals',
        description: '160 deals. Change the rows, columns, value, aggregation or sort; the configuration below is the controlled value.',
        bare: true,
        Content: PivotExample,
      },
      {
        title: 'Fixed pivot, no pickers',
        specimens: [
          {
            label: 'showConfig={false}',
            fill: true,
            node: (
              <PivotTable
                records={DEALS}
                dimensions={DIMENSIONS}
                measures={MEASURES}
                showConfig={false}
                defaultValue={{ rows: ['plan'], columns: ['channel', 'region'], measure: 'seats', aggregation: 'avg' }}
                label="Average seats per deal by plan, channel and region"
              />
            ),
          },
        ],
      },
      rationale(
        'Exports to a spreadsheet mostly exist so someone can build a pivot by hand, and the numbers are stale the moment they do.',
        'Pivoting in place answers “revenue by region by quarter” on the page, with totals that are computed from records and headers screen readers can follow.',
        'Sales and finance reporting, usage breakdowns, support metrics — any flat dataset with a few categorical fields.',
        ['Select', 'Field'],
      ),
    ],
    props: [
      { name: 'records', type: 'PivotTableRecord[]', description: 'Flat records.' },
      { name: 'dimensions', type: 'PivotTableField[]', description: 'Fields that can become rows or columns.' },
      { name: 'measures', type: 'PivotTableMeasure[]', description: 'Numeric fields that can be aggregated, with optional format.' },
      { name: 'label', type: 'string', description: 'Accessible name and caption.' },
      { name: 'value / defaultValue / onValueChange', type: 'PivotTableConfig', description: 'rows, columns, measure, aggregation, sort. Controlled or uncontrolled.' },
      { name: 'showConfig', type: 'boolean', defaultValue: 'true', description: 'Show the pickers above the table.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'image-diff': {
    description:
      'Two versions of an image compared pixel by pixel. Both are read into canvases, every pixel pair is measured with the YIQ perceptual distance pixelmatch uses, and pixels over the threshold are painted in the danger colour on a faded copy, with the share changed stated as a number. Four views — side by side, diff, onion skin and blink — each catch something the others miss.',
    sections: [
      {
        title: 'Visual regression check',
        description: 'Both images are drawn on a canvas in the page. The branch moved a button 4px, recoloured a badge, turned off a toggle and lengthened a line.',
        bare: true,
        Content: ImageDiffExample,
        note: (
          <>
            Blink stops by itself after ten seconds and has a pause control.{' '}
            {motionNote('blink never flips on its own; the button switches images by hand.')}
          </>
        ),
      },
      rationale(
        'Eyeballing two screenshots misses a 4px shift, and a naive byte comparison flags every re-encode as a change.',
        'A perceptual distance with a threshold ignores noise and catches real changes, and the percentage makes the result checkable.',
        'Visual regression review, design QA, before-and-after of image processing, screenshot history.',
        ['SegmentedControl', 'Slider', 'Button'],
      ),
    ],
    props: [
      { name: 'before / after', type: 'string', description: 'Image URLs. Cross-origin images need CORS for their pixels to be readable.' },
      { name: 'label', type: 'string', description: 'Accessible name for the comparison.' },
      { name: 'threshold', type: 'number', defaultValue: '0.1', description: 'From 0 to 1; how different two pixels must be to count as changed.' },
      { name: 'mode / defaultMode / onModeChange', type: "'side-by-side' | 'diff' | 'onion' | 'blink'", defaultValue: "'diff'", description: 'The view. Controlled or uncontrolled.' },
      { name: 'beforeLabel / afterLabel', type: 'string', defaultValue: "'Before' / 'After'", description: 'Names for the two versions.' },
      { name: 'onDiff', type: '(result: ImageDiffResult) => void', description: 'Called with changed, total and percent once compared.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
}
