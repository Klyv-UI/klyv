import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, BarChart3, GitMerge, Wrench } from 'lucide-react'
import {
  CommitGraph,
  CronEditor,
  ErrorBudget,
  FlameGraph,
  ForecastChart,
  FormulaEditor,
  HexbinChart,
  JsonDiff,
  LazyMount,
  NaturalDateInput,
  RegexTester,
  Reveal,
  Tabs,
  Tag,
  Text,
  ThreeWayMerge,
  TraceWaterfall,
  VisuallyHidden,
} from 'klyv'
import {
  BUDGET_WINDOW,
  COMMITS,
  CONFIG_AFTER,
  CONFIG_BEFORE,
  LOG_LINES,
  MERGE_BASE,
  MERGE_OURS,
  MERGE_THEIRS,
  PROFILE,
  QUOTE_CELLS,
  REGEX,
  TRACE,
  budgetSamples,
  latency,
  signupDay,
  signups,
} from './toolkit-data'
import { LandingSection, SectionLink, WindowDots } from './primitives'

/**
 * The panels a team would otherwise spend a sprint on — a trace waterfall, a
 * forecast, a three-way merge — as four kinds of product screen, each made of
 * components from the latest release, running on seeded data.
 *
 * Screens shows that the library can assemble a whole page; this shows how
 * deep a single part of one goes. Tabs mounts only the open panel, so four
 * screens cost the page one, and LazyMount holds the space until the section
 * nears the viewport.
 */
const SCREENS = [
  { value: 'observability', label: 'Observability', icon: Activity },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'tools', label: 'Developer tools', icon: Wrench },
  { value: 'review', label: 'Code review', icon: GitMerge },
] as const

type Screen = (typeof SCREENS)[number]['value']

