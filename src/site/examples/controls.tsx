import { useState } from 'react'
import { Bell, Grid3x3, Info, List as ListIcon, Rows3, Search, Table2 } from 'lucide-react'
import {
  BackButton,
  Button,
  ButtonGroup,
  Card,
  IconButton,
  SegmentedControl,
  StatusDot,
  Text,
  Toolbar,
} from 'klyv'
import type { ExampleModule } from './types'

function SegmentedExample() {
  const [view, setView] = useState('overview')
  const [density, setDensity] = useState('comfortable')
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          Horizontal — a primary nav track
        </Text>
        <SegmentedControl
          label="Section"
          value={view}
          onValueChange={setView}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity' },
            { value: 'manage', label: 'Manage' },
            { value: 'reports', label: 'Reports', disabled: true },
          ]}
        />
        <Text size="caption" tone="faint">
          Focus a pill and use the arrow keys. Only the selected one is a tab stop.
        </Text>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          With icons, bare, full width
        </Text>
        <SegmentedControl
          label="Density"
          value={density}
          onValueChange={setDensity}
          fullWidth
          className="w-full max-w-[360px]"
          options={[
            { value: 'compact', label: 'Compact', icon: Rows3 },
            { value: 'comfortable', label: 'Comfortable', icon: ListIcon },
            { value: 'grid', label: 'Grid', icon: Grid3x3 },
          ]}
        />
      </div>
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          Vertical — the mobile drawer form
        </Text>
        <SegmentedControl
          label="Section, stacked"
          orientation="vertical"
          value={view}
          onValueChange={setView}
          className="w-[220px]"
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity' },
            { value: 'manage', label: 'Manage' },
          ]}
        />
      </div>
    </div>
  )
}

