import { useState } from 'react'
import { CreditCard, Home, PieChart, User, Wallet } from 'lucide-react'
import {
  AnchorNav,
  Badge,
  Breadcrumb,
  Card,
  Pagination,
  Stepper,
  Surface,
  TabBar,
  Tabs,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

function TabsExample() {
  const [pill, setPill] = useState('all')
  const [underline, setUnderline] = useState('details')

  const panel = (copy: string) => (
    <Surface variant="sunken" padding="md">
      <Text size="caption" tone="soft" leading="normal">
        {copy}
      </Text>
    </Surface>
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Text size="caption" tone="faint">
          variant=&quot;pill&quot;
        </Text>
        <Tabs
          label="Transactions"
          value={pill}
          onValueChange={setPill}
          items={[
            { value: 'all', label: 'All', badge: <Badge tone="neutral">27</Badge>, content: panel('Every transaction on this account.') },
            { value: 'in', label: 'Incoming', content: panel('Credits only.') },
            { value: 'out', label: 'Outgoing', content: panel('Debits only.') },
            { value: 'flagged', label: 'Flagged', disabled: true, content: panel('Nothing flagged.') },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Text size="caption" tone="faint">
          variant=&quot;underline&quot; — for tabs inside a card
        </Text>
        <Card className="w-full">
          <Tabs
            variant="underline"
            label="Transfer"
            value={underline}
            onValueChange={setUnderline}
            items={[
              { value: 'details', label: 'Details', content: panel('Recipient, amount and reference.') },
              { value: 'timeline', label: 'Timeline', content: panel('Every step of the transfer.') },
              { value: 'receipt', label: 'Receipt', content: panel('A downloadable PDF.') },
            ]}
          />
        </Card>
      </div>
      <Text size="caption" tone="faint">
        Focus a tab and use the arrow keys, Home and End. Tab moves out to the panel.
      </Text>
    </div>
  )
}

function TabBarExample() {
  const [tab, setTab] = useState('home')
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full max-w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex h-[180px] items-center justify-center bg-app">
          <Text size="caption" tone="faint">
            {tab} screen
          </Text>
        </div>
        <TabBar
          label="Sections"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'home', label: 'Home', icon: Home },
            { value: 'wallet', label: 'Wallet', icon: Wallet, badge: true },
            { value: 'cards', label: 'Cards', icon: CreditCard },
            { value: 'reports', label: 'Reports', icon: PieChart },
            { value: 'you', label: 'You', icon: User },
          ]}
        />
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[46ch] text-center">
        It is a nav landmark with aria-current, not a tablist — a bottom bar switches routes, and
        announcing it as tabs would promise a panel that is not there.
      </Text>
    </div>
  )
}

function PaginationExample() {
  const [page, setPage] = useState(4)
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Two on one page, so each is named: landmarks of the same kind have
          to be distinguishable, or a screen reader lists "Pagination" twice. */}
      <Pagination page={page} pageCount={12} onPageChange={setPage} label="Pagination, full" />
      <Pagination
        page={page}
        pageCount={12}
        onPageChange={setPage}
        compact
        label="Pagination, compact"
      />
      <Text size="caption" tone="faint">
        The window keeps a fixed width, so the layout does not jump between pages.
      </Text>
    </div>
  )
}

function StepperExample() {
  const [current, setCurrent] = useState(1)
  const steps = [
    { id: 'recipient', label: 'Recipient', hint: 'Who is paid' },
    { id: 'amount', label: 'Amount', hint: 'How much' },
    { id: 'review', label: 'Review', hint: 'Check and send' },
    { id: 'done', label: 'Done' },
  ]
  return (
    <div className="flex w-full flex-col gap-6">
      <Stepper steps={steps} current={current} onStepSelect={setCurrent} className="w-full" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          className="h-8 rounded-full border border-line-strong px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setCurrent((value) => Math.min(steps.length - 1, value + 1))}
          className="h-8 rounded-full bg-accent px-3.5 text-[12px] font-bold text-accent-ink transition-colors hover:bg-accent-strong"
        >
          Next
        </button>
      </div>
      <Stepper steps={steps} current={current} orientation="vertical" onStepSelect={setCurrent} />
    </div>
  )
}

function AnchorNavExample() {
  return (
    <div className="flex w-full gap-6">
      <AnchorNav
        className="shrink-0"
        items={[
          { id: 'foundations', label: 'Foundations' },
          { id: 'layout', label: 'Layout' },
          { id: 'navigation', label: 'Navigation' },
        ]}
      />
      <Surface variant="sunken" padding="md" className="min-w-0 flex-1">
        <Text size="caption" tone="soft" leading="normal">
          This nav points at the level sections on the Overview page. Open that page and scroll —
          the active item follows what is actually on screen, and clicking moves focus into the
          section rather than only scrolling to it.
        </Text>
      </Surface>
    </div>
  )
}

