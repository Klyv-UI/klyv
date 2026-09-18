import { useState } from 'react'
import { Gamepad2, GraduationCap, MoreVertical, Music, Smartphone, Wifi, Zap } from 'lucide-react'
import {
  AvatarGroup,
  Badge,
  Button,
  Card,
  CodeBlock,
  DescriptionList,
  Figure,
  FilterBar,
  IconButton,
  IconTile,
  List,
  ListItem,
  Metric,
  Sparkline,
  StatCard,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Timeline,
} from 'klyv'
import type { ExampleModule } from './types'

const ROWS = [
  { id: 'apple', name: 'Apple Music', icon: Music, price: '$8,99', due: 'Tomorrow' },
  { id: 'home', name: 'Smart Home Security', icon: Zap, price: '$79,99', due: 'Tomorrow' },
  { id: 'gum', name: 'GumZone', icon: Gamepad2, price: '$35,00', due: 'In 4 days' },
  { id: 'water', name: 'Water Bill', icon: Zap, price: '$24,50', due: 'In 5 days' },
  { id: 'power', name: 'Electricity', icon: Zap, price: '$63,69', due: 'In 8 days' },
]

const PEOPLE = [
  { name: 'Sarah Rosewood' },
  { name: 'Jack Hammer' },
  { name: 'Daniel Vance' },
  { name: 'Mia Okonkwo' },
  { name: 'Ivan Petrov' },
  { name: 'Lena Fischer' },
]

const TRANSACTIONS = [
  { id: '1', name: 'Sarah Rosewood', date: 'Today, 4:28 PM', amount: '+$125,00', status: 'Cleared' },
  { id: '2', name: 'GumZone', date: 'Today, 11:02 AM', amount: '-$35,00', status: 'Cleared' },
  { id: '3', name: 'Apple Music', date: 'Yesterday', amount: '-$4,99', status: 'Pending' },
  { id: '4', name: 'Jack Hammer', date: 'Yesterday', amount: '-$24,05', status: 'Cleared' },
]

