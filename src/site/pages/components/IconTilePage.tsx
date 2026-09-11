import { useState } from 'react'
import {
  CreditCard,
  Droplet,
  Gamepad2,
  GraduationCap,
  Music,
  Smartphone,
  Zap,
} from 'lucide-react'
import { IconTile, Surface, Text, type IconTileSize, type IconTileTone } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl } from '../../components/Playground'

const TONES: IconTileTone[] = ['muted', 'accent']
const SIZES: IconTileSize[] = ['sm', 'md', 'lg']
const ICONS = { Music, Gamepad2, Droplet, Zap, GraduationCap, Smartphone, CreditCard }
type IconName = keyof typeof ICONS

export default function IconTilePage() {
  const [tone, setTone] = useState<IconTileTone>('muted')
  const [size, setSize] = useState<IconTileSize>('md')
  const [icon, setIcon] = useState<IconName>('Music')

  return (
    <DocPage
      name="IconTile"
      description="A rounded plate carrying one glyph, used to identify a row or a tile at a glance. It is decoration, not a control: the row's own text carries the meaning, so the tile is hidden from assistive tech entirely."
      propNotes={[
            {
              name: 'icon',
              type: 'IconComponent',
              description:
                'Any component accepting size and strokeWidth. lucide-react icons match structurally.',
            },
            {
              name: 'tone',
              type: "'muted' | 'accent'",
              defaultValue: "'muted'",
              description: 'Resting, or highlighted.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: '28 · 36 · 44px.',
            },
          ]}
      apiNote={
        <>
          There is no <Code>label</Code> prop by design. The tile is always{' '}
          <Code>aria-hidden</Code>; if a glyph is the only thing conveying meaning, it should be an{' '}
          <Code>IconButton</Code> or sit beside real text.
        </>
      }
    >
      <Section title="Default">
        <Preview>
          <IconTile icon={Music} />
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="Two. Muted is the resting state; accent marks the one row in a list that needs attention — in the design, the subscription due next."
      >
        <Preview>
          {TONES.map((value) => (
            <Specimen
              key={value}
              label={value}
              hint={value === 'accent' ? 'The highlighted row' : 'Every other row'}
            >
              <IconTile icon={Music} tone={value} />
            </Specimen>
          ))}
        </Preview>
        <Note>
          There is no status colouring here. A red or amber tile would compete with the amount on
          the right, which is where the design puts urgency.
        </Note>
      </Section>

      <Section title="Sizes" description="28 · 36 · 44px. The glyph is always half the plate.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={`${{ sm: 28, md: 36, lg: 44 }[value]}px`}>
              <IconTile icon={Gamepad2} size={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="IconTile is static. To make one interactive, use IconButton — it is the same plate with a button's semantics, focus ring and required label."
      >
        <Preview>
          <Specimen label="muted">
            <IconTile icon={Zap} />
          </Specimen>
          <Specimen label="accent">
            <IconTile icon={Zap} tone="accent" />
          </Specimen>
        </Preview>
      </Section>

      <Section title="Examples" description="Leading slot on a subscriptions list.">
        <Surface variant="card" padding="lg" className="gap-1">
          <Text size="heading" className="mb-2">
            Subscriptions
          </Text>
          <ul className="flex flex-col">
            {[
              { name: 'Apple Music', icon: Music, price: '$8,99', due: 'Tomorrow', hot: false },
              { name: 'Smart Home Security', icon: Zap, price: '$79,99', due: 'Tomorrow', hot: true },
              { name: 'GumZone', icon: Gamepad2, price: '$35,00', due: 'In 4 days', hot: false },
              { name: 'Water Bill', icon: Droplet, price: '$24,50', due: 'In 5 days', hot: false },
            ].map((row) => (
              <li
                key={row.name}
                className={`flex items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2.5 ${
                  row.hot ? 'bg-surface-muted' : ''
                }`}
              >
                <IconTile icon={row.icon} tone={row.hot ? 'accent' : 'muted'} />
                <div className="min-w-0 flex-1">
                  <Text truncate>{row.name}</Text>
                  <Text size="caption" tone="faint" truncate>
                    Monthly Plan
                  </Text>
                </div>
                <div className="text-right">
                  <Text tabular>{row.price}</Text>
                  <Text size="caption" tone="faint">
                    {row.due}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      </Section>

      <Section title="Playground">
        <Playground
          stage={<IconTile icon={ICONS[icon]} tone={tone} size={size} />}
          controls={
            <>
              <SelectControl
                label="icon"
                value={icon}
                options={Object.keys(ICONS) as IconName[]}
                onChange={setIcon}
              />
              <SelectControl label="tone" value={tone} options={TONES} onChange={setTone} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
