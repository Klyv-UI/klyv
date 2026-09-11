import { useState } from 'react'
import { Button, Label, Surface, Text, Textarea } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, TextControl, ToggleControl } from '../../components/Playground'

export default function TextareaPage() {
  const [rows, setRows] = useState(3)
  const [placeholder, setPlaceholder] = useState('Add a note for this transfer')
  const [invalid, setInvalid] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [noResize, setNoResize] = useState(false)
  const [value, setValue] = useState('')

  return (
    <DocPage
      name="Textarea"
      description="Multi-line text entry. It shares Input’s border, focus and invalid treatment so the two never drift apart, but uses the field radius rather than a pill — a multi-line pill reads badly once the text wraps."
      propNotes={[
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Reddens the border and sets aria-invalid.',
            },
            {
              name: 'resize',
              type: "'none' | 'vertical'",
              defaultValue: "'vertical'",
              description: 'Horizontal resize is deliberately not offered.',
            },
            { name: 'rows', type: 'number', defaultValue: '3', description: 'Resting height in lines.' },
            {
              name: 'ref',
              type: 'Ref<HTMLTextAreaElement>',
              description: 'Forwarded to the textarea.',
            },
            {
              name: '…props',
              type: 'TextareaHTMLAttributes<HTMLTextAreaElement>',
              description: 'Everything a native textarea takes.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Textarea placeholder="Add a note" aria-label="Note" className="w-[320px]" />
        </Preview>
      </Section>

      <Section
        title="Rows"
        description="rows sets the resting height. The control still grows when the user drags it."
      >
        <Preview>
          {[2, 3, 5].map((count) => (
            <Specimen key={count} label={`rows={${count}}`}>
              <Textarea
                rows={count}
                placeholder="Add a note"
                aria-label={`Note ${count}`}
                className="w-[200px]"
              />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Focus is live — click into any field. invalid sets aria-invalid alongside the border colour, exactly as Input does."
      >
        <Preview stack>
          <div className="flex flex-wrap gap-5">
            <Specimen label="default">
              <Textarea placeholder="Add a note" aria-label="Default" className="w-[220px]" />
            </Specimen>
            <Specimen label="focus" hint="line → line-strong">
              <Textarea
                placeholder="Add a note"
                aria-label="Focus"
                className="w-[220px] border-line-strong"
              />
            </Specimen>
            <Specimen label="filled">
              <Textarea defaultValue="Rent for October" aria-label="Filled" className="w-[220px]" />
            </Specimen>
          </div>
          <div className="flex flex-wrap gap-5">
            <Specimen label="invalid" hint="aria-invalid=true">
              <Textarea
                defaultValue="A note that is too long to store"
                invalid
                aria-label="Invalid"
                aria-describedby="ta-error"
                className="w-[220px]"
              />
            </Specimen>
            <Specimen label="disabled">
              <Textarea placeholder="Add a note" disabled aria-label="Disabled" className="w-[220px]" />
            </Specimen>
            <Specimen label="read-only">
              <Textarea defaultValue="Locked note" readOnly aria-label="Read only" className="w-[220px]" />
            </Specimen>
          </div>
          <Text size="caption" weight="medium" tone="danger" id="ta-error">
            Keep the note under 140 characters.
          </Text>
        </Preview>
        <Note>
          There is no <Code>resize: both</Code>. Horizontal dragging breaks the card grid, so the
          only choices are vertical and none.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="Paired with Label — the shape Field formalises."
      >
        <Preview>
          <Surface variant="card" padding="lg" className="w-full max-w-[360px] items-start gap-2">
            <Label htmlFor="transfer-note" required>
              Reference
            </Label>
            <Textarea
              id="transfer-note"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Shown on the recipient statement"
              rows={3}
            />
            <Text size="caption" weight="medium" tone="faint">
              {value.length}/140 characters
            </Text>
            <Button size="sm" className="mt-1">
              Send
            </Button>
          </Surface>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <Textarea
              rows={rows}
              placeholder={placeholder}
              invalid={invalid}
              disabled={disabled}
              resize={noResize ? 'none' : 'vertical'}
              aria-label="Playground textarea"
              className="w-full max-w-[320px]"
            />
          }
          controls={
            <>
              <NumberControl label="rows" value={rows} min={1} max={8} onChange={setRows} />
              <TextControl label="placeholder" value={placeholder} onChange={setPlaceholder} />
              <ToggleControl label="invalid" checked={invalid} onChange={setInvalid} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
              <ToggleControl label="resize none" checked={noResize} onChange={setNoResize} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
