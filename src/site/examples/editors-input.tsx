import { useState } from 'react'
import {
  Button,
  EasingEditor,
  Field,
  FormulaEditor,
  InlineCompletion,
  NaturalDateInput,
  PatternLock,
  ProductVariantPicker,
  RichTextEditor,
  SchemaForm,
  SeatMap,
  Text,
  TrackChanges,
  formatNaturalDate,
  parseNaturalDate,
  type EasingEditorValue,
  type FormulaEditorFunction,
  type FormulaEditorValue,
  type ProductVariantPickerOption,
  type ProductVariantPickerVariant,
  type SchemaFormSchema,
  type SeatMapSection,
  type SeatMapTier,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint" className="break-all">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

/* ------------------------------------------------------- rich text editor */

const RELEASE_NOTE =
  '<h2>Shared views</h2><p>Saved filters can now be <b>shared with your whole workspace</b>. Anyone with access sees the same columns, sort and grouping.</p><ul><li>Pin a view to the sidebar</li><li>Copy a link to a view</li></ul><blockquote>Views you already saved stay private until you share them.</blockquote><p>Read the <a href="https://example.com/docs/views">views guide</a> for details.</p>'

function RichTextExample() {
  const [html, setHtml] = useState(RELEASE_NOTE)
  return (
    <div className="flex w-full flex-col gap-3">
      <RichTextEditor label="Release note" value={html} onValueChange={setHtml} />
      <Readout label="value" value={html.length > 220 ? `${html.slice(0, 220)}…` : html} />
    </div>
  )
}

const UNSAFE = '<p onclick="steal()">Hello <img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">click me</a> and <a href="https://example.com" style="color:red" target="_blank">a real link</a>.</p><div><span style="font-size:40px">Pasted from a web page</span></div>'

function SanitiseExample() {
  const [html, setHtml] = useState('<p>Load some hostile HTML with the button below.</p>')
  return (
    <div className="flex w-full flex-col gap-3">
      <RichTextEditor label="Comment" value={html} onValueChange={setHtml} minHeight={96} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setHtml(UNSAFE)}>
          Load unsafe HTML
        </Button>
        <Text size="caption" tone="faint">
          Scripts, handlers, styles and the javascript: link are removed; the text and the https link stay.
        </Text>
      </div>
      <Readout label="value" value={html} />
    </div>
  )
}

/* ------------------------------------------------------------ schema form */

const INTEGRATION: SchemaFormSchema = {
  type: 'object',
  required: ['name', 'email', 'plan', 'seats', 'terms'],
  properties: {
    name: { type: 'string', title: 'Workspace name', minLength: 3, maxLength: 40 },
    email: { type: 'string', title: 'Billing email', format: 'email' },
    website: { type: 'string', format: 'uri', description: 'Optional. Shown on invoices.' },
    plan: { type: 'string', enum: ['starter', 'team', 'enterprise'], enumLabels: ['Starter', 'Team', 'Enterprise'] },
    seats: { type: 'integer', minimum: 1, maximum: 500, default: 5 },
    startDate: { type: 'string', format: 'date', title: 'Contract starts' },
    address: {
      type: 'object',
      title: 'Billing address',
      required: ['city'],
      properties: {
        city: { type: 'string' },
        postcode: { type: 'string', pattern: '[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}', patternMessage: 'Enter a UK postcode, like SW1A 1AA.' },
      },
    },
    contacts: {
      type: 'array',
      title: 'Contacts',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        title: 'Contact',
        required: ['name', 'email'],
        properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' } },
      },
    },
    notify: { type: 'boolean', title: 'Email me about usage spikes' },
    terms: { type: 'boolean', title: 'I accept the order form terms' },
  },
}

function SchemaFormExample() {
  const [submitted, setSubmitted] = useState<unknown>(null)
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4">
      <SchemaForm schema={INTEGRATION} submitLabel="Create workspace" onSubmit={setSubmitted} />
      <Readout label="onSubmit" value={submitted ? JSON.stringify(submitted) : ''} />
    </div>
  )
}

const WEBHOOK: SchemaFormSchema = {
  type: 'object',
  required: ['url'],
  properties: {
    url: { type: 'string', format: 'uri', title: 'Endpoint URL' },
    events: { type: 'array', title: 'Event names', items: { type: 'string', title: 'Event', minLength: 3 }, minItems: 1, default: ['invoice.paid'] },
    retries: { type: 'number', minimum: 0, maximum: 10, default: 3 },
  },
}