export const demos: ExampleModule = {
  tabs: {
    description:
      'Tabs with the full keyboard model: arrows move, Home and End jump, and only the selected tab is a tab stop, so Tab moves out to the panel rather than through every tab. The pill variant reuses the primary nav treatment; underline is for tabs inside a card, where a filled pill would compete with the card header.',
    sections: [
      { title: 'Variants', bare: true, Content: TabsExample },
    ],
    props: [
      { name: 'items', type: 'TabItem[]', description: 'value, label, icon, badge, disabled and content.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected tab.' },
      { name: 'variant', type: "'pill' | 'underline'", defaultValue: "'pill'", description: 'Track treatment.' },
      { name: 'fullWidth', type: 'boolean', defaultValue: 'false', description: 'Stretch the tabs across the container.' },
    ],
  },

  'tab-bar': {
    description:
      'The bottom navigation bar for narrow viewports: icon over label, one row, always visible. It is navigation rather than tabs, so it uses a nav landmark with aria-current.',
    sections: [{ title: 'Example', bare: true, Content: TabBarExample }],
    props: [
      { name: 'items', type: 'TabBarItem[]', description: 'value, label, icon and an optional badge dot.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Current section.' },
      { name: 'fixed', type: 'boolean', defaultValue: 'false', description: 'Pin to the viewport bottom with safe-area padding.' },
    ],
  },

  breadcrumb: {
    description:
      'The path back up to the root. The last item is the current page: it is not a link and carries aria-current, so it is announced as the destination rather than as one more step. Long trails collapse in the middle, since the first and last items are the two that orient the reader.',
    sections: [
      {
        title: 'Length',
        stack: true,
        specimens: [
          {
            label: 'short',
            fill: true,
            node: (
              <Breadcrumb
                label="Breadcrumb, short"
                items={[{ label: 'Overview', href: '#' }, { label: 'Activity' }]}
              />
            ),
          },
          {
            label: 'full',
            fill: true,
            node: (
              <Breadcrumb
                label="Breadcrumb, full"
                items={[
                  { label: 'Overview', href: '#' },
                  { label: 'Activity', href: '#' },
                  { label: 'Transfers', href: '#' },
                  { label: 'Sarah Rosewood' },
                ]}
              />
            ),
          },
          {
            label: 'collapsed',
            hint: 'Beyond maxItems, the middle is elided',
            fill: true,
            node: (
              <Breadcrumb
                label="Breadcrumb, collapsed"
                items={[
                  { label: 'Overview', href: '#' },
                  { label: 'Activity', href: '#' },
                  { label: 'Transfers', href: '#' },
                  { label: 'October', href: '#' },
                  { label: 'Week 42', href: '#' },
                  { label: 'Sarah Rosewood' },
                ]}
              />
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'items', type: '{ label, href?, onClick? }[]', description: 'Root first. The last is the current page.' },
      { name: 'maxItems', type: 'number', defaultValue: '4', description: 'Collapse the middle beyond this.' },
    ],
  },

  'anchor-nav': {
    description:
      'In-page navigation with scroll spy. The active item is derived from what is on screen rather than from the last click, so it stays correct when the reader scrolls by hand. Clicking scrolls smoothly and then moves focus to the section, so a keyboard user is not left at the top of the document.',
    sections: [{ title: 'Example', bare: true, Content: AnchorNavExample }],
    props: [
      { name: 'items', type: '{ id, label }[]', description: 'Element ids to jump to, without the hash.' },
      { name: 'offset', type: 'number', defaultValue: '96', description: 'Distance from the top that counts as current.' },
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Layout.' },
    ],
  },

  pagination: {
    description:
      'Page navigation with a sliding window of page numbers. The first and last page are always reachable, and the current page is announced through a live region so a change is confirmed without moving focus.',
    sections: [{ title: 'Example', bare: true, Content: PaginationExample }],
    props: [
      { name: 'page / pageCount / onPageChange', type: 'number / number / fn', description: 'One-based current page.' },
      { name: 'siblings', type: 'number', defaultValue: '1', description: 'Numbered buttons either side of the current page.' },
      { name: 'compact', type: 'boolean', defaultValue: 'false', description: 'Arrows and a counter only.' },
    ],
  },

  stepper: {
    description:
      'Progress through a multi-step flow. Each marker carries its state as text for assistive tech, so completion is never conveyed by a tick alone. Completed steps can be revisited when onStepSelect is supplied; upcoming ones never can, since a flow that lets you skip ahead is not a flow.',
    sections: [{ title: 'Example', description: 'Move through the steps, then click a completed marker to go back.', bare: true, Content: StepperExample }],
    props: [
      { name: 'steps / current', type: 'StepperStep[] / number', description: 'Steps and the zero-based current index.' },
      { name: 'orientation', type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'", description: 'Layout.' },
      { name: 'onStepSelect', type: '(index: number) => void', description: 'Makes completed markers activatable.' },
    ],
  },
}
