import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { IconTile, ProgressRing, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, SelectControl } from '../../components/Playground'

const SIZES = ['sm', 'md', 'lg'] as const

export default function ProgressRingPage() {
  const [value, setValue] = useState(64)
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md')

  return (
    <DocPage
      name="ProgressRing"
      description="The same value as Progress, drawn as an arc. Reach for it where the available slot is square rather than wide — a tile corner, a compact summary, a figure that wants its own frame. The centre is a slot, so the ring can carry the number it represents."
      propNotes={[
            { name: 'value', type: 'number', defaultValue: '0', description: 'Current value, clamped to the 0–max range.' },
            { name: 'max', type: 'number', defaultValue: '100', description: 'Upper bound.' },
            {
              name: 'label',
              type: 'string',
              description: 'Required. What is progressing; becomes the accessible name.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: '36 · 56 · 88px.',
            },
            {
              name: 'children',
              type: 'ReactNode',
              description: 'Centre content. Kept short — the ring is not a container.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <ProgressRing value={64} label="Upload progress" />
        </Preview>
      </Section>

      <Section title="Sizes" description="36 · 56 · 88px. Stroke width scales with the ring.">
        <Preview>
          {SIZES.map((option) => (
            <Specimen
              key={option}
              label={option}
              hint={`${{ sm: 36, md: 56, lg: 88 }[option]}px`}
            >
              <ProgressRing value={64} size={option} label={`Ring ${option}`} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section title="Values" description="The arc starts at twelve o’clock and sweeps clockwise.">
        <Preview>
          {[0, 25, 50, 75, 100].map((amount) => (
            <Specimen key={amount} label={`${amount}%`}>
              <ProgressRing value={amount} label={`${amount} percent`} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Centre content"
        description="children render in the middle. Keep it to a couple of characters — the ring is not a container."
      >
        <Preview>
          <Specimen label="empty" hint="No children">
            <ProgressRing value={72} label="Plain ring" />
          </Specimen>
          <Specimen label="percentage">
            <ProgressRing value={72} label="Storage used">
              <Text size="caption" weight="bold" tabular>
                72%
              </Text>
            </ProgressRing>
          </Specimen>
          <Specimen label="figure" hint="size=lg gives room for more">
            <ProgressRing value={60} size="lg" label="Instalments paid">
              <span className="flex flex-col items-center">
                <Text size="stat" tabular>
                  3/5
                </Text>
                <Text size="caption" tone="faint">
                  paid
                </Text>
              </span>
            </ProgressRing>
          </Specimen>
          <Specimen label="glyph">
            <ProgressRing value={40} size="lg" label="Education plan">
              <IconTile icon={GraduationCap} />
            </ProgressRing>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="A ring is determinate only. There is no indeterminate spin here — that is Spinner’s job, and having two spinning circles would be ambiguous."
      >
        <Preview>
          <Specimen label="empty">
            <ProgressRing value={0} label="Empty" />
          </Specimen>
          <Specimen label="partial">
            <ProgressRing value={45} label="Partial" />
          </Specimen>
          <Specimen label="complete">
            <ProgressRing value={100} label="Complete" />
          </Specimen>
        </Preview>
        <Note>
          Like <Code>Progress</Code>, the ring reports <Code>role=&quot;progressbar&quot;</Code>{' '}
          with a value, so the visual arc and the announced value cannot disagree.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="A compact tile summary — the shape a stat tile uses when the slot is square."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[300px] flex-row items-center gap-4">
            <ProgressRing value={60} size="lg" label="Education instalments paid">
              <Text size="stat" tabular>
                60%
              </Text>
            </ProgressRing>
            <div className="min-w-0">
              <Text truncate>Education</Text>
              <Text size="caption" tone="faint">
                3 of 5 instalments
              </Text>
              <Text size="stat" tabular className="mt-1">
                $160
                <Text as="span" size="caption" tone="faint">
                  {' '}
                  /month
                </Text>
              </Text>
            </div>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <ProgressRing value={value} size={size} label="Playground ring">
              <Text size={size === 'sm' ? 'micro' : 'caption'} weight="bold" tabular>
                {value}%
              </Text>
            </ProgressRing>
          }
          controls={
            <>
              <NumberControl label="value" value={value} min={0} max={100} onChange={setValue} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
