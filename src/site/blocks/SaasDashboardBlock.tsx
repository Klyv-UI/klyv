import { useState } from 'react'
import { Bell, CreditCard, FolderKanban, Home, LayoutDashboard, Plug, Settings, User, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ChangelogList,
  FeedbackWidget,
  IconButton,
  PageHeader,
  SearchField,
  SetupChecklist,
  Sidebar,
  StatCard,
  UpgradePrompt,
  UsageMeter,
  UserMenu,
  WorkspaceSwitcher,
} from 'klyvui'

/**
 * The signed-in home of a SaaS product.
 *
 * Everything on it answers "what should I do next": the trial banner says what
 * happens when it ends, the checklist opens its next step, the usage meter
 * names the limit that is close, and the changelog marks only what is unseen.
 */

const DAY = 86_400_000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY)

const WORKSPACES = [
  { id: 'northwind', name: 'Northwind', plan: 'Pro trial' },
  { id: 'kestrel', name: 'Kestrel Labs', plan: 'Team plan' },
  { id: 'side', name: 'Side project', plan: 'Free' },
]

const CHANGELOG = [
  { id: 'c3', date: daysFromNow(-1), version: 'v2.14', title: 'Workflows can now post to any webhook', tags: ['New'], body: 'Signed payloads, retried with backoff, every delivery listed.' },
  { id: 'c2', date: daysFromNow(-6), version: 'v2.13', title: 'Dashboards load twice as fast', tags: ['Improved'], body: 'Charts stream in as their queries finish.' },
  { id: 'c1', date: daysFromNow(-15), version: 'v2.12', title: 'CSV exports with non-Latin column names', tags: ['Fixed'], body: 'Exports are now UTF-8 with a byte-order mark.' },
]

export default function SaasDashboardBlock() {
  const [workspace, setWorkspace] = useState('northwind')
  const [section, setSection] = useState('home')
  const [done, setDone] = useState<string[]>(['account', 'install'])
  const mark = (id: string) => () => setDone((current) => [...current, id])

  return (
    <div className="flex min-h-[760px] w-full overflow-hidden rounded-[var(--radius-window)] border border-line bg-app">
      <aside className="hidden w-[248px] shrink-0 flex-col gap-4 border-r border-line bg-surface p-4 lg:flex">
        <WorkspaceSwitcher workspaces={WORKSPACES} value={workspace} onValueChange={setWorkspace} onCreate={() => undefined} fullWidth />
        <Sidebar
          label="App"
          value={section}
          onValueChange={setSection}
          groups={[
            {
              items: [
                { value: 'home', label: 'Home', icon: Home },
                { value: 'dashboards', label: 'Dashboards', icon: LayoutDashboard },
                { value: 'projects', label: 'Projects', icon: FolderKanban, badge: 27 },
              ],
            },
            {
              label: 'Workspace',
              items: [
                { value: 'members', label: 'Members', icon: Users },
                { value: 'integrations', label: 'Integrations', icon: Plug },
                { value: 'billing', label: 'Billing', icon: CreditCard },
                { value: 'settings', label: 'Settings', icon: Settings },
              ],
            },
          ]}
          className="border-0 p-0 shadow-none"
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <SearchField value="" onValueChange={() => undefined} label="Search" placeholder="Search or press ⌘K" inputSize="sm" containerClassName="max-w-[320px] flex-1" />
          <div className="ml-auto flex items-center gap-1.5">
            <FeedbackWidget placement="bottom" categories={['Idea', 'Bug', 'Other']} onSubmit={() => undefined} className="hidden sm:inline-flex" />
            <IconButton icon={Bell} label="Notifications" />
            <UserMenu
              name="Alex Morgan"
              email="alex@northwind.io"
              badge="Owner"
              items={[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'billing', label: 'Billing', icon: CreditCard },
              ]}
              onSignOut={() => undefined}
            />
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6">
          <UpgradePrompt
            variant="banner"
            title="You are on the Pro trial."
            description="Add a card to keep workflows when it ends."
            trialEndsAt={daysFromNow(5)}
            action={<Button size="sm" variant="white">Add payment method</Button>}
            onDismiss={() => undefined}
          />
          <PageHeader headingLevel="h2" title="Good morning, Alex" description="What changed across Northwind since yesterday." actions={<Button size="sm">New dashboard</Button>} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active users" value="12,481" delta="+8.2%" trend="up" caption="Last 7 days" />
            <StatCard title="Trial conversion" value="4.9%" delta="+0.6%" trend="up" caption="This month" />
            <StatCard title="Monthly churn" value="1.8%" delta="-0.3%" trend="down" caption="Rolling 30 days" />
            <StatCard title="MRR" value="$84.2k" delta="+3.1%" trend="up" caption="vs last month" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <SetupChecklist
                title="Finish setting up"
                description="Four steps to a dashboard the team uses."
                steps={[
                  { id: 'account', title: 'Create your account', done: done.includes('account') },
                  { id: 'install', title: 'Install the SDK', done: done.includes('install') },
                  { id: 'event', title: 'Send your first event', done: done.includes('event'), description: 'Events appear on the Live tab within seconds.', action: <Button size="sm" onClick={mark('event')}>Send a test event</Button> },
                  { id: 'invite', title: 'Invite your team', done: done.includes('invite'), description: 'Dashboards are more useful when the people who act on them can see them.', action: <Button size="sm" onClick={mark('invite')}>Invite people</Button> },
                ]}
              />
              <UsageMeter
                headingLevel="h3"
                layout="grid"
                period="Resets on 1 Oct"
                onUpgrade={() => undefined}
                items={[
                  { id: 'events', label: 'Events', used: 842_000, limit: 1_000_000 },
                  { id: 'seats', label: 'Seats', used: 8, limit: 10, unit: 'seats' },
                  { id: 'storage', label: 'Storage', used: 61.4, limit: 50, unit: 'GB', format: (value) => value.toFixed(1) },
                  { id: 'projects', label: 'Projects', used: 27, limit: null },
                ]}
              />
            </div>
            <Card title="What’s new" action={<Badge tone="neutral">1 new</Badge>}>
              <ChangelogList entries={CHANGELOG} unreadSince={daysFromNow(-3)} variant="compact" headingLevel="h3" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
