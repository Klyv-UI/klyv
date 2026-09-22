import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import {
  Avatar,
  Badge,
  Button,
  DashboardGrid,
  Grid,
  GridItem,
  HighlightMatch,
  LiveRegion,
  MasterDetail,
  NavigationProgress,
  PriorityNav,
  SearchField,
  SegmentedControl,
  ShowMoreList,
  Sticky,
  Surface,
  Text,
  TextLink,
  useAnnounce,
  type DashboardGridItem,
  type PriorityNavItem,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ Grid */

const METRICS = [
  ['Net revenue', '$184,210', '+12.4%'],
  ['Active seats', '1,284', '+38'],
  ['Churned accounts', '9', '−3'],
  ['Open invoices', '$22,940', '14 due'],
  ['Avg. deal size', '$6,120', '+4.1%'],
  ['Trial conversions', '31%', '+2 pts'],
]

function GridExample() {
  const [mode, setMode] = useState<'columns' | 'fit'>('columns')
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Column mode"
        size="sm"
        value={mode}
        onValueChange={setMode}
        className="self-start"
        options={[
          { value: 'columns', label: 'columns={{ base: 1, sm: 2, lg: 3 }}' },
          { value: 'fit', label: 'minItemWidth={200}' },
        ]}
      />
      <Grid
        {...(mode === 'columns' ? { columns: { base: 1, sm: 2, lg: 3 } as const } : { minItemWidth: 200 })}
        gap={3}
        as="ul"
        aria-label="Quarter metrics"
      >
        <GridItem as="li" span="full">
          <Surface variant="sunken" padding="md" className="flex items-center justify-between gap-3">
            <Text size="heading">Q3 overview</Text>
            <Badge tone="accent">Live</Badge>
          </Surface>
        </GridItem>
        {METRICS.map(([label, value, delta]) => (
          <li key={label}>
            <Surface variant="card" padding="lg" className="flex h-full flex-col gap-1.5">
              <Text size="caption" tone="faint">
                {label}
              </Text>
              <Text size="subtitle">{value}</Text>
              <Text size="caption" weight="semibold" tone="soft">
                {delta}
              </Text>
            </Surface>
          </li>
        ))}
      </Grid>
      <Text size="caption" tone="faint">
        The heading spans the full row in either mode, however many columns there are.
      </Text>
    </div>
  )
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-12 items-center justify-center rounded-[var(--radius-glyph)] bg-[color-mix(in_oklab,var(--color-accent)_22%,var(--color-surface))] text-[12px] font-bold text-ink">
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ TextLink */

/** Stands in for a router’s Link: it takes `to` and does not reload the page. */
function DemoRouterLink({ to, onClick, ...props }: ComponentPropsWithoutRef<'a'> & { to: string }) {
  return (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
    />
  )
}

/* ------------------------------------------------------------------ LiveRegion */

function SaveControls({ onLog }: { onLog: (entry: string) => void }) {
  const announce = useAnnounce()
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() => {
          announce('Draft saved')
          onLog('polite · Draft saved')
        }}
      >
        Save draft
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          announce('3 invoices match “overdue”')
          onLog('polite · 3 invoices match “overdue”')
        }}
      >
        Filter overdue
      </Button>
      <Button
        size="sm"
        variant="muted"
        onClick={() => {
          announce('Payment failed: card declined', 'assertive')
          onLog('assertive · Payment failed: card declined')
        }}
      >
        Retry payment
      </Button>
    </div>
  )
}

function LiveRegionExample() {
  const [log, setLog] = useState<string[]>([])
  return (
    <LiveRegion>
      <div className="flex w-full flex-col gap-3">
        <SaveControls onLog={(entry) => setLog((current) => [entry, ...current].slice(0, 5))} />
        <Surface variant="sunken" padding="md" className="flex flex-col gap-1">
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            What a screen reader hears
          </Text>
          {log.length === 0 ? (
            <Text size="label" tone="soft">
              Nothing yet. Press Save draft twice — the second press is spoken too.
            </Text>
          ) : (
            <ol className="flex flex-col gap-0.5">
              {log.map((entry, index) => (
                <li key={`${entry}-${log.length - index}`} className="text-[12px] font-medium text-ink-soft">
                  {entry}
                </li>
              ))}
            </ol>
          )}
        </Surface>
      </div>
    </LiveRegion>
  )
}

/* ------------------------------------------------------------------ HighlightMatch */

const PEOPLE = [
  ['Zoë Laurent', 'Head of Design · Montréal'],
  ['José Álvarez', 'Staff Engineer · Sevilla'],
  ['Søren Østergaard', 'Finance Lead · København'],
  ['Anna Nováková', 'Support · Brno'],
  ['Joanna Price', 'Account Executive · New York'],
  ['Chloé Dubois', 'Product Manager · Lyon'],
  ['Renée O’Connor', 'Growth · Dublin'],
]

