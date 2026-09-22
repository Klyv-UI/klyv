import { useState } from 'react'
import {
  AmountField,
  Button,
  Card,
  CheckboxGroup,
  Combobox,
  Field,
  Form,
  FormActions,
  FormSection,
  Input,
  InputOTP,
  MultiSelect,
  NumberInput,
  PasswordInput,
  RadioGroup,
  RangeSlider,
  Rating,
  SearchField,
  Select,
  Surface,
  TagInput,
  Text,
} from 'klyvui'
import type { ExampleModule } from './types'

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'JPY', symbol: '¥' },
]

const CATEGORY_OPTIONS = [
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'bills', label: 'Bills' },
  { value: 'refunds', label: 'Refunds', disabled: true },
]

function FieldExample() {
  const [name, setName] = useState('')
  const touched = name.length > 0
  const invalid = touched && name.trim().length < 3

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-4">
      <Field label="Recipient name" hint="As it appears on their account." required>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sarah Rosewood" />
      </Field>
      <Field label="Reference" error={invalid ? 'Enter at least three characters.' : undefined}>
        <Input defaultValue={invalid ? 'ab' : ''} placeholder="Rent for October" />
      </Field>
      <Field label="Sort code" hint="Six digits, no spaces." disabled>
        <Input placeholder="Unavailable for this account" />
      </Field>
    </div>
  )
}

function FormExample() {
  const [sent, setSent] = useState(false)
  return (
    <Card title="New transfer" className="w-full max-w-[420px]">
      <Form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault()
          setSent(true)
        }}
      >
        <FormSection title="Recipient" description="Where the money is going.">
          <Field label="Name" required>
            <Input placeholder="Sarah Rosewood" />
          </Field>
          <Field label="Account number" hint="Eight digits." required>
            <Input placeholder="00005199" inputMode="numeric" />
          </Field>
        </FormSection>
        <FormActions align="between">
          <Text size="caption" tone="faint" role="status" aria-live="polite">
            {sent ? 'Submitted.' : 'Nothing is sent from this demo.'}
          </Text>
          <Button type="submit" size="sm">
            Continue
          </Button>
        </FormActions>
      </Form>
    </Card>
  )
}

function SearchFieldExample() {
  const [query, setQuery] = useState('')
  const rows = ['Apple Music', 'Smart Home Security', 'GumZone', 'Water Bill', 'Electricity'].filter(
    (row) => row.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3">
      <SearchField value={query} onValueChange={setQuery} label="Search subscriptions" />
      <Surface variant="sunken" padding="md" className="gap-1">
        {rows.map((row) => (
          <Text key={row} size="caption" tone="soft">
            {row}
          </Text>
        ))}
        {rows.length === 0 && (
          <Text size="caption" tone="faint">
            No matches.
          </Text>
        )}
      </Surface>
    </div>
  )
}

function NumberInputExample() {
  const [count, setCount] = useState(3)
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-2">
      <NumberInput value={count} onValueChange={setCount} min={1} max={12} aria-label="Instalments" />
      <Text size="caption" tone="faint">
        Clamped to 1–12. The steppers disable at each end.
      </Text>
    </div>
  )
}

function InputOTPExample() {
  const [code, setCode] = useState('')
  const [done, setDone] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <InputOTP value={code} onValueChange={setCode} onComplete={() => setDone(true)} />
      <Text size="caption" tone={done ? 'success' : 'faint'} role="status" aria-live="polite">
        {done ? 'Code complete.' : 'Try pasting a six-digit code.'}
      </Text>
    </div>
  )
}

function TagInputExample() {
  const [tags, setTags] = useState<string[]>(['groceries', 'travel'])
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-2">
      <TagInput value={tags} onValueChange={setTags} label="Categories" max={5} />
      <Text size="caption" tone="faint">
        Enter or comma commits. Backspace on an empty field removes the last tag.
      </Text>
    </div>
  )
}

function SelectExample() {
  const [currency, setCurrency] = useState('USD')
  const [category, setCategory] = useState('subscriptions')
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Text size="caption" tone="faint">
          variant=&quot;pill&quot;
        </Text>
        <Select
          options={CURRENCIES.map((entry) => ({ value: entry.code, label: entry.code }))}
          value={currency}
          onValueChange={setCurrency}
          label="Currency"
          variant="pill"
          size="sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Text size="caption" tone="faint">
          variant=&quot;field&quot;
        </Text>
        <Select
          options={CATEGORY_OPTIONS}
          value={category}
          onValueChange={setCategory}
          label="Category"
        />
      </div>
    </div>
  )
}

