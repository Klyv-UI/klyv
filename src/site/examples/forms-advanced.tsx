import { useRef, useState } from 'react'
import { Bold, Italic, Link2, MessageSquarePlus } from 'lucide-react'
import {
  AddressInput,
  AvatarUpload,
  CascadeSelect,
  ColorSwatchPicker,
  DateTimePicker,
  DurationInput,
  Field,
  Input,
  MarkdownEditor,
  RepeaterField,
  SelectionToolbar,
  Text,
  TreeSelect,
  type AddressInputSuggestion,
  type AddressInputValue,
  type CascadeSelectOption,
  type ColorSwatchPickerSwatch,
  type TreeSelectNode,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/* ------------------------------------------------------- date time picker */

function DateTimeExample() {
  const [value, setValue] = useState<Date | null>(new Date(2026, 9, 14, 15, 30))
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      <Field label="Maintenance window starts" hint="Type it, or open the calendar.">
        <DateTimePicker
          label="Maintenance window starts"
          value={value}
          onValueChange={setValue}
          min={new Date(2026, 8, 1, 8, 0)}
          max={new Date(2026, 11, 31, 18, 0)}
          timeZoneLabel="Europe/London"
          step={15}
        />
      </Field>
      <Readout label="value" value={value ? value.toString().slice(0, 21) : ''} />
    </div>
  )
}

/* --------------------------------------------------------- duration input */

const asText = (seconds: number) => `${seconds}s (${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s)`

function DurationExample() {
  const [estimate, setEstimate] = useState(5400)
  const [timeout, setTimeoutValue] = useState(95)
  return (
    <div className="flex w-full flex-col gap-5 sm:flex-row">
      <div className="flex flex-col gap-2">
        <Field label="Time estimate" hint="Try typing 2h 15m, or paste 1:45.">
          <DurationInput label="Time estimate" value={estimate} onValueChange={setEstimate} max={40 * 3600} />
        </Field>
        <Readout label="value" value={asText(estimate)} />
      </div>
      <div className="flex flex-col gap-2">
        <Field label="Request timeout" hint="Between 10 seconds and 5 minutes.">
          <DurationInput label="Request timeout" showSeconds value={timeout} onValueChange={setTimeoutValue} min={10} max={300} />
        </Field>
        <Readout label="value" value={asText(timeout)} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- address input */

const STREETS: AddressInputSuggestion[] = [
  { id: 'a', label: '221B Baker Street', description: 'London NW1 6XE', address: { line1: '221B Baker Street', city: 'London', postalCode: 'NW1 6XE', country: 'GB' } },
  { id: 'b', label: '10 Downing Street', description: 'London SW1A 2AA', address: { line1: '10 Downing Street', city: 'London', postalCode: 'SW1A 2AA', country: 'GB' } },
  { id: 'c', label: '1 Infinite Loop', description: 'Cupertino, CA 95014', address: { line1: '1 Infinite Loop', city: 'Cupertino', region: 'CA', postalCode: '95014', country: 'US' } },
  { id: 'd', label: '350 Fifth Avenue', description: 'New York, NY 10118', address: { line1: '350 Fifth Avenue', city: 'New York', region: 'NY', postalCode: '10118', country: 'US' } },
]

function AddressExample() {
  const [value, setValue] = useState<AddressInputValue>({ line1: '', line2: '', city: '', region: '', postalCode: '', country: 'GB' })
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <AddressInput
        label="Shipping address"
        name="shipping"
        required
        value={value}
        onValueChange={setValue}
        onSuggest={async (query) => STREETS.filter((street) => street.label.toLowerCase().includes(query.toLowerCase()))}
      />
      <Readout label="value" value={JSON.stringify(value)} />
    </div>
  )
}

/* ------------------------------------------------------------ tree select */

const ORG: TreeSelectNode[] = [
  {
    id: 'eng',
    label: 'Engineering',
    children: [
      { id: 'platform', label: 'Platform', children: [{ id: 'infra', label: 'Infrastructure' }, { id: 'data', label: 'Data' }, { id: 'sre', label: 'Reliability' }] },
      { id: 'product-eng', label: 'Product engineering', children: [{ id: 'web', label: 'Web' }, { id: 'mobile', label: 'Mobile' }] },
      { id: 'security', label: 'Security', disabled: true },
    ],
  },
  { id: 'design', label: 'Design', children: [{ id: 'brand', label: 'Brand' }, { id: 'product-design', label: 'Product design' }, { id: 'research', label: 'Research' }] },
  { id: 'gtm', label: 'Go to market', children: [{ id: 'sales', label: 'Sales' }, { id: 'marketing', label: 'Marketing' }, { id: 'support', label: 'Support' }] },
]

function TreeSelectExample() {
  const [teams, setTeams] = useState(['infra', 'data', 'web'])
  const [owner, setOwner] = useState<string[]>(['platform'])
  return (
    <div className="flex w-full flex-col gap-5 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Field label="Notify teams">
          <TreeSelect label="Notify teams" nodes={ORG} multiple value={teams} onValueChange={setTeams} defaultExpanded={['eng', 'platform']} />
        </Field>
        <Readout label="value" value={teams.join(', ')} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Field label="Owning team">
          <TreeSelect label="Owning team" nodes={ORG} value={owner} onValueChange={setOwner} defaultExpanded={['eng']} />
        </Field>
        <Readout label="value" value={owner.join(', ')} />
      </div>
    </div>
  )
}

/* --------------------------------------------------------- cascade select */

const PLACES: CascadeSelectOption[] = [
  {
    value: 'us',
    label: 'United States',
    children: [
      { value: 'ca', label: 'California', children: [{ value: 'sf', label: 'San Francisco', isLeaf: true }, { value: 'la', label: 'Los Angeles', isLeaf: true }, { value: 'sd', label: 'San Diego', isLeaf: true }] },
      { value: 'ny', label: 'New York', children: [{ value: 'nyc', label: 'New York City', isLeaf: true }, { value: 'buf', label: 'Buffalo', isLeaf: true }] },
      { value: 'tx', label: 'Texas', children: [{ value: 'aus', label: 'Austin', isLeaf: true }, { value: 'hou', label: 'Houston', isLeaf: true }] },
    ],
  },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'in', label: 'India' },
  { value: 'aq', label: 'Antarctica', disabled: true },
]

