import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  CallGrid,
  Field,
  Input,
  Joystick,
  NodeEditor,
  PictureInPicture,
  RemoteSelections,
  ScrollSequence,
  SegmentedControl,
  ShaderCanvas,
  Slider,
  SortableTree,
  Surface,
  Switch,
  Text,
  VoronoiField,
  Whiteboard,
  type CallGridParticipant,
  type JoystickMode,
  type JoystickVector,
  type NodeEditorGraph,
  type RemoteSelectionsPeer,
  type ScrollSequenceDrawFrame,
  type SortableTreeItem,
  type WhiteboardExportFormat,
  type WhiteboardShape,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/** Resolve a design token to a colour a canvas accepts. */
function token(name: string) {
  if (typeof document === 'undefined') return 'gray'
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour || 'gray'
}

/* ------------------------------------------------------------------ NodeEditor */

const PIPELINE: NodeEditorGraph = {
  nodes: [
    { id: 'load', title: 'Load image', x: 30, y: 40, inputs: [], outputs: [{ id: 'image', label: 'Image', type: 'image' }, { id: 'size', label: 'Width', type: 'number' }] },
    { id: 'resize', title: 'Resize', x: 290, y: 20, inputs: [{ id: 'image', label: 'Image', type: 'image' }, { id: 'width', label: 'Width', type: 'number' }], outputs: [{ id: 'image', label: 'Image', type: 'image' }] },
    { id: 'blur', title: 'Blur', x: 290, y: 190, inputs: [{ id: 'image', label: 'Image', type: 'image' }, { id: 'radius', label: 'Radius', type: 'number' }], outputs: [{ id: 'image', label: 'Image', type: 'image' }] },
    { id: 'radius', title: 'Number', x: 30, y: 230, inputs: [], outputs: [{ id: 'value', label: 'Value', type: 'number' }] },
    { id: 'caption', title: 'Caption', x: 30, y: 350, inputs: [], outputs: [{ id: 'text', label: 'Text', type: 'text' }] },
    { id: 'export', title: 'Export JPEG', x: 560, y: 110, inputs: [{ id: 'image', label: 'Image', type: 'image' }, { id: 'alt', label: 'Alt text', type: 'text' }, { id: 'quality', label: 'Quality', type: 'number' }], outputs: [] },
  ],
  wires: [
    { id: 'w1', from: { node: 'load', port: 'image' }, to: { node: 'resize', port: 'image' } },
    { id: 'w2', from: { node: 'load', port: 'size' }, to: { node: 'resize', port: 'width' } },
    { id: 'w3', from: { node: 'resize', port: 'image' }, to: { node: 'blur', port: 'image' } },
    { id: 'w4', from: { node: 'blur', port: 'image' }, to: { node: 'export', port: 'image' } },
  ],
}

/** Kahn’s algorithm — the order a runner would evaluate the graph in. */
function evaluationOrder(graph: NodeEditorGraph) {
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]))
  for (const wire of graph.wires) incoming.set(wire.to.node, (incoming.get(wire.to.node) ?? 0) + 1)
  const queue = graph.nodes.filter((node) => !incoming.get(node.id)).map((node) => node.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const wire of graph.wires) {
      if (wire.from.node !== id) continue
      incoming.set(wire.to.node, incoming.get(wire.to.node)! - 1)
      if (incoming.get(wire.to.node) === 0) queue.push(wire.to.node)
    }
  }
  return order.map((id) => graph.nodes.find((node) => node.id === id)!.title)
}

