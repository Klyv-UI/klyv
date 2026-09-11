import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { IconButton, Input, Surface, Text, type InputSize, type InputVariant } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, TextControl, ToggleControl } from '../../components/Playground'

const VARIANTS: InputVariant[] = ['field', 'bare']
const SIZES: InputSize[] = ['sm', 'md']

export default function InputPage() {
  const [variant, setVariant] = useState<InputVariant>('field')
  const [inputSize, setInputSize] = useState<InputSize>('md')
  const [placeholder, setPlaceholder] = useState('Search transactions, people…')
  const [invalid, setInvalid] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [withIcon, setWithIcon] = useState(true)

  const [search, setSearch] = useState('')
  const [amount, setAmount] = useState('500')

  return (
    <DocPage
      name="Input"
      description="Text entry. Two variants cover the design's only two fields: the bordered header search, and the bare amount input in Exchange Money that inherits its type styles from the field around it. Labelling is deliberately the caller's job, so the primitive never invents copy."
      propNotes={[
            {
              name: 'variant',
              type: "'field' | 'bare'",
              defaultValue: "'field'",
              description: 'Bordered pill, or no chrome at all.',
            },
            {
              name: 'inputSize',
              type: "'sm' | 'md'",
              defaultValue: "'md'",
              description: 'Named inputSize because size is a native input attribute.',
            },
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Reddens the border and sets aria-invalid.',
            },
            {
              name: 'leading / trailing',
              type: 'ReactNode',
              description:
                'Inline decoration. leading is pointer-transparent; trailing accepts interactive nodes.',
            },
            {
              name: 'containerClassName',
              type: 'string',
              description: 'Targets the wrapper. className still targets the input itself.',
            },
            {
              name: 'ref',
              type: 'Ref<HTMLInputElement>',
              description: 'Forwarded to the input.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Input placeholder="Search" aria-label="Search" className="w-[280px]" />
        </Preview>
      </Section>

      <Section
        title="Variants"
        description="field is the bordered pill. bare strips all chrome so the parent can set size, weight and colour — that is how a 22px extrabold amount stays editable."
      >
        <Preview stack>
          <Specimen label="field" hint="Header search">
            <Input placeholder="Search" aria-label="Search example" className="w-[280px]" />
          </Specimen>
          <Specimen label="bare" hint="Exchange amount — parent controls the type">
            <Surface variant="field" padding="md" className="w-[280px]">
              <Text size="caption" weight="medium" tone="faint" className="mb-1.5">
                From
              </Text>
              <div className="flex items-baseline gap-1.5">
                <Text as="span" size="amount">
                  $
                </Text>
                <Input
                  variant="bare"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                  aria-label="Amount to exchange"
                  inputMode="decimal"
                  className="tabular text-[22px] font-extrabold leading-none tracking-[-0.02em]"
                />
              </div>
            </Surface>
          </Specimen>
        </Preview>
      </Section>

      <Section title="Sizes" description="36px and 40px, matching Button's two heights.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'sm' ? 'h-9 · 12px' : 'h-10 · 13px'}>
              <Input
                inputSize={value}
                placeholder="Search"
                aria-label={`Search ${value}`}
                className="w-[220px]"
              />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Adornments"
        description="leading and trailing take any node and reserve the padding for it. The leading slot is pointer-transparent so clicking the icon still focuses the field."
      >
        <Preview stack>
          <Specimen label="leading" hint="An icon that must not steal the click">
            <Input
              placeholder="Search"
              aria-label="Search with icon"
              leading={<Search size={15} strokeWidth={2.25} />}
              className="w-[280px]"
            />
          </Specimen>
          <Specimen label="trailing" hint="An interactive clear control">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type to see the clear button"
              aria-label="Search with clear"
              leading={<Search size={15} strokeWidth={2.25} />}
              trailing={
                search ? (
                  <IconButton icon={X} label="Clear search" size="xs" onClick={() => setSearch('')} />
                ) : undefined
              }
              className="w-[280px]"
            />
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="Focus is live — click or tab into any field. invalid sets aria-invalid as well as the border colour."
      >
        <Preview stack>
          <div className="flex flex-wrap gap-5">
            <Specimen label="default">
              <Input placeholder="Search" aria-label="Default state" className="w-[200px]" />
            </Specimen>
            <Specimen label="focus" hint="line → line-strong">
              <Input
                placeholder="Search"
                aria-label="Focus state"
                className="w-[200px] border-line-strong"
              />
            </Specimen>
            <Specimen label="filled">
              <Input defaultValue="Sarah Rosewood" aria-label="Filled state" className="w-[200px]" />
            </Specimen>
          </div>
          <div className="flex flex-wrap gap-5">
            <Specimen label="invalid" hint="aria-invalid=true">
              <Input
                defaultValue="not-an-amount"
                invalid
                aria-label="Invalid state"
                aria-describedby="input-error"
                className="w-[200px]"
              />
            </Specimen>
            <Specimen label="disabled">
              <Input placeholder="Search" disabled aria-label="Disabled state" className="w-[200px]" />
            </Specimen>
            <Specimen label="read-only">
              <Input defaultValue="£ 369.41" readOnly aria-label="Read-only state" className="w-[200px]" />
            </Specimen>
          </div>
          <Text size="caption" weight="medium" tone="danger" id="input-error">
            Enter a number — the invalid field above is described by this message.
          </Text>
        </Preview>
        <Note>
          <Code>invalid</Code> only colours the border and sets the ARIA flag. Pair it with a
          message and wire the two together with <Code>aria-describedby</Code>, as above — that
          association is handled for you by the <Code>Field</Code> component.
        </Note>
      </Section>

      <Section title="Examples">
        <Surface variant="card" padding="lg" className="gap-3">
          <Text size="caption" weight="semibold" tone="faint">
            Header search, expanded
          </Text>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              placeholder="Search transactions, people…"
              aria-label="Search transactions and people"
              leading={<Search size={15} strokeWidth={2.25} />}
              containerClassName="flex-1"
            />
            <IconButton icon={X} label="Close search" size="sm" />
          </div>
        </Surface>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <Input
              variant={variant}
              inputSize={inputSize}
              placeholder={placeholder}
              invalid={invalid}
              disabled={disabled}
              aria-label="Playground input"
              leading={withIcon ? <Search size={15} strokeWidth={2.25} /> : undefined}
              containerClassName="w-full max-w-[320px]"
              className={variant === 'bare' ? 'text-[15px] font-bold' : undefined}
            />
          }
          controls={
            <>
              <SelectControl
                label="variant"
                value={variant}
                options={VARIANTS}
                onChange={setVariant}
              />
              <SelectControl
                label="inputSize"
                value={inputSize}
                options={SIZES}
                onChange={setInputSize}
              />
              <TextControl label="placeholder" value={placeholder} onChange={setPlaceholder} />
              <ToggleControl label="leading icon" checked={withIcon} onChange={setWithIcon} />
              <ToggleControl label="invalid" checked={invalid} onChange={setInvalid} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
