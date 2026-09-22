import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import {
  IconTile,
  Meter,
  Surface,
  Text,
  type SurfacePadding,
  type SurfaceVariant,
} from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const VARIANTS: { value: SurfaceVariant; usage: string }[] = [
  { value: 'card', usage: 'The six dashboard cards' },
  { value: 'tile', usage: 'Partner and instalment tiles' },
  { value: 'field', usage: 'Exchange amount fields' },
  { value: 'sunken', usage: 'Currency rate and fee rows' },
  { value: 'floating', usage: 'Dropdown menus, drawers' },
]

const VARIANT_NAMES = VARIANTS.map((variant) => variant.value)
const PADDINGS: SurfacePadding[] = ['none', 'sm', 'md', 'lg']

export default function SurfacePage() {
  const [variant, setVariant] = useState<SurfaceVariant>('card')
  const [padding, setPadding] = useState<SurfacePadding>('lg')
  const [interactive, setInteractive] = useState(false)

  return (
    <DocPage
      name="Surface"
      description="The container primitive. The design repeats exactly five recipes of radius, border, background and shadow; naming them here is what removes the long class strings that would otherwise drift apart card by card."
      propNotes={[
            {
              name: 'variant',
              type: "'card' | 'tile' | 'field' | 'sunken' | 'floating'",
              defaultValue: "'card'",
              description: 'Radius, border, background and elevation recipe.',
            },
            {
              name: 'padding',
              type: "'none' | 'sm' | 'md' | 'lg'",
              defaultValue: "'none'",
              description: '0 · 12 · 14 · 20px.',
            },
            {
              name: 'interactive',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Strengthens the border on hover. Does not add focus behaviour.',
            },
            {
              name: 'as',
              type: 'ElementType',
              defaultValue: "'div'",
              description: 'Element to render. Remaining props are typed against it.',
            },
            {
              name: 'className',
              type: 'string',
              description:
                'Merged last, so it wins. Surface is a flex column by default — pass flex-row, grid or block to change that.',
            },
          ]}
    >
      <Section title="Default">
        <Preview background="app">
          <Surface padding="lg" className="w-[260px]">
            <Text size="heading">Recent transactions</Text>
          </Surface>
        </Preview>
      </Section>

      <Section
        title="Variants"
        description="Each recipe belongs to a depth. Nesting downwards — card, then tile or field, then sunken — is the only combination the design uses."
      >
        <Preview background="app" stack>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VARIANTS.map(({ value, usage }) => (
              <Specimen key={value} label={value} hint={usage} fill>
                <Surface variant={value} padding="md" className="h-[76px] w-full items-start">
                  <Text size="caption" weight="semibold" tone="soft">
                    {value}
                  </Text>
                </Surface>
              </Specimen>
            ))}
          </div>
        </Preview>
        <Note>
          <Code>tile</Code> has a border but no background, so it inherits whatever it sits on.{' '}
          <Code>field</Code> is the inverse: a background but no border.
        </Note>
      </Section>

      <Section
        title="Padding"
        description="Four steps matching the design's inner spacing. Pass none when the children manage their own padding, as a scrolling list does."
      >
        <Preview background="app">
          {PADDINGS.map((value) => (
            <Specimen
              key={value}
              label={value}
              hint={{ none: '0', sm: '12px', md: '14px', lg: '20px' }[value]}
            >
              <Surface variant="tile" padding={value} className="bg-surface">
                <span className="block size-10 rounded-[8px] bg-accent-soft" />
              </Surface>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="A Surface is not a control, so it has only one interactive affordance: interactive strengthens the border on hover, which is what the design's nested tiles do."
      >
        <Preview background="app">
          <Specimen label="default">
            <Surface variant="tile" padding="md" className="w-[160px] bg-surface">
              <Text size="caption" weight="semibold" tone="soft">
                Static
              </Text>
            </Surface>
          </Specimen>
          <Specimen label="interactive" hint="Hover to see line → line-strong">
            <Surface variant="tile" padding="md" interactive className="w-[160px] bg-surface">
              <Text size="caption" weight="semibold" tone="soft">
                Hover me
              </Text>
            </Surface>
          </Specimen>
        </Preview>
        <Note>
          <Code>interactive</Code> styles a hover; it does not make the element focusable. For
          something clickable, render <Code>as=&quot;button&quot;</Code> or wrap it in a link so it
          keeps keyboard access.
        </Note>
      </Section>

      <Section
        title="Semantics"
        description="Surface renders a div by default. Pass as to keep list and section markup correct."
      >
        <Preview background="app">
          <ul className="grid w-full gap-3 sm:grid-cols-2">
            {['Education', 'iPhone 17 Pro Max'].map((name) => (
              <Surface
                as="li"
                key={name}
                variant="tile"
                padding="sm"
                interactive
                className="bg-surface"
              >
                <IconTile icon={GraduationCap} />
                <Text className="mt-2.5">{name}</Text>
                <Text size="caption" tone="faint" className="mt-4">
                  2 days left
                </Text>
                <Meter value={3} total={6} label={`${name} instalments paid`} className="mt-2.5" />
              </Surface>
            ))}
          </ul>
        </Preview>
      </Section>

      <Section title="Examples" description="A card containing every other variant, as Exchange Money does.">
        <Preview background="app">
          <Surface padding="lg" className="w-full max-w-[380px] gap-3">
            <Text size="heading">Exchange Money</Text>
            <Surface variant="field" padding="md">
              <Text size="caption" tone="faint">
                From
              </Text>
              <Text size="amount" tabular className="mt-1.5">
                $ 500
              </Text>
            </Surface>
            <Surface variant="sunken" padding="sm" className="flex-row justify-between">
              <Text size="label" tone="faint">
                Currency Rate
              </Text>
              <Text size="label" weight="bold" tabular>
                1 USD = 0,73 GBP
              </Text>
            </Surface>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          background="app"
          stage={
            <Surface
              variant={variant}
              padding={padding}
              interactive={interactive}
              className="w-full max-w-[260px]"
            >
              <Text size="heading">Card title</Text>
              <Text size="caption" tone="faint" className="mt-1">
                Supporting caption
              </Text>
            </Surface>
          }
          controls={
            <>
              <SelectControl
                label="variant"
                value={variant}
                options={VARIANT_NAMES}
                onChange={setVariant}
              />
              <SelectControl
                label="padding"
                value={padding}
                options={PADDINGS}
                onChange={setPadding}
              />
              <ToggleControl
                label="interactive"
                checked={interactive}
                onChange={setInteractive}
              />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
