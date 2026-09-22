import { useState } from 'react'
import { Bell } from 'lucide-react'
import { IconButton, StatusDot, Text, type StatusDotSize, type StatusDotTone } from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const TONES: StatusDotTone[] = ['accent', 'success', 'warning', 'danger', 'neutral']
const SIZES: StatusDotSize[] = ['sm', 'md']

export default function StatusDotPage() {
  const [tone, setTone] = useState<StatusDotTone>('accent')
  const [size, setSize] = useState<StatusDotSize>('sm')
  const [ring, setRing] = useState(true)
  const [labelled, setLabelled] = useState(false)

  return (
    <DocPage
      name="StatusDot"
      description="A small state marker. The design uses exactly one — the unread pip on a notification bell — but the shape generalises, so the tones are here and the accessible-name decision is made explicit rather than assumed."
      propNotes={[
            {
              name: 'tone',
              type: "'accent' | 'success' | 'warning' | 'danger' | 'neutral'",
              defaultValue: "'accent'",
              description: 'Colour.',
            },
            {
              name: 'size',
              type: "'sm' | 'md'",
              defaultValue: "'sm'",
              description: '6px or 8px.',
            },
            {
              name: 'ring',
              type: 'boolean',
              defaultValue: 'false',
              description: 'White halo, for a dot overlapping something else.',
            },
            {
              name: 'label',
              type: 'string',
              description:
                'Announced to assistive tech. Omit when adjacent text already conveys the state.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <StatusDot />
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="Accent is the design's own use. The status tones exist for states the design has not needed yet, and read against the same tokens."
      >
        <Preview>
          {TONES.map((value) => (
            <Specimen key={value} label={value}>
              <StatusDot tone={value} size="md" />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section title="Sizes" description="6px and 8px. Anything larger competes with a Badge.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? '6px' : '8px'}>
              <StatusDot size={value} tone="success" />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Ring"
        description="A white halo separates the dot from whatever it overlaps. Needed when it sits on an icon or an avatar, not when it sits in a row of text."
      >
        <Preview background="app">
          <Specimen label="ring={false}" hint="On a plain surface">
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-2">
              <StatusDot />
              <Text size="caption" weight="semibold" tone="soft">
                Active
              </Text>
            </div>
          </Specimen>
          <Specimen label="ring" hint="Overlapping a glyph">
            <span className="relative inline-flex">
              <IconButton icon={Bell} label="Notifications" tone="white" />
              <StatusDot ring className="pointer-events-none absolute right-2 top-2" />
            </span>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="A dot has no interaction. What varies is whether it is decorative or meaningful — and that determines whether it is announced at all."
      >
        <Preview>
          <Specimen label="decorative" hint="aria-hidden; the text beside it carries the meaning">
            <div className="flex items-center gap-2">
              <StatusDot tone="success" />
              <Text size="caption" weight="semibold" tone="soft">
                Payment cleared
              </Text>
            </div>
          </Specimen>
          <Specimen label="labelled" hint="The dot is the only signal, so it gets a name">
            <span className="relative inline-flex">
              <IconButton icon={Bell} label="Notifications" tone="white" />
              <StatusDot
                ring
                label="Unread notifications"
                className="pointer-events-none absolute right-2 top-2"
              />
            </span>
          </Specimen>
        </Preview>
        <Note>
          Without <Code>label</Code> the dot is <Code>aria-hidden</Code>. Pass one only when the dot
          is the sole carrier of the state — otherwise it is announced twice.
        </Note>
      </Section>

      <Section title="Examples" description="The header cluster, as shipped.">
        <Preview background="app">
          <div className="flex items-center gap-0.5 rounded-full bg-white p-1 shadow-[var(--shadow-tile)]">
            <IconButton icon={Bell} label="Notifications" size="sm" className="text-ink" />
            <span className="relative -ml-9 size-9">
              <StatusDot ring className="pointer-events-none absolute right-2 top-2" />
            </span>
          </div>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <span className="relative inline-flex">
              <IconButton icon={Bell} label="Notifications" tone="white" />
              <StatusDot
                tone={tone}
                size={size}
                ring={ring}
                label={labelled ? 'Unread notifications' : undefined}
                className="pointer-events-none absolute right-2 top-2"
              />
            </span>
          }
          controls={
            <>
              <SelectControl label="tone" value={tone} options={TONES} onChange={setTone} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl label="ring" checked={ring} onChange={setRing} />
              <ToggleControl label="label" checked={labelled} onChange={setLabelled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
