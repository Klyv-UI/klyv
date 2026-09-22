import { useState } from 'react'
import { FileText, Globe } from 'lucide-react'
import {
  BarList,
  CategoryBar,
  FunnelChart,
  JsonViewer,
  RelativeTime,
  Text,
  VirtualList,
} from 'klyvui'
import type { ExampleModule } from './types'

/* ------------------------------------------------------------- json viewer */

const RESPONSE = {
  id: 'ship_40182',
  status: 'in_transit',
  lane: { from: 'Rotterdam', to: 'Lyon', distanceKm: 1043 },
  vehicle: { plate: 'HX-44-2', driver: 'Priya Raman', temperatureControlled: false },
  eta: '2026-09-12T14:20:00Z',
  stops: [
    { depot: 'Antwerp', arrived: true },
    { depot: 'Luxembourg', arrived: true },
    { depot: 'Dijon', arrived: false },
  ],
  customs: null,
  weightKg: 18240.5,
}

/* ----------------------------------------------------------- relative time */

const MINUTE = 60_000
const LOADED = Date.now()

function ActivityExample() {
  const [now] = useState(() => Date.now())
  const events = [
    { what: 'Customs cleared MF-40182', at: now - 20_000 },
    { what: 'Trailer swap at Hamburg', at: now - 38 * MINUTE },
    { what: 'Night shift signed off', at: now - 7 * 60 * MINUTE },
    { what: 'Rate card updated', at: now - 30 * 60 * MINUTE },
  ]
  return (
    <ul className="flex w-full max-w-[460px] flex-col">
      {events.map((event) => (
        <li key={event.what} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0">
          <Text as="span" size="caption" weight="semibold">
            {event.what}
          </Text>
          <Text as="span" size="caption" tone="faint">
            <RelativeTime date={event.at} />
          </Text>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------ virtual list */

const LANES = ['Rotterdam → Lyon', 'Hamburg → Kraków', 'Antwerp → Milan', 'Bilbao → Toulouse', 'Gdańsk → Berlin']

function VirtualExample() {
  const [rows] = useState(() =>
    Array.from({ length: 10_000 }, (_, index) => ({
      id: index,
      reference: `MF-${40_000 + index}`,
      lane: LANES[index % LANES.length],
      kg: 800 + ((index * 7919) % 22_000),
    })),
  )

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <VirtualList
        label="Consignments"
        items={rows}
        itemHeight={44}
        height={300}
        getKey={(row) => row.id}
        renderItem={(row) => (
          <div className="flex h-full items-center justify-between gap-3 border-b border-line px-4">
            <Text as="span" size="caption" weight="bold" tabular>
              {row.reference}
            </Text>
            <Text as="span" size="caption" tone="soft" truncate>
              {row.lane}
            </Text>
            <Text as="span" size="caption" weight="semibold" tabular>
              {row.kg.toLocaleString()} kg
            </Text>
          </div>
        )}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- bar list */

const PAGES = [
  { id: 'pricing', label: '/pricing', value: 12_840, icon: FileText },
  { id: 'docs', label: '/docs/getting-started', value: 9_312, icon: FileText },
  { id: 'blocks', label: '/blocks/dashboard', value: 6_105, icon: FileText },
  { id: 'changelog', label: '/changelog', value: 3_870, icon: FileText },
  { id: 'careers', label: '/careers', value: 2_214, icon: FileText },
  { id: 'status', label: '/status', value: 1_630, icon: FileText },
  { id: 'legal', label: '/legal/terms', value: 704, icon: FileText },
]

const REFERRERS = [
  { id: 'search', label: 'Search engines', value: 41, icon: Globe },
  { id: 'direct', label: 'Direct', value: 27, icon: Globe },
  { id: 'newsletter', label: 'Newsletter', value: 18, icon: Globe },
  { id: 'social', label: 'Social', value: 14, icon: Globe },
]

/* ------------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'json-viewer': {
    description:
      'A payload as a collapsible tree — an API response, a webhook body, a log line. Every object and array is a disclosure button with aria-expanded, so it is navigable by Tab without the full ARIA tree pattern, and values take the code palette so JSON reads the same here as in a CodeBlock.',
    sections: [
      {
        title: 'Example',
        description: 'A tracking API response. Open and close any branch.',
        stack: true,
        Content: () => <JsonViewer label="Shipment response" data={RESPONSE} className="w-full max-w-[560px]" />,
      },
      {
        title: 'Named root, collapsed',
        specimens: [
          {
            label: 'rootName, depth 0',
            fill: true,
            node: (
              <JsonViewer
                label="Event payload"
                rootName="event"
                defaultExpandDepth={0}
                data={{ type: 'delivery.completed', at: '2026-09-11T09:30:00Z', signedBy: 'M. Laurent' }}
              />
            ),
          },
        ],
      },
    ],
  },

  'relative-time': {
    description:
      '"3 minutes ago", phrased by Intl.RelativeTimeFormat so it is right in every locale the browser knows — "yesterday" and "next week" included — and kept current without re-rendering every second. It renders a real time element with the exact moment, and the full date on hover.',
    sections: [
      {
        title: 'Phrasing',
        specimens: [
          { label: 'seconds', hint: 'Reads as now', node: <RelativeTime date={LOADED - 10_000} /> },
          { label: 'minutes', node: <RelativeTime date={LOADED - 12 * MINUTE} /> },
          { label: 'hours', node: <RelativeTime date={LOADED - 5 * 60 * MINUTE} /> },
          { label: 'a day', node: <RelativeTime date={LOADED - 26 * 60 * MINUTE} /> },
          { label: 'future', node: <RelativeTime date={LOADED + 8 * 24 * 60 * MINUTE} /> },
        ],
      },
      {
        title: 'Style and locale',
        specimens: [
          { label: 'short', node: <RelativeTime date={LOADED - 12 * MINUTE} unitStyle="short" /> },
          { label: 'narrow', node: <RelativeTime date={LOADED - 12 * MINUTE} unitStyle="narrow" /> },
          { label: 'de', node: <RelativeTime date={LOADED - 26 * 60 * MINUTE} locale="de" /> },
          { label: 'ja', node: <RelativeTime date={LOADED - 12 * MINUTE} locale="ja" /> },
        ],
      },
      { title: 'In a feed', stack: true, Content: ActivityExample },
    ],
  },

  'virtual-list': {
    description:
      'A list that renders only the rows in view. Ten thousand consignments cost a few dozen DOM nodes, yet every row keeps aria-setsize and aria-posinset, so it is still announced as one of ten thousand. Scroll position is read inside one animation frame and React only re-renders when the first visible row changes.',
    sections: [
      { title: 'Ten thousand rows', description: 'Scroll, or focus the list and use the arrow keys.', stack: true, Content: VirtualExample },
    ],
  },

  'bar-list': {
    description:
      'Ranked horizontal bars — the most common chart on a dashboard, and not really a chart. It is marked up as a list, so the label and the figure are real text read in order; the bar is decoration. Past a limit, the tail is summed into one row rather than cut off.',
    sections: [
      {
        title: 'Top pages',
        description: 'Seven pages, limited to five, with the rest summed.',
        stack: true,
        Content: () => <BarList label="Top pages this week" items={PAGES} limit={5} className="w-full max-w-[480px]" />,
      },
      {
        title: 'Shares',
        stack: true,
        Content: () => (
          <BarList
            label="Traffic by source"
            items={REFERRERS}
            format={(value) => `${value}%`}
            className="w-full max-w-[480px]"
          />
        ),
      },
    ],
  },

  'category-bar': {
    description:
      'One bar split into its parts. A donut asks the eye to compare angles; this asks it to compare lengths along one axis, which it does far better. Parts are separated by a gap rather than a border, unused capacity is its own quiet track, and a marker can show a quota or a limit.',
    sections: [
      {
        title: 'Against a total',
        description: 'Storage used of 128 GB, with the alert threshold marked.',
        stack: true,
        Content: () => (
          <CategoryBar
            label="Storage used"
            total={128}
            format={(value) => `${value} GB`}
            marker={{ value: 115, label: 'Alert at' }}
            className="w-full max-w-[520px]"
            segments={[
              { id: 'photos', label: 'Photos', value: 41 },
              { id: 'video', label: 'Video', value: 33 },
              { id: 'docs', label: 'Documents', value: 18 },
              { id: 'other', label: 'Other', value: 9 },
            ]}
          />
        ),
      },
      {
        title: 'Parts of a whole',
        stack: true,
        Content: () => (
          <CategoryBar
            label="Budget by team"
            format={(value) => `€${value}k`}
            className="w-full max-w-[520px]"
            segments={[
              { id: 'ops', label: 'Operations', value: 420 },
              { id: 'fleet', label: 'Fleet', value: 310 },
              { id: 'people', label: 'People', value: 150 },
            ]}
          />
        ),
      },
    ],
  },

  'funnel-chart': {
    description:
      'Conversion through ordered steps. Every bar is measured against the first step, so its length is the share of everyone who got that far; the line between steps is the share of the previous step that continued — the number a team can actually move.',
    sections: [
      {
        title: 'Example',
        description: 'A signup funnel over thirty days.',
        stack: true,
        Content: () => (
          <FunnelChart
            label="Signup funnel, last 30 days"
            className="w-full max-w-[520px]"
            steps={[
              { id: 'visit', label: 'Visited pricing', value: 48_210 },
              { id: 'start', label: 'Started signup', value: 9_870 },
              { id: 'verify', label: 'Verified email', value: 7_412 },
              { id: 'team', label: 'Invited a teammate', value: 3_198 },
              { id: 'paid', label: 'Upgraded to paid', value: 1_206 },
            ]}
          />
        ),
      },
    ],
  },
}
