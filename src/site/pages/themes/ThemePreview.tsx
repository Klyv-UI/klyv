import { useState } from 'react'
import { ArrowUpRight, Bell, Check, CreditCard, Search, Sparkles, Users, Zap } from 'lucide-react'
import {
  Alert,
  AreaChart,
  Avatar,
  Badge,
  BarChart,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Kbd,
  Progress,
  SegmentedControl,
  Select,
  StatCard,
  Surface,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  Tag,
  Text,
  Textarea,
} from 'klyvui'

/**
 * Three screens built only from the library, so every theme setting has
 * somewhere to show: cards carry the style's shadows, fields and checkboxes
 * the radius, headings at every step the font, and the whole thing sits on
 * the base colour's surfaces and lines.
 */

type PreviewTab = 'dashboard' | 'forms' | 'marketing'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

export function ThemePreview() {
  const [tab, setTab] = useState<PreviewTab>('dashboard')
  return (
    <Tabs
      label="Preview screen"
      value={tab}
      onValueChange={setTab}
      items={[
        { value: 'dashboard', label: 'Dashboard', content: <Dashboard /> },
        { value: 'forms', label: 'Forms', content: <Forms /> },
        { value: 'marketing', label: 'Marketing', content: <Marketing /> },
      ]}
    />
  )
}

/* ------------------------------------------------------------- dashboard */

const INVOICES = [
  { id: 'INV-2041', customer: 'Northwind', amount: '$4,200.00', status: 'Paid' },
  { id: 'INV-2040', customer: 'Acme Labs', amount: '$1,860.00', status: 'Pending' },
  { id: 'INV-2039', customer: 'Globex', amount: '$9,315.50', status: 'Paid' },
  { id: 'INV-2038', customer: 'Initech', amount: '$720.00', status: 'Overdue' },
]

