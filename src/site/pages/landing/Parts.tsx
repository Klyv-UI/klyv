import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { CommitGraph, FlameGraph, HoloCard, JsonViewer, LazyMount, Marquee, Reveal, Surface, SunburstChart, Terminal, Text, cn } from 'klyv'
import { catalog, componentCount } from '../../data/catalog'
import { groups } from '../../data/groups'
import { LandingSection, SectionLink } from './primitives'

/** Two belts of names, drawn from across the catalogue rather than its first letters. */
const BELT_A = catalog.filter((_, index) => index % 5 === 0).slice(0, 36).map((entry) => entry.name)
const BELT_B = catalog.filter((_, index) => index % 5 === 2).slice(0, 36).map((entry) => entry.name)

/** The closing cell's span, by how many groups the last row already holds. Static strings, so Tailwind sees them. */
const FILL_SM = ['sm:col-span-2', 'sm:col-span-1'] as const
const FILL_LG = ['lg:col-span-4', 'lg:col-span-3', 'lg:col-span-2', 'lg:col-span-1'] as const

/**
 * The range: the everyday parts are already running on the workbench in the
 * hero, so this section shows the breadth — the names rolling past, a few of
 * the components nobody expects to find built, and the whole catalogue by
 * what it is for.
 */
export function Parts() {
  return (
    <LandingSection
      id="components"
      index={6}
      eyebrow="Components"
      title="Everyday parts,"
      tail="and the ones you would otherwise build yourself"
      lede="The workbench above is the everyday end of the range. Here is how far it goes — a git graph, a zoomable sunburst, a profiler's flame graph. Every tile is the component you would import, running."
      action={<SectionLink to="/components">All {componentCount} components</SectionLink>}
    >
      {/* The names roll past as texture, so they are hidden from assistive
          technology; the index at the foot of the section is the way in. */}
      <div aria-hidden className="-mx-5 mb-10 flex flex-col gap-2.5 lg:-mx-8">
        <Belt names={BELT_A} speed={90} />
        <Belt names={BELT_B} speed={120} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Ink on inverse ink rather than a fixed near-black, so the foil card
            follows the theme like everything else on the page. */}
        <ShowcaseTile name="HoloCard" slug="holo-card" bare>
          <HoloCard radius="var(--radius-card)" className="min-h-[240px] flex-1">
            <div className="flex h-full min-h-[240px] flex-col justify-between bg-ink p-6">
              <Text size="micro" weight="bold" tabular className="uppercase tracking-[0.2em] text-ink-inverse/70">
                Foil · 001 / {componentCount}
              </Text>
              <div className="flex flex-col gap-1">
                <Text size="subtitle" className="text-ink-inverse">
                  Hold the pointer
                </Text>
                <Text size="caption" leading="normal" className="text-ink-inverse/70">
                  The foil tracks where you are and settles when you leave.
                </Text>
              </div>
            </div>
          </HoloCard>
        </ShowcaseTile>

        <ShowcaseTile name="Terminal" slug="terminal" bare>
          <Terminal
            height={240}
            title="klyv — zsh"
            commands={['help', 'about', 'groups']}
            greeting={
              // The terminal is always dark — its colours are physical, not
              // thematic — so white stays white here in either theme, and the
              // accent is lifted towards white: accent-strong alone reads at
              // 4:1 on the terminal under a grey accent.
              <>
                <span className="text-[color-mix(in_oklab,var(--color-accent)_75%,#ffffff)]">klyv</span> v1.0 — try{' '}
                <span className="text-white">groups</span>, then press ↑.
              </>
            }
            onCommand={(command, api) => {
              if (command === 'groups') api.print(groups.map((group) => group.slug).join('  '))
              else if (command === 'about') api.print(`${componentCount} components. One accent drives all of them.`)
              else if (command === 'help') api.print('help · about · groups')
              else api.print(`command not found: ${command}`, 'error')
            }}
          />
        </ShowcaseTile>

        <ShowcaseTile name="JsonViewer" slug="json-viewer" bare>
          <JsonViewer label="Webhook payload" data={WEBHOOK} className="h-[240px] rounded-none" />
        </ShowcaseTile>

        {/* The second row is the newer end of the catalogue — a git graph with
            its lanes worked out from parent hashes, a zoomable sunburst, and a
            flame graph read from collapsed stacks. They mount only once the row
            nears the viewport, which is LazyMount, which is also one of them. */}
        <ShowcaseTile name="CommitGraph" slug="commit-graph" bare>
          <LazyMount minHeight={240}>
            <CommitGraph commits={COMMITS} label="Recent history" maxHeight={240} />
          </LazyMount>
        </ShowcaseTile>

        <ShowcaseTile name="SunburstChart" slug="sunburst-chart">
          <LazyMount minHeight={240}>
            <SunburstChart
              data={BUNDLE}
              label="Bundle by folder"
              valueLabel="Size"
              size={240}
              format={(value) => `${value} kB`}
              className="mx-auto"
            />
          </LazyMount>
        </ShowcaseTile>

        <ShowcaseTile name="FlameGraph" slug="flame-graph" bare>
          <LazyMount minHeight={240}>
            <div className="h-[240px] overflow-y-auto p-4">
              <FlameGraph profile={PROFILE} label="Request profile" unit="samples" showControls={false} rowHeight={19} />
            </div>
          </LazyMount>
        </ShowcaseTile>
      </div>

      {/* The whole catalogue, by what it is for — the index a visitor scans
          before they know a component's name. */}
      <Reveal>
        <nav aria-label="Component groups" className="mt-10 flex flex-col gap-4">
          <Text as="h3" size="heading" className="text-center">
            Browse by what it is for
          </Text>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => (
              <li key={group.id} className="bg-surface">
                <Link
                  to={`/components?group=${group.slug}`}
                  className="group flex h-full items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <Text as="span" size="body" weight="bold" className="text-[14px]">
                      {group.id}
                    </Text>
                    <Text as="span" size="caption" tone="faint" truncate>
                      {group.sections.slice(0, 3).join(' · ')}
                    </Text>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Text as="span" size="caption" weight="bold" tone="faint" tabular>
                      {catalog.filter((entry) => entry.group === group.id).length}
                    </Text>
                    <ArrowRight
                      size={12}
                      aria-hidden
                      className="text-ink-faint opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              </li>
            ))}
            {/* The way into everything, sized to whatever the last row has left,
                so the grid never ends on an empty slab of hairline colour. */}
            <li className={cn('bg-surface', FILL_SM[groups.length % 2], FILL_LG[groups.length % 4])}>
              <Link
                to="/components"
                className="group flex h-full items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <Text as="span" size="body" weight="bold" className="text-[14px]">
                  All {componentCount} components
                </Text>
                <ArrowRight size={14} aria-hidden className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </li>
          </ul>
        </nav>
      </Reveal>
    </LandingSection>
  )
}

