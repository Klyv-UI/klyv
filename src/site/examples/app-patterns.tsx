import { useState } from 'react'
import {
  Bell,
  CreditCard,
  Gamepad2,
  Gift,
  Inbox,
  Music,
  Plus,
  QrCode,
  Send,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import {
  ActivityFeed,
  ActivityHeatmap,
  Badge,
  Button,
  Card,
  CoachTour,
  DataExplorer,
  IconButton,
  LineChart,
  MetricSpotlight,
  NotificationCenter,
  QuickActions,
  SegmentedControl,
  StateView,
  StatusDot,
  Surface,
  Tag,
  Text,
  type ActivityEntry,
  type DataTableColumn,
  type HeatmapDay,
  type NotificationEntry,
  type SpotlightMetric,
  type ViewStatus,
} from 'klyv'
import type { ExampleModule } from './types'

/* ------------------------------------------------------------------ data */

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

const money = (value: number) => `$${value.toLocaleString('en-US')}`

const SPOTLIGHT: SpotlightMetric[] = [
  {
    id: 'balance',
    label: 'Balance',
    value: 27829,
    format: money,
    delta: '4.2%',
    trend: 'up',
    caption: 'vs. last month',
    series: [21400, 22100, 23050, 24200, 25600, 26400, 27829],
  },
  {
    id: 'spending',
    label: 'Spending',
    value: 842,
    format: money,
    delta: '8.1%',
    trend: 'down',
    caption: 'vs. last month',
    tone: 'danger',
    series: [1180, 1090, 1020, 980, 940, 916, 842],
  },
  {
    id: 'cashback',
    label: 'Cashback',
    value: 1154,
    format: money,
    delta: '12%',
    trend: 'up',
    caption: 'earned this year',
    tone: 'success',
    series: [420, 540, 640, 760, 890, 1020, 1154],
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    value: 213,
    format: money,
    delta: '0%',
    caption: '5 active',
    tone: 'neutral',
    series: [204, 204, 208, 208, 213, 213, 213],
  },
]

const HEATMAP: HeatmapDay[] = (() => {
  const days: HeatmapDay[] = []
  const start = new Date()
  start.setDate(start.getDate() - 26 * 7)
  for (let index = 0; index < 26 * 7; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const weekday = date.getDay()
    // Quiet weekends, a spike near the start of each month.
    const base = weekday === 0 || weekday === 6 ? 0.25 : 1
    const payday = date.getDate() <= 3 ? 3 : 1
    const value = Math.max(0, Math.round((Math.random() * 5 * base * payday) - 0.6))
    days.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      value,
    })
  }
  return days
})()

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const FEED: ActivityEntry[] = [
  {
    id: '1',
    date: isoDaysAgo(0),
    title: 'Sarah Rosewood',
    subtitle: 'Incoming transfer',
    amount: 125,
    details: [
      { term: 'Reference', description: 'Rent share' },
      { term: 'Arrived', description: 'Today, 4:28 PM' },
      { term: 'Account', description: '**** 5199' },
    ],
  },
  { id: '2', date: isoDaysAgo(0), title: 'GumZone', subtitle: 'Monthly plan', amount: -35, icon: Gamepad2 },
  {
    id: '3',
    date: isoDaysAgo(1),
    title: 'Apple Music',
    subtitle: 'Monthly plan',
    amount: -4.99,
    icon: Music,
    details: [
      { term: 'Next payment', description: '14 November' },
      { term: 'Since', description: 'March 2024' },
    ],
  },
  { id: '4', date: isoDaysAgo(1), title: 'Jack Hammer', subtitle: 'Outgoing transfer', amount: -24.05 },
  { id: '5', date: isoDaysAgo(3), title: 'Electric Co.', subtitle: 'Utility bill', amount: -63.69, icon: Zap },
  {
    id: '6',
    date: isoDaysAgo(3),
    title: 'Cashback',
    subtitle: 'Partner reward',
    amount: 42.1,
    icon: Gift,
    details: [{ term: 'Partner', description: 'Mcdonalds' }, { term: 'Rate', description: '10%' }],
  },
]

interface ExplorerRow {
  id: string
  name: string
  date: string
  category: string
  amount: number
}

