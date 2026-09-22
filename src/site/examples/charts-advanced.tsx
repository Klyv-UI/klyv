import { useState } from 'react'
import {
  AreaChart,
  BarChart,
  Card,
  DonutChart,
  LineChart,
  Metric,
  SegmentedControl,
  Surface,
  Text,
} from 'klyvui'
import type { ExampleModule } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

const SERIES = [
  { id: 'in', label: 'Money in', values: [3200, 3400, 3100, 3800, 3600, 4200, 4100, 4600, 4400, 5100] },
  { id: 'out', label: 'Money out', values: [2400, 2900, 2600, 3100, 2800, 3400, 3200, 3600, 3300, 3900] },
]

const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`

function LineChartExample() {
  const [smooth, setSmooth] = useState('straight')
  return (
    <Card title="Cash flow" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <SegmentedControl
          label="Line style"
          size="sm"
          value={smooth}
          onValueChange={setSmooth}
          className="self-start"
          options={[
            { value: 'straight', label: 'Straight' },
            { value: 'smooth', label: 'Smooth' },
            { value: 'points', label: 'With points' },
          ]}
        />
        <LineChart
          series={SERIES}
          categories={MONTHS}
          label="Money in and out by month"
          format={money}
          smooth={smooth === 'smooth'}
          showPoints={smooth === 'points'}
        />
        <Text size="caption" tone="faint">
          Move the pointer across the plot for the readout. The same values are also rendered as a
          hidden data table, so the chart is not an image with no alternative.
        </Text>
      </div>
    </Card>
  )
}

function AreaChartExample() {
  const [stacked, setStacked] = useState('overlaid')
  return (
    <Card title="Balance over time" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <SegmentedControl
          label="Area style"
          size="sm"
          value={stacked}
          onValueChange={setStacked}
          className="self-start"
          options={[
            { value: 'overlaid', label: 'Overlaid' },
            { value: 'stacked', label: 'Stacked' },
          ]}
        />
        <AreaChart
          series={SERIES}
          categories={MONTHS}
          label="Money in and out by month"
          format={money}
          stacked={stacked === 'stacked'}
        />
      </div>
    </Card>
  )
}

function BarChartExample() {
  const [stacked, setStacked] = useState('grouped')
  return (
    <Card title="Spending by month" className="w-full">
      <div className="mt-3 flex flex-col gap-3">
        <SegmentedControl
          label="Bar style"
          size="sm"
          value={stacked}
          onValueChange={setStacked}
          className="self-start"
          options={[
            { value: 'grouped', label: 'Grouped' },
            { value: 'stacked', label: 'Stacked' },
          ]}
        />
        <BarChart
          series={SERIES}
          categories={MONTHS}
          label="Money in and out by month"
          format={money}
          stacked={stacked === 'stacked'}
        />
        <Text size="caption" tone="faint" leading="normal">
          The scale is zero-based, which for bars is not a preference: a bar encodes value by
          length, so a truncated axis makes small differences look large.
        </Text>
      </div>
    </Card>
  )
}

function DonutChartExample() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <Card className="items-center p-6">
        <DonutChart
          label="Spending by category"
          format={money}
          slices={[
            { id: 'bills', label: 'Bills', value: 418 },
            { id: 'subs', label: 'Subscriptions', value: 213 },
            { id: 'transfers', label: 'Transfers', value: 210 },
            { id: 'other', label: 'Other', value: 96 },
          ]}
        >
          <Metric label="Total" value="$937" size="sm" className="items-center" />
        </DonutChart>
      </Card>
      <Surface variant="sunken" padding="md" className="max-w-[36ch]">
        <Text size="caption" tone="faint" leading="normal">
          Hover a slice to raise it and read its value in the middle. Arcs are stroked paths rather
          than filled wedges, so the ring thickness is one number and the gaps stay even.
        </Text>
      </Surface>
    </div>
  )
}

const CHART_PROPS = [
  { name: 'series', type: 'ChartSeries[]', description: 'id, label, values, and an optional colour.' },
  { name: 'categories', type: 'string[]', description: 'One label per point. Used on the axis and in the tooltip.' },
  { name: 'label', type: 'string', description: 'Accessible name, and the caption on the hidden data table.' },
  { name: 'height', type: 'number', defaultValue: '220', description: 'Plot height. Width is fluid.' },
  { name: 'showLegend / showGrid', type: 'boolean', defaultValue: 'true', description: 'Series key; gridlines and y axis.' },
  { name: 'format', type: '(value: number) => string', description: 'Axis and tooltip formatting.' },
]

export const demos: ExampleModule = {
  'line-chart': {
    description:
      'A line chart over shared cartesian scaffolding — axes, gridlines, hover tracking, legend and the accessible data table all come from one place, so every chart in the family agrees. Series colours default along a ramp that stays distinguishable in greyscale, and each is named in the legend.',
    sections: [
      { title: 'Example', bare: true, Content: LineChartExample },
      {
        title: 'Accessibility',
        bare: true,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-3">
            {[
              ['A picture, plus a table', 'Every chart renders its values as a real hidden table, described by aria-describedby.'],
              ['Never colour alone', 'Series are named in the legend and in the table; the ramp holds up in greyscale.'],
              ['Hover is not required', 'The tooltip is an accelerator. Nothing is only available on hover.'],
            ].map(([title, copy]) => (
              <Surface key={title} variant="tile" padding="md" className="gap-1.5">
                <Text size="caption" weight="bold" tone="soft">
                  {title}
                </Text>
                <Text size="caption" weight="medium" tone="faint" leading="normal">
                  {copy}
                </Text>
              </Surface>
            ))}
          </div>
        ),
      },
    ],
    props: [
      ...CHART_PROPS,
      { name: 'smooth / showPoints', type: 'boolean', defaultValue: 'false', description: 'Curved segments; mark every point.' },
    ],
  },

  'area-chart': {
    description:
      'A line chart with the area under each series filled. Overlaid areas are translucent so a series behind another stays visible; stacked mode is for part-to-whole, where the top edge is the total. Use stacked only when the sum is meaningful — the upper bands are hard to read otherwise, since they no longer start at the axis.',
    sections: [{ title: 'Example', bare: true, Content: AreaChartExample }],
    props: [
      ...CHART_PROPS,
      { name: 'stacked', type: 'boolean', defaultValue: 'false', description: 'Stack the series instead of overlaying them.' },
    ],
  },

  'bar-chart': {
    description:
      'Categorical bars over the shared cartesian scaffolding. Grouped bars sit side by side; stacked bars sum to the top edge. Hovering a category dims the others rather than only highlighting one, which keeps the comparison legible.',
    sections: [{ title: 'Example', bare: true, Content: BarChartExample }],
    props: [
      ...CHART_PROPS,
      { name: 'stacked', type: 'boolean', defaultValue: 'false', description: 'Stack instead of grouping.' },
      { name: 'barRatio', type: 'number', defaultValue: '0.62', description: 'Bar width as a fraction of the band.' },
    ],
  },

  'donut-chart': {
    description:
      'Part-to-whole as a ring, with the total in the middle. Arcs are stroked paths rather than filled wedges, so ring thickness is one number and the gaps between slices stay even. Everything the hover shows is also in the legend and the hidden table.',
    sections: [{ title: 'Example', bare: true, Content: DonutChartExample }],
    props: [
      { name: 'slices', type: 'DonutSlice[]', description: 'id, label, value, and an optional colour.' },
      { name: 'label', type: 'string', description: 'Accessible name and table caption.' },
      { name: 'size / thickness', type: 'number', defaultValue: '200 / 0.28', description: 'Diameter, and ring thickness as a fraction of the radius.' },
      { name: 'children', type: 'ReactNode', description: 'Centre content, usually the total.' },
    ],
  },
}
