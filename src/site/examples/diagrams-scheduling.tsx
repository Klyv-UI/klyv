import { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Dendrogram,
  Field,
  FlowDiagram,
  MindMap,
  RankedChoiceResults,
  ResourceScheduler,
  SegmentedControl,
  SlaTimer,
  Slider,
  SnapGuides,
  StrokeGestures,
  Textarea,
  TournamentBracket,
  TransformBox,
  mindMapToOutline,
  parseRankedBallots,
  type DendrogramDistance,
  type DendrogramLinkage,
  type FlowDiagramDirection,
  type FlowDiagramRouting,
  type MindMapNode,
  type ResourceSchedulerBooking,
  type ResourceSchedulerConflicts,
  type SlaTimerCalendar,
  type SlaTimerPause,
  type SnapGuidesItem,
  type StrokeGesturesResult,
  type TournamentBracketFormat,
  type TournamentBracketResults,
  type TransformBoxValue,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

/* ------------------------------------------------------------ FlowDiagram */

const CHECKOUT_FLOW = `# Order flow, with a retry loop
cart[Cart] -> checkout[Checkout] -> pay[Payment]
pay -> fraud[Fraud check] -> confirm[Order confirmed]
pay -> declined[Card declined]: declined
declined -> checkout: retry
fraud -> review[Manual review]: flagged
review -> confirm
review -> refund[Refund]
confirm -> pick[Pick and pack] -> ship[Shipped] -> delivered[Delivered]
cart -> abandoned[Abandoned cart]: idle 24h
abandoned -> email[Reminder email] -> checkout`

const PIPELINE = {
  nodes: [
    { id: 'push', label: 'Push to main' },
    { id: 'lint', label: 'Lint' },
    { id: 'types', label: 'Type check' },
    { id: 'unit', label: 'Unit tests' },
    { id: 'build', label: 'Build' },
    { id: 'e2e', label: 'End-to-end' },
    { id: 'stage', label: 'Deploy staging' },
    { id: 'prod', label: 'Deploy production' },
  ],
  edges: [
    { from: 'push', to: 'lint' },
    { from: 'push', to: 'types' },
    { from: 'push', to: 'unit' },
    { from: 'lint', to: 'build' },
    { from: 'types', to: 'build' },
    { from: 'unit', to: 'build' },
    { from: 'build', to: 'e2e' },
    { from: 'build', to: 'stage' },
    { from: 'e2e', to: 'prod', label: 'green' },
    { from: 'stage', to: 'prod' },
  ],
}

function FlowExample() {
  const [source, setSource] = useState(CHECKOUT_FLOW)
  const [direction, setDirection] = useState<FlowDiagramDirection>('TB')
  const [routing, setRouting] = useState<FlowDiagramRouting>('orthogonal')
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Field label="Flow source" hint="One chain per line: a -> b -> c. id[Label] names a node, : text labels the last edge.">
          <Textarea rows={12} value={source} onChange={(event) => setSource(event.target.value)} className="font-mono text-[11px]" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            size="sm"
            label="Direction"
            value={direction}
            onValueChange={setDirection}
            options={[
              { value: 'TB', label: 'Top down' },
              { value: 'LR', label: 'Left to right' },
            ]}
          />
          <SegmentedControl
            size="sm"
            label="Edge routing"
            value={routing}
            onValueChange={setRouting}
            options={[
              { value: 'orthogonal', label: 'Elbows' },
              { value: 'spline', label: 'Curves' },
            ]}
          />
        </div>
        <p className="text-[12px] font-medium text-ink-soft">Selected: {selected ?? 'nothing yet — click a step or press Enter on it'}</p>
      </div>
      <FlowDiagram label="Order fulfilment flow" source={source} direction={direction} routing={routing} onNodeSelect={setSelected} height={460} />
    </div>
  )
}

/* ------------------------------------------------------------- Dendrogram */

const FEATURES = ['Seats', 'Projects', 'API calls', 'Exports', 'Logins', 'Integrations']
const ACCOUNTS = [
  'Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Wingtip', 'Litware', 'Proseware', 'Adatum',
  'Woodgrove', 'Lucerne', 'Humongous', 'Alpine', 'Coho', 'Fourth Coffee',
]
// Three behaviours: API-heavy integrators, seat-heavy collaborators, light users.
const PROFILES = [
  [20, 12, 95, 20, 30, 90],
  [85, 70, 15, 60, 90, 25],
  [8, 6, 5, 10, 15, 5],
]
const USAGE = ACCOUNTS.map((_, i) =>
  PROFILES[[0, 1, 2, 1, 0, 2, 1, 0, 2, 1, 1, 0, 2, 0][i]].map((value, c) => Math.max(0, value + (((i * 7 + c * 13) % 11) - 5) * 2.2)),
)