const EXPLORER_ROWS: ExplorerRow[] = [
  { id: '1', name: 'Sarah Rosewood', date: '2026-10-14', category: 'Transfer', amount: 125 },
  { id: '2', name: 'GumZone', date: '2026-10-14', category: 'Subscription', amount: -35 },
  { id: '3', name: 'Apple Music', date: '2026-10-13', category: 'Subscription', amount: -4.99 },
  { id: '4', name: 'Jack Hammer', date: '2026-10-13', category: 'Transfer', amount: -24.05 },
  { id: '5', name: 'Electric Co.', date: '2026-10-11', category: 'Bill', amount: -63.69 },
  { id: '6', name: 'Water Co.', date: '2026-10-09', category: 'Bill', amount: -24.5 },
  { id: '7', name: 'Cashback', date: '2026-10-08', category: 'Reward', amount: 42.1 },
  { id: '8', name: 'Mia Okonkwo', date: '2026-10-05', category: 'Transfer', amount: -300 },
  { id: '9', name: 'Smart Home Security', date: '2026-10-04', category: 'Subscription', amount: -79.99 },
  { id: '10', name: 'Broadband', date: '2026-10-02', category: 'Bill', amount: -42 },
]

/* ------------------------------------------------------------- examples */

function StateViewExample() {
  const [status, setStatus] = useState<ViewStatus>('ready')
  const data = status === 'ready' ? ['a', 'b', 'c'] : status === 'empty' ? [] : undefined

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="State"
        size="sm"
        value={status}
        onValueChange={(value) => setStatus(value as ViewStatus)}
        className="self-start"
        options={[
          { value: 'loading', label: 'Loading' },
          { value: 'empty', label: 'Empty' },
          { value: 'error', label: 'Error' },
          { value: 'ready', label: 'Ready' },
        ]}
      />
      <Card title="Recent transactions" className="w-full">
        <StateView
          data={data}
          status={status}
          className="mt-2"
          skeleton={
            <div className="flex flex-col gap-3 py-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="size-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />
                  <span className="h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
                  <span className="ml-auto h-3 w-16 animate-pulse rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          }
          empty={{
            icon: Inbox,
            title: 'No transactions yet',
            description: 'Once money moves in or out, it will appear here with a running balance.',
            action: <Button size="sm">Make a transfer</Button>,
          }}
          error={{
            title: 'Could not load transactions',
            description: 'Your balance is unaffected.',
            detail: 'TXN_SERVICE_TIMEOUT / req_8f21c4',
          }}
          onRetry={
            <Button size="sm" variant="outline" onClick={() => setStatus('ready')}>
              Try again
            </Button>
          }
        >
          {(rows) => (
            <div className="flex flex-col gap-2 py-2">
              {rows.map((row) => (
                <Text key={row} size="body">
                  Transaction {row.toUpperCase()}
                </Text>
              ))}
            </div>
          )}
        </StateView>
      </Card>
    </div>
  )
}

function QuickActionsExample() {
  const [last, setLast] = useState('none')
  const [shortcuts, setShortcuts] = useState(true)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Card title="US Dollar" className="w-full max-w-[380px]">
        <Text size="label" tone="faint" className="mt-3">
          Your Balance
        </Text>
        <Text size="display" tabular className="mt-1">
          $27,829.83
        </Text>
        <QuickActions
          className="mt-5"
          shortcuts={shortcuts}
          actions={[
            { id: 'send', label: 'Send', icon: Send, primary: true, shortcut: 's', hint: 'Send money to a recipient', onSelect: () => setLast('Send') },
            { id: 'pay', label: 'Payments', icon: CreditCard, shortcut: 'p', hint: 'Pay a bill', onSelect: () => setLast('Payments') },
            { id: 'qr', label: 'QR', icon: QrCode, shortcut: 'q', hint: 'Show your payment code', onSelect: () => setLast('QR') },
            { id: 'more', label: 'More', icon: Plus, hint: 'Everything else', onSelect: () => setLast('More') },
          ]}
        />
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setShortcuts((value) => !value)}>
          {shortcuts ? 'Turn shortcuts off' : 'Turn shortcuts on'}
        </Button>
        <Text size="caption" tone="faint" role="status" aria-live="polite">
          Last: {last}
          {shortcuts ? ' · try Cmd+S' : ''}
        </Text>
      </div>
    </div>
  )
}