function ToolbarExample() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          The header cluster
        </Text>
        <Toolbar label="Utilities">
          <IconButton icon={Search} label="Search" size="sm" className="text-ink" />
          <span className="relative inline-flex">
            <IconButton icon={Bell} label="Notifications" size="sm" className="text-ink" />
            <StatusDot ring className="pointer-events-none absolute right-2 top-2" />
          </span>
          <IconButton icon={Info} label="Help" size="sm" className="text-ink" />
        </Toolbar>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          Vertical, bare
        </Text>
        <Toolbar label="View options" orientation="vertical" variant="bare">
          <IconButton icon={ListIcon} label="List view" tone="plain" shape="square" selected />
          <IconButton icon={Grid3x3} label="Grid view" tone="plain" shape="square" />
          <IconButton icon={Table2} label="Table view" tone="plain" shape="square" />
        </Toolbar>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'button-group': {
    description:
      'Groups related buttons into one visual unit. It supplies the container only — each child stays a real Button, so it keeps its own focus ring and semantics. For a set where exactly one option is chosen, reach for SegmentedControl instead: this has no selection model.',
    sections: [
      {
        title: 'Variants',
        stack: true,
        specimens: [
          {
            label: 'track',
            hint: 'The lifted white rail',
            fill: true,
            node: (
              <ButtonGroup label="Period">
                <Button variant="ghost" size="sm">Day</Button>
                <Button variant="ghost" size="sm">Week</Button>
                <Button size="sm">Month</Button>
              </ButtonGroup>
            ),
          },
          {
            label: 'attached',
            hint: 'One outlined unit with shared borders',
            fill: true,
            node: (
              <ButtonGroup variant="attached" label="Export format">
                <Button variant="outline" size="sm">CSV</Button>
                <Button variant="outline" size="sm">PDF</Button>
                <Button variant="outline" size="sm">JSON</Button>
              </ButtonGroup>
            ),
          },
          {
            label: 'with icon buttons',
            fill: true,
            node: (
              <ButtonGroup label="View">
                <IconButton icon={ListIcon} label="List view" size="sm" />
                <IconButton icon={Grid3x3} label="Grid view" size="sm" />
                <IconButton icon={Table2} label="Table view" size="sm" />
              </ButtonGroup>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'variant', type: "'track' | 'attached'", defaultValue: "'track'", description: 'Lifted rail, or one joined outlined unit.' },
      { name: 'label', type: 'string', description: 'Accessible name for the group.' },
    ],
  },

  'segmented-control': {
    description:
      'Single-select from a small set — the primary nav pill track. Implemented as a radiogroup with roving focus, so arrow keys move between options and only the selected one is a tab stop. That is what stops a six-item nav costing six tabs to pass.',
    sections: [
      { title: 'Orientation and density', bare: true, Content: SegmentedExample },
      {
        title: 'Sizes',
        specimens: [
          {
            label: 'sm',
            node: (
              <SegmentedControl
                label="Size small"
                size="sm"
                value="a"
                onValueChange={() => undefined}
                options={[
                  { value: 'a', label: 'One' },
                  { value: 'b', label: 'Two' },
                ]}
              />
            ),
          },
          {
            label: 'md',
            node: (
              <SegmentedControl
                label="Size medium"
                value="a"
                onValueChange={() => undefined}
                options={[
                  { value: 'a', label: 'One' },
                  { value: 'b', label: 'Two' },
                ]}
              />
            ),
          },
          {
            label: 'bare',
            hint: 'No track, for use inside a filled surface',
            node: (
              <SegmentedControl
                label="Bare"
                bare
                value="a"
                onValueChange={() => undefined}
                options={[
                  { value: 'a', label: 'One' },
                  { value: 'b', label: 'Two' },
                ]}
              />
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'options / value / onValueChange', type: 'SegmentedOption[] / string / fn', description: 'Choices and selection.' },
      { name: 'label', type: 'string', description: 'Accessible name for the radiogroup.' },
      { name: 'orientation', type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'", description: 'Vertical is the drawer form.' },
      { name: 'bare / fullWidth', type: 'boolean', description: 'Drop the track; stretch to the container.' },
    ],
  },

  toolbar: {
    description:
      'A cluster of icon controls on one track — the header utility group. Arrow keys move between the controls and the cluster is a single tab stop, which is what stops a row of six icons costing six tabs to pass.',
    sections: [
      { title: 'Example', description: 'Tab into a cluster, then use the arrow keys.', bare: true, Content: ToolbarExample },
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name. Required — a toolbar without one is unnavigable.' },
      { name: 'variant', type: "'track' | 'bare'", defaultValue: "'track'", description: 'Lifted rail, or no chrome.' },
      { name: 'orientation', type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'", description: 'Also sets which arrows move focus.' },
    ],
  },

  'back-button': {
    description:
      'Chevron plus destination. It names where it goes rather than saying only "Back", because a lone chevron gives a screen reader nothing to announce — and "Back to Activity" is more useful than "Back" to everyone else too.',
    sections: [
      {
        title: 'Variants',
        specimens: [
          { label: 'default', node: <BackButton label="Back to Activity" /> },
          { label: 'short', node: <BackButton /> },
          { label: 'iconOnly', hint: 'Label is still announced', node: <BackButton label="Back to Activity" iconOnly /> },
          { label: 'as a link', node: <BackButton label="Back to Overview" href="#" /> },
        ],
      },
      {
        title: 'In a page header',
        bare: true,
        Content: () => (
          <Card className="w-full max-w-[420px] items-start gap-2">
            <BackButton label="Back to Activity" className="-ml-2" />
            <Text size="subtitle">Transfer to Sarah Rosewood</Text>
            <Text size="caption" tone="faint">
              Today, 4:28 PM
            </Text>
          </Card>
        ),
      },
    ],
    props: [
      { name: 'label', type: 'string', defaultValue: "'Back'", description: 'Name the destination.' },
      { name: 'onClick / href', type: '() => void / string', description: 'Button, or link.' },
      { name: 'iconOnly', type: 'boolean', defaultValue: 'false', description: 'Hide the label visually only.' },
    ],
  },
}
