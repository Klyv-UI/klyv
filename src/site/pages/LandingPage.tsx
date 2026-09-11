import { Suspense, lazy, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Keyboard, Package, Wind } from 'lucide-react'
import {
  ACCENT_PRESETS,
  AvatarGroup,
  Badge,
  BoidsFlock,
  BorderBeam,
  Button,
  CodeBlock,
  CubeCarousel,
  DonutChart,
  GlitchText,
  GooeyLoader,
  HoloCard,
  IconTile,
  Kbd,
  Marquee,
  MatrixRain,
  Metric,
  NeonSign,
  PianoKeys,
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
} from 'citrine'
import { ContrastReadout } from '../components/ContrastReadout'
import { useAccent, useMode } from '../components/useTheme'
import { brand } from '../brand'
import { blockCount } from '../data/blocks'
import { catalog, componentCount } from '../data/catalog'
import { groups } from '../data/groups'
import { mcpTools } from '../data/mcp'
import { library } from '../data/sizes'

/**
 * The front page.
 *
 * It tells the library's story in the order a visitor asks it: what is this,
 * can it build a real screen, what are the parts, can I make it mine, and how
 * do I start. Every specimen on it is a real component, running — not a
 * screenshot and not a mock. That is the entire argument the page is making, so
 * faking any part of it would be self-defeating.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <FactsBand />
      <BlocksShowcase />
      <ComponentsBento />
      <OneHue />
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
          <Link
            to="/blocks"
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-line-strong"
          >
            <Badge>New</Badge>
            <Text as="span" size="micro" weight="bold" tone="soft">
              {blockCount} production blocks, built from the library
            </Text>
            <ArrowRight
              size={12}
              aria-hidden
              className="text-ink-faint transition-transform group-hover:translate-x-0.5"
            />
          </Link>

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
              Browse {componentCount} components
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
      lede="Every tile is the component you would import, running. The chart is drawn from an array, the switch switches, and the canvas pieces are reduced-motion aware."
      action={<SectionLink to="/components">All {componentCount} components</SectionLink>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <ShowcaseTile className="md:col-span-2" name="DonutChart" slug="donut-chart">
          <div className="grid h-[168px] place-items-center">
            <DonutChart
              label="Traffic by source"
              size={148}
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

        {/* Matrix rain, with a neon sign standing in front of it. */}
        <ShowcaseTile className="md:col-span-3" name="MatrixRain + NeonSign" slug="matrix-rain" bare>
          <div className="relative h-[260px] w-full overflow-hidden rounded-[var(--radius-card)]">
            <MatrixRain speed={0.7} />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <NeonSign color="var(--color-accent)" className="text-[34px]">
                CITRINE
              </NeonSign>
            </div>
          </div>
        </ShowcaseTile>

        {/* A foil card that tilts under the pointer. Ink on inverse ink rather
            than a fixed near-black, so it follows the theme like everything
            else on the page. */}
        <ShowcaseTile className="md:col-span-3" name="HoloCard" slug="holo-card" bare>
          <HoloCard radius="var(--radius-card)" className="h-[260px]">
            <div className="flex h-[260px] flex-col justify-between bg-ink p-6">
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

        <ShowcaseTile className="md:col-span-2" name="BoidsFlock" slug="boids-flock" bare>
          <div className="h-[168px] w-full overflow-hidden rounded-[var(--radius-card)]">
            <BoidsFlock count={140} />
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

        <ShowcaseTile name="PianoKeys" slug="piano-keys">
          <div className="flex h-[230px] flex-col justify-center gap-3">
            <PianoKeys keys={7} />
            <Text size="caption" tone="faint" leading="normal">
              Real oscillators with a twelve-millisecond attack, because a gain that jumps straight
              to one clicks. Sound is on — the home row plays it.
            </Text>
          </div>
        </ShowcaseTile>
      </div>

      <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface py-3">
        <Marquee speed={26} fade pauseOnHover>
          {catalog
            .filter((_, index) => index % 5 === 0)
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
        className="items-center gap-4 overflow-hidden bg-accent py-16 text-center"
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
          Start from a block, change the copy, pick one colour. {componentCount} components and{' '}
          {blockCount} screens, every one of them copyable.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          <Button as={Link} to="/getting-started" variant="white">
            Get started
          </Button>
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
  eyebrow,
  title,
  lede,
  action,
  children,
}: {
  eyebrow: string
  title: string
  lede?: string
  /** A "see all" link, set against the title on wide screens. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-5 py-14 lg:px-8 lg:py-20">
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
