import { useState } from 'react'
import {
  Card,
  ChartTooltip,
  Legend,
  Metric,
  ProgressChart,
  RadialGauge,
  Sparkline,
  Surface,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

const SERIES = [
  { label: 'Subscriptions', color: 'var(--color-accent-strong)', value: '$213.47' },
  { label: 'Bills', color: 'var(--color-accent)', value: '$418.20' },
  { label: 'Transfers', color: 'var(--color-accent-soft)', value: '$210.43' },
]

function SparklineExample() {
  const values = [12, 14, 13, 18, 17, 22, 26, 24, 29, 33, 31, 38]
  return (
    <div className="grid w-full gap-3 sm:grid-cols-3">
      {[
        { label: 'Balance', value: '$27,829.83', delta: '4.2%', tone: 'accent' as const, area: true },
        { label: 'Spending', value: '$842.10', delta: '8.1%', tone: 'danger' as const, area: false },
        { label: 'Cashback', value: '$1,154.00', delta: '12%', tone: 'success' as const, area: true },
      ].map((stat, index) => (
        <Card key={stat.label} className="gap-3">
          <Metric
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            trend={index === 1 ? 'down' : 'up'}
            size="sm"
          />
          <Sparkline
            values={index === 1 ? [...values].reverse() : values}
            label={`${stat.label} over twelve weeks`}
            tone={stat.tone}
            area={stat.area}
            showLast
            width={200}
            height={40}
            className="w-full"
          />
        </Card>
      ))}
    </div>
  )
}

function ChartTooltipExample() {
  const [point, setPoint] = useState(4)
  const values = [12, 14, 13, 18, 17, 22, 26]
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex flex-wrap gap-1.5">
        {days.map((day, index) => (
          <button
            key={day}
            type="button"
            onClick={() => setPoint(index)}
            aria-pressed={point === index}
            className={
              point === index
                ? 'rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-ink'
                : 'rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:border-line-strong'
            }
          >
            {day}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Sparkline values={values} label="Spending this week" area showLast width={220} height={56} />
        <ChartTooltip
          title={days[point]}
          rows={[
            { label: 'Spending', value: `$${values[point] * 12}.40`, color: 'var(--color-accent-strong)' },
            { label: 'Average', value: '$214.00', color: 'var(--color-line-strong)' },
          ]}
        />
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        The tooltip is presentational only — charts own their own hit-testing and positioning and
        simply render this where the pointer is. It is aria-hidden, because a chart must expose its
        values through an accessible summary or table, not through something that appears on hover.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  sparkline: {
    description:
      'An inline trend line: no axes, no gridlines, no chart runtime. It shows the shape of a series next to the figure it belongs to and leaves precision to that figure — which is exactly the right division of labour for a card-sized chart.',
    sections: [
      { title: 'Example', description: 'Metric plus Sparkline is the smallest useful analytics unit.', bare: true, Content: SparklineExample },
      {
        title: 'Tones and options',
        specimens: [
          { label: 'accent', node: <Sparkline values={[4, 7, 6, 11, 9, 14]} label="Accent trend" /> },
          { label: 'success', node: <Sparkline values={[4, 7, 6, 11, 9, 14]} label="Success trend" tone="success" /> },
          { label: 'danger', node: <Sparkline values={[14, 9, 11, 6, 7, 4]} label="Danger trend" tone="danger" /> },
          { label: 'neutral', node: <Sparkline values={[4, 7, 6, 11, 9, 14]} label="Neutral trend" tone="neutral" /> },
          { label: 'area', node: <Sparkline values={[4, 7, 6, 11, 9, 14]} label="Area trend" area /> },
          { label: 'showLast', node: <Sparkline values={[4, 7, 6, 11, 9, 14]} label="Last point marked" area showLast /> },
        ],
        note: 'It renders as role="img" with the label as its alternative text, so the series is described rather than announced as a meaningless graphic. Say what the trend is, not just what it is called.',
      },
    ],
    props: [
      { name: 'values', type: 'number[]', description: 'Oldest first. Needs at least two points.' },
      { name: 'label', type: 'string', description: 'Accessible summary of the trend.' },
      { name: 'tone', type: "'accent' | 'success' | 'danger' | 'neutral'", defaultValue: "'accent'", description: 'Stroke colour.' },
      { name: 'area / showLast', type: 'boolean', description: 'Fill under the line; mark the most recent point.' },
      { name: 'width / height', type: 'number', defaultValue: '96 / 28', description: 'Intrinsic size.' },
    ],
  },

  legend: {
    description:
      'The series key shared by every chart. Swatches are decorative — the label beside each one identifies the series, so colour is never the only carrier of meaning. Optional values turn a key into a small summary table.',
    sections: [
      {
        title: 'Orientation',
        stack: true,
        specimens: [
          { label: 'horizontal', fill: true, node: <Legend series={SERIES} label="Spending by category" /> },
          { label: 'vertical', fill: true, node: <Legend series={SERIES} orientation="vertical" label="Spending by category" /> },
          {
            label: 'without values',
            fill: true,
            node: <Legend series={SERIES.map(({ label, color }) => ({ label, color }))} label="Categories" />,
          },
        ],
      },
    ],
    props: [
      { name: 'series', type: '{ label, color, value? }[]', description: 'Colour is any CSS value; prefer a token.' },
      { name: 'orientation', type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'", description: 'Layout.' },
    ],
  },

  'chart-tooltip': {
    description:
      'The panel shown for a hovered data point. Presentational only, and aria-hidden — a chart must expose its values through an accessible summary or table, not through a tooltip that only appears on hover.',
    sections: [{ title: 'Example', description: 'Pick a day to change the readout.', bare: true, Content: ChartTooltipExample }],
    props: [
      { name: 'title', type: 'string', description: 'Category or timestamp for the point.' },
      { name: 'rows', type: '{ label, value, color? }[]', description: 'One line per series.' },
    ],
  },

  'radial-gauge': {
    description:
      'ProgressRing with a readout and an optional scale. The ring alone shows the shape; the figure in the middle is what makes it readable to the digit. Use it where the slot is square rather than wide.',
    sections: [
      {
        title: 'Variants',
        specimens: [
          { label: 'default', node: <RadialGauge value={72} label="Monthly budget used" unit="%" /> },
          { label: 'custom range', node: <RadialGauge value={640} min={300} max={850} label="Credit score" showScale format={(next) => String(Math.round(next))} /> },
          { label: 'no scale', node: <RadialGauge value={45} label="Storage used" unit="%" showScale={false} /> },
          { label: 'sm', node: <RadialGauge value={80} size="sm" label="Small gauge" unit="%" showScale={false} /> },
        ],
      },
      {
        title: 'In a card',
        bare: true,
        Content: () => (
          <Card title="Monthly budget" className="w-full max-w-[300px]">
            <div className="mt-3 flex items-center gap-4">
              <RadialGauge value={72} label="Monthly budget used" unit="%" showScale={false} />
              <div className="min-w-0">
                <Metric label="Spent" value="$1,842" size="sm" caption="of $2,560" />
              </div>
            </div>
          </Card>
        ),
      },
    ],
    props: [
      { name: 'value / min / max', type: 'number', defaultValue: '— / 0 / 100', description: 'The reading and its range.' },
      { name: 'label', type: 'string', description: 'What is measured; becomes the accessible name.' },
      { name: 'unit', type: 'string', description: 'Shown after the centre figure.' },
      { name: 'showScale', type: 'boolean', defaultValue: 'true', description: 'Show min and max under the arc.' },
      { name: 'format', type: '(value: number) => string', description: 'Formats the centre figure and the scale.' },
    ],
  },

  'progress-chart': {
    description:
      'Part-to-whole as one stacked bar, with the series key underneath. Use it when the parts sum to something meaningful; when they do not, a row of separate Progress bars is clearer and less likely to be misread.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <Card title="Spending this month" className="w-full max-w-[440px]">
            <div className="mt-3 flex flex-col gap-4">
              <Metric label="Total" value="$842.10" delta="8.1%" trend="down" size="sm" />
              <ProgressChart
                label="Spending by category"
                segments={[
                  { label: 'Bills', value: 418.2 },
                  { label: 'Subscriptions', value: 213.47 },
                  { label: 'Transfers', value: 210.43 },
                ]}
                format={(value) => `$${value.toFixed(2)}`}
              />
            </div>
          </Card>
        ),
      },
      {
        title: 'Options',
        stack: true,
        specimens: [
          {
            label: 'sm, no legend',
            fill: true,
            node: (
              <div className="w-full max-w-[320px]">
                <ProgressChart
                  size="sm"
                  showLegend={false}
                  label="Spending by category"
                  segments={[
                    { label: 'Bills', value: 50 },
                    { label: 'Subscriptions', value: 30 },
                    { label: 'Transfers', value: 20 },
                  ]}
                />
              </div>
            ),
          },
          {
            label: 'against a total',
            hint: 'total larger than the sum leaves a remainder',
            fill: true,
            node: (
              <div className="w-full max-w-[320px]">
                <ProgressChart
                  label="Budget used"
                  total={100}
                  segments={[
                    { label: 'Spent', value: 62 },
                    { label: 'Committed', value: 14 },
                  ]}
                  format={(value) => `${value}%`}
                />
              </div>
            ),
          },
        ],
      },
      {
        title: 'Custom colours',
        specimens: [
          {
            label: 'explicit colours',
            fill: true,
            node: (
              <Surface variant="card" padding="lg" className="w-full max-w-[380px]">
                <ProgressChart
                  label="Portfolio"
                  segments={[
                    { label: 'Cash', value: 40, color: 'var(--color-accent-strong)' },
                    { label: 'Savings', value: 35, color: 'var(--color-success)' },
                    { label: 'Invested', value: 25, color: 'var(--color-ink-faint)' },
                  ]}
                  format={(value) => `${value}%`}
                />
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'segments', type: '{ label, value, color? }[]', description: 'Colours default along the accent ramp.' },
      { name: 'total', type: 'number', description: 'Defaults to the sum of the segments.' },
      { name: 'label', type: 'string', description: 'Accessible name; the values are read from it too.' },
      { name: 'showLegend', type: 'boolean', defaultValue: 'true', description: 'Series key underneath.' },
      { name: 'format', type: '(value: number) => string', description: 'Formats values in the key.' },
    ],
  },
}