function HighlightMatchExample() {
  const [query, setQuery] = useState('zoe montreal')
  const [wordStart, setWordStart] = useState<'anywhere' | 'start'>('anywhere')
  const results = PEOPLE.filter(([name, role]) => {
    const words = query.trim().split(/\s+/).filter(Boolean)
    return words.length === 0 || HighlightMatchFilter(`${name} ${role}`, words)
  })
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <SearchField label="Search people" value={query} onValueChange={setQuery} placeholder="Try “an”, “cafe”, “(”" />
      <SegmentedControl
        label="Match position"
        size="sm"
        value={wordStart}
        onValueChange={setWordStart}
        className="self-start"
        options={[
          { value: 'anywhere', label: 'Anywhere' },
          { value: 'start', label: 'Word start' },
        ]}
      />
      <ul aria-label="People" className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {results.map(([name, role]) => (
          <li key={name} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar name={name} size="sm" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-bold text-ink">
                <HighlightMatch text={name} query={query} wordStart={wordStart === 'start'} />
              </span>
              <span className="text-[12px] font-medium text-ink-soft">
                <HighlightMatch text={role} query={query} wordStart={wordStart === 'start'} />
              </span>
            </div>
          </li>
        ))}
        {results.length === 0 && <li className="px-4 py-6 text-center text-[12px] font-medium text-ink-faint">No one matches “{query}”.</li>}
      </ul>
    </div>
  )
}

/** Every word matches somewhere, ignoring case and accents — the same folding HighlightMatch uses. */
function HighlightMatchFilter(text: string, words: string[]) {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const haystack = fold(text)
  return words.every((word) => haystack.includes(fold(word)))
}

/* ------------------------------------------------------------------ Sticky */

const TRANSACTIONS = [
  ['Figma', 'Software', '−$45.00'],
  ['Stripe payout', 'Income', '+$12,480.00'],
  ['WeWork', 'Office', '−$1,200.00'],
  ['AWS', 'Infrastructure', '−$3,912.18'],
  ['Linear', 'Software', '−$96.00'],
  ['Deel', 'Payroll', '−$28,400.00'],
  ['United Airlines', 'Travel', '−$642.30'],
  ['Notion', 'Software', '−$120.00'],
  ['Customer refund', 'Income', '−$240.00'],
  ['Gusto', 'Payroll', '−$9,875.00'],
  ['Vercel', 'Infrastructure', '−$400.00'],
  ['Slack', 'Software', '−$218.75'],
]

function StickyExample() {
  const [stuckCount, setStuckCount] = useState(0)
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        role="region"
        aria-label="September transactions"
        tabIndex={0}
        className="h-72 overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface"
      >
        <Sticky
          onStuckChange={(stuck) => stuck && setStuckCount((count) => count + 1)}
          className="border-b border-transparent bg-surface transition-[box-shadow,border-color] data-[stuck]:border-line data-[stuck]:shadow-[var(--shadow-float)]"
        >
          {({ stuck }) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Text size="heading">September · 12 transactions</Text>
              <Badge tone={stuck ? 'accent' : 'neutral'}>{stuck ? 'Pinned' : 'At rest'}</Badge>
            </div>
          )}
        </Sticky>
        <ul className="flex flex-col">
          {TRANSACTIONS.map(([name, category, amount]) => (
            <li key={name} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-bold text-ink">{name}</span>
                <span className="text-[11px] font-medium text-ink-faint">{category}</span>
              </div>
              <span className="text-[13px] font-bold tabular-nums text-ink">{amount}</span>
            </li>
          ))}
        </ul>
      </div>
      <Text size="caption" tone="faint">
        Scroll the panel. The header has pinned {stuckCount} {stuckCount === 1 ? 'time' : 'times'}.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ MasterDetail */

interface Message {
  id: string
  from: string
  subject: string
  preview: string
  time: string
  body: string[]
}