function ControlledSchemaExample() {
  const [value, setValue] = useState<Record<string, unknown>>({ url: 'https://hooks.example.com/klyv', events: ['invoice.paid', 'seat.added'], retries: 3 })
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <SchemaForm schema={WEBHOOK} value={value} onValueChange={setValue} submitLabel="Save webhook" />
      <Readout label="value" value={JSON.stringify(value)} />
    </div>
  )
}

/* ------------------------------------------------------ inline completion */

const PHRASES = [
  'Thanks for getting back to me so quickly.',
  'Thanks for the update, that works for me.',
  'Could we move our call to Thursday afternoon?',
  'Could you send over the latest invoice?',
  'I have attached the signed order form.',
  'I will follow up once the team has reviewed it.',
  'Let me know if you have any questions.',
]

const suggestFrom = (list: string[]) => (text: string) => {
  const lower = text.toLowerCase()
  const hit = list.find((phrase) => phrase.toLowerCase().startsWith(lower) && phrase.length > text.length)
  return hit ? hit.slice(text.length) : null
}

function InlineCompletionExample() {
  const [text, setText] = useState('')
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <Field label="Reply" hint="Type “Thanks”, “Could” or “I have”. Tab accepts, Ctrl+→ takes a word, Escape dismisses.">
        <InlineCompletion label="Reply" value={text} onValueChange={setText} getSuggestion={suggestFrom(PHRASES)} placeholder="Write a reply" />
      </Field>
      <Readout label="value" value={text} />
    </div>
  )
}

const COMMITS = ['fix(auth): refresh the session before it expires', 'fix(billing): round VAT per line, not per invoice', 'feat(views): share saved views with the workspace', 'feat(export): stream large CSV exports', 'docs: explain the retry policy for webhooks']

function AsyncCompletionExample() {
  const [calls, setCalls] = useState({ asked: 0, cancelled: 0 })
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <Field label="Commit message" hint="Suggestions arrive after 400 ms. Keep typing and the pending request is cancelled.">
        <InlineCompletion
          label="Commit message"
          multiline
          rows={3}
          debounce={120}
          placeholder="fix(…"
          getSuggestion={(text, signal) =>
            new Promise((resolve) => {
              setCalls((c) => ({ ...c, asked: c.asked + 1 }))
              const timer = setTimeout(() => resolve(suggestFrom(COMMITS)(text)), 400)
              signal.addEventListener('abort', () => {
                clearTimeout(timer)
                setCalls((c) => ({ ...c, cancelled: c.cancelled + 1 }))
                resolve(null)
              })
            })
          }
        />
      </Field>
      <Readout label="requests" value={`${calls.asked} asked, ${calls.cancelled} cancelled`} />
    </div>
  )
}

/* --------------------------------------------------------- formula editor */

const CELLS: Record<string, FormulaEditorValue> = {
  A1: 'Item', B1: 'Qty', C1: 'Price',
  A2: 'Seats', B2: 12, C2: 18,
  A3: 'Storage', B3: 3, C3: 40,
  A4: 'Support', B4: 1, C4: 250,
}

const FUNCTIONS: FormulaEditorFunction[] = [
  { name: 'SUM', args: ['number1', 'number2…'], description: 'Adds the numbers.', evaluate: (a) => a.flat().reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0) },
  { name: 'SUMPRODUCT', args: ['range1', 'range2'], description: 'Multiplies the ranges pairwise and adds.', evaluate: ([x, y]) => (x as number[]).reduce((s, v, i) => s + v * ((y as number[])[i] ?? 0), 0) },
  { name: 'ROUND', args: ['number', 'digits'], description: 'Rounds to a number of places.', evaluate: ([n, d]) => Math.round(Number(n) * 10 ** Number(d ?? 0)) / 10 ** Number(d ?? 0) },
  { name: 'VAT', args: ['amount', 'rate'], description: 'Adds VAT at the rate, 20% if left out.', evaluate: ([n, r]) => Number(n) * (1 + Number(r ?? 0.2)) },
  { name: 'IF', args: ['condition', 'if_true', 'if_false'], description: 'Chooses a value by a condition.', evaluate: ([c, t, f]) => (c ? t : (f ?? false)) as FormulaEditorValue },
  { name: 'MAX', args: ['number1', 'number2…'], description: 'The largest number.', evaluate: (a) => Math.max(...(a.flat().filter((v) => typeof v === 'number') as number[])) },
]

