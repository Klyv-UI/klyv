import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Clock,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import {
  AppShell,
  AreaChart,
  Button,
  Card,
  DataTable,
  DonutChart,
  Navbar,
  PageHeader,
  Progress,
  SegmentedControl,
  Sidebar,
  StatCard,
  StatusDot,
  Surface,
  Text,
  Timeline,
  type DataTableColumn,
} from 'klyvui'

/**
 * A freight operations console.
 *
 * Everything on this screen is a library component — the shell, the table, the
 * charts, the status marks. The point is not the data: it is that a dense
 * operational screen needs no bespoke colour, radius or spacing, because the
 * tokens already describe all three. The one thing written by hand here is the
 * grid that arranges the cards.
 */
type NavKey = 'overview' | 'shipments' | 'fleet' | 'depots' | 'team' | 'reports' | 'settings'
type Range = '24h' | '7d' | '30d'

/**
 * `embedded` is for hosts that show this screen inside their own page, as the
 * docs do. Leave it off in a real app: the shell should own the main landmark
 * and the skip link, and it only hands them over when told there is a host.
 */
export default function DashboardBlock({ embedded = false }: { embedded?: boolean }) {
  const [nav, setNav] = useState<NavKey>('overview')
  const [range, setRange] = useState<Range>('7d')
  const [selected, setSelected] = useState<string[]>([])

  const series = useMemo(() => VOLUME[range], [range])

  return (
    <AppShell
      framed
      embedded={embedded}
      header={
        <Navbar
          brand="Meridian Freight"
          searchable
          searchPlaceholder="Search consignments, plates, depots…"
          user={{ name: 'Priya Raman' }}
          utilities={[
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: true },
            { id: 'docs', label: 'Documents', icon: FileText },
          ]}
        />
      }
      sidebar={
        <Sidebar
          label="Operations"
          value={nav}
          onValueChange={(value) => setNav(value as NavKey)}
          groups={[
            {
              items: [
                { value: 'overview', label: 'Overview', icon: LayoutDashboard },
                { value: 'shipments', label: 'Shipments', icon: Package, badge: 24 },
                { value: 'fleet', label: 'Fleet', icon: Truck },
              ],
            },
            {
              label: 'Network',
              items: [
                { value: 'depots', label: 'Depots', icon: Warehouse },
                { value: 'team', label: 'Drivers', icon: Users },
                { value: 'reports', label: 'Reports', icon: FileText },
              ],
            },
            {
              label: 'Workspace',
              items: [{ value: 'settings', label: 'Settings', icon: Settings }],
            },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <PageHeader
          title={nav === 'overview' ? 'Network overview' : LABELS[nav]}
          description="Live across 14 depots. Figures refresh every four minutes."
          meta={
            <div className="flex items-center gap-2">
              <StatusDot tone="success" ring />
              <Text as="span" size="caption" weight="semibold" tone="soft">
                All feeds healthy
              </Text>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <SegmentedControl
                label="Time range"
                size="sm"
                value={range}
                onValueChange={(value) => setRange(value as Range)}
                options={[
                  { value: '24h', label: '24h' },
                  { value: '7d', label: '7d' },
                  { value: '30d', label: '30d' },
                ]}
              />
              <Button size="sm">Book a load</Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Package}
            title="In transit"
            value="1,284"
            delta="+6.2%"
            trend="up"
            caption="consignments moving now"
          />
          <StatCard
            icon={Clock}
            title="On-time rate"
            value="94.1%"
            delta="+1.4pts"
            trend="up"
            caption="against promised window"
          />
          <StatCard
            icon={Gauge}
            title="Avg dwell"
            value="41m"
            delta="-8m"
            trend="down"
            caption="gate-in to gate-out"
          />
          <StatCard
            icon={Truck}
            title="Fleet in service"
            value="212"
            caption="of 240 vehicles"
            meter={{ value: 212, total: 240, label: 'Vehicles in service' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
          <Card
            title="Consignment volume"
            action={
              <Text size="caption" weight="semibold" tone="faint">
                {RANGE_CAPTION[range]}
              </Text>
            }
          >
            <div className="mt-3">
              <AreaChart
                label="Consignment volume by day"
                categories={CATEGORIES[range]}
                series={series}
                height={210}
                showLegend
                format={(value) => `${value} loads`}
              />
            </div>
          </Card>

          <Card title="Fleet status">
            <div className="mt-3 flex flex-col gap-4">
              <DonutChart
                label="Fleet status split"
                slices={FLEET}
                size={168}
                showLegend
                format={(value) => `${value} vehicles`}
              >
                <div className="flex flex-col items-center">
                  <Text size="amount" weight="extrabold" tabular>
                    240
                  </Text>
                  <Text size="micro" weight="bold" tone="faint">
                    vehicles
                  </Text>
                </div>
              </DonutChart>

              <Surface variant="sunken" padding="sm" className="gap-2">
                <Progress value={78} max={100} label="Trailer utilisation" size="sm" />
                <div className="flex items-center justify-between">
                  <Text size="micro" weight="semibold" tone="faint">
                    Trailer utilisation
                  </Text>
                  <Text size="micro" weight="bold" tabular>
                    78%
                  </Text>
                </div>
              </Surface>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
          <Card
            title="Active consignments"
            action={
              <Text size="caption" weight="semibold" tone="faint" tabular>
                {selected.length > 0 ? `${selected.length} selected` : `${SHIPMENTS.length} shown`}
              </Text>
            }
          >
            <div className="mt-3">
              <DataTable
                label="Active consignments"
                rows={SHIPMENTS}
                columns={COLUMNS}
                rowId={(row) => row.id}
                selectable
                selected={selected}
                onSelectedChange={setSelected}
                pageSize={6}
              />
            </div>
          </Card>

          <Card title="Route events">
            <div className="mt-3">
              <Timeline label="Route events" items={EVENTS} />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

/* -------------------------------------------------------------------- data */

const LABELS: Record<NavKey, string> = {
  overview: 'Network overview',
  shipments: 'Shipments',
  fleet: 'Fleet',
  depots: 'Depots',
  team: 'Drivers',
  reports: 'Reports',
  settings: 'Settings',
}

const RANGE_CAPTION: Record<Range, string> = {
  '24h': 'Hourly, last 24 hours',
  '7d': 'Daily, last 7 days',
  '30d': 'Daily, last 30 days',
}

const CATEGORIES: Record<Range, string[]> = {
  '24h': ['00', '04', '08', '12', '16', '20'],
  '7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  '30d': ['W1', 'W2', 'W3', 'W4'],
}

const VOLUME: Record<Range, { id: string; label: string; values: number[] }[]> = {
  '24h': [
    { id: 'delivered', label: 'Delivered', values: [18, 12, 64, 88, 71, 34] },
    { id: 'collected', label: 'Collected', values: [24, 19, 77, 96, 64, 28] },
  ],
  '7d': [
    { id: 'delivered', label: 'Delivered', values: [286, 312, 298, 341, 377, 194, 122] },
    { id: 'collected', label: 'Collected', values: [301, 328, 315, 352, 390, 210, 138] },
  ],
  '30d': [
    { id: 'delivered', label: 'Delivered', values: [1842, 1961, 2033, 2148] },
    { id: 'collected', label: 'Collected', values: [1904, 2016, 2088, 2211] },
  ],
}

const FLEET = [
  { id: 'transit', label: 'In transit', value: 138 },
  { id: 'loading', label: 'At depot', value: 52 },
  { id: 'idle', label: 'Idle', value: 22 },
  { id: 'service', label: 'In service', value: 28 },
]

interface Shipment {
  id: string
  reference: string
  lane: string
  vehicle: string
  eta: string
  progress: number
  state: 'On time' | 'At risk' | 'Delayed' | 'Delivered'
}

const SHIPMENTS: Shipment[] = [
  { id: 's1', reference: 'MF-40182', lane: 'Rotterdam → Lyon', vehicle: 'HX-44-2', eta: '14:20', progress: 82, state: 'On time' },
  { id: 's2', reference: 'MF-40188', lane: 'Hamburg → Kraków', vehicle: 'HX-11-9', eta: '16:05', progress: 64, state: 'At risk' },
  { id: 's3', reference: 'MF-40191', lane: 'Antwerp → Milan', vehicle: 'TR-08-4', eta: '19:40', progress: 38, state: 'On time' },
  { id: 's4', reference: 'MF-40204', lane: 'Bilbao → Toulouse', vehicle: 'TR-27-1', eta: '11:55', progress: 96, state: 'On time' },
  { id: 's5', reference: 'MF-40211', lane: 'Gdańsk → Berlin', vehicle: 'HX-63-7', eta: '09:30', progress: 100, state: 'Delivered' },
  { id: 's6', reference: 'MF-40219', lane: 'Porto → Madrid', vehicle: 'TR-15-6', eta: '22:10', progress: 21, state: 'Delayed' },
  { id: 's7', reference: 'MF-40225', lane: 'Dublin → Belfast', vehicle: 'HX-02-3', eta: '13:45', progress: 57, state: 'On time' },
]

const STATE_TONE: Record<Shipment['state'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  'On time': 'success',
  'At risk': 'warning',
  Delayed: 'danger',
  Delivered: 'neutral',
}

const COLUMNS: DataTableColumn<Shipment>[] = [
  {
    id: 'reference',
    header: 'Reference',
    sortValue: (row) => row.reference,
    cell: (row) => (
      <Text as="span" size="caption" weight="bold" tabular>
        {row.reference}
      </Text>
    ),
  },
  {
    id: 'lane',
    header: 'Lane',
    sortValue: (row) => row.lane,
    cell: (row) => (
      <span className="flex items-center gap-1.5">
        <MapPin size={13} aria-hidden className="text-ink-faint" />
        <Text as="span" size="caption" weight="medium" tone="soft">
          {row.lane}
        </Text>
      </span>
    ),
  },
  {
    id: 'vehicle',
    header: 'Vehicle',
    sortValue: (row) => row.vehicle,
    tabular: true,
    cell: (row) => (
      <Text as="span" size="caption" weight="medium" tone="soft" tabular>
        {row.vehicle}
      </Text>
    ),
  },
  {
    id: 'progress',
    header: 'Progress',
    sortValue: (row) => row.progress,
    width: '120px',
    cell: (row) => <Progress value={row.progress} max={100} size="sm" label={`${row.reference} progress`} />,
  },
  {
    id: 'eta',
    header: 'ETA',
    align: 'right',
    tabular: true,
    sortValue: (row) => row.eta,
    cell: (row) => (
      <Text as="span" size="caption" weight="bold" tabular>
        {row.eta}
      </Text>
    ),
  },
  {
    id: 'state',
    header: 'State',
    align: 'right',
    sortValue: (row) => row.state,
    cell: (row) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusDot tone={STATE_TONE[row.state]} />
        <Text as="span" size="caption" weight="semibold" tone="soft">
          {row.state}
        </Text>
      </span>
    ),
  },
]

const EVENTS = [
  { id: 'e1', meta: '12:04', title: 'Customs cleared at Lyon', description: 'MF-40182 released after a 22 minute hold.', tone: 'success' as const },
  { id: 'e2', meta: '11:38', title: 'Weather advisory on the A4', description: 'Two lanes restricted near Metz. Three consignments re-timed.', tone: 'warning' as const },
  { id: 'e3', meta: '10:52', title: 'Trailer swap at Hamburg', description: 'HX-11-9 moved to trailer TR-88 after a brake fault.', tone: 'danger' as const },
  { id: 'e4', meta: '09:30', title: 'MF-40211 delivered', description: 'Signed for at Berlin Spandau, 14 minutes early.', tone: 'neutral' as const },
]

