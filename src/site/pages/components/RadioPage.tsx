import { useState } from 'react'
import { Radio, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md'] as const
const SPEEDS = [
  { id: 'standard', label: 'Standard', hint: 'Arrives in 3 working days · free' },
  { id: 'express', label: 'Express', hint: 'Arrives tomorrow · $2,48' },
  { id: 'instant', label: 'Instant', hint: 'Arrives in minutes · $4,90' },
]

export default function RadioPage() {
  const [dotSize, setDotSize] = useState<'sm' | 'md'>('md')
  const [invalid, setInvalid] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [speed, setSpeed] = useState('express')
  const [playgroundValue, setPlaygroundValue] = useState('a')

  return (
    <DocPage
      name="Radio"
      description="A native radio with the dial drawn on it. One control, one choice — grouping, labelling and roving arrow-key focus are RadioGroup’s job. Radios sharing a name form a group in the browser, which is what gives you arrow-key navigation for free."
      propNotes={[
            {
              name: 'dotSize',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: 'Named dotSize because size is a native input attribute.',
            },
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Reddens the border and sets aria-invalid.',
            },
            {
              name: 'name',
              type: 'string',
              description: 'Shared across a group. Required for native group behaviour.',
            },
            { name: 'ref', type: 'Ref<HTMLInputElement>', description: 'Forwarded to the input.' },
            {
              name: '…props',
              type: 'InputHTMLAttributes<HTMLInputElement>',
              description: 'checked, defaultChecked, value, onChange and the rest.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Radio name="radio-default" defaultChecked aria-label="Default radio" />
        </Preview>
      </Section>

      <Section title="Sizes" description="16px and 18px, matching Checkbox.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? '16px' : '18px'}>
              <Radio
                name={`radio-size-${value}`}
                dotSize={value}
                defaultChecked
                aria-label={`Radio ${value}`}
              />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and focus are live. A radio cannot be unchecked by clicking it again — that is native behaviour, and the reason a group always needs a default."
      >
        <Preview>
          <Specimen label="unselected">
            <Radio name="radio-states-a" aria-label="Unselected" />
          </Specimen>
          <Specimen label="selected">
            <Radio name="radio-states-b" defaultChecked aria-label="Selected" />
          </Specimen>
          <Specimen label="hover" hint="line-strong → ink-faint">
            <Radio name="radio-states-c" aria-label="Hover" className="border-ink-faint" />
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this control">
            <Radio name="radio-states-d" aria-label="Focus" />
          </Specimen>
          <Specimen label="invalid" hint="aria-invalid=true">
            <Radio name="radio-states-e" invalid aria-label="Invalid" />
          </Specimen>
          <Specimen label="disabled">
            <Radio name="radio-states-f" disabled aria-label="Disabled" />
          </Specimen>
          <Specimen label="disabled + selected">
            <Radio name="radio-states-g" disabled defaultChecked aria-label="Disabled selected" />
          </Specimen>
        </Preview>
        <Note>
          Give every radio in a group the same <Code>name</Code>. That is what makes arrow keys move
          between them and what stops two being selected at once — no JavaScript involved.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="A transfer-speed choice. Arrow keys move between the options; try it."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[360px] gap-1">
            <Text size="heading" className="mb-2">
              Transfer speed
            </Text>
            {SPEEDS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-tile)] px-2.5 py-2.5 transition-colors hover:bg-surface-sunken"
              >
                <Radio
                  name="transfer-speed"
                  value={option.id}
                  checked={speed === option.id}
                  onChange={() => setSpeed(option.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <Text as="span" size="body" className="block">
                    {option.label}
                  </Text>
                  <Text as="span" size="caption" tone="faint" className="block">
                    {option.hint}
                  </Text>
                </span>
              </label>
            ))}
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="flex flex-col gap-3">
              {['a', 'b'].map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2.5">
                  <Radio
                    name="playground-radio"
                    dotSize={dotSize}
                    invalid={invalid}
                    disabled={disabled}
                    checked={playgroundValue === option}
                    onChange={() => setPlaygroundValue(option)}
                  />
                  <Text as="span" size="label" weight="semibold" tone="soft">
                    Option {option.toUpperCase()}
                  </Text>
                </label>
              ))}
            </div>
          }
          controls={
            <>
              <SelectControl label="dotSize" value={dotSize} options={SIZES} onChange={setDotSize} />
              <ToggleControl label="invalid" checked={invalid} onChange={setInvalid} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
