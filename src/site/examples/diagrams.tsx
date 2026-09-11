import { useState } from 'react'
import { RadarChart, SankeyFlow, SegmentedControl, Surface, Text } from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const AXES = [
  { key: 'housing', label: 'Housing', max: 1600 },
  { key: 'food', label: 'Food', max: 700 },
  { key: 'transport', label: 'Transport', max: 400 },
  { key: 'leisure', label: 'Leisure', max: 500 },
  { key: 'subs', label: 'Subscriptions', max: 300 },
  { key: 'saving', label: 'Saving', max: 1200 },
]

const SERIES = [
  {
    id: 'you',
    label: 'You, September',
    values: { housing: 1250, food: 480, transport: 190, leisure: 320, subs: 213, saving: 780 },
  },
  {
    id: 'average',
    label: 'Similar accounts',
    values: { housing: 1400, food: 560, transport: 310, leisure: 240, subs: 96, saving: 420 },
  },
]

const FLOW_NODES = [
  { id: 'salary', label: 'Salary', color: 'var(--color-accent-strong)' },
  { id: 'freelance', label: 'Freelance', color: 'var(--color-success)' },
  { id: 'account', label: 'Everyday account', color: 'var(--color-ink)' },
  { id: 'housing', label: 'Housing', color: 'var(--color-ink-faint)' },
  { id: 'living', label: 'Living', color: 'var(--color-ink-faint)' },
  { id: 'savings', label: 'Savings', color: 'var(--color-accent-strong)' },
  { id: 'pot', label: 'Holiday pot' },
  { id: 'invest', label: 'Investments' },
]

const FLOW_LINKS = [
  { from: 'salary', to: 'account', value: 4200 },
  { from: 'freelance', to: 'account', value: 900 },
  { from: 'account', to: 'housing', value: 1250 },
  { from: 'account', to: 'living', value: 1420 },
  { from: 'account', to: 'savings', value: 2430 },
  { from: 'savings', to: 'pot', value: 800 },
  { from: 'savings', to: 'invest', value: 1630 },
]

const money = (value: number) => `$${value.toLocaleString('en-US')}`

/* ----------------------------------------------------------- specimens */

function RadarExample() {
  const [both, setBoth] = useState(true)

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <SegmentedControl
        label="Series"
        size="sm"
        value={both ? 'both' : 'one'}
        onValueChange={(value) => setBoth(value === 'both')}
        options={[
          { value: 'both', label: 'Compared' },
          { value: 'one', label: 'Yours only' },
        ]}
      />
      <Surface variant="card" padding="lg" className="w-full">
        <RadarChart
          label="Spending profile, September"
          axes={AXES}
          series={both ? SERIES : SERIES.slice(0, 1)}
          size={280}
          format={money}
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        Every axis carries its own maximum, so housing at $1,250 does not flatten subscriptions at
        $213 against the centre. Hover a shape to read its values.
      </Text>
    </div>
  )
}

function SankeyExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full gap-3">
      <Text size="heading">Where September went</Text>
      <SankeyFlow
        label="Income and spending, September"
        nodes={FLOW_NODES}
        links={FLOW_LINKS}
        width={620}
        height={280}
        format={money}
      />
      <Text size="caption" tone="faint" leading="normal">
        Hover a node to light every flow through it. Savings sits in the third column because it is
        reached from the account, and its own outflows push the pots to a fourth.
      </Text>
    </Surface>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'radar-chart': {
    description:
      'Several measures of the same thing at once, as a shape rather than a row of bars. A radar answers exactly one question well — is this profile balanced — and each axis carries its own maximum, so measures on different scales can share one outline.',
    sections: [
      {
        title: 'Example',
        description: 'Hover a shape to read its values; the second series is drawn translucent over the first.',
        bare: true,
        Content: RadarExample,
        note: motionNote('the shapes are drawn at full size immediately rather than growing from the centre.'),
      },
      rationale(
        'The chart family could show any one of these measures well and all six together not at all — a six-bar chart shows magnitudes but not shape, and shape is the question.',
        'A radar makes balance legible at a glance, and drawing series as translucent fills is what stops a second one simply hiding the first.',
        'A spending profile against a benchmark, a risk breakdown, a skills or coverage matrix.',
        ['Legend', 'VisuallyHidden', 'useInView', 'SERIES_COLORS'],
      ),
      {
        title: 'Read it carefully',
        bare: true,
        Content: () => (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
            Area grows with the square of the radius, so a shape twice as far out looks four times
            as big — which is why this is the wrong chart for comparing magnitudes and the right one
            for comparing profiles. Reach for BarChart when the question is “how much”.
          </Text>
        ),
      },
    ],
    props: [
      { name: 'axes', type: 'RadarAxis[]', description: 'key, label and an optional per-axis max.' },
      { name: 'series', type: 'RadarSeries[]', description: 'id, label, and values keyed by axis.' },
      { name: 'size / rings', type: 'number / number', defaultValue: '260 / 4', description: 'Chart size, and rings drawn behind the shapes.' },
      { name: 'animate', type: 'boolean', defaultValue: 'true', description: 'Grow from the centre when it first enters the viewport.' },
      { name: 'showLegend / format', type: 'boolean / fn', defaultValue: 'true / String', description: 'The key, and value formatting.' },
    ],
  },

  'sankey-flow': {
    description:
      'Where an amount comes from and where it goes, as ribbons whose thickness is the amount itself. Columns are assigned by longest path from a source rather than by declaration order, so a node fed from two different depths still lands to the right of both and no ribbon ever flows backwards.',
    sections: [
      {
        title: 'A month of money',
        description: 'Two income sources, one account, three destinations, and two of those split again.',
        bare: true,
        Content: SankeyExample,
        note: motionNote('unchanged — the diagram is static, and the highlight follows the pointer.'),
      },
      rationale(
        'A budget breakdown is normally a donut, which shows proportions but nothing about where money came from — and money always came from somewhere.',
        'Thickness carries the amount through the whole path, so income, account and destination are one picture instead of three charts the reader has to join up.',
        'A monthly summary, a budget planner, a cash-flow report, anywhere a total is split and split again.',
        ['VisuallyHidden', 'SVG paths', 'ink and accent tokens'],
      ),
    ],
    props: [
      { name: 'nodes / links', type: 'FlowNode[] / FlowLink[]', description: '{ id, label, color } and { from, to, value }.' },
      { name: 'width / height', type: 'number / number', defaultValue: '640 / 300', description: 'Diagram box. It scrolls horizontally when it does not fit.' },
      { name: 'nodeWidth / nodePadding', type: 'number / number', defaultValue: '12 / 14', description: 'Node bar width, and the gap between nodes in a column.' },
      { name: 'format', type: '(value: number) => string', description: 'Used on the node totals and in the hidden table.' },
    ],
  },
}
