import { useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  DockLayout,
  DraftRecovery,
  Field,
  FullTextSearch,
  FuzzyFinder,
  Input,
  JustifiedText,
  MessageFormat,
  MessageFormatError,
  PairwiseRanker,
  QueryBar,
  Select,
  Slider,
  Switch,
  TabCoordinator,
  Text,
  Textarea,
  UrlState,
  formatMessage,
  fuzzyScore,
  matchesQuery,
  parseMessage,
  pluralCategories,
  urlStateCodecs,
  useDraftRecovery,
  useTabMessages,
  useUrlState,
  type DockLayoutNode,
  type FullTextSearchDocument,
  type FuzzyFinderItem,
  type JustifiedTextLine,
  type MessageFormatNode,
  type QueryBarParseResult,
  type QueryBarSchema,
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

/* -------------------------------------------------------- message format */

const PRESETS = [
  { value: 'files', label: 'Files', pattern: '{count, plural, =0 {No files yet} one {# file uploaded} other {# files uploaded}}' },
  {
    value: 'six',
    label: 'Six forms',
    pattern: '{count, plural, zero {zero: # items} one {one: # item} two {two: # items, dual} few {few: # items} many {many: # items} other {other: # items}}',
  },
  { value: 'ordinal', label: 'Ordinal', pattern: 'You finished {count, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} of 40.' },
  {
    value: 'guests',
    label: 'Select + offset',
    pattern:
      '{host} invited {count, plural, offset:1 =0 {nobody} =1 {{guest}} one {{guest} and # other person} other {{guest} and # other people}} to {gender, select, female {her} male {his} other {their}} party.',
  },
  { value: 'broken', label: 'Broken', pattern: '{count, plural, one {# file} few {# files}' },
]

const LOCALES = [
  { value: 'en', label: 'English (en)' },
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'cy', label: 'Welsh (cy)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'ja', label: 'Japanese (ja)' },
]

function covered(nodes: MessageFormatNode[], found = { cardinal: new Set<string>(), ordinal: new Set<string>() }) {
  for (const node of nodes) {
    if (node.type === 'plural' || node.type === 'selectordinal') {
      Object.keys(node.options).forEach((key) => found[node.type === 'plural' ? 'cardinal' : 'ordinal'].add(key))
    }
    if (node.type === 'plural' || node.type === 'selectordinal' || node.type === 'select') Object.values(node.options).forEach((child) => covered(child, found))
  }
  return found
}

function Categories({ title, needed, has }: { title: string; needed: string[]; has: Set<string> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Text size="caption" weight="bold" tone="faint" className="w-16">
        {title}
      </Text>
      {needed.map((category) => (
        <span
          key={category}
          className={
            has.has(category) || category === 'other'
              ? 'rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-ink'
              : 'rounded-full border border-dashed border-danger px-2 py-0.5 font-mono text-[11px] font-semibold text-danger'
          }
        >
          {category}
          {has.has(category) || category === 'other' ? '' : ' missing'}
        </span>
      ))}
    </div>
  )
}

function MessageFormatExample() {
  const [preset, setPreset] = useState('files')
  const [pattern, setPattern] = useState(PRESETS[0].pattern)
  const [locale, setLocale] = useState('en')
  const [count, setCount] = useState(3)
  const [gender, setGender] = useState('female')
  const values = { count, host: 'Ana', guest: 'Ben', gender }

  let error: MessageFormatError | null = null
  let tree: MessageFormatNode[] = []
  try {
    tree = parseMessage(pattern)
  } catch (reason) {
    if (reason instanceof MessageFormatError) error = reason
  }
  const has = covered(tree)
  const usesOrdinal = tree.length > 0 && has.ordinal.size > 0

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_110px_130px]">
        <Field label="Preset">
          <Select
            label="Preset"
            options={PRESETS.map(({ value, label }) => ({ value, label }))}
            value={preset}
            onValueChange={(next) => {
              setPreset(next)
              setPattern(PRESETS.find((item) => item.value === next)!.pattern)
            }}
            fullWidth
          />
        </Field>
        <Field label="Locale">
          <Select label="Locale" options={LOCALES} value={locale} onValueChange={setLocale} fullWidth />
        </Field>
        <Field label="count">
          <Input type="number" step="any" value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </Field>
        <Field label="gender">
          <Select
            label="gender"
            options={[
              { value: 'female', label: 'female' },
              { value: 'male', label: 'male' },
              { value: 'other', label: 'other' },
            ]}
            value={gender}
            onValueChange={setGender}
            fullWidth
          />
        </Field>
      </div>
      <Field label="Pattern" hint="ICU MessageFormat. Edit it — errors point at the character.">
        <Textarea rows={3} value={pattern} onChange={(event) => setPattern(event.target.value)} className="font-mono text-[12px]" spellCheck={false} />
      </Field>
      {error ? (
        <div className="flex flex-col gap-1 rounded-[var(--radius-tile)] border border-danger p-3" role="alert">
          <Text size="label" weight="bold" tone="danger">
            {error.message} (at character {error.offset + 1})
          </Text>
          <pre className="overflow-x-auto font-mono text-[12px] leading-5 text-ink">
            {pattern.replace(/\n/g, ' ')}
            {'\n'}
            <span className="text-danger">{' '.repeat(error.offset)}^</span>
          </pre>
        </div>
      ) : (
        <div className="rounded-[var(--radius-tile)] bg-surface-sunken p-4" aria-live="polite">
          <MessageFormat message={pattern} values={values} locale={locale} className="text-[18px] font-bold text-ink" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Categories title="cardinal" needed={pluralCategories(locale)} has={has.cardinal} />
        {usesOrdinal && <Categories title="ordinal" needed={pluralCategories(locale, 'ordinal')} has={has.ordinal} />}
      </div>
      {!error && (
        <table className="w-full border-collapse text-left text-[12px]">
          <caption className="sr-only">Output for sample counts in {locale}</caption>
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th scope="col" className="py-1.5 pr-3 font-semibold">count</th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">category</th>
              <th scope="col" className="py-1.5 font-semibold">output</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 5, 11, 22, 101, 1.5].map((sample) => (
              <tr key={sample} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3 font-mono tabular-nums text-ink">{sample}</td>
                <td className="py-1.5 pr-3 font-mono text-ink-soft">{new Intl.PluralRules(locale, { type: usesOrdinal ? 'ordinal' : 'cardinal' }).select(sample)}</td>
                <td className="py-1.5 font-medium text-ink">{formatMessage(pattern, { ...values, count: sample }, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* --------------------------------------------------------- justified text */

const PARAGRAPH =
  'Typography is the craft of endowing human language with a durable visual form. When a paragraph is justified, every line must reach the same measure, and the question is where to break it. A browser answers one line at a time: it fills a line as far as it can and then stretches whatever spaces it has, so a single long word such as internationalization or incomprehensibilities can leave a line of gaping holes. Knuth and Plass instead considered the paragraph as a whole, weighing every possible set of breaks and choosing the one whose worst lines are least bad, with hyphenation offering extra places to break when the spacing would otherwise suffer.'

function JustifiedTextExample() {
  const [width, setWidth] = useState(300)
  const [hyphenate, setHyphenate] = useState(true)
  const [bars, setBars] = useState(true)
  const [lines, setLines] = useState<JustifiedTextLine[]>([])
  const body = lines.filter((line) => !line.last)
  const worst = body.reduce((max, line) => Math.max(max, Math.abs(line.ratio)), 0)
  const loose = body.filter((line) => Math.abs(line.ratio) > 1).length

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-3 text-[12px] font-semibold text-ink">
          Measure
          <Slider value={width} min={200} max={520} step={10} onChange={(event) => setWidth(Number(event.target.value))} className="w-40" aria-valuetext={`${width} pixels`} />
          <span className="w-12 font-mono tabular-nums text-ink-soft">{width}px</span>
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
          <Switch checked={hyphenate} onChange={(event) => setHyphenate(event.target.checked)} />
          Hyphenate
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
          <Checkbox checked={bars} onChange={(event) => setBars(event.target.checked)} />
          Show stretch per line
        </label>
      </div>
      <div className="flex flex-wrap gap-8">
        <div className="flex flex-col gap-2" style={{ width }}>
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Knuth–Plass
          </Text>
          <JustifiedText hyphenate={hyphenate} showRatios={bars} onLayout={setLines}>
            {PARAGRAPH}
          </JustifiedText>
          <Text size="caption" tone="faint">
            {lines.length} lines · {lines.filter((line) => line.hyphenated).length} hyphens · worst stretch {worst.toFixed(2)} · {loose} over 1
          </Text>
        </div>
        <div className="flex flex-col gap-2" style={{ width }}>
          <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Browser, text-align: justify
          </Text>
          <p className="text-justify font-sans text-[14px] leading-[1.6] text-ink">{PARAGRAPH}</p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- tab coordinator */

function TabCoordinatorExample() {
  const [quote, setQuote] = useState<{ price: number; from: string; at: number } | null>(null)
  const quotes = useTabMessages<{ price: number }>('klyv-demo-quotes', {
    keep: 0,
    onMessage: ({ data, from, at }) => setQuote({ price: data.price, from, at }),
  })
  const post = useRef(quotes.post)
  post.current = quotes.post

  // Only the leader "polls"; everyone else hears the result on the channel.
  const poll = () => {
    let price = 182.4
    const tick = () => {
      price = Math.round((price + (Math.random() - 0.5) * 2) * 100) / 100
      post.current({ price })
      setQuote({ price, from: 'this tab', at: Date.now() })
    }
    tick()
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text size="label" tone="soft">
          Open this page in a second tab, then close whichever tab is the leader.
        </Text>
        <Button as="a" href={typeof window === 'undefined' ? '#' : window.location.href} target="_blank" rel="noopener" size="sm" variant="outline">
          Open another tab
        </Button>
      </div>
      <TabCoordinator name="klyv-docs-demo" label="Tabs on this page" onAcquire={poll} />
      <div className="flex items-baseline gap-3 rounded-[var(--radius-tile)] bg-surface-sunken p-3">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          ACME price
        </Text>
        <span className="font-mono text-[18px] font-bold tabular-nums text-ink">{quote ? `$${quote.price.toFixed(2)}` : '—'}</span>
        <Text size="caption" tone="faint">
          {quote ? `polled by ${quote.from}` : 'waiting for the leader'}
        </Text>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- url state */

const CATEGORIES = ['all', 'audio', 'desk', 'lighting'] as const
const TAGS = ['sale', 'new', 'eco']
const PRODUCTS = [
  { name: 'Walnut monitor stand', category: 'desk', price: 89, stock: true, tags: ['eco'], added: '2025-11-02' },
  { name: 'Oak desk shelf', category: 'desk', price: 129, stock: false, tags: ['new', 'eco'], added: '2026-06-18' },
  { name: 'Cable tray', category: 'desk', price: 24, stock: true, tags: ['sale'], added: '2024-03-09' },
  { name: 'Studio headphones', category: 'audio', price: 199, stock: true, tags: ['new'], added: '2026-08-01' },
  { name: 'Desk speakers', category: 'audio', price: 149, stock: true, tags: ['sale'], added: '2025-01-12' },
  { name: 'USB microphone', category: 'audio', price: 119, stock: false, tags: [], added: '2025-07-30' },
  { name: 'Clamp lamp', category: 'lighting', price: 59, stock: true, tags: ['sale', 'eco'], added: '2024-10-21' },
  { name: 'Light bar', category: 'lighting', price: 79, stock: true, tags: ['new'], added: '2026-05-05' },
  { name: 'Paper floor lamp', category: 'lighting', price: 139, stock: true, tags: ['eco'], added: '2023-12-01' },
]

function UrlStateExample() {
  const [query, setQuery] = useUrlState('q', '', urlStateCodecs.string, { debounce: 300 })
  const [category, setCategory] = useUrlState('cat', 'all', urlStateCodecs.enum(CATEGORIES), { history: 'push' })
  const [inStock, setInStock] = useUrlState('stock', false, urlStateCodecs.boolean, { history: 'push' })
  const [maxPrice, setMaxPrice] = useUrlState('max', 200, urlStateCodecs.number)
  const [tags, setTags] = useUrlState<string[]>('tags', [], urlStateCodecs.array(urlStateCodecs.string), { history: 'push' })
  const [since, setSince] = useUrlState<Date | null>('since', null, urlStateCodecs.date, { history: 'push' })

  const shown = PRODUCTS.filter(
    (product) =>
      product.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === 'all' || product.category === category) &&
      (!inStock || product.stock) &&
      product.price <= maxPrice &&
      tags.every((tag) => product.tags.includes(tag)) &&
      (!since || new Date(product.added) >= since),
  )

  const reset = () => {
    // Six setters in one handler: one history entry.
    setQuery('')
    setCategory('all')
    setInStock(false)
    setMaxPrice(200)
    setTags([])
    setSince(null)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Search" hint="Debounced 300 ms, replaces the entry.">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="lamp, desk…" />
        </Field>
        <Field label="Category" hint="Each change is a Back step.">
          <Select label="Category" options={CATEGORIES.map((value) => ({ value, label: value }))} value={category} onValueChange={setCategory} fullWidth />
        </Field>
        <Field label={`Up to $${maxPrice}`} hint="Replaces the entry while you drag.">
          <Slider value={maxPrice} min={20} max={200} step={10} onChange={(event) => setMaxPrice(Number(event.target.value))} />
        </Field>
        <Field label="Added since" hint="An ISO day in the URL.">
          <Input
            type="date"
            value={since ? since.toISOString().slice(0, 10) : ''}
            onChange={(event) => setSince(event.target.value ? new Date(`${event.target.value}T00:00:00Z`) : null)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink">
          <Switch checked={inStock} onChange={(event) => setInStock(event.target.checked)} />
          In stock only
        </label>
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Tags</legend>
          {TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <Checkbox checked={tags.includes(tag)} onChange={(event) => setTags((list) => (event.target.checked ? [...list, tag] : list.filter((item) => item !== tag)))} />
              {tag}
            </label>
          ))}
        </fieldset>
        <Button size="sm" variant="ghost" onClick={reset} className="ml-auto">
          Reset all
        </Button>
      </div>
      <UrlState keys={['q', 'cat', 'stock', 'max', 'tags', 'since']} label="This page’s query" />
      <ul className="grid gap-2 sm:grid-cols-3" aria-label="Products">
        {shown.map((product) => (
          <li key={product.name} className="flex flex-col gap-0.5 rounded-[var(--radius-tile)] border border-line bg-surface p-3">
            <span className="text-[13px] font-bold text-ink">{product.name}</span>
            <span className="text-[12px] font-medium text-ink-faint">
              ${product.price} · {product.category}
              {product.stock ? '' : ' · sold out'}
            </span>
          </li>
        ))}
        {shown.length === 0 && <li className="text-[12px] font-medium text-ink-faint">Nothing matches these filters.</li>}
      </ul>
    </div>
  )
}

/* --------------------------------------------------------- draft recovery */

interface IssueDraft {
  title: string
  body: string
  labels: string[]
}
const SAVED: IssueDraft = { title: 'Export fails for large workspaces', body: 'Exports over 2 GB time out after 60 seconds.', labels: ['bug'] }
const SAVED_AT = Date.now() - 86_400_000

function IssueEditor({ onReload }: { onReload: () => void }) {
  const [value, setValue] = useState<IssueDraft>(SAVED)
  const [submitted, setSubmitted] = useState(false)
  const recovery = useDraftRecovery<IssueDraft>({
    storageKey: 'klyv-docs-issue-42',
    value,
    savedAt: SAVED_AT,
    version: 2,
    // Version 1 kept labels as one comma-separated string.
    migrate: (old, from) => {
      if (from !== 1 || typeof old !== 'object' || old === null) return undefined
      const draft = old as { title: string; body: string; labels: string }
      return { title: draft.title, body: draft.body, labels: draft.labels.split(',').filter(Boolean) }
    },
    throttle: 800,
    onRestore: setValue,
  })

  return (
    <form
      className="flex w-full max-w-[560px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void recovery.clear()
        setSubmitted(true)
      }}
    >
      <DraftRecovery recovery={recovery} noun="edit" />
      <Field label="Title">
        <Input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea rows={4} value={value.body} onChange={(event) => setValue({ ...value, body: event.target.value })} />
      </Field>
      <fieldset className="flex items-center gap-3">
        <legend className="mb-1 text-[12px] font-semibold text-ink">Labels</legend>
        {['bug', 'export', 'p1'].map((label) => (
          <label key={label} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <Checkbox
              checked={value.labels.includes(label)}
              onChange={(event) => setValue({ ...value, labels: event.target.checked ? [...value.labels, label] : value.labels.filter((item) => item !== label) })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Save issue
        </Button>
        <Button size="sm" variant="outline" onClick={onReload}>
          Simulate a reload
        </Button>
        <Badge tone="neutral">{recovery.storage === 'pending' ? 'opening storage' : recovery.storage}</Badge>
        {submitted && (
          <Text size="caption" tone="success" weight="semibold">
            Saved — the draft was cleared.
          </Text>
        )}
      </div>
    </form>
  )
}

function DraftRecoveryExample() {
  const [mount, setMount] = useState(0)
  return (
    <div className="flex w-full flex-col gap-2">
      <Text size="label" tone="soft">
        Change something, wait a second, then reload — with the button or the browser.
      </Text>
      <IssueEditor key={mount} onReload={() => setMount((value) => value + 1)} />
    </div>
  )
}

/* ----------------------------------------------------------- fuzzy finder */

function paths(count: number): FuzzyFinderItem[] {
  const roots = ['src/components', 'src/lib', 'src/site/pages', 'src/site/examples', 'packages/core/src', 'packages/cli/src', 'test/interaction', 'docs/guides']
  const words = ['Button', 'Modal', 'Tooltip', 'DataTable', 'QueryBar', 'Popover', 'TabList', 'useUrlState', 'fuzzyScore', 'searchIndex', 'DockLayout', 'router', 'theme', 'Calendar', 'Avatar', 'Menu', 'FileUpload', 'Combobox', 'Pagination', 'Tree']
  const tails = ['.tsx', '.ts', '.test.tsx', '.css', '.md', '.stories.tsx']
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]
  const seen = new Set<string>()
  const items: FuzzyFinderItem[] = []
  while (items.length < count) {
    const word = pick(words)
    const path = `${pick(roots)}/${word}/${random() < 0.5 ? word : pick(words)}${random() < 0.3 ? Math.floor(random() * 90) : ''}${pick(tails)}`
    if (seen.has(path)) continue
    seen.add(path)
    items.push({ id: path, label: path })
  }
  return items
}

function FuzzyFinderExample() {
  const items = useMemo(() => paths(10_000), [])
  const [chosen, setChosen] = useState('')
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-2">
      <FuzzyFinder items={items} label="Go to file" placeholder="Try “cmpqb”, “usrst” or “test btn”" onSelect={(item) => setChosen(item.label)} />
      <Readout label="opened" value={chosen} />
    </div>
  )
}

function FuzzyScores() {
  const rows: [string, string][] = [
    ['btn', 'src/components/Button/Button.tsx'],
    ['btn', 'src/lib/bottom-navigation.ts'],
    ['usrst', 'src/lib/useUrlState.ts'],
    ['usrst', 'src/lib/user-settings.ts'],
    ['dl', 'src/components/DockLayout/layout.ts'],
    ['dl', 'src/components/Modal/dialog.tsx'],
  ]
  return (
    <table className="w-full border-collapse text-left text-[12px]">
      <caption className="sr-only">fuzzyScore results</caption>
      <thead>
        <tr className="border-b border-line text-ink-faint">
          <th scope="col" className="py-1.5 pr-3 font-semibold">query</th>
          <th scope="col" className="py-1.5 pr-3 font-semibold">text, matched letters marked</th>
          <th scope="col" className="py-1.5 text-right font-semibold">score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([query, text]) => {
          const match = fuzzyScore(query, text)
          return (
            <tr key={query + text} className="border-b border-line last:border-0">
              <td className="py-1.5 pr-3 font-mono text-ink">{query}</td>
              <td className="py-1.5 pr-3 font-mono text-ink-soft">
                {[...text].map((char, index) =>
                  match?.indices.includes(index) ? (
                    <mark key={index} className="bg-transparent font-bold text-accent-strong underline">
                      {char}
                    </mark>
                  ) : (
                    char
                  ),
                )}
              </td>
              <td className="py-1.5 text-right font-mono tabular-nums text-ink">{match ? match.score : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* -------------------------------------------------------- full text search */

interface Article extends FullTextSearchDocument {
  section: string
}

const ARTICLES: Article[] = [
  { id: 'sso', section: 'Security', title: 'Configuring single sign-on', body: 'Connect your identity provider with SAML or OpenID Connect. Test the connection with one account before you enforce single sign-on for everyone, and keep an owner who can still sign in with a password.' },
  { id: 'scim', section: 'Security', title: 'Provisioning users with SCIM', body: 'SCIM creates, updates and deactivates accounts from your identity provider. Deactivated users lose access immediately; their content stays and can be transferred.' },
  { id: '2fa', section: 'Security', title: 'Requiring two-factor authentication', body: 'Owners can require two-factor authentication for every member. Members without it are asked to set it up at their next sign-in and cannot skip the step.' },
  { id: 'invoices', section: 'Billing', title: 'Downloading invoices', body: 'Invoices are issued on the first of each month and emailed to the billing contact. Past invoices can be downloaded as PDF from the billing page.' },
  { id: 'seats', section: 'Billing', title: 'Adding and removing seats', body: 'Seats are billed per active member. Removing a member frees their seat at once, and the next invoice is prorated for the days it was in use.' },
  { id: 'tax', section: 'Billing', title: 'Tax IDs and VAT', body: 'Add a VAT number or tax ID to have it printed on invoices. In the EU, a valid VAT number applies the reverse charge and removes VAT from future invoices.' },
  { id: 'webhooks', section: 'Developers', title: 'Receiving webhooks', body: 'We send an HTTP POST to your endpoint when records change. Failed deliveries are retried with exponential backoff for up to three days, and every payload is signed.' },
  { id: 'rate', section: 'Developers', title: 'API rate limits', body: 'Each token may make 600 requests per minute. Responses carry the remaining budget in headers; a 429 response says how many seconds to wait before retrying.' },
  { id: 'tokens', section: 'Developers', title: 'Creating API tokens', body: 'Personal tokens act as you; workspace tokens act as a bot with the scopes you choose. Tokens are shown once, so store them in a secret manager.' },
  { id: 'export', section: 'Data', title: 'Exporting your workspace', body: 'Owners can export every project as JSON or CSV. Large workspaces are exported in the background and a download link is emailed when the export is ready.' },
  { id: 'retention', section: 'Data', title: 'Data retention and deletion', body: 'Deleted projects stay in the trash for thirty days and can be restored. After that they are permanently deleted, including from backups within ninety days.' },
  { id: 'import', section: 'Data', title: 'Importing from spreadsheets', body: 'Upload a CSV or Excel file, map its columns to fields, and preview the first rows before importing. Rows that fail validation are listed so you can fix and retry them.' },
]

const EXTRA: Article = {
  id: 'audit',
  section: 'Security',
  title: 'Reading the audit log',
  body: 'The audit log records sign-ins, permission changes, exports and token use. Filter it by member or action, and stream it to your SIEM over the webhook integration.',
}

function FullTextSearchExample() {
  const [documents, setDocuments] = useState(ARTICLES)
  const [chosen, setChosen] = useState('')
  const hasExtra = documents.some((document) => document.id === 'audit')
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <FullTextSearch
        documents={documents}
        label="Search help"
        placeholder="Try “invoice vat”, “retrying” or “provis”"
        onSelect={(document) => setChosen(document.title)}
        renderMeta={(document) => document.section}
        showScores
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setDocuments((list) => (hasExtra ? list.filter((item) => item.id !== 'audit') : [...list, EXTRA]))}>
          {hasExtra ? 'Remove “Reading the audit log”' : 'Add “Reading the audit log”'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDocuments((list) => list.filter((item) => item.id !== 'invoices'))} disabled={!documents.some((item) => item.id === 'invoices')}>
          Remove “Downloading invoices”
        </Button>
      </div>
      <Readout label="opened" value={chosen} />
    </div>
  )
}

/* -------------------------------------------------------------- query bar */

const ISSUE_SCHEMA: QueryBarSchema = {
  status: { type: 'enum', values: ['open', 'closed', 'draft'], description: 'open, closed, draft' },
  label: { type: 'enum', values: ['bug', 'docs', 'feature', 'good first issue'], description: 'repeatable' },
  priority: { type: 'enum', values: ['low', 'medium', 'high'] },
  assignee: { type: 'user', values: ['mira', 'tomas', 'ines', 'kofi'] },
  created: { type: 'date', description: 'YYYY-MM-DD, with > or <' },
  comments: { type: 'number', description: 'count, with > or <' },
}

const ISSUES = [
  { id: 412, title: 'Export fails for large workspaces', status: 'open', label: ['bug'], priority: 'high', assignee: 'mira', created: '2024-03-02', comments: 14 },
  { id: 405, title: 'Document the webhook retry policy', status: 'open', label: ['docs'], priority: 'low', assignee: 'ines', created: '2024-02-11', comments: 2 },
  { id: 398, title: 'Dark mode for the chart tooltips', status: 'open', label: ['feature', 'good first issue'], priority: 'medium', assignee: 'kofi', created: '2024-01-20', comments: 5 },
  { id: 391, title: 'SAML login loops on Safari', status: 'closed', label: ['bug'], priority: 'high', assignee: 'tomas', created: '2023-12-28', comments: 31 },
  { id: 384, title: 'Keyboard shortcut to duplicate a row', status: 'open', label: ['feature'], priority: 'high', assignee: 'mira', created: '2024-04-17', comments: 8 },
  { id: 377, title: 'Typo in the billing FAQ', status: 'closed', label: ['docs', 'good first issue'], priority: 'low', assignee: 'ines', created: '2023-11-05', comments: 1 },
  { id: 370, title: 'CSV import drops the last row', status: 'open', label: ['bug'], priority: 'medium', assignee: 'tomas', created: '2024-02-29', comments: 9 },
  { id: 362, title: 'Exact phrase search in the audit log', status: 'draft', label: ['feature'], priority: 'medium', assignee: 'kofi', created: '2024-05-01', comments: 0 },
  { id: 355, title: 'Rate limit headers missing on 429', status: 'open', label: ['bug'], priority: 'high', assignee: 'kofi', created: '2024-01-09', comments: 6 },
  { id: 349, title: 'Onboarding checklist copy', status: 'closed', label: ['docs'], priority: 'medium', assignee: 'mira', created: '2023-10-14', comments: 3 },
]

function QueryBarExample() {
  const [text, setText] = useState('status:open -label:docs created:>2024-01-01 assignee:@me OR priority:high')
  const [result, setResult] = useState<QueryBarParseResult | null>(null)
  const rows = ISSUES.filter((issue) => matchesQuery(issue, result?.ast ?? null, { schema: ISSUE_SCHEMA, me: 'mira', textFields: ['title'] }))
  return (
    <div className="flex w-full flex-col gap-3">
      <QueryBar schema={ISSUE_SCHEMA} label="Filter issues" value={text} onValueChange={setText} onQueryChange={setResult} placeholder="status:open label:bug" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
          <caption className="sr-only">Issues matching the filter</caption>
          <thead>
            <tr className="border-b border-line text-ink-faint">
              {['#', 'Title', 'Status', 'Labels', 'Priority', 'Assignee', 'Created'].map((heading) => (
                <th key={heading} scope="col" className="py-1.5 pr-3 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((issue) => (
              <tr key={issue.id} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3 font-mono text-ink-faint">{issue.id}</td>
                <td className="py-1.5 pr-3 font-semibold text-ink">{issue.title}</td>
                <td className="py-1.5 pr-3 text-ink-soft">{issue.status}</td>
                <td className="py-1.5 pr-3 text-ink-soft">{issue.label.join(', ')}</td>
                <td className="py-1.5 pr-3 text-ink-soft">{issue.priority}</td>
                <td className="py-1.5 pr-3 text-ink-soft">{issue.assignee}</td>
                <td className="py-1.5 pr-3 font-mono text-ink-soft">{issue.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-3 text-[12px] font-medium text-ink-faint">No issues match.</p>}
      </div>
      <details className="rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink">Parsed tree</summary>
        <pre className="mt-2 max-h-64 overflow-auto font-mono text-[11px] leading-4 text-ink-soft">{JSON.stringify(result?.ast ?? null, null, 2)}</pre>
      </details>
    </div>
  )
}

/* ------------------------------------------------------------ dock layout */

function Code({ lines }: { lines: string[] }) {
  return (
    <pre className="p-3 font-mono text-[12px] leading-5 text-ink">
      {lines.map((line, index) => (
        <span key={index} className="block">
          <span className="mr-3 inline-block w-5 select-none text-right text-ink-faint">{index + 1}</span>
          {line}
        </span>
      ))}
    </pre>
  )
}

const DOCK_PANELS = {
  explorer: {
    title: 'Explorer',
    closable: false,
    content: (
      <ul className="flex flex-col gap-0.5 p-2 font-mono text-[12px] text-ink-soft">
        {['src/', '  App.tsx', '  Button.tsx', '  theme.css', 'package.json', 'README.md'].map((file) => (
          <li key={file} className="whitespace-pre rounded-[var(--radius-5)] px-2 py-0.5">
            {file}
          </li>
        ))}
      </ul>
    ),
  },
  app: {
    title: 'App.tsx',
    content: <Code lines={["import { Button } from './Button'", '', 'export function App() {', '  return <Button>Deploy</Button>', '}']} />,
  },
  button: {
    title: 'Button.tsx',
    content: <Code lines={['export function Button({ children }) {', '  return <button className="btn">{children}</button>', '}']} />,
  },
  preview: {
    title: 'Preview',
    content: (
      <div className="flex h-full items-center justify-center p-4">
        <span className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink">Deploy</span>
      </div>
    ),
  },
  terminal: {
    title: 'Terminal',
    content: <Code lines={['$ npm run dev', 'ready in 412 ms', '➜ Local: http://localhost:5173/']} />,
  },
  problems: {
    title: 'Problems',
    content: <p className="p-3 text-[12px] font-medium text-ink-faint">No problems in the workspace.</p>,
  },
}

const DOCK_START: DockLayoutNode = {
  type: 'split',
  id: 'root',
  direction: 'row',
  ratio: 0.24,
  children: [
    { type: 'group', id: 'side', tabs: ['explorer'], active: 'explorer' },
    {
      type: 'split',
      id: 'main',
      direction: 'column',
      ratio: 0.68,
      children: [
        { type: 'group', id: 'editors', tabs: ['app', 'button', 'preview'], active: 'app' },
        { type: 'group', id: 'bottom', tabs: ['terminal', 'problems'], active: 'terminal' },
      ],
    },
  ],
}

function DockLayoutExample() {
  const [layout, setLayout] = useState<DockLayoutNode>(DOCK_START)
  return (
    <div className="flex w-full flex-col gap-3">
      <Text size="label" tone="soft">
        Drag a tab onto the middle of another group, or onto one of its edges. Or use a group’s ⋯ menu.
      </Text>
      <DockLayout panels={DOCK_PANELS} value={layout} onValueChange={setLayout} label="Editor workspace" height={400} />
      <div className="flex items-start gap-3">
        <Button size="sm" variant="outline" onClick={() => setLayout(DOCK_START)}>
          Reset layout
        </Button>
        <details className="min-w-0 flex-1 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-2.5">
          <summary className="cursor-pointer text-[12px] font-semibold text-ink">Layout as JSON</summary>
          <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] leading-4 text-ink-soft">{JSON.stringify(layout, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- pairwise ranker */

const ROADMAP = [
  { id: 'sso', label: 'SAML single sign-on', description: 'Asked for by 14 enterprise trials' },
  { id: 'mobile', label: 'Offline mobile app', description: 'Field teams lose work without signal' },
  { id: 'api', label: 'Public REST API', description: 'Unblocks three integration partners' },
  { id: 'dark', label: 'Dark mode', description: 'Most-voted idea on the board' },
  { id: 'audit', label: 'Audit log export', description: 'Required for the SOC 2 renewal' },
  { id: 'perf', label: 'Faster large boards', description: 'Boards over 5k cards take 4 s to open' },
  { id: 'ai', label: 'AI summaries', description: 'Sales keeps asking' },
  { id: 'i18n', label: 'Japanese translation', description: 'A reseller is waiting on it' },
]

function PairwiseRankerExample() {
  const [result, setResult] = useState<string[][] | null>(null)
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <PairwiseRanker items={ROADMAP} question="Which matters more next quarter?" onComplete={setResult} />
      <Readout label="onComplete" value={result ? JSON.stringify(result) : ''} />
    </div>
  )
}

/* ------------------------------------------------------------------ misc */

function TabMessagesPeek() {
  const { messages, post } = useTabMessages<string>('klyv-docs-peek')
  const [draft, setDraft] = useState('')
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (draft.trim()) post(draft.trim())
          setDraft('')
        }}
      >
        <Input inputSize="sm" aria-label="Broadcast text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Broadcast to other tabs" containerClassName="flex-1" />
        <Button size="sm" type="submit">
          Post
        </Button>
      </form>
      <ul className="flex flex-col gap-1 text-[12px]" aria-label="Received and sent">
        {messages.length === 0 && <li className="text-ink-faint">Nothing yet.</li>}
        {messages.map((message) => (
          <li key={`${message.from}-${message.at}`} className="font-medium text-ink">
            <span className="font-mono text-ink-faint">{message.own ? 'you' : message.from}</span> {message.data}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'message-format': {
    description:
      'An ICU MessageFormat parser and formatter: arguments, plural with exact =N matches, offset and #, selectordinal, select, nesting, and number and date arguments through Intl. Which plural form a number takes is asked of Intl.PluralRules for the locale, so Arabic’s six forms and Japanese’s one need no table here. Use formatMessage() for strings and <MessageFormat> in JSX; a malformed pattern throws, or renders as written, with the offset of the fault.',
    sections: [
      { title: 'Playground', description: 'Switch the locale to Arabic or Welsh and watch which categories the pattern is missing. Try the broken preset.', bare: true, Content: MessageFormatExample },
      {
        title: 'Specimens',
        specimens: [
          { label: 'plural, en', node: <MessageFormat message="{n, plural, one {# comment} other {# comments}}" values={{ n: 1 }} /> },
          { label: 'plural, pl', node: <MessageFormat message="{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}" values={{ n: 22 }} locale="pl" /> },
          { label: 'selectordinal', node: <MessageFormat message="{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place" values={{ n: 23 }} /> },
          { label: 'number + date', node: <MessageFormat message="Paid {amount, number, currency/EUR} on {when, date, long}" values={{ amount: 1249.5, when: new Date(Date.UTC(2026, 2, 14)) }} locale="de" /> },
          { label: 'parse error', node: <MessageFormat message="{n, plural, one {x}" values={{ n: 1 }} fallback="(message unavailable)" /> },
        ],
      },
      rationale(
        'Pluralising with a ternary works in English and nowhere else — Polish needs three forms, Arabic six, and ordinals have rules of their own.',
        'ICU syntax is what translation tools already speak, and Intl.PluralRules already knows every locale, so the component only has to parse and ask.',
        'Any user-facing string with a count, a gender or a date in it: notifications, empty states, billing lines, activity feeds.',
        ['Intl.PluralRules', 'Intl.NumberFormat', 'Intl.DateTimeFormat'],
      ),
    ],
    props: [
      { name: 'message', type: 'string', description: 'The ICU pattern.' },
      { name: 'values', type: 'Record<string, string | number | boolean | Date | null>', description: 'Argument values by name.' },
      { name: 'locale', type: 'string', defaultValue: "'en'", description: 'Plural rules, numbers and dates follow it.' },
      { name: 'fallback', type: 'ReactNode', defaultValue: 'the pattern', description: 'Rendered when the pattern does not parse.' },
      { name: 'onError', type: '(error: MessageFormatError) => void', description: 'Receives the parse error, with .offset.' },
      { name: 'formatMessage()', type: '(pattern, values?, locale?) => string', description: 'The same, as a function. Throws MessageFormatError.' },
      { name: 'parseMessage() / pluralCategories()', type: 'function', description: 'The tree, and the categories a locale needs (cardinal or ordinal).' },
    ],
  },
  'justified-text': {
    description:
      'A justified paragraph laid out by the Knuth–Plass algorithm. Every word is measured with the element’s own font on a canvas, every feasible set of line breaks is weighed at once, and Liang hyphenation offers breaks inside words, so no single line is left full of holes. It lays out again when the width, the theme font or a web font changes; screen readers get the plain text, never the layout hyphens.',
    sections: [
      { title: 'Against the browser', description: 'Narrow the measure. The bars show each line’s stretch: green is close to natural spacing, red is past it.', bare: true, Content: JustifiedTextExample },
      {
        title: 'Specimens',
        specimens: [
          {
            label: 'no hyphenation',
            fill: true,
            node: (
              <div className="w-[260px]">
                <JustifiedText hyphenate={false}>Optimal line breaking considers the whole paragraph, so an awkward word near the end can change where the first line breaks.</JustifiedText>
              </div>
            ),
          },
          {
            label: 'greedy, for comparison',
            fill: true,
            node: (
              <div className="w-[260px]">
                <JustifiedText algorithm="greedy">Optimal line breaking considers the whole paragraph, so an awkward word near the end can change where the first line breaks.</JustifiedText>
              </div>
            ),
          },
        ],
      },
      rationale(
        'text-align: justify breaks greedily, one line at a time, which is what makes rivers and gappy lines in narrow columns.',
        'Total-fit breaking with hyphenation is how TeX sets type, and a paragraph of a few hundred words solves in well under a frame.',
        'Long-form reading: articles, documentation, printed-style reports, narrow editorial columns.',
        ['canvas measureText', 'ResizeObserver', 'onThemeChange'],
      ),
    ],
    props: [
      { name: 'children', type: 'string', description: 'The paragraph text.' },
      { name: 'algorithm', type: "'optimal' | 'greedy'", defaultValue: "'optimal'", description: 'Knuth–Plass, or first-fit for comparison.' },
      { name: 'hyphenate', type: 'boolean', defaultValue: 'true', description: 'Allow breaks at Liang hyphenation points.' },
      { name: 'patterns', type: 'string', description: 'Liang patterns to replace the compact English set.' },
      { name: 'tolerance', type: 'number', defaultValue: '2', description: 'Loosest stretch ratio accepted on the first pass.' },
      { name: 'showRatios', type: 'boolean', defaultValue: 'false', description: 'A bar per line showing its stretch.' },
      { name: 'onLayout', type: '(lines: JustifiedTextLine[]) => void', description: 'The chosen lines, after every layout.' },
      { name: 'knuthPlass() / hyphenate()', type: 'function', description: 'The breaker and the hyphenator, for canvas or print.' },
    ],
  },
  'tab-coordinator': {
    description:
      'Coordination between the open tabs of one app. useTabLeader() elects exactly one leader with the Web Locks API — the lock passes to another tab the moment the leader closes — and falls back to a localStorage heartbeat. useTabMessages() is a BroadcastChannel bus with a storage-event fallback. The panel shows this tab’s role, the other tabs it hears and the messages between them.',
    sections: [
      { title: 'Open it twice', description: 'Only the leader polls the price; followers hear it on the channel. Close the leader and another tab takes over.', bare: true, Content: TabCoordinatorExample },
      { title: 'useTabMessages on its own', description: 'A plain bus, no election.', Content: TabMessagesPeek },
      rationale(
        'Three open tabs mean three sockets, three pollers and three notification sounds for one person.',
        'Web Locks give leadership that is released by the browser when a tab dies, which no heartbeat can match; the heartbeat covers the browsers without it.',
        'Real-time connections, background sync, token refresh, notification sounds, anything that should happen once per person rather than once per tab.',
        ['navigator.locks', 'BroadcastChannel', 'Badge', 'Input', 'Button'],
      ),
    ],
    props: [
      { name: 'name', type: 'string', defaultValue: "'klyv'", description: 'Election and channel name; tabs with the same name coordinate.' },
      { name: 'label', type: 'string', defaultValue: "'Open tabs'", description: 'Panel heading.' },
      { name: 'onAcquire', type: '() => void | (() => void)', description: 'Runs when this tab becomes leader; the cleanup runs when it stops.' },
      { name: 'onLeaderChange', type: '(isLeader: boolean) => void', description: 'Every change of role.' },
      { name: 'useTabLeader(name, options)', type: '{ isLeader, tabId, mechanism }', description: "mechanism is 'locks', 'storage' or 'none'." },
      { name: 'useTabMessages(channel, options)', type: '{ messages, post, tabId }', description: 'onMessage for side effects; keep sets how many are held.' },
    ],
  },
  'url-state': {
    description:
      'useUrlState(key, default, codec) is useState kept in the query string: typed codecs for strings, numbers, booleans, enums, arrays, dates and JSON; push or replace per key; debounced writes for text fields; Back and Forward restore it; and several keys changed together land as one history entry. Defaults are never written, so an untouched page has a clean URL. <UrlState> shows the query as it changes.',
    sections: [
      { title: 'Filters that survive a reload', description: 'Change the filters, reload, then press Back. Reset all is one history entry.', bare: true, Content: UrlStateExample },
      rationale(
        'Filters kept in component state vanish on reload, cannot be shared, and make Back leave the page instead of undoing the last filter.',
        'The URL is already the page’s shareable state; typed codecs keep it readable and stop a hand-edited link from crashing the page.',
        'Search pages, tables with filters and sorting, tabs, dashboards with a date range — anything someone might bookmark or paste.',
        ['history.pushState', 'useSyncExternalStore', 'popstate'],
      ),
    ],
    props: [
      { name: 'useUrlState(key, default, codec, options)', type: '[T, setT]', description: 'The setter accepts a value or an updater.' },
      { name: 'options.history', type: "'push' | 'replace'", defaultValue: "'replace'", description: 'Whether a change is a Back step.' },
      { name: 'options.debounce', type: 'number', defaultValue: '0', description: 'Milliseconds to wait before writing.' },
      { name: 'urlStateCodecs', type: 'object', description: 'string, number, boolean, date, enum(values), array(codec), json().' },
      { name: 'keys', type: 'string[]', description: 'On <UrlState>: only show these parameters.' },
      { name: 'label', type: 'string', defaultValue: "'Query string'", description: 'On <UrlState>: the heading.' },
    ],
  },
  'draft-recovery': {
    description:
      'Autosave for a form or editor, into IndexedDB through a small promise wrapper, throttled, per key. On the next visit, a draft newer than the saved value that differs from it is offered back — “Restore your edit from 4 minutes ago?” — with a field-by-field summary of what it would change. Drafts carry a schema version and pass through migrate() or are dropped; submitting clears them; without IndexedDB they live in memory and the component says so.',
    sections: [
      { title: 'Reload and restore', description: 'Edit the issue, wait a moment, then simulate a reload (or reload the page).', bare: true, Content: DraftRecoveryExample },
      rationale(
        'A closed tab, a crash or an expired session throws away whatever was being written, and people remember losing a long reply.',
        'IndexedDB holds structured values without blocking the page, and asking before restoring respects that the saved version may be the one wanted.',
        'Issue and comment editors, long forms, settings with many fields, anything where typing takes longer than a minute.',
        ['IndexedDB', 'Button', 'relativeTime'],
      ),
    ],
    props: [
      { name: 'useDraftRecovery(options)', type: 'DraftRecoveryControls<T>', description: '{ offer, restore, discard, clear, lastSaved, storage }.' },
      { name: 'options.storageKey', type: 'string', description: 'One draft per key.' },
      { name: 'options.value', type: 'T', description: 'The current state, saved as it changes.' },
      { name: 'options.savedAt', type: 'number', defaultValue: '0', description: 'When the starting value was saved; older drafts are dropped.' },
      { name: 'options.version / migrate', type: 'number / (value, from) => T | undefined', defaultValue: '1', description: 'Schema version and upgrade path.' },
      { name: 'options.throttle', type: 'number', defaultValue: '1000', description: 'Milliseconds between writes.' },
      { name: 'recovery', type: 'DraftRecoveryControls<T>', description: 'On <DraftRecovery>: the hook’s result.' },
      { name: 'summarize / noun', type: '(draft, current) => ReactNode / string', description: 'On <DraftRecovery>: what the draft changes, and what to call it.' },
    ],
  },
  'fuzzy-finder': {
    description:
      'A “go to file” search with fzf’s scoring: matches on word starts, camelCase humps and after path separators earn bonuses, runs earn more, gaps cost, and a dynamic program places each character where the total is best — which is also what gets highlighted. Ten thousand items stay responsive: scoring runs in slices between frames, a query that extends the last one rescans only its matches, and the list is virtualised.',
    sections: [
      { title: 'Ten thousand paths', description: 'Type a few letters of a path in order. Arrows move, Enter opens, Escape clears.', bare: true, Content: FuzzyFinderExample },
      { title: 'fuzzyScore()', description: 'Boundary matches outscore scattered ones.', Content: FuzzyScores },
      rationale(
        'Substring search makes people type exact fragments; plain subsequence matching finds too much and ranks it arbitrarily.',
        'fzf’s bonuses encode how people abbreviate names, and the optimal placement means the highlight shows why a result ranked.',
        'Command palettes, file and symbol pickers, long option lists, jump-to-record boxes.',
        ['Input', 'virtualised listbox', 'fuzzyScore'],
      ),
    ],
    props: [
      { name: 'items', type: 'FuzzyFinderItem[]', description: '{ id, label, detail? }. label is searched.' },
      { name: 'label', type: 'string', description: 'Names the search field.' },
      { name: 'onSelect', type: '(item) => void', description: 'Enter or click.' },
      { name: 'limit', type: 'number', defaultValue: '1000', description: 'Ranked results kept.' },
      { name: 'height / rowHeight', type: 'number', defaultValue: '320 / 40', description: 'List and row height in pixels; rows are virtualised.' },
      { name: 'fuzzyScore(query, text)', type: '{ score, indices } | null', description: 'Space-separated terms must all match.' },
    ],
  },
  'full-text-search': {
    description:
      'Search over documents already in the browser, with a real inverted index: words are tokenised, stop words dropped and stems taken with a Porter stemmer; results are ranked by BM25 with the title boosted over the body; the last word matches as a prefix while it is typed; and each result shows the passage with the most matched words, marked. Documents added or removed update the index in place.',
    sections: [
      { title: 'Help centre', description: 'Try “invoicing” (stemmed), “provis” (prefix) or “retry webhook”. Add or remove an article and search again.', bare: true, Content: FullTextSearchExample },
      rationale(
        'includes() misses plurals and tenses, ranks nothing and cannot say why a result matched.',
        'BM25 over stems is what search engines still use as a baseline; for a few thousand documents it runs in the browser in milliseconds.',
        'Help centres, docs sites, changelogs, settings search, offline apps.',
        ['Input', 'listbox', 'FullTextSearchIndex'],
      ),
    ],
    props: [
      { name: 'documents', type: 'FullTextSearchDocument[]', description: '{ id, title, body, …anything }. Diffed by id and identity.' },
      { name: 'label', type: 'string', description: 'Names the search field.' },
      { name: 'fields', type: 'Record<string, number>', defaultValue: '{ title: 3, body: 1 }', description: 'Searched fields and boosts.' },
      { name: 'limit', type: 'number', defaultValue: '8', description: 'Results shown.' },
      { name: 'onSelect / renderMeta', type: '(document) => void / ReactNode', description: 'Choosing a result; a line under it.' },
      { name: 'showScores', type: 'boolean', defaultValue: 'false', description: 'Show BM25 scores.' },
      { name: 'FullTextSearchIndex', type: 'class', description: 'add, remove, search(query, { limit, prefix }).' },
    ],
  },
  'query-bar': {
    description:
      'A search field with a filter syntax — key:value, -negation, "quoted phrases", comparators such as created:>2024-01-01, @me and OR groups — parsed into a tree as you type. Recognised filters are tinted as chips in place, problems are underlined where they are and explained with their column, and completion offers keys and then values from a schema. matchesQuery(record, ast) applies the result.',
    sections: [
      { title: 'Filtering issues', description: 'You are “mira”. Type “la” for key completion, or break the query to see errors.', bare: true, Content: QueryBarExample },
      rationale(
        'A row of dropdowns limits what can be asked, and a plain text box hides whether the filter was understood.',
        'Power users already know this syntax from code hosts and issue trackers; drawing over the text keeps it editable as text.',
        'Issue and ticket lists, logs, admin tables, audit trails — anywhere a filter is worth typing.',
        ['combobox', 'listbox', 'parseQuery', 'matchesQuery'],
      ),
    ],
    props: [
      { name: 'schema', type: 'QueryBarSchema', description: '{ key: { type, values?, description? } }. Types: enum, text, date, number, user.' },
      { name: 'value / defaultValue', type: 'string', description: 'The query text.' },
      { name: 'onValueChange', type: '(value: string) => void', description: 'Every edit.' },
      { name: 'onQueryChange', type: '(result: { ast, issues, tokens }) => void', description: 'The parsed tree and its problems.' },
      { name: 'label / placeholder', type: 'string', description: 'Names the field; hint when empty.' },
      { name: 'matchesQuery(record, ast, options)', type: 'boolean', description: 'options: schema, me, textFields.' },
    ],
  },
  'dock-layout': {
    description:
      'An IDE-style workspace: panels live in tab groups, groups in resizable splits. Drag a tab to the middle of a group to join it or to an edge to split beside it; a group left empty closes and its neighbour takes the room. The layout is a plain, serialisable tree and the component is controlled. Every pointer action has a keyboard path: arrows between tabs, Delete to close, a group menu to move or split, arrow keys on the dividers.',
    sections: [
      { title: 'Editor workspace', bare: true, Content: DockLayoutExample },
      rationale(
        'A fixed layout decides for the reader which two things they want side by side.',
        'A binary tree of splits is the smallest model that can express any arrangement docking produces, and it serialises as-is.',
        'Code editors, design tools, trading and monitoring screens, admin consoles with many panes.',
        ['Menu', 'IconButton', 'tablist', 'separator'],
      ),
    ],
    props: [
      { name: 'panels', type: 'Record<string, DockLayoutPanel>', description: '{ title, content, closable? } by id.' },
      { name: 'value / defaultValue', type: 'DockLayoutNode', description: 'Groups { tabs, active } inside splits { direction, ratio, children }.' },
      { name: 'onValueChange', type: '(layout) => void', description: 'After every move, resize, close or tab switch.' },
      { name: 'label', type: 'string', defaultValue: "'Workspace'", description: 'Names the region.' },
      { name: 'height', type: 'number', defaultValue: '420', description: 'Pixels.' },
      { name: 'dockTab() / closeDockTab() / resizeDockSplit()', type: 'function', description: 'The same operations on the tree, for your own controls.' },
    ],
  },
  'pairwise-ranker': {
    description:
      'Ranks a list by asking one question at a time — which of these two matters more? — and places each item by binary insertion, so eight items take at most 17 questions rather than 28. Progress counts against the worst case that remains; Equal puts both in one tier and saves questions; Skip sets an item aside; every answer can be undone; ← and → answer from the keyboard.',
    sections: [
      { title: 'Prioritise a roadmap', description: 'Answer with the cards or the arrow keys.', bare: true, Content: PairwiseRankerExample },
      rationale(
        'Ordering a dozen things at once is hard, and the result drifts with the order they were read in.',
        'A choice between two is quick and consistent, and binary insertion keeps the number of those choices close to the minimum.',
        'Roadmap and backlog prioritisation, surveys, hiring scorecards, choosing between designs.',
        ['Button', 'Progress', 'Kbd'],
      ),
    ],
    props: [
      { name: 'items', type: 'PairwiseRankerItem[]', description: '{ id, label, description? }.' },
      { name: 'question', type: 'string', defaultValue: "'Which matters more?'", description: 'Asked of every pair.' },
      { name: 'onComplete', type: '(ranking: string[][]) => void', description: 'Tiers from first to last; tied items share a tier.' },
    ],
  },
}
