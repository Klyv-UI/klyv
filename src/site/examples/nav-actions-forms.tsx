import { useState } from 'react'
import { BookOpen, CircleDot, User } from 'lucide-react'
import {
  AddToCalendar,
  AlphabetIndex,
  Avatar,
  Field,
  FollowButton,
  Input,
  RecentItems,
  ScopedSearch,
  SegmentedControl,
  SocialLoginButtons,
  Surface,
  Text,
  UnitInput,
  UnsavedChangesBar,
  VoteButtons,
  WeekdayPicker,
  type AddToCalendarEvent,
  type RecentItemsItem,
  type ScopedSearchSuggestion,
  type SocialLoginButtonsProvider,
  type UnitInputUnit,
  type VoteButtonsVote,
  type WeekdayPickerDay,
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

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ---------------------------------------------------------- scoped search */

const SUGGESTIONS: ScopedSearchSuggestion[] = [
  { id: 'd1', scope: 'docs', label: 'Rate limits and retries', hint: 'API reference / Limits', leading: <BookOpen size={15} /> },
  { id: 'd2', scope: 'docs', label: 'Rotating API keys', hint: 'Guides / Security', leading: <BookOpen size={15} /> },
  { id: 'd3', scope: 'docs', label: 'Webhook retry schedule', hint: 'Guides / Webhooks', leading: <BookOpen size={15} /> },
  { id: 'i1', scope: 'issues', label: 'Retry storm after deploy #4812', hint: 'Open · platform', leading: <CircleDot size={15} /> },
  { id: 'i2', scope: 'issues', label: 'Rate limiter drops requests at burst #4790', hint: 'Closed · api', leading: <CircleDot size={15} /> },
  { id: 'i3', scope: 'issues', label: 'Key rotation leaves stale cache #4755', hint: 'Open · auth', leading: <CircleDot size={15} /> },
  { id: 'p1', scope: 'people', label: 'Rahel Tesfaye', hint: 'Platform team', leading: <User size={15} /> },
  { id: 'p2', scope: 'people', label: 'Ravi Menon', hint: 'API team', leading: <User size={15} /> },
  { id: 'p3', scope: 'people', label: 'Rosa Lindqvist', hint: 'Support', leading: <User size={15} /> },
]

function ScopedSearchExample() {
  const [scope, setScope] = useState('all')
  const [query, setQuery] = useState('')
  const [last, setLast] = useState('')
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <ScopedSearch
        label="Search the workspace"
        scope={scope}
        onScopeChange={setScope}
        value={query}
        onValueChange={setQuery}
        suggestions={SUGGESTIONS}
        onSubmit={(text, where) => setLast(`search “${text}” in ${where}`)}
        onSuggestionSelect={(item) => setLast(`open ${item.scope}/${item.id}`)}
      />
      <Readout label="scope" value={scope} />
      <Readout label="last action" value={last} />
    </div>
  )
}

/* --------------------------------------------------------- alphabet index */

const CONTACTS = [
  'Aaliyah Brooks', 'Adebayo Okafor', 'Aiko Tanaka', 'Bea Castillo', 'Bruno Ferreira', 'Chen Wei', 'Clara Jensen',
  'Dmitri Volkov', 'Elif Şahin', 'Emeka Nwosu', 'Farah Haddad', 'Gustavo Lima', 'Hana Novak', 'Ines Moreau',
  'Jonas Berg', 'Kofi Mensah', 'Lena Fischer', 'Luca Romano', 'Maya Patel', 'Mateo Díaz', 'Nadia Karimi',
  'Oskar Nilsson', 'Priya Raman', 'Rafael Costa', 'Sana Qureshi', 'Sofia Rossi', 'Tariq Aziz', 'Theo Walsh',
  'Wren Holloway', 'Yusuf Demir', 'Zara Ahmed',
]

const grouped = CONTACTS.reduce<Record<string, string[]>>((groups, name) => {
  ;(groups[name[0]] ??= []).push(name)
  return groups
}, {})