function MultiSelectExample() {
  const [value, setValue] = useState<string[]>(['subscriptions', 'bills'])
  return (
    <div className="w-full max-w-[320px]">
      <MultiSelect options={CATEGORY_OPTIONS} value={value} onValueChange={setValue} label="Categories" />
    </div>
  )
}

function ComboboxExample() {
  const [value, setValue] = useState<string | null>('gbp')
  return (
    <div className="w-full max-w-[320px]">
      <Combobox
        options={[
          { value: 'usd', label: 'US Dollar' },
          { value: 'gbp', label: 'British Pound' },
          { value: 'eur', label: 'Euro' },
          { value: 'jpy', label: 'Japanese Yen' },
          { value: 'chf', label: 'Swiss Franc' },
          { value: 'sek', label: 'Swedish Krona' },
        ]}
        value={value}
        onValueChange={setValue}
        label="Currency"
        placeholder="Type to filter currencies"
      />
    </div>
  )
}

function AmountFieldExample() {
  const [amount, setAmount] = useState('500')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('GBP')
  const parsed = Number.parseFloat(amount.replace(/,/g, '')) || 0
  const converted = (parsed * 0.73882).toFixed(2)

  return (
    <Card title="Exchange Money" className="w-full max-w-[380px]">
      <div className="mt-3 flex flex-col gap-2">
        <AmountField
          label="From"
          value={amount}
          onValueChange={setAmount}
          currency={from}
          onCurrencyChange={setFrom}
          currencies={CURRENCIES}
        />
        <AmountField
          label="To"
          value={converted}
          onValueChange={() => undefined}
          currency={to}
          onCurrencyChange={setTo}
          currencies={CURRENCIES}
          readOnly
        />
      </div>
    </Card>
  )
}

function RangeSliderExample() {
  const [range, setRange] = useState<[number, number]>([120, 780])
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <Text size="caption" tone="faint">
          Amount range
        </Text>
        <Text size="caption" weight="bold" tabular>
          ${range[0]} – ${range[1]}
        </Text>
      </div>
      <RangeSlider value={range} onValueChange={setRange} min={0} max={1000} step={10} />
    </div>
  )
}

function RatingExample() {
  const [value, setValue] = useState(4)
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col gap-1.5">
        <Text size="caption" tone="faint">
          Interactive
        </Text>
        <Rating value={value} onValueChange={setValue} label="Rate this transfer" size="lg" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Text size="caption" tone="faint">
          Read-only
        </Text>
        <Rating value={4} readOnly label="Average rating" />
      </div>
    </div>
  )
}

function GroupExample() {
  const [categories, setCategories] = useState<string[]>(['subscriptions'])
  const [speed, setSpeed] = useState('express')
  return (
    <div className="flex w-full flex-wrap gap-8">
      <CheckboxGroup
        label="Include categories"
        options={CATEGORY_OPTIONS.map(({ value, label, disabled }) => ({ value, label, disabled }))}
        value={categories}
        onValueChange={setCategories}
        hint="Choose at least one."
        className="min-w-[220px]"
      />
      <RadioGroup
        label="Transfer speed"
        variant="card"
        value={speed}
        onValueChange={setSpeed}
        options={[
          { value: 'standard', label: 'Standard', hint: 'Three working days, free' },
          { value: 'express', label: 'Express', hint: 'Tomorrow, $2,48' },
          { value: 'instant', label: 'Instant', hint: 'Minutes, $4,90' },
        ]}
        className="min-w-[260px] flex-1"
      />
    </div>
  )
}

