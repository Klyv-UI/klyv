import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Surface, Text, Wordmark } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md', 'lg'] as const

export default function WordmarkPage() {
  const [name, setName] = useState('Citrine')
  const [size, setSize] = useState<(typeof SIZES)[number]>('md')
  const [markOnly, setMarkOnly] = useState(false)

  return (
    <DocPage
      name="Wordmark"
      description="The mark-plus-name lockup, sized as one unit so the two can never drift apart. The mark itself is a slot: the library ships the lockup geometry and the accent plate, not a brand asset, which is what keeps it reusable across products built on these tokens."
      propNotes={[
            {
              name: 'name',
              type: 'string',
              description: 'Product name. Also the accessible name when markOnly is set.',
            },
            {
              name: 'mark',
              type: 'ReactNode',
              description: 'The mark. Defaults to the first letter of the name.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: '28 · 34 · 44px mark, with type and radius to match.',
            },
            {
              name: 'markOnly',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Hides the name visually but keeps it announced.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Wordmark name="Citrine" />
        </Preview>
      </Section>

      <Section
        title="Sizes"
        description="28 · 34 · 44px marks. Radius and type scale together, so the lockup keeps its proportions."
      >
        <Preview stack>
          {SIZES.map((value) => (
            <Specimen
              key={value}
              label={value}
              hint={`${{ sm: 28, md: 34, lg: 44 }[value]}px mark`}
              fill
            >
              <Wordmark name="Citrine" size={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="The mark slot"
        description="With no mark, the first letter of the name is used. Pass anything for a real brand asset — a glyph, an inline SVG, an image."
      >
        <Preview>
          <Specimen label="derived" hint="First letter of the name">
            <Wordmark name="Citrine" />
          </Specimen>
          <Specimen label="custom glyph">
            <Wordmark
              name="Citrine"
              mark={<Layers size={17} strokeWidth={2.25} aria-hidden="true" />}
            />
          </Specimen>
          <Specimen label="inline SVG">
            <Wordmark
              name="Citrine"
              mark={
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                  <path
                    d="M12 3l8 5v8l-8 5-8-5V8z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="A wordmark is static. What varies is whether the name is shown — collapsed navigation drops it, but never from the accessibility tree."
      >
        <Preview background="app">
          <Specimen label="full">
            <Wordmark name="Citrine" />
          </Specimen>
          <Specimen label="markOnly" hint="Name is still announced">
            <Wordmark name="Citrine" markOnly />
          </Specimen>
        </Preview>
        <Note>
          <Code>markOnly</Code> moves the name into <Code>sr-only</Code> rather than removing it, so
          a collapsed sidebar still identifies the product to a screen reader. The plate itself is{' '}
          <Code>aria-hidden</Code> — it is decoration.
        </Note>
      </Section>

      <Section title="Examples" description="The two places a lockup appears in an application shell.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Application header
            </Text>
            <div className="flex w-full items-center gap-4 rounded-full bg-app px-4 py-2.5">
              <Wordmark name="Citrine" size="sm" />
              <span className="ml-auto flex gap-3">
                {['Overview', 'Activity'].map((item) => (
                  <Text key={item} as="span" size="caption" weight="medium" tone="soft">
                    {item}
                  </Text>
                ))}
              </span>
            </div>
          </Surface>

          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Collapsed rail
            </Text>
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-tile)] bg-app px-3 py-3">
              <Wordmark name="Citrine" size="sm" markOnly />
              <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
              <span className="size-8 rounded-[10px] bg-surface" aria-hidden="true" />
            </div>
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          stage={<Wordmark name={name || 'Citrine'} size={size} markOnly={markOnly} />}
          controls={
            <>
              <TextControl label="name" value={name} onChange={setName} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl label="markOnly" checked={markOnly} onChange={setMarkOnly} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
