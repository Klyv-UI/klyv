import { useState } from 'react'
import { Bell, CreditCard, Home, Info, LogOut, Settings, User, Wallet } from 'lucide-react'
import {
  BentoCell,
  BentoGrid,
  Breadcrumb,
  Button,
  Card,
  CardDeck,
  Carousel,
  Metric,
  Navbar,
  PageHeader,
  PromoBanner,
  PromoHighlight,
  Sidebar,
  SidebarRail,
  Sparkline,
  Surface,
  Tag,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

/** A miniature of the app window, so shell demos have somewhere to live. */
function Frame({ children, height = 320 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      style={{ height }}
      className="w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app"
    >
      {children}
    </div>
  )
}

function NavbarExample() {
  const [section, setSection] = useState('overview')
  const [query, setQuery] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      <Frame height={140}>
        <Navbar
          brand="Klyv"
          searchable
          onSearch={setQuery}
          value={section}
          onValueChange={setSection}
          user={{ name: 'Daniel Vance' }}
          sections={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity' },
            { value: 'manage', label: 'Manage' },
            { value: 'reports', label: 'Reports' },
          ]}
          utilities={[
            { id: 'alerts', label: 'Notifications', icon: Bell, badge: true },
            { id: 'help', label: 'Help', icon: Info },
          ]}
        />
      </Frame>
      <Text size="caption" tone="faint">
        Section: {section}
        {query ? ` · searching for “${query}”` : ''}. Open the search — it replaces the utility
        cluster rather than sitting beside it, which is how the header stays one row.
      </Text>
    </div>
  )
}

function RailExample() {
  const [section, setSection] = useState('home')
  return (
    <div className="flex items-start gap-6">
      <Surface variant="card" padding="md" className="items-center">
        <SidebarRail
          value={section}
          onValueChange={setSection}
          items={[
            { value: 'home', label: 'Home', icon: Home },
            { value: 'wallet', label: 'Wallet', icon: Wallet },
            { value: 'cards', label: 'Cards', icon: CreditCard },
            { value: 'profile', label: 'Profile', icon: User },
          ]}
          footerItems={[
            { value: 'settings', label: 'Settings', icon: Settings },
            { value: 'signout', label: 'Sign out', icon: LogOut },
          ]}
          className="h-[280px]"
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[42ch]">
        Hover or tab through the rail. Every control has a real label through IconButton, so the
        tooltips are an accelerator rather than the only way to know what a glyph means.
      </Text>
    </div>
  )
}

function SidebarExample() {
  const [section, setSection] = useState('overview')
  return (
    <Surface variant="card" padding="md" className="w-full max-w-[280px]">
      <Sidebar
        value={section}
        onValueChange={setSection}
        groups={[
          {
            label: 'Money',
            items: [
              { value: 'overview', label: 'Overview', icon: Home },
              { value: 'activity', label: 'Activity', icon: Wallet, badge: 12 },
              { value: 'cards', label: 'Cards', icon: CreditCard },
            ],
          },
          {
            label: 'Account',
            items: [
              { value: 'profile', label: 'Profile', icon: User },
              { value: 'settings', label: 'Settings', icon: Settings },
              { value: 'closed', label: 'Closed accounts', disabled: true },
            ],
          },
        ]}
        footer={
          <Text size="caption" tone="faint">
            Signed in as Daniel Vance
          </Text>
        }
        className="w-full"
      />
    </Surface>
  )
}

function CarouselExample() {
  return (
    <Carousel label="Accounts" gridFrom="xl" columns={3} className="w-full">
      {['Current account', 'Savings', 'Joint account', 'Travel card', 'Business'].map((name) => (
        <Card key={name} title={name} className="h-[160px]">
          <Metric label="Balance" value="$8,412.09" size="sm" className="mt-2" />
          <Sparkline
            values={[8, 11, 9, 14, 13, 18]}
            label={`${name} over six months`}
            area
            className="mt-auto w-full"
            width={220}
            height={36}
          />
        </Card>
      ))}
    </Carousel>
  )
}

