import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import {
  BarList,
  DonutChart,
  HoloCard,
  JsonViewer,
  KanbanBoard,
  Reveal,
  Slider,
  StatCard,
  Surface,
  Switch,
  Tag,
  Terminal,
  Text,
  cn,
  type KanbanColumn,
} from 'citrine'
import { catalog, componentCount } from '../../data/catalog'
import { groups } from '../../data/groups'
import { LandingSection, SectionLink } from './primitives'

/**
 * The parts, everyday and otherwise, then the whole catalogue by what it is
 * for.
 *
 * Every tile is the component you would import, running: the board drags, the
 * chart is drawn from an array, the terminal answers. The tiles lead with the
 * parts products are built from; the more playful pieces are one click away in
 * the catalogue rather than competing for the first impression.
 */
export function Parts() {
  const [notify, setNotify] = useState(true)
  const [threshold, setThreshold] = useState(64)

  return (
    <LandingSection
      id="components"
      eyebrow="Components"
      title="Everyday parts, and the ones nobody expects to find built"
      lede="Every tile below is the component you would import, running — not a picture of it."
      action={<SectionLink to="/components">All {componentCount} components</SectionLink>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <ShowcaseTile className="md:col-span-2" name="DonutChart" slug="donut-chart">
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
          <div className="flex h-full min-h-[168px] flex-col justify-center gap-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Text size="heading">Notifications</Text>
                <Text size="caption" tone="faint">
                  Weekly digest, Mondays
                </Text>
              </div>
              <Switch checked={notify} onChange={(event) => setNotify(event.target.checked)} aria-label="Weekly digest" />
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
              <Slider value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} aria-label="Alert threshold" />
            </div>
          </div>
        </ShowcaseTile>

        {/* A board people actually run their work on. Drag a card, or focus one
            and use its move controls — it really moves. */}
        <ShowcaseTile className="md:col-span-4" name="KanbanBoard" slug="kanban-board">
          <KanbanTile />
        </ShowcaseTile>

        {/* Ink on inverse ink rather than a fixed near-black, so the foil card
            follows the theme like everything else on the page. */}
        <ShowcaseTile className="md:col-span-2" name="HoloCard" slug="holo-card" bare>
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

        <ShowcaseTile className="md:col-span-3 lg:col-span-2" name="BarList" slug="bar-list">
          <div className="flex h-full min-h-[200px] flex-col justify-center">
            <BarList label="Top pages this week" items={TOP_PAGES} limit={4} />
          </div>
        </ShowcaseTile>

        <ShowcaseTile className="md:col-span-3 lg:col-span-2" name="Terminal" slug="terminal" bare>
          <Terminal
            height={200}
            title="citrine — zsh"
            commands={['help', 'about', 'groups']}
            greeting={
              // The terminal is always dark — its colours are physical, not
              // thematic — so white stays white here in either theme, and the
              // accent is lifted towards white: accent-strong alone reads at
              // 4:1 on the terminal under a grey accent.
              <>
                <span className="text-[color-mix(in_oklab,var(--color-accent)_75%,#ffffff)]">citrine</span> v1.0 — try{' '}
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

        <ShowcaseTile className="md:col-span-6 lg:col-span-2" name="JsonViewer" slug="json-viewer" bare>
          <JsonViewer label="Webhook payload" data={WEBHOOK} className="h-[200px] rounded-none" />
        </ShowcaseTile>
      </div>

      {/* The whole catalogue, by what it is for — the index a visitor scans
          before they know a component's name. */}
      <Reveal>
        <nav aria-label="Component groups" className="mt-10 flex flex-col gap-4">
          <Text as="h3" size="heading">
            Browse by what it is for
          </Text>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => (
              <li key={group.id} className="bg-surface">
                <Link
                  to={`/components?group=${group.slug}`}
                  className="flex h-full items-baseline justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Text as="span" size="body" weight="bold">
                      {group.id}
                    </Text>
                    <Text as="span" size="micro" tone="faint" truncate>
                      {group.sections.slice(0, 3).join(' · ')}
                    </Text>
                  </span>
                  <Text as="span" size="caption" weight="bold" tone="faint" tabular>
                    {catalog.filter((entry) => entry.group === group.id).length}
                  </Text>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Reveal>
    </LandingSection>
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
    <Reveal className={cn('flex flex-col gap-2', className)}>
      {plain ? (
        <div className="flex flex-1 flex-col">{children}</div>
      ) : (
        <Surface variant="card" padding={bare ? 'none' : 'lg'} className="flex-1 overflow-hidden">
          {children}
        </Surface>
      )}
      <SectionLink to={`/components/${slug}`}>{name}</SectionLink>
    </Reveal>
  )
}
