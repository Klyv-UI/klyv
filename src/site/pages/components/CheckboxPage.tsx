import { useState } from 'react'
import { Checkbox, Label, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md'] as const
const CATEGORIES = ['Subscriptions', 'Transfers', 'Cashback', 'Bills']

export default function CheckboxPage() {
  const [boxSize, setBoxSize] = useState<'sm' | 'md'>('md')
  const [checked, setChecked] = useState(true)
  const [indeterminate, setIndeterminate] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [disabled, setDisabled] = useState(false)

  const [selected, setSelected] = useState<string[]>(['Subscriptions'])
  const allSelected = selected.length === CATEGORIES.length
  const someSelected = selected.length > 0 && !allSelected

  return (
    <DocPage
      name="Checkbox"
      description="A native checkbox with the box drawn on it. It carries no label and no layout of its own — pair it with Label, or let Field do the wiring. Because it stays a real input, it submits with a form, toggles with the space key and reports its state without any ARIA of ours."
      propNotes={[
            {
              name: 'boxSize',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: 'Named boxSize because size is a native input attribute.',
            },
            {
              name: 'indeterminate',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Mixed state. Applied to the DOM node, independent of checked.',
            },
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Reddens the border and sets aria-invalid.',
            },
            {
              name: 'ref',
              type: 'Ref<HTMLInputElement>',
              description: 'Forwarded to the input, alongside the internal ref.',
            },
            {
              name: '…props',
              type: 'InputHTMLAttributes<HTMLInputElement>',
              description: 'checked, defaultChecked, onChange, name, required and the rest.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Checkbox defaultChecked aria-label="Default checkbox" />
        </Preview>
      </Section>

      <Section title="Sizes" description="16px and 18px, matching the two control densities.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? '16px' : '18px'}>
              <Checkbox boxSize={value} defaultChecked aria-label={`Checkbox ${value}`} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and focus are live. Indeterminate is set on the DOM node, not faked with a class, so assistive tech reports it as mixed."
      >
        <Preview>
          <Specimen label="unchecked">
            <Checkbox aria-label="Unchecked" />
          </Specimen>
          <Specimen label="checked">
            <Checkbox defaultChecked aria-label="Checked" />
          </Specimen>
          <Specimen label="indeterminate" hint="aria-checked=mixed">
            <Checkbox indeterminate aria-label="Indeterminate" />
          </Specimen>
          <Specimen label="hover" hint="line-strong → ink-faint">
            <Checkbox aria-label="Hover" className="border-ink-faint" />
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this box">
            <Checkbox aria-label="Focus" />
          </Specimen>
          <Specimen label="invalid" hint="aria-invalid=true">
            <Checkbox invalid aria-label="Invalid" />
          </Specimen>
          <Specimen label="disabled">
            <Checkbox disabled aria-label="Disabled" />
          </Specimen>
          <Specimen label="disabled + checked">
            <Checkbox disabled defaultChecked aria-label="Disabled checked" />
          </Specimen>
        </Preview>
        <Note>
          <Code>indeterminate</Code> is a DOM property rather than an attribute, so it is applied
          through a ref. Setting it does not change <Code>checked</Code> — the two are independent.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="A select-all header driving a group, which is the pattern CheckboxGroup owns."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[320px] gap-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(event) =>
                  setSelected(event.target.checked ? [...CATEGORIES] : [])
                }
              />
              <Text as="span" size="body">
                All categories
              </Text>
              <Text as="span" size="caption" tone="faint" className="ml-auto">
                {selected.length}/{CATEGORIES.length}
              </Text>
            </label>
            <div className="flex flex-col gap-2.5 border-t border-line pt-3">
              {CATEGORIES.map((category) => (
                <label key={category} className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    boxSize="sm"
                    checked={selected.includes(category)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, category]
                          : previous.filter((item) => item !== category),
                      )
                    }
                  />
                  <Text as="span" size="label" weight="semibold" tone="soft">
                    {category}
                  </Text>
                </label>
              ))}
            </div>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                boxSize={boxSize}
                checked={checked}
                indeterminate={indeterminate}
                invalid={invalid}
                disabled={disabled}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <Label disabled={disabled}>Save this recipient</Label>
            </label>
          }
          controls={
            <>
              <SelectControl label="boxSize" value={boxSize} options={SIZES} onChange={setBoxSize} />
              <ToggleControl label="checked" checked={checked} onChange={setChecked} />
              <ToggleControl
                label="indeterminate"
                checked={indeterminate}
                onChange={setIndeterminate}
              />
              <ToggleControl label="invalid" checked={invalid} onChange={setInvalid} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