function FormulaExample() {
  const [formula, setFormula] = useState('=ROUND(VAT(SUMPRODUCT(B2:B4, C2:C4)), 2)')
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4">
      <table className="w-full border-collapse text-left font-mono text-[12px]">
        <caption className="sr-only">Cell values the formula reads</caption>
        <thead>
          <tr>
            <th scope="col" className="w-8 border border-line bg-surface-muted px-2 py-1 text-ink-faint"><span className="sr-only">Row</span></th>
            {['A', 'B', 'C'].map((c) => (
              <th key={c} scope="col" className="border border-line bg-surface-muted px-2 py-1 font-bold text-ink-faint">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((r) => (
            <tr key={r}>
              <th scope="row" className="border border-line bg-surface-muted px-2 py-1 font-bold text-ink-faint">{r}</th>
              {['A', 'B', 'C'].map((c) => (
                <td key={c} className="border border-line px-2 py-1 text-ink">{String(CELLS[`${c}${r}`] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Field label="Quote total" hint="Type a function name to see completions; inside a call the current argument is underlined.">
        <FormulaEditor label="Quote total" value={formula} onValueChange={setFormula} functions={FUNCTIONS} cells={CELLS} />
      </Field>
    </div>
  )
}

/* ---------------------------------------------------------- easing editor */

function EasingExample() {
  const [curve, setCurve] = useState<EasingEditorValue>([0.34, 1.56, 0.64, 1])
  return (
    <div className="flex w-full flex-col gap-3">
      <EasingEditor label="Panel entrance easing" value={curve} onValueChange={setCurve} />
      <Readout label="value" value={JSON.stringify(curve)} />
    </div>
  )
}

/* ----------------------------------------------------- natural date input */

function NaturalDateExample() {
  const [due, setDue] = useState<Date | null>(null)
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <Field label="Remind me">
        <NaturalDateInput label="Remind me" value={due} onValueChange={setDue} />
      </Field>
      <Readout label="value" value={due ? due.toString().slice(0, 21) : ''} />
    </div>
  )
}

const REFERENCE = new Date(2026, 8, 15, 10, 0)
const PHRASE_SAMPLES = ['today', 'tomorrow 9am', 'next fri 3pm', 'in 2 weeks', '3 days ago', 'dec 25', '2026-10-01 14:30', 'end of month', '03/04', 'at 7', 'noon']

function PhraseTable() {
  return (
    <table className="w-full border-collapse text-left text-[12px]">
      <caption className="pb-2 text-left text-[12px] font-medium text-ink-faint">Read against Tuesday 15 September 2026, 10:00</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="py-1.5 pr-3 font-bold text-ink-soft">Typed</th>
          <th scope="col" className="py-1.5 pr-3 font-bold text-ink-soft">Read as</th>
          <th scope="col" className="py-1.5 font-bold text-ink-soft">Also offered</th>
        </tr>
      </thead>
      <tbody>
        {PHRASE_SAMPLES.map((phrase) => {
          const reading = parseNaturalDate(phrase, REFERENCE)
          return (
            <tr key={phrase} className="border-b border-line">
              <td className="py-1.5 pr-3 font-mono text-ink">{phrase}</td>
              <td className="py-1.5 pr-3 font-semibold text-ink">{reading.date ? formatNaturalDate(reading.date, reading.hasTime, REFERENCE) : '—'}</td>
              <td className="py-1.5 text-ink-faint">{reading.alternatives.map((a) => `${formatNaturalDate(a.date, reading.hasTime, REFERENCE)} (${a.note})`).join('; ') || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ------------------------------------------------- product variant picker */

const JACKET_OPTIONS: ProductVariantPickerOption[] = [
  {
    name: 'colour',
    label: 'Colour',
    values: [
      { value: 'sage', label: 'Sage', swatch: 'oklch(0.72 0.06 150)' },
      { value: 'ink', label: 'Ink', swatch: 'oklch(0.3 0.03 260)' },
      { value: 'sand', label: 'Sand', swatch: 'oklch(0.86 0.05 85)' },
      { value: 'rust', label: 'Rust', swatch: 'oklch(0.55 0.14 40)' },
    ],
  },
  { name: 'size', label: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'].map((value) => ({ value })) },
  { name: 'material', label: 'Material', values: [{ value: 'cotton', label: 'Organic cotton' }, { value: 'wool', label: 'Merino wool' }] },
]

// Rust is only made in cotton and never in XS; Ink wool is out in L; Sand XL is out everywhere.
const JACKET_VARIANTS: ProductVariantPickerVariant[] = JACKET_OPTIONS[0].values.flatMap((colour, ci) =>
  JACKET_OPTIONS[1].values.flatMap((size, si) =>
    JACKET_OPTIONS[2].values
      .filter((material) => !(colour.value === 'rust' && (material.value === 'wool' || size.value === 'XS')))
      .map((material) => ({
        sku: `JKT-${colour.value.slice(0, 2).toUpperCase()}-${size.value}-${material.value[0].toUpperCase()}`,
        options: { colour: colour.value, size: size.value, material: material.value },
        price: material.value === 'wool' ? 189 : 129,
        stock: (colour.value === 'ink' && material.value === 'wool' && size.value === 'L') || (colour.value === 'sand' && size.value === 'XL') ? 0 : ((ci * 7 + si * 3) % 11) + 1,
      })),
  ),
)

function VariantExample() {
  const [sku, setSku] = useState('')
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <ProductVariantPicker options={JACKET_OPTIONS} variants={JACKET_VARIANTS} defaultValue={{ colour: 'rust' }} onValueChange={(_, variant) => setSku(variant?.sku ?? '')} />
      <Readout label="variant" value={sku} />
    </div>
  )
}

/* --------------------------------------------------------------- seat map */

const TIERS: SeatMapTier[] = [
  { id: 'premium', label: 'Premium', price: 65 },
  { id: 'standard', label: 'Standard', price: 42 },
  { id: 'restricted', label: 'Restricted view', price: 28 },
]

const takenish = (n: number) => (n * 37) % 11

const VENUE: SeatMapSection[] = [
  {
    id: 'stalls',
    name: 'Stalls',
    rows: ['A', 'B', 'C', 'D', 'E'].map((row, r) => ({
      label: row,
      seats: Array.from({ length: 16 }, (_, i) => ({
        id: `stalls-${row}${i + 1}`,
        number: i + 1,
        // A centre aisle after seat 8.
        x: i + (i >= 8 ? 1 : 0),
        tier: r < 3 ? 'premium' : 'standard',
        status: takenish(r * 16 + i) === 0 ? ('taken' as const) : takenish(r * 16 + i) === 5 && r > 2 ? ('held' as const) : undefined,
      })),
    })),
  },
  {
    id: 'circle',
    name: 'Circle',
    x: 1,
    rows: ['F', 'G', 'H'].map((row, r) => ({
      label: row,
      offset: r === 2 ? 1 : 0,
      seats: Array.from({ length: r === 2 ? 13 : 15 }, (_, i) => ({
        id: `circle-${row}${i + 1}`,
        number: i + 1,
        tier: i < 2 || i > (r === 2 ? 10 : 12) ? 'restricted' : 'standard',
        status: takenish(100 + r * 15 + i) < 3 ? ('taken' as const) : undefined,
      })),
    })),
  },
]

function SeatMapExample() {
  const [seats, setSeats] = useState<string[]>([])
  const [booked, setBooked] = useState('')
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <SeatMap sections={VENUE} tiers={TIERS} value={seats} onValueChange={setSeats} maxSeats={4} noSingleGaps onConfirm={(ids) => setBooked(ids.join(', '))} />
      <Readout label="onConfirm" value={booked} />
    </div>
  )
}

/* ------------------------------------------------------------ pattern lock */

const SECRET = [0, 1, 2, 4, 6, 7, 8]

function PatternLockExample() {
  const [last, setLast] = useState<number[]>([])
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <PatternLock label="Unlock the vault" onComplete={(pattern) => {
        setLast(pattern)
        return pattern.join() === SECRET.join()
      }} />
      <Text size="caption" tone="faint">The demo pattern is a Z: across the top, diagonally down, across the bottom.</Text>
      <Readout label="last pattern" value={last.join(' → ')} />
    </div>
  )
}

function PatternRecordExample() {
  const [last, setLast] = useState<number[]>([])
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <PatternLock label="Choose a new pattern" size={4} minLength={6} onComplete={(pattern) => setLast(pattern)} />
      <Readout label="pattern" value={last.join(' → ')} />
    </div>
  )
}

/* ---------------------------------------------------------- track changes */

const ORIGINAL =
  'Our quarterly review found that the onboarding flow is to long, and most new users drop off before they invite a teammate. We recommend we shorten the flow to three steps and moving the invite earlier.'
const SUGGESTED =
  'Our quarterly review found that the onboarding flow is too long: most new users leave before they invite a teammate. We recommend shortening the flow to three steps and moving the invite to the first screen.'

function TrackChangesExample() {
  const [text, setText] = useState(ORIGINAL)
  const [pending, setPending] = useState<number | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <TrackChanges label="Suggested edits to the review summary" original={ORIGINAL} suggested={SUGGESTED} onValueChange={(next, left) => {
        setText(next)
        setPending(left)
      }} />
      <Readout label={`result${pending === null ? '' : ` (${pending} pending)`}`} value={text} />
    </div>
  )
}

/* ------------------------------------------------------------------ demos */

export const demos: ExampleModule = {
  'rich-text-editor': {
    description:
      'A WYSIWYG editor for short formatted writing: bold, italic, underline and strike, two heading levels, bulleted and numbered lists, quotes and links, with undo and redo. The toolbar follows the caret and shows the formatting you are in. The value is HTML, and everything that reaches it — the value prop, a paste, a link — passes an allow-list sanitiser first, so hostile markup never survives into what you store.',
    sections: [
      { title: 'Example', description: 'Select text and use the toolbar, or Ctrl+B, Ctrl+I, Ctrl+U. Ctrl+K opens the link dialog; on an existing link it edits or removes it.', bare: true, Content: RichTextExample },
      { title: 'Sanitised on the way in', description: 'The same sanitiser runs on paste. Try pasting from a web page, too.', bare: true, Content: SanitiseExample },
      rationale(
        'A plain textarea loses the structure people want in a note, and a contentEditable div on its own stores whatever the browser or the clipboard puts in it — including scripts.',
        'Markdown suits people who know it; this is for everyone else. The sanitiser is an allow-list that rebuilds each element, so an attack nobody listed is still dropped.',
        'Release notes, ticket descriptions, comments, email templates.',
        ['Modal', 'Field', 'Input', 'Button'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'HTML. Sanitised before it is shown.' },
      { name: 'onValueChange', type: '(html: string) => void', description: 'Sanitised HTML after every edit. An empty document is an empty string.' },
      { name: 'label', type: 'string', description: 'Names the text box and its toolbar.' },
      { name: 'placeholder', type: 'string', defaultValue: "'Start writing…'", description: 'Shown while empty.' },
      { name: 'minHeight', type: 'number', defaultValue: '160', description: 'Height of the writing area before it grows.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks editing.' },
      { name: 'aria-describedby', type: 'string', description: 'Ids of a hint or error.' },
    ],
  },
  'schema-form': {
    description:
      'A working form drawn from a JSON Schema: strings with email, date and URL formats, numbers and integers with limits, booleans, enums, nested objects and repeatable arrays. It renders the library’s own Field, Input, Select, Checkbox and RepeaterField, validates against the same schema — required, lengths, patterns, limits — and hands onSubmit the value only once every rule passes.',
    sections: [
      { title: 'Example', description: 'Submit it empty to see every rule at once; focus moves to the first field that needs attention.', bare: true, Content: SchemaFormExample },
      { title: 'Controlled, with arrays of strings', bare: true, Content: ControlledSchemaExample },
      rationale(
        'Settings defined by data — a plugin’s config, an integration’s options — end up as hand-built forms that drift from the schema the server validates.',
        'Drawing and validating from one schema means the form and the rules cannot disagree, and errors appear only after a field is left or the form is submitted.',
        'Integration settings, plugin configuration, admin tools, any form whose shape comes from an API.',
        ['Field', 'Input', 'Select', 'Checkbox', 'RepeaterField', 'Label', 'InlineMessage', 'Button'],
      ),
    ],
    props: [
      { name: 'schema', type: 'SchemaFormSchema', description: 'type, title, description, format, enum, enumLabels, minLength, maxLength, pattern, patternMessage, minimum, maximum, properties, required, items, minItems, maxItems, default.' },
      { name: 'value / defaultValue', type: 'T', description: 'The whole form value. Defaults are built from the schema.' },
      { name: 'onValueChange', type: '(value: T) => void', description: 'After every edit.' },
      { name: 'onSubmit', type: '(value: T) => void', description: 'Only when the value passes every rule.' },
      { name: 'submitLabel', type: 'string', defaultValue: "'Save'", description: 'Text of the submit button.' },
    ],
  },
  'inline-completion': {
    description:
      'A text field that offers to finish what you are typing: the rest of the sentence appears in faint text after the caret. Tab or → takes it all, Ctrl/⌘+→ takes one word, Escape sends it away, and typing the same letters walks through it. The suggestion can come from a function or a server; requests are debounced and cancelled when the text moves on.',
    sections: [
      { title: 'Example', bare: true, Content: InlineCompletionExample },
      { title: 'Asynchronous, multiline', description: 'Try “fix(” or “feat(”. The counter shows cancelled requests.', bare: true, Content: AsyncCompletionExample },
      rationale(
        'Autocomplete lists cover the choice of a whole value; a suggested continuation of free text needs a different surface, drawn exactly where the next letter would go.',
        'A mirror that copies the field’s font, padding and scroll keeps the ghost text aligned in any size or font, and each suggestion is read out once, politely, so screen reader users hear it too.',
        'Reply suggestions, commit messages, search queries, AI-assisted writing.',
        ['Field'],
      ),
    ],
    props: [
      { name: 'getSuggestion', type: '(text, signal) => string | null | Promise<…>', description: 'Returns the continuation only. The signal aborts when the text changes.' },
      { name: 'value / defaultValue', type: 'string', description: 'The text.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every keystroke and every accept.' },
      { name: 'onAccept', type: '(accepted: string) => void', description: 'The part of a suggestion that was taken.' },
      { name: 'debounce', type: 'number', defaultValue: '150', description: 'Quiet time before asking, in ms.' },
      { name: 'multiline / rows', type: 'boolean / number', defaultValue: 'false / 3', description: 'A textarea instead of an input.' },
      { name: 'label', type: 'string', description: 'Accessible name.' },
      { name: 'placeholder / disabled / id', type: '—', description: 'As on a text input.' },
    ],
  },
  'formula-editor': {
    description:
      'A spreadsheet formula bar. It tokenises and parses as you type — numbers, text, cell references and ranges, operators with the usual precedence, function calls — and reports a mistake with the character where it starts. Function names complete from the list you pass, the signature hint underlines the argument you are on, and given cell values it evaluates the formula too.',
    sections: [
      { title: 'Example', description: 'Try deleting a bracket, or typing =SU to see completions.', bare: true, Content: FormulaExample },
      rationale(
        'Letting people compute a value from others usually means a text field and a failed save, with no clue where the formula went wrong.',
        'A real parser gives errors with a position, and the argument hint answers the question people ask halfway through a call: which one am I on?',
        'Calculated columns, pricing rules, report builders, no-code tools.',
        ['Field'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', defaultValue: "'='", description: 'The formula, with its leading =.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'After every edit.' },
      { name: 'functions', type: 'FormulaEditorFunction[]', defaultValue: 'SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, IF, CONCAT', description: 'name, args, description, and an optional evaluate.' },
      { name: 'cells', type: 'Record<string, number | string | boolean>', description: 'Cell values. When given, the result is shown.' },
      { name: 'label', type: 'string', description: 'Accessible name.' },
      { name: 'invalid / disabled / id', type: '—', description: 'Field forwards these.' },
    ],
  },
  'easing-editor': {
    description:
      'A cubic-bezier editor: drag the two control handles, or focus one and move it with the arrow keys (Shift for bigger steps). The y values may leave 0–1 for overshoot. Presets give a starting point, the numbers take typed values, a dot runs the curve so you judge the motion rather than the shape, and the output is a ready cubic-bezier() string.',
    sections: [
      { title: 'Example', bare: true, Content: EasingExample, note: motionNote('the preview dot stops, and a row of dots shows where the ease puts an object at equal steps of time.') },
      rationale(
        'Choosing an easing by typing four numbers is guesswork, and the named easings rarely fit a specific entrance.',
        'Shaping the curve and watching it run closes the loop in one place, and the keyboard route makes it usable without a pointer.',
        'Motion tokens in a design system, animation settings, theme editors.',
        ['Input', 'CopyButton'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: '[x1, y1, x2, y2]', defaultValue: '[0.25, 0.1, 0.25, 1]', description: 'The curve. x is clamped to 0–1, y to −0.6–1.6.' },
      { name: 'onValueChange', type: '(value) => void', description: 'On every drag step, key press, typed number or preset.' },
      { name: 'presets', type: 'EasingEditorPreset[]', description: 'label and value. Defaults to the CSS keywords plus three back curves.' },
      { name: 'label', type: 'string', defaultValue: "'Easing'", description: 'Names the editor and its handles.' },
      { name: 'duration', type: 'number', defaultValue: '1400', description: 'Length of one preview run, in ms.' },
    ],
  },
  'natural-date-input': {
    description:
      'A date field that takes words: today, tomorrow 9am, next fri 3pm, in 2 weeks, 3 days ago, dec 25, 2026-10-01 14:30, end of month. The reading is shown in full while you type, other fair readings are offered as one-click corrections, and a calendar button is there for anyone who would rather point. The value is a Date.',
    sections: [
      { title: 'Example', description: 'Type a phrase and press Enter, or open the calendar.', bare: true, Content: NaturalDateExample },
      { title: 'How phrases are read', bare: true, Content: PhraseTable },
      rationale(
        'People think of dates as phrases, and a grid makes them translate “next Friday” into clicks; a parser that guesses silently is worse, because the wrong Friday is saved.',
        'Reading the result back before it is committed, and listing the other readings, turns a guess into a confirmation.',
        'Reminders, due dates, snoozes, scheduling a send.',
        ['Input', 'Popover', 'Calendar', 'IconButton'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'Date | null', description: 'The moment. null is an empty field.' },
      { name: 'onValueChange', type: '(value: Date | null) => void', description: 'On Enter, on leaving the field, on a calendar pick or a suggestion.' },
      { name: 'referenceDate', type: 'Date', defaultValue: 'now', description: 'What “today” means.' },
      { name: 'dayFirst', type: 'boolean', defaultValue: 'true', description: 'Read 03/04 as 3 April. The other reading is still offered.' },
      { name: 'label', type: 'string', description: 'Accessible name, and the calendar’s.' },
      { name: 'placeholder / invalid / disabled / id', type: '—', description: 'As on a text input.' },
    ],
  },
  'product-variant-picker': {
    description:
      'Option groups — colour, size, material — checked against the SKUs that exist. An option that cannot make an available variant with what is already chosen is disabled and says why: “Not made in Rust” asks you to change another choice, “Out of stock” says this one is gone. Each group is a radio group, and the matching variant’s price, stock and SKU appear once every group is chosen.',
    sections: [
      { title: 'Example', description: 'Rust starts selected: it is never made in XS or wool. Ink wool is out in L; Sand is out in XL.', bare: true, Content: VariantExample },
      rationale(
        'Product pages that let you pick any combination find out it does not exist at checkout, and a plain disabled option never says whether to wait or to change something else.',
        'Checking each option against the variants with the current selection, and naming the reason, keeps every choice reachable and every dead end explained.',
        'Product pages, quick-add drawers, B2B order forms.',
        ['colour tokens'],
      ),
    ],
    props: [
      { name: 'options', type: 'ProductVariantPickerOption[]', description: 'name, label, and values with value, label and an optional swatch colour.' },
      { name: 'variants', type: 'ProductVariantPickerVariant[]', description: 'sku, options, price, stock. Missing combinations are not made.' },
      { name: 'value / defaultValue', type: 'Record<string, string>', description: 'The selection, by option name.' },
      { name: 'onValueChange', type: '(selection, variant | null) => void', description: 'The variant once every group is chosen.' },
      { name: 'currency', type: 'string', defaultValue: "'GBP'", description: 'ISO 4217 code for the price.' },
      { name: 'lowStock', type: 'number', defaultValue: '5', description: 'At or under this, the stock line counts what is left.' },
    ],
  },
  'seat-map': {
    description:
      'A venue drawn from data — sections, rows and seats with a status and a price tier — where people pick up to a set number of seats. Each section is one tab stop and the arrows move seat to seat; every seat is named in full. The optional rule that box offices enforce — no single empty seat stranded between two occupied ones — names the seat and holds Continue until it is fixed.',
    sections: [
      { title: 'Example', description: 'Up to four seats. Try choosing seats either side of a free one.', bare: true, Content: SeatMapExample },
      rationale(
        'Best-available allocation takes the choice away, and a map that only works with a mouse shuts out anyone booking by keyboard or screen reader.',
        'Seats laid out from data keep the map honest to the venue, and the grid keyboard model means the same map works without being seen.',
        'Theatre and event tickets, cinema booking, desk and room booking.',
        ['Button', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'sections', type: 'SeatMapSection[]', description: 'id, name, x, and rows of seats with id, number, x, y, status and tier.' },
      { name: 'tiers', type: 'SeatMapTier[]', description: 'id, label, price. Up to four colours.' },
      { name: 'value / defaultValue', type: 'string[]', description: 'Chosen seat ids.' },
      { name: 'onValueChange', type: '(seats: string[]) => void', description: 'After every change.' },
      { name: 'maxSeats', type: 'number', defaultValue: '6', description: 'Most seats in one order.' },
      { name: 'noSingleGaps', type: 'boolean', defaultValue: 'false', description: 'Flag a stranded single seat and hold Continue.' },
      { name: 'onConfirm', type: '(seats: string[]) => void', description: 'Shows a Continue button.' },
      { name: 'stageLabel / currency', type: 'string', defaultValue: "'Stage' / 'GBP'", description: 'Map heading and price currency.' },
    ],
  },
  'pattern-lock': {
    description:
      'A grid of dots joined by one stroke, as on a phone. A dot joins once, a stroke that passes straight over an unused dot picks it up, and patterns shorter than the minimum are refused. Without a pointer, arrows move a cursor, Space joins the dot, Backspace takes one back and Enter submits. onComplete returns true or false to show success or error.',
    sections: [
      { title: 'Example', bare: true, Content: PatternLockExample },
      { title: 'A 4×4 grid, recording', description: 'size={4} and minLength={6}; onComplete returns nothing, so the pattern is only recorded.', bare: true, Content: PatternRecordExample },
      rationale(
        'A PIN pad is slow on a phone held in one hand, and a hand-drawn gesture pad without the pass-through rule records a pattern the user did not mean.',
        'Implementing the familiar rules exactly — and giving the same input a keyboard route — makes the pattern the one people expect.',
        'Kiosk and tablet unlocks, parental gates, confirming a destructive action on touch.',
        ['colour tokens'],
      ),
    ],
    props: [
      { name: 'onComplete', type: '(pattern: number[]) => boolean | void | Promise<…>', description: 'Dot indices row by row from 0. true is success, false is error.' },
      { name: 'size', type: 'number', defaultValue: '3', description: 'Dots per side.' },
      { name: 'minLength', type: 'number', defaultValue: '4', description: 'Fewest dots.' },
      { name: 'status', type: "'idle' | 'success' | 'error'", description: 'Forces the state from outside.' },
      { name: 'label', type: 'string', defaultValue: "'Unlock pattern'", description: 'Accessible name.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks drawing.' },
    ],
  },
  'track-changes': {
    description:
      'Suggested edits shown in place, computed with a word-level Myers diff between the original and the suggestion. Deletions are struck through, insertions underlined, and each change is accepted or rejected on its own — or all at once. The changes are one tab stop: arrows or J and K move between them, A accepts, R rejects, U undoes. The resulting text is reported after every decision.',
    sections: [
      { title: 'Example', bare: true, Content: TrackChangesExample },
      rationale(
        'Swapping a paragraph for a rewrite wholesale — from an AI or a colleague — loses the good original phrasing along with the bad.',
        'A real diff finds the smallest set of edits, and folding the whitespace between them makes a rewritten phrase one decision instead of five.',
        'Reviewing AI rewrites, copy edits, contract redlines, translation review.',
        ['Button'],
      ),
    ],
    props: [
      { name: 'original', type: 'string', description: 'The text as it stands.' },
      { name: 'suggested', type: 'string', description: 'The text with the edits applied.' },
      { name: 'onValueChange', type: '(text: string, pending: number) => void', description: 'After every decision. Undecided changes keep the original words.' },
      { name: 'label', type: 'string', defaultValue: "'Suggested edits'", description: 'Accessible name of the document.' },
    ],
  },
}
