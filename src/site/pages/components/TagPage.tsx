import { useState } from 'react'
import { Badge, Chip, Surface, Tag, Text } from 'klyvui'
import { DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl } from '../../components/Playground'

const TONES = ['neutral', 'outline', 'accent'] as const
const SIZES = ['sm', 'md'] as const

export default function TagPage() {
  const [tone, setTone] = useState<(typeof TONES)[number]>('neutral')
  const [size, setSize] = useState<(typeof SIZES)[number]>('md')
  const [label, setLabel] = useState('Subscriptions')

  return (
    <DocPage
      name="Tag"
      description="A static label that classifies something — a category, a plan, a status word. It is non-interactive by definition: the moment it can be selected or removed it becomes a Chip, and the moment it is a small qualifier pinned to another element it becomes a Badge."
      propNotes={[
            { name: 'children', type: 'ReactNode', description: 'The label. Kept to one or two words.' },
            {
              name: 'tone',
              type: "'neutral' | 'outline' | 'accent'",
              defaultValue: "'neutral'",
              description: 'Emphasis and contrast against the surface behind it.',
            },
            {
              name: 'size',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: '20px or 24px tall.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Tag>Subscriptions</Tag>
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="Neutral is the default. Outline is for a tag on an already-filled surface; accent is for the one category worth noticing."
      >
        <Preview>
          {TONES.map((value) => (
            <Specimen key={value} label={value}>
              <Tag tone={value}>Monthly Plan</Tag>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section title="Sizes" description="20px and 24px. Both sit on the micro and caption type steps.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? 'h-5 · 10px' : 'h-6 · 11px'}>
              <Tag size={value}>Monthly Plan</Tag>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Tag has no interactive states — no hover, no focus, no disabled. If you find yourself wanting one, the component you need is Chip."
      >
        <Preview background="app">
          <Specimen label="on surface">
            <Surface variant="tile" padding="sm" className="bg-surface">
              <Tag>Bills</Tag>
            </Surface>
          </Specimen>
          <Specimen label="on app">
            <Tag>Bills</Tag>
          </Specimen>
          <Specimen label="outline on filled">
            <Surface variant="field" padding="sm">
              <Tag tone="outline">Bills</Tag>
            </Surface>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Tag, Chip or Badge?"
        description="Three pill-shaped components with three different jobs. Picking the wrong one is the most common mistake in this part of the library."
      >
        <Preview stack>
          <Specimen label="Tag" hint="Static classification. Not focusable." fill>
            <Tag>Subscriptions</Tag>
          </Specimen>
          <Specimen label="Chip" hint="Selectable or removable. A real control." fill>
            <Chip label="Subscriptions" selected />
          </Specimen>
          <Specimen label="Badge" hint="A qualifier pinned to something else." fill>
            <span className="inline-flex items-center gap-2">
              <Text as="span" size="body">
                Mcdonalds
              </Text>
              <Badge>+10%</Badge>
            </span>
          </Specimen>
        </Preview>
        <Note>
          Rule of thumb: if it can be clicked it is a Chip; if it belongs to a neighbouring element
          rather than standing alone it is a Badge; otherwise it is a Tag.
        </Note>
      </Section>

      <Section title="Examples" description="Categorising a transaction row.">
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[360px] gap-3">
            {[
              { name: 'Apple Music', tag: 'Entertainment', tone: 'neutral' as const },
              { name: 'Water Bill', tag: 'Utilities', tone: 'neutral' as const },
              { name: 'Smart Home Security', tag: 'Due tomorrow', tone: 'accent' as const },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3">
                <Text truncate>{row.name}</Text>
                <Tag tone={row.tone} size="sm">
                  {row.tag}
                </Tag>
              </div>
            ))}
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <Tag tone={tone} size={size}>
              {label || 'Tag'}
            </Tag>
          }
          controls={
            <>
              <SelectControl label="tone" value={tone} options={TONES} onChange={setTone} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <TextControl label="children" value={label} onChange={setLabel} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
