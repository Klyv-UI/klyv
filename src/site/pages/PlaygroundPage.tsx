import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Gamepad2, Music, Send, Zap } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Divider,
  IconButton,
  IconTile,
  Input,
  Meter,
  Spinner,
  StatusDot,
  Surface,
  Text,
  type ButtonVariant,
  type SurfaceVariant,
} from 'klyv'
import { Note, Section } from '../components/Doc'
import { PageIntro } from '../components/PageIntro'
import { NumberControl, Playground, SelectControl, TextControl, ToggleControl } from '../components/Playground'

const SURFACES: SurfaceVariant[] = ['card', 'tile', 'field', 'sunken', 'floating']
const BUTTONS: ButtonVariant[] = ['accent', 'muted', 'outline', 'white', 'ghost']

/**
 * A composition sandbox: rather than a second copy of each component's own
 * playground, this assembles several primitives into one card so their sizes,
 * inks and radii can be checked against each other.
 */
export default function PlaygroundPage() {
  const [surface, setSurface] = useState<SurfaceVariant>('card')
  const [action, setAction] = useState<ButtonVariant>('outline')
  const [title, setTitle] = useState('Subscriptions')
  const [rows, setRows] = useState(3)
  const [paid, setPaid] = useState(3)
  const [highlightFirst, setHighlightFirst] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showMeter, setShowMeter] = useState(true)
  const [query, setQuery] = useState('')

  const items = [
    { name: 'Apple Music', icon: Music, price: '$8,99', due: 'Tomorrow' },
    { name: 'Smart Home Security', icon: Zap, price: '$79,99', due: 'Tomorrow' },
    { name: 'GumZone', icon: Gamepad2, price: '$35,00', due: 'In 4 days' },
    { name: 'Water Bill', icon: Send, price: '$24,50', due: 'In 5 days' },
    { name: 'Electricity', icon: Zap, price: '$63,69', due: 'In 8 days' },
  ]
    .slice(0, rows)
    .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-12">
      <PageIntro
        eyebrow="Build"
        title="Playground"
        actions={
          <Button as={Link} to="/composer" size="sm" variant="outline">
            Build a whole screen in the Composer
          </Button>
        }
      >
        Every component has its own examples on its page. This one is for composition — it assembles nine primitives
        into a single card so their sizes, inks and radii can be checked against each other, which is where a scale
        usually breaks first.
      </PageIntro>

      <Section title="Composed card">
        <Playground
          background="app"
          stage={
            <Surface variant={surface} padding="lg" className="w-full max-w-[360px] gap-3">
              <div className="flex items-center justify-between gap-3">
                <Text size="heading" truncate>
                  {title || 'Untitled'}
                </Text>
                <Button variant={action} size="sm" loading={busy} onClick={() => setBusy(true)}>
                  View All
                </Button>
              </div>

              <Input
                inputSize="sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter rows"
                aria-label="Filter rows"
              />

              <ul className="flex flex-col">
                {items.map((item, index) => (
                  <li
                    key={item.name}
                    className={`flex items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2.5 ${
                      highlightFirst && index === 0 ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <IconTile
                      icon={item.icon}
                      tone={highlightFirst && index === 0 ? 'accent' : 'muted'}
                    />
                    <div className="min-w-0 flex-1">
                      <Text truncate>{item.name}</Text>
                      <Text size="caption" tone="faint" truncate>
                        Monthly Plan
                      </Text>
                    </div>
                    <div className="shrink-0 text-right">
                      <Text tabular>{item.price}</Text>
                      <Text size="caption" tone="faint">
                        {item.due}
                      </Text>
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="px-2.5 py-6 text-center">
                    <Text size="caption" tone="faint">
                      Nothing matches “{query}”.
                    </Text>
                  </li>
                )}
              </ul>

              {showMeter && (
                <>
                  <Divider />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar name="Daniel Vance" size="xs" />
                      <Text size="caption" weight="semibold" tone="soft">
                        {paid} of 6 paid
                      </Text>
                      <StatusDot tone={paid === 6 ? 'success' : 'accent'} />
                    </div>
                    <Badge tone={paid === 6 ? 'neutral' : 'accent'}>
                      {paid === 6 ? 'Done' : `${6 - paid} left`}
                    </Badge>
                  </div>
                  <Meter value={paid} total={6} label="Instalments paid" />
                </>
              )}

              {busy && (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" className="text-ink-faint" />
                  <Text size="caption" tone="faint">
                    Loading — toggle “loading” off to stop.
                  </Text>
                </div>
              )}
            </Surface>
          }
          controls={
            <>
              <SelectControl
                label="Surface variant"
                value={surface}
                options={SURFACES}
                onChange={setSurface}
              />
              <SelectControl
                label="Button variant"
                value={action}
                options={BUTTONS}
                onChange={setAction}
              />
              <TextControl label="title" value={title} onChange={setTitle} />
              <NumberControl label="rows" value={rows} min={0} max={5} onChange={setRows} />
              <NumberControl label="paid" value={paid} min={0} max={6} onChange={setPaid} />
              <ToggleControl
                label="highlight first"
                checked={highlightFirst}
                onChange={setHighlightFirst}
              />
              <ToggleControl label="show meter" checked={showMeter} onChange={setShowMeter} />
              <ToggleControl label="loading" checked={busy} onChange={setBusy} />
            </>
          }
        />
        <Note>
          Nothing here is a new component — it is Surface, Text, Button, Input, IconTile, Avatar,
          StatusDot, Badge, Meter, Spinner and Divider composed by hand. When this shape is
          extracted, it becomes the <Link to="/components/card" className="font-bold underline underline-offset-2">Card</Link>{' '}
          and <span className="font-bold">ListRow</span>.
        </Note>
      </Section>

      <Section
        title="Density check"
        description="The three control heights side by side. They should share a baseline and agree on radius."
      >
        <Surface variant="card" padding="lg" className="flex-row flex-wrap items-center gap-3">
          <Button size="sm" variant="outline">
            Small
          </Button>
          <Button>Medium</Button>
          <Input inputSize="sm" placeholder="sm field" aria-label="Small field" className="w-[140px]" />
          <Input placeholder="md field" aria-label="Medium field" className="w-[140px]" />
          <IconButton icon={Bell} label="Notifications" size="sm" tone="muted" />
          <IconButton icon={Bell} label="Notifications" tone="muted" />
          <Avatar name="Daniel Vance" size="sm" />
          <Avatar name="Daniel Vance" size="md" />
          <IconTile icon={Music} size="sm" />
          <IconTile icon={Music} />
        </Surface>
      </Section>
    </div>
  )
}