function DendrogramExample() {
  const [linkage, setLinkage] = useState<DendrogramLinkage>('average')
  const [distance, setDistance] = useState<DendrogramDistance>('euclidean')
  const [cut, setCut] = useState(60)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <SegmentedControl
          size="sm"
          label="Linkage"
          value={linkage}
          onValueChange={setLinkage}
          options={[
            { value: 'single', label: 'Single' },
            { value: 'complete', label: 'Complete' },
            { value: 'average', label: 'Average' },
          ]}
        />
        <SegmentedControl
          size="sm"
          label="Distance"
          value={distance}
          onValueChange={(next) => {
            setDistance(next)
            setCut(next === 'correlation' ? 0.6 : 60)
          }}
          options={[
            { value: 'euclidean', label: 'Euclidean' },
            { value: 'correlation', label: 'Correlation' },
          ]}
        />
      </div>
      <Dendrogram
        label="Accounts clustered by product usage"
        labels={ACCOUNTS}
        values={USAGE}
        columns={FEATURES}
        linkage={linkage}
        distance={distance}
        cut={cut}
        onCutChange={setCut}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- MindMap */

const LAUNCH_MAP: MindMapNode = {
  id: 'root',
  label: 'Q4 launch',
  children: [
    { id: 'audience', label: 'Audience', children: [{ id: 'a1', label: 'Existing teams' }, { id: 'a2', label: 'Agencies' }] },
    {
      id: 'channels',
      label: 'Channels',
      children: [{ id: 'c1', label: 'Newsletter' }, { id: 'c2', label: 'Webinar' }, { id: 'c3', label: 'Partner posts' }],
    },
    { id: 'pricing', label: 'Pricing', children: [{ id: 'p1', label: 'Annual discount' }, { id: 'p2', label: 'Seat bundles' }] },
    { id: 'risks', label: 'Risks', children: [{ id: 'r1', label: 'SSO not ready' }, { id: 'r2', label: 'Support load' }] },
    { id: 'metrics', label: 'Success metrics', collapsed: true, children: [{ id: 'm1', label: 'Trials started' }, { id: 'm2', label: 'Paid conversion' }] },
  ],
}

function MindMapExample() {
  const [tree, setTree] = useState(LAUNCH_MAP)
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <MindMap label="Q4 launch plan" value={tree} onValueChange={setTree} height={400} />
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold text-ink">Outline export</span>
        <pre className="max-h-[360px] overflow-auto rounded-[var(--radius-tile)] bg-surface-muted p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {mindMapToOutline(tree)}
        </pre>
        <Button size="sm" variant="outline" className="self-start" onClick={() => setTree(LAUNCH_MAP)}>
          Reset map
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------- ResourceScheduler */

const DAY = new Date(2026, 8, 18)
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute)
const ROOMS = [
  { id: 'atlas', label: 'Atlas', detail: '12 seats · screen' },
  { id: 'birch', label: 'Birch', detail: '6 seats' },
  { id: 'cedar', label: 'Cedar', detail: '4 seats · phone booth' },
  { id: 'delta', label: 'Delta', detail: '20 seats · stage' },
  { id: 'elm', label: 'Elm', detail: '8 seats · whiteboard' },
]
const ROOM_BOOKINGS: ResourceSchedulerBooking[] = [
  { id: 'b1', resourceId: 'atlas', title: 'Design review', start: at(18, 9, 30), end: at(18, 11) },
  { id: 'b2', resourceId: 'atlas', title: 'Board prep', start: at(18, 14), end: at(18, 15, 30) },
  { id: 'b3', resourceId: 'birch', title: '1:1 Priya', start: at(18, 10), end: at(18, 10, 30) },
  { id: 'b4', resourceId: 'cedar', title: 'Customer call', start: at(18, 11), end: at(18, 12) },
  { id: 'b5', resourceId: 'delta', title: 'All hands', start: at(18, 16), end: at(18, 17) },
  { id: 'b6', resourceId: 'elm', title: 'Sprint planning', start: at(18, 13), end: at(18, 14, 30) },
  { id: 'b7', resourceId: 'birch', title: 'Interview', start: at(16, 15), end: at(16, 16) },
  { id: 'b8', resourceId: 'delta', title: 'Workshop', start: at(15, 9), end: at(15, 12) },
]

function SchedulerExample() {
  const [bookings, setBookings] = useState(ROOM_BOOKINGS)
  const [conflicts, setConflicts] = useState<ResourceSchedulerConflicts>('refuse')
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          size="sm"
          label="On overlap"
          value={conflicts}
          onValueChange={setConflicts}
          options={[
            { value: 'refuse', label: 'Refuse overlaps' },
            { value: 'flag', label: 'Allow and flag' },
          ]}
        />
        <span className="text-[12px] font-medium text-ink-soft">{bookings.length} bookings</span>
      </div>
      <ResourceScheduler
        label="Meeting rooms"
        resources={ROOMS}
        bookings={bookings}
        onBookingsChange={setBookings}
        date={DAY}
        now={at(18, 11, 20)}
        conflicts={conflicts}
        snapMinutes={15}
      />
    </div>
  )
}

