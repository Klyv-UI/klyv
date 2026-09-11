import { Suspense, lazy, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Blocks,
  Check,
  ChefHat,
  Compass,
  FolderOpen,
  Heart,
  History,
  Keyboard,
  Package,
  PanelsTopLeft,
  Plug,
  Search,
  WandSparkles,
  Wind,
} from 'lucide-react'
import {
  ACCENT_PRESETS,
  AvatarGroup,
  Badge,
  BarList,
  BorderBeam,
  Button,
  CodeBlock,
  CubeCarousel,
  DonutChart,
  GlitchText,
  GooeyLoader,
  HoloCard,
  IconTile,
  JsonViewer,
  KanbanBoard,
  Kbd,
  Marquee,
  Metric,
  ProgressRing,
  Rating,
  Slider,
  Sparkline,
  StatCard,
  StreakCounter,
  Surface,
  Switch,
  Tabs,
  Tag,
  Terminal,
  Text,
  VisuallyHidden,
  XPBar,
  applyAccent,
  cn,
  deriveAccent,
  saveAccent,
  systemMode,
  type KanbanColumn,
} from 'citrine'
import { ContrastReadout } from '../components/ContrastReadout'
import { useAccent, useMode } from '../components/useTheme'
import { brand } from '../brand'
import { blockCount } from '../data/blocks'
import { catalog, componentCount, componentCountRounded } from '../data/catalog'
import { groups } from '../data/groups'
import { mcpTools } from '../data/mcp'
import { library } from '../data/sizes'
import { integrations } from '../data/integrations'
import { recipes } from '../data/recipes'
import { showcase } from '../data/showcase'
import { templates } from '../data/templates'
import { componentEvidence } from '../data/evidence'
import { useSaved } from '../lib/saved'

/**
 * The front page.
 *
 * It tells the library's story in the order a visitor asks it: what is this,
 * can it build a real screen, what else comes with it, what are the parts, can
 * I make it mine — the colour and a workspace of my own — and how do I start.
 * Every specimen on it is a real component, running — not a screenshot and not
 * a mock. That is the entire argument the page is making, so faking any part of
 * it would be self-defeating.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <FactsBand />
      <BlocksShowcase />
      <PlatformTour />
      <ComponentsBento />
      <OneHue />
      <YourWorkspace />
      <ShipIt />
      <GroupGrid />
      <Principles />
      <Closing />
    </>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  const hex = useAccent()

  const pick = (next: string) => {
    applyAccent(next)
    saveAccent(next)
  }

  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* A wash and a grid, both mixed from the accent, so the backdrop is part
          of the demonstration rather than decoration sitting on top of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_80%_-15%,color-mix(in_oklab,var(--color-accent)_16%,transparent)_0%,transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(var(--color-line-strong)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-strong)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(80%_60%_at_30%_0%,#000_10%,transparent_75%)]"
      />

      <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <a
            href="#platform"
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-line-strong"
          >
            <Badge>New</Badge>
            <Text as="span" size="micro" weight="bold" tone="soft">
              Composer, smart search and a personal workspace
            </Text>
            <ArrowRight
              size={12}
              aria-hidden
              className="text-ink-faint transition-transform group-hover:translate-x-0.5"
            />
          </a>

          <h1 className="max-w-[15ch] text-balance text-[44px] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-[60px] lg:text-[68px]">
            The library that runs on{' '}
            {/* A flat highlight rather than a gradient: the accent is the
                subject of the sentence, so it should be the accent exactly,
                not a blend that is never one of the tokens. */}
            <span className="relative whitespace-nowrap">
              <span
                aria-hidden
                className="absolute inset-x-[-0.08em] bottom-[0.06em] top-[0.14em] -z-10 rounded-[0.12em] bg-accent"
              />
              one colour
            </span>
          </h1>

          <Text
            size="body"
            weight="medium"
            tone="soft"
            leading="normal"
            className="max-w-[52ch] sm:text-[15px]"
          >
            {brand.pitch}
          </Text>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button as={Link} to="/getting-started">
              Get started
              <ArrowRight size={14} aria-hidden />
            </Button>
            <Button as={Link} to="/components" variant="outline">
              Browse {componentCountRounded} components
            </Button>
          </div>

          <InstallChip />

          {/* The hero's interaction is the product's thesis: change the hue and
              the page you are reading changes with it. */}
          <div className="flex w-full flex-col gap-2.5 pt-2">
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.16em]">
              Try it — pick an accent
            </Text>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((preset) => {
                const active = preset.hex.toLowerCase() === hex.toLowerCase()
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => pick(preset.hex)}
                    aria-pressed={active}
                    title={preset.name}
                    className={cn(
                      'h-8 w-8 rounded-[10px] border border-line-strong transition-transform hover:scale-110',
                      active && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas',
                    )}
                    style={{ background: preset.hex }}
                  >
                    <VisuallyHidden>{preset.name}</VisuallyHidden>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <HeroCollage />
      </div>
    </section>
  )
}

