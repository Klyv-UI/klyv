import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Command, Keyboard, Package, Wind } from 'lucide-react'
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
  SegmentedControl,
  ShimmerButton,
  Slider,
  Sparkline,
  StatCard,
  StatusDot,
  StreakCounter,
  Surface,
  Switch,
  Tag,
  Terminal,
  Text,
  VisuallyHidden,
  XPBar,
  applyAccent,
  cn,
  systemMode,
  deriveAccent,
  saveAccent,
} from 'citrine'
import { AdminDemo } from '../components/AdminDemo'
import { ContrastReadout } from '../components/ContrastReadout'
import { useAccent, useMode } from '../components/useTheme'
import { brand } from '../brand'
import { catalog, componentCount } from '../data/catalog'
import { library } from '../data/sizes'
import { groups } from '../data/groups'

/**
 * The front page.
 *
 * Every specimen on it is a real component from the library, running — not a
 * screenshot and not a mock. That is the entire argument the page is making, so
 * faking any part of it would be self-defeating.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Wall />
      <Showcase />
      <AdminSection />
      <OneHue />
      <CopySection />
      <WeightSection />
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
              <StatusDot tone="success" />
              <Text size="micro" weight="bold" tone="soft">
                v1.0
              </Text>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
              <Text size="micro" weight="bold" tone="soft" tabular>
                {componentCount} components
              </Text>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
              <Text size="micro" weight="bold" tone="soft">
                3 runtime deps
              </Text>
            </span>
          </div>

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
            <Link to="/components" className="w-full sm:w-auto">
              <ShimmerButton size="lg" glow fullWidth>
                Browse {componentCount} components
              </ShimmerButton>
            </Link>
            <InstallChip />
          </div>

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
      className="group inline-flex h-11 items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 font-mono text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
    >
      <span>
        <span className="text-ink-faint">$</span> {command}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint group-hover:text-ink">
        {copied ? 'Copied' : 'Copy'}
      </span>
      <VisuallyHidden>
        <span role="status" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
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
 * usually is.
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
          className="gap-4 rotate-[-1.4deg] shadow-[var(--shadow-float)]"
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
          className="gap-4 rotate-[0.9deg] shadow-[var(--shadow-float)]"
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
          className="flex-row items-center justify-between gap-4 rotate-[-0.6deg] shadow-[var(--shadow-float)]"
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

/* ------------------------------------------------------------ specimen wall */

const TRAFFIC = [12, 18, 15, 24, 22, 31, 28, 38, 35, 44, 41, 52]

function Wall() {
  const [tab, setTab] = useState('week')
  const [notify, setNotify] = useState(true)
  const [budget, setBudget] = useState(64)

  return (
    <SectionShell
      eyebrow="Live, not screenshots"
      title="Every one of these is running"
      lede="The same components you would import. Poke at them — the switch switches, the slider slides, the chart is drawn from an array."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SpecimenCard className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Metric label="Monthly active" value="12,480" delta="+18.2%" trend="up" size="lg" />
            <SegmentedControl
              label="Range"
              size="sm"
              value={tab}
              onValueChange={setTab}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'year', label: 'Year' },
              ]}
            />
          </div>
          <Sparkline values={TRAFFIC} label="Monthly active users" area showLast height={72} />
        </SpecimenCard>

        <SpecimenCard>
          <DonutChart
            label="Traffic by source"
            size={148}
            slices={[
              { id: 'direct', label: 'Direct', value: 48 },
              { id: 'search', label: 'Search', value: 32 },
              { id: 'social', label: 'Social', value: 20 },
            ]}
          />
        </SpecimenCard>

        <SpecimenCard>
          <StatCard
            icon={Package}
            title="Deploys"
            value="184"
            delta="+12"
            trend="up"
            caption="This quarter"
            meter={{ value: 184, total: 240, label: 'Quarterly target' }}
          />
        </SpecimenCard>

        <SpecimenCard>
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
                {budget}%
              </Text>
            </div>
            <Slider
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              aria-label="Alert threshold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>New</Badge>
            <Tag tone="accent">v1.0</Tag>
            <Tag>tokens</Tag>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </SpecimenCard>

        <SpecimenCard>
          <div className="flex items-center justify-between gap-4">
            <AvatarGroup
              label="Reviewers"
              people={[
                { name: 'Ada Lovelace' },
                { name: 'Grace Hopper' },
                { name: 'Alan Turing' },
                { name: 'Katherine Johnson' },
                { name: 'Radia Perlman' },
              ]}
              max={4}
            />
            <ProgressRing value={72} label="Review progress" size="md" />
          </div>
          <Rating value={4} label="Documentation" readOnly />
          <div className="flex items-center gap-2">
            <IconTile icon={Bell} />
            <IconTile icon={Wind} tone="accent" />
            <IconTile icon={Command} />
          </div>
        </SpecimenCard>
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

function SpecimenCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Surface variant="card" padding="lg" className={`justify-center gap-5 ${className ?? ''}`}>
      {children}
    </Surface>
  )
}

/* ---------------------------------------------------------------- showcase */

const CUBE_FACES = [
  <FaceTile key="1" label="Tokens" value="42" />,
  <FaceTile key="2" label="Groups" value="12" />,
  <FaceTile key="3" label="Components" value="238" />,
  <FaceTile key="4" label="Runtime deps" value="3" />,
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
 * The other half of the library.
 *
 * A component set that stops at buttons and tables is a component set someone
 * has to leave to build the memorable part of their product. These are here
 * because they are the ones nobody expects to find already built.
 */
function Showcase() {
  return (
    <SectionShell
      eyebrow="It does not stop at buttons"
      title="The parts you would otherwise build yourself"
      lede="Canvas, Web Audio, physics and 3D transforms — all drawn by hand, all reduced-motion aware, all one import away."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        {/* Matrix rain, with a neon sign standing in front of it. */}
        <ShowcaseTile
          className="md:col-span-3"
          name="MatrixRain + NeonSign"
          slug="matrix-rain"
          bare
        >
          <div className="relative h-[260px] w-full overflow-hidden rounded-[var(--radius-card)]">
            <MatrixRain speed={0.7} />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <NeonSign color="var(--color-accent)" className="text-[34px]">
                CITRINE
              </NeonSign>
            </div>
          </div>
        </ShowcaseTile>

        {/* A foil card that tilts under the pointer. */}
        <ShowcaseTile className="md:col-span-3" name="HoloCard" slug="holo-card" bare>
          <HoloCard radius="var(--radius-card)" className="h-[260px]">
            <div className="flex h-[260px] flex-col justify-between bg-[#12141a] p-6">
              <div className="flex items-center justify-between">
                <Text size="micro" weight="bold" className="uppercase tracking-[0.2em] text-white/60">
                  Foil
                </Text>
                <Text size="micro" weight="bold" className="text-white/60">
                  001 / 238
                </Text>
              </div>
              <div className="flex flex-col gap-1">
                <Text size="title" className="text-white">
                  Hold the pointer
                </Text>
                <Text size="caption" className="text-white/60" leading="normal">
                  The foil tracks where you are, the sparkle does not follow the tilt, and the whole
                  thing settles when you leave.
                </Text>
              </div>
            </div>
          </HoloCard>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-2" name="GlitchText" slug="glitch-text">
          <div className="grid h-[128px] place-items-center">
            <GlitchText className="text-[30px] font-extrabold tracking-[-0.03em]">
              corrupted
            </GlitchText>
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
            <CubeCarousel
              label="Four faces"
              size={116}
              autoRotate={3200}
              faces={CUBE_FACES}
            />
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
    </SectionShell>
  )
}

function ShowcaseTile({
  name,
  slug,
  children,
  className,
  bare = false,
}: {
  name: string
  slug: string
  children: ReactNode
  className?: string
  /** Let the specimen reach the card edge — for the ones that fill a frame. */
  bare?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Surface variant="card" padding={bare ? 'none' : 'lg'} className="overflow-hidden">
        {children}
      </Surface>
      <Link
        to={`/components/${slug}`}
        className="group inline-flex items-center gap-1 self-start rounded-md px-0.5"
      >
        <Text size="caption" weight="bold" tone="soft" className="group-hover:text-ink">
          {name}
        </Text>
        <ArrowRight
          size={11}
          aria-hidden
          className="text-ink-faint transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ admin */

/**
 * A working product, not a gallery.
 *
 * The strongest thing a component library can show is the thing people are
 * actually about to build — so this is a real admin panel, assembled only from
 * components on this site, with every control wired up.
 */
function AdminSection() {
  return (
    <SectionShell
      eyebrow="Assembled, not illustrated"
      title="An admin panel, built from the same parts"
      lede="Sort the table, invite someone, change a role, remove a row and undo it. Nothing here is a mockup — it is DataTable, Modal, Select, Switch, StatCard, AreaChart and Toast, wired together the way you would wire them."
    >
      <AdminDemo />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Text size="caption" tone="faint" className="mr-1">
          Built from
        </Text>
        {ADMIN_PARTS.map((part) => (
          <Link
            key={part.slug}
            to={`/components/${part.slug}`}
            className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:text-ink"
          >
            {part.name}
          </Link>
        ))}
      </div>
    </SectionShell>
  )
}

const ADMIN_PARTS = [
  { name: 'DataTable', slug: 'data-table' },
  { name: 'Modal', slug: 'modal' },
  { name: 'Field', slug: 'field' },
  { name: 'Select', slug: 'select' },
  { name: 'Switch', slug: 'switch' },
  { name: 'SearchField', slug: 'search-field' },
  { name: 'StatCard', slug: 'stat-card' },
  { name: 'AreaChart', slug: 'area-chart' },
  { name: 'DonutChart', slug: 'donut-chart' },
  { name: 'Toast', slug: 'toast' },
  { name: 'Avatar', slug: 'avatar' },
  { name: 'Tag', slug: 'tag' },
]

/* ----------------------------------------------------------------- one hue */

function OneHue() {
  const hex = useAccent()
  const mode = useMode()
  const family = deriveAccent(hex)

  const pick = (next: string) => {
    applyAccent(next)
    saveAccent(next)
  }

  return (
    <SectionShell
      eyebrow="Theming"
      title="Pick a hue. Everything follows."
      lede="Four custom properties are derived from one colour — the accent, a darker press state, a pale wash, and the text that sits on top of it. Nothing else in the library hard-codes a colour, so the whole page repaints, this one included."
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <Surface variant="card" padding="lg" className="gap-5">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pick(preset.hex)}
                aria-pressed={preset.hex.toLowerCase() === hex.toLowerCase()}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className="h-11 w-11 rounded-[14px] border border-line-strong transition-transform group-hover:scale-105"
                  style={{
                    background: preset.hex,
                    outline:
                      preset.hex.toLowerCase() === hex.toLowerCase()
                        ? '2px solid var(--color-ink)'
                        : undefined,
                    outlineOffset: '2px',
                  }}
                />
                <Text size="micro" weight="bold" tone="faint">
                  {preset.name}
                </Text>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Swatch token="--color-accent" value={family.accent} />
            <Swatch token="--color-accent-strong" value={family.strong} />
            <Swatch
              token="--color-accent-soft"
              value={mode === 'dark' || (mode === 'system' && systemMode() === 'dark') ? family.softDark : family.soft}
            />
            <Swatch token="--color-accent-ink" value={family.ink} />
          </div>

          <ContrastReadout hex={hex} />
        </Surface>

        <BorderBeam radius="var(--radius-card)">
          <Surface variant="card" padding="lg" className="h-full justify-center gap-4">
            <Text size="heading">Derived, not configured</Text>
            <Text size="caption" tone="soft" leading="normal">
              The press state is the same hue at a different lightness. The wash is the same hue,
              desaturated. The label colour is chosen by contrast — a tinted near-black where it
              reads, white where that is stronger — so every hue clears 4.5:1. Checked below for
              whichever one you pick.
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

/* ------------------------------------------------------------------- copy */

const SNIPPET = `import { DataTable, Metric, Sparkline } from '${brand.pkg}'

export function Overview({ rows }: { rows: Row[] }) {
  return (
    <>
      <Metric label="Monthly active" value="12,480" delta="+18.2%" trend="up" />
      <Sparkline values={rows.map((row) => row.total)} label="Volume" area />
      <DataTable rows={rows} columns={columns} />
    </>
  )
}`

function CopySection() {
  return (
    <SectionShell
      eyebrow="Developer experience"
      title="Read the page, take the file"
      lede="Every component page ends with its own implementation — the real file, read off disk at build time, with a copy button. No wrapper to unpick, no build step to reverse-engineer."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Surface variant="card" padding="lg" className="gap-4">
          <Text size="heading">Import it</Text>
          <CodeBlock language="tsx" code={SNIPPET} />
        </Surface>

        <div className="flex flex-col gap-3">
          <Feature
            title="The source is the source"
            body="The Code section on a page loads the same file the preview above it is running. It cannot drift, because there is no second copy."
          />
          <Feature
            title="Typed, and documented where it matters"
            body="Every prop table is written next to its examples. Types come from the implementation, so the table and the compiler never disagree."
          />
          <Feature
            title="No lock-in"
            body="Three runtime dependencies: React, clsx and tailwind-merge. Icons are a structural type, so bring whichever set you already use."
          />
        </div>
      </div>
    </SectionShell>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <Surface variant="card" padding="lg" className="gap-1.5">
      <Text size="heading">{title}</Text>
      <Text size="caption" tone="soft" leading="normal">
        {body}
      </Text>
    </Surface>
  )
}

/* ------------------------------------------------------------------ weight */

const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} kB`

/**
 * What an import costs, measured.
 *
 * Headline numbers rather than a chart: the reader's question is "how heavy",
 * and four figures answer it faster than a distribution would. Every figure is
 * read off the built package over a component's whole dependency set.
 */
function WeightSection() {
  const tiles = [
    { label: 'Median component', value: kb(library.median), caption: 'gzipped, dependencies included' },
    { label: 'Lightest', value: kb(library.lightest.gzip), caption: library.lightest.name },
    { label: 'Heaviest', value: kb(library.heaviest.gzip), caption: library.heaviest.name },
    { label: `All ${componentCount} at once`, value: kb(library.gzip), caption: 'the ceiling, not a bundle' },
  ]

  return (
    <SectionShell
      eyebrow="Weight"
      title="What an import actually costs"
      lede="Measured on the built package, over each component's whole dependency set — what a bundler adds for that one import. ESM with side effects declared, so the rest is dropped. The last figure is every module at once: an upper bound, not something any app ships."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Surface key={tile.label} variant="card" padding="lg">
            <Metric label={tile.label} value={tile.value} caption={tile.caption} />
          </Surface>
        ))}
      </div>
      <Text size="caption" tone="faint" leading="normal" className="mt-3 max-w-[72ch]">
        Two runtime dependencies, clsx and tailwind-merge, shared by everything after the first
        import. Every component page shows its own figure.
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
            <Text size="heading">{principle.title}</Text>
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
        <Text size="title" className="text-accent-ink">
          Start with a button
        </Text>
        <Text
          size="body"
          weight="medium"
          leading="normal"
          className="max-w-[52ch] text-accent-ink opacity-80"
        >
          Or a Sankey diagram, a signature pad, or a terminal with working history. They are all one
          page away, and all copyable.
        </Text>
        <Link to="/components">
          <Button variant="white" size="md">
            Browse all {componentCount}
          </Button>
        </Link>
      </Surface>
    </section>
  )
}

/* ------------------------------------------------------------------ shared */

function SectionShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-5 py-14 lg:px-8 lg:py-20">
      <div className="mb-8 flex flex-col gap-2.5">
        <Text size="micro" weight="bold" tone="accent" className="uppercase tracking-[0.18em]">
          {eyebrow}
        </Text>
        <Text as="h2" size="title" className="max-w-[22ch] text-balance sm:text-[32px]">
          {title}
        </Text>
        {lede && (
          <Text
            size="body"
            weight="medium"
            tone="soft"
            leading="normal"
            className="max-w-[72ch] text-balance"
          >
            {lede}
          </Text>
        )}
      </div>
      {children}
    </section>
  )
}