/* ----------------------------------------------------- TournamentBracket */

const TEAMS = [
  'Harbour FC', 'Rovers', 'Kestrels', 'Ironbridge', 'Millstone', 'Quayside',
  'Old Mill', 'Thornbury', 'Westgate', 'Larkspur', 'Foxhall', 'Brookside',
]
const DOUBLE_TEAMS = TEAMS.slice(0, 8)
const SINGLE_RESULTS: TournamentBracketResults = {
  'W0-1': { top: 2, bottom: 1, entrants: ['Thornbury', 'Westgate'] },
  'W0-3': { top: 0, bottom: 3, entrants: ['Millstone', 'Brookside'] },
  'W0-5': { top: 1, bottom: 2, entrants: ['Old Mill', 'Larkspur'] },
  'W1-0': { top: 3, bottom: 1, entrants: ['Harbour FC', 'Thornbury'] },
}

function BracketExample() {
  const [format, setFormat] = useState<TournamentBracketFormat>('single')
  const [results, setResults] = useState<TournamentBracketResults>(SINGLE_RESULTS)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          label="Format"
          value={format}
          onValueChange={(next) => {
            setFormat(next)
            setResults(next === 'single' ? SINGLE_RESULTS : {})
          }}
          options={[
            { value: 'single', label: 'Single elimination · 12' },
            { value: 'double', label: 'Double elimination · 8' },
          ]}
        />
        <Button size="sm" variant="ghost" onClick={() => setResults({})}>
          Clear scores
        </Button>
      </div>
      <TournamentBracket
        label={format === 'single' ? 'Summer cup bracket' : 'Club league playoffs'}
        entrants={format === 'single' ? TEAMS : DOUBLE_TEAMS}
        format={format}
        results={results}
        onResultsChange={setResults}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- SlaTimer */

const LONDON: SlaTimerCalendar = {
  timeZone: 'Europe/London',
  hours: { 1: [['09:00', '17:00']], 2: [['09:00', '17:00']], 3: [['09:00', '17:00']], 4: [['09:00', '17:00']], 5: [['09:00', '17:00']] },
  holidays: ['2026-12-25', '2026-12-28'],
}
const NEW_YORK: SlaTimerCalendar = {
  timeZone: 'America/New_York',
  hours: { 1: [['08:00', '12:00'], ['13:00', '18:00']], 2: [['08:00', '12:00'], ['13:00', '18:00']], 3: [['08:00', '12:00'], ['13:00', '18:00']], 4: [['08:00', '12:00'], ['13:00', '18:00']], 5: [['08:00', '12:00'], ['13:00', '18:00']] },
}
// Friday 23 October 2026, 15:00 in London. British Summer Time ends that Sunday.
const OPENED = new Date(Date.UTC(2026, 9, 23, 14, 0))
const WAITING: SlaTimerPause[] = [
  { start: new Date(Date.UTC(2026, 9, 26, 10, 0)), end: new Date(Date.UTC(2026, 9, 26, 11, 30)), reason: 'waiting on customer' },
]

function SlaExample() {
  const [minutes, setMinutes] = useState(60)
  const now = new Date(OPENED.getTime() + minutes * 60_000)
  const shown = new Intl.DateTimeFormat(undefined, { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(now)
  return (
    <div className="flex w-full flex-col gap-4">
      <Field label={`Simulated time: ${shown} London`} hint="Drag across the weekend and the clock change; business time only moves 09:00–17:00 on weekdays.">
        <Slider min={0} max={96 * 60} step={15} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <SlaTimer label="First response · 4 business hours" start={OPENED} targetMinutes={240} calendar={LONDON} now={now} />
        <SlaTimer label="Resolution · 8 business hours, paused while waiting" start={OPENED} targetMinutes={480} calendar={LONDON} pauses={WAITING} now={now} />
      </div>
    </div>
  )
}

const NY_NOW = new Date(Date.UTC(2026, 8, 17, 19, 45))

/* ------------------------------------------------------------ TransformBox */

function TransformExample() {
  const [box, setBox] = useState<TransformBoxValue>({ x: 170, y: 70, width: 180, height: 130, rotation: -8 })
  const [lock, setLock] = useState(false)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative h-[340px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-muted bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:20px_20px]">
        <TransformBox label="Sticker" value={box} onValueChange={setBox} lockAspectRatio={lock} minWidth={40} minHeight={30}>
          <div className="flex size-full flex-col items-center justify-center rounded-[var(--radius-tile)] bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-accent-ink">
            <span className="text-[18px] font-extrabold tracking-tight">Launch day</span>
            <span className="text-[11px] font-semibold opacity-80">Sept 30</span>
          </div>
        </TransformBox>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
          <Checkbox checked={lock} onChange={(event) => setLock(event.target.checked)} />
          Always keep aspect ratio
        </label>
        <code className="font-mono text-[11px] text-ink-soft">
          x {box.x} · y {box.y} · {box.width}×{box.height} · {box.rotation}°
        </code>
        <Button size="sm" variant="ghost" onClick={() => setBox({ x: 170, y: 70, width: 180, height: 130, rotation: 0 })}>
          Reset
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- SnapGuides */

const LAYOUT: SnapGuidesItem[] = [
  { id: 'nav', label: 'Navigation', x: 24, y: 20, width: 592, height: 40 },
  { id: 'a', label: 'Plan A', x: 24, y: 96, width: 150, height: 110 },
  { id: 'b', label: 'Plan B', x: 198, y: 96, width: 150, height: 110 },
  { id: 'c', label: 'Plan C', x: 402, y: 150, width: 150, height: 110 },
  { id: 'cta', label: 'Call to action', x: 220, y: 300, width: 200, height: 48 },
]

function SnapExample() {
  const [items, setItems] = useState(LAYOUT)
  return (
    <div className="flex w-full flex-col gap-3">
      <SnapGuides label="Pricing page layout" items={items} onItemsChange={setItems} width={640} height={380} />
      <Button size="sm" variant="outline" className="self-start" onClick={() => setItems(LAYOUT)}>
        Reset layout
      </Button>
    </div>
  )
}

/* --------------------------------------------------------- StrokeGestures */

const ACTIONS = {
  check: 'Mark done',
  x: 'Delete',
  circle: 'Select all',
  caret: 'Move up',
  v: 'Move down',
  arrow: 'Send forward',
  rectangle: 'Frame selection',
  triangle: 'Start timer',
  'zig-zag': 'Undo',
}

function GestureExample() {
  const [log, setLog] = useState<string[]>([])
  const onGesture = (result: StrokeGesturesResult | null) =>
    setLog((current) => [result ? `${result.action ?? result.name} (${Math.round(result.score * 100)}%)` : 'Not recognised', ...current].slice(0, 5))
  return (
    <div className="flex w-full flex-col gap-3">
      <StrokeGestures label="Task list gestures" actions={ACTIONS} onGesture={onGesture} />
      <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-ink-soft">
        <span className="font-semibold text-ink">Last actions:</span>
        {log.length ? log.map((entry, i) => <span key={`${entry}-${i}`}>{entry}</span>) : <span>none yet</span>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------- RankedChoiceResults */

const NAMES = ['Harbor', 'Lumen', 'Quill', 'Beacon', 'Fern']
const BALLOT_TEXT = `# Product naming vote — count: ranking
38: Lumen > Beacon > Harbor
29: Harbor > Quill > Lumen
15: Beacon > Lumen
6: Beacon
17: Quill > Harbor > Fern
9: Fern > Quill
6: Fern > Beacon > Lumen
4: Quill`

function RankedExample() {
  const [text, setText] = useState(BALLOT_TEXT)
  const ballots = useMemo(() => parseRankedBallots(text), [text])
  return (
    <div className="grid w-full gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Field label="Ballots" hint="One line per ballot group: 12: A > B > C">
        <Textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} className="font-mono text-[11px]" />
      </Field>
      <RankedChoiceResults label="Which name for the new product?" candidates={NAMES} ballots={ballots} />
    </div>
  )
}

/* ------------------------------------------------------------------ pages */

export const demos: ExampleModule = {
  'flow-diagram': {
    description:
      'A directed graph laid out automatically with the Sugiyama method: cycles are broken by reversing DFS back edges, steps are ranked by longest path, long edges get dummy nodes so they bend around boxes, and barycentre sweeps reorder each rank to cut crossings. Write the flow as text or pass nodes and edges; it pans, zooms, fits, and can be walked edge by edge from the keyboard.',
    sections: [
      {
        title: 'Order flow from text',
        description: 'Edit the source; the layout follows. The retry loop is drawn dashed, against the grain.',
        bare: true,
        Content: FlowExample,
        note: 'The diagram is one tab stop. Down follows an edge, Up goes back, Left and Right walk the rank, Enter selects, + and − zoom, 0 fits. Ctrl or ⌘ with the wheel zooms; drag the background to pan.',
      },
      {
        title: 'Data, left to right, curved',
        specimens: [
          {
            label: 'CI pipeline',
            fill: true,
            node: <FlowDiagram label="CI pipeline" nodes={PIPELINE.nodes} edges={PIPELINE.edges} direction="LR" routing="spline" height={300} />,
          },
        ],
      },
      rationale(
        'Process diagrams drawn by hand go stale the first time a step is added, because rearranging the boxes is more work than the change.',
        'A layered layout is the one people read without instruction — flow in one direction, few crossings — and computing it means the text stays the source of truth.',
        'Order and approval flows, CI pipelines, onboarding funnels, state machines, runbooks.',
        ['IconButton', 'VisuallyHidden', 'PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'source', type: 'string', description: 'Text syntax: `a -> b -> c`, `id[Label]`, `: edge label` after the last node, `#` comments.' },
      { name: 'nodes / edges', type: 'FlowDiagramNode[] / FlowDiagramEdge[]', description: 'The graph as data, used when there is no source. Unknown ids in edges become nodes.' },
      { name: 'label', type: 'string', description: 'Accessible name for the diagram.' },
      { name: 'direction', type: "'TB' | 'LR'", defaultValue: "'TB'", description: 'Direction of flow.' },
      { name: 'routing', type: "'orthogonal' | 'spline'", defaultValue: "'orthogonal'", description: 'Right-angled elbows or smooth curves.' },
      { name: 'onNodeSelect', type: '(id: string) => void', description: 'Called on click or Enter.' },
      { name: 'height', type: 'number', defaultValue: '420', description: 'Viewport height; the diagram is fitted inside it.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  dendrogram: {
    description:
      'Agglomerative hierarchical clustering drawn as a tree. Rows are joined closest-first under single, complete or average linkage, with Euclidean or correlation distance, and a cut line you drag (or move with the arrow keys) decides the groups and colours them. The matrix beside it is reordered by leaf order, so the blocks the tree finds are visible in the data.',
    sections: [
      {
        title: 'Accounts by usage',
        description: 'Drag the red cut line across the tree. Switch linkage and distance to see how the grouping changes.',
        bare: true,
        Content: DendrogramExample,
        note: 'The cut handle is a slider: arrows move it by small steps, Page Up and Page Down by larger ones, and it announces the cluster count. The clusters are also listed for assistive tech.',
      },
      rationale(
        'Choosing k before seeing the data is guesswork, and a scatter plot cannot show fourteen dimensions at once.',
        'The tree shows every possible grouping at once; the long branches are the natural gaps, and the cut makes choosing one a visible, reversible decision.',
        'Customer segmentation, gene or metric correlation, survey responses, feature usage audits.',
        ['VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'labels', type: 'string[]', description: 'One label per row of values.' },
      { name: 'values', type: 'number[][]', description: 'The matrix to cluster, one row per item.' },
      { name: 'columns', type: 'string[]', description: 'Column names; when given, the heatmap is drawn.' },
      { name: 'label', type: 'string', description: 'Accessible name.' },
      { name: 'linkage', type: "'single' | 'complete' | 'average'", defaultValue: "'average'", description: 'Cluster-to-cluster distance.' },
      { name: 'distance', type: "'euclidean' | 'correlation'", defaultValue: "'euclidean'", description: 'Row-to-row distance. Correlation groups by shape, not size.' },
      { name: 'cut / defaultCut / onCutChange', type: 'number', defaultValue: '— / 60% of the tallest merge', description: 'Cut height. Controlled or uncontrolled.' },
      { name: 'showHeatmap', type: 'boolean', defaultValue: 'true', description: 'Draw the reordered matrix beside the tree.' },
      { name: 'rowHeight', type: 'number', defaultValue: '18', description: 'Height of each leaf row in pixels.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'mind-map': {
    description:
      'A two-sided mind map you build from the keyboard. First-level branches are balanced between left and right, each side is laid out as a tidy tree, and every edit is one key away: Tab adds a child, Enter a sibling, typing renames, Delete removes, Space folds, and the arrows move to whatever is in that direction on screen. The value is a plain tree, and it exports as an indented outline.',
    sections: [
      {
        title: 'Launch planning',
        description: 'Click a node, then use the keys. The outline on the right updates as you go.',
        bare: true,
        Content: MindMapExample,
        note: 'Tab adds a child, so Shift+Tab — or Escape and then Tab — leaves the map. Nodes are a tree with levels, positions and expanded states announced; drag the background to pan and Fit to recentre.',
      },
      rationale(
        'Brainstorming tools that need the mouse for every new idea slow down exactly when ideas are coming fastest.',
        'Keyboard-first authoring with spatial arrows matches how a map is read, and a plain tree value means it saves, diffs and exports like any other data.',
        'Planning sessions, product discovery, study notes, meeting capture, information architecture.',
        ['PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'MindMapNode', description: 'The tree: id, label, children, collapsed and an optional side for first-level branches.' },
      { name: 'label', type: 'string', description: 'Accessible name for the map.' },
      { name: 'placeholder', type: 'string', defaultValue: "'New idea'", description: 'Text given to a new node before it is named.' },
      { name: 'readOnly', type: 'boolean', defaultValue: 'false', description: 'Navigate and fold without editing.' },
      { name: 'height', type: 'number', defaultValue: '420', description: 'Canvas height in pixels.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'resource-scheduler': {
    description:
      'A booking grid of resources against time. Drag empty space to book, drag a booking to move it — to another row too — and drag its edges to resize; everything snaps to the interval. Overlaps on one resource are refused with a reason, or allowed and flagged. Day and week zoom, a now line, and the whole thing works from the keyboard.',
    sections: [
      {
        title: 'Meeting rooms',
        description: 'Try dragging Design review onto Board prep with overlaps refused, then allowed.',
        bare: true,
        Content: SchedulerExample,
        note: 'The grid is one tab stop with a cursor: arrows move it and Enter books an hour. Each booking is a button: arrows move it by the snap interval or to another room, Shift+Left and Right resize it, Delete removes it, Escape returns to the grid.',
      },
      rationale(
        'Rooms, people and equipment get double-booked when the calendar cannot see across resources, and a list of bookings hides the gaps.',
        'Rows per resource make free time visible, and snapping plus conflict rules stop the errors at the moment they are made instead of on the day.',
        'Meeting rooms, desks, shift rotas, clinic appointments, rental equipment, studio time.',
        ['SegmentedControl', 'PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'resources', type: 'ResourceSchedulerResource[]', description: 'id, label and an optional detail line. One row each.' },
      { name: 'bookings / defaultBookings / onBookingsChange', type: 'ResourceSchedulerBooking[]', description: 'id, resourceId, start, end and title. Controlled or uncontrolled.' },
      { name: 'date', type: 'Date', description: 'The day shown, or any day in the week shown.' },
      { name: 'zoom / defaultZoom / onZoomChange', type: "'day' | 'week'", defaultValue: "— / 'day'", description: 'Controlled or uncontrolled.' },
      { name: 'dayStartHour / dayEndHour', type: 'number', defaultValue: '8 / 18', description: 'Bookable hours each day.' },
      { name: 'snapMinutes', type: 'number', defaultValue: '15', description: 'Interval every start and end lands on (at least 30 in week view).' },
      { name: 'conflicts', type: "'refuse' | 'flag'", defaultValue: "'refuse'", description: 'Refuse overlaps on one resource, or allow and mark them.' },
      { name: 'now', type: 'Date', defaultValue: 'the current time', description: 'Where the now line is drawn.' },
      { name: 'newBookingTitle', type: 'string', defaultValue: "'New booking'", description: 'Title for bookings made by drag or Enter.' },
      { name: 'label', type: 'string', description: 'Accessible name for the schedule.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'tournament-bracket': {
    description:
      'A knockout bracket generated from a seeded list. Byes go to the top seeds by standard seeding (1 v 16, 8 v 9 …), and entering a score advances the winner on its own. Double elimination drops each loser into a losers’ bracket and adds a grand-final reset if the losers’ champion wins. Change an early score and everything after it is recomputed.',
    sections: [
      {
        title: 'Cup and playoffs',
        description: 'Enter scores; winners move on. Twelve entrants means four byes for the top seeds.',
        bare: true,
        Content: BracketExample,
        note: 'Matches are one tab stop: Up and Down move within a round, Right follows the winner, Left goes back to where they came from. Tab reaches each score field.',
      },
      rationale(
        'Brackets maintained by hand drift from the results — the wrong team in a semifinal, a bye in the wrong place.',
        'Making the bracket a function of seeds and scores means it cannot disagree with a result, and scores for pairings that no longer happen are ignored rather than carried over.',
        'Office leagues, esports events, hackathon judging, sales competitions, school sports days.',
        ['PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'entrants', type: 'string[]', description: 'Names in seed order; the first is the top seed.' },
      { name: 'format', type: "'single' | 'double'", defaultValue: "'single'", description: 'Single or double elimination.' },
      { name: 'results / defaultResults / onResultsChange', type: 'TournamentBracketResults', description: 'Scores by match id, each recording the two entrants it was for.' },
      { name: 'label', type: 'string', description: 'Accessible name for the bracket.' },
      { name: 'readOnly', type: 'boolean', defaultValue: 'false', description: 'Show results without score inputs.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'sla-timer': {
    description:
      'A countdown to a service-level target that counts business time only: working hours per weekday in an IANA time zone, minus holidays, minus pauses such as waiting on the customer. Offsets come from Intl, so a clock change neither adds nor loses an hour. It warns, then breaches, and when the clock is stopped it says why and when it restarts. The arithmetic is exported as addBusinessTime and businessTimeBetween.',
    sections: [
      {
        title: 'A ticket over a weekend and a clock change',
        description: 'Opened on a Friday afternoon in London, the weekend British Summer Time ends.',
        bare: true,
        Content: SlaExample,
      },
      {
        title: 'States',
        specimens: [
          {
            label: 'Running, split shift',
            node: <SlaTimer label="First response · 2h" start={new Date(Date.UTC(2026, 8, 17, 18, 30))} targetMinutes={120} calendar={NEW_YORK} now={NY_NOW} />,
          },
          {
            label: 'At risk',
            node: <SlaTimer label="First response · 1h" start={new Date(Date.UTC(2026, 8, 17, 19, 0))} targetMinutes={60} calendar={NEW_YORK} now={NY_NOW} />,
          },
          {
            label: 'Breached',
            node: <SlaTimer label="Resolution · 4h" start={new Date(Date.UTC(2026, 8, 17, 13, 0))} targetMinutes={240} calendar={NEW_YORK} now={NY_NOW} />,
          },
          {
            label: 'Paused by the team',
            node: (
              <SlaTimer
                label="Resolution · 8h"
                start={new Date(Date.UTC(2026, 8, 17, 14, 0))}
                targetMinutes={480}
                calendar={NEW_YORK}
                pauses={[{ start: new Date(Date.UTC(2026, 8, 17, 19, 0)), reason: 'waiting on customer' }]}
                now={NY_NOW}
              />
            ),
          },
        ],
      },
      rationale(
        'Wall-clock SLA timers say a ticket opened at 17:55 on Friday breached by Monday, so teams learn to ignore them.',
        'Counting only the hours the team works, in the zone they work in, makes the countdown something to act on — and saying why it is paused stops the “is it broken?” question.',
        'Support desks, incident response, approval queues, legal and procurement turnaround.',
        ['StatusPill (internal)'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'What the target is for.' },
      { name: 'start', type: 'Date', description: 'When the clock started.' },
      { name: 'targetMinutes', type: 'number', description: 'Target in business minutes.' },
      { name: 'calendar', type: 'SlaTimerCalendar', description: 'timeZone (IANA), hours per weekday as HH:MM spans, holidays as YYYY-MM-DD.' },
      { name: 'pauses', type: 'SlaTimerPause[]', description: 'Spans that do not count; leave end out while a pause is running.' },
      { name: 'now', type: 'Date', defaultValue: 'ticks every second', description: 'The current time.' },
      { name: 'warnAt', type: 'number', defaultValue: '0.25', description: 'Warn when this share of the target or less remains.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'transform-box': {
    description:
      'A move, resize and rotate frame around any content. Resizing happens in the box’s own rotated frame with the opposite corner or edge held fixed, so a rotated box resizes the way it does in design tools rather than sliding. Shift keeps the aspect ratio and snaps rotation to 15°, Alt resizes from the centre, and the keyboard can do all of it.',
    sections: [
      {
        title: 'Sticker on a canvas',
        description: 'Drag the body to move, the eight handles to resize and the round handle to rotate. Rotate it first, then resize from a corner.',
        bare: true,
        Content: TransformExample,
        note: 'The frame is one tab stop. Arrows move it (Shift for 10px), Alt+arrows resize it, Ctrl+Left/Right or [ and ] rotate it (Shift for 15°).',
      },
      rationale(
        'Editors that resize rotated objects in screen space make the unheld corner drift, which is why people stop rotating things.',
        'Doing the maths in local space with a fixed anchor is the behaviour designers already expect from their tools, and a plain controlled value makes it easy to persist.',
        'Image and sticker editors, slide and page builders, whiteboards, label and certificate designers.',
        ['PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'TransformBoxValue', description: '{ x, y, width, height, rotation } in the parent’s pixels and degrees.' },
      { name: 'label', type: 'string', description: 'What is being transformed, for the accessible name.' },
      { name: 'children', type: 'ReactNode', description: 'Content, stretched to the frame.' },
      { name: 'minWidth / minHeight', type: 'number', defaultValue: '24 / 24', description: 'Smallest size a resize can reach.' },
      { name: 'lockAspectRatio', type: 'boolean', defaultValue: 'false', description: 'Always keep the ratio, as if Shift were held.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Hide the handles and ignore input.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'snap-guides': {
    description:
      'A canvas of boxes that line up while you drag them: guides for shared edges and centres (and the canvas centre), measured gaps to the nearest neighbours, and equal-spacing marks when a gap repeats one already in the row — which it also snaps to. Hold Alt to place freely.',
    sections: [
      {
        title: 'Pricing page layout',
        description: 'Drag Plan C level with the others; it snaps to their top edge and to the same gap.',
        bare: true,
        Content: SnapExample,
        note: 'Each box is a button. Arrow keys nudge by 1px (Shift for 10) and the guides show what it lines up with at its new position.',
      },
      rationale(
        'Aligning by eye is slow and never quite right, and a fixed grid forces every layout onto one pitch.',
        'Snapping to what is already on the canvas gives alignment for free while keeping the layout’s own rhythm, and equal-spacing detection handles the case people fiddle with most.',
        'Page and email builders, dashboard layout editors, slide tools, diagram and form designers.',
        ['PlotAnnouncer (internal)'],
      ),
    ],
    props: [
      { name: 'items / defaultItems / onItemsChange', type: 'SnapGuidesItem[]', description: 'id, label, x, y, width, height. Controlled or uncontrolled.' },
      { name: 'label', type: 'string', description: 'Accessible name for the canvas.' },
      { name: 'width / height', type: 'number', defaultValue: '640 / 380', description: 'Canvas size in pixels.' },
      { name: 'threshold', type: 'number', defaultValue: '6', description: 'Distance in pixels at which an edge snaps.' },
      { name: 'snapToContainer', type: 'boolean', defaultValue: 'true', description: 'Also snap to the canvas edges and centre.' },
      { name: 'renderItem', type: '(item, dragging) => ReactNode', description: 'Draws an item. Defaults to a labelled card.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'stroke-gestures': {
    description:
      'A pad that reads single-stroke gestures with the $1 Unistroke recogniser — resample to 64 points, rotate to the indicative angle, scale to a square, centre, then golden-section search for the best angle against each template. It shows what it saw and the score, runs the mapped action, and learns a new gesture from one drawing. Every gesture is also a button, so the pad is a shortcut, not the only way in.',
    sections: [
      {
        title: 'Task list shortcuts',
        description: 'Draw a check, an x, a circle or a zig-zag. Then teach it a gesture of your own.',
        bare: true,
        Content: GestureExample,
        note: 'The dot marks where a stroke starts; direction matters to $1, which is why the circle and rectangle are included both ways round. Strokes that score under the threshold are reported as not recognised.',
      },
      rationale(
        'Gesture shortcuts are fast with a pen or trackpad, but most implementations are fragile and invisible to anyone who cannot draw them.',
        '$1 needs a single example per gesture, tolerates size and position, and runs on every stroke without a worker; listing the gestures as buttons keeps them available to everyone.',
        'Whiteboards and drawing tools, handwriting-first note apps, kiosk and tablet interfaces, games.',
        ['Button', 'Input'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name for the pad.' },
      { name: 'templates', type: 'StrokeGesturesTemplate[]', defaultValue: 'STROKE_GESTURES_TEMPLATES', description: 'The gestures it knows, as name and points.' },
      { name: 'customTemplates / defaultCustomTemplates / onCustomTemplatesChange', type: 'StrokeGesturesTemplate[]', description: 'User-trained gestures, added to templates.' },
      { name: 'actions', type: 'Record<string, string>', description: 'Gesture name to action label.' },
      { name: 'onGesture', type: '(result | null) => void', description: 'Called after each stroke or gesture button with name, score and action.' },
      { name: 'threshold', type: 'number', defaultValue: '0.78', description: 'Lowest score accepted as a match.' },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Pad height in pixels.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },

  'ranked-choice-results': {
    description:
      'Instant-runoff results counted in the open. First preferences are tallied, the last-placed candidate is eliminated with a documented backwards tie-break, their ballots transfer to the next continuing preference, and it repeats until someone holds a majority of the ballots still in play. Step through each round, see where the eliminated candidate’s ballots went, and check the whole count in the table.',
    sections: [
      {
        title: 'Naming vote',
        description: 'Edit or paste ballots; the count reruns as you type.',
        bare: true,
        Content: RankedExample,
        note: 'Ties for last place go to whoever had fewer votes in the most recent earlier round where they differed; if they were level throughout, the one listed later goes. Exhausted ballots are counted in every round and are not part of the majority.',
      },
      rationale(
        'Ranked voting is often distrusted because the count is a black box — people see a winner, not how they won.',
        'Showing every round, every transfer and every tie-break lets anyone verify the result by hand from the table.',
        'Team polls, board and committee elections, awards, community and open-source governance votes.',
        ['SegmentedControl'],
      ),
    ],
    props: [
      { name: 'candidates', type: 'string[]', description: 'Everyone standing, in ballot order (used by the tie-break).' },
      { name: 'ballots', type: 'RankedChoiceResultsBallot[]', description: 'ranking in order of preference and an optional count.' },
      { name: 'label', type: 'string', description: 'Heading and accessible name.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
    ],
  },
}