const MESSAGES: Message[] = [
  {
    id: 'm1',
    from: 'Priya Raman',
    subject: 'Q3 budget sign-off',
    preview: 'Attached the final numbers for marketing…',
    time: '9:42',
    body: ['Attached the final numbers for marketing. The events line came in 8% under plan.', 'Can you sign off by Thursday so finance can close the quarter?'],
  },
  {
    id: 'm2',
    from: 'Marcus Chen',
    subject: 'Incident review: checkout latency',
    preview: 'Root cause was a cold cache after the deploy…',
    time: '8:15',
    body: ['Root cause was a cold cache after the 07:50 deploy. p95 recovered within 11 minutes.', 'Action items are in the doc; two need an owner.'],
  },
  {
    id: 'm3',
    from: 'Elena Petrova',
    subject: 'Offer letter for the design role',
    preview: 'Draft is ready for your review…',
    time: 'Yesterday',
    body: ['Draft is ready for your review. Start date is flexible to early November.', 'Legal has approved the equity wording.'],
  },
  {
    id: 'm4',
    from: 'Tomás Herrera',
    subject: 'Renewal: Northwind Traders',
    preview: 'They want to move to annual billing…',
    time: 'Mon',
    body: ['They want to move to annual billing and add 40 seats.', 'Discount request is 12%; I think 8% lands it.'],
  },
]

function MasterDetailExample() {
  const [width, setWidth] = useState<'wide' | 'narrow'>('wide')
  const [selected, setSelected] = useState<string | null>('m1')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Container width"
        size="sm"
        value={width}
        onValueChange={setWidth}
        className="self-start"
        options={[
          { value: 'wide', label: 'Wide' },
          { value: 'narrow', label: 'Phone width' },
        ]}
      />
      <Surface variant="card" className={width === 'narrow' ? 'h-[380px] w-full max-w-[340px] overflow-hidden' : 'h-[380px] w-full overflow-hidden'}>
        <MasterDetail
          items={MESSAGES}
          itemId={(message) => message.id}
          itemLabel={(message) => message.subject}
          value={selected}
          onValueChange={setSelected}
          label="Inbox"
          className="h-full"
          renderItem={(message, { selected: isSelected }) => (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center justify-between gap-2">
                <span className={isSelected ? 'truncate text-[13px] font-bold text-ink' : 'truncate text-[13px] font-semibold'}>{message.from}</span>
                <span className="shrink-0 text-[11px] font-medium text-ink-faint">{message.time}</span>
              </span>
              <span className="truncate text-[12px] font-semibold text-ink">{message.subject}</span>
              <span className="truncate text-[11px] font-medium text-ink-faint">{message.preview}</span>
            </span>
          )}
          renderDetail={(message) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={message.from} size="sm" />
                <Text size="label" weight="semibold">
                  {message.from} · {message.time}
                </Text>
              </div>
              {message.body.map((paragraph) => (
                <Text key={paragraph} size="body" weight="medium" tone="soft" leading="normal">
                  {paragraph}
                </Text>
              ))}
            </div>
          )}
        />
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ DashboardGrid */

const WIDGETS: Record<string, { title: string; value: string; note: string; bars: number[] }> = {
  revenue: { title: 'Revenue', value: '$184.2k', note: '+12.4% vs Q2', bars: [40, 52, 48, 61, 70, 66, 82] },
  signups: { title: 'Sign-ups', value: '2,318', note: '+302 this week', bars: [22, 30, 28, 35, 44, 41, 50] },
  churn: { title: 'Churn', value: '1.8%', note: 'Down from 2.3%', bars: [60, 55, 52, 48, 44, 40, 38] },
  tickets: { title: 'Open tickets', value: '47', note: '6 breaching SLA', bars: [30, 34, 29, 40, 38, 45, 47] },
  nps: { title: 'NPS', value: '62', note: '418 responses', bars: [50, 54, 58, 55, 60, 61, 62] },
}

const DEFAULT_LAYOUT: DashboardGridItem[] = [
  { id: 'revenue', span: 2 },
  { id: 'signups', span: 1 },
  { id: 'churn', span: 1 },
  { id: 'tickets', span: 1 },
  { id: 'nps', span: 3 },
]

