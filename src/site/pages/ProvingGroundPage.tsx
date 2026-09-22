import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Play, Square } from 'lucide-react'
import {
  AreaChart,
  Avatar,
  Badge,
  Button,
  Checkbox,
  FuzzyFinder,
  Input,
  Meter,
  Progress,
  Rating,
  SegmentedControl,
  Slider,
  Sparkline,
  StatCard,
  Surface,
  Switch,
  Tag,
  Text,
  cn,
  type FuzzyFinderItem,
} from 'klyvui'
import { PageIntro } from '../components/PageIntro'
import { Note, Section } from '../components/Doc'
import { loadExamples } from '../examples'
import { catalog, findComponentByName } from '../data/catalog'
import { sizes } from '../data/sizes'
import { afterPaint, heapMB, sampleFrames, type FrameReport } from '../lib/bench'

/**
 * The proving ground: mount a component a thousand times and watch what
 * happens, here, on this machine.
 *
 * A component library's performance claims are always someone else's numbers
 * from someone else's laptop. These are the reader's own: the page mounts as
 * many copies as they ask for, times the mount, samples the frame clock while
 * they are all live, and forces an update through every one of them. It
 * reports what it got, including when what it got is bad — a thousand charts
 * will drop frames on any machine, and a run that says so is worth more than
 * one that cannot.
 *
 * What it cannot be is a benchmark of the published package: this is the
 * development build with React's development checks in it, which is slower
 * than what a consumer ships. The page says so beside the numbers rather than
 * in a footnote.
 */
const COUNTS = [25, 100, 250, 500, 1000]
const HEAVY = 9 * 1024

const TREND = [12, 18, 14, 22, 19, 27, 31, 26, 34, 38]
const noop = () => {}

/**
 * The benchmark set: each component rendered directly, with the props a real
 * screen would give it, from the lightest part in the library to a chart.
 *
 * These are written out rather than borrowed from the documentation, because
 * the primitives have no example to borrow and many others demonstrate
 * themselves with a whole interactive panel — which would measure the panel.
 * Anything outside this set falls back to its documentation example, and the
 * page says which of the two it is measuring.
 */
const RENDERERS: Record<string, () => ReactNode> = {
  Badge: () => <Badge>New</Badge>,
  Tag: () => <Tag size="sm">Design</Tag>,
  Button: () => <Button size="sm">Save changes</Button>,
  Checkbox: () => <Checkbox defaultChecked aria-label="Selected" />,
  Switch: () => <Switch defaultChecked aria-label="Notifications" />,
  Avatar: () => <Avatar name="Ada Lovelace" />,
  Input: () => <Input placeholder="ada@example.com" aria-label="Email" className="w-44" />,
  Slider: () => <Slider value={40} onChange={noop} aria-label="Volume" className="w-36" />,
  Rating: () => <Rating value={4} label="Four out of five" />,
  Progress: () => <Progress value={64} label="Upload progress" className="w-36" />,
  Meter: () => <Meter value={7} total={10} label="Seats used" />,
  SegmentedControl: () => (
    <SegmentedControl
      label="Period"
      size="sm"
      value="week"
      onValueChange={noop}
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
      ]}
    />
  ),
  Sparkline: () => <Sparkline values={TREND} label="Weekly active users" />,
  StatCard: () => <StatCard title="Revenue" value="$48,290" delta="12.4%" trend="up" className="w-56" />,
  AreaChart: () => (
    <div className="w-72">
      <AreaChart
        series={[{ id: 'users', label: 'Users', values: TREND }]}
        categories={TREND.map((_, index) => `W${index + 1}`)}
        label="Weekly active users"
        height={120}
        showLegend={false}
      />
    </div>
  ),
}

const STARTERS = Object.keys(RENDERERS)

const ITEMS: FuzzyFinderItem[] = catalog
  .filter((entry) => entry.name in sizes)
  .map((entry) => ({ id: entry.name, label: entry.name, detail: `${entry.group} · ${(sizes[entry.name].gzip / 1024).toFixed(1)} kB` }))

type Phase = 'idle' | 'mounting' | 'sampling' | 'updating' | 'done'

interface Result {
  name: string
  count: number
  mount: number
  update: number
  frames: FrameReport
  heap: number | null
}