const REMOTE: Record<string, CascadeSelectOption[]> = {
  gb: [
    { value: 'eng', label: 'England' },
    { value: 'sct', label: 'Scotland' },
  ],
  eng: [{ value: 'ldn', label: 'London', isLeaf: true }, { value: 'mcr', label: 'Manchester', isLeaf: true }],
  sct: [{ value: 'edi', label: 'Edinburgh', isLeaf: true }, { value: 'gla', label: 'Glasgow', isLeaf: true }],
  in: [{ value: 'ka', label: 'Karnataka' }, { value: 'mh', label: 'Maharashtra' }],
  ka: [{ value: 'blr', label: 'Bengaluru', isLeaf: true }],
  mh: [{ value: 'bom', label: 'Mumbai', isLeaf: true }, { value: 'pnq', label: 'Pune', isLeaf: true }],
}

function CascadeExample() {
  const [value, setValue] = useState(['us', 'ca', 'sf'])
  const [region, setRegion] = useState<string[]>([])
  return (
    <div className="flex w-full flex-col gap-5 sm:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Field label="Office" hint="United Kingdom and India load their regions on demand.">
          <CascadeSelect
            label="Office"
            options={PLACES}
            value={value}
            onValueChange={(next) => setValue(next)}
            loadChildren={(option) =>
              new Promise((resolve) => setTimeout(() => resolve(REMOTE[option.value] ?? []), 600))
            }
          />
        </Field>
        <Readout label="value" value={value.join(' → ')} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Field label="Sales region" hint="Any level can be chosen.">
          <CascadeSelect label="Sales region" options={PLACES} value={region} onValueChange={setRegion} allowParentSelection placeholder="Whole world" />
        </Field>
        <Readout label="value" value={region.join(' → ')} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------- color swatch picker */

const LABEL_COLOURS: ColorSwatchPickerSwatch[] = [
  { value: '#e5484d', name: 'Tomato' },
  { value: '#f76b15', name: 'Tangerine' },
  { value: '#ffe629', name: 'Lemon' },
  { value: '#c8f24e', name: 'Lime' },
  { value: '#30a46c', name: 'Jade' },
  { value: '#0090ff', name: 'Sky' },
  { value: '#1b2a4a', name: 'Navy' },
  { value: '#8e4ec6', name: 'Violet' },
  { value: '#f2f2ef', name: 'Chalk' },
  { value: '#6b6f73', name: 'Slate', disabled: true },
]

function SwatchExample() {
  const [colour, setColour] = useState('#0090ff')
  return (
    <div className="flex w-full flex-col gap-3">
      <ColorSwatchPicker label="Label colour" swatches={LABEL_COLOURS} value={colour} onValueChange={setColour} allowCustom />
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-full" style={{ background: colour }} />
        <Readout label="value" value={colour} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------- markdown editor */

const NOTE = `## Release 4.2

The importer now handles **CSV files over 1 GB** without timing out.

- Streams rows instead of loading the file
- Reports progress every _10,000_ rows
- Skips rows with \`#N/A\` and lists them afterwards

> Raw HTML such as <script>alert(1)</script> is shown as text.

Read the [migration guide](https://example.com/guide) — and note that [this link](javascript:alert(1)) is not a link.`

function MarkdownExample() {
  const [value, setValue] = useState(NOTE)
  return (
    <div className="flex w-full flex-col gap-3">
      <Field label="Release notes" hint="Select text and press Ctrl+B, Ctrl+I or Ctrl+K.">
        <MarkdownEditor label="Release notes" value={value} onValueChange={setValue} rows={10} />
      </Field>
      <Readout label="characters" value={String(value.length)} />
    </div>
  )
}

/* ---------------------------------------------------------- avatar upload */

function AvatarExample() {
  const [log, setLog] = useState('')
  return (
    <div className="flex w-full flex-col gap-6">
      <AvatarUpload
        name="Priya Raman"
        onChange={(file) => setLog(file ? `${file.name}, ${Math.round(file.size / 1024)} KB` : 'removed')}
      />
      <AvatarUpload name="Tomás Ortega" crop size={72} maxSize={2 * 1024 * 1024} onChange={(file) => setLog(file ? `cropped ${file.name}, ${Math.round(file.size / 1024)} KB` : 'removed')} />
      <Readout label="last change" value={log} />
    </div>
  )
}

/* ---------------------------------------------------------- repeater field */

interface Contact {
  name: string
  email: string
}

function RepeaterExample() {
  const [contacts, setContacts] = useState<Contact[]>([
    { name: 'Ada Lovelace', email: 'ada@analytical.co' },
    { name: 'Grace Hopper', email: 'grace@cobol.dev' },
  ])
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <RepeaterField
        label="Billing contacts"
        itemLabel="contact"
        min={1}
        max={5}
        value={contacts}
        onValueChange={setContacts}
        createRow={() => ({ name: '', email: '' })}
        renderRow={(row, { update, idPrefix }) => (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Name">
              <Input id={`${idPrefix}-name`} inputSize="sm" autoComplete="name" value={row.name} onChange={(event) => update({ name: event.target.value })} />
            </Field>
            <Field label="Email">
              <Input id={`${idPrefix}-email`} inputSize="sm" type="email" autoComplete="email" value={row.email} onChange={(event) => update({ email: event.target.value })} />
            </Field>
          </div>
        )}
      />
      <Readout label="value" value={contacts.map((contact) => contact.email || '(blank)').join(', ')} />
    </div>
  )
}

/* ------------------------------------------------------- selection toolbar */

function SelectionExample() {
  const editorRef = useRef<HTMLDivElement>(null)
  const [comments, setComments] = useState<string[]>([])
  const format = (command: string, restore: () => void, argument?: string) => {
    editorRef.current?.focus()
    restore()
    document.execCommand(command, false, argument)
  }
  return (
    <div className="flex w-full flex-col gap-3">
      <SelectionToolbar
        actions={[
          { id: 'bold', label: 'Bold', icon: Bold, shortcut: 'Ctrl+B', onSelect: ({ restore }) => format('bold', restore) },
          { id: 'italic', label: 'Italic', icon: Italic, shortcut: 'Ctrl+I', onSelect: ({ restore }) => format('italic', restore) },
          { id: 'link', label: 'Link', icon: Link2, onSelect: ({ restore }) => format('createLink', restore, 'https://example.com') },
          { id: 'comment', label: 'Comment', icon: MessageSquarePlus, onSelect: ({ text }) => setComments((current) => [...current, text]) },
        ]}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Proposal draft"
          className="rounded-[var(--radius-field)] border border-line bg-surface px-4 py-3 text-[13px] font-medium leading-relaxed text-ink"
        >
          <p>
            We propose moving the nightly export to a streaming job. Select any words in this paragraph and a toolbar
            appears above them; press Alt+F10 to move into it from the keyboard, and Escape to come back.
          </p>
          <p className="mt-2">The change removes the two-hour window in which dashboards show yesterday’s numbers.</p>
        </div>
      </SelectionToolbar>
      <Readout label="comments on" value={comments.map((comment) => `“${comment}”`).join(', ')} />
    </div>
  )
}

function SelectionStatic() {
  return (
    <SelectionToolbar actions={[{ id: 'quote', label: 'Quote', onSelect: ({ text }) => void navigator.clipboard?.writeText(`> ${text}`) }]} label="Quoting">
      <Text size="body" weight="medium" tone="soft" leading="normal">
        In read-only text the toolbar works the same way: select this sentence to copy it as a quote.
      </Text>
    </SelectionToolbar>
  )
}

/* ----------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'date-time-picker': {
    description:
      'One field for a moment in time. It takes typed text in one unambiguous shape, YYYY-MM-DD HH:mm, and the button beside it opens the library’s Calendar and TimePicker together. The value is a Date, limits apply to the whole moment rather than the day alone, and the time zone the value is read in is shown beside the field and read out with it.',
    sections: [
      { title: 'Example', description: 'Type a new time and press Enter, or open the calendar. The limits run from 1 September to 31 December, 18:00.', bare: true, Content: DateTimeExample },
      {
        title: 'States',
        specimens: [
          { label: 'empty', node: <DateTimePicker label="Starts, empty" className="w-[300px]" /> },
          { label: 'timeZoneLabel', node: <DateTimePicker label="Starts, with zone" defaultValue={new Date(2026, 10, 3, 9, 0)} timeZoneLabel="UTC" className="w-[300px]" /> },
          { label: 'disabled', node: <DateTimePicker label="Starts, disabled" disabled defaultValue={new Date(2026, 10, 3, 9, 0)} className="w-[300px]" /> },
        ],
      },
      rationale(
        'A date picker and a separate time picker leave the caller to stitch two strings into one moment, and neither says which zone it means.',
        'People paste times from tickets and invites, so typing has to work; the grid and the list are still one click away for everyone else.',
        'Scheduling a maintenance window, a publish time, a reminder, a report run.',
        ['Calendar', 'TimePicker', 'Popover', 'Input', 'Button'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'Date | null', description: 'The moment. null is an empty field.' },
      { name: 'onValueChange', type: '(value: Date | null) => void', description: 'After a valid commit: Enter, blur, or a pick.' },
      { name: 'label', type: 'string', description: 'Names the field and the panel.' },
      { name: 'min / max', type: 'Date', description: 'Whole-moment limits. Out-of-range text is refused with a message.' },
      { name: 'step', type: '15 | 30 | 60', defaultValue: '30', description: 'Minutes between listed times. Any minute can be typed.' },
      { name: 'timeZoneLabel', type: 'string', description: 'Shown beside the field and in the panel.' },
      { name: 'placeholder', type: 'string', defaultValue: "'YYYY-MM-DD HH:mm'", description: 'Shown while empty.' },
      { name: 'invalid / disabled', type: 'boolean', description: 'Field forwards these.' },
      { name: 'id', type: 'string', description: 'Goes on the text input.' },
    ],
  },

  'duration-input': {
    description:
      'A length of time as hours, minutes and optional seconds, stored as one number of seconds. Each segment is a spinbutton: arrows step and carry into the next unit, Shift steps by fifteen, Home and End jump to the limits. Typing a unit letter moves on, so “1h 30m” types straight through, and pasting “1:45” or “2h 15m” fills every segment at once. Limits apply when a value is committed, never mid-word.',
    sections: [
      { title: 'Example', bare: true, Content: DurationExample },
      {
        title: 'States',
        specimens: [
          { label: 'default', node: <DurationInput label="Duration" defaultValue={2700} /> },
          { label: 'showSeconds', node: <DurationInput label="Duration with seconds" showSeconds defaultValue={3725} /> },
          { label: 'invalid', node: <DurationInput label="Duration, invalid" invalid defaultValue={0} /> },
          { label: 'disabled', node: <DurationInput label="Duration, disabled" disabled defaultValue={900} /> },
        ],
      },
      rationale(
        'Durations collected as “minutes” in a number box end up as 90 in one place and 1.5 in another, and two boxes let 75 minutes sit unnormalised.',
        'Segments keep the value readable and nudgeable, and one integer of seconds is the only shape every consumer agrees on.',
        'Time estimates, timeouts and retry delays, video trims, SLA targets.',
        ['input role=spinbutton', 'Field conventions'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'number', defaultValue: '0', description: 'Total seconds.' },
      { name: 'onValueChange', type: '(seconds: number) => void', description: 'On arrow keys, paste, Enter and leaving the control.' },
      { name: 'label', type: 'string', description: 'Names the group.' },
      { name: 'showSeconds', type: 'boolean', defaultValue: 'false', description: 'Adds the seconds segment.' },
      { name: 'min / max', type: 'number', defaultValue: '0 / —', description: 'Seconds. Commits are clamped to these.' },
      { name: 'invalid / disabled', type: 'boolean', description: 'Field forwards these.' },
      { name: 'id', type: 'string', description: 'Goes on the hours segment.' },
    ],
  },

  'address-input': {
    description:
      'A postal address as its parts, each with the autocomplete token browsers fill from. Changing the country relabels the region and postal code — State and ZIP code, County and Postcode, Province, Eircode — and drops the region where a country has none. Pass onSuggest and the first line becomes a combobox fed by your own address provider; choosing a suggestion fills the rest.',
    sections: [
      { title: 'Example', description: 'Type “street” or “avenue” for suggestions, or change the country to see the labels follow.', bare: true, Content: AddressExample },
      {
        title: 'Countries',
        specimens: [
          { label: 'US', fill: true, node: <AddressInput label="US address" hideLabel defaultValue={{ country: 'US' }} className="w-full" /> },
          { label: 'DE — no region', fill: true, node: <AddressInput label="German address" hideLabel defaultValue={{ country: 'DE' }} className="w-full" /> },
        ],
      },
      rationale(
        'One address textarea cannot be autofilled, validated or geocoded, and US-only labels tell everyone else the form was not built for them.',
        'Standard autocomplete tokens make most addresses a single tap; local labels cost a lookup table, not a dependency.',
        'Checkout and shipping, billing details, company profiles, event venues.',
        ['Field', 'Input', 'native select', 'listbox'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'AddressInputValue', description: '{ line1, line2, city, region, postalCode, country }.' },
      { name: 'onValueChange', type: '(value: AddressInputValue) => void', description: 'Every edit.' },
      { name: 'label', type: 'string', description: 'Legend of the fieldset.' },
      { name: 'countries', type: 'AddressInputCountry[]', defaultValue: 'ADDRESS_INPUT_COUNTRIES', description: '{ code, name, regionLabel?, postalLabel?, postalHint? }.' },
      { name: 'defaultCountry', type: 'string', defaultValue: "'US'", description: 'Used when the value names none.' },
      { name: 'onSuggest', type: '(query, country) => AddressInputSuggestion[] | Promise<…>', description: 'Called from three characters, debounced.' },
      { name: 'name', type: 'string', description: 'Prefix for input names and the autocomplete section.' },
      { name: 'required / disabled / hideLabel', type: 'boolean', description: 'Applied across the fields.' },
    ],
  },

  'tree-select': {
    description:
      'A select whose options are a hierarchy, kept as a tree inside a popover. The tree has the full WAI-ARIA keyboard model, and the filter reveals the branches a match sits in rather than listing it out of context. In multiple mode a parent checks all its enabled leaves and shows a mixed box when only some are; the value holds leaves only, and the trigger shows them as chips.',
    sections: [
      { title: 'Example', description: 'Open either control, type “de” in the filter, then use the arrow keys.', bare: true, Content: TreeSelectExample },
      {
        title: 'States',
        specimens: [
          { label: 'empty', node: <TreeSelect label="Team, empty" nodes={ORG} /> },
          { label: 'many chips', node: <TreeSelect label="Teams, many" nodes={ORG} multiple defaultValue={['infra', 'data', 'sre', 'web', 'mobile']} maxChips={2} /> },
          { label: 'disabled', node: <TreeSelect label="Team, disabled" nodes={ORG} disabled defaultValue={['brand']} /> },
        ],
      },
      rationale(
        'Flattening a hierarchy into a long select loses where each option lives, and that is what people use to find it.',
        'A tree in a popover keeps the structure without a page of space, and tri-state parents make “the whole department” one action.',
        'Assigning teams, choosing categories, scoping permissions, picking folders.',
        ['Popover', 'Input', 'tree', 'Checkbox styling'],
      ),
    ],
    props: [
      { name: 'nodes', type: 'TreeSelectNode[]', description: '{ id, label, disabled?, children? }.' },
      { name: 'value / defaultValue', type: 'string[]', defaultValue: '[]', description: 'Chosen ids. Leaves only in multiple mode.' },
      { name: 'onValueChange', type: '(value: string[]) => void', description: 'Ids in tree order.' },
      { name: 'multiple', type: 'boolean', defaultValue: 'false', description: 'Tri-state checkboxes and chips.' },
      { name: 'label', type: 'string', description: 'Names the trigger and the tree.' },
      { name: 'searchable', type: 'boolean', defaultValue: 'true', description: 'Filter above the tree.' },
      { name: 'maxChips', type: 'number', defaultValue: '3', description: 'Chips before “+N”.' },
      { name: 'defaultExpanded', type: 'string[]', description: 'Branches open at first.' },
      { name: 'placeholder / invalid / disabled / id', type: '…', description: 'As on Select.' },
    ],
  },

  'cascade-select': {
    description:
      'Cascading columns for a path through a hierarchy — country, region, city — in a popover. Pointing at an option opens the next column; from the keyboard Up and Down move, Right steps in, Left steps back and Enter chooses. Each column is a listbox. Children can be loaded on demand, with a spinner while they arrive and each branch fetched once, and the chosen path is written on the trigger.',
    sections: [
      { title: 'Example', bare: true, Content: CascadeExample },
      {
        title: 'States',
        specimens: [
          { label: 'empty', node: <CascadeSelect label="Location, empty" options={PLACES} /> },
          { label: 'separator', node: <CascadeSelect label="Location, arrows" options={PLACES} defaultValue={['us', 'ny', 'nyc']} separator=" › " /> },
          { label: 'disabled', node: <CascadeSelect label="Location, disabled" options={PLACES} disabled defaultValue={['us', 'tx', 'aus']} /> },
        ],
      },
      rationale(
        'Chained selects make people open and close three controls and reset silently when an early choice changes.',
        'Columns keep the whole path in view and one keystroke apart, and a loader means the tree never has to be shipped whole.',
        'Locations, product categories, org units, file paths.',
        ['Popover', 'listbox', 'Spinner'],
      ),
    ],
    props: [
      { name: 'options', type: 'CascadeSelectOption[]', description: '{ value, label, children?, isLeaf?, disabled? }.' },
      { name: 'value / defaultValue', type: 'string[]', defaultValue: '[]', description: 'The path, first column first.' },
      { name: 'onValueChange', type: '(value: string[], options: CascadeSelectOption[]) => void', description: 'With the options along the path.' },
      { name: 'loadChildren', type: '(option, path) => Promise<CascadeSelectOption[]>', description: 'For options without children. Empty means leaf.' },
      { name: 'label', type: 'string', description: 'Names the trigger and first column.' },
      { name: 'separator', type: 'string', defaultValue: "' / '", description: 'Between path labels on the trigger.' },
      { name: 'allowParentSelection', type: 'boolean', defaultValue: 'false', description: 'Enter or click on a parent chooses it.' },
      { name: 'placeholder / invalid / disabled / id', type: '…', description: 'As on Select.' },
    ],
  },

  'color-swatch-picker': {
    description:
      'One colour from a named palette, as a radio group: one tab stop, arrows move and choose, and each swatch is announced by its name. The tick on the chosen swatch takes black or white ink from that colour’s contrast, so it reads on Lemon and Navy alike. The palette is data passed in — the component holds no colours — and a native colour input can be offered after it.',
    sections: [
      { title: 'Example', bare: true, Content: SwatchExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'size="sm", columns={5}', node: <ColorSwatchPicker label="Calendar colour" size="sm" columns={5} swatches={LABEL_COLOURS} defaultValue="#ffe629" /> },
          { label: 'showName={false}', node: <ColorSwatchPicker label="Tag colour" showName={false} swatches={LABEL_COLOURS.slice(0, 5)} defaultValue="#c8f24e" /> },
          { label: 'disabled', node: <ColorSwatchPicker label="Locked colour" disabled swatches={LABEL_COLOURS.slice(4, 8)} defaultValue="#1b2a4a" /> },
        ],
      },
      rationale(
        'A free colour picker invites colours that fail in dark mode, and a row of unlabelled circles is silent to a screen reader.',
        'A radio group is the native model for one-of-many, names make it audible, and computed ink keeps the tick visible on any swatch.',
        'Label and tag colours, calendar colours, workspace and project accents.',
        ['radiogroup', 'readableInk', 'input type=color'],
      ),
    ],
    props: [
      { name: 'swatches', type: 'ColorSwatchPickerSwatch[]', description: '{ value, name, disabled? }. Hex values get contrast-aware ink.' },
      { name: 'value / defaultValue', type: 'string', description: 'The colour value.' },
      { name: 'onValueChange', type: '(value: string, swatch?: ColorSwatchPickerSwatch) => void', description: 'swatch is undefined for a custom colour.' },
      { name: 'label', type: 'string', description: 'Names the radio group.' },
      { name: 'allowCustom', type: 'boolean', defaultValue: 'false', description: 'Adds a native colour input.' },
      { name: 'customLabel', type: 'string', defaultValue: "'Custom colour'", description: 'Its name.' },
      { name: 'showName', type: 'boolean', defaultValue: 'true', description: 'The chosen name under the swatches.' },
      { name: 'columns', type: 'number', description: 'Grid columns; Up and Down move by a row.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: '24px or 32px.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks the whole group.' },
    ],
  },

  'markdown-editor': {
    description:
      'A Markdown textarea with a formatting toolbar and a preview tab. Buttons and Ctrl or ⌘ with B, I and K wrap the selection, select what is left to type, and unwrap on a second press; edits go through the browser’s undo where it allows. The preview is built as React elements by a small parser, never as an HTML string: raw HTML shows as text, and only http, https, mailto and relative links become links.',
    sections: [
      { title: 'Example', description: 'The sample includes a script tag and a javascript: link — open Preview to see both rendered inert.', bare: true, Content: MarkdownExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'actions subset', fill: true, node: <MarkdownEditor label="Comment" actions={['bold', 'italic', 'link']} rows={3} defaultValue="Looks good — **ship it**." /> },
          { label: 'disabled', fill: true, node: <MarkdownEditor label="Locked note" disabled rows={3} defaultValue="Archived notes cannot be edited." /> },
        ],
      },
      rationale(
        'A bare textarea makes everyone remember the syntax, and a rich-text editor is a heavy dependency that stores something nobody can diff.',
        'Syntax-wrapping buttons teach Markdown as they go, and a renderer that never builds HTML strings has nothing to sanitise.',
        'Release notes, issue and PR descriptions, comments, knowledge-base articles.',
        ['Tabs', 'toolbar', 'textarea'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', defaultValue: "''", description: 'Markdown source.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Every edit.' },
      { name: 'label', type: 'string', description: 'Names the textarea.' },
      { name: 'actions', type: 'MarkdownEditorAction[]', defaultValue: 'all seven', description: "'heading' | 'bold' | 'italic' | 'link' | 'code' | 'quote' | 'list'." },
      { name: 'rows', type: 'number', defaultValue: '8', description: 'Visible lines.' },
      { name: 'headingLevel', type: '2 | 3 | 4', defaultValue: '3', description: 'HTML level of a # heading in the preview.' },
      { name: 'placeholder / invalid / disabled / id', type: '…', description: 'As on Textarea.' },
    ],
  },

  'avatar-upload': {
    description:
      'A profile photo where the avatar itself is the button: click it, or drop an image on it. Type and size are checked first and the reason is given in words. The preview comes from an object URL that is revoked when replaced. With crop, a square Cropper frames the photo first; an async onChange shows progress, and a failure restores the previous photo with its message.',
    sections: [
      { title: 'Example', description: 'The second avatar asks for a crop and accepts up to 2 MB.', bare: true, Content: AvatarExample },
      {
        title: 'States',
        specimens: [
          { label: 'initials', node: <AvatarUpload name="Mina Okafor" size={64} /> },
          { label: 'removable={false}', node: <AvatarUpload name="Kai Lindqvist" size={64} removable={false} /> },
          { label: 'disabled', node: <AvatarUpload name="Jo Park" size={64} disabled /> },
        ],
      },
      rationale(
        'A file input beside a picture leaves people guessing which one to click, and failed uploads usually fail silently.',
        'Making the picture the target, with drop, Remove and a stated rule beside it, covers every way people try to change a photo.',
        'Profile and account settings, team member pages, workspace logos.',
        ['Button', 'Cropper', 'Spinner', 'input type=file'],
      ),
    ],
    props: [
      { name: 'src', type: 'string', description: 'The current avatar.' },
      { name: 'name', type: 'string', description: 'Initials and accessible names.' },
      { name: 'onChange', type: '(file: File | null) => void | Promise<void>', description: 'Return a promise to show progress; reject to revert.' },
      { name: 'accept', type: 'string', defaultValue: "'image/png,image/jpeg,image/webp,image/gif'", description: 'Also drives the stated rule.' },
      { name: 'maxSize', type: 'number', defaultValue: '5 MB', description: 'Bytes.' },
      { name: 'crop', type: 'boolean', defaultValue: 'false', description: 'Square crop step before onChange.' },
      { name: 'size', type: 'number', defaultValue: '96', description: 'Diameter in pixels.' },
      { name: 'removable', type: 'boolean', defaultValue: 'true', description: 'Show Remove when there is a photo.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks interaction.' },
    ],
  },

  'repeater-field': {
    description:
      'A repeating group of fields with add, remove and move up and down. Focus is handled for every change: a new row focuses its first field, a removed row hands focus to the one that took its place, and a moved row keeps focus on the button that moved it. Each change is announced, min and max disable the buttons at the limits, and rows keep stable keys and id prefixes so labels and half-typed text move with them.',
    sections: [
      { title: 'Example', description: 'At least one contact, at most five.', bare: true, Content: RepeaterExample },
      rationale(
        'Dynamic lists are where forms lose focus: delete a row and the next Tab starts from the top of the page.',
        'Deciding the focus target for each operation, and saying what happened, makes the list usable without seeing it.',
        'Billing contacts, redirect URIs, line items, environment variables, answer options in a survey builder.',
        ['Field', 'Input', 'IconButton', 'Button', 'live region'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'T[]', description: 'The rows.' },
      { name: 'onValueChange', type: '(rows: T[]) => void', description: 'After every add, edit, move and removal.' },
      { name: 'createRow', type: '() => T', description: 'A blank row for Add.' },
      { name: 'renderRow', type: '(row: T, { index, update, idPrefix }) => ReactNode', description: 'Use idPrefix for ids inside the row.' },
      { name: 'label', type: 'string', description: 'Legend of the fieldset.' },
      { name: 'itemLabel', type: 'string', defaultValue: "'item'", description: 'Used in button names and announcements.' },
      { name: 'min / max', type: 'number', defaultValue: '0 / —', description: 'Row limits.' },
      { name: 'addLabel', type: 'string', description: 'Text on the add button.' },
      { name: 'reorderable', type: 'boolean', defaultValue: 'true', description: 'Show move buttons.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the whole fieldset.' },
    ],
  },

  'selection-toolbar': {
    description:
      'A small toolbar that floats above selected text inside its container, placed from the selection’s own rectangle and flipped below when there is no room. It is a real toolbar: Alt+F10 moves focus into it, arrows move between buttons, and Escape hides it and returns focus. Actions come in as props and receive the selected text, the range, and a restore function for editors that lose the selection when focus moves.',
    sections: [
      { title: 'In an editor', description: 'Select some words, then use a button or Alt+F10.', bare: true, Content: SelectionExample },
      { title: 'In read-only text', bare: true, Content: SelectionStatic },
      rationale(
        'A fixed toolbar at the top of a long document is a trip away from the sentence being edited, and floating toolbars are usually unreachable without a mouse.',
        'Anchoring to the selection keeps actions where attention is; the toolbar role, a shortcut and focus return keep it usable from the keyboard.',
        'Comment-on-text in docs, inline formatting in editors, quote-and-reply in threads, highlight-to-share in articles.',
        ['Portal', 'overlay stack', 'toolbar', 'Selection API'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The content a selection is watched in.' },
      { name: 'actions', type: 'SelectionToolbarAction[]', description: '{ id, label, icon?, shortcut?, active?, disabled?, onSelect }.' },
      { name: 'label', type: 'string', defaultValue: "'Text formatting'", description: 'Names the toolbar.' },
      { name: 'shortcut', type: 'string', defaultValue: "'Alt+F10'", description: 'Moves focus into the toolbar while it shows.' },
      { name: 'closeOnAction', type: 'boolean', defaultValue: 'true', description: 'Hide after an action runs.' },
      { name: 'className', type: 'string', description: 'On the container.' },
    ],
  },
}