function InstallChip() {
  const [copied, setCopied] = useState(false)
  const command = `npm i ${brand.pkg}`

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          setCopied(false)
        }
      }}
      className="group inline-flex h-10 items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 font-mono text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
    >
      <span>
        <span className="text-ink-faint">$</span> {command}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint group-hover:text-ink">
        {copied ? 'Copied' : 'Copy'}
      </span>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </VisuallyHidden>
    </button>
  )
}

const HERO_TRAFFIC = [14, 19, 16, 26, 23, 33, 30, 41, 37, 48, 45, 58]

/**
 * A loose stack of real components, tilted just off-square.
 *
 * Everything in here recolours with the swatches to its left, which is the
 * point — a screenshot could not do that, and a screenshot is what a hero
 * usually is. Nothing in it is repeated further down the page.
 */
function HeroCollage() {
  const [live, setLive] = useState(true)

  return (
    <div className="relative isolate mx-auto w-full max-w-[440px] lg:max-w-none">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_70%)] blur-2xl"
      />

      <div className="flex flex-col gap-3">
        <Surface
          variant="card"
          padding="lg"
          className="rotate-[-1.4deg] gap-4 shadow-[var(--shadow-float)]"
        >
          <div className="flex items-start justify-between gap-4">
            <Metric label="Monthly active" value="12,480" delta="+18.2%" trend="up" size="lg" />
            <ProgressRing value={72} label="Target reached" size="sm" />
          </div>
          <Sparkline values={HERO_TRAFFIC} label="Monthly active users" area showLast height={56} />
        </Surface>

        <Surface
          variant="card"
          padding="lg"
          className="rotate-[0.9deg] gap-4 shadow-[var(--shadow-float)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Deploy</Button>
            <Button size="sm" variant="muted">
              Preview
            </Button>
            <Button size="sm" variant="outline">
              Logs
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge>New</Badge>
              <Tag tone="accent">tokens</Tag>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </div>
            <Switch
              checked={live}
              onChange={(event) => setLive(event.target.checked)}
              aria-label="Live updates"
            />
          </div>
        </Surface>

        <Surface
          variant="card"
          padding="lg"
          className="rotate-[-0.6deg] flex-row items-center justify-between gap-4 shadow-[var(--shadow-float)]"
        >
          <AvatarGroup
            label="Reviewers"
            people={[
              { name: 'Ada Lovelace' },
              { name: 'Grace Hopper' },
              { name: 'Alan Turing' },
              { name: 'Radia Perlman' },
            ]}
            max={4}
            size="sm"
          />
          <Rating value={4} label="Documentation" readOnly size="sm" />
        </Surface>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- facts */

/**
 * The numbers, before the pitch goes any further.
 *
 * Every figure is derived — from the catalogue, the block list, the generated
 * MCP definitions, or the contrast guarantee in the accent maths — so none of
 * them can quietly go stale. There are no borrowed logos here, because there are
 * none to borrow.
 */
function FactsBand() {
  const facts = [
    { value: String(componentCount), label: 'components' },
    { value: String(blockCount), label: 'production blocks' },
    { value: String(groups.length), label: 'groups' },
    { value: '4.5:1', label: 'contrast, on any accent' },
    { value: '2', label: 'runtime dependencies' },
    { value: String(mcpTools.length), label: 'MCP tools for agents' },
  ]

  return (
    <section aria-label="At a glance" className="mx-auto w-full max-w-[1400px] px-5 pt-10 lg:px-8">
      <Surface variant="card" padding="none" className="overflow-hidden">
        {/* A one-pixel gap over a line-coloured ground draws the hairlines,
            so the dividers stay correct at every column count. */}
        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1 bg-surface px-5 py-5">
              <dt className="order-2">
                <Text as="span" size="caption" weight="semibold" tone="faint">
                  {fact.label}
                </Text>
              </dt>
              <dd className="order-1">
                <Text as="span" size="title" tabular>
                  {fact.value}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      </Surface>
    </section>
  )
}

/* ------------------------------------------------------------------ blocks */

const AdminBlock = lazy(() => import('../blocks/AdminBlock'))
const DashboardBlock = lazy(() => import('../blocks/DashboardBlock'))
const SettingsBlock = lazy(() => import('../blocks/SettingsBlock'))
const LoginBlock = lazy(() => import('../blocks/LoginBlock'))

type ScreenKey = 'admin' | 'dashboard' | 'settings' | 'login'

/**
 * Whole screens, live.
 *
 * The strongest thing a component library can show is the thing people are
 * about to build. Each tab is a real block from the Blocks section, and only the
 * open one is mounted — Tabs renders the current panel alone — so four screens
 * cost the page one.
 */
