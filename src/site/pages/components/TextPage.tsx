import { useState } from 'react'
import {
  Surface,
  Text,
  type TextLeading,
  type TextSize,
  type TextTone,
  type TextWeight,
} from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const SIZES: { value: TextSize; px: string; usage: string }[] = [
  { value: 'display', px: '30px', usage: 'Account balance' },
  { value: 'title', px: '24px', usage: 'Cashback figure, page titles' },
  { value: 'amount', px: '22px', usage: 'Exchange amounts' },
  { value: 'subtitle', px: '18px', usage: 'Placeholder headings' },
  { value: 'heading', px: '15px', usage: 'Card titles' },
  { value: 'stat', px: '14px', usage: 'Instalment figures' },
  { value: 'body', px: '13px', usage: 'Row titles, values, nav' },
  { value: 'label', px: '12px', usage: 'Field labels, quiet links' },
  { value: 'caption', px: '11px', usage: 'Captions, meta' },
  { value: 'micro', px: '10px', usage: 'Badges' },
]

const SIZE_NAMES = SIZES.map((size) => size.value)
const WEIGHTS: TextWeight[] = ['medium', 'semibold', 'bold', 'extrabold']
const TONES: TextTone[] = [
  'default',
  'soft',
  'faint',
  'accent',
  'accent-ink',
  'success',
  'danger',
  'inverse',
]
const LEADINGS: TextLeading[] = ['none', 'tight', 'normal']