export function Toolkit() {
  const [screen, setScreen] = useState<Screen>('observability')

  return (
    <LandingSection
      id="toolkit"
      index={4}
      eyebrow="In depth"
      title="Profilers, forecasts and merge tools,"
      tail="already built and already themed"
      lede="Profilers, error budgets, forecasts, regex and cron editors, merge tools. Select a span, zoom the profile, resolve a conflict: every panel below is one import, and every one of them is wired."
      action={<SectionLink to="/components?new=1">Everything new in this release</SectionLink>}
    >
      <Reveal>
        <LazyMount rootMargin="400px" minHeight={640}>
          <div className="overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface shadow-[var(--shadow-window)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
              <WindowDots />
              <Text as="span" size="caption" weight="bold" className="text-[13px]">
                acme.app/operations
              </Text>
              <Tag size="sm" tone="accent" className="ml-auto hidden sm:inline-flex">
                Live — not screenshots
              </Tag>
            </div>

            <div className="bg-[color-mix(in_oklab,var(--color-app)_70%,transparent)] p-3 sm:p-5">
              <Tabs
                label="Product screens"
                className="[&>[role=tablist]]:max-w-full [&>[role=tablist]]:self-start [&>[role=tablist]]:overflow-x-auto"
                value={screen}
                onValueChange={(value) => setScreen(value as Screen)}
                items={SCREENS.map((entry) => ({
                  value: entry.value,
                  label: entry.label,
                  icon: entry.icon,
                  content: (
                    <div className="mt-1">
                      {entry.value === 'observability' && <Observability />}
                      {entry.value === 'analytics' && <Analytics />}
                      {entry.value === 'tools' && <DeveloperTools />}
                      {entry.value === 'review' && <CodeReview />}
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        </LazyMount>
      </Reveal>
    </LandingSection>
  )
}

/* ------------------------------------------------------------------ frame */

/**
 * A running component in a frame: its name in code type and a link to its
 * page along the top, the component itself underneath. The frame is the only
 * thing here that is not the library.
 */
function Specimen({ name, slug, note, children }: { name: string; slug: string; note?: string; children: ReactNode }) {
  return (
    <figure className="landing-card flex w-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <figcaption className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-strong" />
        <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
          {`<${name} />`}
        </Text>
        {note && (
          <Text as="span" size="caption" tone="faint" truncate className="hidden text-[12px] md:inline">
            {note}
          </Text>
        )}
        <Link
          to={`/components/${slug}`}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-[12px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Docs
          <ArrowUpRight size={12} aria-hidden />
          <VisuallyHidden>for {name}</VisuallyHidden>
        </Link>
      </figcaption>
      <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
    </figure>
  )
}

/** The bento every screen shares: one lead panel, two beside it. */
function Bento({ lead, first, second }: { lead: ReactNode; first: ReactNode; second: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="flex min-w-0 lg:col-span-7 lg:row-span-2">{lead}</div>
      <div className="flex min-w-0 lg:col-span-5">{first}</div>
      <div className="flex min-w-0 lg:col-span-5">{second}</div>
    </div>
  )
}

/* ---------------------------------------------------------------- screens */

function Observability() {
  return (
    <Bento
      lead={
        <Specimen name="TraceWaterfall" slug="trace-waterfall" note="Critical path marked; select a span">
          <TraceWaterfall spans={TRACE} label="Checkout request trace" defaultSelected="sql" />
        </Specimen>
      }
      first={
        <Specimen name="FlameGraph" slug="flame-graph" note="Click a frame to zoom">
          <FlameGraph profile={PROFILE} label="Checkout request profile" unit="samples" showControls={false} rowHeight={20} />
        </Specimen>
      }
      second={
        <Specimen name="ErrorBudget" slug="error-budget" note="Burn-rate alerts included">
          <ErrorBudget
            samples={budgetSamples()}
            target={0.999}
            window={BUDGET_WINDOW}
            height={150}
            label="Checkout availability error budget, 18 days into a 30-day window"
          />
        </Specimen>
      }
    />
  )
}

function Analytics() {
  const [formula, setFormula] = useState('=SUM(B1*C1, B2*C2, B3*C3)')
  return (
    <Bento
      lead={
        <Specimen name="ForecastChart" slug="forecast-chart" note="Holt–Winters, fitted in the browser">
          <ForecastChart
            values={signups()}
            period={7}
            horizon={14}
            confidence={0.9}
            formatX={signupDay}
            height={300}
            label="Daily sign-ups with a two-week forecast"
          />
        </Specimen>
      }
      first={
        <Specimen name="HexbinChart" slug="hexbin-chart" note="2,600 requests, binned">
          <HexbinChart
            points={latency()}
            label="Response time against payload size"
            xLabel="Payload (kB)"
            yLabel="Latency (ms)"
            showRadiusControl={false}
            defaultRadius={12}
            height={220}
          />
        </Specimen>
      }
      second={
        <Specimen name="FormulaEditor" slug="formula-editor" note="Type a function name">
          <FormulaEditor label="Quote total" value={formula} onValueChange={setFormula} cells={QUOTE_CELLS} />
        </Specimen>
      }
    />
  )
}

function DeveloperTools() {
  return (
    <Bento
      lead={
        <Specimen name="RegexTester" slug="regex-tester" note="Named groups, explained token by token">
          <RegexTester defaultValue={REGEX} defaultText={LOG_LINES} />
        </Specimen>
      }
      first={
        <Specimen name="CronEditor" slug="cron-editor" note="The next runs, in your time zone">
          <CronEditor label="Nightly export" defaultValue="30 2 * * MON-FRI" count={3} />
        </Specimen>
      }
      second={
        <Specimen name="NaturalDateInput" slug="natural-date-input" note="Try “next fri 3pm”">
          <NaturalDateInput label="Deploy window" />
        </Specimen>
      }
    />
  )
}

function CodeReview() {
  return (
    <Bento
      lead={
        <Specimen name="ThreeWayMerge" slug="three-way-merge" note="Pick a side, or keep both">
          <ThreeWayMerge base={MERGE_BASE} ours={MERGE_OURS} theirs={MERGE_THEIRS} oursLabel="main" theirsLabel="feature/plans" />
        </Specimen>
      }
      first={
        <Specimen name="CommitGraph" slug="commit-graph" note="Lanes drawn from parents">
          <CommitGraph commits={COMMITS} label="Recent history" maxHeight={260} />
        </Specimen>
      }
      second={
        <Specimen name="JsonDiff" slug="json-diff" note="Structural, not line by line">
          <JsonDiff before={CONFIG_BEFORE} after={CONFIG_AFTER} beforeLabel="deployed" afterLabel="proposed" />
        </Specimen>
      }
    />
  )
}
