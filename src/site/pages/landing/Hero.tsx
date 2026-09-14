import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CodeXml, Eye, Palette } from 'lucide-react'
import {
  ACCENT_PRESETS,
  Badge,
  Button,
  Card,
  CodeBlock,
  SegmentedControl,
  Switch,
  Text,
  VisuallyHidden,
  applyAccent,
  cn,
  deriveAccent,
  saveAccent,
} from 'citrine'
import { useAccent } from '../../components/useTheme'
import { brand } from '../../brand'
import { blockCount } from '../../data/blocks'
import { componentCount } from '../../data/catalog'
import { InstallCommand, TokenSwatch, WindowDots } from './primitives'

/**
 * What the hero says under the pitch. Facts the strip and the cards below do
 * not already repeat: the counts live there, the compatibility lives here.
 */
const FACTS = ['React 18 and 19', 'TypeScript · ESM', 'Server Components']

/** Where an element falls in the hero's entrance; `.landing-enter` reads it. */
const enter = (ms: number) => ({ '--enter-delay': `${ms}ms` }) as CSSProperties

/**
 * The hero: what this is, in one sentence, and the product doing it.
 *
 * The visual is not a screenshot. It is a small window onto the three things
 * the library does for one screen — the screen itself, built from real
 * components; the code that produces it; and the one colour that themes it —
 * and each tab is live.
 */
