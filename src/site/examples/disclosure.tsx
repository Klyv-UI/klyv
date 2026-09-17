import { useState } from 'react'
import {
  Accordion,
  Badge,
  Button,
  Card,
  Collapse,
  Collapsible,
  DescriptionList,
  Surface,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

function CollapseExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full max-w-[380px] flex-col items-start gap-3">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls="collapse-demo"
      >
        {open ? 'Hide the breakdown' : 'Show the breakdown'}
      </Button>
      <Collapse open={open} id="collapse-demo" className="w-full">
        <Surface variant="sunken" padding="md" className="w-full">
          <DescriptionList
            items={[
              { term: 'Amount', description: '$500.00' },
              { term: 'Rate', description: '1 USD = 0,73 GBP' },
              { term: 'Bank network fee', description: '$2,48 USD' },
              { term: 'Recipient gets', description: '£369.41' },
            ]}
          />
        </Surface>
      </Collapse>
      <Text size="caption" tone="faint" leading="normal">
        The panel is measured, not fixed — it releases back to auto once open, so content that grows
        later is not trapped at the measured height. While closed it is hidden, keeping its controls
        out of the tab order.
      </Text>
    </div>
  )
}

function CollapsibleExample() {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      <Card padded={false} className="w-full">
        <Collapsible
          title="Transfer breakdown"
          meta={<Badge tone="neutral">4 lines</Badge>}
          open={open}
          onOpenChange={setOpen}
          className="p-2"
        >
          <DescriptionList
            divided
            items={[
              { term: 'Amount', description: '$500.00' },
              { term: 'Rate', description: '1 USD = 0,73 GBP' },
              { term: 'Bank network fee', description: '$2,48 USD' },
              { term: 'Recipient gets', description: '£369.41' },
            ]}
          />
        </Collapsible>
      </Card>
      <Text size="caption" tone="faint">
        Controlled above. Uncontrolled with defaultOpen works too.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  collapse: {
    description:
      'Animates between zero and content height. It measures the content rather than taking a fixed height, and releases back to auto once open — so a section whose content grows later is not trapped. This is the mechanism only: it has no trigger, because the thing that opens a panel is usually a button you have already styled.',
    sections: [
      { title: 'Example', bare: true, Content: CollapseExample },
      {
        title: 'Always open',
        description: 'With open fixed to true it is a plain container — useful when the same markup is animated in one place and static in another.',
        specimens: [
          {
            label: 'open',
            fill: true,
            node: (
              <Collapse open className="w-full max-w-[320px]">
                <Surface variant="sunken" padding="md">
                  <Text size="caption" tone="soft">
                    Always visible.
                  </Text>
                </Surface>
              </Collapse>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'open', type: 'boolean', description: 'Whether the panel is expanded.' },
      { name: 'duration', type: 'number', defaultValue: '220', description: 'Transition length in milliseconds.' },
      { name: 'id', type: 'string', description: 'Point a trigger at this with aria-controls.' },
    ],
  },

  collapsible: {
    description:
      'A disclosure: one trigger, one panel. The trigger owns aria-expanded and aria-controls, so the relationship between the two is announced rather than merely implied by their position. Works controlled or uncontrolled.',
    sections: [
      { title: 'Example', bare: true, Content: CollapsibleExample },
      {
        title: 'States',
        stack: true,
        specimens: [
          {
            label: 'closed by default',
            fill: true,
            node: (
              <Surface variant="card" padding="sm" className="w-full max-w-[380px]">
                <Collapsible title="What is the bank network fee?">
                  <Text size="caption" tone="soft" leading="normal">
                    A flat charge from the receiving bank. It is shown before you confirm and never
                    changes after.
                  </Text>
                </Collapsible>
              </Surface>
            ),
          },
          {
            label: 'defaultOpen',
            fill: true,
            node: (
              <Surface variant="card" padding="sm" className="w-full max-w-[380px]">
                <Collapsible title="How long does a transfer take?" defaultOpen>
                  <Text size="caption" tone="soft" leading="normal">
                    Standard transfers arrive in three working days. Express arrives the next day.
                  </Text>
                </Collapsible>
              </Surface>
            ),
          },
          {
            label: 'disabled',
            fill: true,
            node: (
              <Surface variant="card" padding="sm" className="w-full max-w-[380px]">
                <Collapsible title="Unavailable for this account" disabled>
                  <Text size="caption">Never shown.</Text>
                </Collapsible>
              </Surface>
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'title', type: 'string', description: 'Trigger text.' },
      { name: 'defaultOpen', type: 'boolean', defaultValue: 'false', description: 'Uncontrolled starting state.' },
      { name: 'open / onOpenChange', type: 'boolean / fn', description: 'Controlled state.' },
      { name: 'meta', type: 'ReactNode', description: 'Quiet content on the right of the trigger.' },
    ],
  },

  accordion: {
    description:
      'A set of disclosures with an open policy. Single is the accordion proper — opening one closes the rest; multiple is a plain stack of Collapsibles that happens to share a container. It composes Collapsible rather than reimplementing disclosure, so the keyboard and ARIA behaviour is identical.',
    sections: [
      {
        title: 'Modes',
        stack: true,
        specimens: [
          {
            label: 'single',
            hint: 'Opening one closes the others',
            fill: true,
            node: (
              <Surface variant="card" padding="sm" className="w-full max-w-[440px]">
                <Accordion
                  defaultOpen={['fees']}
                  items={[
                    { id: 'fees', title: 'What fees apply?', content: <Text size="caption" tone="soft" leading="normal">A flat bank network fee, shown before you confirm.</Text> },
                    { id: 'speed', title: 'How fast is a transfer?', content: <Text size="caption" tone="soft" leading="normal">Three working days as standard, or next day with Express.</Text> },
                    { id: 'limits', title: 'Are there limits?', content: <Text size="caption" tone="soft" leading="normal">$25,000 per day across all recipients.</Text> },
                  ]}
                />
              </Surface>
            ),
          },
          {
            label: 'multiple',
            hint: 'Each opens and closes independently',
            fill: true,
            node: (
              <Surface variant="card" padding="sm" className="w-full max-w-[440px]">
                <Accordion
                  mode="multiple"
                  defaultOpen={['a', 'b']}
                  items={[
                    { id: 'a', title: 'Subscriptions', meta: <Badge tone="neutral">5</Badge>, content: <Text size="caption" tone="soft">Apple Music, GumZone, Water Bill and two more.</Text> },
                    { id: 'b', title: 'Bills', meta: <Badge tone="neutral">7</Badge>, content: <Text size="caption" tone="soft">Electricity, broadband, council tax and four more.</Text> },
                    { id: 'c', title: 'Transfers', meta: <Badge tone="neutral">12</Badge>, content: <Text size="caption" tone="soft">Twelve transfers this month.</Text> },
                  ]}
                />
              </Surface>
            ),
          },
        ],
        note: 'Use single when the panels are alternatives and only one matters at a time. Use multiple when the reader might want to compare two — forcing one closed to open another is a common frustration.',
      },
    ],
    props: [
      { name: 'items', type: '{ id, title, content, meta?, disabled? }[]', description: 'The disclosures.' },
      { name: 'mode', type: "'single' | 'multiple'", defaultValue: "'single'", description: 'Open policy.' },
      { name: 'defaultOpen', type: 'string[]', description: 'Ids open on first render.' },
      { name: 'divided', type: 'boolean', defaultValue: 'true', description: 'Hairline between items.' },
    ],
  },
}