function MetricSpotlightExample() {
  return (
    <MetricSpotlight
      label="Key figures"
      metrics={SPOTLIGHT}
      className="w-full"
      detail={(metric) => (
        <LineChart
          series={[{ id: metric.id, label: metric.label, values: metric.series }]}
          categories={MONTHS}
          label={`${metric.label} over seven months`}
          format={money}
          height={200}
          showLegend={false}
          smooth
        />
      )}
    />
  )
}

function DataExplorerExample() {
  const [status, setStatus] = useState<ViewStatus | undefined>(undefined)

  const columns: DataTableColumn<ExplorerRow>[] = [
    { id: 'name', header: 'Counterparty', cell: (row) => <span className="font-bold">{row.name}</span>, sortValue: (row) => row.name },
    { id: 'date', header: 'Date', cell: (row) => <span className="text-ink-soft">{row.date}</span>, sortValue: (row) => row.date },
    { id: 'category', header: 'Category', cell: (row) => <Tag size="sm">{row.category}</Tag>, sortValue: (row) => row.category },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      tabular: true,
      cell: (row) => (
        <span className={row.amount > 0 ? 'font-bold text-success' : 'font-bold'}>
          {row.amount < 0 ? '-' : '+'}${Math.abs(row.amount).toFixed(2)}
        </span>
      ),
      sortValue: (row) => row.amount,
    },
  ]

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Data state"
        size="sm"
        value={status ?? 'ready'}
        onValueChange={(value) => setStatus(value === 'ready' ? undefined : (value as ViewStatus))}
        className="self-start"
        options={[
          { value: 'ready', label: 'With data' },
          { value: 'loading', label: 'Loading' },
          { value: 'error', label: 'Error' },
        ]}
      />
      <DataExplorer
        title="Transactions"
        rows={EXPLORER_ROWS}
        status={status}
        columns={columns}
        rowId={(row) => row.id}
        searchIn={(row) => `${row.name} ${row.category}`}
        searchPlaceholder="Search by counterparty or category"
        selectable
        pageSize={5}
        actions={
          <Button size="sm" variant="ghost">
            Export
          </Button>
        }
        onRetry={
          <Button size="sm" variant="outline" onClick={() => setStatus(undefined)}>
            Try again
          </Button>
        }
        filters={[
          { value: 'Transfer', label: 'Transfers', count: 3 },
          { value: 'Subscription', label: 'Subscriptions', count: 3 },
          { value: 'Bill', label: 'Bills', count: 3 },
          { value: 'Reward', label: 'Rewards', count: 1 },
        ]}
        matchesFilter={(row, active) => active.includes(row.category)}
      />
    </div>
  )
}

function NotificationCenterExample() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[]>([
    { id: '1', group: 'Money', title: 'Transfer received', description: '$125.00 from Sarah Rosewood', time: '4m', tone: 'success', icon: Send },
    { id: '2', group: 'Money', title: 'Payment due tomorrow', description: 'Smart Home Security, $79.99', time: '2h', tone: 'warning', icon: Zap },
    { id: '3', group: 'Rewards', title: 'Cashback credited', description: '$42.10 from Mcdonalds', time: '1d', tone: 'success', icon: Gift, read: true },
    { id: '4', group: 'Security', title: 'New device signed in', description: 'Chrome on Windows, London', time: '2d', tone: 'danger', icon: TriangleAlert },
    { id: '5', group: 'Money', title: 'Card expires soon', description: 'Ending 5199, June 2028', time: '5d', tone: 'neutral', icon: CreditCard, read: true },
  ])

  const unread = notifications.filter((entry) => !entry.read).length

  return (
    <div className="flex flex-col items-start gap-3">
      <span className="relative inline-flex">
        <IconButton icon={Bell} label="Notifications" tone="white" onClick={() => setOpen(true)} />
        {unread > 0 && (
          <StatusDot ring label={`${unread} unread`} className="pointer-events-none absolute right-2 top-2" />
        )}
      </span>
      <NotificationCenter
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onMarkRead={(id) =>
          setNotifications((previous) =>
            previous.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
          )
        }
        onMarkAllRead={() =>
          setNotifications((previous) => previous.map((entry) => ({ ...entry, read: true })))
        }
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {unread} unread
      </Text>
    </div>
  )
}

function CoachTourExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Start the tour
      </Button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card title="Balance" id="tour-balance" className="scroll-mt-24">
          <Text size="stat" tabular className="mt-2">
            $27,829.83
          </Text>
        </Card>
        <Card title="Cashback" id="tour-cashback" className="scroll-mt-24">
          <Text size="stat" tabular className="mt-2">
            $1,154.00
          </Text>
        </Card>
        <Card title="Subscriptions" id="tour-subs" className="scroll-mt-24">
          <Text size="stat" tabular className="mt-2">
            5 active
          </Text>
        </Card>
      </div>

      <CoachTour
        open={open}
        onClose={() => setOpen(false)}
        steps={[
          {
            id: 'balance',
            target: '#tour-balance',
            title: 'Your balance',
            description: 'Everything available to spend right now, across every account.',
          },
          {
            id: 'cashback',
            target: '#tour-cashback',
            title: 'Cashback',
            description: 'Rewards from partners, credited monthly. Withdraw it at any time.',
          },
          {
            id: 'subs',
            target: '#tour-subs',
            title: 'Subscriptions',
            description: 'Recurring payments, with the next one due always at the top.',
          },
        ]}
      />

      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        The scrim is four panes with a gap over the target rather than one translucent sheet, so the
        highlighted element stays fully interactive underneath. Escape leaves at any point, and
        arrows move between steps.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

const BUILT_FROM = (parts: string[]) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Text as="span" size="caption" weight="semibold" tone="faint">
      Built from
    </Text>
    {parts.map((part) => (
      <Badge key={part} tone="neutral">
        {part}
      </Badge>
    ))}
  </div>
)

function rationale(problem: string, why: string, where: string, parts: string[]) {
  return {
    title: 'Why it exists',
    bare: true,
    Content: () => (
      <div className="flex w-full flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['Problem it solves', problem],
            ['Why it was chosen', why],
            ['Where it fits', where],
          ].map(([heading, copy]) => (
            <Surface key={heading} variant="tile" padding="md" className="gap-1.5">
              <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                {heading}
              </Text>
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {copy}
              </Text>
            </Surface>
          ))}
        </div>
        {BUILT_FROM(parts)}
      </div>
    ),
  }
}

