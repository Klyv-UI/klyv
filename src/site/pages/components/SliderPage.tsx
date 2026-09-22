import { useState } from 'react'
import { Label, Slider, Surface, Text } from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, ToggleControl } from '../../components/Playground'

export default function SliderPage() {
  const [value, setValue] = useState(40)
  const [max, setMax] = useState(100)
  const [step, setStep] = useState(1)
  const [disabled, setDisabled] = useState(false)
  const [amount, setAmount] = useState(500)

  return (
    <DocPage
      name="Slider"
      description="A native range input restyled against the track tokens. The filled portion is painted as a gradient on the input itself rather than with a second element, so the fill can never fall out of sync with the thumb — and every native behaviour, arrow keys included, is preserved."
      propNotes={[
            { name: 'value', type: 'number', description: 'Required. Drives both the thumb and the fill.' },
            { name: 'min', type: 'number', defaultValue: '0', description: 'Lower bound.' },
            { name: 'max', type: 'number', defaultValue: '100', description: 'Upper bound.' },
            {
              name: 'step',
              type: 'number',
              defaultValue: '1',
              description: 'Native. Sets the arrow-key and drag increment.',
            },
            { name: 'ref', type: 'Ref<HTMLInputElement>', description: 'Forwarded to the input.' },
            {
              name: '…props',
              type: 'InputHTMLAttributes<HTMLInputElement>',
              description: 'onChange, disabled, aria-label and the rest.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <div className="w-[280px]">
            <Slider value={value} onChange={(event) => setValue(Number(event.target.value))} aria-label="Default slider" />
          </div>
        </Preview>
      </Section>

      <Section
        title="Values"
        description="The fill is derived from value against min and max, so any range works without extra configuration."
      >
        <Preview stack>
          {[
            { value: 0, label: 'empty' },
            { value: 35, label: 'partial' },
            { value: 100, label: 'full' },
          ].map((state) => (
            <Specimen key={state.label} label={state.label} hint={`value={${state.value}}`} fill>
              <div className="w-full max-w-[280px]">
                <Slider value={state.value} readOnly aria-label={`${state.label} example`} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Steps"
        description="step controls the granularity that arrow keys and dragging snap to."
      >
        <Preview stack>
          {[1, 10, 25].map((size) => (
            <Specimen key={size} label={`step={${size}}`} fill>
              <div className="w-full max-w-[280px]">
                <Slider value={50} step={size} readOnly aria-label={`Step ${size}`} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Focus and drag are live. Tab to a slider and use the arrow keys, Home and End — all native."
      >
        <Preview stack>
          <Specimen label="default" hint="Drag, or focus and press an arrow key" fill>
            <div className="w-full max-w-[280px]">
              <Slider value={value} onChange={(event) => setValue(Number(event.target.value))} aria-label="Interactive" />
            </div>
          </Specimen>
          <Specimen label="disabled" fill>
            <div className="w-full max-w-[280px]">
              <Slider value={60} disabled readOnly aria-label="Disabled" />
            </div>
          </Specimen>
        </Preview>
        <Note>
          A slider has no invalid state. If a value can be wrong, clamp it with{' '}
          <Code>min</Code> and <Code>max</Code> rather than letting the user reach it and then
          reporting an error.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="An amount selector, with the value shown above the track — sliders alone are hard to read precisely."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[340px] gap-3">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="amount-slider">Transfer amount</Label>
              <Text size="stat" tabular>
                ${amount.toLocaleString('en-US')}
              </Text>
            </div>
            <Slider
              id="amount-slider"
              value={amount}
              min={50}
              max={2000}
              step={50}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <div className="flex justify-between">
              <Text size="caption" tone="faint" tabular>
                $50
              </Text>
              <Text size="caption" tone="faint" tabular>
                $2,000
              </Text>
            </div>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="flex w-full max-w-[300px] flex-col gap-3">
              <Slider
                value={Math.min(value, max)}
                max={max}
                step={step}
                disabled={disabled}
                onChange={(event) => setValue(Number(event.target.value))}
                aria-label="Playground slider"
              />
              <Text size="caption" tone="faint" tabular className="text-center">
                {Math.min(value, max)} / {max}
              </Text>
            </div>
          }
          controls={
            <>
              <NumberControl label="value" value={value} min={0} max={max} onChange={setValue} />
              <NumberControl label="max" value={max} min={10} max={200} onChange={setMax} />
              <NumberControl label="step" value={step} min={1} max={25} onChange={setStep} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