export default function TextPage() {
  const [size, setSize] = useState<TextSize>('heading')
  const [weight, setWeight] = useState<TextWeight>('bold')
  const [tone, setTone] = useState<TextTone>('default')
  const [leading, setLeading] = useState<TextLeading>('none')
  const [value, setValue] = useState('Recent transactions')
  const [tabular, setTabular] = useState(false)

  return (
    <DocPage
      name="Text"
      description="Every piece of text in the design is one step of this scale. Size carries its own tracking and line-height, because the design tightens both as type grows — so choosing a size gets the whole treatment right, not just the pixel value."
      propNotes={[
            {
              name: 'size',
              type: "'display' | 'title' | 'amount' | 'subtitle' | 'heading' | 'stat' | 'body' | 'label' | 'caption' | 'micro'",
              defaultValue: "'body'",
              description: 'Sets font size, tracking, and the default weight and line-height.',
            },
            {
              name: 'weight',
              type: "'medium' | 'semibold' | 'bold' | 'extrabold'",
              description: "Overrides the size's default weight.",
            },
            {
              name: 'tone',
              type: "'default' | 'soft' | 'faint' | 'accent' | 'accent-ink' | 'success' | 'danger' | 'inverse'",
              defaultValue: "'default'",
              description:
                'Colour, from the ink hierarchy and the status tokens. Use inverse on an ink ground and accent-ink on an accent one.',
            },
            {
              name: 'leading',
              type: "'none' | 'tight' | 'normal'",
              description: "Overrides the size's default line-height.",
            },
            {
              name: 'tabular',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Fixed-width digits.',
            },
            {
              name: 'truncate',
              type: 'boolean',
              defaultValue: 'false',
              description: 'One line with an ellipsis.',
            },
            {
              name: 'as',
              type: 'ElementType',
              defaultValue: "'p'",
              description: 'Element to render. Remaining props are typed against it.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Text>Sarah Rosewood</Text>
        </Preview>
      </Section>

      <Section
        title="Sizes"
        description="Ten steps, each pinned to somewhere it appears in the design. Each renders at the weight the design pairs it with unless you override it."
      >
        <Surface variant="card" className="divide-y divide-line">
          {SIZES.map(({ value: sizeValue, px, usage }) => (
            <div
              key={sizeValue}
              className="flex flex-wrap items-baseline justify-between gap-4 px-5 py-4"
            >
              <Text size={sizeValue}>The quick brown fox</Text>
              <div className="flex shrink-0 items-baseline gap-4">
                <Text size="caption" weight="medium" tone="faint">
                  {usage}
                </Text>
                <span className="font-mono text-[11px] font-medium text-ink-faint">{px}</span>
                <Code>{sizeValue}</Code>
              </div>
            </div>
          ))}
        </Surface>
      </Section>

      <Section
        title="Weights"
        description="Four weights. The design skips regular entirely — nothing in the design is lighter than medium."
      >
        <Preview>
          {WEIGHTS.map((value) => (
            <Specimen key={value} label={value}>
              <Text size="stat" weight={value}>
                $27,829.83
              </Text>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="The three inks do nearly all the work. The status tones exist for amounts and errors. The last two are for text that sits on a filled ground: inverse on ink, accent-ink on the accent."
      >
        <Preview stack>
          <div className="flex flex-wrap gap-5">
            {TONES.filter((value) => value !== 'inverse' && value !== 'accent-ink').map((value) => (
              <Specimen key={value} label={value}>
                <Text size="stat" tone={value}>
                  +$125,00
                </Text>
              </Specimen>
            ))}
          </div>
          {/* The ground goes inside the Specimen, so only the sample sits on it
              and the caption keeps its contrast against the page. */}
          <div className="flex flex-wrap gap-5">
            <Specimen label="inverse">
              <div className="flex rounded-[var(--radius-tile)] bg-ink px-4 py-3">
                <Text size="stat" tone="inverse">
                  +$125,00
                </Text>
              </div>
            </Specimen>
            <Specimen label="accent-ink">
              <div className="flex rounded-[var(--radius-tile)] bg-accent px-4 py-3">
                <Text size="stat" tone="accent-ink">
                  +$125,00
                </Text>
              </div>
            </Specimen>
          </div>
        </Preview>
      </Section>

      <Section
        title="Line height"
        description="Headings and single-line values sit on none; stacked rows use tight; anything that wraps into a paragraph uses normal."
      >
        <Preview>
          {LEADINGS.map((value) => (
            <Specimen key={value} label={value} className="max-w-[200px]">
              <Text size="body" weight="medium" tone="soft" leading={value}>
                Get your green credit card now and get $100 in cashback
              </Text>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Numbers"
        description="tabular locks digit widths so a figure does not jitter as it changes — required on anything that animates or recalculates."
      >
        <Preview>
          <Specimen label="default" hint="Proportional digits">
            <Text size="amount">1111.11 · 8888.88</Text>
          </Specimen>
          <Specimen label="tabular" hint="Fixed-width digits">
            <Text size="amount" tabular>
              1111.11 · 8888.88
            </Text>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Truncation"
        description="truncate clamps to one line with an ellipsis. It needs a constrained parent, which in the design is always a min-w-0 flex child."
      >
        <Preview>
          <Specimen label="truncate" className="w-[220px]">
            <Text truncate className="w-full">
              Smart Home Security Monthly Plan
            </Text>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Semantics"
        description="Text renders a <p> by default. Pass as to get the right element — the visual size and the heading level are separate decisions."
      >
        <Preview stack>
          <Text as="h2" size="heading">
            as=&quot;h2&quot; · size=&quot;heading&quot;
          </Text>
          <Text as="span" size="caption" tone="faint">
            as=&quot;span&quot; · inline inside a sentence
          </Text>
          <Text as="label" size="label" tone="faint" htmlFor="text-demo-input">
            as=&quot;label&quot; · forwards htmlFor
          </Text>
          <input
            id="text-demo-input"
            className="h-9 w-[200px] rounded-full border border-line px-3 text-[13px] outline-none focus:border-line-strong"
          />
        </Preview>
        <Note>
          Extra props are forwarded to the rendered element and typed against it, so{' '}
          <Code>htmlFor</Code> is only accepted when <Code>as=&quot;label&quot;</Code>.
        </Note>
      </Section>

      <Section title="Examples" description="A transaction row and a balance block, in Text alone.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Text truncate>Sarah Rosewood</Text>
                <Text size="caption" tone="faint" truncate>
                  Today, 4:28 PM
                </Text>
              </div>
              <Text tabular>+$125,00</Text>
            </div>
          </Surface>
          <Surface variant="card" padding="lg" className="gap-2">
            <Text size="label" tone="faint">
              Your Balance
            </Text>
            <Text size="display" tabular>
              $27,829.83
            </Text>
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          background={tone === 'inverse' ? 'app' : 'surface'}
          stage={
            // Both filled-ground tones need their ground, or the sample is
            // invisible the moment you pick them.
            <div
              className={
                tone === 'inverse'
                  ? 'rounded-[14px] bg-ink px-5 py-4'
                  : tone === 'accent-ink'
                    ? 'rounded-[14px] bg-accent px-5 py-4'
                    : undefined
              }
            >
              <Text size={size} weight={weight} tone={tone} leading={leading} tabular={tabular}>
                {value}
              </Text>
            </div>
          }
          controls={
            <>
              <SelectControl label="size" value={size} options={SIZE_NAMES} onChange={setSize} />
              <SelectControl label="weight" value={weight} options={WEIGHTS} onChange={setWeight} />
              <SelectControl label="tone" value={tone} options={TONES} onChange={setTone} />
              <SelectControl
                label="leading"
                value={leading}
                options={LEADINGS}
                onChange={setLeading}
              />
              <TextControl label="children" value={value} onChange={setValue} />
              <ToggleControl label="tabular" checked={tabular} onChange={setTabular} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
