import { useState } from 'react'
import { Checkbox, Input, Label, Surface, Text } from 'klyvui'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, TextControl, ToggleControl } from '../../components/Playground'

export default function LabelPage() {
  const [text, setText] = useState('Account number')
  const [required, setRequired] = useState(false)
  const [disabled, setDisabled] = useState(false)

  return (
    <DocPage
      name="Label"
      description="A form label on the label type step. It owns exactly one thing — the htmlFor association — because layout, hints and error messages belong to Field. Keeping it this small is what lets it sit beside an Input, a Checkbox or a Switch without fighting any of them."
      propNotes={[
            {
              name: 'htmlFor',
              type: 'string',
              description:
                'Id of the control this labels. Required unless the label wraps its control.',
            },
            {
              name: 'required',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Adds a decorative marker. Set required on the control as well.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Dims the label to match a disabled control.',
            },
            {
              name: '…props',
              type: 'LabelHTMLAttributes<HTMLLabelElement>',
              description: 'Everything a native label takes.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Label htmlFor="label-demo">Account number</Label>
        </Preview>
      </Section>

      <Section
        title="States"
        description="Required adds a marker that is hidden from assistive tech, because the control itself already carries the required attribute."
      >
        <Preview>
          <Specimen label="default">
            <Label htmlFor="label-a">Account number</Label>
          </Specimen>
          <Specimen label="required" hint="Visual marker only">
            <Label htmlFor="label-b" required>
              Account number
            </Label>
          </Specimen>
          <Specimen label="disabled" hint="Dims with its control">
            <Label htmlFor="label-c" disabled>
              Account number
            </Label>
          </Specimen>
        </Preview>
        <Note>
          The asterisk is <Code>aria-hidden</Code>. Announcing a field as required is the job of the
          control&apos;s own <Code>required</Code> attribute, not of a punctuation mark.
        </Note>
      </Section>

      <Section
        title="Association"
        description="Clicking a correctly associated label focuses its control. Try each — both patterns work."
      >
        <Preview stack>
          <Specimen label="htmlFor" hint="Click the label to focus the field" fill>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assoc-input">Account number</Label>
              <Input id="assoc-input" placeholder="Click the label above" className="w-[260px]" />
            </div>
          </Specimen>
          <Specimen label="wrapping" hint="Click the text to toggle the checkbox" fill>
            <label className="inline-flex cursor-pointer items-center gap-2.5">
              <Checkbox />
              <Text as="span" size="label" weight="semibold" tone="soft">
                Save this recipient
              </Text>
            </label>
          </Specimen>
        </Preview>
      </Section>

      <Section title="Examples" description="A form block assembled from primitives only.">
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[320px] gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ex-name" required>
                Recipient name
              </Label>
              <Input id="ex-name" placeholder="Sarah Rosewood" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ex-iban">IBAN</Label>
              <Input id="ex-iban" placeholder="GB00 SPOT 0000 0000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ex-off" disabled>
                Reference (unavailable)
              </Label>
              <Input id="ex-off" placeholder="Not available" disabled />
            </div>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-label" required={required} disabled={disabled}>
                {text || 'Label'}
              </Label>
              <Input
                id="pg-label"
                placeholder="Associated field"
                disabled={disabled}
                className="w-[240px]"
              />
            </div>
          }
          controls={
            <>
              <TextControl label="children" value={text} onChange={setText} />
              <ToggleControl label="required" checked={required} onChange={setRequired} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
