import { Gamepad2, Music, Zap } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  IconTile,
  List,
  ListItem,
  Meter,
  Text,
} from 'klyvui'
import type { ExampleModule } from './types'

const ROWS = [
  { id: 'apple', name: 'Apple Music', icon: Music, price: '$8,99', due: 'Tomorrow' },
  { id: 'home', name: 'Smart Home Security', icon: Zap, price: '$79,99', due: 'Tomorrow' },
  { id: 'gum', name: 'GumZone', icon: Gamepad2, price: '$35,00', due: 'In 4 days' },
  { id: 'water', name: 'Water Bill', icon: Zap, price: '$24,50', due: 'In 5 days' },
  { id: 'power', name: 'Electricity', icon: Zap, price: '$63,69', due: 'In 8 days' },
]

function CardExample() {
  return (
    <div className="grid w-full gap-3 md:grid-cols-2">
      <Card title="Subscriptions" action={<Button variant="ghost" size="sm">View All</Button>}>
        <List className="mt-2">
          {ROWS.slice(0, 3).map((row) => (
            <ListItem
              key={row.id}
              leading={<IconTile icon={row.icon} />}
              title={row.name}
              subtitle="Monthly Plan"
              value={row.price}
              meta={row.due}
            />
          ))}
        </List>
      </Card>
      <Card title="Education">
        <CardBody className="gap-2 pt-2">
          <Text size="caption" tone="faint">
            2 days left
          </Text>
          <Text size="stat" tabular>
            $160 <Text as="span" size="caption" tone="faint">/month</Text>
          </Text>
          <Meter value={3} total={6} label="Education instalments paid" className="mt-1" />
        </CardBody>
        <CardFooter>
          <Button size="sm" variant="outline">Pay early</Button>
          <Button size="sm" variant="ghost">Details</Button>
        </CardFooter>
      </Card>
    </div>
  )
}


export const demos: ExampleModule = {
  card: {
    description:
      'The header shape all six dashboard cards share: a bold title on the left, a quiet action on the right, over a card Surface. CardHeader, CardBody and CardFooter are exported separately for cards that need custom layout between them — CardBody is the part that grows, so footers stay pinned to the bottom of an equal-height row.',
    sections: [
      {
        title: 'Default',
        specimens: [
          {
            label: 'title + action',
            node: (
              <Card
                title="Subscriptions"
                action={<Button variant="ghost" size="sm">View All</Button>}
                className="w-[300px]"
              >
                <Text size="caption" tone="faint" className="mt-2">
                  Card content sits under the header.
                </Text>
              </Card>
            ),
          },
        ],
      },
      {
        title: 'Composition',
        description:
          'A card with no title is just a Surface. Headings default to h2 — set headingLevel when the card sits under another heading.',
        stack: true,
        specimens: [
          {
            label: 'headless',
            hint: 'No title or action',
            fill: true,
            node: (
              <Card className="w-full max-w-[300px]">
                <Text>Content only</Text>
              </Card>
            ),
          },
          {
            label: 'padded={false}',
            hint: 'For cards whose children own the padding',
            fill: true,
            node: (
              <Card padded={false} className="w-full max-w-[300px]">
                <div className="border-b border-line px-4 py-3">
                  <Text size="heading">Flush header</Text>
                </div>
                <div className="px-4 py-3">
                  <Text size="caption" tone="faint">
                    Rows can run edge to edge.
                  </Text>
                </div>
              </Card>
            ),
          },
        ],
      },
      {
        title: 'Examples',
        description: 'The two card shapes the design actually uses.',
        bare: true,
        Content: CardExample,
      },
    ],
    props: [
      { name: 'title', type: 'string', description: 'Header title. Omit for a card with no header.' },
      { name: 'action', type: 'ReactNode', description: 'Right-aligned affordance in the header.' },
      { name: 'headingLevel', type: "'h2' | 'h3' | 'h4'", defaultValue: "'h2'", description: 'Semantics only; the visual size never changes.' },
      { name: 'padded', type: 'boolean', defaultValue: 'true', description: 'Applies the 20px card padding.' },
    ],
  },




}