function NodeEditorExample() {
  const [graph, setGraph] = useState(PIPELINE)
  const [loops, setLoops] = useState(false)
  const addNode = () => {
    const count = graph.nodes.filter((node) => node.title.startsWith('Sharpen')).length
    setGraph({
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: `sharpen-${Date.now()}`,
          title: count ? `Sharpen ${count + 1}` : 'Sharpen',
          x: 560,
          y: 300 + count * 30,
          inputs: [{ id: 'image', label: 'Image', type: 'image' }],
          outputs: [{ id: 'image', label: 'Image', type: 'image' }],
        },
      ],
    })
  }
  const order = evaluationOrder(graph)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={addNode}>
          Add a Sharpen node
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setGraph(PIPELINE)}>
          Reset
        </Button>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={loops} onChange={(event) => setLoops(event.target.checked)} />
          Allow loops
        </label>
      </div>
      <NodeEditor label="Image export pipeline" value={graph} onValueChange={setGraph} allowCycles={loops} wheelZoom={false} className="h-[440px]" />
      <Text size="caption" tone="faint">
        {order.length === graph.nodes.length ? `Runs in order: ${order.join(' → ')}` : 'The graph has a loop, so there is no order to run it in.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ Whiteboard */

const SKETCH: WhiteboardShape[] = [
  { id: 's1', kind: 'rect', x: 40, y: 50, width: 150, height: 80 },
  { id: 's2', kind: 'text', x: 62, y: 76, width: 110, height: 28, text: 'Sign-up form' },
  { id: 's3', kind: 'arrow', x: 196, y: 90, width: 110, height: 0 },
  { id: 's4', kind: 'ellipse', x: 314, y: 48, width: 150, height: 86 },
  { id: 's5', kind: 'text', x: 340, y: 77, width: 110, height: 28, text: 'Verify email' },
  { id: 's6', kind: 'pen', x: 330, y: 170, width: 130, height: 40, points: [[0, 0.8], [0.12, 0.2], [0.25, 0.9], [0.4, 0.1], [0.55, 0.85], [0.7, 0.3], [0.85, 0.7], [1, 0.4]] },
]

function WhiteboardExample() {
  const [shapes, setShapes] = useState(SKETCH)
  const [exported, setExported] = useState<{ format: WhiteboardExportFormat; content: string } | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <Whiteboard label="Onboarding flow sketch" value={shapes} onValueChange={setShapes} onExport={(format, content) => setExported({ format, content })} className="h-[420px]" />
      {exported && (
        <Surface variant="tile" padding="md" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Text size="label" weight="semibold">
              Exported {exported.format.toUpperCase()}
            </Text>
            <Button size="sm" variant="ghost" onClick={() => setExported(null)}>
              Close
            </Button>
          </div>
          {exported.format === 'svg' ? (
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(exported.content)}`}
              alt="The drawing, exported as a standalone SVG"
              className="max-h-[220px] w-full rounded-[var(--radius-field)] bg-surface-sunken object-contain p-2"
            />
          ) : (
            <pre tabIndex={0} role="region" aria-label="Exported shapes as JSON" className="max-h-[220px] overflow-auto rounded-[var(--radius-field)] bg-surface-sunken p-3 font-mono text-[11px] text-ink-soft">
              {exported.content}
            </pre>
          )}
        </Surface>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Joystick */

function JoystickExample() {
  const [mode, setMode] = useState<JoystickMode>('analog')
  const [vector, setVector] = useState<JoystickVector>({ x: 0, y: 0, magnitude: 0, angle: null, direction: null })
  const [position, setPosition] = useState({ x: 50, y: 50 })

  // The stick reports every frame while held; the demo integrates that into a position, as a game loop would.
  const onMove = (next: JoystickVector) => {
    setVector(next)
    if (next.magnitude === 0) return
    setPosition((current) => ({
      x: Math.min(96, Math.max(4, current.x + next.x * 0.9)),
      y: Math.min(94, Math.max(6, current.y - next.y * 0.9)),
    }))
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Mode"
        size="sm"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'analog', label: 'Analogue' },
          { value: 'dpad8', label: '8-way' },
          { value: 'dpad4', label: '4-way' },
        ]}
      />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-[200px] w-full flex-1 overflow-hidden rounded-[var(--radius-card)] border border-line bg-app" aria-hidden="true">
          <div className="absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:24px_24px]" />
          <span
            className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-ink bg-accent shadow-[var(--shadow-float)]"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          />
        </div>
        <Joystick label="Move the marker" mode={mode} continuous onMove={onMove} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['x', vector.x.toFixed(2)],
          ['y', vector.y.toFixed(2)],
          ['angle', vector.angle === null ? '—' : `${Math.round(vector.angle)}°`],
          ['direction', vector.direction ?? 'centred'],
        ].map(([name, reading]) => (
          <Surface key={name} variant="sunken" padding="sm" className="flex flex-col">
            <Text size="caption" tone="faint">
              {name}
            </Text>
            <Text size="label" weight="semibold" tabular>
              {reading}
            </Text>
          </Surface>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ SortableTree */

const DOCS_TREE: SortableTreeItem[] = [
  {
    id: 'start',
    label: 'Getting started',
    children: [
      { id: 'install', label: 'Installation' },
      { id: 'theming', label: 'Theming' },
    ],
  },
  {
    id: 'guides',
    label: 'Guides',
    children: [
      { id: 'forms', label: 'Building forms' },
      { id: 'tables', label: 'Data tables', children: [{ id: 'sorting', label: 'Sorting' }, { id: 'paging', label: 'Pagination' }] },
      { id: 'a11y', label: 'Accessibility' },
    ],
  },
  { id: 'api', label: 'API reference', collapsed: true, children: [{ id: 'hooks', label: 'Hooks' }, { id: 'utils', label: 'Utilities' }] },
  { id: 'changelog', label: 'Changelog' },
]

const outline = (items: SortableTreeItem[], depth = 0): string[] =>
  items.flatMap((item) => [`${'  '.repeat(depth)}${item.label}`, ...outline(item.children ?? [], depth + 1)])

function SortableTreeExample() {
  const [tree, setTree] = useState(DOCS_TREE)
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
      <SortableTree label="Documentation navigation" value={tree} onValueChange={setTree} />
      <Surface variant="sunken" padding="md" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Saved outline
          </Text>
          <Button size="sm" variant="ghost" onClick={() => setTree(DOCS_TREE)}>
            Reset
          </Button>
        </div>
        <pre className="whitespace-pre font-mono text-[11px] leading-5 text-ink-soft">{outline(tree).join('\n')}</pre>
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ RemoteSelections */

const BRIEF = `Launch plan — v4 onboarding

Goal: cut time-to-first-project from nine minutes to under three.

1. Replace the six-step wizard with a single page.
2. Pre-fill the workspace name from the sign-up email domain.
3. Offer a sample project instead of an empty dashboard.

Risks: teams that rely on the wizard's role picker will need a migration path.`

const START_PEERS: RemoteSelectionsPeer[] = [
  { id: 'ada', name: 'Ada', anchor: 30, head: 30 },
  { id: 'bruno', name: 'Bruno', anchor: BRIEF.indexOf('Pre-fill'), head: BRIEF.indexOf('Pre-fill') + 30 },
  { id: 'chen', name: 'Chen', anchor: BRIEF.indexOf('migration'), head: BRIEF.indexOf('migration') + 14 },
]

function RemoteSelectionsExample() {
  const [text, setText] = useState(BRIEF)
  const [peers, setPeers] = useState(START_PEERS)
  const [live, setLive] = useState(false)

  // Stand-in for a server: Ada’s caret walks forward a word at a time.
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => {
      setPeers((current) =>
        current.map((peer) => {
          if (peer.id !== 'ada') return peer
          const next = text.indexOf(' ', peer.head + 1)
          const head = next < 0 ? 0 : next
          return { ...peer, anchor: head, head }
        }),
      )
    }, 700)
    return () => clearInterval(timer)
  }, [live, text])

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={live} onChange={(event) => setLive(event.target.checked)} />
          Ada is typing
        </label>
        <Button size="sm" variant="ghost" onClick={() => { setText(BRIEF); setPeers(START_PEERS) }}>
          Reset
        </Button>
      </div>
      <RemoteSelections label="Launch plan" value={text} onValueChange={setText} peers={peers} onPeersChange={setPeers} rows={11} />
      <div className="flex flex-wrap gap-2">
        {peers.map((peer) => (
          <Badge key={peer.id} tone="neutral">
            {peer.name}: {peer.anchor === peer.head ? `caret at ${peer.head}` : `${Math.min(peer.anchor, peer.head)}–${Math.max(peer.anchor, peer.head)}`}
          </Badge>
        ))}
      </div>
      <Text size="caption" tone="faint">
        Type above Bruno’s or Chen’s selection: the offsets move with the text instead of drifting onto other words.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ CallGrid */

const PEOPLE = ['Ada Park', 'Bruno Silva', 'Chen Wei', 'Dara Okafor', 'Elif Kaya', 'Farah Nadeem', 'Gus Holm', 'Hana Sato', 'Ivo Marić', 'Jun Ito', 'Kofi Mensah', 'Lena Vogel']
const HUES = [150, 210, 30, 280, 100, 0, 250, 60, 190, 320, 120, 170]

function FakeFeed({ index, name }: { index: number; name: string }) {
  const hue = HUES[index % HUES.length]
  return (
    <div
      role="img"
      aria-label={`${name}’s camera`}
      className="size-full"
      style={{ background: `radial-gradient(circle at 50% 38%, hsl(${hue} 30% 72%) 0 14%, transparent 15%), radial-gradient(ellipse at 50% 100%, hsl(${hue} 28% 62%) 0 34%, transparent 35%), linear-gradient(160deg, hsl(${hue} 22% 30%), hsl(${hue + 40} 26% 18%))` }}
    />
  )
}

function CallGridExample() {
  const [count, setCount] = useState(5)
  const [speaker, setSpeaker] = useState(0)
  const [pinned, setPinned] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'16/9' | '4/3' | '1/1'>('16/9')

  useEffect(() => {
    const timer = setInterval(() => setSpeaker((value) => value + 1), 2400)
    return () => clearInterval(timer)
  }, [])

  const participants: CallGridParticipant[] = PEOPLE.slice(0, count).map((name, index) => ({
    id: name,
    name,
    muted: index % 3 === 1,
    videoOff: index % 4 === 2,
    handRaised: index === 3,
    video: <FakeFeed index={index} name={name} />,
  }))
  const [w, h] = aspect.split('/').map(Number) as [number, number]

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
        <Field label={`Participants: ${count}`}>
          <Slider min={1} max={PEOPLE.length} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </Field>
        <SegmentedControl
          label="Tile shape"
          size="sm"
          value={aspect}
          onValueChange={setAspect}
          options={[
            { value: '16/9', label: '16:9' },
            { value: '4/3', label: '4:3' },
            { value: '1/1', label: 'Square' },
          ]}
        />
      </div>
      <Surface variant="card" padding="sm" className="w-full resize-x overflow-hidden">
        <CallGrid
          label="Design review call"
          participants={participants}
          activeSpeakerId={participants[speaker % participants.length]?.id}
          pinnedId={pinned}
          onPinnedChange={setPinned}
          aspectRatio={w / h}
          className="h-[380px]"
        />
      </Surface>
      <Text size="caption" tone="faint">
        Drag the corner of the frame to resize it and watch the grid re-solve. Hover a tile to pin it.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ PictureInPicture */

function Stopwatch() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState('')
  const started = useRef(0)

  useEffect(() => {
    if (!running) return
    started.current = Date.now() - elapsed
    const timer = setInterval(() => setElapsed(Date.now() - started.current), 100)
    return () => clearInterval(timer)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)
  const tenths = Math.floor((elapsed % 1000) / 100)

  return (
    <Surface variant="card" padding="lg" className="flex flex-col gap-3">
      <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
        Standup timer
      </Text>
      <Text as="p" size="display" tabular role="timer" aria-live="off">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.{tenths}
      </Text>
      <div className="flex gap-2">
        <Button size="sm" variant="accent" onClick={() => setRunning(!running)}>
          {running ? 'Pause' : 'Start'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setRunning(false); setElapsed(0) }}>
          Reset
        </Button>
      </div>
      <Field label="Who’s next">
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bruno, then Chen" />
      </Field>
    </Surface>
  )
}

function PictureInPictureExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <PictureInPicture width={340} height={300} onOpenChange={setOpen}>
        <Stopwatch />
      </PictureInPicture>
      <Text size="caption" tone="faint">
        {open ? 'The timer keeps running in the floating window — close it to bring it back.' : 'Start the timer, type a name, then pop it out: both survive the move.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ ScrollSequence */

const FRAMES = 90

function useOrbitFrames(): ScrollSequenceDrawFrame {
  return useMemo(() => {
    const accent = token('--color-accent')
    const ink = token('--color-ink')
    const surface = token('--color-surface-sunken')
    const line = token('--color-line-strong')
    return (context, index, width, height) => {
      const t = index / (FRAMES - 1)
      context.fillStyle = surface
      context.fillRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      // Orbit rings, tilted.
      context.strokeStyle = line
      context.lineWidth = 2
      for (const radius of [140, 210]) {
        context.beginPath()
        context.ellipse(cx, cy, radius, radius * 0.34, -0.2, 0, Math.PI * 2)
        context.stroke()
      }
      // The planet turns: a lit side that sweeps across with the scroll.
      const planet = 88
      const gradient = context.createRadialGradient(cx - planet * Math.cos(t * Math.PI), cy - 30, 10, cx, cy, planet)
      gradient.addColorStop(0, accent)
      gradient.addColorStop(1, ink)
      context.fillStyle = gradient
      context.beginPath()
      context.arc(cx, cy, planet, 0, Math.PI * 2)
      context.fill()
      // A moon on the outer ring, going round once over the sequence.
      const angle = t * Math.PI * 2 - Math.PI / 2
      const mx = cx + Math.cos(angle) * 210 * Math.cos(-0.2) - Math.sin(angle) * 210 * 0.34 * Math.sin(-0.2)
      const my = cy + Math.cos(angle) * 210 * Math.sin(-0.2) + Math.sin(angle) * 210 * 0.34 * Math.cos(-0.2)
      const behind = Math.sin(angle) < 0
      context.globalAlpha = behind ? 0.45 : 1
      context.fillStyle = accent
      context.beginPath()
      context.arc(mx, my, 16 + (behind ? 0 : 4) * Math.sin(angle), 0, Math.PI * 2)
      context.fill()
      context.globalAlpha = 1
    }
  }, [])
}

function ScrollSequenceExample() {
  const drawFrame = useOrbitFrames()
  const [fit, setFit] = useState<'cover' | 'contain'>('cover')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Fit"
        size="sm"
        value={fit}
        onValueChange={setFit}
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
      />
      <div tabIndex={0} role="region" aria-label="Scroll to turn the planet" className="h-[360px] w-full overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex h-[120px] items-center justify-center">
          <Text size="label" tone="faint">
            Scroll down inside this panel
          </Text>
        </div>
        <ScrollSequence label="A planet turning while its moon completes one orbit" frameCount={FRAMES} drawFrame={drawFrame} length="1100px" pinHeight="360px" fit={fit}>
          {(progress) => (
            <div className="flex h-full items-end p-4">
              <span className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold tabular-nums text-ink shadow-[var(--shadow-float)]">
                {progress < 0.33 ? 'Dawn side' : progress < 0.66 ? 'Terminator' : 'Night side'} · frame {Math.round(progress * (FRAMES - 1)) + 1} of {FRAMES}
              </span>
            </div>
          )}
        </ScrollSequence>
        <div className="flex h-[140px] items-center justify-center">
          <Text size="label" tone="faint">
            End of the sequence
          </Text>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ ShaderCanvas */

const PRESETS = {
  aurora: undefined,
  rings: `void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 m = (u_pointer - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float d = length(p - m * 0.4);
  float rings = 0.5 + 0.5 * sin(d * 38.0 - u_time * 2.0);
  vec3 colour = mix(u_surface, u_accent, rings * smoothstep(0.9, 0.0, d));
  gl_FragColor = vec4(colour, 1.0);
}`,
  broken: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution
  gl_FragColor = vec4(u_accent * uv.x, 1.0);
}`,
}

function ShaderCanvasExample() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('aurora')
  const [status, setStatus] = useState('starting')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Shader"
        size="sm"
        value={preset}
        onValueChange={setPreset}
        options={[
          { value: 'aurora', label: 'Aurora' },
          { value: 'rings', label: 'Rings' },
          { value: 'broken', label: 'Missing semicolon' },
        ]}
      />
      <ShaderCanvas key={preset} fragment={PRESETS[preset]} showErrors onStatusChange={setStatus} className="h-[300px] rounded-[var(--radius-card)] border border-line">
        <div className="flex h-full flex-col justify-end gap-1 p-6">
          <Text size="caption" weight="bold" tone="soft" className="uppercase tracking-wider">
            Klyv 4.0
          </Text>
          <Text size="heading" className="max-w-[420px]">
            A background that follows your accent, theme and pointer
          </Text>
        </div>
      </ShaderCanvas>
      <Text size="caption" tone="faint">
        Status: {status}. Switch the theme or accent and the colours follow without recompiling.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ VoronoiField */

function VoronoiFieldExample() {
  const [count, setCount] = useState<'16' | '36' | '72'>('36')
  const [seeds, setSeeds] = useState(true)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Cells"
          size="sm"
          value={count}
          onValueChange={setCount}
          options={[
            { value: '16', label: '16' },
            { value: '36', label: '36' },
            { value: '72', label: '72' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={seeds} onChange={(event) => setSeeds(event.target.checked)} />
          Show seeds
        </label>
      </div>
      <div className="relative h-[300px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <VoronoiField count={Number(count)} showSeeds={seeds} className="absolute inset-0" />
        <div className="relative flex h-full flex-col justify-center gap-2 p-8">
          <Text size="caption" weight="bold" tone="soft" className="uppercase tracking-wider">
            Territory planning
          </Text>
          <Text size="heading" className="max-w-[360px]">
            Every account goes to its nearest rep
          </Text>
          <Text size="label" tone="soft" className="max-w-[360px]">
            Move the pointer over the field and the seeds drift towards it.
          </Text>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Module */

export const demos: ExampleModule = {
  'node-editor': {
    description:
      'A node graph editor: nodes with typed inputs and outputs, joined by wires dragged from an output to an input. A wire is checked before it exists — the types must fit, a node cannot feed itself and, unless loops are allowed, the wire must not let data flow back to where it started — and a refusal says why. The canvas pans and zooms through PanZoom, nodes move with the arrow keys, and every port opens a menu of exactly the connections that would be valid from it.',
    sections: [
      { title: 'Image export pipeline', description: 'Drag from an output dot to an input. Try Caption › Text into an Image input, or Blur back into Resize.', Content: NodeEditorExample },
      rationale(
        'Pipelines, automations and shader graphs are graphs, and a form cannot show which step feeds which — nor stop someone wiring text into an image.',
        'Validation at connect time keeps the graph runnable, and the port menus make the whole thing operable without a pointer.',
        'Workflow builders, data transforms, audio or shader graphs, and rules engines with typed steps.',
        ['PanZoom', 'Menu', 'IconButton', 'LiveRegion'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'NodeEditorGraph', description: '{ nodes, wires } — nodes carry position and typed ports; wires join { node, port } endpoints.' },
      { name: 'onValueChange', type: '(graph: NodeEditorGraph) => void', description: 'Called with the whole graph after every change.' },
      { name: 'label', type: 'string', description: 'Accessible name for the canvas.' },
      { name: 'isCompatible', type: '(output: string, input: string) => boolean', defaultValue: 'equal or any', description: 'Whether an output type may feed an input type.' },
      { name: 'allowCycles', type: 'boolean', defaultValue: 'false', description: 'Allow wires that close a loop.' },
      { name: 'nodeWidth', type: 'number', defaultValue: '184', description: 'Width of every node in pixels.' },
      { name: 'wheelZoom', type: 'boolean', defaultValue: 'true', description: 'Zoom with the wheel.' },
    ],
  },

  whiteboard: {
    description:
      'A small whiteboard with rectangles, ellipses, arrows, text and a freehand pen. Shapes are plain records, so the value is JSON; hit-testing follows each shape’s geometry rather than its bounding box; selection supports shift-click and marquee, resizing uses handles, and undo records one step per finished gesture. It exports JSON or a standalone SVG with the theme’s colours resolved.',
    sections: [
      { title: 'Sketching a flow', description: 'Draw with the toolbar or the letter keys. Brackets step through shapes, arrows nudge, Ctrl+Z undoes.', Content: WhiteboardExample },
      rationale(
        'Teams sketch flows and layouts in tools that live outside the product, so the sketch never sits next to the thing it describes.',
        'A shape model small enough to store as JSON, with real hit-testing and undo, covers most sketching without an embedded third-party editor.',
        'Design reviews, incident timelines, retro boards and annotated specs inside an app.',
        ['IconButton', 'Menu', 'Button', 'LiveRegion'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'WhiteboardShape[]', description: 'Shapes bottom to top: { id, kind, x, y, width, height, points?, text? }.' },
      { name: 'onValueChange', type: '(shapes: WhiteboardShape[]) => void', description: 'Called with every change.' },
      { name: 'label', type: 'string', description: 'Accessible name for the drawing surface.' },
      { name: 'defaultTool', type: 'WhiteboardTool', defaultValue: "'select'", description: 'select, rect, ellipse, arrow, text or pen.' },
      { name: 'onExport', type: '(format, content) => void', description: 'Receives the JSON or SVG. Without it the export downloads.' },
    ],
  },

  joystick: {
    description:
      'A virtual analogue stick. Drag inside the ring and it reports a normalised x/y vector, a magnitude, an angle and the nearest compass direction — with a dead zone so a resting thumb reads as centred, and D-pad modes that snap to four or eight directions. It springs back on release, and arrow keys or WASD held together produce the same vector, diagonals included.',
    sections: [
      { title: 'Driving a marker', description: 'The stick runs in continuous mode, reporting every frame while held, as a game loop wants.', Content: JoystickExample },
      rationale(
        'Touch devices have no arrow keys, and on-screen arrow buttons cannot express “mostly left, a bit up, gently”.',
        'A radial control with a dead zone and rescaling gives a proportional vector, and the keyboard path feeds the same maths.',
        'Browser games, camera and drone controls, robot teleoperation and 2D map panning on touch screens.',
        ['VisuallyHidden', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name, such as “Move”.' },
      { name: 'onMove', type: '(vector: JoystickVector) => void', description: '{ x, y, magnitude, angle, direction } — y is up-positive.' },
      { name: 'onEnd', type: '() => void', description: 'Called when the stick is released.' },
      { name: 'mode', type: "'analog' | 'dpad4' | 'dpad8'", defaultValue: "'analog'", description: 'Any angle, or snapped directions at full strength.' },
      { name: 'deadZone', type: 'number', defaultValue: '0.12', description: 'Fraction of the radius that reads as centred.' },
      { name: 'continuous', type: 'boolean', defaultValue: 'false', description: 'Report every animation frame while held.' },
      { name: 'size', type: 'number', defaultValue: '144', description: 'Diameter in pixels.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks interaction.' },
    ],
  },

  'sortable-tree': {
    description:
      'A hierarchy reordered by dragging: vertical movement picks the position and horizontal movement picks the depth, projected from the rows above and below so the result is always a valid tree. The dragged item carries its whole subtree, so it cannot be dropped inside itself. From the keyboard, Space picks an item up, arrows move, indent and outdent it, Space drops and Escape cancels — each step announced with the position and the parent.',
    sections: [
      { title: 'Docs navigation', description: 'Drag by the grip, sideways to change level. Or focus a row and press Space.', Content: SortableTreeExample },
      rationale(
        'Reordering nested navigation, folders or outlines usually means a separate “move to…” dialog per item, one level at a time.',
        'A flat list with a depth projection makes nesting a single gesture, and the same projection drives the keyboard.',
        'Docs and site navigation editors, folder trees, outline editors and nested task lists.',
        ['LiveRegion', 'VisuallyHidden', 'internal icons'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'SortableTreeItem[]', description: '{ id, label, children?, collapsed? } per item.' },
      { name: 'onValueChange', type: '(tree: SortableTreeItem[]) => void', description: 'Called after a move, collapse or expand.' },
      { name: 'label', type: 'string', description: 'Accessible name for the tree.' },
      { name: 'indentation', type: 'number', defaultValue: '24', description: 'Pixels per level, and the sideways drag per level.' },
      { name: 'maxDepth', type: 'number', defaultValue: 'unlimited', description: 'Deepest level an item may land at.' },
      { name: 'renderLabel', type: '(item) => ReactNode', description: 'Custom row content.' },
    ],
  },

  'remote-selections': {
    description:
      'Other people’s carets and selections drawn inside an ordinary textarea from character offsets. Positions come from a hidden mirror with the textarea’s width, font and wrapping, so multi-line selections highlight line by line; they are re-measured on scroll, resize and edit. When you type before someone’s caret, their offsets are moved through your edit so the caret stays on the same word until the server catches up.',
    sections: [
      { title: 'Editing a brief together', Content: RemoteSelectionsExample },
      rationale(
        'Collaborative text needs presence, but a textarea cannot say where character 212 is on screen, and a rich-text editor is a large dependency to take on for it.',
        'A mirror element answers the geometry, and a prefix–suffix diff keeps remote offsets honest through local edits.',
        'Shared notes, comment drafts, prompt editors and any plain-text field more than one person edits.',
        ['chart series palette', 'ResizeObserver'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name for the text field.' },
      { name: 'value / defaultValue', type: 'string', description: 'The text, controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Called on every local edit.' },
      { name: 'peers', type: 'RemoteSelectionsPeer[]', description: '{ id, name, anchor, head, color? } — offsets into the current text.' },
      { name: 'onPeersChange', type: '(peers) => void', description: 'Peers with offsets moved through a local edit.' },
      { name: 'textareaClassName', type: 'string', description: 'Classes for the textarea itself.' },
    ],
  },

  'call-grid': {
    description:
      'A video-call layout that solves its own grid: for the number of people and the size of the box, it tries every column count and keeps the one that makes tiles largest at the camera’s aspect ratio, re-solving on resize. The active speaker gets the accent ring; muted, hand-raised and camera-off states are drawn and written into each tile; pinning someone gives them the stage with everyone else in a filmstrip.',
    sections: [
      { title: 'Design review', Content: CallGridExample },
      rationale(
        'Fixed breakpoints for call layouts waste most of a wide window and letterbox a tall one, and the states on each tile are usually invisible to a screen reader.',
        'Maximising tile area is exact and cheap, and a real list with text states makes the call legible without video.',
        'Video calls, webinars, classroom and interview tools, and multi-camera monitoring walls.',
        ['Avatar', 'VisuallyHidden', 'ResizeObserver'],
      ),
    ],
    props: [
      { name: 'participants', type: 'CallGridParticipant[]', description: '{ id, name, video?, avatarSrc?, muted?, videoOff?, handRaised? }.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list of tiles.' },
      { name: 'activeSpeakerId', type: 'string | null', description: 'Whose tile gets the speaker ring.' },
      { name: 'pinnedId / defaultPinnedId', type: 'string | null', description: 'Spotlighted participant, controlled or not.' },
      { name: 'onPinnedChange', type: '(id: string | null) => void', description: 'Called when someone is pinned or unpinned.' },
      { name: 'aspectRatio', type: 'number', defaultValue: '16 / 9', description: 'Tile width over height.' },
      { name: 'gap', type: 'number', defaultValue: '8', description: 'Space between tiles in pixels.' },
    ],
  },

  'picture-in-picture': {
    description:
      'Pops a live part of the page into an always-on-top window using Document Picture-in-Picture, and puts it back when that window closes. The content is portalled into a container that is moved rather than re-rendered, so state survives the trip; stylesheets are copied and the root’s theme attributes mirrored, so it looks the same and follows theme changes. Where the API is missing it says so and leaves the content in place.',
    sections: [
      { title: 'A timer that stays on top', Content: PictureInPictureExample },
      rationale(
        'Timers, calls and checklists get buried behind other windows exactly when they are needed.',
        'Document Picture-in-Picture holds real, interactive HTML, and moving one container keeps React state intact.',
        'Meeting timers, call controls, live dashboards, music players and step-by-step guides.',
        ['Button', 'Text', 'createPortal'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The live content that moves.' },
      { name: 'width / height', type: 'number', defaultValue: '360 / 240', description: 'Requested size of the floating window.' },
      { name: 'openLabel / closeLabel', type: 'string', defaultValue: "'Pop out' / 'Bring back'", description: 'Button labels.' },
      { name: 'placeholder', type: 'ReactNode', description: 'Shown in the page while the content is away.' },
      { name: 'unsupportedMessage', type: 'ReactNode', description: 'Shown where the API is not available.' },
      { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Called as the window opens and closes.' },
    ],
  },

  'scroll-sequence': {
    description:
      'A pinned stage that plays a sequence of frames as the reader scrolls through it. Every frame is loaded (or painted, for generated frames) up front with a progress bar, then scrolling only draws the frame for the current position onto a canvas with object-fit maths — exact, unlike scrubbing a video. Progress is measured against the nearest scrolling ancestor; under reduced motion the track collapses to one still frame.',
    sections: [
      { title: 'A generated turntable', description: 'Ninety frames painted procedurally, no images downloaded.', Content: ScrollSequenceExample, note: motionNote('the scroll track collapses and the middle frame is shown as a still.') },
      rationale(
        'Scroll-scrubbed video stutters because seeking lands on keyframes, and some browsers will not seek at all until playback starts.',
        'Pre-loaded frames on a canvas are exact at every position and cost one draw per changed frame.',
        'Product turntables, feature reveals on landing pages and step-through explainers.',
        ['canvas', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'frames', type: 'string[]', description: 'Image URLs, one per frame.' },
      { name: 'frameCount / drawFrame', type: 'number / (ctx, index, w, h) => void', description: 'Generated frames, painted once each.' },
      { name: 'frameSize', type: '{ width, height }', defaultValue: '960 × 540', description: 'Size generated frames are painted at.' },
      { name: 'length', type: 'string', defaultValue: "'300vh'", description: 'Scroll distance for the whole sequence.' },
      { name: 'pinHeight', type: 'string', defaultValue: "'100vh'", description: 'Height of the pinned stage.' },
      { name: 'fit', type: "'cover' | 'contain'", defaultValue: "'cover'", description: 'How frames fill the stage.' },
      { name: 'stillFrame', type: 'number', defaultValue: 'middle', description: 'Frame shown under reduced motion.' },
      { name: 'label', type: 'string', description: 'Describes the sequence for assistive tech.' },
      { name: 'children', type: 'ReactNode | (progress) => ReactNode', description: 'Overlay content.' },
    ],
  },

  'shader-canvas': {
    description:
      'A WebGL fragment shader as a background. It prepends uniforms for time, resolution, pointer and the theme colours — resolved from CSS variables by painting a pixel, and re-read when the theme or accent changes. The loop stops off screen and in hidden tabs, reduced motion draws one frame, and when WebGL is missing or the shader fails to compile a CSS gradient stays in place and the compile log is reported.',
    sections: [
      { title: 'Hero background', description: 'The third preset has a syntax error, to show the error path.', Content: ShaderCanvasExample, note: motionNote('one frame is drawn at stillTime, and redrawn only when the size or theme changes.') },
      rationale(
        'Shader backgrounds are usually pasted in with hard-coded colours, run forever off screen, and fail as a black box with no message.',
        'Theme-fed uniforms, visibility pausing and a gradient fallback make a shader behave like any other token-driven surface.',
        'Landing heroes, empty states, auth screens and anywhere a quiet, living backdrop earns its cost.',
        ['WebGL', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'fragment', type: 'string', defaultValue: 'aurora', description: 'GLSL ES 1.0 source with a main(); uniforms are prepended.' },
      { name: 'colors', type: 'Record<string, string>', defaultValue: 'u_accent, u_ink, u_surface', description: 'Uniform name to CSS colour or token.' },
      { name: 'resolution', type: 'number', defaultValue: '1', description: 'Fraction of device pixels to render at.' },
      { name: 'stillTime', type: 'number', defaultValue: '4', description: 'Time drawn under reduced motion.' },
      { name: 'showErrors', type: 'boolean', defaultValue: 'false', description: 'Overlay compile errors.' },
      { name: 'onError', type: '(message: string) => void', description: 'Receives the compile or link log.' },
      { name: 'onStatusChange', type: '(status) => void', description: 'starting, running, unsupported or error.' },
      { name: 'label', type: 'string', description: 'Makes the canvas an image with this name.' },
    ],
  },

  'voronoi-field': {
    description:
      'A generative Voronoi diagram of drifting seeds: each cell is computed exactly by clipping the canvas against the perpendicular bisector with every other seed, then tinted from the accent at a fixed per-cell strength. Seeds lean towards the pointer. The loop pauses off screen and in hidden tabs, reduced motion shows a still frame, and the canvas is decorative and hidden from assistive technology.',
    sections: [
      { title: 'Behind a hero', Content: VoronoiFieldExample, note: motionNote('a single still frame is drawn; the seeds do not move.') },
      rationale(
        'Decorative backgrounds tend to be either static images or particle noise with no structure.',
        'Voronoi cells give a calm, geometric texture that moves without flicker, from about sixty lines of clipping maths.',
        'Hero sections, territory or clustering stories, and empty states that want structure rather than noise.',
        ['canvas', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'count', type: 'number', defaultValue: '36', description: 'Number of seeds and cells.' },
      { name: 'speed', type: 'number', defaultValue: '0.25', description: 'Drift in pixels per frame.' },
      { name: 'attraction', type: 'number', defaultValue: '0.6', description: 'Pull towards the pointer; 0 turns it off.' },
      { name: 'reach', type: 'number', defaultValue: '180', description: 'Radius of the pointer’s pull in pixels.' },
      { name: 'color', type: 'string', defaultValue: 'var(--color-accent)', description: 'Colour cells are tinted from.' },
      { name: 'edgeColor', type: 'string', defaultValue: 'var(--color-line-strong)', description: 'Colour of the cell edges.' },
      { name: 'showSeeds', type: 'boolean', defaultValue: 'true', description: 'Draw a dot at each seed.' },
      { name: 'seed', type: 'number', defaultValue: '11', description: 'Seed for a repeatable layout.' },
    ],
  },
}