/** One rolling belt of component names. Paused on hover, still under reduced motion. */
function Belt({ names, speed }: { names: string[]; speed: number }) {
  return (
    <Marquee speed={speed}>
      {names.map((name) => (
        <span
          key={name}
          className="mr-2.5 inline-flex h-9 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink-soft shadow-[var(--shadow-tile)]"
        >
          {name}
        </span>
      ))}
    </Marquee>
  )
}

/** A short history with a merge in it, so the lanes have something to draw. */
const COMMITS = [
  { hash: 'c15b9a7f', parents: ['4564ef60', '9a1e9d51'], message: 'Merge branch “showpieces”', author: 'Mara Lindqvist', date: 'Sep 21', refs: ['main'] },
  { hash: '9a1e9d51', parents: ['647f4e02'], message: 'Cloth, fluid and light, tagged as showpieces', author: 'Ade Okonkwo', date: 'Sep 20' },
  { hash: '4564ef60', parents: ['647f4e02'], message: 'Seventy components the library did not have', author: 'Mara Lindqvist', date: 'Sep 19' },
  { hash: '647f4e02', parents: ['aabb1c63'], message: 'A theme engine, and a customiser for it', author: 'Jonas Field', date: 'Sep 18', tags: ['v1.0.0'] },
  { hash: 'aabb1c63', parents: [], message: 'Merge four components that repeated each other', author: 'Ade Okonkwo', date: 'Sep 17' },
]

/**
 * One request, as collapsed stacks — the format `stackcollapse` emits, which
 * is what FlameGraph reads. Samples, so the widths are the time each frame
 * held the stack.
 */
const PROFILE = [
  'server;route;auth;verifyToken 38',
  'server;route;auth;loadSession;redis.get 64',
  'server;route;handler;parseBody 41',
  'server;route;handler;query;planner 96',
  'server;route;handler;query;execute;scan 214',
  'server;route;handler;query;execute;sort 73',
  'server;route;handler;serialize 57',
  'server;route;render;template 88',
  'server;route;render;hydrate 35',
  'server;gc 29',
].join('\n')

/** A bundle, by folder — the tree a sunburst was made for. */
const BUNDLE = {
  id: 'bundle',
  label: 'bundle',
  children: [
    {
      id: 'app',
      label: 'app',
      children: [
        { id: 'routes', label: 'routes', value: 82 },
        { id: 'state', label: 'state', value: 41 },
        { id: 'forms', label: 'forms', value: 28 },
      ],
    },
    {
      id: 'ui',
      label: 'ui',
      children: [
        { id: 'charts', label: 'charts', value: 64 },
        { id: 'tables', label: 'tables', value: 37 },
        { id: 'overlays', label: 'overlays', value: 22 },
      ],
    },
    {
      id: 'vendor',
      label: 'vendor',
      children: [
        { id: 'react', label: 'react', value: 46 },
        { id: 'router', label: 'router', value: 18 },
      ],
    },
  ],
}

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
}: {
  name: string
  slug: string
  children: ReactNode
  className?: string
  /** Let the specimen reach the card edge — for the ones that fill a frame. */
  bare?: boolean
}) {
  return (
    // `min-w-0`: a grid item is as wide as its content by default, and a
    // specimen's own scroller could push the whole page sideways on a phone.
    <Reveal className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Surface variant="card" padding={bare ? 'none' : 'lg'} className="landing-card flex-1 overflow-hidden">
        {children}
      </Surface>
      <SectionLink to={`/components/${slug}`}>{name}</SectionLink>
    </Reveal>
  )
}