export const demos: ExampleModule = {
  field: {
    description:
      'Label, control, hint and error wired together in one place. Field generates the id and clones its single child to attach id, aria-describedby, aria-invalid, required and disabled — doing it here is what stops every form in the app associating these by hand, which is where accessible forms usually go wrong.',
    sections: [
      {
        title: 'States',
        description: 'Type in the first field, then look at the second: an error replaces the hint and is announced.',
        bare: true,
        Content: FieldExample,
        note: 'Field expects exactly one form control as its child. Anything in the library that takes id, invalid and disabled will work — Input, Textarea, Select, Combobox and the rest.',
      },
    ],
    props: [
      { name: 'label', type: 'string', description: 'Visible label, associated automatically.' },
      { name: 'hint / error', type: 'string', description: 'Error replaces the hint and marks the control invalid.' },
      { name: 'required / disabled', type: 'boolean', description: 'Forwarded to the control as well as the label.' },
      { name: 'hideLabel', type: 'boolean', defaultValue: 'false', description: 'Visually hidden, still announced.' },
    ],
  },

  form: {
    description:
      'A native form with the library rhythm applied. It stays a real form element, so Enter submits and browser validation still works — validation itself is left to the application rather than baked in. FormSection is a real fieldset and legend; FormActions is the trailing row.',
    sections: [{ title: 'Example', bare: true, Content: FormExample }],
    props: [
      { name: 'gap', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: 'Vertical rhythm between fields.' },
      { name: 'FormSection.title / description', type: 'string', description: 'Rendered as legend plus supporting copy.' },
      { name: 'FormActions.align', type: "'start' | 'end' | 'between'", defaultValue: "'end'", description: 'Alignment of the actions row.' },
    ],
  },

  'search-field': {
    description:
      'Input with a search glyph and a clear control that appears once there is something to clear. Clearing returns focus to the field, so the user is not dropped at the end of the document after emptying it.',
    sections: [
      { title: 'Example', description: 'Type to filter, then use the clear control.', bare: true, Content: SearchFieldExample },
      {
        title: 'Sizes',
        specimens: [
          { label: 'sm', node: <SearchField value="" onValueChange={() => undefined} inputSize="sm" label="Search small" containerClassName="w-[200px]" /> },
          { label: 'md', node: <SearchField value="" onValueChange={() => undefined} label="Search medium" containerClassName="w-[220px]" /> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: 'string / (value: string) => void', description: 'Controlled value.' },
      { name: 'label', type: 'string', defaultValue: "'Search'", description: 'Accessible name; the glyph is not a label.' },
      { name: 'clearable', type: 'boolean', defaultValue: 'true', description: 'Show the clear control when there is text.' },
    ],
  },

  'password-input': {
    description:
      'Input with a reveal toggle. The toggle is a real button with a changing accessible name and aria-pressed, so its state is announced rather than inferred from a glyph. Reveal is deliberately not sticky.',
    sections: [
      {
        title: 'States',
        specimens: [
          { label: 'default', node: <PasswordInput defaultValue="correct horse" aria-label="Password" containerClassName="w-[240px]" /> },
          { label: 'invalid', node: <PasswordInput defaultValue="short" invalid aria-label="Invalid password" containerClassName="w-[240px]" /> },
          { label: 'disabled', node: <PasswordInput defaultValue="locked" disabled aria-label="Disabled password" containerClassName="w-[240px]" /> },
          { label: 'revealable={false}', node: <PasswordInput defaultValue="no toggle" revealable={false} aria-label="No reveal" containerClassName="w-[240px]" /> },
        ],
      },
    ],
    props: [
      { name: 'revealable', type: 'boolean', defaultValue: 'true', description: 'Show the reveal toggle.' },
      { name: 'invalid', type: 'boolean', defaultValue: 'false', description: 'Reddens the border and sets aria-invalid.' },
    ],
  },

  'number-input': {
    description:
      'A numeric field with stepper buttons. Values are clamped on every change, so the control can never hold a number outside its own range — an invalid state the user would then have to be told about. The steppers are buttons rather than the native spinner so they are large enough to hit on touch.',
    sections: [
      { title: 'Example', bare: true, Content: NumberInputExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'with suffix', node: <NumberInput value={12} onValueChange={() => undefined} suffix="mo" aria-label="Months" containerClassName="w-[200px]" /> },
          { label: 'steppers={false}', node: <NumberInput value={500} onValueChange={() => undefined} steppers={false} aria-label="Amount" containerClassName="w-[140px]" /> },
          { label: 'disabled', node: <NumberInput value={3} onValueChange={() => undefined} disabled aria-label="Disabled" containerClassName="w-[200px]" /> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: 'number / (value: number) => void', description: 'Controlled value.' },
      { name: 'min / max / step', type: 'number', description: 'Bounds and increment. Values are clamped.' },
      { name: 'steppers', type: 'boolean', defaultValue: 'true', description: 'Show the plus and minus buttons.' },
      { name: 'suffix', type: 'string', description: 'Unit after the figure.' },
    ],
  },

  'input-otp': {
    description:
      'A one-time code split across single-character boxes. The boxes behave as one logical field: pasting a whole code fills them all, typing advances, Backspace on an empty box steps back and arrows move between them. Without that, a split code field is markedly worse than a plain input.',
    sections: [
      { title: 'Example', description: 'Type, paste, and try Backspace at the start of a box.', bare: true, Content: InputOTPExample },
      {
        title: 'States',
        stack: true,
        specimens: [
          { label: 'length={4}', fill: true, node: <InputOTP value="12" onValueChange={() => undefined} length={4} /> },
          { label: 'invalid', fill: true, node: <InputOTP value="123456" onValueChange={() => undefined} invalid /> },
          { label: 'disabled', fill: true, node: <InputOTP value="1234" onValueChange={() => undefined} disabled /> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: 'string / (value: string) => void', description: 'The code so far.' },
      { name: 'length', type: 'number', defaultValue: '6', description: 'Number of boxes.' },
      { name: 'onComplete', type: '(value: string) => void', description: 'Fired once the last character is entered.' },
    ],
  },

  'tag-input': {
    description:
      'A field that turns entries into removable Chips. Additions and removals are announced through a live region, because the visible change happens outside the input the user is typing into.',
    sections: [
      { title: 'Example', bare: true, Content: TagInputExample },
      {
        title: 'States',
        stack: true,
        specimens: [
          { label: 'empty', fill: true, node: <TagInput value={[]} onValueChange={() => undefined} label="Empty" className="max-w-[320px]" /> },
          { label: 'invalid', fill: true, node: <TagInput value={['bad']} onValueChange={() => undefined} label="Invalid" invalid className="max-w-[320px]" /> },
          { label: 'disabled', fill: true, node: <TagInput value={['locked']} onValueChange={() => undefined} label="Disabled" disabled className="max-w-[320px]" /> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: 'string[] / (value: string[]) => void', description: 'The tags, in order.' },
      { name: 'max', type: 'number', description: 'Caps the number of tags; the field disables once reached.' },
      { name: 'validate', type: '(value: string) => boolean', description: 'Return false to refuse an entry.' },
    ],
  },

  'checkbox-group': {
    description:
      'A set of related checkboxes as a real fieldset and legend, so the group name is announced once before the options rather than repeated into every label. The value is an array: the group owns the selection, each Checkbox stays a plain control.',
    sections: [{ title: 'Example', description: 'Shown beside RadioGroup, which is its single-select counterpart.', bare: true, Content: GroupExample }],
    props: [
      { name: 'options', type: '{ value, label, hint?, disabled? }[]', description: 'The choices.' },
      { name: 'value / onValueChange', type: 'string[] / fn', description: 'Selected values.' },
      { name: 'hint / error', type: 'string', description: 'Message under the group.' },
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Layout.' },
    ],
  },

  'radio-group': {
    description:
      'Single choice from a set, as a real fieldset of radios sharing one name — which is what gives arrow-key navigation and single selection for free. The card variant is for choices that carry a description and need a larger hit target.',
    sections: [
      { title: 'Example', bare: true, Content: GroupExample },
      {
        title: 'Variants',
        stack: true,
        specimens: [
          {
            label: 'plain',
            fill: true,
            node: (
              <RadioGroup
                label="Statement frequency"
                value="monthly"
                onValueChange={() => undefined}
                orientation="horizontal"
                options={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                ]}
              />
            ),
          },
        ],
      },
    ],
    props: [
      { name: 'options', type: '{ value, label, hint?, disabled? }[]', description: 'The choices.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected value.' },
      { name: 'variant', type: "'plain' | 'card'", defaultValue: "'plain'", description: 'Bare rows, or selectable cards.' },
    ],
  },

  'range-slider': {
    description:
      'Two thumbs sharing one track, built from two overlaid native range inputs — so each thumb keeps full keyboard support and reports its own value with the correct bounds. A single custom-drawn control would give up both. The thumbs cannot cross.',
    sections: [
      { title: 'Example', description: 'Drag either thumb, or focus one and use the arrow keys.', bare: true, Content: RangeSliderExample },
      {
        title: 'States',
        stack: true,
        specimens: [
          { label: 'full range', fill: true, node: <div className="w-full max-w-[300px]"><RangeSlider value={[0, 100]} onValueChange={() => undefined} /></div> },
          { label: 'narrow', fill: true, node: <div className="w-full max-w-[300px]"><RangeSlider value={[45, 55]} onValueChange={() => undefined} /></div> },
          { label: 'disabled', fill: true, node: <div className="w-full max-w-[300px]"><RangeSlider value={[20, 70]} onValueChange={() => undefined} disabled /></div> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: '[number, number] / fn', description: 'Low and high.' },
      { name: 'min / max / step', type: 'number', description: 'Bounds and increment.' },
      { name: 'labels', type: '[string, string]', defaultValue: "['Minimum', 'Maximum']", description: 'Accessible names for the two thumbs.' },
    ],
  },

  rating: {
    description:
      'A star scale. Interactive ratings are a real radio group, so arrow keys work and the value is announced; read-only ratings collapse to a single image with a text alternative rather than five separate controls a screen reader has to walk through.',
    sections: [
      { title: 'Example', bare: true, Content: RatingExample },
      {
        title: 'Sizes',
        specimens: [
          { label: 'sm', node: <Rating value={3} readOnly size="sm" label="Small" /> },
          { label: 'md', node: <Rating value={3} readOnly size="md" label="Medium" /> },
          { label: 'lg', node: <Rating value={3} readOnly size="lg" label="Large" /> },
          { label: 'max={10}', node: <Rating value={7} readOnly max={10} size="sm" label="Out of ten" /> },
        ],
      },
    ],
    props: [
      { name: 'value / onValueChange', type: 'number / fn', description: 'Current rating.' },
      { name: 'max', type: 'number', defaultValue: '5', description: 'Number of stars.' },
      { name: 'readOnly', type: 'boolean', defaultValue: 'false', description: 'Display only, as one labelled image.' },
    ],
  },

  select: {
    description:
      'Single choice from a list with listbox semantics: the trigger reports the expanded state, the panel is a listbox, and arrows, Home, End, Enter and Escape all behave as a native select would. A native select is still better on touch — this exists because the design needs a flag and a label in the trigger, which a native select cannot render.',
    sections: [
      { title: 'Example', bare: true, Content: SelectExample },
      {
        title: 'States',
        specimens: [
          { label: 'invalid', node: <Select options={CATEGORY_OPTIONS} value="bills" onValueChange={() => undefined} label="Invalid" invalid /> },
          { label: 'disabled', node: <Select options={CATEGORY_OPTIONS} value="bills" onValueChange={() => undefined} label="Disabled" disabled /> },
          { label: 'sm', node: <Select options={CATEGORY_OPTIONS} value="bills" onValueChange={() => undefined} label="Small" size="sm" /> },
        ],
      },
    ],
    props: [
      { name: 'options', type: 'SelectOption[]', description: 'value, label, and optional leading node and hint.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Selected value.' },
      { name: 'variant', type: "'field' | 'pill'", defaultValue: "'field'", description: 'Bordered field, or the lifted pill the currency pickers use.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', description: 'Where the panel opens.' },
    ],
  },

  'multi-select': {
    description:
      'Choose several values from a list. The panel stays open while selecting, since closing after each pick makes choosing four things cost four openings. Options are checkboxes rather than multi-select listbox options — the checkbox state is what makes it obvious more than one can be chosen.',
    sections: [{ title: 'Example', bare: true, Content: MultiSelectExample }],
    props: [
      { name: 'options / value / onValueChange', type: 'SelectOption[] / string[] / fn', description: 'Choices and selection.' },
      { name: 'showChips', type: 'boolean', defaultValue: 'true', description: 'Removable Chips under the trigger.' },
      { name: 'placeholder', type: 'string', defaultValue: "'Select'", description: 'Trigger text when nothing is chosen.' },
    ],
  },

  combobox: {
    description:
      'A Select the user can type into. Filtering is a plain case-insensitive substring match — predictable, and needing no configuration; anything cleverer belongs to the application supplying the options. It follows the editable-combobox pattern, tracking the active option with aria-activedescendant while focus stays in the input.',
    sections: [{ title: 'Example', description: 'Type to filter, arrow to move, Enter to choose, Escape to close.', bare: true, Content: ComboboxExample }],
    props: [
      { name: 'options / value / onValueChange', type: 'SelectOption[] / string | null / fn', description: 'Choices and selection.' },
      { name: 'emptyMessage', type: 'string', defaultValue: "'No matches'", description: 'Shown when the query matches nothing.' },
    ],
  },

  'amount-field': {
    description:
      'The Exchange Money field: a label, a large amount on a filled surface, and a currency picker on the right. The value is a string on purpose — parsing to a number on every keystroke destroys a half-typed decimal, so the caller parses when it needs a number.',
    sections: [
      { title: 'Example', description: 'Edit the top amount; the converted side is read-only.', bare: true, Content: AmountFieldExample },
    ],
    props: [
      { name: 'value / onValueChange', type: 'string / fn', description: 'Raw text, so partial input survives.' },
      { name: 'currency / onCurrencyChange / currencies', type: 'string / fn / CurrencyOption[]', description: 'The picker. Omit onCurrencyChange to hide it.' },
      { name: 'readOnly', type: 'boolean', defaultValue: 'false', description: 'Render the amount as text — the converted side.' },
    ],
  },

}