function BlocksShowcase() {
  const [screen, setScreen] = useState<ScreenKey>('admin')

  const frame = (slug: string, node: ReactNode) => (
    <div className="flex flex-col gap-3 pt-4">
      <Surface variant="sunken" padding="none" className="overflow-hidden bg-app p-3 sm:p-5">
        <Suspense fallback={<div className="min-h-[540px]" aria-busy="true" />}>{node}</Suspense>
      </Surface>
      <SectionLink to={`/blocks/${slug}`}>Open this block, with its source</SectionLink>
    </div>
  )

  return (
    <SectionShell
      eyebrow="Blocks"
      title="From component to finished screen"
      lede="Assembled from the same parts, and nothing else — no block introduces a colour, a radius or a spacing value of its own. Sort the tables, open the dialogs, flip the switches: every control is wired."
      action={<SectionLink to="/blocks">All {blockCount} blocks</SectionLink>}
    >
      <Tabs
        label="Example screens"
        value={screen}
        onValueChange={(value) => setScreen(value as ScreenKey)}
        items={[
          { value: 'admin', label: 'Admin panel', content: frame('admin', <AdminBlock />) },
          { value: 'dashboard', label: 'Operations', content: frame('dashboard', <DashboardBlock embedded />) },
          { value: 'settings', label: 'Settings', content: frame('settings', <SettingsBlock />) },
          { value: 'login', label: 'Sign in', content: frame('login', <LoginBlock />) },
        ]}
      />
    </SectionShell>
  )
}

/* -------------------------------------------------------------- components */

const CUBE_FACES = [
  <FaceTile key="1" label="Tokens" value="31" />,
  <FaceTile key="2" label="Groups" value={String(groups.length)} />,
  <FaceTile key="3" label="Components" value={String(componentCount)} />,
  <FaceTile key="4" label="Blocks" value={String(blockCount)} />,
]

function FaceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-line bg-surface">
      <Text size="title" tabular>
        {value}
      </Text>
      <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
        {label}
      </Text>
    </div>
  )
}

/**
 * The parts, everyday and otherwise.
 *
 * One bento rather than two sections: the everyday components sit in the same
 * grid as the canvas and audio pieces, because the claim is that they are one
 * system, and splitting them would argue the opposite.
 */