function Dashboard() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
        <StatCard icon={CreditCard} title="Revenue" value="$48,210" delta="+12.4%" trend="up" caption="This month" />
        <StatCard icon={Users} title="Active users" value="2,318" delta="+3.1%" trend="up" caption="Last 30 days" />
        <StatCard
          icon={Zap}
          title="API quota"
          value="72%"
          caption="Resets in 9 days"
          meter={{ value: 72, total: 100, label: 'API quota used' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Revenue" headingLevel="h3" action={<Badge tone="neutral">2026</Badge>}>
          <AreaChart
            label="Monthly revenue and costs, January to August"
            categories={MONTHS}
            height={190}
            series={[
              { id: 'revenue', label: 'Revenue', values: [18, 24, 22, 31, 29, 38, 42, 48] },
              { id: 'costs', label: 'Costs', values: [12, 14, 15, 17, 18, 20, 21, 23] },
            ]}
            format={(value) => `$${value}k`}
          />
        </Card>
        <Card title="Plan usage" headingLevel="h3">
          <div className="flex flex-col gap-4">
            {[
              ['Seats', 18, 25],
              ['Storage', 64, 100],
              ['Automations', 9, 10],
            ].map(([name, value, total]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <Text size="label" weight="semibold">
                    {name}
                  </Text>
                  <Text size="caption" tone="faint" tabular>
                    {value} / {total}
                  </Text>
                </div>
                <Progress value={Number(value)} max={Number(total)} label={`${name} used`} />
              </div>
            ))}
            <Alert tone="accent" title="Almost at your automation limit">
              Upgrade to keep new runs going.
            </Alert>
          </div>
        </Card>
      </div>

      <Card title="Recent invoices" headingLevel="h3" action={<Button size="sm" variant="ghost">View all</Button>}>
        <Table label="Recent invoices">
          <TableHead>
            <tr>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell align="right">Amount</TableHeaderCell>
              <TableHeaderCell align="right">Status</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {INVOICES.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  <span className="font-mono text-[12px]">{invoice.id}</span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={invoice.customer} size="xs" />
                    {invoice.customer}
                  </span>
                </TableCell>
                <TableCell align="right" tabular>
                  {invoice.amount}
                </TableCell>
                <TableCell align="right">
                  <Badge tone={invoice.status === 'Paid' ? 'accent' : 'neutral'}>{invoice.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------- forms */

function Forms() {
  const [plan, setPlan] = useState('team')
  const [region, setRegion] = useState('eu')
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
  return (
    <div className="grid grid-cols-1 gap-3 pt-4 @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title="Workspace settings" headingLevel="h3">
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Field label="Workspace name">
              <Input defaultValue="Northwind" />
            </Field>
            <Field label="Contact email" hint="Invoices go here.">
              <Input type="email" defaultValue="billing@northwind.test" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Field label="Plan">
              <Select
                label="Plan"
                value={plan}
                onValueChange={setPlan}
                fullWidth
                options={[
                  { value: 'starter', label: 'Starter' },
                  { value: 'team', label: 'Team' },
                  { value: 'enterprise', label: 'Enterprise' },
                ]}
              />
            </Field>
            <Field label="Data region">
              <Select
                label="Data region"
                value={region}
                onValueChange={setRegion}
                fullWidth
                options={[
                  { value: 'eu', label: 'Europe (Frankfurt)' },
                  { value: 'us', label: 'United States (Virginia)' },
                  { value: 'ap', label: 'Asia Pacific (Sydney)' },
                ]}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} defaultValue="Design and research for the Northwind product line." />
          </Field>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5">
              <Checkbox defaultChecked />
              <Text as="span" size="body" weight="medium">
                Email me a weekly summary
              </Text>
            </label>
            <label className="flex items-center gap-2.5">
              <Checkbox />
              <Text as="span" size="body" weight="medium">
                Require two-factor sign-in
              </Text>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <Card title="Billing" headingLevel="h3">
          <div className="flex flex-col gap-4">
            <SegmentedControl
              label="Billing period"
              value={billing}
              onValueChange={setBilling}
              fullWidth
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            <Surface variant="field" padding="md" className="flex-row items-center justify-between gap-3">
              <div className="flex flex-col">
                <Text size="label" weight="bold">
                  Team plan
                </Text>
                <Text size="caption" tone="faint">
                  {billing === 'yearly' ? 'Billed yearly, two months free' : 'Billed every month'}
                </Text>
              </div>
              <Text size="amount" tabular>
                {billing === 'yearly' ? '$40' : '$48'}
              </Text>
            </Surface>
            <label className="flex items-center justify-between gap-3">
              <Text as="span" size="body" weight="medium">
                Auto-renew
              </Text>
              <Switch defaultChecked aria-label="Auto-renew" />
            </label>
          </div>
        </Card>
        <Surface variant="card" padding="lg" className="gap-3">
          <Text as="h3" size="heading">
            Quick search
          </Text>
          <Input
            aria-label="Search the workspace"
            placeholder="Search people, files, invoices…"
            leading={<Search size={15} aria-hidden />}
          />
          <Text size="caption" tone="faint" className="flex items-center gap-1.5">
            Press <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> anywhere to open it.
          </Text>
          <div className="flex flex-wrap gap-1.5">
            <Tag>Design</Tag>
            <Tag tone="outline">Research</Tag>
            <Tag tone="accent">Launch</Tag>
          </div>
        </Surface>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- marketing */

const TIERS = [
  { name: 'Starter', price: '$0', blurb: 'For side projects.', features: ['3 projects', 'Community support'] },
  {
    name: 'Team',
    price: '$40',
    blurb: 'For teams shipping every week.',
    features: ['Unlimited projects', 'Audit log', 'Priority support'],
    featured: true,
  },
  { name: 'Enterprise', price: 'Custom', blurb: 'For regulated industries.', features: ['SSO and SCIM', 'Data residency'] },
]

function Marketing() {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <Surface variant="card" padding="lg" className="items-start gap-4 bg-app @xl:p-8">
        <Badge>
          <Sparkles size={11} aria-hidden className="mr-1" />
          New in 2.0
        </Badge>
        <div className="flex max-w-[52ch] flex-col gap-3">
          <Text as="h3" size="display" weight="extrabold" className="text-balance @xl:text-[40px] @xl:leading-[1.05]">
            Ship the dashboard your customers asked for.
          </Text>
          <Text size="subtitle" weight="medium" tone="soft" leading="normal">
            Charts, tables and settings screens that already agree with each other.
          </Text>
          <Text size="body" tone="faint" leading="normal">
            Every heading, label and caption on this screen is set in the theme’s font, at the library’s own type
            steps — from display down to micro.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>
            Start free trial
            <ArrowUpRight size={14} aria-hidden />
          </Button>
          <Button variant="outline">Book a demo</Button>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        {TIERS.map((tier) => (
          <Surface
            key={tier.name}
            variant="card"
            padding="lg"
            className={tier.featured ? 'gap-4 ring-2 ring-accent' : 'gap-4'}
          >
            <div className="flex items-center justify-between gap-2">
              <Text as="h4" size="heading">
                {tier.name}
              </Text>
              {tier.featured && <Badge>Popular</Badge>}
            </div>
            <div className="flex items-baseline gap-1">
              <Text size="title" weight="extrabold" tabular>
                {tier.price}
              </Text>
              {tier.price.startsWith('$') && (
                <Text size="caption" tone="faint">
                  per seat / month
                </Text>
              )}
            </div>
            <Text size="label" tone="soft" leading="normal">
              {tier.blurb}
            </Text>
            <ul className="flex flex-col gap-2">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check size={14} aria-hidden className="text-accent-strong" />
                  <Text as="span" size="label" weight="medium">
                    {feature}
                  </Text>
                </li>
              ))}
            </ul>
            <Button variant={tier.featured ? 'accent' : 'muted'} fullWidth className="mt-auto">
              Choose {tier.name}
            </Button>
          </Surface>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title="Signups by channel" headingLevel="h3">
          <BarChart
            label="Weekly signups by channel"
            categories={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
            height={160}
            series={[{ id: 'signups', label: 'Signups', values: [42, 58, 51, 74, 66] }]}
          />
        </Card>
        <Surface variant="sunken" padding="lg" className="justify-center gap-3">
          <div className="flex items-center gap-2">
            <Bell size={15} aria-hidden className="text-ink-soft" />
            <Text as="h3" size="heading">
              Get the changelog
            </Text>
          </div>
          <Text size="label" tone="soft" leading="normal">
            One email a month. No tracking pixels.
          </Text>
          <form className="flex flex-col gap-2 @md:flex-row" onSubmit={(event) => event.preventDefault()}>
            <Input type="email" aria-label="Email address" placeholder="you@company.test" containerClassName="flex-1" />
            <Button type="submit" variant="outline">
              Subscribe
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  )
}