export const demos: ExampleModule = {
  'state-view': {
    description:
      'One component for the four states every data region has: loading, error, empty and ready. Status is derived by default — undefined data is loading, an empty array is empty — so the common case needs no status prop at all.',
    sections: [
      { title: 'Every state', description: 'Switch between them. The card never changes size abruptly.', bare: true, Content: StateViewExample },
      rationale(
        'Every list rebuilds the same four-way branch, and each rebuild drifts: one forgets the empty case, another renders an empty list on failure.',
        'Making it a component means the four states are decided once, and a new region cannot forget one.',
        'Any card or page region backed by data. DataExplorer uses it internally.',
        ['EmptyState', 'ErrorState', 'Skeleton'],
      ),
    ],
    props: [
      { name: 'data', type: 'T[] | undefined', description: 'undefined is loading; an empty array is empty.' },
      { name: 'status', type: 'ViewStatus', description: 'Overrides the derived status — needed for the error case.' },
      { name: 'children', type: '(data: T[]) => ReactNode', description: 'Rendered once there is data.' },
      { name: 'skeleton', type: 'ReactNode', description: 'Placeholder while loading. Match the real content shape.' },
      { name: 'empty / error / onRetry', type: 'object / object / ReactNode', description: 'Copy for the two failure-ish cases.' },
    ],
  },

  'quick-actions': {
    description:
      'The icon-over-label action row from the balance card, generalised. It is the one row a user hits most often, so it gets accelerators the rest of the library does not: optional keyboard shortcuts bound while it is mounted, with the key shown on the control rather than hidden in a help page.',
    sections: [
      { title: 'Example', description: 'With shortcuts on, Cmd+S, Cmd+P and Cmd+Q run the first three.', bare: true, Content: QuickActionsExample },
      rationale(
        'A surface with three or four primary verbs needs a compact row that works by pointer, by touch and by keyboard.',
        'Product surfaces repeat this shape, and the accelerators are the part hand-rolled versions always skip.',
        'The balance card, an account detail panel, any surface with a small set of primary verbs.',
        ['IconButton', 'Ripple', 'PressScale', 'Tooltip', 'Kbd', 'Text'],
      ),
    ],
    props: [
      { name: 'actions', type: 'QuickAction[]', description: 'id, label, icon, primary, shortcut, hint, disabled, onSelect.' },
      { name: 'shortcuts', type: 'boolean', defaultValue: 'false', description: 'Bind the shortcuts while mounted, and show the keys.' },
      { name: 'modifier', type: "'meta' | 'alt' | 'none'", defaultValue: "'meta'", description: 'Modifier the shortcuts require.' },
    ],
  },

  'metric-spotlight': {
    description:
      'A rail of KPI tiles where selecting one drives a detail panel below. The tiles are radio buttons, not divs: arrow keys move between them and only the selected one is a tab stop. Figures count up on first paint only, so switching tiles stays instant.',
    sections: [
      { title: 'Example', description: 'Select a tile, or focus one and use the arrow keys.', bare: true, Content: MetricSpotlightExample },
      rationale(
        'Analytics screens reinvent the summary-then-detail dance: a row of numbers, and a chart that has to know which number is selected.',
        'The rail owns the selection and hands the chosen metric to a render prop, so the detail can be any chart in the library — or none.',
        'A dashboard header, a reports page, anywhere a handful of KPIs each have a series behind them.',
        ['Surface', 'Metric', 'CountUp', 'Sparkline', 'Presence'],
      ),
    ],
    props: [
      { name: 'metrics', type: 'SpotlightMetric[]', description: 'id, label, value, format, delta, trend, series, caption.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected metric. Omit for uncontrolled.' },
      { name: 'detail', type: '(metric) => ReactNode', description: 'Rendered under the rail for the selected metric.' },
      { name: 'animate', type: 'boolean', defaultValue: 'true', description: 'Count the figures up on first paint.' },
    ],
  },

  'activity-heatmap': {
    description:
      'A calendar density grid: one cell per day, coloured by how much happened. The ramp uses quantiles rather than a linear scale, because activity data is almost always skewed and a linear ramp leaves the whole grid in the lowest bucket.',
    sections: [
      {
        title: 'Example',
        description: 'Hover any cell. Weekends are visibly quieter and the start of each month spikes.',
        bare: true,
        Content: () => (
          <Card title="Transaction activity" className="w-full">
            <div className="mt-3">
              <ActivityHeatmap days={HEATMAP} label="Transactions per day" weeks={26} />
            </div>
          </Card>
        ),
      },
      rationale(
        'No chart in the library answers "when did this happen, across months, at a glance" — a line chart shows the shape of a series, not its rhythm.',
        'Rhythm is what a heatmap shows and nothing else does: weekends, pay days, the quiet fortnight in August.',
        'An account activity page, a reports view, a profile summary.',
        ['Tooltip', 'Text', 'VisuallyHidden', 'colour tokens'],
      ),
    ],
    props: [
      { name: 'days', type: 'HeatmapDay[]', description: '{ date, value }, ISO dates.' },
      { name: 'weeks', type: 'number', defaultValue: '26', description: 'Weeks shown, counting back from the last day.' },
      { name: 'steps', type: 'number', defaultValue: '5', description: 'Buckets in the ramp. Values are placed by quantile.' },
      { name: 'format', type: '(value, date) => string', description: 'Tooltip and screen-reader text.' },
    ],
  },

  'activity-feed': {
    description:
      'A transaction feed grouped by day, with sticky date headers and rows that expand in place. Rows with no detail do not become buttons, so nothing offers an interaction that leads nowhere.',
    sections: [
      {
        title: 'Example',
        description: 'Scroll to see the date headers stick. Rows with a chevron expand.',
        bare: true,
        Content: () => (
          <Card title="Activity" className="h-[420px] w-full max-w-[520px]">
            <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto">
              <ActivityFeed entries={FEED} label="Recent activity" showDailyTotals />
            </div>
          </Card>
        ),
      },
      rationale(
        'A flat list of eighty transactions is unreadable, and a detail route loses the reader position they built up by scrolling.',
        'Grouping makes it scannable; expanding in place keeps the reader exactly where they were.',
        'The Activity route, an account statement, any long chronological list.',
        ['List', 'ListItem', 'Collapse', 'DescriptionList', 'IconTile', 'Avatar'],
      ),
    ],
    props: [
      { name: 'entries', type: 'ActivityEntry[]', description: 'date, title, subtitle, amount, icon, details, extra.' },
      { name: 'showDailyTotals', type: 'boolean', defaultValue: 'false', description: 'Running total per day group.' },
      { name: 'format', type: '(amount: number) => string', description: 'Amount formatting.' },
    ],
  },

  'data-explorer': {
    description:
      'A whole list screen: search, quick filters, a sortable and selectable table, and the four data states — in one component. It distinguishes two empty states, which is the detail most implementations miss: no data at all is a different message from no data matching the current filters.',
    sections: [
      {
        title: 'Example',
        description: 'Search, filter, sort and page. Switch the state to see loading and error.',
        bare: true,
        Content: DataExplorerExample,
      },
      rationale(
        'Every list page rebuilds this, and each rebuild drifts: one forgets the empty state, another filters but never announces the new count, a third loses the search on a filter change.',
        'Assembling it once means the wiring between filter, search, table and state is decided in a single place.',
        'The Activity, Reports and Manage routes — any screen that is fundamentally a filtered table.',
        ['Card', 'SearchField', 'FilterBar', 'DataTable', 'StateView', 'Skeleton'],
      ),
    ],
    props: [
      { name: 'rows / columns / rowId', type: 'Row[] | undefined / DataTableColumn[] / fn', description: 'undefined rows means loading.' },
      { name: 'filters / matchesFilter', type: 'FilterChip[] / (row, active) => boolean', description: 'Quick toggles and their predicate.' },
      { name: 'searchIn', type: '(row) => string', description: 'The text the search field matches against.' },
      { name: 'status / onRetry', type: 'ViewStatus / ReactNode', description: 'Override the derived state; the retry affordance.' },
      { name: 'pageSize / selectable', type: 'number / boolean', defaultValue: '8 / false', description: 'Passed to DataTable.' },
    ],
  },

  'notification-center': {
    description:
      'The panel behind the bell: grouped into tabs, unread first, with a way to clear the lot. Unread is explicit state the caller owns, opening an item marks it read, and the count is announced through a badge rather than by colour.',
    sections: [
      { title: 'Example', description: 'Open the bell, read an item, then mark the rest.', bare: true, Content: NotificationCenterExample },
      rationale(
        'The hard part of this pattern is not the list, it is the unread model — and floating panels that trap no focus.',
        'Unread stays the caller state, and the panel is a Drawer, so it inherits focus trapping, Escape and scroll lock.',
        'The header bell, on every route.',
        ['Drawer', 'Tabs', 'List', 'ListItem', 'StatusDot', 'IconTile', 'EmptyState', 'Badge'],
      ),
    ],
    props: [
      { name: 'notifications', type: 'NotificationEntry[]', description: 'title, description, time, icon, tone, read, group.' },
      { name: 'onMarkRead / onMarkAllRead', type: 'fn', description: 'The unread model is yours; the panel only reports intent.' },
      { name: 'open / onClose', type: 'boolean / fn', description: 'Controlled visibility.' },
    ],
  },

  'coach-tour': {
    description:
      'A guided product tour: the page dims, one element stays lit, and a card explains it. It scrolls each target into view, cuts a literal hole in the scrim over it, and anchors the explanation to the lit element.',
    sections: [
      { title: 'Example', description: 'Start the tour, then move with the buttons or the arrow keys.', bare: true, Content: CoachTourExample },
      rationale(
        'Feature introduction has a lot of bad solutions: a modal that describes the interface instead of pointing at it, or a tooltip chain that scrolls its target off screen.',
        'Pointing at the real element — still interactive, still in view — is the only version that actually teaches the interface.',
        'First run, a new feature, an empty state that needs explaining.',
        ['Portal', 'FocusTrap', 'Button', 'Text', 'motion tokens'],
      ),
    ],
    props: [
      { name: 'steps', type: 'TourStep[]', description: 'target is a CSS selector; title and description explain it.' },
      { name: 'open / onClose / onComplete', type: 'boolean / fn / fn', description: 'Dismissible at every step.' },
      { name: 'label', type: 'string', defaultValue: "'Product tour'", description: 'Accessible name for the dialog.' },
    ],
  },
}