function ComponentsBento() {
  const [notify, setNotify] = useState(true)
  const [threshold, setThreshold] = useState(64)

  return (
    <SectionShell
      eyebrow="Components"
      title="Everyday parts, and the ones nobody expects to find built"
      lede="Every tile is the component you would import, running. The board drags, the chart is drawn from an array, the switch switches, and every animated piece has a still state for reduced motion."
      action={<SectionLink to="/components">All {componentCount} components</SectionLink>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <ShowcaseTile className="md:col-span-2" name="DonutChart" slug="donut-chart">
          {/* No fixed height: the legend sits under the ring, and a fixed box
              is what clipped it. */}
          <div className="flex justify-center">
            <DonutChart
              label="Traffic by source"
              size={128}
              slices={[
                { id: 'direct', label: 'Direct', value: 48 },
                { id: 'search', label: 'Search', value: 32 },
                { id: 'social', label: 'Social', value: 20 },
              ]}
            />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="StatCard" slug="stat-card" plain>
          <StatCard
            icon={Package}
            title="Deploys"
            value="184"
            delta="+12"
            trend="up"
            caption="This quarter"
            meter={{ value: 184, total: 240, label: 'Quarterly target' }}
            className="h-full"
          />
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="Switch and Slider" slug="slider">
          <div className="flex h-[168px] flex-col justify-center gap-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Text size="heading">Notifications</Text>
                <Text size="caption" tone="faint">
                  Weekly digest, Mondays
                </Text>
              </div>
              <Switch
                checked={notify}
                onChange={(event) => setNotify(event.target.checked)}
                aria-label="Weekly digest"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Text size="caption" weight="semibold" tone="soft">
                  Alert threshold
                </Text>
                <Text size="caption" weight="bold" tabular>
                  {threshold}%
                </Text>
              </div>
              <Slider
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                aria-label="Alert threshold"
              />
            </div>
          </div>
        </ShowcaseTile>

        {/* A board people actually run their work on. Drag a card, or focus
            one and use its move controls — it really moves. */}
        <ShowcaseTile className="md:col-span-3" name="KanbanBoard" slug="kanban-board">
          <KanbanTile />
        </ShowcaseTile>

        {/* A foil card that tilts under the pointer. Ink on inverse ink rather
            than a fixed near-black, so it follows the theme like everything
            else on the page. It grows with its row, so the taller board beside
            it does not leave a gap underneath. */}
        <ShowcaseTile className="md:col-span-3" name="HoloCard" slug="holo-card" bare>
          <HoloCard radius="var(--radius-card)" className="min-h-[260px] flex-1">
            <div className="flex h-full min-h-[260px] flex-col justify-between bg-ink p-6">
              <div className="flex items-center justify-between">
                <Text
                  size="micro"
                  weight="bold"
                  className="uppercase tracking-[0.2em] text-ink-inverse/60"
                >
                  Foil
                </Text>
                <Text size="micro" weight="bold" tabular className="text-ink-inverse/60">
                  001 / {componentCount}
                </Text>
              </div>
              <div className="flex flex-col gap-1">
                <Text size="title" className="text-ink-inverse">
                  Hold the pointer
                </Text>
                <Text size="caption" leading="normal" className="text-ink-inverse/60">
                  The foil tracks where you are, the sparkle does not follow the tilt, and the whole
                  thing settles when you leave.
                </Text>
              </div>
            </div>
          </HoloCard>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="GlitchText" slug="glitch-text">
          <div className="grid h-[128px] place-items-center">
            <GlitchText className="text-[30px] font-extrabold tracking-[-0.03em]">corrupted</GlitchText>
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="GooeyLoader" slug="gooey-loader">
          <div className="grid h-[128px] place-items-center">
            <GooeyLoader label="Loading" size={92} />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="StreakCounter" slug="streak-counter">
          <div className="grid h-[128px] place-items-center">
            <StreakCounter days={14} todayDone milestone={30} />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="CubeCarousel" slug="cube-carousel">
          <div className="grid h-[168px] place-items-center">
            <CubeCarousel label="Four faces" size={116} autoRotate={3200} faces={CUBE_FACES} />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="BarList" slug="bar-list">
          <div className="flex h-[168px] flex-col justify-center">
            <BarList label="Top pages this week" items={TOP_PAGES} limit={3} />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="XPBar" slug="xp-bar">
          <div className="grid h-[168px] place-items-center px-2">
            <XPBar level={7} xp={340} needed={500} label="Reviewer" />
          </div>
        </ShowcaseTile>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <ShowcaseTile name="Terminal" slug="terminal" bare>
          <Terminal
            height={230}
            title="citrine — zsh"
            commands={['help', 'about', 'groups']}
            greeting={
              // The terminal is always dark — its colours are physical, not
              // thematic — so white stays white here in either theme.
              <>
                <span className="text-[color:var(--color-accent-strong)]">citrine</span> v1.0 — try{' '}
                <span className="text-white">groups</span>, then press ↑.
              </>
            }
            onCommand={(command, api) => {
              if (command === 'groups') {
                api.print(groups.map((group) => group.slug).join('  '))
              } else if (command === 'about') {
                api.print(`${componentCount} components. One accent drives all of them.`)
              } else if (command === 'help') {
                api.print('help · about · groups')
              } else {
                api.print(`command not found: ${command}`, 'error')
              }
            }}
          />
        </ShowcaseTile>

        {/* Beside the terminal: the other thing a developer reads all day. */}
        <ShowcaseTile name="JsonViewer" slug="json-viewer" bare>
          <JsonViewer label="Webhook payload" data={WEBHOOK} className="h-[230px] rounded-none" />
        </ShowcaseTile>
      </div>

      <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface py-3">
        <Marquee speed={26} fade pauseOnHover>
          {catalog
            // Every fifth name, minus the pieces taken off this page on purpose.
            .filter((entry, index) => index % 5 === 0 && !OFF_PAGE.has(entry.name))
            .map((entry) => (
              // Text, not links: Marquee clones its children behind aria-hidden
              // for the seamless loop, and a cloned link is a second tab stop
              // leading to the same page.
              <Text
                key={entry.slug}
                size="caption"
                weight="bold"
                tone="soft"
                className="whitespace-nowrap px-2"
              >
                {entry.name}
              </Text>
            ))}
        </Marquee>
      </div>
    </SectionShell>
  )
}

const BOARD: KanbanColumn[] = [
  {
    id: 'collect',
    title: 'To collect',
    cards: [
      { id: 'c1', title: 'MF-40231 · Porto', meta: <Tag>Chilled</Tag> },
      { id: 'c2', title: 'MF-40236 · Ghent' },
    ],
  },
  {
    id: 'transit',
    title: 'In transit',
    cards: [
      { id: 'c3', title: 'MF-40182 · Lyon', meta: <Tag tone="accent">On time</Tag> },
      { id: 'c4', title: 'MF-40188 · Kraków', meta: <Tag>At risk</Tag> },
    ],
  },
  {
    id: 'delivered',
    title: 'Delivered',
    cards: [{ id: 'c5', title: 'MF-40211 · Berlin', meta: <Tag tone="outline">Signed</Tag> }],
  },
]

/** The board keeps its own columns, so a drag on the landing page really moves a card. */
function KanbanTile() {
  const [columns, setColumns] = useState(BOARD)

  const move = (cardId: string, toColumnId: string, toIndex: number) => {
    setColumns((current) => {
      const card = current.flatMap((column) => column.cards).find((entry) => entry.id === cardId)
      if (!card) return current
      return current.map((column) => {
        const cards = column.cards.filter((entry) => entry.id !== cardId)
        if (column.id === toColumnId) cards.splice(toIndex, 0, card)
        return { ...column, cards }
      })
    })
  }

  return <KanbanBoard label="Dispatch board" columns={columns} onMove={move} className="w-full" />
}

/**
 * Components deliberately not shown on the landing page. They stay in the
 * library; this page leads with the ones people build products from.
 */
const OFF_PAGE = new Set(['MatrixRain', 'NeonSign', 'BoidsFlock', 'PianoKeys'])

const TOP_PAGES = [
  { id: 'pricing', label: '/pricing', value: 12_840 },
  { id: 'docs', label: '/docs/getting-started', value: 9_312 },
  { id: 'blocks', label: '/blocks/dashboard', value: 6_105 },
  { id: 'changelog', label: '/changelog', value: 3_870 },
  { id: 'careers', label: '/careers', value: 2_214 },
]

const WEBHOOK = {
  event: 'delivery.completed',
  id: 'evt_1Q8xR2',
  data: {
    shipment: 'MF-40211',
    signedBy: 'M. Laurent',
    onTime: true,
    minutesEarly: 14,
    proof: { photo: true, signature: true },
  },
  attempts: 1,
  receivedAt: '2026-09-11T09:30:04Z',
}

function ShowcaseTile({
  name,
  slug,
  children,
  className,
  bare = false,
  plain = false,
}: {
  name: string
  slug: string
  children: ReactNode
  className?: string
  /** Let the specimen reach the card edge — for the ones that fill a frame. */
  bare?: boolean
  /** The specimen is itself a card, so it gets no second one around it. */
  plain?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {plain ? (
        <div className="flex flex-1 flex-col">{children}</div>
      ) : (
        <Surface variant="card" padding={bare ? 'none' : 'lg'} className="flex-1 overflow-hidden">
          {children}
        </Surface>
      )}
      <SectionLink to={`/components/${slug}`}>{name}</SectionLink>
    </div>
  )
}

/* ----------------------------------------------------------------- one hue */

function OneHue() {
  const hex = useAccent()
  const mode = useMode()
  const family = deriveAccent(hex)

  const pick = (next: string) => {
    applyAccent(next)
    saveAccent(next)
  }

  const dark = mode === 'dark' || (mode === 'system' && systemMode() === 'dark')

  return (
    <SectionShell
      eyebrow="Theming"
      title="Pick a hue. Everything follows."
      lede="Four custom properties are derived from one colour — the accent, a darker press state, a pale wash, and the text that sits on top of it. Nothing else in the library hard-codes a colour, so the whole page repaints, this one included."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
        <Surface variant="card" padding="lg" className="gap-5">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const active = preset.hex.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => pick(preset.hex)}
                  aria-pressed={active}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span
                    className="h-11 w-11 rounded-[14px] border border-line-strong transition-transform group-hover:scale-105"
                    style={{
                      background: preset.hex,
                      outline: active ? '2px solid var(--color-ink)' : undefined,
                      outlineOffset: '2px',
                    }}
                  />
                  <Text size="micro" weight="bold" tone="faint">
                    {preset.name}
                  </Text>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Swatch token="--color-accent" value={family.accent} />
            <Swatch token="--color-accent-strong" value={family.strong} />
            <Swatch token="--color-accent-soft" value={dark ? family.softDark : family.soft} />
            <Swatch token="--color-accent-ink" value={family.ink} />
          </div>

          <ContrastReadout hex={hex} />
        </Surface>

        <BorderBeam radius="var(--radius-card)">
          <Surface variant="card" padding="lg" className="h-full justify-center gap-4">
            <Text as="h3" size="heading">
              Derived, not configured
            </Text>
            <Text size="caption" tone="soft" leading="normal">
              The press state is the same hue at a different lightness. The wash is the same hue,
              desaturated. The label colour is chosen by contrast — a tinted near-black where it
              reads, white where that is stronger — so every hue clears 4.5:1. Checked beside this
              for whichever one you pick.
            </Text>
            <CodeBlock
              language="ts"
              code={`import { applyAccent } from '${brand.pkg}'\n\napplyAccent('${hex}')`}
            />
          </Surface>
        </BorderBeam>
      </div>
    </SectionShell>
  )
}