function DashboardGridExample() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text size="caption" tone="faint">
          Drag a handle, or focus it and press Space, then the arrow keys.
        </Text>
        <Button size="sm" variant="outline" onClick={() => setLayout(DEFAULT_LAYOUT)}>
          Reset layout
        </Button>
      </div>
      <DashboardGrid
        label="Revenue dashboard"
        value={layout}
        onValueChange={setLayout}
        widgetTitle={(item) => WIDGETS[item.id].title}
        renderWidget={(item) => {
          const widget = WIDGETS[item.id]
          return (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <Text size="amount">{widget.value}</Text>
                <Text size="caption" tone="faint">
                  {widget.note}
                </Text>
              </div>
              <div aria-hidden="true" className="mt-auto flex h-10 items-end gap-1">
                {widget.bars.map((bar, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t-[3px] bg-[color-mix(in_oklab,var(--color-accent-strong)_70%,transparent)]"
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div>
            </div>
          )
        }}
      />
      <Text size="caption" tone="faint" className="font-mono">
        {layout.map((item) => `${item.id}:${item.span}`).join('  ')}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ ShowMoreList */

const CONTRIBUTORS = [
  'Ada Park', 'Bruno Silva', 'Chen Wei', 'Dara Okafor', 'Elif Kaya', 'Farah Nadeem', 'Gus Holm', 'Hana Sato',
  'Ivo Marić', 'Jun Ito', 'Kofi Mensah', 'Lena Vogel', 'Mira Shah', 'Nils Berg', 'Omar Haddad', 'Pia Lund',
  'Quinn Ross', 'Rae Kim', 'Sana Iqbal', 'Theo Grant', 'Uma Rao', 'Vik Das', 'Wen Li', 'Yara Costa',
].map((name, index) => ({ name, commits: 212 - index * 8 }))

function ShowMoreListExample() {
  return (
    <Surface variant="card" padding="lg" className="flex w-full max-w-md flex-col gap-3">
      <Text size="heading">Contributors this release</Text>
      <ShowMoreList
        items={CONTRIBUTORS}
        itemKey={(person) => person.name}
        initialCount={5}
        label="Contributors"
        ordered
        listClassName="gap-0.5"
        renderItem={(person) => (
          <a
            href={`#contributor-${person.name.toLowerCase().replace(/\W+/g, '-')}`}
            onClick={(event) => event.preventDefault()}
            className="flex items-center gap-3 rounded-[var(--radius-glyph)] px-2 py-1.5 hover:bg-surface-muted"
          >
            <Avatar name={person.name} size="sm" />
            <span className="flex-1 text-[13px] font-semibold text-ink">{person.name}</span>
            <span className="text-[11px] font-medium tabular-nums text-ink-faint">{person.commits} commits</span>
          </a>
        )}
      />
    </Surface>
  )
}

/* ------------------------------------------------------------------ NavigationProgress */

const PAGES = ['Overview', 'Invoices', 'Customers', 'Settings']

function NavigationProgressExample() {
  const [page, setPage] = useState('Overview')
  const [pending, setPending] = useState<string | null>(null)
  const [speed, setSpeed] = useState<'fast' | 'slow'>('slow')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const go = (next: string) => {
    clearTimeout(timer.current)
    setPending(next)
    timer.current = setTimeout(
      () => {
        setPage(next)
        setPending(null)
      },
      speed === 'slow' ? 2600 : 60,
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Route speed"
        size="sm"
        value={speed}
        onValueChange={setSpeed}
        className="self-start"
        options={[
          { value: 'slow', label: 'Slow route (2.6s)' },
          { value: 'fast', label: 'Fast route (60ms)' },
        ]}
      />
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <NavigationProgress active={pending !== null} position="absolute" label={`Loading ${pending ?? page}`} />
        <nav aria-label="Demo app" className="flex flex-wrap gap-1 border-b border-line p-2">
          {PAGES.map((name) => (
            <Button
              key={name}
              size="sm"
              variant={name === page ? 'muted' : 'ghost'}
              aria-current={name === page ? 'page' : undefined}
              onClick={() => go(name)}
            >
              {name}
            </Button>
          ))}
        </nav>
        <div className="flex h-36 flex-col gap-1 p-5" aria-busy={pending !== null}>
          <Text size="subtitle">{page}</Text>
          <Text size="label" tone="soft">
            {pending ? `Loading ${pending}…` : 'Pick another page. The fast route finishes inside the delay and shows no bar.'}
          </Text>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ PriorityNav */

const NAV_ITEMS: PriorityNavItem[] = [
  { id: 'overview', label: 'Overview', href: '/project/overview' },
  { id: 'issues', label: 'Issues', href: '/project/issues' },
  { id: 'pulls', label: 'Pull requests', href: '/project/pulls' },
  { id: 'deploys', label: 'Deployments', href: '/project/deploys' },
  { id: 'analytics', label: 'Analytics', href: '/project/analytics' },
  { id: 'members', label: 'Members', href: '/project/members' },
  { id: 'settings', label: 'Settings', href: '/project/settings' },
]

function PriorityNavExample() {
  const [width, setWidth] = useState<'full' | '480' | '320' | '200'>('480')
  const [current, setCurrent] = useState('analytics')
  const maxWidth = { full: '100%', '480': '480px', '320': '320px', '200': '200px' }[width]
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Available width"
        size="sm"
        value={width}
        onValueChange={setWidth}
        className="self-start"
        options={[
          { value: 'full', label: 'Full' },
          { value: '480', label: '480px' },
          { value: '320', label: '320px' },
          { value: '200', label: '200px' },
        ]}
      />
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-2" style={{ maxWidth }}>
        <PriorityNav
          items={NAV_ITEMS}
          currentId={current}
          label="Project"
          linkAs={DemoRouterLink}
          linkProp="to"
          onNavigate={(item) => setCurrent(item.id)}
        />
      </div>
      <Text size="caption" tone="faint">
        Current page: {NAV_ITEMS.find((item) => item.id === current)?.label}. At 320px it stays in the bar while the links around it move into More.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ demos */

export const demos: ExampleModule = {
  grid: {
    description:
      'The two-dimensional partner to Stack. A card list wants as many columns as fit and never a card too narrow to read, so `minItemWidth` writes an auto-fill track that follows the grid’s own width; a dashboard row wants a fixed count per breakpoint, so `columns` takes a number or `{ base, sm, md, lg, xl }`. Spans live on GridItem, where `full` still means the whole row after the column count changes.',
    sections: [
      { title: 'Columns or minimum width', Content: GridExample },
      {
        title: 'Spans',
        stack: true,
        specimens: [
          {
            label: 'span={2} rowSpan={2}',
            fill: true,
            node: (
              <Grid columns={4} gap={2} className="w-full">
                <GridItem span={2} rowSpan={2}>
                  <Cell>2 × 2</Cell>
                </GridItem>
                <Cell>1</Cell>
                <Cell>1</Cell>
                <GridItem span={2}>
                  <Cell>span 2</Cell>
                </GridItem>
              </Grid>
            ),
          },
          {
            label: "span={{ base: 'full', md: 2 }}",
            fill: true,
            node: (
              <Grid columns={{ base: 2, md: 4 }} gap={2} className="w-full">
                <GridItem span={{ base: 'full', md: 2 }}>
                  <Cell>full, then 2</Cell>
                </GridItem>
                <Cell>1</Cell>
                <Cell>1</Cell>
              </Grid>
            ),
          },
        ],
      },
      rationale(
        'Hand-written grid classes drift — `grid-cols-3 gap-5` here, a bespoke auto-fill template there — and a span of 3 breaks when the column count drops to 2.',
        'Two named ways to size columns cover nearly every layout, and spans are data the grid understands rather than classes it cannot check.',
        'Metric rows, card lists, settings pages and any layout that reflows by width.',
        ['CSS grid', 'Stack’s gap scale'],
      ),
    ],
    props: [
      { name: 'columns', type: 'GridColumns | { base?, sm?, md?, lg?, xl? }', defaultValue: '1', description: 'Column count, optionally per breakpoint. Ignored with minItemWidth.' },
      { name: 'minItemWidth', type: 'number | string', description: 'Fit as many columns as there is room for, each at least this wide.' },
      { name: 'gap', type: '0 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12', defaultValue: '4', description: 'Space between cells on the spacing scale.' },
      { name: 'align', type: "'start' | 'center' | 'end' | 'stretch'", description: 'Vertical alignment of cells in their rows.' },
      { name: 'as', type: 'ElementType', defaultValue: "'div'", description: 'Element to render — ul for a list of cards.' },
      { name: 'GridItem span', type: "GridItemSpan | { base?, sm?, md?, lg?, xl? }", description: 'Columns to span; full runs to the end of the row.' },
      { name: 'GridItem rowSpan', type: '1 | 2 | 3 | 4', description: 'Rows to span.' },
    ],
  },

  'text-link': {
    description:
      'The library’s inline link. The accent is a fill colour and fails contrast as text, so the words stay ink and the accent becomes a thick underline set below the descenders — links are found by more than colour alone. A link that opens a new tab shows an arrow, adds “(opens in new tab)” to its name and gets `rel="noopener noreferrer"`. `as` renders a router link, and a disabled link renders as text that neither navigates nor takes focus.',
    sections: [
      {
        title: 'In running text',
        Content: () => (
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-prose">
            Invoices are sent on the first of the month. You can change the billing contact in{' '}
            <TextLink href="#billing">workspace settings</TextLink>, or read how proration works in the{' '}
            <TextLink href="https://example.com/docs/proration" external>
              billing guide
            </TextLink>
            .
          </Text>
        ),
      },
      {
        title: 'Tones and states',
        specimens: [
          { label: 'default', node: <TextLink href="#default">View invoice</TextLink> },
          { label: "tone='accent'", node: <TextLink href="#accent" tone="accent">Upgrade plan</TextLink> },
          { label: "tone='soft'", node: <TextLink href="#soft" tone="soft">Privacy policy</TextLink> },
          { label: "underline='hover'", node: <TextLink href="#hover" underline="hover">All projects</TextLink> },
          { label: 'external', node: <TextLink href="https://example.com/status" external>Status page</TextLink> },
          { label: 'disabled', node: <TextLink href="#disabled" disabled>Export (admins only)</TextLink> },
          { label: 'as={Link}', node: <TextLink as={DemoRouterLink} to="/settings/billing">Billing settings</TextLink> },
        ],
      },
      rationale(
        'Links styled per screen end up as accent text that fails contrast, colour-only links nobody can spot, and new-tab links with no warning or opener protection.',
        'One link that gets contrast, underline offset, new-tab semantics and router rendering right, so every screen inherits them.',
        'Body copy, help text, table cells, footers and form hints.',
        ['ExternalIcon', 'sr-only text'],
      ),
    ],
    props: [
      { name: 'tone', type: "'default' | 'accent' | 'soft' | 'inherit'", defaultValue: "'default'", description: 'Colour treatment.' },
      { name: 'underline', type: "'always' | 'hover'", defaultValue: "'always'", description: 'Always in running text; hover for navigation lists.' },
      { name: 'external', type: 'boolean', description: 'Opens in a new tab with an icon, hidden notice and safe rel. Implied by target="_blank".' },
      { name: 'newTabLabel', type: 'string', defaultValue: "'(opens in new tab)'", description: 'Hidden text read after an external link.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Renders text marked as a disabled link.' },
      { name: 'as', type: 'ElementType', defaultValue: "'a'", description: 'Render a router link instead.' },
    ],
  },

  'live-region': {
    description:
      'The page’s voice for changes that do not move focus — a save finishing, a filter narrowing, a row moving. `useAnnounce()` returns `announce(message, politeness)`; it speaks through the nearest LiveRegion, or through a shared pair of regions on the body when there is none. The regions are on the page from the start, a repeated message is spoken again rather than swallowed, and text clears after a few seconds so nobody browses into stale news.',
    sections: [
      { title: 'Announcing', Content: LiveRegionExample },
      rationale(
        'A live region added in the same update as its text is often never read, the same message twice is silent the second time, and old text lingers for anyone reading the page later.',
        'One announcer that mounts early, de-duplicates by changing the text invisibly, and clears itself — used by every component that reports a change.',
        'Save states, filter result counts, drag-and-drop moves, background job completion.',
        ['aria-live', 'React context'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'Components below use useAnnounce() through this region.' },
      { name: 'message', type: 'string', description: 'Declarative announcement, spoken each time it changes.' },
      { name: 'politeness', type: "'polite' | 'assertive'", defaultValue: "'polite'", description: 'How message interrupts.' },
      { name: 'clearAfter', type: 'number', defaultValue: '5000', description: 'Milliseconds before spoken text is cleared. 0 keeps it.' },
      { name: 'useAnnounce()', type: '(options?: { clearAfter? }) => announce', description: 'Returns announce(message, politeness?).' },
    ],
  },

  'highlight-match': {
    description:
      'Text with the parts that match a search wrapped in `<mark>`. Matching ignores case and accents — “zoe montreal” finds “Zoë” and “Montréal” — and the highlight lands on the original characters. Each word matches on its own, the query is escaped so “c++” is literal, and `wordStart` limits matches to the start of words. The mark is the accent washed into the surface with ink on top.',
    sections: [
      { title: 'People search', Content: HighlightMatchExample },
      rationale(
        'Filtered lists that do not show why a row matched feel random, and naive highlighting misses accents, throws on regex characters or marks the wrong letters.',
        'Folding once and mapping offsets back keeps the highlight exact on the text the reader sees, with no dependency.',
        'Command palettes, comboboxes, search results, filterable tables.',
        ['<mark>', 'Unicode normalisation'],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'The text to render.' },
      { name: 'query', type: 'string | string[]', description: 'Words or terms to highlight.' },
      { name: 'splitWords', type: 'boolean', defaultValue: 'true', description: 'Split a string query on whitespace.' },
      { name: 'wordStart', type: 'boolean', defaultValue: 'false', description: 'Only match at the start of a word.' },
      { name: 'markClassName', type: 'string', description: 'Merged onto every mark.' },
    ],
  },

  sticky: {
    description:
      'A `position: sticky` wrapper that knows when it has pinned. An invisible sentinel above it is watched by an IntersectionObserver against the nearest scrolling ancestor, so there is no scroll listener; the stuck state arrives as `data-stuck`, a `stuckClassName`, a render prop and `onStuckChange`. Without IntersectionObserver it still sticks and simply never reports it.',
    sections: [
      { title: 'Header that lifts when pinned', Content: StickyExample },
      rationale(
        'CSS has no selector for “currently stuck”, and measuring on every scroll event to add a shadow is wasteful and janky.',
        'A sentinel crossing a line is reported once by the browser, off the scroll path, and works inside scrolling panels as well as the window.',
        'Table headers, section headings in long lists, filter bars, sticky form actions.',
        ['position: sticky', 'IntersectionObserver'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode | ({ stuck }) => ReactNode', description: 'Content, or a function of the stuck state.' },
      { name: 'top', type: 'number', defaultValue: '0', description: 'Offset from the top of the scroll container, in pixels.' },
      { name: 'stuckClassName', type: 'string', description: 'Classes added while pinned. data-stuck is set too.' },
      { name: 'onStuckChange', type: '(stuck: boolean) => void', description: 'Called when it pins or unpins.' },
    ],
  },

  'master-detail': {
    description:
      'A list and the record it opens: side by side when the component is wide enough, one pane at a time when it is not. The switch follows its own width, not the viewport’s. On a narrow layout opening an item moves focus to the detail heading, and Back returns focus to the row the reader came from, so working through a list does not mean tabbing past everything already read.',
    sections: [
      { title: 'Inbox', Content: MasterDetailExample },
      rationale(
        'Split views that just stack on a phone leave the detail far below the list, and ones that swap panes drop focus on the body or at the top of the list.',
        'Measuring the component rather than the screen lets the same inbox live in a page, a drawer or a split view, and explicit focus moves keep keyboard and screen reader users in place.',
        'Inboxes, ticket queues, file browsers, settings with a category list.',
        ['Button', 'ResizeObserver', 'ChevronLeftIcon'],
      ),
    ],
    props: [
      { name: 'items', type: 'T[]', description: 'Records in the list.' },
      { name: 'itemId / itemLabel', type: '(item: T) => string', description: 'Stable id, and the name used as the detail heading.' },
      { name: 'renderItem', type: '(item, { selected }) => ReactNode', description: 'Content of a row. The row is already a button.' },
      { name: 'renderDetail', type: '(item: T) => ReactNode', description: 'Detail body under the heading.' },
      { name: 'value / defaultValue', type: 'string | null', description: 'Selected id, controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(id: string) => void', description: 'Called when an item is opened.' },
      { name: 'label', type: 'string', description: 'Accessible name of the list.' },
      { name: 'splitAt', type: 'number', defaultValue: '640', description: 'Width in pixels from which panes sit side by side.' },
      { name: 'emptyDetail', type: 'ReactNode', description: 'Shown side by side while nothing is selected.' },
      { name: 'backLabel', type: 'string', defaultValue: "'Back'", description: 'Back button label on narrow layouts.' },
      { name: 'headingLevel', type: '2 | 3 | 4', defaultValue: '2', description: 'Level of the detail heading.' },
    ],
  },

  'dashboard-grid': {
    description:
      'A dashboard the reader arranges. Widgets move by a handle — dragged live with a pointer, or picked up with Space, carried with the arrow keys, dropped with Space and put back with Escape, each step announced with its position — and grow or shrink a column at a time up to four. The layout is one ordered list of `{ id, span }`, controlled through `value` and `onValueChange`, so reading order always matches what is on screen.',
    sections: [
      { title: 'Revenue dashboard', Content: DashboardGridExample },
      rationale(
        'Rearrangeable dashboards are usually mouse-only, silent to screen readers, and store x/y layouts that fall apart on a smaller screen.',
        'An ordered list with spans reflows cleanly, gives the keyboard one direction to move in, and is trivial to persist.',
        'Analytics home pages, personal workspaces, admin overviews.',
        ['IconButton', 'useAnnounce', 'Pointer capture'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'DashboardGridItem[]', description: 'Layout: widget ids in order with their spans.' },
      { name: 'onValueChange', type: '(layout: DashboardGridItem[]) => void', description: 'Called after every move or resize.' },
      { name: 'widgetTitle', type: '(item) => string', description: 'Widget heading and the name used in announcements.' },
      { name: 'renderWidget', type: '(item) => ReactNode', description: 'Widget body.' },
      { name: 'label', type: 'string', description: 'Accessible name of the grid.' },
      { name: 'locked', type: 'boolean', defaultValue: 'false', description: 'Hide handles and size buttons.' },
    ],
  },

  'show-more-list': {
    description:
      'The first few items of a long list and a button that names the total — “Show all 24”. The button carries `aria-expanded` and `aria-controls`, and when it reveals the rest focus moves to the first new item, its own link if it has one, instead of staying on a button that is now twenty items further down. Hidden items are not rendered, so they are out of the tab order and find-in-page alike.',
    sections: [
      { title: 'Contributors', Content: ShowMoreListExample },
      rationale(
        'Long lists push everything below them off screen, and “Show more” buttons that leave focus behind make keyboard users walk back to find what appeared.',
        'Stating the total up front and moving focus to the first revealed item makes expanding a list cost one keypress, not twenty.',
        'Contributor lists, integrations, recent activity, facet values in a filter panel.',
        ['Button', 'ChevronDownIcon'],
      ),
    ],
    props: [
      { name: 'items', type: 'T[]', description: 'Every item.' },
      { name: 'itemKey', type: '(item: T) => string', description: 'Stable key.' },
      { name: 'renderItem', type: '(item: T, index: number) => ReactNode', description: 'Content of one list item.' },
      { name: 'initialCount', type: 'number', defaultValue: '5', description: 'Items shown while collapsed.' },
      { name: 'expanded / defaultExpanded', type: 'boolean', description: 'Expanded state, controlled or uncontrolled.' },
      { name: 'onExpandedChange', type: '(expanded: boolean) => void', description: 'Called on show all or show fewer.' },
      { name: 'ordered', type: 'boolean', defaultValue: 'false', description: 'Render an ol.' },
      { name: 'showAllLabel', type: '(total: number) => string', defaultValue: '“Show all N”', description: 'Expand button label.' },
      { name: 'showFewerLabel', type: 'string', defaultValue: "'Show fewer'", description: 'Collapse button label.' },
    ],
  },

  'navigation-progress': {
    description:
      'The slim bar across the top while a route loads. It trickles — each step covers a share of what is left, so it slows and never claims to be done — then runs to the end and fades when `active` goes false. A router that knows real progress passes `value`. Navigations quicker than `delay` show nothing. It is a labelled progressbar, and with reduced motion it is a static, indeterminate track.',
    sections: [
      { title: 'Route transitions', Content: NavigationProgressExample, note: motionNote('no trickle or growth — a static partly filled track is shown as an indeterminate progressbar and removed when done.') },
      rationale(
        'Client-side navigation gives no browser loading signal, so a slow route looks like a dead click — and a bar that flashes on every fast route is noise.',
        'Trickle-to-finish reads as progress without inventing precision, the delay hides fast routes, and the progressbar role keeps it honest for assistive tech.',
        'Single-page apps, router transitions, full-page data refreshes.',
        ['usePrefersReducedMotion', 'role="progressbar"'],
      ),
    ],
    props: [
      { name: 'active', type: 'boolean', description: 'True while navigation is under way; false completes and fades.' },
      { name: 'value', type: 'number', description: 'Real progress 0–100. Omit to trickle.' },
      { name: 'label', type: 'string', defaultValue: "'Loading page'", description: 'Accessible name.' },
      { name: 'position', type: "'fixed' | 'absolute'", defaultValue: "'fixed'", description: 'Pin to the viewport or the nearest positioned ancestor.' },
      { name: 'height', type: 'number', defaultValue: '3', description: 'Thickness in pixels.' },
      { name: 'delay', type: 'number', defaultValue: '120', description: 'Milliseconds before the bar appears.' },
    ],
  },

  'priority-nav': {
    description:
      'A row of navigation links that never wraps or scrolls: links that do not fit move into a More list, measured from a hidden copy of the links with a ResizeObserver, or window resizes where that is missing. The current page is kept in the bar whenever it fits beside More. More opens a plain list of links rather than an ARIA menu, because these are destinations — arrow keys move through it and Escape returns to the button.',
    sections: [
      { title: 'Project tabs', Content: PriorityNavExample },
      rationale(
        'Horizontal navs either wrap into a ragged second line, scroll sideways with hidden links, or collapse everything into a hamburger long before they have to.',
        'Showing as much as fits and moving only the remainder keeps the common destinations one click away at every width.',
        'Project and repository tabs, app headers, section navigation inside a card.',
        ['Popover', 'ResizeObserver', 'ChevronDownIcon'],
      ),
    ],
    props: [
      { name: 'items', type: 'PriorityNavItem[]', description: 'Links in priority order; the last ones overflow first.' },
      { name: 'currentId', type: 'string', description: 'Current page, kept visible when possible and marked aria-current.' },
      { name: 'label', type: 'string', description: 'Accessible name of the nav landmark.' },
      { name: 'moreLabel', type: 'string', defaultValue: "'More'", description: 'Overflow button label.' },
      { name: 'linkAs', type: 'ElementType', defaultValue: "'a'", description: 'Router link component.' },
      { name: 'linkProp', type: "'href' | 'to'", defaultValue: "'href'", description: 'Prop that carries the destination.' },
      { name: 'onNavigate', type: '(item) => void', description: 'Called when a link is followed.' },
    ],
  },
}