export function Hero() {
  return (
    // Pulled up under the header, which stays clear here until the page
    // scrolls, so the grid and the wash reach the top of the window.
    <section aria-labelledby="hero-title" className="relative -mt-[73px] overflow-hidden border-b border-line pt-[73px]">
      {/* A hairline grid, faded out from the top left, and one faint wash of the
          accent. Both are drawn from tokens, so they repaint with the rest. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(var(--color-line-strong)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-strong)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(70%_60%_at_20%_0%,#000_10%,transparent_75%)]"
      />
      {/* Two washes — the accent behind the product, its softer tint low on the
          left — oversized so their slow drift never shows an edge. */}
      <div
        aria-hidden
        className="landing-drift pointer-events-none absolute -inset-[8%] bg-[radial-gradient(42%_48%_at_80%_28%,color-mix(in_oklab,var(--color-accent)_15%,transparent),transparent_70%),radial-gradient(34%_40%_at_8%_92%,color-mix(in_oklab,var(--color-accent-soft)_50%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="flex min-w-0 flex-col items-start">
          <a
            href="#platform"
            style={enter(0)}
            className="landing-enter group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 shadow-[var(--shadow-tile)] transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Badge>New</Badge>
            <Text as="span" size="label" weight="semibold" tone="soft" truncate className="text-[11px] sm:text-[12px]">
              Composer, smart search<span className="hidden sm:inline"> and a personal workspace</span>
            </Text>
            <ArrowRight size={12} aria-hidden className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </a>

          <h1
            id="hero-title"
            style={enter(60)}
            className="landing-enter mt-7 max-w-[15ch] text-balance text-[44px] font-extrabold leading-[0.98] tracking-[-0.05em] text-ink sm:text-[60px] lg:text-[64px] xl:text-[70px]"
          >
            Production React UI, themed by{' '}
            {/* A flat marker under the words rather than a gradient: the accent
                is the subject of the sentence, so it is the accent exactly. */}
            <span className="relative isolate whitespace-nowrap">
              <span aria-hidden className="landing-mark absolute inset-x-[-0.06em] bottom-[0.06em] -z-10 h-[0.34em] rounded-[0.08em] bg-accent" />
              one colour
            </span>
          </h1>

          <Text
            size="body"
            weight="medium"
            tone="soft"
            style={enter(120)}
            className="landing-enter mt-6 max-w-[52ch] text-pretty text-[16px] leading-[1.65] sm:text-[17px]"
          >
            {componentCount} accessible components and {blockCount} finished screens. Install them, copy them as
            source, or assemble them in the Composer — then change one colour and every one of them follows.
          </Text>

          {/* The hero's buttons are a step up from the library default: this is
              the one place on the page where the next move has to be obvious. */}
          <div style={enter(180)} className="landing-enter mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              as={Link}
              to="/getting-started"
              className="group h-11 px-6 text-[14px] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_45%,#ffffff),0_10px_24px_-14px_color-mix(in_oklab,var(--color-accent-strong)_90%,var(--color-ink))] transition-[background-color,box-shadow,transform] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_45%,#ffffff),0_14px_28px_-14px_color-mix(in_oklab,var(--color-accent-strong)_90%,var(--color-ink))] active:translate-y-px motion-reduce:transition-none"
            >
              Get started
              <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Button>
            <Button
              as={Link}
              to="/composer"
              variant="outline"
              className="h-11 px-6 text-[14px] transition-[background-color,transform] active:translate-y-px motion-reduce:transition-none"
            >
              Open the Composer
            </Button>
          </div>

          <div style={enter(220)} className="landing-enter mt-4 w-full sm:w-auto">
            <InstallCommand className="w-full sm:w-auto" />
          </div>

          {/* Set off by a hairline: the pitch ends above it, the evidence starts. */}
          <ul
            aria-label="At a glance"
            style={enter(260)}
            className="landing-enter mt-10 flex w-full max-w-[600px] flex-wrap gap-x-5 gap-y-2.5 border-t border-line pt-6"
          >
            {FACTS.map((fact) => (
              <li key={fact} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="grid size-4 place-items-center rounded-full bg-accent-soft text-ink">
                  <Check size={10} strokeWidth={3} />
                </span>
                <Text as="span" size="label" weight="semibold" tone="soft">
                  {fact}
                </Text>
              </li>
            ))}
          </ul>
        </div>

        <ProductWindow />
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- product window */

type View = 'preview' | 'code' | 'theme'

const HERO_CODE = `import { useState } from 'react'
import { Button, Card, SegmentedControl, Switch, Text } from '${brand.pkg}'

const TOPICS = [
  { id: 'mentions', label: 'Mentions', hint: 'When someone @mentions you' },
  { id: 'digest', label: 'Weekly digest', hint: 'A summary every Monday' },
  { id: 'releases', label: 'Product updates', hint: 'New components and releases' },
]

export default function Notifications() {
  const [on, setOn] = useState<Record<string, boolean>>({ mentions: true, digest: true })
  const [channel, setChannel] = useState('email')
  const count = TOPICS.filter((topic) => on[topic.id]).length

  return (
    <Card title="Notifications" className="gap-4">
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {TOPICS.map((topic) => (
          <li key={topic.id}>
            <label className="flex items-center justify-between gap-4 py-3">
              <span className="flex flex-col gap-0.5">
                <Text as="span" size="label" weight="semibold">{topic.label}</Text>
                <Text as="span" size="caption" tone="faint">{topic.hint}</Text>
              </span>
              <Switch
                switchSize="sm"
                checked={Boolean(on[topic.id])}
                onChange={(event) => setOn({ ...on, [topic.id]: event.target.checked })}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <Text as="span" size="label" weight="semibold">Deliver by</Text>
        <SegmentedControl
          label="Deliver by"
          size="sm"
          value={channel}
          onValueChange={setChannel}
          options={[
            { value: 'email', label: 'Email' },
            { value: 'slack', label: 'Slack' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Text as="span" size="caption" tone="faint">{count} of {TOPICS.length} on</Text>
        <Button size="sm">Save</Button>
      </div>
    </Card>
  )
}`

function ProductWindow() {
  const [view, setView] = useState<View>('preview')

  return (
    <div style={enter(200)} className="landing-enter relative mx-auto w-full min-w-0 max-w-[620px] lg:max-w-none">
      {/* Accent light falling behind the window, so it sits in the page rather than on it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -inset-y-14 bg-[radial-gradient(50%_50%_at_50%_50%,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent_72%)]"
      />
      {/* A translucent bezel around the window, its corner concentric with the window's. */}
      <div className="relative rounded-[calc(var(--radius-card)+7px)] border border-line bg-[color-mix(in_oklab,var(--color-surface)_50%,transparent)] p-1.5 shadow-[var(--shadow-window)]">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-line px-3 py-2.5 sm:justify-between sm:gap-3 sm:px-4">
          {/* The chrome steps out on a phone — the labelled view switch needs
              the whole bar there, and a second row of dots added nothing. */}
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <WindowDots />
            <Text as="span" size="caption" weight="semibold" tone="faint" className="truncate font-mono">
              Notifications.tsx
            </Text>
          </div>
          <SegmentedControl<View>
            label="Example view"
            size="sm"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'preview', label: 'Preview', icon: Eye },
              { value: 'code', label: 'Code', icon: CodeXml },
              { value: 'theme', label: 'Theme', icon: Palette },
            ]}
          />
        </div>

        {/* One fixed height for all three views, so switching never moves the page. */}
        <div className="h-[440px] overflow-y-auto">
          {/* Keyed by view, so each one fades in as it is chosen. */}
          <div key={view} className="landing-fade h-full">
            {view === 'preview' && <PreviewView />}
            {view === 'code' && (
              <div className="p-3 sm:p-4 [&_pre]:text-[12px]">
                <CodeBlock language="tsx" code={HERO_CODE} numbered />
              </div>
            )}
            {view === 'theme' && <ThemeView />}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <Text as="span" size="caption" tone="faint" className="inline-flex items-center gap-2">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-strong" />
            Card · Switch · SegmentedControl · Button
          </Text>
          <Link to="/composer" className="group inline-flex min-h-6 items-center gap-1 rounded-md text-[12px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Build your own in the Composer
            <ArrowRight size={12} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
      </div>
      </div>
    </div>
  )
}