function Swatch({ token, value }: { token: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="h-16 rounded-[var(--radius-tile)] border border-line"
        style={{ background: value }}
      />
      <div className="flex flex-col gap-0.5">
        <Text size="micro" weight="bold" className="font-mono">
          {token}
        </Text>
        <Text size="micro" tone="faint" className="font-mono uppercase">
          {value}
        </Text>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- ship it */

const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} kB`

const PATHS = [
  {
    step: '01',
    title: 'Install the package',
    body: 'Prebuilt CSS, ESM, one module per component with side effects declared. No Tailwind required, and nothing to configure.',
    code: `npm install ${brand.pkg}`,
    to: '/getting-started',
    link: 'Get started',
  },
  {
    step: '02',
    title: 'Or copy the source',
    body: 'Every component page ends with the real file. The CLI writes it — and everything it imports — into your project, with relative imports that resolve as they land.',
    code: `npx ${brand.pkg} add data-table`,
    to: '/components/data-table',
    link: 'See a Code section',
  },
  {
    step: '03',
    title: 'Hand it to your agent',
    body: `An MCP server ships in the package: ${mcpTools.length} tools over the real props, tokens and rules, so a coding agent stops guessing prop names.`,
    code: `claude mcp add ${brand.pkg} -- npx -y ${brand.pkg}-mcp`,
    to: '/agents',
    link: 'For AI agents',
  },
]

/**
 * How to take it, and what it costs.
 *
 * Three ways in, and all three read the same generated data — so the package,
 * the CLI and the MCP server can never disagree about a prop. The weights sit
 * underneath because they are the question that comes straight after "how".
 */
function ShipIt() {
  const weights = [
    { label: 'Median component', value: kb(library.median), caption: 'gzipped, dependencies included' },
    { label: 'Lightest', value: kb(library.lightest.gzip), caption: library.lightest.name },
    { label: 'Heaviest', value: kb(library.heaviest.gzip), caption: library.heaviest.name },
    { label: `All ${componentCount} at once`, value: kb(library.gzip), caption: 'the ceiling, not a bundle' },
  ]

  return (
    <SectionShell
      eyebrow="Ship it your way"
      title="Install it, copy it, or hand it to your agent"
      lede="Three ways in, one source of truth. The package, the CLI and the MCP server all read the same generated data, so none of them can disagree about a prop."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PATHS.map((path) => (
          <Surface key={path.step} variant="card" padding="lg" className="gap-4">
            <Text size="micro" weight="bold" tone="accent" tabular className="tracking-[0.18em]">
              {path.step}
            </Text>
            <div className="flex flex-col gap-1.5">
              <Text as="h3" size="heading">
                {path.title}
              </Text>
              <Text size="caption" tone="soft" leading="normal">
                {path.body}
              </Text>
            </div>
            <CodeBlock language="bash" code={path.code} highlight={false} />
            <div className="mt-auto">
              <SectionLink to={path.to}>{path.link}</SectionLink>
            </div>
          </Surface>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {weights.map((tile) => (
          <Surface key={tile.label} variant="card" padding="lg">
            <Metric label={tile.label} value={tile.value} caption={tile.caption} />
          </Surface>
        ))}
      </div>
      <Text size="caption" tone="faint" leading="normal" className="mt-3 max-w-[72ch]">
        What an import costs, measured on the built package over each component's whole dependency
        set — what a bundler adds for that one import. The last figure is every module at once: an
        upper bound, not something any app ships.
      </Text>
    </SectionShell>
  )
}

/* ---------------------------------------------------------------- platform */

const keyboardTested = Object.values(componentEvidence).filter((entry) => entry.keyboardSuite).length

/**
 * Everything that comes with the components, in one grid.
 *
 * Every count is read from the data the feature itself uses, and every tile
 * links to the working thing — the tour is a table of contents for the
 * platform, not a list of promises.
 */
const FEATURES: {
  icon: typeof Search
  title: string
  body: string
  to?: string
  link?: string
  hint?: ReactNode
}[] = [
  {
    icon: Search,
    title: 'Smart search',
    body: 'One palette over components, blocks, templates, recipes, tokens, docs and releases. It ranks, forgives a typo, and knows “login” means authentication.',
    hint: (
      <span className="inline-flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <Text as="span" size="caption" tone="faint">
          anywhere on the site
        </Text>
      </span>
    ),
  },
  {
    icon: Compass,
    title: 'Find My UI',
    body: 'Say what you are building and what it needs. Get the components, blocks, templates and recipes that fit — each with the reason it was picked.',
    to: '/find',
    link: 'Answer two questions',
  },
  {
    icon: PanelsTopLeft,
    title: `${templates.length} templates`,
    body: 'Sets of blocks that make a product together — a SaaS starter, an operations console, an auth kit — each one CLI command away.',
    to: '/templates',
    link: 'Browse the templates',
  },
  {
    icon: ChefHat,
    title: `${recipes.length} recipes`,
    body: 'How to build a login flow, a billing page or a data view, step by step, with code that uses only the props the components declare.',
    to: '/recipes',
    link: 'Read a recipe',
  },
  {
    icon: Plug,
    title: `${integrations.length} integrations`,
    body: 'React, Next.js, Vite, Tailwind, tokens, MCP, auth providers and Stripe — each with its setup and an honest status.',
    to: '/integrations',
    link: 'See how it fits your stack',
  },
  {
    icon: Check,
    title: 'Component health',
    body: `Every page shows a status and only the capabilities there is evidence for — ${keyboardTested} components are keyboard-tested, and a test fails if a claim appears without proof.`,
    to: '/components/data-table',
    link: 'See it on a component',
  },
  {
    icon: Blocks,
    title: 'Built With',
    body: `${showcase.length} interfaces made from the library, rendered live — with the components each one actually imports.`,
    to: '/built-with',
    link: 'See what it builds',
  },
  {
    icon: History,
    title: 'Changelog',
    body: 'Every released change is a real commit, with its hash. Unreleased work is marked as unreleased.',
    to: '/changelog',
    link: 'What shipped',
  },
]

const COMPOSER_SAMPLE = `import { Button, Card, Field, Input } from 'citrine'

export default function Screen() {
  return (
    <Card title="Welcome back">
      <Field label="Email">
        <Input type="email" />
      </Field>
      <Button fullWidth>Continue</Button>
    </Card>
  )
}`

function PlatformTour() {
  return (
    <SectionShell
      id="platform"
      eyebrow="More than components"
      title="Discover, compose, save and ship — in one place"
      lede="The components are the start. Around them sits everything you need to get from an idea to a production screen, built from the same design system and the same data."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Surface variant="card" padding="lg" className="gap-4 md:col-span-2 lg:row-span-2">
          <IconTile icon={WandSparkles} tone="accent" />
          <div className="flex flex-col gap-1.5">
            <Text as="h3" size="subtitle">
              Composer
            </Text>
            <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[52ch]">
              Build a screen from the real components and blocks. Drag, reorder, edit the props that
              matter, undo anything, preview it at desktop, tablet and phone widths — then take the code,
              with its imports, install commands and every dependency.
            </Text>
          </div>
          <CodeBlock language="tsx" code={COMPOSER_SAMPLE} copyable={false} />
          <div className="mt-auto flex flex-wrap items-center gap-3">
            <Button as={Link} to="/composer" size="sm">
              Open the Composer
              <ArrowRight size={14} aria-hidden />
            </Button>
            <Text size="caption" tone="faint">
              The code above is what it writes for a sign-in card.
            </Text>
          </div>
        </Surface>

        {FEATURES.map((feature) => (
          <Surface key={feature.title} variant="card" padding="lg" className="gap-3">
            <IconTile icon={feature.icon} tone="muted" />
            <div className="flex flex-col gap-1.5">
              <Text as="h3" size="heading">
                {feature.title}
              </Text>
              <Text size="caption" tone="soft" leading="normal">
                {feature.body}
              </Text>
            </div>
            <div className="mt-auto">
              {feature.to && feature.link ? <SectionLink to={feature.to}>{feature.link}</SectionLink> : feature.hint}
            </div>
          </Surface>
        ))}
      </div>
    </SectionShell>
  )
}

/* --------------------------------------------------------------- workspace */

const WORKSPACE_POINTS = [
  {
    icon: FolderOpen,
    title: 'Collections are documents',
    body: 'File components, blocks, templates, recipes and integrations into named collections — one per project, screen or client. Rename them, move items between them, empty them.',
  },
  {
    icon: WandSparkles,
    title: 'Compositions are documents',
    body: 'A Composer draft is a JSON composition. Save it, come back to it, copy it — or copy the code it becomes.',
  },
  {
    icon: Heart,
    title: 'Yours, and nobody else’s',
    body: 'No account and nothing sent anywhere: it lives in your browser, and the whole workspace exports as one JSON document from Saved. Syncing between devices is not available yet.',
  },
]

/**
 * The personal side of the library: what you save is a document you own.
 *
 * The document on the right is live — it is this visitor's own saved state,
 * read from the same store the Saved page writes. Only when they have saved
 * nothing yet does it show an example, and it says which one it is showing.
 */
function YourWorkspace() {
  const state = useSaved()
  const yours = state.favorites.length > 0 || state.collections.length > 0
  const document = yours
    ? {
        favorites: state.favorites,
        collections: state.collections.map((collection) => ({ name: collection.name, items: collection.items })),
      }
    : {
        favorites: ['component:data-table', 'block:login'],
        collections: [
          { name: 'SaaS dashboard', items: ['component:data-table', 'component:stat-card', 'block:saas-dashboard'] },
          { name: 'Authentication', items: ['block:login', 'block:signup', 'recipe:login-flow'] },
        ],
      }

  return (
    <SectionShell
      eyebrow="Your workspace"
      title="A personal, document-based workspace, included"
      lede="Keep the parts of the library you use as documents of your own — favourites, collections and Composer drafts. It comes with Citrine: no account, no extra install, nothing to set up."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          {WORKSPACE_POINTS.map((point) => (
            <Surface key={point.title} variant="card" padding="lg" className="flex-row items-start gap-4">
              <IconTile icon={point.icon} tone="accent" />
              <div className="flex flex-col gap-1.5">
                <Text as="h3" size="heading">
                  {point.title}
                </Text>
                <Text size="caption" tone="soft" leading="normal">
                  {point.body}
                </Text>
              </div>
            </Surface>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button as={Link} to="/saved">
              Open your workspace
            </Button>
            <Button as={Link} to="/composer" variant="outline">
              Start a composition
            </Button>
          </div>
        </div>

        <Surface variant="card" padding="lg" className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text as="h3" size="heading">
              {yours ? 'Your saved items, as a document' : 'A saved-items document'}
            </Text>
            <Tag size="sm" tone={yours ? 'accent' : 'neutral'}>
              {yours ? 'Live — yours' : 'Example'}
            </Tag>
          </div>
          <JsonViewer label="Saved items document" data={document} defaultExpandDepth={3} className="min-h-[260px]" />
          <Text size="caption" tone="faint" leading="normal">
            {yours
              ? 'Read from your browser as you look at it. Favourite something anywhere on the site and it appears here.'
              : 'Favourite anything on the site and this becomes your own document.'}
          </Text>
        </Surface>
      </div>
    </SectionShell>
  )
}

/* ------------------------------------------------------------------ groups */

function GroupGrid() {
  return (
    <SectionShell
      eyebrow="Everything, filed by what it is for"
      title={`${groups.length} groups, ${componentCount} components`}
      lede="From the type scale up to a Web Audio keyboard. Pick a group, or search the catalogue."
      action={<SectionLink to="/components">Open the catalogue</SectionLink>}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const count = catalog.filter((entry) => entry.group === group.id).length
          return (
            <Link
              key={group.id}
              to={`/components?group=${group.slug}`}
              className="group rounded-[var(--radius-card)]"
            >
              <Surface
                variant="card"
                padding="lg"
                className="h-full gap-2 transition-colors group-hover:bg-surface-sunken"
              >
                <div className="flex items-center justify-between gap-3">
                  <Text size="heading">{group.id}</Text>
                  <Text size="caption" weight="bold" tone="faint" tabular>
                    {count}
                  </Text>
                </div>
                <Text size="caption" tone="faint" leading="normal">
                  {group.tagline}
                </Text>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
                  Browse <ArrowRight size={12} aria-hidden />
                </span>
              </Surface>
            </Link>
          )
        })}
      </div>
    </SectionShell>
  )
}

/* -------------------------------------------------------------- principles */

const PRINCIPLES = [
  {
    icon: Wind,
    title: 'Reduced motion is a real state',
    body: 'Every animated component has a still state that still says what it means — not the animation with the movement deleted. The rule is checked per component and written on the page.',
  },
  {
    icon: Keyboard,
    title: 'Every gesture has a key',
    body: 'Swipe, drag, hold, pinch — each one has a keyboard path beside it, and the ARIA pattern that makes it announceable. A pointer is not a requirement.',
  },
  {
    icon: Package,
    title: 'No new tokens',
    body: 'Colour, radius, shadow and type come from one token file. A component that needed a new value would be a component that broke the system, so none of them ask for one.',
  },
]

function Principles() {
  return (
    <SectionShell eyebrow="Rules" title="The parts that are usually skipped">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {PRINCIPLES.map((principle) => (
          <Surface key={principle.title} variant="card" padding="lg" className="gap-3">
            <IconTile icon={principle.icon} tone="accent" />
            <Text as="h3" size="heading">
              {principle.title}
            </Text>
            <Text size="caption" tone="soft" leading="normal">
              {principle.body}
            </Text>
          </Surface>
        ))}
      </div>
    </SectionShell>
  )
}

/* ----------------------------------------------------------------- closing */

function Closing() {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-5 pb-24 lg:px-8">
      <Surface
        variant="card"
        padding="lg"
        className="items-center gap-5 overflow-hidden bg-accent py-20 text-center sm:py-28"
      >
        <Text as="h2" size="title" className="text-balance text-accent-ink sm:text-[32px]">
          Build the first screen today
        </Text>
        <Text
          size="body"
          weight="medium"
          leading="normal"
          className="max-w-[54ch] text-balance text-accent-ink opacity-80"
        >
          Start from a block, change the copy, pick one colour. {componentCountRounded} components and{' '}
          {blockCount} screens, every one of them copyable.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          <Button as={Link} to="/getting-started" variant="white">
            Get started
          </Button>
          <Link
            to="/composer"
            className="rounded-md text-[13px] font-bold text-accent-ink underline underline-offset-4"
          >
            Open the Composer
          </Link>
          <Link
            to="/blocks"
            className="rounded-md text-[13px] font-bold text-accent-ink underline underline-offset-4"
          >
            Browse the blocks
          </Link>
        </div>
      </Surface>
    </section>
  )
}

/* ------------------------------------------------------------------ shared */

/** The quiet "more of this" link used under tiles and beside section titles. */
function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 self-start rounded-md px-0.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:text-ink"
    >
      {children}
      <ArrowRight
        size={12}
        aria-hidden
        className="text-ink-faint transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function SectionShell({
  id,
  eyebrow,
  title,
  lede,
  action,
  children,
}: {
  /** An anchor, for links that jump to the section. */
  id?: string
  eyebrow: string
  title: string
  lede?: string
  /** A "see all" link, set against the title on wide screens. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1400px] scroll-mt-24 px-5 py-14 lg:px-8 lg:py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex max-w-[72ch] flex-col gap-2.5">
          <Text size="micro" weight="bold" tone="accent" className="uppercase tracking-[0.18em]">
            {eyebrow}
          </Text>
          <Text as="h2" size="title" className="max-w-[22ch] text-balance sm:text-[32px]">
            {title}
          </Text>
          {lede && (
            <Text size="body" weight="medium" tone="soft" leading="normal" className="text-balance">
              {lede}
            </Text>
          )}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
      {children}
    </section>
  )
}
