import { useState } from 'react'
import { Badge, Surface, Text, type BadgeTone } from 'klyv'
import { DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl } from '../../components/Playground'

const TONES: BadgeTone[] = ['accent', 'neutral']

export default function BadgePage() {
  const [tone, setTone] = useState<BadgeTone>('accent')
  const [label, setLabel] = useState('+10%')

  return (
    <DocPage
      name="Badge"
      description="A compact pill for a short qualifier attached to something else — a cashback rate on a partner tile. It is not a status chip: the design never colour-codes badges by state, so there are only two tones."
      propNotes={[
            {
              name: 'children',
              type: 'ReactNode',
              description: 'The label. Keep it short — the badge does not wrap gracefully.',
            },
            {
              name: 'tone',
              type: "'accent' | 'neutral'",
              defaultValue: "'accent'",
              description: 'Emphasis.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Badge>+10%</Badge>
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="Accent for a value worth noticing, neutral for a category or a count."
      >
        <Preview>
          {TONES.map((value) => (
            <Specimen
              key={value}
              label={value}
              hint={value === 'accent' ? 'Cashback rates' : 'Categories, counts'}
            >
              <Badge tone={value}>{value === 'accent' ? '+10%' : 'Beta'}</Badge>
            </Specimen>
          ))}
        </Preview>
        <Note>
          Deliberately no success, warning or danger tone. The design signals those through the
          amount's colour and the row's own copy, not through a badge.
        </Note>
      </Section>

      <Section
        title="Content"
        description="One size, sitting on the micro type step. Keep it to a few characters — a badge that wraps is a Text, not a badge."
      >
        <Preview>
          {['+3%', '+10%', 'New', 'Beta', 'Data display'].map((value) => (
            <Specimen key={value} label={`"${value}"`}>
              <Badge tone={value.startsWith('+') ? 'accent' : 'neutral'}>{value}</Badge>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Badge is static and non-interactive — it has no hover, focus or disabled state. What changes is the tone and the surface it sits on."
      >
        <Preview background="app">
          <Specimen label="on surface">
            <Surface variant="tile" padding="sm" className="bg-surface">
              <Badge>+10%</Badge>
            </Surface>
          </Specimen>
          <Specimen label="on app">
            <Badge>+10%</Badge>
          </Specimen>
          <Specimen label="neutral on surface">
            <Surface variant="tile" padding="sm" className="bg-surface">
              <Badge tone="neutral">Monthly</Badge>
            </Surface>
          </Specimen>
        </Preview>
      </Section>

      <Section title="Examples" description="Top-right qualifier on a cashback partner tile.">
        <Preview>
          <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
            {[
              { name: 'Mcdonalds', offer: 'on first order', rate: '+10%', color: '#DA291C' },
              { name: 'Starbucks', offer: 'on all products', rate: '+3%', color: '#00704A' },
            ].map((partner) => (
              <Surface key={partner.name} variant="tile" padding="sm" interactive>
                <div className="flex items-start justify-between">
                  <span
                    aria-hidden="true"
                    className="size-[38px] rounded-full"
                    style={{ background: partner.color }}
                  />
                  <Badge>{partner.rate}</Badge>
                </div>
                <Text className="mt-2.5">{partner.name}</Text>
                <Text size="caption" tone="faint">
                  {partner.offer}
                </Text>
              </Surface>
            ))}
          </div>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={<Badge tone={tone}>{label || '—'}</Badge>}
          controls={
            <>
              <SelectControl label="tone" value={tone} options={TONES} onChange={setTone} />
              <TextControl label="children" value={label} onChange={setLabel} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