function AlphabetIndexExample() {
  const [current, setCurrent] = useState<string>()
  return (
    <div className="flex w-full max-w-[420px] gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-2">
      <div className="h-[360px] min-w-0 flex-1 overflow-y-auto pr-1" aria-label="Contacts" role="region" tabIndex={0}>
        {Object.entries(grouped).map(([letter, names]) => (
          <section key={letter} aria-labelledby={`contacts-letter-${letter}`}>
            <h3
              id={`contacts-letter-${letter}`}
              tabIndex={-1}
              className="sticky top-0 bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint"
            >
              {letter}
            </h3>
            <ul>
              {names.map((name) => (
                <li key={name} className="flex items-center gap-2.5 px-2 py-1.5">
                  <Avatar name={name} size="xs" />
                  <Text as="span" size="body" weight="semibold">
                    {name}
                  </Text>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <AlphabetIndex
        label="Jump to contacts by letter"
        available={Object.keys(grouped)}
        targetIdPrefix="contacts-letter-"
        current={current}
        onJump={setCurrent}
      />
    </div>
  )
}

function AlphabetHorizontalExample() {
  const [jumped, setJumped] = useState('')
  const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
  return (
    <div className="flex w-full flex-col gap-3">
      <AlphabetIndex
        orientation="horizontal"
        label="Jump to glossary letter"
        letters={letters}
        available={['#', 'A', 'C', 'D', 'H', 'I', 'L', 'R', 'S', 'W']}
        getTarget={() => null /* no list here: the jump is only reported */}
        onJump={setJumped}
      />
      <Readout label="onJump" value={jumped} />
    </div>
  )
}

/* ----------------------------------------------------------- recent items */

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

const RECENT: RecentItemsItem[] = [
  { id: 'r1', title: 'Q4 planning — platform', kind: 'doc', meta: 'Planning', viewedAt: minutesAgo(4), pinned: true },
  { id: 'r2', title: 'Incident review: retry storm', kind: 'doc', meta: 'Postmortems', viewedAt: minutesAgo(38) },
  { id: 'r3', title: 'brand-assets-v3.zip', kind: 'file', meta: 'Design', viewedAt: minutesAgo(130) },
  { id: 'r4', title: 'Billing migration', kind: 'project', meta: 'Payments', viewedAt: minutesAgo(60 * 26) },
  { id: 'r5', title: 'onboarding-flow.fig', kind: 'file', meta: 'Growth', viewedAt: minutesAgo(60 * 50) },
]

function RecentItemsExample() {
  const [opened, setOpened] = useState('')
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <Surface variant="card" padding="md">
        <RecentItems defaultItems={RECENT} storageKey="klyv-demo-recent-items" onOpen={(item) => setOpened(item.title)} />
      </Surface>
      <Readout label="onOpen" value={opened} />
    </div>
  )
}

/* --------------------------------------------------- social login buttons */

function SocialLoginExample() {
  const [status, setStatus] = useState('')
  const start = async (provider: SocialLoginButtonsProvider) => {
    setStatus(`Redirecting to ${provider}…`)
    await wait(1500)
    setStatus(`Signed in with ${provider} (demo)`)
  }
  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[360px] gap-4">
      <div className="flex flex-col gap-1">
        <Text as="h3" size="subtitle">
          Sign in to Acme
        </Text>
        <Text size="label" tone="soft">
          Use the account your team already has.
        </Text>
      </div>
      <SocialLoginButtons lastUsed="github" onSelect={start} />
      <Text size="caption" tone="faint" role="status">
        {status}
      </Text>
    </Surface>
  )
}

/* ---------------------------------------------------- unsaved changes bar */

const SAVED = { name: 'Northwind Labs', slug: 'northwind', email: 'billing@northwind.dev' }

function UnsavedChangesExample() {
  const [saved, setSaved] = useState(SAVED)
  const [form, setForm] = useState(SAVED)
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((key) => form[key] !== saved[key])
  return (
    <div className="relative flex w-full max-w-[520px] flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <Text as="h3" size="heading">
        Workspace settings
      </Text>
      <Field label="Workspace name">
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
      <Field label="URL slug" hint="acme.app/your-slug">
        <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
      </Field>
      <Field label="Billing email">
        <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </Field>
      <UnsavedChangesBar
        dirty={dirty}
        onSave={async () => {
          await wait(900)
          setSaved(form)
        }}
        onDiscard={() => setForm(saved)}
      />
    </div>
  )
}

/* ----------------------------------------------------------- vote buttons */

function VoteExample() {
  const [fail, setFail] = useState(false)
  const [error, setError] = useState('')
  const [vote, setVote] = useState<VoteButtonsVote>(null)
  const save = async (next: VoteButtonsVote) => {
    setError('')
    await wait(500)
    if (fail) throw new Error('offline')
    setVote(next)
  }
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />
        Make saving fail, to see the rollback
      </label>
      <Surface variant="card" padding="md" className="flex-row gap-4">
        <VoteButtons subject="answer" defaultScore={128} vote={vote} onVoteChange={save} onError={() => setError('Your vote could not be saved, so it was undone.')} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Text size="body" weight="bold">
            Use exponential backoff with jitter
          </Text>
          <Text size="label" tone="soft" leading="normal">
            Retrying every client on the same fixed schedule turns one outage into a synchronised stampede. Add random jitter to each delay so the retries spread out.
          </Text>
          <div className="flex items-center gap-3 pt-1">
            <VoteButtons subject="comment" orientation="horizontal" size="sm" defaultScore={7} defaultVote="up" />
            <Text size="caption" tone="faint">
              “This fixed our webhook backlog.”
            </Text>
          </div>
        </div>
      </Surface>
      <Text size="caption" tone="danger" weight="semibold" role="alert">
        {error}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------- follow button */

function FollowExample() {
  const [count, setCount] = useState(2481)
  const [following, setFollowing] = useState(false)
  return (
    <Surface variant="card" padding="md" className="w-full max-w-[440px] flex-row flex-wrap items-center gap-3">
      <Avatar name="Ada Okonkwo" size="lg" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="body" weight="bold">
          Ada Okonkwo
        </Text>
        <Text size="caption" tone="faint">
          Staff engineer · writes about queues
        </Text>
      </div>
      <FollowButton
        name="Ada Okonkwo"
        following={following}
        followerCount={count}
        onFollowingChange={async (next) => {
          await wait(600)
          setFollowing(next)
          setCount((value) => value + (next ? 1 : -1))
        }}
      />
    </Surface>
  )
}

/* -------------------------------------------------------- add to calendar */

const LAUNCH: AddToCalendarEvent = {
  title: 'Klyv 2.0 launch stream',
  start: new Date(Date.UTC(2026, 9, 14, 16, 0)),
  end: new Date(Date.UTC(2026, 9, 14, 17, 0)),
  location: 'Online, stream link in the invite',
  description: 'Live walkthrough of the new components, then questions; bring yours.',
  url: 'https://example.com/events/launch',
  uid: 'klyv-launch-2026@example.com',
}

const OFFSITE: AddToCalendarEvent = {
  title: 'Design offsite, Lisbon',
  start: new Date(2026, 10, 3),
  end: new Date(2026, 10, 6),
  allDay: true,
  location: 'LX Factory, Lisbon',
}

function AddToCalendarExample() {
  const [chosen, setChosen] = useState('')
  return (
    <Surface variant="card" padding="md" className="w-full max-w-[420px] gap-3">
      <div className="flex flex-col gap-1">
        <Text size="caption" tone="faint" weight="bold" className="uppercase tracking-wider">
          Wed 14 Oct · 16:00 UTC
        </Text>
        <Text size="heading">{LAUNCH.title}</Text>
        <Text size="label" tone="soft" leading="normal">
          {LAUNCH.description}
        </Text>
      </div>
      <div className="flex items-center gap-3">
        <AddToCalendar event={LAUNCH} variant="accent" onSelect={setChosen} />
        <Readout label="onSelect" value={chosen} />
      </div>
    </Surface>
  )
}

/* --------------------------------------------------------- weekday picker */

function WeekdayExample() {
  const [locale, setLocale] = useState('en-GB')
  const [days, setDays] = useState<WeekdayPickerDay[]>([1, 3, 5])
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Locale"
        size="sm"
        value={locale}
        onValueChange={setLocale}
        className="self-start"
        options={[
          { value: 'en-GB', label: 'en-GB' },
          { value: 'en-US', label: 'en-US' },
          { value: 'fr-FR', label: 'fr-FR' },
          { value: 'ar-EG', label: 'ar-EG' },
        ]}
      />
      <WeekdayPicker label="Repeat on" locale={locale} value={days} onValueChange={setDays} />
      <Readout label="value (getDay numbers)" value={JSON.stringify(days)} />
    </div>
  )
}

/* ------------------------------------------------------------- unit input */

const LENGTH: UnitInputUnit[] = [
  { value: 'px', factor: 1, min: 0, max: 200 },
  { value: 'rem', factor: 16, min: 0, max: 12.5, step: 0.125 },
  { value: '%', min: 0, max: 400, step: 5 },
]
const WEIGHT: UnitInputUnit[] = [
  { value: 'kg', factor: 1000, min: 0, max: 70, step: 0.5 },
  { value: 'lb', factor: 453.592, min: 0, max: 154, step: 1 },
]
const STORAGE: UnitInputUnit[] = [
  { value: 'MB', factor: 1, min: 100, max: 512_000, step: 100 },
  { value: 'GB', factor: 1024, min: 1, max: 500 },
]

function UnitInputExample() {
  const [size, setSize] = useState<number | null>(16)
  const [sizeUnit, setSizeUnit] = useState('px')
  const [weight, setWeight] = useState<number | null>(2)
  const [weightUnit, setWeightUnit] = useState('kg')
  return (
    <div className="grid w-full gap-5 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Field label="Font size" hint="Switch to rem: 16px becomes 1rem.">
          <UnitInput label="Font size" units={LENGTH} value={size} onValueChange={setSize} unit={sizeUnit} onUnitChange={setSizeUnit} />
        </Field>
        <Readout label="value" value={size === null ? '' : `${size}${sizeUnit}`} />
      </div>
      <div className="flex flex-col gap-2">
        <Field label="Parcel weight" hint="Up to 70 kg. Shift+Arrow steps by 10.">
          <UnitInput label="Parcel weight" units={WEIGHT} value={weight} onValueChange={setWeight} unit={weightUnit} onUnitChange={setWeightUnit} />
        </Field>
        <Readout label="value" value={weight === null ? '' : `${weight} ${weightUnit}`} />
      </div>
      <Field label="Volume size" hint="Converted when the unit changes.">
        <UnitInput label="Volume size" units={STORAGE} defaultUnit="GB" defaultValue={20} />
      </Field>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'scoped-search': {
    description:
      'A search field with a scope selector inside it — All, Docs, Issues, People — and suggestions narrowed to that scope. Typing “in:issues ” sets the scope from the keyboard and lifts the token out of the text. Suggestions follow the editable-combobox pattern: arrows highlight, Enter on a highlight opens it, Enter with nothing highlighted submits the query with its scope, and Escape closes the list.',
    sections: [
      { title: 'Example', description: 'Type “re”, then try “in:people ra”. Enter with nothing highlighted submits.', bare: true, Content: ScopedSearchExample },
      {
        title: 'States',
        specimens: [
          { label: 'defaultScope', fill: true, node: <ScopedSearch label="Search docs" defaultScope="docs" suggestions={SUGGESTIONS} className="max-w-[420px]" /> },
          { label: 'disabled', fill: true, node: <ScopedSearch label="Search, disabled" disabled className="max-w-[420px]" /> },
        ],
      },
      rationale(
        'One global search mixes people, issues and documents, and the reader filters the results by eye.',
        'A scope inside the field stays visible while typing and travels with the query; the in: token serves people who never leave the keyboard.',
        'Workspace search in a header, a help centre, an issue tracker, an admin console.',
        ['select', 'input role=combobox', 'listbox', 'Portal', 'overlay stack'],
      ),
    ],
    props: [
      { name: 'scopes', type: 'ScopedSearchScope[]', defaultValue: 'All, Docs, Issues, People', description: 'The scopes on offer. A first scope called all shows every suggestion.' },
      { name: 'scope / defaultScope', type: 'string', description: 'The chosen scope.' },
      { name: 'onScopeChange', type: '(scope: string) => void', description: 'From the selector or an in: token.' },
      { name: 'value / defaultValue', type: 'string', description: 'The query text.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Every keystroke.' },
      { name: 'suggestions', type: 'ScopedSearchSuggestion[]', description: 'Candidates, filtered by scope and label.' },
      { name: 'filterSuggestions', type: 'boolean', defaultValue: 'true', description: 'Set false when a server already filtered them.' },
      { name: 'maxSuggestions', type: 'number', defaultValue: '6', description: 'Most shown at once.' },
      { name: 'onSubmit', type: '(query, scope) => void', description: 'Enter without a highlighted suggestion.' },
      { name: 'onSuggestionSelect', type: '(suggestion) => void', description: 'A suggestion was chosen.' },
      { name: 'recognizeTokens', type: 'boolean', defaultValue: 'true', description: 'Turn a typed in:docs into the scope.' },
      { name: 'label / placeholder', type: 'string', defaultValue: "'Search'", description: 'Accessible name and hint text.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks both controls.' },
    ],
  },

  'alphabet-index': {
    description:
      'An A–Z rail for a long grouped list. Choosing a letter scrolls to that group and moves focus to its heading, so the next Tab carries on from there. Letters with no entries stay in place, disabled, so the rail never shifts. It is one tab stop — arrows move along it, skipping empty letters, and typing a letter jumps to it — and on touch, dragging along the rail scrubs through the groups.',
    sections: [
      { title: 'Example', description: 'Headings are found by id: contacts-letter-A, contacts-letter-B…', bare: true, Content: AlphabetIndexExample },
      { title: 'Horizontal', description: 'Custom letters, with a leading #.', Content: AlphabetHorizontalExample },
      rationale(
        'Reaching S in four hundred contacts means a long scroll, and a jump that only scrolls leaves keyboard focus back at the top.',
        'Moving focus to the group heading makes the jump real for keyboard and screen reader users; disabled letters keep the rail stable between lists.',
        'Contact lists, member directories, glossaries, country pickers, music libraries.',
        ['role=toolbar', 'roving tabindex', 'Pointer Events', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'letters', type: 'string[]', defaultValue: 'A–Z', description: 'The letters on the rail, in order.' },
      { name: 'available', type: 'string[]', description: 'Letters with entries. Others are disabled. Omit to enable all.' },
      { name: 'targetIdPrefix', type: 'string', defaultValue: "'letter-'", description: 'Headings are found by id prefix + letter.' },
      { name: 'getTarget', type: '(letter) => HTMLElement | null', description: 'Find the heading yourself instead.' },
      { name: 'onJump', type: '(letter: string) => void', description: 'After a jump.' },
      { name: 'current', type: 'string', description: 'The letter to mark as current.' },
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Rail beside the list, or a row above it.' },
      { name: 'label', type: 'string', defaultValue: "'Jump to letter'", description: 'Accessible name.' },
      { name: 'scrub', type: 'boolean', defaultValue: 'true', description: 'Drag along the rail on touch to jump as you go.' },
    ],
  },

  'recent-items': {
    description:
      'Recently viewed documents, files and projects, each with its icon, where it lives and how long ago it was opened. Pinning keeps a row above the time-ordered list; removing a row, or clearing the unpinned ones, forgets them. Pin and remove are named buttons of their own, focus moves sensibly when a row goes, and with a storage key the list survives a reload.',
    sections: [
      { title: 'Example', description: 'Pin, remove and clear, then reload the page: the list is kept in localStorage.', bare: true, Content: RecentItemsExample },
      {
        title: 'States',
        specimens: [{ label: 'empty', fill: true, node: <RecentItems title="Recently viewed" defaultItems={[]} className="max-w-[360px]" /> }],
      },
      rationale(
        'A recent list the reader cannot touch lets the one document they open daily drift off the end, and exposes everything on a shared screen.',
        'Pins give the reader a say in order; removal and clear are the privacy answer; clear leaves pins alone because they were curated by hand.',
        'Home screens, command palettes, file pickers, sidebars in docs and design tools.',
        ['relativeTime', 'Text', 'VisuallyHidden', 'localStorage'],
      ),
    ],
    props: [
      { name: 'items / defaultItems', type: 'RecentItemsItem[]', description: 'The list. Rows sort by viewedAt, pinned first.' },
      { name: 'onItemsChange', type: '(items) => void', description: 'After pin, removal or clear.' },
      { name: 'onOpen', type: '(item) => void', description: 'A row was opened.' },
      { name: 'storageKey', type: 'string', description: 'Uncontrolled only: persist in localStorage under this key.' },
      { name: 'max', type: 'number', defaultValue: '8', description: 'Most unpinned rows shown.' },
      { name: 'title', type: 'string', defaultValue: "'Recent'", description: 'The heading.' },
      { name: 'headingLevel', type: "'h2' | 'h3' | 'h4'", defaultValue: "'h3'", description: 'Fits the page outline.' },
      { name: 'emptyMessage', type: 'ReactNode', description: 'Shown with nothing to list.' },
    ],
  },

  'social-login-buttons': {
    description:
      '“Continue with” buttons for Google, GitHub, Microsoft, Apple, GitLab and Slack. The marks are drawn in the text colour on one shared button style, so the providers read as equal options instead of a row of brand colours. Stacked buttons say the whole phrase; the icon row keeps it as the accessible name and tooltip. The chosen provider shows a spinner while the others wait, and the one used last time gets a quiet hint.',
    sections: [
      { title: 'Example', description: 'Each sign-in takes 1.5 seconds here.', bare: true, Content: SocialLoginExample },
      {
        title: 'Layouts',
        specimens: [
          { label: "layout='row'", node: <SocialLoginButtons layout="row" providers={['google', 'github', 'microsoft', 'apple', 'gitlab', 'slack']} lastUsed="slack" /> },
          { label: 'loadingProvider', node: <SocialLoginButtons providers={['gitlab', 'slack']} loadingProvider="gitlab" className="w-[300px]" /> },
          { label: 'disabled', node: <SocialLoginButtons providers={['google']} disabled className="w-[300px]" /> },
        ],
      },
      rationale(
        'Brand-coloured provider buttons turn a sign-in card into adverts, and people forget which provider they signed up with.',
        'Monochrome marks keep the page’s palette and make the options equal; a last-used hint answers the forgotten-provider problem at the moment it matters.',
        'Sign-in and sign-up cards, invite acceptance, account linking in settings.',
        ['Spinner', 'VisuallyHidden', 'inline SVG'],
      ),
    ],
    props: [
      { name: 'providers', type: 'SocialLoginButtonsProvider[]', defaultValue: 'google, github, microsoft, apple', description: 'Which to offer, in order.' },
      { name: 'layout', type: "'stack' | 'row'", defaultValue: "'stack'", description: 'Labelled buttons, or a row of marks.' },
      { name: 'onSelect', type: '(provider) => void | Promise<void>', description: 'Start sign-in. A promise shows the pending state.' },
      { name: 'onError', type: '(provider, reason) => void', description: 'When onSelect rejects.' },
      { name: 'loadingProvider', type: 'SocialLoginButtonsProvider | null', description: 'Controlled pending state, for redirects.' },
      { name: 'lastUsed', type: 'SocialLoginButtonsProvider | null', description: 'Gets a Last used hint.' },
      { name: 'verb', type: 'string', defaultValue: "'Continue with'", description: 'Words before the provider name.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks every button.' },
    ],
  },

  'unsaved-changes-bar': {
    description:
      'A bar that slides up while a form has unsaved changes: the sentence, Discard with a confirmation, and Save with a pending state. Ctrl+S or ⌘S saves from anywhere on the page, the arrival is announced without moving focus, and the browser’s leave-page warning can be turned on. When the form is clean the bar is hidden and out of the tab order.',
    sections: [
      { title: 'Example', description: 'Edit any field. Save takes a moment; Discard asks first. Try Ctrl+S.', bare: true, Content: UnsavedChangesExample },
      rationale(
        'On a long settings page Save sits at the bottom, so a change made near the top is easy to leave behind.',
        'A bar that exists only while the form is dirty makes the state visible wherever the reader is, and the shortcut is the one every editor taught them.',
        'Settings pages, profile editors, CMS entries, any form that does not autosave.',
        ['Button', 'ConfirmPopover', 'Kbd', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'dirty', type: 'boolean', description: 'The bar shows while true.' },
      { name: 'onSave', type: '() => void | Promise<void>', description: 'A promise shows Save as pending; a rejection shows its message.' },
      { name: 'onDiscard', type: '() => void', description: 'Throw the changes away.' },
      { name: 'message', type: 'ReactNode', defaultValue: "'You have unsaved changes'", description: 'The sentence on the bar.' },
      { name: 'saveLabel / discardLabel', type: 'string', defaultValue: "'Save changes' / 'Discard'", description: 'Button text.' },
      { name: 'confirmDiscard', type: 'boolean', defaultValue: 'true', description: 'Ask before discarding.' },
      { name: 'shortcut', type: 'boolean', defaultValue: 'true', description: 'Ctrl+S / ⌘S saves while dirty.' },
      { name: 'warnOnLeave', type: 'boolean', defaultValue: 'false', description: 'Browser prompt when leaving while dirty.' },
      { name: 'position', type: "'sticky' | 'fixed' | 'static'", defaultValue: "'sticky'", description: 'Where the bar sits.' },
    ],
  },

  'vote-buttons': {
    description:
      'Up and down votes with the score between them, as on a Q&A site. Each arrow is a toggle button with aria-pressed; pressing the lit one withdraws the vote and pressing the other switches it in one step. The vote shows at once and saves behind it — if the save fails, arrows and score roll back and onError is told. Vertical or horizontal.',
    sections: [
      { title: 'Example', description: 'Tick the box to make saves fail and watch the vote roll back.', bare: true, Content: VoteExample },
      {
        title: 'States',
        specimens: [
          { label: 'up', node: <VoteButtons subject="post, voted up" defaultVote="up" defaultScore={42} /> },
          { label: 'down', node: <VoteButtons subject="post, voted down" defaultVote="down" defaultScore={-3} /> },
          { label: "orientation='horizontal'", node: <VoteButtons subject="reply" orientation="horizontal" defaultScore={1204} /> },
          { label: 'disabled', node: <VoteButtons subject="your own post" disabled defaultScore={12} /> },
        ],
      },
      rationale(
        'Waiting for the server makes a vote feel broken, and not waiting can show a vote that never saved.',
        'Optimistic with rollback gives both: instant feedback, and the truth when a save fails. Toggle buttons make the state audible.',
        'Q&A answers, forum threads, feature request boards, comment ranking.',
        ['button aria-pressed', 'live region'],
      ),
    ],
    props: [
      { name: 'vote / defaultVote', type: "'up' | 'down' | null", defaultValue: 'null', description: 'The reader’s vote.' },
      { name: 'score / defaultScore', type: 'number', defaultValue: '0', description: 'Including the reader’s own vote.' },
      { name: 'onVoteChange', type: '(vote) => void | Promise<void>', description: 'Save. A rejection rolls back.' },
      { name: 'onError', type: '(reason) => void', description: 'After a rollback.' },
      { name: 'subject', type: 'string', description: 'Names the buttons: “Upvote answer”.' },
      { name: 'orientation', type: "'vertical' | 'horizontal'", defaultValue: "'vertical'", description: 'Column or row.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Button size.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks voting.' },
    ],
  },

  'follow-button': {
    description:
      'A Follow toggle that reads Following once pressed and offers Unfollow, reddened, only on hover or keyboard focus — and not straight after following, while the pointer is still on it. The accessible name stays “Follow Ada Okonkwo” with aria-pressed carrying the state, and both labels share one grid cell so the width never jumps. An optional follower count sits beside it.',
    sections: [
      { title: 'Example', description: 'Follow, move away, then hover to see Unfollow.', bare: true, Content: FollowExample },
      {
        title: 'States',
        specimens: [
          { label: 'default', node: <FollowButton name="Klyv" /> },
          { label: 'defaultFollowing', node: <FollowButton name="Design systems" defaultFollowing /> },
          { label: "size='sm' + count", node: <FollowButton name="Rosa Lindqvist" size="sm" followerCount={1} /> },
          { label: 'disabled', node: <FollowButton name="Private account" disabled /> },
        ],
      },
      rationale(
        'A Following button that unfollows on click is a trap, and a label that flips to Unfollow contradicts itself for screen readers.',
        'State at rest, action on intent, a stable name with aria-pressed — and no width jump under the pointer.',
        'Profiles, author bylines, topic and tag pages, repository and project headers.',
        ['button aria-pressed', 'Spinner', 'internal icons'],
      ),
    ],
    props: [
      { name: 'following / defaultFollowing', type: 'boolean', defaultValue: 'false', description: 'Whether the reader follows.' },
      { name: 'onFollowingChange', type: '(following) => void | Promise<void>', description: 'Save. Pending until it settles; a rejection changes nothing.' },
      { name: 'onError', type: '(reason) => void', description: 'When saving fails.' },
      { name: 'name', type: 'string', description: 'Who is followed. Accessible name: “Follow {name}”.' },
      { name: 'followerCount', type: 'number', description: 'Shown beside the button and used as its description.' },
      { name: 'countNoun', type: 'string', defaultValue: "'followers'", description: 'The noun for the count.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Button height.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks the toggle.' },
    ],
  },

  'add-to-calendar': {
    description:
      'A menu button that adds an event to Google Calendar, Outlook.com, Office 365 or Yahoo through their own links, or downloads an .ics for Apple Calendar and everything else. The file is generated in the browser with UTC times, escaped text and folded lines, as RFC 5545 requires. The panel repeats the title, time with its zone and place, so nobody adds the wrong session.',
    sections: [
      { title: 'Example', bare: true, Content: AddToCalendarExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'allDay', node: <AddToCalendar event={OFFSITE} /> },
          { label: 'providers + no summary', node: <AddToCalendar event={LAUNCH} providers={['google', 'ics']} showSummary={false} label="Save the date" /> },
        ],
      },
      rationale(
        'There is no universal add-to-calendar link: each web calendar has its own URL, and desktop apps only take a file that is easy to get subtly wrong.',
        'Real links for the web calendars, a correct generated .ics for the rest, and a summary so the reader can check before adding.',
        'Event pages, webinar sign-up confirmations, booking receipts, release announcements.',
        ['Popover', 'Button', 'Text', 'Blob'],
      ),
    ],
    props: [
      { name: 'event', type: 'AddToCalendarEvent', description: 'title, start, end (exclusive), allDay, description, location, url, uid.' },
      { name: 'providers', type: 'AddToCalendarProvider[]', defaultValue: 'google, outlook, office365, yahoo, ics', description: 'Options, in order.' },
      { name: 'label', type: 'ReactNode', defaultValue: "'Add to calendar'", description: 'Trigger text.' },
      { name: 'variant / size', type: 'ButtonVariant / ButtonSize', defaultValue: "'outline' / 'sm'", description: 'Trigger button look.' },
      { name: 'fileName', type: 'string', description: 'The .ics name without extension. Defaults to a slug of the title.' },
      { name: 'showSummary', type: 'boolean', defaultValue: 'true', description: 'Title, time and place above the options.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', description: 'Where the panel opens.' },
      { name: 'onSelect', type: '(provider) => void', description: 'After an option is chosen.' },
    ],
  },

  'weekday-picker': {
    description:
      'Seven day chips in the order the locale’s week runs, with names from Intl, and Weekdays, Weekends and Every day shortcuts that also follow the locale’s weekend. The value is always getDay() numbers whatever the display order. The chips are toggle buttons in a labelled group with one tab stop: arrows move between days, Space toggles.',
    sections: [
      { title: 'Example', description: 'Switch locale: en-US starts on Sunday, and ar-EG’s weekend is Friday and Saturday.', bare: true, Content: WeekdayExample },
      {
        title: 'States',
        specimens: [
          { label: "size='sm'", node: <WeekdayPicker label="Remind me on" size="sm" presets={false} defaultValue={[1, 2, 3, 4, 5]} locale="en-GB" /> },
          { label: 'weekStartsOn={0}', node: <WeekdayPicker label="Office days" weekStartsOn={0} presets={false} defaultValue={[2, 4]} locale="en-GB" /> },
          { label: 'disabled', node: <WeekdayPicker label="Delivery days" disabled defaultValue={[6]} locale="en-GB" /> },
        ],
      },
      rationale(
        'Hard-coded Mon–Sun order and a Saturday–Sunday weekend are wrong for much of the world.',
        'Intl gives order, names and weekend per locale for free, while a getDay() value keeps scheduling code locale-free.',
        'Recurring events, alarm and reminder schedules, delivery windows, opening hours.',
        ['button aria-pressed', 'role=group', 'Intl.Locale weekInfo', 'Intl.DateTimeFormat'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'WeekdayPickerDay[]', defaultValue: '[]', description: 'Selected days as getDay() numbers, 0 = Sunday.' },
      { name: 'onValueChange', type: '(value) => void', description: 'Sorted ascending.' },
      { name: 'label', type: 'string', description: 'The group’s visible name.' },
      { name: 'hideLabel', type: 'boolean', defaultValue: 'false', description: 'Keep the name for assistive tech only.' },
      { name: 'locale', type: 'string', description: 'Day names, first day and weekend.' },
      { name: 'weekStartsOn', type: 'WeekdayPickerDay', description: 'Override the first day.' },
      { name: 'presets', type: 'boolean', defaultValue: 'true', description: 'Weekdays, Weekends, Every day.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'sm uses narrow day names.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks every chip.' },
    ],
  },

  'unit-input': {
    description:
      'A number joined to its unit — px, rem and %; kg and lb; MB and GB. Changing the unit converts the number where both units have a factor, so 16px becomes 1rem, and leaves it alone where they do not. Limits and step belong to each unit. The number is a spinbutton: arrows step, Shift steps by ten, and typed text is clamped when committed with Enter or by leaving the field.',
    sections: [
      { title: 'Example', bare: true, Content: UnitInputExample },
      {
        title: 'States',
        specimens: [
          { label: "size='sm'", node: <UnitInput label="Gap" size="sm" units={LENGTH} defaultValue={8} className="w-[160px]" /> },
          { label: 'convert={false}', node: <UnitInput label="Width" units={LENGTH} convert={false} defaultValue={50} className="w-[160px]" /> },
          { label: 'invalid', node: <UnitInput label="Height, invalid" units={LENGTH} invalid defaultValue={null} placeholder="Required" className="w-[160px]" /> },
          { label: 'disabled', node: <UnitInput label="Radius, disabled" units={LENGTH} disabled defaultValue={12} className="w-[160px]" /> },
        ],
      },
      rationale(
        'A bare number is ambiguous, and a unit dropdown elsewhere on the form falls out of step with the number it qualifies.',
        'Joining them keeps the pair together; converting on unit change keeps the quantity, and per-unit limits keep the bounds sensible.',
        'Design tools and theme editors, shipping forms, quota and storage settings, recipe scaling.',
        ['input role=spinbutton', 'select', 'Field conventions'],
      ),
    ],
    props: [
      { name: 'units', type: 'UnitInputUnit[]', description: 'value, label, factor, min, max, step for each unit.' },
      { name: 'value / defaultValue', type: 'number | null', defaultValue: 'null', description: 'The number. null is empty.' },
      { name: 'onValueChange', type: '(value) => void', description: 'On Enter, blur, arrows and converted unit changes.' },
      { name: 'unit / defaultUnit', type: 'string', description: 'The unit. Defaults to the first.' },
      { name: 'onUnitChange', type: '(unit) => void', description: 'When the unit changes.' },
      { name: 'convert', type: 'boolean', defaultValue: 'true', description: 'Convert when both units have a factor.' },
      { name: 'precision', type: 'number', defaultValue: '2', description: 'Decimal places kept after converting.' },
      { name: 'label', type: 'string', description: 'Accessible name for the number.' },
      { name: 'unitLabel', type: 'string', defaultValue: "'Unit'", description: 'Accessible name for the selector.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Control height.' },
      { name: 'invalid / disabled / required / id', type: '—', description: 'Field forwards these.' },
    ],
  },
}
