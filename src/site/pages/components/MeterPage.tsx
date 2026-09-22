import { useState } from 'react'
import { GraduationCap, Smartphone } from 'lucide-react'
import { Button, IconTile, Meter, Surface, Text, type MeterVariant } from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, SelectControl } from '../../components/Playground'

const VARIANTS: { value: MeterVariant; usage: string }[] = [
  { value: 'segments', usage: 'Instalments paid' },
  { value: 'dots', usage: 'Cashback progress' },
]

const VARIANT_NAMES = VARIANTS.map((variant) => variant.value)

export default function MeterPage() {
  const [variant, setVariant] = useState<MeterVariant>('segments')
  const [total, setTotal] = useState(6)
  const [value, setValue] = useState(3)

  return (
    <DocPage
      name="Meter"
      description="Discrete progress. The design never draws a continuous bar — progress is always a count of instalments paid or rewards earned, and the meter renders every unit so the remaining ones can be counted by eye."
      propNotes={[
            { name: 'value', type: 'number', description: 'Filled units. A count, not a percentage.' },
            {
              name: 'total',
              type: 'number',
              description: 'Total units. Each one is rendered, so keep it countable.',
            },
            {
              name: 'label',
              type: 'string',
              description: 'Required. What the meter measures; becomes its accessible name.',
            },
            {
              name: 'variant',
              type: "'segments' | 'dots'",
              defaultValue: "'segments'",
              description: 'Bars, or round pips.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <div className="w-[220px]">
            <Meter value={3} total={6} label="Instalments paid" />
          </div>
        </Preview>
      </Section>

      <Section
        title="Variants"
        description="Segments are wide bars on an instalment tile; dots are round pips under a cashback figure. Same data, different density."
      >
        <Preview stack>
          {VARIANTS.map(({ value: variantValue, usage }) => (
            <Specimen key={variantValue} label={variantValue} hint={usage} fill>
              <div className="w-full max-w-[380px]">
                <Meter
                  variant={variantValue}
                  value={variantValue === 'dots' ? 5 : 3}
                  total={variantValue === 'dots' ? 16 : 6}
                  label={usage}
                />
              </div>
            </Specimen>
          ))}
        </Preview>
        <Note>
          Both variants flex to their container: dots shrink rather than overflow, which is what
          keeps the cashback meter intact when the card narrows.
        </Note>
      </Section>

      <Section
        title="Values"
        description="value is a count, not a percentage. Empty and complete are just the ends of the range."
      >
        <Preview stack>
          {[
            { value: 0, label: 'empty' },
            { value: 2, label: 'partial' },
            { value: 6, label: 'complete' },
          ].map((state) => (
            <Specimen key={state.label} label={state.label} hint={`value={${state.value}} total={6}`} fill>
              <div className="w-full max-w-[280px]">
                <Meter value={state.value} total={6} label={`${state.label} example`} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Density"
        description="Every unit is rendered, so keep total to a countable quantity. Sixteen pips is the densest the design goes."
      >
        <Preview stack>
          {[4, 6, 12, 16].map((count) => (
            <Specimen key={count} label={`total={${count}}`} fill>
              <div className="w-full max-w-[300px]">
                <Meter
                  variant="dots"
                  value={Math.ceil(count / 3)}
                  total={count}
                  label={`${count} units`}
                />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Accessibility"
        description="Renders as role=progressbar with aria-valuenow, aria-valuemin and aria-valuemax, so a screen reader announces “3 of 6” without the pips being individually traversed."
      >
        <Preview>
          <div className="w-full max-w-[300px]">
            <Meter value={3} total={6} label="Education instalments paid" />
          </div>
        </Preview>
        <Note>
          <Code>label</Code> is required and should say what is being measured, not just
          “progress” — it becomes the meter's accessible name.
        </Note>
      </Section>

      <Section title="Examples" description="Both uses, side by side.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <Text size="heading">Monthly Payments</Text>
            <ul className="grid grid-cols-2 gap-3">
              {[
                { name: 'Education', icon: GraduationCap, days: 2, amount: '$160', paid: 3 },
                { name: 'iPhone 17 Pro Max', icon: Smartphone, days: 4, amount: '$550', paid: 2 },
              ].map((item) => (
                <Surface as="li" key={item.name} variant="tile" padding="sm" interactive>
                  <IconTile icon={item.icon} />
                  <Text className="mt-2.5" truncate>
                    {item.name}
                  </Text>
                  <Text size="caption" tone="faint" className="mt-4">
                    {item.days} days left
                  </Text>
                  <Text size="stat" tabular className="mt-0.5">
                    {item.amount}
                    <Text as="span" size="caption" tone="faint">
                      {' '}
                      /month
                    </Text>
                  </Text>
                  <Meter
                    className="mt-2.5"
                    value={item.paid}
                    total={6}
                    label={`${item.name} instalments paid`}
                  />
                </Surface>
              ))}
            </ul>
          </Surface>

          <Surface variant="card" padding="lg" className="gap-3">
            <Text size="heading">Cashback Partners</Text>
            <Surface variant="tile" padding="sm" className="mt-auto">
              <div className="flex items-center justify-between gap-3">
                <Text size="label" tone="faint">
                  Available Cashback
                </Text>
                <Button variant="outline" size="sm">
                  Withdraw
                </Button>
              </div>
              <Text size="title" tabular className="mt-2">
                $1,154.00
              </Text>
              <Meter
                variant="dots"
                className="mt-3"
                value={5}
                total={16}
                label="Cashback progress toward the next reward"
              />
            </Surface>
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="w-full max-w-[300px]">
              <Meter
                variant={variant}
                value={Math.min(value, total)}
                total={total}
                label="Playground meter"
              />
            </div>
          }
          controls={
            <>
              <SelectControl
                label="variant"
                value={variant}
                options={VARIANT_NAMES}
                onChange={setVariant}
              />
              <NumberControl label="total" value={total} min={2} max={20} onChange={setTotal} />
              <NumberControl label="value" value={value} min={0} max={total} onChange={setValue} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