const TOPICS = [
  { id: 'mentions', label: 'Mentions', hint: 'When someone @mentions you' },
  { id: 'digest', label: 'Weekly digest', hint: 'A summary every Monday' },
  { id: 'releases', label: 'Product updates', hint: 'New components and releases' },
]

type Channel = 'email' | 'slack' | 'both'

/**
 * The screen itself — a settings card that works, not a picture of one.
 *
 * Deliberately not a sign-in form: a login in the hero read as "you need an
 * account to use this", and browsers autofilled real credentials into it.
 * Preferences have no fields to autofill, and show more of the library.
 */
function PreviewView() {
  const [on, setOn] = useState<Record<string, boolean>>({ mentions: true, digest: true })
  const [channel, setChannel] = useState<Channel>('email')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const count = TOPICS.filter((topic) => on[topic.id]).length

  const save = () => {
    setState('saving')
    window.setTimeout(() => setState('saved'), 700)
  }

  return (
    <div className="landing-dots grid min-h-full place-items-center bg-app p-5 sm:p-8">
      {/* h2, not h3: the hero has only its h1 above this, and a level may not be
          skipped. Card stacks its header and body with no gap of its own, so the
          gap is set here. */}
      <Card title="Notifications" headingLevel="h2" className="w-full max-w-[380px] gap-4 shadow-[var(--shadow-float)]">
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {TOPICS.map((topic) => (
            <li key={topic.id}>
              <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" size="label" weight="semibold">
                    {topic.label}
                  </Text>
                  <Text as="span" size="caption" tone="faint">
                    {topic.hint}
                  </Text>
                </span>
                <Switch
                  switchSize="sm"
                  checked={Boolean(on[topic.id])}
                  onChange={(event) => {
                    setOn({ ...on, [topic.id]: event.target.checked })
                    setState('idle')
                  }}
                />
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <Text as="span" size="label" weight="semibold">
            Deliver by
          </Text>
          <SegmentedControl<Channel>
            label="Deliver by"
            size="sm"
            value={channel}
            onValueChange={(value) => {
              setChannel(value)
              setState('idle')
            }}
            options={[
              { value: 'email', label: 'Email' },
              { value: 'slack', label: 'Slack' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <Text as="span" size="caption" tone="faint" aria-live="polite" className="inline-flex items-center gap-1.5">
            {state === 'saved' ? (
              <>
                <Check size={13} strokeWidth={2.5} aria-hidden className="text-ink-soft" />
                Saved
              </>
            ) : (
              `${count} of ${TOPICS.length} on`
            )}
          </Text>
          <Button size="sm" loading={state === 'saving'} onClick={save}>
            Save
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** The one colour, and the four values derived from it. */
function ThemeView() {
  const hex = useAccent()
  const family = deriveAccent(hex)

  const pick = (next: string) => {
    applyAccent(next)
    saveAccent(next)
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <Text size="heading">Pick an accent</Text>
        <Text size="caption" tone="soft" leading="normal">
          The whole page repaints — this window, the header, every button. Nothing in the library names a colour.
        </Text>
      </div>

      <div className="flex flex-wrap gap-2">
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
                'size-10 rounded-[12px] border border-line-strong transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100',
                active && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
              )}
              style={{ background: preset.hex }}
            >
              <VisuallyHidden>{preset.name}</VisuallyHidden>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TokenSwatch compact token="--color-accent" value={family.accent} />
        <TokenSwatch compact token="--color-accent-strong" value={family.strong} />
        <TokenSwatch compact token="--color-accent-soft" value={family.soft} />
        <TokenSwatch compact token="--color-accent-ink" value={family.ink} />
      </div>

      <CodeBlock language="ts" code={`import { applyAccent } from '${brand.pkg}'\n\napplyAccent('${hex}')`} />
    </div>
  )
}