export const demos: ExampleModule = {
  'app-shell': {
    description:
      'The page frame: a tinted canvas, a rounded application window from xl up, a header, an optional rail, and the content column. It renders the SkipLink as the first focusable element and gives main a real id and tabIndex, so the skip actually lands somewhere — the part usually missing when a shell is assembled by hand.',
    sections: [
      {
        title: 'Structure',
        bare: true,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {[
              ['SkipLink', 'First focusable element, before the header.'],
              ['header', 'The Navbar slot. Fixed 76px, at every width.'],
              ['sidebar', 'The rail or full sidebar. Hidden below lg.'],
              ['main', 'id="app-main", tabIndex -1 so the skip link can focus it.'],
            ].map(([slot, copy]) => (
              <Surface key={slot} variant="tile" padding="md" className="gap-1.5">
                <Tag size="sm">{slot}</Tag>
                <Text size="caption" weight="medium" tone="faint" leading="normal">
                  {copy}
                </Text>
              </Surface>
            ))}
          </div>
        ),
        note: 'The framed window is the framed window presentation, reproduced from xl up. Pass framed={false} for a conventional full-bleed application.',
      },
    ],
    props: [
      { name: 'header / sidebar / bottomBar', type: 'ReactNode', description: 'Region slots.' },
      { name: 'framed', type: 'boolean', defaultValue: 'true', description: 'The floating rounded window from xl up.' },
      { name: 'maxWidth', type: 'number', defaultValue: '1512', description: 'Content width. The design viewport.' },
    ],
  },

  navbar: {
    description:
      'The application header: lockup, primary navigation, utilities and identity. Search replaces the utility cluster rather than sitting beside it, which is how the design keeps the header to one row at every width. The nav collapses into a menu trigger below xl.',
    sections: [{ title: 'Example', bare: true, Content: NavbarExample }],
    props: [
      { name: 'brand / brandMark', type: 'string / ReactNode', description: 'The Wordmark lockup.' },
      { name: 'sections / value / onValueChange', type: 'SegmentedOption[] / string / fn', description: 'Primary navigation.' },
      { name: 'utilities', type: 'NavbarUtility[]', description: 'Icon cluster, with optional unread markers.' },
      { name: 'searchable / onSearch', type: 'boolean / fn', description: 'Adds the expanding search.' },
      { name: 'user', type: '{ name, src? }', description: 'Identity avatar.' },
    ],
  },

  'sidebar-rail': {
    description:
      'The 42px icon rail: a primary group optically centred against the content column, and a utility group pinned to the bottom. Every control carries a real label through IconButton, so the rail is usable without the tooltips.',
    sections: [{ title: 'Example', bare: true, Content: RailExample }],
    props: [
      { name: 'items / footerItems', type: 'RailItem[]', description: 'Primary and pinned groups.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Current section.' },
      { name: 'tooltips', type: 'boolean', defaultValue: 'true', description: 'Show a Tooltip on each control.' },
    ],
  },

  sidebar: {
    description:
      'The full-width navigation column: grouped sections with optional counts. The current item carries aria-current="page" rather than only a background colour, so it is announced as the current location.',
    sections: [{ title: 'Example', bare: true, Content: SidebarExample }],
    props: [
      { name: 'groups', type: 'SidebarGroup[]', description: 'Each with an optional heading and its items.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Current section.' },
      { name: 'footer', type: 'ReactNode', description: 'Pinned below a divider.' },
    ],
  },

  'page-header': {
    description:
      'The title block for a route: optional trail, heading, supporting line, metadata and actions. It defaults to h1 because a page has exactly one — which is what makes the heading outline correct without every route remembering.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <Surface variant="card" padding="lg" className="w-full">
            <PageHeader
              headingLevel="h2"
              above={
                <Breadcrumb
                  items={[
                    { label: 'Overview', href: '#' },
                    { label: 'Activity', href: '#' },
                    { label: 'Sarah Rosewood' },
                  ]}
                />
              }
              title="Transfer to Sarah Rosewood"
              description="Sent on 14 October 2026. Funds arrived the next working day."
              meta={
                <>
                  <Tag size="sm" tone="accent">
                    Completed
                  </Tag>
                  <Text size="caption" tone="faint">
                    Reference RENT-OCT-26
                  </Text>
                </>
              }
              actions={
                <>
                  <Button size="sm" variant="outline">
                    Download receipt
                  </Button>
                  <Button size="sm">Send again</Button>
                </>
              }
            />
          </Surface>
        ),
      },
    ],
    props: [
      { name: 'title / description', type: 'string', description: 'Heading and supporting line.' },
      { name: 'above', type: 'ReactNode', description: 'Breadcrumb or BackButton.' },
      { name: 'actions / meta', type: 'ReactNode', description: 'Right-aligned affordances; metadata row.' },
      { name: 'headingLevel', type: "'h1' | 'h2'", defaultValue: "'h1'", description: 'Semantics only.' },
    ],
  },

  'bento-grid': {
    description:
      'The mixed-span card grid. Cells default to one column and one row; BentoCell widens or heightens the ones that need it. Spans only apply from the sm breakpoint up, so a bento layout collapses to a single readable column on a phone rather than producing a squashed mosaic.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <BentoGrid columns={3} className="w-full">
            <BentoCell colSpan={2}>
              <Card title="Balance" className="h-full">
                <Metric label="Available" value="$27,829.83" delta="4.2%" trend="up" className="mt-2" />
              </Card>
            </BentoCell>
            <BentoCell rowSpan={2}>
              <Card title="Cashback" className="h-full">
                <Metric label="Earned" value="$1,154.00" size="sm" className="mt-2" />
              </Card>
            </BentoCell>
            <BentoCell>
              <Card title="Subscriptions" className="h-full">
                <Text size="caption" tone="faint" className="mt-2">
                  5 active
                </Text>
              </Card>
            </BentoCell>
            <BentoCell>
              <Card title="Bills" className="h-full">
                <Text size="caption" tone="faint" className="mt-2">
                  7 this month
                </Text>
              </Card>
            </BentoCell>
          </BentoGrid>
        ),
      },
    ],
    props: [
      { name: 'columns', type: '2 | 3 | 4', defaultValue: '3', description: 'Columns at the widest breakpoint.' },
      { name: 'BentoCell.colSpan / rowSpan', type: '1–4 / 1–2', description: 'Spans, applied from sm up.' },
    ],
  },

  'card-deck': {
    description:
      'A row of equal-height cards. Unlike BentoGrid every cell is the same size, which is what lets a band share one baseline and one footer line. The fixed height applies only from xl up — forcing a height on a narrow screen just clips things.',
    sections: [
      {
        title: 'Example',
        description: 'The card band is 306px tall at xl.',
        bare: true,
        Content: () => (
          <CardDeck columns={3} height={200} className="w-full">
            {['Balance', 'Subscriptions', 'Exchange'].map((title) => (
              <Card key={title} title={title}>
                <Text size="caption" tone="faint" className="mt-2">
                  Every card in the deck shares this height at xl.
                </Text>
                <Button size="sm" variant="outline" className="mt-auto self-start">
                  Open
                </Button>
              </Card>
            ))}
          </CardDeck>
        ),
      },
    ],
    props: [
      { name: 'columns', type: '2 | 3 | 4', defaultValue: '3', description: 'Cards per row from xl up.' },
      { name: 'height', type: 'number', description: 'Fixed row height, applied from xl up.' },
    ],
  },

  carousel: {
    description:
      'A scroll-snap track with chevron controls that becomes a plain grid at a chosen breakpoint — a card band exactly. The track scrolls natively, so it keeps momentum, trackpad gestures and keyboard scrolling; the chevrons are an addition, and they hide when there is nothing left to scroll.',
    sections: [
      {
        title: 'Example',
        description: 'Narrow the window below xl to see it become a scrolling band with controls.',
        bare: true,
        Content: CarouselExample,
      },
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name for the track.' },
      { name: 'gridFrom', type: "'md' | 'lg' | 'xl' | 'never'", defaultValue: "'xl'", description: 'Where it stops scrolling and becomes a grid.' },
      { name: 'columns', type: '2 | 3 | 4', defaultValue: '3', description: 'Columns once it is a grid.' },
      { name: 'itemMinWidth', type: 'number', defaultValue: '300', description: 'Minimum item width while scrolling.' },
    ],
  },

  'promo-banner': {
    description:
      'The hero strip: headline, supporting line, one affordance and an artwork slot. Artwork is a slot rather than a prop so the library carries no imagery of its own, and a gradient masks it behind the copy — which keeps the headline readable over any illustration without dimming the whole banner.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <PromoBanner
            className="w-full"
            title={
              <>
                Smart banking
                <br />
                makes life <PromoHighlight>different.</PromoHighlight>
              </>
            }
            description="Get your green credit card now and get $100 in cashback"
            action={<Button variant="white">Order Yours Now</Button>}
          />
        ),
        note: 'PromoHighlight marks the emphasised phrase. It uses box-decoration-clone, so the highlight wraps correctly across lines instead of leaving a ragged edge.',
      },
    ],
    props: [
      { name: 'title', type: 'ReactNode', description: 'Headline. Wrap the emphasised phrase in PromoHighlight.' },
      { name: 'description / action', type: 'ReactNode', description: 'Supporting line and the affordance.' },
      { name: 'art / aside', type: 'ReactNode', description: 'Artwork behind the copy; figure beside the action.' },
      { name: 'height', type: 'number', defaultValue: '160', description: 'Height from sm up.' },
    ],
  },
}
