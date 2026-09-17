import { useState } from 'react'
import { Building2, Link2, Rocket, Sparkles, User } from 'lucide-react'
import {
  Button,
  ChoiceCardGroup,
  CreditCardInput,
  EmojiPicker,
  Field,
  Input,
  InputGroup,
  InputGroupAddon,
  MonthPicker,
  PhoneInput,
  Popover,
  Surface,
  Text,
  TimeSlotPicker,
  TransferList,
  type CreditCardInputStatus,
  type CreditCardInputValue,
  type EmojiPickerEmoji,
  type MonthPickerRange,
  type TimeSlotPickerDay,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/* ---------------------------------------------------------------- phone */

function PhoneExample() {
  const [value, setValue] = useState('+442071838750')
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      <Field label="Mobile number" hint="We text a code to this number once.">
        <PhoneInput value={value} onValueChange={(next) => setValue(next)} defaultCountry="GB" />
      </Field>
      <Readout label="value" value={value} />
    </div>
  )
}

/* ---------------------------------------------------------- credit card */

function CardExample() {
  const [value, setValue] = useState<CreditCardInputValue>({ number: '', expiry: '', cvc: '' })
  const [status, setStatus] = useState<CreditCardInputStatus | null>(null)
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <Field label="Card" hint="Try 4242 4242 4242 4242, or 3782 822463 10005 for Amex.">
        <CreditCardInput
          value={value}
          onValueChange={(next, meta) => {
            setValue(next)
            setStatus(meta)
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Readout label="brand" value={status?.brand ?? 'unknown'} />
        <Readout label="number" value={status?.numberValid ? 'valid' : 'incomplete'} />
        <Readout label="complete" value={String(status?.complete ?? false)} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- choice cards */

function PlanExample() {
  const [plan, setPlan] = useState('team')
  const [addons, setAddons] = useState<string[]>(['sso'])
  return (
    <div className="flex w-full flex-col gap-6">
      <ChoiceCardGroup
        label="Plan"
        columns={3}
        value={plan}
        onValueChange={setPlan}
        options={[
          { value: 'solo', title: 'Solo', price: '$0', description: 'One seat, three projects.', icon: <User size={18} /> },
          { value: 'team', title: 'Team', price: '$12/seat', description: 'Unlimited projects and shared views.', icon: <Rocket size={18} /> },
          { value: 'business', title: 'Business', price: 'Talk to us', description: 'Audit log, SAML and a support SLA.', icon: <Building2 size={18} /> },
        ]}
      />
      <ChoiceCardGroup
        multiple
        label="Add-ons"
        value={addons}
        onValueChange={setAddons}
        options={[
          { value: 'sso', title: 'Single sign-on', price: '+$4/seat', description: 'Okta, Entra ID and Google Workspace.' },
          { value: 'ai', title: 'Assistant', price: '+$8/seat', description: 'Summaries and drafted replies.', icon: <Sparkles size={18} /> },
          { value: 'archive', title: 'Cold archive', description: 'Only on the Business plan.', disabled: true },
        ]}
      />
    </div>
  )
}

/* -------------------------------------------------------- transfer list */

const COLUMNS = [
  { id: 'id', label: 'Order ID', description: 'ord_…' },
  { id: 'created', label: 'Created', description: 'ISO timestamp' },
  { id: 'customer', label: 'Customer', description: 'Name and email' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total', description: 'In the order currency' },
  { id: 'tax', label: 'Tax' },
  { id: 'country', label: 'Country' },
  { id: 'channel', label: 'Sales channel' },
  { id: 'coupon', label: 'Coupon code' },
  { id: 'notes', label: 'Internal notes', description: 'Admins only', disabled: true },
]

function TransferExample() {
  const [value, setValue] = useState(['id', 'created', 'total'])
  return (
    <div className="flex w-full flex-col gap-3">
      <TransferList items={COLUMNS} value={value} onValueChange={setValue} availableLabel="Columns" selectedLabel="In export" listHeight={220} />
      <Readout label="value" value={value.join(', ')} />
    </div>
  )
}

/* --------------------------------------------------------- month picker */

const monthName = (value?: string) =>
  value ? new Date(Number(value.slice(0, 4)), Number(value.slice(5)) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : ''

function MonthExample() {
  const [month, setMonth] = useState('2026-09')
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState<MonthPickerRange>({ start: '2026-01', end: '2026-06' })
  return (
    <div className="flex w-full flex-wrap items-start gap-6">
      <Surface variant="card" padding="md" className="gap-2">
        <Text size="caption" weight="bold" tone="faint">Inline, with min and max</Text>
        <MonthPicker value={month} onValueChange={setMonth} min="2025-03" max="2027-02" label="Billing month" />
        <Readout label="value" value={month} />
      </Surface>
      <Surface variant="card" padding="md" className="gap-2">
        <Text size="caption" weight="bold" tone="faint">range</Text>
        <MonthPicker range value={period} onValueChange={setPeriod} label="Report period" />
        <Readout label="value" value={`${period.start} → ${period.end ?? '…'}`} />
      </Surface>
      <div className="flex flex-col gap-2">
        <Text size="caption" weight="bold" tone="faint">In a Popover</Text>
        <Popover
          open={open}
          onOpenChange={setOpen}
          label="Choose statement month"
          initialFocus='button[tabindex="0"]'
          trigger={<Button variant="outline">{monthName(month)}</Button>}
          className="p-3"
        >
          <MonthPicker
            value={month}
            label="Statement month"
            onValueChange={(next) => {
              setMonth(next)
              setOpen(false)
            }}
          />
        </Popover>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ time slot picker */

const DAYS: TimeSlotPickerDay[] = [
  ['2026-10-12', ['09:00', '09:30', '10:00', '11:30', '14:00', '15:30'], ['09:30', '14:00']],
  ['2026-10-13', ['09:00', '10:30', '13:00', '13:30', '16:00'], []],
  ['2026-10-14', ['09:00', '12:00'], ['09:00', '12:00']],
  ['2026-10-15', ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '15:00', '15:30', '16:00'], ['09:00', '10:30', '15:30']],
  ['2026-10-16', ['10:00', '11:00', '12:00'], ['11:00']],
].map(([date, times, taken]) => ({
  date: date as string,
  slots: (times as string[]).map((time) => ({ time, available: !(taken as string[]).includes(time) })),
}))

function SlotExample() {
  const [value, setValue] = useState('')
  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[440px] gap-3">
      <Text size="heading">Book a 30-minute demo</Text>
      <TimeSlotPicker days={DAYS} value={value} onValueChange={setValue} timeZoneLabel="Europe/London (BST)" label="Demo time" />
      <Button disabled={!value}>{value ? 'Confirm booking' : 'Pick a time'}</Button>
      <Readout label="value" value={value} />
    </Surface>
  )
}

/* ---------------------------------------------------------- input group */

function GroupExample() {
  const [currency, setCurrency] = useState('USD')
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      <Field label="Website" hint="Without the scheme.">
        <InputGroup>
          <InputGroupAddon>https://</InputGroupAddon>
          <Input placeholder="acme.com" />
        </InputGroup>
      </Field>
      <Field label="Budget">
        <InputGroup>
          <Input inputMode="decimal" placeholder="0.00" className="text-right tabular-nums" />
          <InputGroupAddon variant="control">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="bg-surface-muted px-3 font-semibold text-ink-soft"
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field label="Invite link">
        <InputGroup>
          <InputGroupAddon variant="plain">
            <Link2 size={15} aria-hidden="true" />
          </InputGroupAddon>
          <Input readOnly value="klyvui.xyz/join/7F2K" />
          <InputGroupAddon variant="control">
            <Button variant="muted" size="sm">Copy</Button>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field label="Timeout" error="Must be at most 300 seconds.">
        <InputGroup size="sm">
          <Input inputSize="sm" defaultValue="900" />
          <InputGroupAddon>seconds</InputGroupAddon>
        </InputGroup>
      </Field>
    </div>
  )
}

/* ---------------------------------------------------------- emoji picker */

function EmojiExample() {
  const [message, setMessage] = useState('Shipped the release ')
  const [last, setLast] = useState<EmojiPickerEmoji | null>(null)
  return (
    <div className="flex w-full flex-wrap items-start gap-6">
      <Surface variant="card" padding="none" className="border border-line">
        <EmojiPicker
          defaultRecent={['🎉', '👍', '🔥']}
          onSelect={(emoji) => {
            setLast(emoji)
            setMessage((text) => text + emoji.emoji)
          }}
        />
      </Surface>
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <Field label="Message">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        <Readout label="last onSelect" value={last ? `${last.emoji} ${last.name}` : ''} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- pages */

export const demos: ExampleModule = {
  'phone-input': {
    description:
      'A phone number as a dial-code select joined to a national number, stored as one E.164 string. The number formats to the country’s mask as you type and keeps the caret beside the digit just typed. The dial code is a native select, because it is the one list every platform already makes searchable and usable on touch; the closed control shows only flag and code so it stays narrow.',
    sections: [
      { title: 'Example', description: 'Change the country, then type — the mask and the E.164 value follow.', bare: true, Content: PhoneExample },
      {
        title: 'States',
        specimens: [
          { label: 'empty', node: <PhoneInput label="Phone, empty" className="w-[280px]" /> },
          { label: 'size="sm"', node: <PhoneInput label="Phone, small" size="sm" defaultValue="+14155550123" className="w-[280px]" /> },
          { label: 'invalid', node: <PhoneInput label="Phone, invalid" invalid defaultValue="+3312" className="w-[280px]" /> },
          { label: 'disabled', node: <PhoneInput label="Phone, disabled" disabled defaultValue="+819012345678" className="w-[280px]" /> },
        ],
      },
      rationale(
        'Phone fields either accept anything, and store numbers nobody can dial, or demand a format nobody can guess.',
        'Splitting country from number removes the guessing, and storing E.164 means every consumer of the value — SMS, CRM, dialler — reads the same thing.',
        'Sign-up, two-factor setup, checkout contact details, team member profiles.',
        ['native select', 'input type=tel', 'Field conventions'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'E.164, e.g. +442071838750. Empty string when blank.' },
      { name: 'onValueChange', type: '(value: string, country: PhoneInputCountry) => void', description: 'Every edit and every country change.' },
      { name: 'countries', type: 'PhoneInputCountry[]', defaultValue: 'PHONE_INPUT_COUNTRIES', description: '{ code, name, dial, format? } — # is a digit in format.' },
      { name: 'defaultCountry', type: 'string', defaultValue: "'US'", description: 'ISO code used when the value names no country.' },
      { name: 'label', type: 'string', defaultValue: "'Phone number'", description: 'Accessible name when no Field supplies an id.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: '36px or 40px.' },
      { name: 'invalid / disabled / required', type: 'boolean', description: 'Field forwards these.' },
      { name: 'name', type: 'string', description: 'Submits the E.164 value through a hidden input.' },
    ],
  },

  'credit-card-input': {
    description:
      'Card number, expiry and security code as one control, left to right the way they are read off the card. Each part stays a real input with its own cc-* autocomplete token, so autofill lands correctly. The brand is detected from the prefix and sets the grouping (Amex 4-6-5) and CVC length; a finished, Luhn-valid number moves on to expiry, and Backspace at the start of a part moves back. A number is flagged only once it is long enough to judge.',
    sections: [
      { title: 'Example', bare: true, Content: CardExample },
      {
        title: 'States',
        specimens: [
          { label: 'Amex prefilled', node: <CreditCardInput label="Amex card" defaultValue={{ number: '378282246310005', expiry: '0829', cvc: '1234' }} className="w-[380px]" /> },
          { label: 'fails Luhn', node: <CreditCardInput label="Card failing Luhn" defaultValue={{ number: '4242424242424241', expiry: '', cvc: '' }} className="w-[380px]" /> },
          { label: 'disabled', node: <CreditCardInput label="Disabled card" disabled className="w-[380px]" /> },
        ],
      },
      rationale(
        'Three separate card fields break the rhythm of typing a number off a card, and one free-text field loses autofill and per-part validation.',
        'One border with three real inputs keeps both: the reading order of the card and the semantics browsers and password managers rely on.',
        'Checkout, adding a payment method, upgrading a plan. Use your processor’s hosted fields where PCI scope matters.',
        ['input inputMode=numeric', 'autocomplete cc-*', 'live region'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'CreditCardInputValue', description: '{ number, expiry: MMYY, cvc } as digits.' },
      { name: 'onValueChange', type: '(value, status: CreditCardInputStatus) => void', description: 'status has brand, numberValid, expiryValid, cvcValid, complete.' },
      { name: 'label', type: 'string', defaultValue: "'Card details'", description: 'Name of the group.' },
      { name: 'invalid / disabled / required', type: 'boolean', description: 'Applied to all three parts.' },
      { name: 'id', type: 'string', description: 'Goes on the number input, so a Field label points at it.' },
      { name: 'now', type: 'Date', description: 'Reference date for the expiry check.' },
    ],
  },

  'choice-card-group': {
    description:
      'Radios or checkboxes drawn as cards, for choices that need a sentence or a price before anyone can make them. Underneath is a real fieldset of real inputs, so the browser supplies radio arrow keys and form submission; each input is named by its title and described by its description, so it is announced as a choice with a note rather than one run-on label.',
    sections: [
      { title: 'Example', description: 'Arrow keys move through the plans; Space toggles the add-ons.', bare: true, Content: PlanExample },
      rationale(
        'Plain radios cannot carry a price and a description without turning the label into a paragraph, and custom cards usually drop the radio semantics.',
        'Cards on top of native inputs give the visual weight the decision deserves while keeping everything a radio group does for free.',
        'Plan choice, shipping speed, workspace role, onboarding “what brings you here”.',
        ['Radio', 'Checkbox', 'fieldset'],
      ),
    ],
    props: [
      { name: 'options', type: 'ChoiceCardGroupOption[]', description: '{ value, title, description?, icon?, price?, disabled? }.' },
      { name: 'multiple', type: 'boolean', defaultValue: 'false', description: 'Checkboxes and string[] values instead of radios.' },
      { name: 'value / defaultValue', type: 'string | string[]', description: 'Controlled or starting choice.' },
      { name: 'onValueChange', type: '(value) => void', description: 'Chosen value, or every chosen value in option order.' },
      { name: 'label / hideLabel', type: 'string / boolean', description: 'Legend of the fieldset.' },
      { name: 'columns', type: '1 | 2 | 3', defaultValue: '2', description: 'Cards per row from sm up.' },
      { name: 'name / disabled / invalid', type: 'string / boolean', description: 'Form name, whole-group disable, invalid border.' },
    ],
  },

  'transfer-list': {
    description:
      'Two lists and the buttons between them, for choosing a subset of a long set where the leftovers matter too. Each list is a multi-select listbox with one tab stop: arrows move, Space marks, Shift+arrow or Shift+click extends, Ctrl+A marks all visible, Enter or double-click moves. The filter narrows without unmarking, and each move announces the new counts.',
    sections: [
      { title: 'Example', description: 'Choose the columns for a CSV export.', bare: true, Content: TransferExample },
      rationale(
        'A long checkbox list hides what was left out, and a multi-select dropdown hides what was put in.',
        'Showing both sides at once makes the choice reviewable, and the buttons make bulk moves one action.',
        'Export column pickers, group membership, permission sets, dashboard widget selection.',
        ['Input', 'listbox', 'live region'],
      ),
    ],
    props: [
      { name: 'items', type: 'TransferListItem[]', description: '{ id, label, description?, disabled? }.' },
      { name: 'value / defaultValue', type: 'string[]', description: 'Ids in the selected list.' },
      { name: 'onValueChange', type: '(value: string[]) => void', description: 'Selected ids in item order.' },
      { name: 'availableLabel / selectedLabel', type: 'string', defaultValue: "'Available' / 'Selected'", description: 'List headings, also used in the button names.' },
      { name: 'filterable', type: 'boolean', defaultValue: 'true', description: 'Filter field above each list.' },
      { name: 'listHeight', type: 'number', defaultValue: '240', description: 'Height of each list body in px.' },
    ],
  },

  'month-picker': {
    description:
      'A year of months as a 4×3 grid, for billing periods, report ranges and card expiries where a day calendar asks for precision nobody has. Arrows move by month or row and roll the year over, Home and End go to row ends, PageUp and PageDown change year. Months outside min and max stay focusable but cannot be chosen, so arrowing never jumps over a gap. Use it inline or inside a Popover.',
    sections: [
      { title: 'Example', bare: true, Content: MonthExample },
      rationale(
        'Choosing “March 2026” from a day calendar means picking an arbitrary day and hoping it is ignored.',
        'A month grid asks exactly the question being asked, with the same keyboard model as Calendar so nothing new has to be learned.',
        'Statement and invoice filters, report periods, subscription start months, date-of-expiry fields.',
        ['IconButton', 'grid', 'Popover'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string | MonthPickerRange', description: 'yyyy-mm, or { start, end? } with range.' },
      { name: 'onValueChange', type: '(value) => void', description: 'Chosen month, or the range after each press.' },
      { name: 'range', type: 'boolean', defaultValue: 'false', description: 'Two presses choose a start and an end.' },
      { name: 'min / max', type: 'string', description: 'yyyy-mm bounds.' },
      { name: 'label', type: 'string', defaultValue: "'Choose a month'", description: 'Grid name; the year is appended.' },
      { name: 'locale', type: 'string', defaultValue: "'en-US'", description: 'Month names.' },
    ],
  },

  'time-slot-picker': {
    description:
      'A booking picker: a strip of days, then that day’s times. They are two radio groups because they are two answers — the day only narrows the grid, the time is the value. Taken slots stay in place, struck through and skipped by the arrow keys, so a busy morning looks busy rather than short, and the timezone is always printed under the grid.',
    sections: [
      { title: 'Example', bare: true, Content: SlotExample },
      rationale(
        'Booking flows either show a dropdown of times, which hides availability, or a full calendar, which buries the few slots that matter.',
        'A short day strip plus a slot grid shows the shape of availability at a glance, and radio semantics make it navigable with arrows.',
        'Demo and sales call booking, appointment scheduling, delivery windows, interview slots.',
        ['radiogroup', 'Intl.DateTimeFormat'],
      ),
    ],
    props: [
      { name: 'days', type: 'TimeSlotPickerDay[]', description: '{ date: yyyy-mm-dd, slots: { time: HH:mm, available? }[] }.' },
      { name: 'value / defaultValue', type: 'string', description: 'yyyy-mm-ddTHH:mm, or empty.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Called when a slot is chosen.' },
      { name: 'timeZoneLabel', type: 'string', defaultValue: 'browser zone', description: 'Printed under the grid.' },
      { name: 'columns', type: '2 | 3 | 4', defaultValue: '3', description: 'Slots per row; ArrowUp/Down move by a row.' },
      { name: 'locale / label', type: 'string', description: 'Formats and the accessible name.' },
    ],
  },

  'input-group': {
    description:
      'Joins addons — a scheme, a currency, a unit, a button — to an Input so they share one border, radius and focus ring, and read as one answer. It is layout only: the Input keeps its behaviour and the group flattens its chrome. It is a fieldset, so disabled reaches every control inside, and what Field hands it goes on to the input, so a Field label still points at the right element.',
    sections: [
      { title: 'Example', bare: true, Content: GroupExample },
      {
        title: 'Disabled',
        specimens: [
          {
            label: 'disabled',
            node: (
              <InputGroup disabled label="Price" className="w-[260px]">
                <InputGroupAddon>$</InputGroupAddon>
                <Input aria-label="Price" defaultValue="49" />
                <InputGroupAddon>/ month</InputGroupAddon>
              </InputGroup>
            ),
          },
        ],
      },
      rationale(
        'Prefixes placed beside a field look like separate controls, and hand-joined borders drift apart the first time someone changes a radius.',
        'One wrapper that owns the border and focus ring keeps every joined field identical and leaves the Input itself untouched.',
        'URLs, currency amounts, units, copyable values, search with a scope select.',
        ['Input', 'Button', 'fieldset'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'InputGroupAddon cells and one Input, in order.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: '36px or 40px.' },
      { name: 'invalid / disabled / required', type: 'boolean', description: 'Border colour; fieldset disable; forwarded to the input.' },
      { name: 'label', type: 'string', description: 'Group name when the addons do not explain it.' },
      { name: 'InputGroupAddon.variant', type: "'text' | 'plain' | 'control'", defaultValue: "'text'", description: 'Tinted text cell, bare glyph cell, or a cell for a button or select.' },
    ],
  },

  'emoji-picker': {
    description:
      'A searchable emoji grid with category tabs and a recent row, carrying its own set of about two hundred emoji so a reaction bar does not ship a Unicode database. Tabs move with Left and Right; the grid has one tab stop and arrows move by cell or row. Search swaps the tabs for an announced result count, and ArrowDown from the search field goes into the results. Every cell is named.',
    sections: [
      { title: 'Example', description: 'Pick a few — they appear in Recent, first tab.', bare: true, Content: EmojiExample },
      rationale(
        'Emoji pickers are usually a heavyweight dependency, and most are a wall of unlabelled images to a screen reader.',
        'A small named data set covers what people actually react with, and grid semantics make it fast from the keyboard.',
        'Reactions, message composers, status and profile emoji, feedback widgets.',
        ['Input', 'tablist', 'grid'],
      ),
    ],
    props: [
      { name: 'onSelect', type: '(emoji: EmojiPickerEmoji) => void', description: '{ emoji, name, keywords, category }.' },
      { name: 'emojis / categories', type: 'EmojiPickerEmoji[] / EmojiPickerCategory[]', defaultValue: 'built-in set', description: 'Replace the data.' },
      { name: 'recent / defaultRecent', type: 'string[]', description: 'Recent characters, most recent first.' },
      { name: 'onRecentChange', type: '(recent: string[]) => void', description: 'Persist it to keep Recent across reloads.' },
      { name: 'maxRecent', type: 'number', defaultValue: '16', description: 'Recent row length.' },
      { name: 'columns', type: 'number', defaultValue: '8', description: 'Cells per row.' },
    ],
  },
}
