import { useState } from 'react'
import { Avatar, Surface, Text, type AvatarSize } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const SIZES: AvatarSize[] = ['xs', 'sm', 'md', 'lg']
const PEOPLE = ['Sarah Rosewood', 'Jack Hammer', 'Daniel Vance', 'Mia Okonkwo']

export default function AvatarPage() {
  const [name, setName] = useState('Daniel Vance')
  const [size, setSize] = useState<AvatarSize>('md')
  const [ring, setRing] = useState(false)

  return (
    <DocPage
      name="Avatar"
      description="Person identity derived from a single name string. Initials and tint are both computed from the name, so the same person looks identical everywhere without the caller passing a colour — and the full name always reaches assistive tech even though only the initials are drawn."
      propNotes={[
            {
              name: 'name',
              type: 'string',
              description:
                'Required. Drives the initials, the tint and the accessible name. Uses the first two words.',
            },
            {
              name: 'src',
              type: 'string',
              description: 'Image URL. Replaces the initials; the name is still announced.',
            },
            {
              name: 'size',
              type: "'xs' | 'sm' | 'md' | 'lg'",
              defaultValue: "'sm'",
              description: '28 · 36 · 40 · 48px.',
            },
            {
              name: 'ring',
              type: 'boolean',
              defaultValue: 'false',
              description: 'White halo for busy or tinted surfaces.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Avatar name="Daniel Vance" />
        </Preview>
      </Section>

      <Section title="Sizes" description="28 · 36 · 40 · 48px. The initials scale with the circle.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen
              key={value}
              label={value}
              hint={`${{ xs: 28, sm: 36, md: 40, lg: 48 }[value]}px`}
            >
              <Avatar name="Sarah Rosewood" size={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Tints"
        description="One of four soft tints is chosen from the name's character sum. Deterministic, so it never changes between renders or between screens."
      >
        <Preview>
          {PEOPLE.map((person) => (
            <Specimen key={person} label={person}>
              <Avatar name={person} size="lg" />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Avatar is presentational — it has no interactive states. What varies is whether an image resolved, and whether it needs separating from a busy surface."
      >
        <Preview background="app">
          <Specimen label="initials" hint="No src supplied">
            <Avatar name="Daniel Vance" size="md" />
          </Specimen>
          <Specimen label="image" hint="src renders with alt=&quot;&quot;">
            <Avatar
              name="Green Square"
              size="md"
              src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23c8f24e'/%3E%3C/svg%3E"
            />
          </Specimen>
          <Specimen label="ring" hint="On a tinted or photographic surface">
            <Avatar name="Daniel Vance" size="md" ring />
          </Specimen>
          <Specimen label="single word" hint="One initial">
            <Avatar name="Citrine" size="md" />
          </Specimen>
        </Preview>
        <Note>
          The image carries <Code>alt=&quot;&quot;</Code> and the name is exposed through{' '}
          <Code>VisuallyHidden</Code> instead, so the name is announced exactly once whether or not
          the image loads.
        </Note>
      </Section>

      <Section title="Examples">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Transaction row
            </Text>
            <div className="flex items-center gap-3">
              <Avatar name="Sarah Rosewood" />
              <div className="min-w-0 flex-1">
                <Text truncate>Sarah Rosewood</Text>
                <Text size="caption" tone="faint" truncate>
                  Today, 4:28 PM
                </Text>
              </div>
              <Text tabular>+$125,00</Text>
            </div>
          </Surface>
          <Surface variant="card" padding="lg" className="items-start gap-3 bg-app">
            <Text size="caption" weight="semibold" tone="faint">
              Header identity
            </Text>
            <Avatar name="Daniel Vance" size="md" ring />
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          stage={<Avatar name={name || 'Unnamed'} size={size} ring={ring} />}
          controls={
            <>
              <TextControl label="name" value={name} onChange={setName} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl label="ring" checked={ring} onChange={setRing} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