function TableExample() {
  const [selected, setSelected] = useState('1')
  return (
    <Card title="Recent transactions" padded={false} className="w-full">
      <Table label="Recent transactions">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Counterparty</TableHeaderCell>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right" sort="descending">
              Amount
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {TRANSACTIONS.map((row) => (
            <TableRow key={row.id} selected={row.id === selected}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => setSelected(row.id)}
                  className="font-bold text-ink underline-offset-2 hover:underline"
                >
                  {row.name}
                </button>
              </TableCell>
              <TableCell className="text-ink-soft">{row.date}</TableCell>
              <TableCell>
                <Badge tone={row.status === 'Pending' ? 'neutral' : 'accent'}>{row.status}</Badge>
              </TableCell>
              <TableCell align="right" tabular className="font-bold">
                {row.amount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function FilterBarExample() {
  const [active, setActive] = useState<string[]>(['subscriptions'])
  const filters = [
    { value: 'subscriptions', label: 'Subscriptions', count: 5 },
    { value: 'transfers', label: 'Transfers', count: 12 },
    { value: 'cashback', label: 'Cashback', count: 3 },
    { value: 'bills', label: 'Bills', count: 7 },
  ]
  const count = filters
    .filter((filter) => active.includes(filter.value))
    .reduce((total, filter) => total + filter.count, 0)

  return (
    <Card className="w-full gap-3">
      <FilterBar
        label="Transaction filters"
        filters={filters}
        value={active}
        onValueChange={setActive}
        resultCount={active.length ? count : 27}
        resultLabel="transactions"
        onClear={() => setActive([])}
      />
      <Surface variant="sunken" padding="md">
        <Text size="caption" tone="faint">
          The list below would now show{' '}
          <strong className="font-bold text-ink">{active.length ? count : 27}</strong> rows. The
          count is a live region, so the change is announced.
        </Text>
      </Surface>
    </Card>
  )
}

function StatCardExample() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={GraduationCap}
        title="Education"
        caption="2 days left"
        value="$160"
        meter={{ value: 3, total: 6, label: 'Education instalments paid' }}
        action={<IconButton icon={MoreVertical} label="Options for Education" size="xs" />}
      />
      <StatCard
        icon={Smartphone}
        title="iPhone 17 Pro Max"
        caption="4 days left"
        value="$550"
        meter={{ value: 2, total: 6, label: 'iPhone instalments paid' }}
        action={<IconButton icon={MoreVertical} label="Options for iPhone" size="xs" />}
      />
      <StatCard
        icon={Wifi}
        title="Broadband"
        caption="This month"
        value="$42"
        delta="8%"
        trend="down"
        onClick={() => undefined}
      />
    </div>
  )
}

export const demos: ExampleModule = {
  metric: {
    description:
      'A label, a figure and an optional change, always in that order and at the same ranks — which is what makes a row of metrics scannable. The trend drives both the badge and a hidden word, so a rise is never signalled by colour and an arrow alone.',
    sections: [
      {
        title: 'Sizes',
        description: 'The value steps through the type scale; the label and caption stay fixed.',
        specimens: [
          { label: 'sm', node: <Metric label="This month" value="$1,154.00" size="sm" /> },
          { label: 'md', node: <Metric label="This month" value="$1,154.00" size="md" /> },
          { label: 'lg', node: <Metric label="Your Balance" value="$27,829.83" size="lg" /> },
        ],
      },
      {
        title: 'Trend',
        specimens: [
          { label: 'up', node: <Metric label="Cashback" value="$1,154.00" delta="12%" trend="up" /> },
          { label: 'down', node: <Metric label="Spending" value="$842.10" delta="8%" trend="down" /> },
          { label: 'flat', node: <Metric label="Subscriptions" value="$213.47" delta="0%" /> },
          {
            label: 'with caption',
            node: <Metric label="Cashback" value="$1,154.00" delta="12%" trend="up" caption="vs. last month" />,
          },
        ],
      },
      {
        title: 'Composed',
        description: 'Metric next to a Sparkline is the smallest useful analytics unit.',
        specimens: [
          {
            label: 'Metric + Sparkline',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[300px] flex-row items-end justify-between gap-4">
                <Metric label="Balance" value="$27,829.83" delta="4.2%" trend="up" />
                <Sparkline values={[12, 14, 13, 18, 17, 22, 26]} label="Balance over seven days" area showLast />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'label', type: 'string', description: 'What the figure measures. Optional inside a container that already names it.' },
      { name: 'value', type: 'ReactNode', description: 'The figure, already formatted.' },
      { name: 'delta / trend', type: "string / 'up' | 'down' | 'flat'", description: 'Change and its direction.' },
      { name: 'caption', type: 'string', description: 'Comparison or period under the figure.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: 'Steps the value through stat, title and display.' },
    ],
  },

  'description-list': {
    description:
      'Term and value pairs as a real definition list. The row layout is the account-detail shape from the balance card; stack is for longer values that would otherwise wrap awkwardly against their term.',
    sections: [
      {
        title: 'Layouts',
        stack: true,
        specimens: [
          {
            label: 'row',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[340px]">
                <DescriptionList
                  items={[
                    { term: 'Account number', description: '**** 5199' },
                    { term: 'Valid thru', description: '06/28' },
                    { term: 'Currency rate', description: '1 USD = 0,73 GBP' },
                  ]}
                />
              </Surface>
            ),
          },
          {
            label: 'row + divided',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[340px]">
                <DescriptionList
                  divided
                  items={[
                    { term: 'Currency rate', description: '1 USD = 0,73 GBP' },
                    { term: 'Bank network fee', description: '$2,48 USD' },
                    { term: 'Arrives', description: 'In 3 working days' },
                  ]}
                />
              </Surface>
            ),
          },
          {
            label: 'stack',
            hint: 'For values that need the full width',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[340px]">
                <DescriptionList
                  layout="stack"
                  items={[
                    { term: 'Reference', description: 'Rent for October 2026' },
                    { term: 'Recipient', description: 'Sarah Rosewood' },
                  ]}
                />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'items', type: '{ term, description }[]', description: 'The pairs, in order.' },
      { name: 'layout', type: "'row' | 'stack'", defaultValue: "'row'", description: 'Side by side, or value underneath.' },
      { name: 'divided', type: 'boolean', defaultValue: 'false', description: 'Hairline between pairs.' },
    ],
  },

  'avatar-group': {
    description:
      'Overlapping avatars with an overflow count. The names behind the count stay in the accessibility tree, so "+2" is never the only way to know who is included — a detail that is almost always missed in this pattern.',
    sections: [
      {
        title: 'Overflow',
        specimens: [
          { label: 'under the limit', node: <AvatarGroup people={PEOPLE.slice(0, 3)} label="Shared with" /> },
          { label: 'at the limit', node: <AvatarGroup people={PEOPLE.slice(0, 4)} label="Shared with" /> },
          { label: 'over the limit', hint: 'Names are still announced', node: <AvatarGroup people={PEOPLE} label="Shared with" /> },
          { label: 'max={2}', node: <AvatarGroup people={PEOPLE} max={2} label="Shared with" /> },
        ],
      },
      {
        title: 'Sizes',
        specimens: [
          { label: 'xs', node: <AvatarGroup people={PEOPLE} size="xs" label="Shared with" /> },
          { label: 'sm', node: <AvatarGroup people={PEOPLE} size="sm" label="Shared with" /> },
          { label: 'md', node: <AvatarGroup people={PEOPLE} size="md" label="Shared with" /> },
          { label: 'lg', node: <AvatarGroup people={PEOPLE} size="lg" label="Shared with" /> },
        ],
      },
      {
        title: 'In context',
        background: 'app',
        specimens: [
          {
            label: 'Shared account',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[340px] flex-row items-center justify-between gap-3">
                <div className="min-w-0">
                  <Text truncate>Household account</Text>
                  <Text size="caption" tone="faint">
                    6 people
                  </Text>
                </div>
                <AvatarGroup people={PEOPLE} max={3} label="Household members" />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'people', type: '{ name, src? }[]', description: 'In display order.' },
      { name: 'max', type: 'number', defaultValue: '4', description: 'How many to draw before collapsing.' },
      { name: 'size', type: "'xs' | 'sm' | 'md' | 'lg'", defaultValue: "'sm'", description: 'Avatar size.' },
    ],
  },

  figure: {
    description:
      'Media with its caption, as a real figure and figcaption pair — so the caption is programmatically tied to the media rather than merely sitting near it. The frame and ratio are handled here so a row of figures lines up.',
    sections: [
      {
        title: 'Ratios',
        specimens: [
          {
            label: 'ratio="16 / 9"',
            node: (
              <Figure ratio="16 / 9" caption="Spending by category, last 30 days" className="w-[220px]">
                <Sparkline values={[8, 14, 11, 19, 16, 24, 21]} label="Spending trend" width={180} height={70} area />
              </Figure>
            ),
          },
          {
            label: 'ratio="1 / 1"',
            node: (
              <Figure ratio="1 / 1" caption="Scan to pay" className="w-[140px]">
                <span className="text-[11px] font-semibold text-ink-faint">QR</span>
              </Figure>
            ),
          },
          {
            label: 'framed={false}',
            node: (
              <Figure framed={false} caption="No frame, for media with its own edge" className="w-[180px]">
                <span className="block h-[80px] w-full rounded-[var(--radius-tile)] bg-accent" />
              </Figure>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The media.' },
      { name: 'caption', type: 'ReactNode', description: 'Rendered as figcaption.' },
      { name: 'ratio', type: 'string', description: 'CSS aspect-ratio, e.g. 16 / 9.' },
      { name: 'framed', type: 'boolean', defaultValue: 'true', description: 'Rounded bordered frame.' },
    ],
  },

  table: {
    description:
      'A semantic table on the line and surface tokens. Compositional on purpose — sorting, selection and pagination belong to DataTable, which builds on this. The wrapper scrolls horizontally so a wide table never widens the page.',
    sections: [
      {
        title: 'Example',
        description: 'Header cells carry scope and aria-sort; the selected row carries aria-selected.',
        bare: true,
        Content: TableExample,
      },
      {
        title: 'Cells',
        stack: true,
        specimens: [
          {
            label: 'alignment and figures',
            fill: true,
            node: (
              <Surface variant="card" padding="none" className="w-full">
                <Table label="Alignment example" striped>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Left</TableHeaderCell>
                      <TableHeaderCell align="center">Center</TableHeaderCell>
                      <TableHeaderCell align="right">Right, tabular</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      ['Apple Music', 'Monthly', '8,99'],
                      ['Smart Home Security', 'Monthly', '79,99'],
                      ['GumZone', 'Monthly', '35,00'],
                    ].map((row) => (
                      <TableRow key={row[0]}>
                        <TableCell>{row[0]}</TableCell>
                        <TableCell align="center">{row[1]}</TableCell>
                        <TableCell align="right" tabular>
                          {row[2]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Surface>
            ),
          },
        ],
        note: 'Any column of figures should be right-aligned and tabular. Decimal points then line up, which is the whole reason to use a table rather than a list.',
      },
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name, unless a visible heading names it.' },
      { name: 'striped', type: 'boolean', defaultValue: 'false', description: 'Tint alternate body rows.' },
      { name: 'TableHeaderCell.sort', type: "'ascending' | 'descending'", description: 'Sets aria-sort on the column.' },
      { name: 'TableCell.align / tabular', type: "'left' | 'right' | 'center' / boolean", description: 'Alignment and fixed-width digits.' },
    ],
  },

  'code-block': {
    description:
      'Preformatted source on a sunken surface, coloured by a small lexer in its own folder rather than by a syntax library — those ship a grammar engine and a palette larger than this component. Collapsing clips the height instead of slicing the string, so find-in-page and copy still see the whole file.',
    sections: [
      {
        title: 'Variants',
        stack: true,
        specimens: [
          {
            label: 'default',
            fill: true,
            node: (
              <CodeBlock
                language="bash"
                className="w-full max-w-[440px]"
                code={'npm install\nnpm run dev'}
              />
            ),
          },
          {
            label: 'numbered',
            fill: true,
            node: (
              <CodeBlock
                language="tsx"
                numbered
                className="w-full max-w-[440px]"
                code={'<Card title="Subscriptions">\n  <List>\n    <ListItem title="Apple Music" value="$8,99" />\n  </List>\n</Card>'}
              />
            ),
          },
          {
            label: 'no header',
            hint: 'copyable={false} and no language',
            fill: true,
            node: <CodeBlock copyable={false} className="w-full max-w-[440px]" code={'GB00 SPOT 0000 0000 5199'} />,
          },
        ],
      },
    ],
    props: [
      { name: 'code', type: 'string', description: 'Rendered verbatim.' },
      { name: 'language', type: 'string', description: 'Label in the header.' },
      { name: 'copyable', type: 'boolean', defaultValue: 'true', description: 'Copy-to-clipboard control.' },
      { name: 'numbered', type: 'boolean', defaultValue: 'false', description: 'Line numbers.' },
    ],
  },

  timeline: {
    description:
      'An ordered sequence of events, as a real ordered list. The connector is drawn between the markers rather than through them, so a long description never breaks the line.',
    sections: [
      {
        title: 'Default',
        stack: true,
        specimens: [
          {
            label: 'transfer status',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[380px]">
                <Timeline
                  label="Transfer status"
                  items={[
                    { id: '1', meta: 'Today, 4:28 PM', title: 'Transfer created', tone: 'success' },
                    { id: '2', meta: 'Today, 4:29 PM', title: 'Sent to the network', tone: 'success' },
                    {
                      id: '3',
                      meta: 'Expected tomorrow',
                      title: 'Arrives with the recipient',
                      description: 'Most transfers clear before 09:00 local time.',
                      tone: 'accent',
                    },
                    { id: '4', title: 'Confirmation', tone: 'neutral' },
                  ]}
                />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'items', type: '{ id, title, meta?, description?, tone? }[]', description: 'Events, oldest first.' },
      { name: 'label', type: 'string', description: 'Accessible name for the sequence.' },
    ],
  },

  'stat-card': {
    description:
      'A list tile generalised: glyph, overflow, name, then a figure and its progress. It is the shape product surfaces repeat most, and the reason Meter and Metric both exist. Passing onClick makes the whole tile activate.',
    sections: [
      {
        title: 'Example',
        description: 'The Monthly Payments row, rebuilt from the library.',
        bare: true,
        Content: StatCardExample,
      },
    ],
    props: [
      { name: 'icon / title', type: 'IconComponent / string', description: 'What the figure is about.' },
      { name: 'value', type: 'ReactNode', description: 'The headline figure, already formatted.' },
      { name: 'caption', type: 'string', description: 'Small line above the figure.' },
      { name: 'delta / trend', type: "string / 'up' | 'down' | 'flat'", description: 'Change since the last period.' },
      { name: 'meter', type: '{ value, total, label }', description: 'Discrete progress under the figure.' },
      { name: 'action', type: 'ReactNode', description: 'Overflow control or badge, top right.' },
      { name: 'onClick', type: '() => void', description: 'Makes the tile a button.' },
    ],
  },

  'filter-bar': {
    description:
      'The control strip above a list: quick toggles, any extra controls, the result count and one way to clear everything. The count is a live region because filtering changes the list without moving focus — otherwise a screen reader user gets no confirmation that anything happened.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: FilterBarExample,
      },
      {
        title: 'Composition',
        description: 'Children slot in between the chips and the count — a Select, a SearchField, a date range.',
        specimens: [
          {
            label: 'with an action',
            fill: true,
            node: (
              <FilterBar
                label="Filters with an action"
                filters={[{ value: 'all', label: 'All' }]}
                value={['all']}
                resultCount={27}
                resultLabel="transactions"
                onClear={() => undefined}
              >
                <Button size="sm" variant="outline">
                  Export
                </Button>
              </FilterBar>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'filters / value / onValueChange', type: 'FilterChip[] / string[] / fn', description: 'Quick toggles and their state.' },
      { name: 'children', type: 'ReactNode', description: 'Extra controls.' },
      { name: 'resultCount / resultLabel', type: 'number / string', description: 'Announced through a live region.' },
      { name: 'onClear', type: '() => void', description: 'Shown only while something is active.' },
    ],
  },
  list: {
    description:
      'Vertical rhythm and optional separators for a set of ListItems. It is a real ul, so the row count is announced — which is why ListItem renders an li and the two are always used together.',
    sections: [
      {
        title: 'Default',
        stack: true,
        specimens: [
          {
            label: 'plain',
            hint: 'Separated by rhythm, not by rules',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                {ROWS.slice(0, 3).map((row) => (
                  <ListItem
                    key={row.id}
                    leading={<IconTile icon={row.icon} />}
                    title={row.name}
                    subtitle="Monthly Plan"
                    value={row.price}
                  />
                ))}
              </List>
            ),
          },
          {
            label: 'divided',
            hint: 'For denser lists that need a boundary',
            fill: true,
            node: (
              <List divided className="w-full max-w-[340px]">
                {ROWS.slice(0, 3).map((row) => (
                  <ListItem
                    key={row.id}
                    leading={<IconTile icon={row.icon} />}
                    title={row.name}
                    subtitle="Monthly Plan"
                    value={row.price}
                  />
                ))}
              </List>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'divided', type: 'boolean', defaultValue: 'false', description: 'Hairline between rows.' },
      { name: 'label', type: 'string', description: 'Accessible name, when no heading already names the list.' },
    ],
  },
  'list-item': {
    description:
      'The row behind Recent transactions and Subscriptions: glyph, name over caption, then a right-aligned value over its own caption. Passing onClick turns the whole row into a button, which is the only way to make a row activatable without losing keyboard access.',
    sections: [
      {
        title: 'Anatomy',
        stack: true,
        specimens: [
          {
            label: 'full',
            hint: 'leading, title, subtitle, value, meta',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem
                  leading={<IconTile icon={Music} />}
                  title="Apple Music"
                  subtitle="Monthly Plan"
                  value="$8,99"
                  meta="Tomorrow"
                />
              </List>
            ),
          },
          {
            label: 'minimal',
            hint: 'title and value only',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem title="Bank network fee" value="$2,48 USD" />
              </List>
            ),
          },
          {
            label: 'trailing',
            hint: 'Replaces the value column with any node',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem
                  leading={<IconTile icon={Gamepad2} />}
                  title="GumZone"
                  subtitle="Monthly Plan"
                  trailing={<Button size="sm" variant="outline">Cancel</Button>}
                />
              </List>
            ),
          },
        ],
      },
      {
        title: 'States',
        description: 'Hover applies only to interactive rows — a static row that lights up on hover promises something it cannot do.',
        stack: true,
        specimens: [
          {
            label: 'default',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem leading={<IconTile icon={Music} />} title="Apple Music" subtitle="Monthly Plan" value="$8,99" />
              </List>
            ),
          },
          {
            label: 'highlighted',
            hint: 'The subscription due next',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem
                  leading={<IconTile icon={Zap} tone="accent" />}
                  title="Smart Home Security"
                  subtitle="Monthly Plan"
                  value="$79,99"
                  meta="Tomorrow"
                  highlighted
                />
              </List>
            ),
          },
          {
            label: 'interactive',
            hint: 'Hover or tab to it — it is a real button',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem
                  leading={<IconTile icon={Gamepad2} />}
                  title="GumZone"
                  subtitle="Monthly Plan"
                  value="$35,00"
                  onClick={() => undefined}
                />
              </List>
            ),
          },
          {
            label: 'valueTone',
            hint: 'For a credit or a refund',
            fill: true,
            node: (
              <List className="w-full max-w-[340px]">
                <ListItem title="Sarah Rosewood" subtitle="Today, 4:28 PM" value="+$125,00" valueTone="success" />
              </List>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'leading', type: 'ReactNode', description: 'IconTile or Avatar.' },
      { name: 'title / subtitle', type: 'string', description: 'The two left-hand lines.' },
      { name: 'value / meta', type: 'string', description: 'The two right-hand lines.' },
      { name: 'trailing', type: 'ReactNode', description: 'Replaces the value column entirely.' },
      { name: 'highlighted', type: 'boolean', defaultValue: 'false', description: 'Tints the row.' },
      { name: 'onClick', type: '() => void', description: 'Makes the row a button, with hover and keyboard access.' },
      { name: 'valueTone', type: "'default' | 'success' | 'danger'", defaultValue: "'default'", description: 'Colour for the value.' },
    ],
  },
}
