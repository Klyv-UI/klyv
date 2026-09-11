import { useState } from 'react'
import { Bell, Copy, Download, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DropdownMenu,
  HoverCard,
  IconButton,
  Menu,
  Metric,
  Popover,
  Sparkline,
  Text,
  Tooltip,
} from 'citrine'
import type { ExampleModule } from './types'

const ACTIONS = [
  { id: 'edit', label: 'Edit details', icon: Pencil, onSelect: () => undefined },
  { id: 'copy', label: 'Duplicate', icon: Copy, meta: '⌘D', onSelect: () => undefined },
  { id: 'export', label: 'Export', icon: Download, onSelect: () => undefined },
  'separator' as const,
  { id: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: () => undefined },
]

function PopoverExample() {
  const [placement, setPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
  return (
    <div className="flex w-full flex-col items-center gap-6 py-8">
      <div className="flex flex-wrap justify-center gap-2">
        {(['top', 'bottom', 'left', 'right'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={placement === option ? 'accent' : 'outline'}
            onClick={() => setPlacement(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <Popover
        placement={placement}
        align="center"
        label="Account details"
        trigger={<Button variant="outline">Open the panel</Button>}
      >
        <div className="w-[240px] p-3">
          <Text size="heading">Account details</Text>
          <Text size="caption" tone="faint" leading="normal" className="mt-1">
            Panels flip to the opposite side when there is not enough room, then clamp inside the
            viewport. Scroll the page with this open to watch it follow.
          </Text>
        </div>
      </Popover>
      <Text size="caption" tone="faint">
        Escape or a click outside closes it.
      </Text>
    </div>
  )
}

function MenuExample() {
  const [last, setLast] = useState('none')
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Menu
          label="Row actions"
          trigger={<IconButton icon={MoreVertical} label="Open row actions" tone="muted" />}
          items={ACTIONS.map((item) =>
            item === 'separator' ? item : { ...item, onSelect: () => setLast(item.label) },
          )}
        />
        <DropdownMenu
          label="Actions"
          items={ACTIONS.map((item) =>
            item === 'separator' ? item : { ...item, onSelect: () => setLast(item.label) },
          )}
        />
      </div>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Last chosen: {last}
      </Text>
    </div>
  )
}

function HoverCardExample() {
  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      <Text size="caption" tone="faint">
        Paid to
      </Text>
      <HoverCard
        label="Sarah Rosewood"
        content={
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name="Sarah Rosewood" size="md" />
              <div className="min-w-0">
                <Text truncate>Sarah Rosewood</Text>
                <Text size="caption" tone="faint">
                  Saved recipient
                </Text>
              </div>
            </div>
            <Metric label="Sent in 2026" value="$4,120.00" size="sm" />
            <Sparkline values={[3, 5, 4, 8, 6, 11, 9]} label="Transfers to Sarah" area />
            <Button size="sm" variant="outline">
              Send again
            </Button>
          </div>
        }
      >
        <button type="button" className="rounded-[6px] text-[13px] font-bold text-ink underline underline-offset-2">
          Sarah Rosewood
        </button>
      </HoverCard>
    </div>
  )
}

export const demos: ExampleModule = {
  popover: {
    description:
      'A floating panel anchored to a trigger, mounted through a Portal so no ancestor overflow can clip it. It owns open state, outside-click and Escape, plus flip-and-clamp positioning. Menu, Select, Tooltip and HoverCard all build on this rather than each reimplementing the same three behaviours.',
    sections: [
      {
        title: 'Placement',
        description:
          'Pick a side, then scroll the page while the panel is open — it repositions, and flips when the chosen side runs out of room.',
        bare: true,
        Content: PopoverExample,
        note: 'Positioning is a deliberate 90-line hook rather than a positioning library. It covers flip and clamp, which is everything this design system needs.',
      },
      {
        title: 'Alignment',
        specimens: [
          {
            label: 'align="start"',
            node: (
              <Popover align="start" label="Start" trigger={<Button size="sm" variant="outline">start</Button>}>
                <div className="w-[160px] p-3">
                  <Text size="caption">Aligned to the left edge.</Text>
                </div>
              </Popover>
            ),
          },
          {
            label: 'align="center"',
            node: (
              <Popover align="center" label="Center" trigger={<Button size="sm" variant="outline">center</Button>}>
                <div className="w-[160px] p-3">
                  <Text size="caption">Centred on the trigger.</Text>
                </div>
              </Popover>
            ),
          },
          {
            label: 'align="end"',
            node: (
              <Popover align="end" label="End" trigger={<Button size="sm" variant="outline">end</Button>}>
                <div className="w-[160px] p-3">
                  <Text size="caption">Aligned to the right edge.</Text>
                </div>
              </Popover>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'trigger', type: 'ReactNode', description: 'Rendered inline; clicking it toggles the panel.' },
      { name: 'open / onOpenChange', type: 'boolean / fn', description: 'Controlled state. Omit for uncontrolled.' },
      { name: 'placement / align', type: "'top'|'bottom'|'left'|'right' / 'start'|'center'|'end'", description: 'Preferred position; flips when it will not fit.' },
      { name: 'offset', type: 'number', defaultValue: '8', description: 'Gap between anchor and panel.' },
      { name: 'label', type: 'string', description: 'Accessible name for the panel.' },
    ],
  },

  menu: {
    description:
      'A list of actions in a Popover. It owns the menu keyboard model: arrows move, Home and End jump, Enter activates, and choosing an item closes the panel. Separators and destructive items are part of the item list rather than separate components.',
    sections: [
      {
        title: 'Example',
        description: 'Open either one and drive it with the keyboard. Focus lands on the first item.',
        bare: true,
        Content: MenuExample,
      },
      {
        title: 'Item states',
        specimens: [
          {
            label: 'selected and disabled',
            node: (
              <Menu
                label="View options"
                trigger={<Button size="sm" variant="outline">View</Button>}
                items={[
                  { id: 'list', label: 'List', selected: true },
                  { id: 'grid', label: 'Grid' },
                  { id: 'table', label: 'Table', disabled: true },
                  'separator',
                  { id: 'reset', label: 'Reset view', destructive: true },
                ]}
              />
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'items', type: "(MenuItem | 'separator')[]", description: 'id, label, icon, meta, selected, disabled, destructive, onSelect.' },
      { name: 'trigger', type: 'ReactNode', description: 'Anything clickable.' },
      { name: 'label', type: 'string', description: 'Accessible name for the menu.' },
    ],
  },

  'dropdown-menu': {
    description:
      'Menu with a labelled Button trigger — the common case, packaged so callers do not rewire aria-haspopup and aria-expanded every time. Use Menu directly when the trigger is an icon or something custom.',
    sections: [
      {
        title: 'Variants',
        specimens: [
          { label: 'outline', node: <DropdownMenu label="Actions" items={ACTIONS} /> },
          { label: 'accent', node: <DropdownMenu label="Actions" variant="accent" items={ACTIONS} /> },
          { label: 'ghost', node: <DropdownMenu label="Actions" variant="ghost" items={ACTIONS} /> },
          { label: 'sm', node: <DropdownMenu label="Actions" size="sm" items={ACTIONS} /> },
          { label: 'disabled', node: <DropdownMenu label="Actions" disabled items={ACTIONS} /> },
        ],
      },
    ],
    props: [
      { name: 'items / label', type: "(MenuItem | 'separator')[] / string", description: 'Menu contents and trigger text.' },
      { name: 'variant / size', type: 'ButtonVariant / ButtonSize', description: 'Trigger styling.' },
      { name: 'menuLabel', type: 'string', description: 'Accessible name for the panel; defaults to the trigger label.' },
    ],
  },

  tooltip: {
    description:
      'A short description on hover or focus. It is wired with aria-describedby rather than aria-label, so it supplements the control name instead of replacing it — a tooltip must never be the only label. It appears on keyboard focus as well as hover, and dismisses on Escape.',
    sections: [
      {
        title: 'Placement',
        specimens: [
          { label: 'top', node: <Tooltip content="Notifications" placement="top"><IconButton icon={Bell} label="Notifications" tone="muted" /></Tooltip> },
          { label: 'bottom', node: <Tooltip content="Notifications" placement="bottom"><IconButton icon={Bell} label="Notifications" tone="muted" /></Tooltip> },
          { label: 'left', node: <Tooltip content="Notifications" placement="left"><IconButton icon={Bell} label="Notifications" tone="muted" /></Tooltip> },
          { label: 'right', node: <Tooltip content="Notifications" placement="right"><IconButton icon={Bell} label="Notifications" tone="muted" /></Tooltip> },
        ],
        note: 'Tab into the row above: each tip appears on focus, not only on hover. That is the difference between a tooltip and a decoration.',
      },
      {
        title: 'Content and delay',
        specimens: [
          { label: 'delay={0}', node: <Tooltip content="Instant" delay={0}><Button size="sm" variant="outline">No delay</Button></Tooltip> },
          { label: 'delay={600}', node: <Tooltip content="Slower to appear" delay={600}><Button size="sm" variant="outline">Long delay</Button></Tooltip> },
          {
            label: 'longer text',
            node: (
              <Tooltip content="Rates are indicative and refresh every 60 seconds.">
                <Button size="sm" variant="outline">Why this rate?</Button>
              </Tooltip>
            ),
          },
          { label: 'disabled', node: <Tooltip content="Never shown" disabled><Button size="sm" variant="outline">No tip</Button></Tooltip> },
        ],
      },
    ],
    props: [
      { name: 'content', type: 'ReactNode', description: 'Tip text. Keep it to a short phrase.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', description: 'Preferred side.' },
      { name: 'delay', type: 'number', defaultValue: '250', description: 'Delay before showing. Hiding is immediate.' },
    ],
  },

  'hover-card': {
    description:
      'A rich preview on hover intent. Unlike Tooltip its content is interactive and can be pointed at, which is why it has a close delay — without one the card vanishes the moment the pointer leaves the trigger to reach it. Everything inside must also be reachable another way, since hover is not an interaction a keyboard or touch user has.',
    sections: [
      {
        title: 'Example',
        description: 'Hover the name, then move into the card — it stays open.',
        bare: true,
        Content: HoverCardExample,
        note: 'The card contains a button, so it must not be the only route to that action. Treat a HoverCard as an accelerator, never as the only path.',
      },
      {
        title: 'Composed from the library',
        bare: true,
        Content: () => (
          <Card className="w-full max-w-[420px] gap-2">
            <Text size="caption" weight="semibold" tone="faint">
              Built from
            </Text>
            <div className="flex flex-wrap gap-1.5">
              {['Surface', 'Portal', 'Avatar', 'Metric', 'Sparkline', 'Button'].map((name) => (
                <Badge key={name} tone="neutral">
                  {name}
                </Badge>
              ))}
            </div>
          </Card>
        ),
      },
    ],
    props: [
      { name: 'content', type: 'ReactNode', description: 'Card contents. Richer than a tooltip.' },
      { name: 'openDelay / closeDelay', type: 'number', defaultValue: '300 / 180', description: 'Hover intent, and the grace period for reaching the card.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', description: 'Preferred side.' },
    ],
  },
}
