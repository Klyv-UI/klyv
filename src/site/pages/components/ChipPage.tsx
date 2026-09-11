import { useState } from 'react'
import { Chip, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const SIZES = ['sm', 'md'] as const
const FILTERS = ['Subscriptions', 'Transfers', 'Cashback', 'Bills', 'Refunds']

export default function ChipPage() {
  const [size, setSize] = useState<(typeof SIZES)[number]>('md')
  const [label, setLabel] = useState('Subscriptions')
  const [selected, setSelected] = useState(true)
  const [removable, setRemovable] = useState(true)
  const [disabled, setDisabled] = useState(false)

  const [active, setActive] = useState<string[]>(['Subscriptions', 'Cashback'])
  const [applied, setApplied] = useState<string[]>(['This month', 'Over $50'])

  return (
    <DocPage
      name="Chip"
      description="The interactive counterpart to Tag: a value that can be toggled, removed, or both. The remove control is a separate button rather than a click target on the chip itself, so selecting and removing stay distinguishable — to a pointer and to a screen reader."
      propNotes={[
            { name: 'label', type: 'string', description: 'Required. Visible text, and part of the remove button name.' },
            {
              name: 'selected',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Accent treatment plus aria-pressed.',
            },
            {
              name: 'onRemove',
              type: '() => void',
              description: 'Adds a remove button. Omit for a chip that only toggles.',
            },
            {
              name: 'size',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: '28px or 32px tall.',
            },
            {
              name: '…props',
              type: 'ButtonHTMLAttributes<HTMLButtonElement>',
              description: 'Applied to the main button — onClick, disabled and the rest.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Chip label="Subscriptions" />
        </Preview>
      </Section>

      <Section
        title="Selection"
        description="selected sets aria-pressed, so the chip is announced as a toggle button rather than as plain text."
      >
        <Preview>
          <Specimen label="unselected">
            <Chip label="Subscriptions" />
          </Specimen>
          <Specimen label="selected" hint="aria-pressed=true">
            <Chip label="Subscriptions" selected />
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Removable"
        description="Passing onRemove adds a second button. Its accessible name includes the chip label, so a list of remove buttons stays unambiguous."
      >
        <Preview>
          <Specimen label="plain">
            <Chip label="Cashback" />
          </Specimen>
          <Specimen label="removable" hint="Announced as “Remove Cashback”">
            <Chip label="Cashback" onRemove={() => undefined} />
          </Specimen>
          <Specimen label="selected + removable">
            <Chip label="Cashback" selected onRemove={() => undefined} />
          </Specimen>
        </Preview>
      </Section>

      <Section title="Sizes" description="28px and 32px, aligning with the two Button heights.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? 'h-7 · 11px' : 'h-8 · 12px'}>
              <Chip label="Bills" size={value} onRemove={() => undefined} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and focus are live, and a removable chip has two separate tab stops. Tab through the last one to feel the difference."
      >
        <Preview>
          <Specimen label="default">
            <Chip label="Bills" />
          </Specimen>
          <Specimen label="selected">
            <Chip label="Bills" selected />
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this chip">
            <Chip label="Bills" />
          </Specimen>
          <Specimen label="disabled">
            <Chip label="Bills" disabled onRemove={() => undefined} />
          </Specimen>
          <Specimen label="two tab stops" hint="Tab twice: select, then remove">
            <Chip label="Bills" onRemove={() => undefined} />
          </Specimen>
        </Preview>
        <Note>
          <Code>disabled</Code> disables both buttons and drops pointer events on the wrapper, so a
          disabled chip cannot be removed either.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="The two ways a chip row appears — as a filter set, and as the applied-filter summary."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Filter set — toggling
            </Text>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <Chip
                  key={filter}
                  label={filter}
                  size="sm"
                  selected={active.includes(filter)}
                  onClick={() =>
                    setActive((previous) =>
                      previous.includes(filter)
                        ? previous.filter((item) => item !== filter)
                        : [...previous, filter],
                    )
                  }
                />
              ))}
            </div>
            <Text size="caption" tone="faint">
              {active.length} selected
            </Text>
          </Surface>

          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Applied filters — removable
            </Text>
            <div className="flex flex-wrap gap-2">
              {applied.map((filter) => (
                <Chip
                  key={filter}
                  label={filter}
                  size="sm"
                  selected
                  onRemove={() =>
                    setApplied((previous) => previous.filter((item) => item !== filter))
                  }
                />
              ))}
              {applied.length === 0 && (
                <Text size="caption" tone="faint">
                  No filters applied.
                </Text>
              )}
            </div>
            {applied.length < 2 && (
              <button
                type="button"
                onClick={() => setApplied(['This month', 'Over $50'])}
                className="text-[12px] font-bold text-ink underline underline-offset-2"
              >
                Reset
              </button>
            )}
          </Surface>
        </div>
        <Note>
          A chip that is only ever read, never clicked, should be a <Code>Tag</Code> — it saves a
          tab stop and stops a screen reader announcing a control that does nothing.
        </Note>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <Chip
              label={label || 'Chip'}
              size={size}
              selected={selected}
              disabled={disabled}
              onClick={() => setSelected((previous) => !previous)}
              onRemove={removable ? () => setLabel('') : undefined}
            />
          }
          controls={
            <>
              <TextControl label="label" value={label} onChange={setLabel} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <ToggleControl label="selected" checked={selected} onChange={setSelected} />
              <ToggleControl label="onRemove" checked={removable} onChange={setRemovable} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