export default function ProvingGroundPage() {
  const [name, setName] = useState('Button')
  const [count, setCount] = useState(250)
  const [instances, setInstances] = useState(0)
  const [specimen, setSpecimen] = useState<ReactNode | null>(null)
  const [missing, setMissing] = useState(false)
  const [source, setSource] = useState<'typical' | 'example'>('typical')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [nudge, setNudge] = useState(0)
  const mountStarted = useRef(0)
  const cancelled = useRef(false)

  const entry = findComponentByName(name)
  const weight = sizes[name]?.gzip ?? 0

  // The benchmark set renders directly; anything else is measured through its
  // own documentation example — a specimen where there is one, otherwise the
  // interactive panel its page opens with, which is heavier and says so.
  useEffect(() => {
    let live = true
    setMissing(false)
    const direct = RENDERERS[name]
    if (direct) {
      setSource('typical')
      setSpecimen(direct())
      return
    }
    setSpecimen(null)
    setSource('example')
    loadExamples(entry?.slug ?? '')
      .then((examples) => {
        if (!live) return
        const node = examples?.sections.find((section) => section.specimens?.length)?.specimens?.[0]?.node
        if (node) return setSpecimen(node)
        const Content = examples?.sections.find((section) => section.Content)?.Content
        if (Content) return setSpecimen(<Content />)
        setMissing(true)
      })
      .catch(() => live && setMissing(true))
    return () => {
      live = false
    }
  }, [name, entry?.slug])

  const stop = useCallback(() => {
    cancelled.current = true
    setPhase('idle')
    setInstances(0)
  }, [])

  const run = useCallback(async () => {
    if (!specimen) return
    cancelled.current = false
    setResult(null)
    setInstances(0)
    await afterPaint()

    setPhase('mounting')
    mountStarted.current = performance.now()
    setInstances(count)
    await afterPaint()
    const mount = performance.now() - mountStarted.current
    if (cancelled.current) return

    setPhase('sampling')
    const frames = await sampleFrames(2400)
    if (cancelled.current) return

    // An update every instance has to take part in: the wrappers read this, so
    // React reconciles the whole list rather than a corner of it.
    setPhase('updating')
    const updateStart = performance.now()
    setNudge((value) => value + 1)
    await afterPaint()
    const update = performance.now() - updateStart
    if (cancelled.current) return

    // What the tab holds with every copy mounted. A before-and-after difference
    // would be the natural number and is not a trustworthy one: the collector
    // runs when it likes, so it read zero, or less than zero, as often as not.
    setResult({ name, count, mount, update, frames, heap: heapMB() })
    setPhase('done')
  }, [specimen, count, name])

  useEffect(() => () => {
    cancelled.current = true
  }, [])

  const busy = phase === 'mounting' || phase === 'sampling' || phase === 'updating'
  const perInstance = result ? result.mount / result.count : 0

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        eyebrow="Build"
        title="Proving ground"
        stats={
          result
            ? [
                { value: result.frames.fps, label: 'frames per second' },
                { value: `${result.mount.toFixed(0)} ms`, label: `to mount ${result.count}` },
                { value: `${result.frames.p95.toFixed(1)} ms`, label: '95th percentile frame' },
                { value: result.frames.janky, label: 'frames over 33 ms' },
              ]
            : undefined
        }
      >
        Every performance claim you have read about a component library was measured on someone else&apos;s machine.
        Measure one here on yours: mount a component a thousand times, and watch the frame clock while it happens.
      </PageIntro>

      <Section title="Set up a run">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="flex flex-col gap-2">
              <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                Try one of these
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={busy}
                    aria-pressed={name === starter}
                    onClick={() => setName(starter)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
                      name === starter ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                    )}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                Or any of {ITEMS.length}
              </Text>
              <FuzzyFinder items={ITEMS} label="Choose a component to measure" placeholder="Search components…" height={220} onSelect={(item) => setName(item.id)} />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <Text as="h3" size="heading" className="font-mono text-[17px]">
                    {name}
                  </Text>
                  {entry && <Badge>{entry.group}</Badge>}
                </span>
                <Text size="caption" tone="soft">
                  {weight ? `${(weight / 1024).toFixed(1)} kB gzipped, with everything it imports` : 'Not measured'}
                  {missing
                    ? ' · no example to mount, so it cannot be measured here'
                    : source === 'typical'
                      ? ' · rendered with typical props'
                      : ' · measured through its documentation example, which may be a whole demo panel'}
                </Text>
              </div>
              <div className="flex items-center gap-2">
                {busy ? (
                  <Button variant="outline" onClick={stop}>
                    <Square size={14} aria-hidden />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={run} disabled={!specimen}>
                    <Play size={14} aria-hidden />
                    Run it {count} times
                  </Button>
                )}
              </div>
            </div>

            <SegmentedControl<string>
              label="How many copies"
              fullWidth
              value={String(count)}
              onValueChange={(value) => setCount(Number(value))}
              options={COUNTS.map((option) => ({ value: String(option), label: String(option) }))}
            />

            {weight > HEAVY && count >= 250 && (
              <Note>
                <span className="inline-flex items-start gap-2">
                  <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0 text-ink-faint" />
                  {name} is one of the heavier components — {count} of them will make this tab work hard, and may drop
                  frames badly on a laptop. That is a real answer too, but stop the run if the page stops responding.
                </span>
              </Note>
            )}

            <Progressively phase={phase} />

            {/* The wall: what is being measured, arriving where the reader is
                already looking when they press Run. */}
            <div className="relative min-h-[240px] flex-1 overflow-auto rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3 lg:max-h-[420px]">
              {instances === 0 ? (
                <div className="flex h-full min-h-[210px] items-center justify-center">
                  <Text size="caption" tone="faint">
                    Press Run and {count} copies of {name} arrive here.
                  </Text>
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-2" data-nudge={nudge}>
                  {Array.from({ length: instances }, (_, index) => (
                    <div key={index} style={{ opacity: nudge % 2 === 0 ? 1 : 0.999 }} className="pointer-events-none">
                      {specimen}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {instances > 0 && (
              <Text size="caption" tone="faint">
                {instances} live copies. They are inert — here to be rendered, not clicked. Open{' '}
                <Link to={`/components/${entry?.slug ?? ''}`} className="font-semibold text-ink-soft underline underline-offset-2">
                  the {name} page
                </Link>{' '}
                to use one properly.
              </Text>
            )}
          </div>
        </div>
      </Section>

      {result && (
        <Section title={`${result.count} × ${result.name}, measured here`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Activity}
              title="Frame rate under load"
              value={`${result.frames.fps} fps`}
              caption={`${result.frames.median.toFixed(1)} ms median frame`}
            />
            <StatCard title="Mount" value={`${result.mount.toFixed(0)} ms`} caption={`${perInstance.toFixed(2)} ms each`} />
            <StatCard title="Update all" value={`${result.update.toFixed(0)} ms`} caption="One state change through every copy" />
            <StatCard
              title="Memory"
              value={result.heap === null ? 'Not offered' : `${result.heap} MB`}
              caption={result.heap === null ? 'This browser does not expose it' : 'JavaScript heap, whole tab, all mounted'}
            />
          </div>

          <Surface variant="card" padding="md" className="mt-3 gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Text as="h3" size="heading" className="text-[15px]">
                Every frame of the sample
              </Text>
              <Text size="caption" tone="faint">
                {result.frames.frames.length} frames over 2.4 seconds · {result.frames.janky} took longer than 33 ms
              </Text>
            </div>
            <AreaChart
              series={[{ id: 'frame', label: 'Frame time', values: result.frames.frames.map((value) => Math.round(value * 10) / 10) }]}
              categories={result.frames.frames.map((_, index) => String(index + 1))}
              label={`Frame durations while ${result.count} copies of ${result.name} were mounted`}
              // Axis ticks are computed, so they arrive as 25.049999999999997.
              format={(value) => `${Math.round(value * 10) / 10} ms`}
              height={200}
              showLegend={false}
            />
            <Text size="caption" tone="soft" leading="normal">
              A frame budget is 16.7 ms at 60Hz. The line is what this browser actually managed with {result.count}{' '}
              copies of {result.name} on the page, in a development build — the published package has React&apos;s
              development checks compiled out and is faster than this. Run it again and the numbers will move: a
              machine that is busy reads as a machine that is slow.
            </Text>
          </Surface>
        </Section>
      )}

    </div>
  )
}

/** What the run is doing, while it does it. */
function Progressively({ phase }: { phase: Phase }) {
  const labels: Record<Phase, string> = {
    idle: 'Ready.',
    mounting: 'Mounting the copies…',
    sampling: 'Watching the frame clock for 2.4 seconds…',
    updating: 'Pushing one update through every copy…',
    done: 'Done — the numbers are below.',
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface-sunken px-3 py-2">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', phase === 'idle' || phase === 'done' ? 'bg-line-strong' : 'bg-accent motion-safe:animate-pulse')}
      />
      <Text as="span" size="caption" tone="soft" className="text-[12.5px]">
        {labels[phase]}
      </Text>
      <span role="status" aria-live="polite" className="sr-only">
        {labels[phase]}
      </span>
    </div>
  )
}
