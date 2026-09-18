import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  CollaborativeText,
  CollaborativeTextDoc,
  CommentAnchors,
  ExpenseSplitter,
  JwtInspector,
  PeerLink,
  ReadabilityMeter,
  Redactor,
  SlideDeck,
  SlideDeckSlide,
  SqlBuilder,
  Switch,
  Text,
  Textarea,
  ThreeWayMerge,
  createCommentAnchorsSelector,
  type CollaborativeTextOperation,
  type CommentAnchorsComment,
  type ExpenseSplitterExpense,
  type SqlBuilderQuery,
  type SqlBuilderTable,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

function Note({ children }: { children: string }) {
  return (
    <Text size="caption" tone="faint" leading="normal" aria-live="polite">
      {children}
    </Text>
  )
}

/* ------------------------------------------------------- comment anchors */

const DRAFT = `The quarterly plan moves the launch to the first week of March, after the pricing review closes.

Support will staff the chat queue from 8am to 8pm on launch day, and the status page goes live an hour before the announcement.

Marketing owns the announcement email; legal must approve the refund language before it is scheduled.`

const REVISION = `After the pricing review closes, the quarterly plan moves the launch to the second week of March.

Support will staff the chat queue from 7am to 9pm on launch day, and the status page goes live an hour before the announcement.

Marketing owns the announcement email and the blog post.`

const at = (text: string, quote: string) => {
  const start = text.indexOf(quote)
  return createCommentAnchorsSelector(text, start, start + quote.length)
}

const COMMENTS: CommentAnchorsComment[] = [
  { id: 'c1', author: 'Priya', time: '2h', body: 'Is March firm, or still pending finance?', selector: at(DRAFT, 'first week of March') },
  { id: 'c2', author: 'Tom', time: '1h', body: 'We need a second person on the queue after 6pm.', selector: at(DRAFT, 'from 8am to 8pm on launch day') },
  { id: 'c3', author: 'Lena', time: '40m', body: 'Status page first — good call.', selector: at(DRAFT, 'the status page goes live an hour before') },
  { id: 'c4', author: 'Marcus', time: '10m', body: 'Legal has a template for this; link it here.', selector: at(DRAFT, 'legal must approve the refund language') },
]

function CommentAnchorsExample() {
  const [text, setText] = useState(DRAFT)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setText(REVISION)}>
          Apply the revision
        </Button>
        <Button size="sm" variant="outline" onClick={() => setText(DRAFT)}>
          Back to the draft
        </Button>
      </div>
      <Textarea aria-label="Document text — edit it and watch the comments follow" rows={5} value={text} onChange={(event) => setText(event.target.value)} />
      <CommentAnchors text={text} comments={COMMENTS} label="Launch plan" />
      <Note>The revision rewrites the first sentence, changes the hours and deletes the legal clause: one comment stays exact, two re-anchor with a confidence, one is orphaned.</Note>
    </div>
  )
}

/* ----------------------------------------------------- collaborative text */

const PEERS = ['Ana', 'Ben', 'Cy']
const SEED = 'Agenda: ship notes, then retro.'

function CollaborativeTextExample() {
  const docs = useMemo(() => PEERS.map((name) => new CollaborativeTextDoc(name.toLowerCase(), SEED)), [])
  const [online, setOnline] = useState([true, true, true])
  const [delay, setDelay] = useState(900)
  const [, setTick] = useState(0)
  const [inFlight, setInFlight] = useState(0)
  const onlineRef = useRef(online)
  onlineRef.current = online
  const delayRef = useRef(delay)
  delayRef.current = delay
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const offs = docs.map((doc) => doc.subscribe(() => setTick((n) => n + 1)))
    const pending = timers.current
    return () => {
      offs.forEach((off) => off())
      pending.forEach(clearTimeout)
    }
  }, [docs])

  const deliver = (to: number, ops: CollaborativeTextOperation[]) => {
    setInFlight((n) => n + 1)
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setInFlight((n) => n - 1)
      // A peer that went offline meanwhile misses it; the resync on reconnect covers the gap.
      if (onlineRef.current[to]) docs[to]!.apply(ops)
    }, delayRef.current * (0.5 + Math.random()))
    timers.current.add(timer)
  }

  const send = (from: number, ops: CollaborativeTextOperation[]) => {
    PEERS.forEach((_, to) => {
      if (to === from) return
      if (onlineRef.current[from] && onlineRef.current[to]) deliver(to, ops)
    })
  }

  const setPeerOnline = (index: number, value: boolean) => {
    const next = online.map((flag, i) => (i === index ? value : flag))
    setOnline(next)
    onlineRef.current = next
    if (!value) return
    // Reconnecting: exchange everything each side has, the way a real client resyncs.
    PEERS.forEach((_, from) => {
      if (!next[from]) return
      PEERS.forEach((__, to) => {
        if (to !== from && next[to]) deliver(to, docs[from]!.operations())
      })
    })
  }

  const concurrent = () => {
    const words = ['[Ana] ', '[Ben] ', '[Cy] ']
    const batches = docs.map((doc, i) => doc.insert(0, words[i]!))
    batches.forEach((ops, i) => send(i, ops))
  }

  const texts = docs.map((doc) => doc.text())
  const converged = texts.every((text) => text === texts[0]) && inFlight === 0 && online.every(Boolean)
  const waiting = docs.reduce((sum, doc) => sum + doc.pending, 0)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          Network delay
          <input type="range" min={0} max={3000} step={100} value={delay} onChange={(event) => setDelay(Number(event.target.value))} className="accent-[var(--color-accent-strong)]" />
          <span className="w-14 tabular-nums">{delay} ms</span>
        </label>
        <Button size="sm" variant="outline" onClick={concurrent}>
          Everyone types at once
        </Button>
        <Text as="span" size="label" weight="bold" tone={converged ? 'success' : 'soft'} role="status">
          {converged ? 'Converged' : !online.every(Boolean) ? 'A peer is offline — its edits wait for reconnect' : `Syncing · ${inFlight} message${inFlight === 1 ? '' : 's'} in flight${waiting ? `, ${waiting} waiting on dependencies` : ''}`}
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {docs.map((doc, i) => (
          <div key={doc.site} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <Text size="label" weight="bold">
                {PEERS[i]}
              </Text>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
                {online[i] ? 'Online' : 'Offline'}
                <Switch switchSize="sm" checked={online[i]} onChange={(event) => setPeerOnline(i, event.target.checked)} aria-label={`${PEERS[i]} online`} />
              </label>
            </div>
            <CollaborativeText doc={doc} label={`${PEERS[i]}’s copy`} rows={5} onOperations={(ops) => send(i, ops)} />
          </div>
        ))}
      </div>
      <Note>Take Ben offline, have everyone edit the same line, then bring him back: all three copies end up identical, with no edit lost.</Note>
    </div>
  )
}

function CollaborativeTabsExample() {
  const doc = useMemo(() => new CollaborativeTextDoc(`tab-${Math.random().toString(36).slice(2, 7)}`, 'Open this page in a second tab and type in both.'), [])
  return (
    <div className="flex w-full flex-col gap-2">
      <CollaborativeText doc={doc} channel="klyv-collaborative-text-demo" label="Shared across tabs" rows={3} />
      <Note>Tabs sync over a BroadcastChannel. A new tab asks for the full operation log, so it catches up however late it opens.</Note>
    </div>
  )
}

/* -------------------------------------------------------------- peer link */

function PeerLoopbackExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        <PeerLink label="Laptop" signalling="broadcast" channel="klyv-peer-link-demo" />
        <PeerLink label="Phone" signalling="broadcast" channel="klyv-peer-link-demo" />
      </div>
      <Note>Press Connect on either peer. Both live in this page and signal over a BroadcastChannel, so no server or network is needed — then send a message or a file.</Note>
    </div>
  )
}

function PeerManualExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        <PeerLink label="Alice" />
        <PeerLink label="Bob" />
      </div>
      <Note>Create an offer as Alice, paste it into Bob and apply, then paste Bob’s answer back into Alice. The same steps work between two different browsers.</Note>
    </div>
  )
}

/* ------------------------------------------------------------- slide deck */

const TALK = `# Shipping on Fridays
## What we changed, and why it stopped hurting

Note:
Open with the incident count from last year. Pause after the title.

---

# The old rule
- No deploys after **Thursday noon**
- Fixes waited four days
- Every Monday was a release train

Note:
Ask who has been on call for a Monday train.

---

# What replaced it
- Feature flags on by default
- \`deploy --canary\` to 5% first
- Automatic rollback on error budget burn

---

> Small changes, shipped often, are the safe ones.

Note:
The line to remember. Leave it up for a beat.

---

# Questions
## slides at go/friday-deploys`

function SlideMarkdownExample() {
  return (
    <div className="flex w-full flex-col gap-2">
      <SlideDeck markdown={TALK} label="Shipping on Fridays" />
      <Note>Click the deck and use the arrow keys. The URL follows the slide; S opens the presenter view with notes, the next slide and a timer.</Note>
    </div>
  )
}

function SlideChildrenExample() {
  const [index, setIndex] = useState(0)
  return (
    <div className="flex w-full flex-col gap-2">
      <SlideDeck hash={false} index={index} onIndexChange={setIndex} label="Quarterly numbers">
        <SlideDeckSlide title="Revenue" notes="Up 18% on last quarter, most of it expansion.">
          <p className="text-[1em] font-bold uppercase tracking-wider text-ink-faint">Q3 revenue</p>
          <p className="text-[4em] font-extrabold leading-none tracking-[-0.04em]">$4.2M</p>
          <p className="text-[1.2em] font-semibold text-ink-soft">+18% quarter on quarter</p>
        </SlideDeckSlide>
        <SlideDeckSlide title="Retention" notes="Net retention crossed 120% for the first time.">
          <div className="grid grid-cols-3 gap-[1em]">
            {[
              ['Gross', '94%'],
              ['Net', '121%'],
              ['Logo', '97%'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-tile)] bg-surface-sunken p-[0.8em]">
                <p className="text-[0.9em] font-bold text-ink-faint">{label}</p>
                <p className="text-[2.4em] font-extrabold">{value}</p>
              </div>
            ))}
          </div>
        </SlideDeckSlide>
        <SlideDeckSlide title="Next quarter" notes="Keep this one short.">
          <p className="text-[2.2em] font-extrabold">Next: self-serve annual plans</p>
        </SlideDeckSlide>
      </SlideDeck>
      <Note>{`Controlled: the page holds slide ${index + 1}. Slides written as JSX size their text in em, so they scale with the stage.`}</Note>
    </div>
  )
}

/* -------------------------------------------------------- three-way merge */

const BASE = `server:
  port: 8080
  host: 0.0.0.0
cache:
  ttl: 300
  size: 1000
logging:
  level: info
  format: text
features:
  search: true`

const OURS = `server:
  port: 8080
  host: 0.0.0.0
  timeout: 30s
cache:
  ttl: 600
  size: 1000
logging:
  level: debug
  format: json
features:
  search: true`

const THEIRS = `server:
  port: 9090
  host: 0.0.0.0
cache:
  ttl: 900
  size: 1000
logging:
  level: info
  format: json
features:
  search: true
  export: true`

function MergeExample() {
  const [open, setOpen] = useState(0)
  return (
    <div className="flex w-full flex-col gap-2">
      <ThreeWayMerge base={BASE} ours={OURS} theirs={THEIRS} oursLabel="main" theirsLabel="feature/export" onMergedChange={(_, unresolved) => setOpen(unresolved)} />
      <Note>{open ? `${open} conflict${open === 1 ? '' : 's'} still written with markers.` : 'Every conflict resolved — the result is clean.'}</Note>
    </div>
  )
}

function MergeDiff3Example() {
  return (
    <ThreeWayMerge
      base={'Title: Pricing\nPlans start at $9.\nContact sales for more.'}
      ours={'Title: Pricing\nPlans start at $12.\nContact sales for more.'}
      theirs={'Title: Pricing\nPlans start at $10 a month.\nContact sales for more.'}
      markerStyle="diff3"
    />
  )
}

/* --------------------------------------------------------------- redactor */

const TICKET = `Hi team — customer Maria Ortega (maria.ortega@example.com, +44 20 7946 0958) says her card 4242 4242 4242 4242 was charged twice.
Refund to IBAN GB82 WEST 1234 5698 7654 32 instead. Order ref 4000 1234 5678 9010 is not a card.
Her session came from 203.0.113.42; the retry worker on 10.0.4.17 logged the header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
Also, someone pasted our key sk_test_${'4eC39HqLyjWDarjtT1zdp7dc'} and AKIAIOSFODNN7EXAMPLE into the thread. api_key = q8Zr2vLp0XwT7mN4bK1s`

function RedactorExample() {
  const [count, setCount] = useState(0)
  return (
    <div className="flex w-full flex-col gap-2">
      <Redactor defaultValue={TICKET} onRedactedChange={(_, findings) => setCount(findings.length)} />
      <Note>{`${count} items will be removed. The order reference fails Luhn, so it is not flagged; the private IP scores lower and waits for a decision.`}</Note>
    </div>
  )
}

/* ------------------------------------------------------ readability meter */

const ESSAY = `We are writing to inform you that the new billing system will be implemented next month. In order to facilitate a smooth transition for every individual customer, the migration was carefully planned by the finance team over a period of approximately six weeks, and additional assistance will be provided to anyone who has questions regarding their invoices.

Most accounts move automatically. You do not need to do anything. If something looks wrong, reply to this email and we will fix it quickly.`

function ReadabilityExample() {
  return <ReadabilityMeter defaultValue={ESSAY} targetGrade={9} label="Customer email" />
}

/* ------------------------------------------------------- expense splitter */

const PEOPLE = [
  { id: 'ana', name: 'Ana' },
  { id: 'ben', name: 'Ben' },
  { id: 'cy', name: 'Cy' },
  { id: 'dee', name: 'Dee' },
]

const TRIP: ExpenseSplitterExpense[] = [
  { id: 'e1', description: 'Dinner at the harbour', amount: 18_750, paidBy: 'ana', mode: 'equal', split: { ana: 1, ben: 1, cy: 1, dee: 1 } },
  { id: 'e2', description: 'Cabin, three nights', amount: 64_000, paidBy: 'ben', mode: 'shares', split: { ana: 2, ben: 2, cy: 1, dee: 1 } },
  { id: 'e3', description: 'Groceries', amount: 8_342, paidBy: 'cy', mode: 'exact', split: { ana: 2_000, ben: 3_342, cy: 3_000 } },
  { id: 'e4', description: 'Car hire', amount: 21_000, paidBy: 'dee', mode: 'percent', split: { ana: 33.3, ben: 33.3, dee: 33.4 } },
]

function ExpenseExample() {
  return <ExpenseSplitter people={PEOPLE} defaultExpenses={TRIP} currency="USD" locale="en-US" />
}

function ExpenseYenExample() {
  return (
    <ExpenseSplitter
      people={PEOPLE.slice(0, 3)}
      defaultExpenses={[{ id: 'y1', description: 'Ramen for three', amount: 1_000, paidBy: 'ana', mode: 'equal', split: { ana: 1, ben: 1, cy: 1 } }]}
      currency="JPY"
      locale="ja-JP"
    />
  )
}

/* ------------------------------------------------------------ sql builder */

const SCHEMA: SqlBuilderTable[] = [
  { name: 'customers', columns: [{ name: 'id', type: 'number' }, { name: 'name', type: 'text' }, { name: 'country', type: 'text' }, { name: 'created_at', type: 'date' }] },
  { name: 'addresses', columns: [{ name: 'id', type: 'number' }, { name: 'city', type: 'text' }, { name: 'postcode', type: 'text' }] },
  {
    name: 'orders',
    columns: [{ name: 'id', type: 'number' }, { name: 'customer_id', type: 'number' }, { name: 'billing_address_id', type: 'number' }, { name: 'shipping_address_id', type: 'number' }, { name: 'placed_at', type: 'date' }, { name: 'paid', type: 'boolean' }],
    foreignKeys: [
      { column: 'customer_id', table: 'customers', references: 'id' },
      { column: 'billing_address_id', table: 'addresses', references: 'id' },
      { column: 'shipping_address_id', table: 'addresses', references: 'id' },
    ],
  },
  {
    name: 'order_items',
    columns: [{ name: 'id', type: 'number' }, { name: 'order_id', type: 'number' }, { name: 'product_id', type: 'number' }, { name: 'quantity', type: 'number' }, { name: 'unit_price', type: 'number' }],
    foreignKeys: [
      { column: 'order_id', table: 'orders', references: 'id' },
      { column: 'product_id', table: 'products', references: 'id' },
    ],
  },
  {
    name: 'products',
    columns: [{ name: 'id', type: 'number' }, { name: 'name', type: 'text' }, { name: 'category_id', type: 'number' }, { name: 'price', type: 'number' }],
    foreignKeys: [{ column: 'category_id', table: 'categories', references: 'id' }],
  },
  { name: 'categories', columns: [{ name: 'id', type: 'number' }, { name: 'name', type: 'text' }] },
]

const STARTING_QUERY: SqlBuilderQuery = {
  tables: ['customers', 'products'],
  joins: {},
  columns: [
    { id: 'customers.country', aggregate: 'none' },
    { id: 'products.name', aggregate: 'none' },
    { id: 'order_items.quantity', aggregate: 'sum' },
  ],
  groupBy: null,
  where: [{ id: 'w1', field: 'orders.paid', operator: 'is', value: 'true' }],
  match: 'all',
  orderBy: [{ column: 'customers.country', direction: 'asc' }],
  limit: '50',
}

function SqlExample() {
  return <SqlBuilder schema={SCHEMA} defaultValue={STARTING_QUERY} />
}

/* ---------------------------------------------------------- jwt inspector */

const HS_EXPIRED =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzhmMmMiLCJuYW1lIjoiR3JhY2UgSG9wcGVyIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmV4YW1wbGUuY29tIiwiYXVkIjoiYXBpLmV4YW1wbGUuY29tIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3NjcyMjkyMDB9.DEe8hRHyjbzCozauvNuN8UBAD5MJ5MM_uOFairZa-XY'
const ES_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjYtMDkifQ.eyJzdWIiOiJzdmNfYmlsbGluZyIsImlzcyI6Imh0dHBzOi8vYXV0aC5leGFtcGxlLmNvbSIsImF1ZCI6WyJhcGkuZXhhbXBsZS5jb20iLCJiaWxsaW5nLmV4YW1wbGUuY29tIl0sInNjb3BlIjoiaW52b2ljZXM6cmVhZCIsImlhdCI6MTc4ODAwMDAwMCwibmJmIjoxNzg4MDAwMDAwLCJleHAiOjQxMDI0NDQ4MDAsImp0aSI6ImI3ZTFjMGRlIn0.97rFa2Ef3UwKgTFzrNaDCFAT2Ef4mkVpVzh9k5ppXC77CyQcqU2evfu5rfhe0KwPWwOaQwWJz2RCZfoRBgllIQ'
const ES_JWK = JSON.stringify(
  { kty: 'EC', crv: 'P-256', x: 'M4nkhVIXxJOhNrL6L8O7dIqE7Dhg1WyYvTKNEwmdouc', y: '12fXlNZ8vJKwff0XKIRhAIzmQ01Q0ZnXfThhjrOhn2I', kid: '2026-09', use: 'sig', alg: 'ES256' },
  null,
  2,
)
const NONE_TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJvd25lciIsImlhdCI6MTc4ODAwMDAwMH0.'

function JwtHmacExample() {
  return (
    <div className="flex w-full flex-col gap-2">
      <JwtInspector defaultValue={HS_EXPIRED} defaultKey="correct-horse-battery-staple" audience="api.example.com" />
      <Note>The signature checks out but the token expired: change one character of the secret to see a bad signature, or open “Sign a test token” for a fresh one with a live countdown.</Note>
    </div>
  )
}

function JwtEcExample() {
  return <JwtInspector defaultValue={ES_TOKEN} defaultKey={ES_JWK} allowSigning={false} issuer="https://auth.example.com" />
}

function JwtNoneExample() {
  return <JwtInspector defaultValue={NONE_TOKEN} allowSigning={false} />
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'comment-anchors': {
    description:
      'Comments pinned to a quote instead of a character offset, so they survive edits. Each comment keeps the W3C annotation selector — the exact words, some text either side and the old position as a hint — and is found again by exact match, then by approximate match with a bounded edit distance. Moved comments say how sure the match is; comments whose words are gone are listed as orphaned rather than pinned to the wrong sentence.',
    sections: [
      { title: 'Re-anchoring as the text changes', description: 'Edit the text, or apply the prepared revision.', Content: CommentAnchorsExample },
      rationale(
        'Comments stored as offsets drift onto the wrong words after the first edit, and nobody notices until a reviewer answers the wrong question.',
        'Quote plus context is the annotation standard’s answer, and it degrades honestly: exact, then fuzzy with a score, then orphaned in the open.',
        'Document review, contract redlines, design specs, any comment thread on prose that keeps changing.',
        ['Text'],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'The current document. Comments re-anchor whenever it changes.' },
      { name: 'comments', type: 'CommentAnchorsComment[]', description: 'Each with id, author, body, optional time and a selector (exact, prefix, suffix, start).' },
      { name: 'threshold', type: 'number', defaultValue: '0.7', description: 'Anchors scoring below this are listed as orphaned.' },
      { name: 'activeId / onActiveChange', type: 'string | null', description: 'The highlighted comment, controlled or not.' },
      { name: 'label', type: 'string', defaultValue: "'Document'", description: 'Accessible name of the document region.' },
      { name: 'createCommentAnchorsSelector', type: '(text, start, end, context?) => selector', description: 'Builds a selector from a selection when a comment is made.' },
    ],
  },

  'collaborative-text': {
    description:
      'A textarea bound to a sequence CRDT, so several people can type into the same text without a server deciding who wins. Every character carries a unique id and the id it was typed after; concurrent inserts are ordered by comparing ids, deletes leave tombstones, and operations can arrive late, twice or out of order and every copy still converges.',
    sections: [
      { title: 'Three peers on a simulated network', description: 'Adjust the delay, take a peer offline, and edit all three at once.', Content: CollaborativeTextExample },
      { title: 'Across browser tabs', description: 'The same field synced over a BroadcastChannel.', Content: CollaborativeTabsExample },
      rationale(
        'Last-write-wins on a whole field throws away a colleague’s sentence, and locking the field makes everyone wait.',
        'An RGA merges character by character with no central server, so it works offline and over any transport — a socket, WebRTC, or a BroadcastChannel.',
        'Shared notes, meeting agendas, collaborative descriptions and any small text two people edit at once.',
        ['Textarea'],
      ),
    ],
    props: [
      { name: 'doc', type: 'CollaborativeTextDoc', description: 'The replica this field edits: new CollaborativeTextDoc(siteId, seed?). Call doc.apply(ops) with remote operations.' },
      { name: 'onOperations', type: '(ops) => void', description: 'Local edits as operations, to send to the other replicas.' },
      { name: 'channel', type: 'string', description: 'Also sync with other tabs over a BroadcastChannel of this name.' },
      { name: 'label', type: 'string', description: 'Accessible name.' },
      { name: 'rows / placeholder / disabled', type: 'number / string / boolean', description: 'Passed to the textarea.' },
    ],
  },

  'peer-link': {
    description:
      'A direct browser-to-browser link over a WebRTC data channel, for text and files. Signalling is either copy and paste — works between any two browsers — or automatic between peers on the same origin over a BroadcastChannel. Files travel in 16 KB chunks with back-pressure on the channel buffer, and the receiver checks a SHA-256 hash before offering the download.',
    sections: [
      { title: 'Two peers in one page', description: 'Loopback over BroadcastChannel signalling — works offline.', Content: PeerLoopbackExample },
      { title: 'Manual signalling', description: 'Copy the offer and answer by hand.', Content: PeerManualExample },
      rationale(
        'Sending a file between two nearby devices usually means uploading it to someone’s server and downloading it again.',
        'WebRTC is peer-to-peer once connected; making signalling explicit, and hashing what arrives, turns the API into something people can trust.',
        'Device handoff, local file sharing, pairing flows, and any feature that should not route user data through a server.',
        ['Button', 'Input', 'Textarea', 'CopyButton', 'Progress', 'StatusPill'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'This peer’s name.' },
      { name: 'signalling', type: "'manual' | 'broadcast'", defaultValue: "'manual'", description: 'Copy/paste SDP, or find peers on the same origin over a BroadcastChannel.' },
      { name: 'channel', type: 'string', defaultValue: "'klyv-peer-link'", description: 'BroadcastChannel name for broadcast signalling.' },
      { name: 'iceServers', type: 'RTCIceServer[]', defaultValue: '[]', description: 'STUN/TURN servers for connections across networks.' },
      { name: 'chunkSize', type: 'number', defaultValue: '16384', description: 'File chunk size in bytes.' },
      { name: 'onMessage', type: '(text: string) => void', description: 'Each text message from the other peer.' },
    ],
  },

  'slide-deck': {
    description:
      'A presentation that runs in the page: arrow keys, a URL per slide, fullscreen, an overview of every slide, and a presenter view in a second window with notes, the next slide and a timer. The presenter window is a separate document, so it follows the deck over a BroadcastChannel, and either window can move the other. Slides come from JSX or from a markdown-ish string.',
    sections: [
      { title: 'From markdown', description: 'Slides separated by ---, notes after “Note:”.', Content: SlideMarkdownExample },
      { title: 'From JSX, controlled', description: 'SlideDeckSlide children with notes; the page holds the index.', Content: SlideChildrenExample },
      rationale(
        'Demos and internal reviews happen in the product, but presenting from it means a separate tool, screenshots and lost interactivity.',
        'A deck with the presenter features people rely on — notes, next slide, timer, fullscreen — built on web APIs rather than a presentation app.',
        'Product walkthroughs, onboarding, release reviews, and documentation that doubles as a talk.',
        ['Button', 'Text'],
      ),
    ],
    props: [
      { name: 'children', type: 'SlideDeckSlide[]', description: 'One element per slide; each takes notes and title.' },
      { name: 'markdown', type: 'string', description: 'Or slides as text: #, ##, -, >, **bold**, `code`, notes after Note:.' },
      { name: 'index / defaultIndex / onIndexChange', type: 'number', defaultValue: '0', description: 'Current slide, controlled or not.' },
      { name: 'hash', type: 'string | false', defaultValue: "'slide'", description: 'Keep the slide in the URL as #slide-3. Pass false when a page has more than one deck.' },
      { name: 'label', type: 'string', defaultValue: "'Presentation'", description: 'Accessible name of the deck.' },
    ],
  },

  'three-way-merge': {
    description:
      'Merges two edits of the same text against their common ancestor, as git does. Myers diffs from the base to each side are walked together: lines only one side changed are taken, identical changes on both sides are not conflicts, and what is left is shown side by side with ours, theirs, both or edit. Open conflicts are written out with git’s markers, so the result is always something git would recognise.',
    sections: [
      { title: 'Merging a config file', description: 'Four changes merge cleanly; two conflict.', Content: MergeExample },
      { title: 'diff3 markers', description: 'markerStyle="diff3" writes the base between the sides, as git’s diff3 style does.', Content: MergeDiff3Example },
      rationale(
        'Two people edited the same document; last save wins, or someone copies changes across by hand and misses one.',
        'A real diff3 decides everything decidable and asks only about true conflicts, with the four answers people actually give.',
        'Settings and config editors, CMS drafts, offline edits syncing back, and version history restores.',
        ['Button', 'Textarea', 'CopyButton', 'Text'],
      ),
    ],
    props: [
      { name: 'base / ours / theirs', type: 'string', description: 'The common ancestor and the two edits.' },
      { name: 'oursLabel / theirsLabel', type: 'string', defaultValue: "'ours', 'theirs'", description: 'Names in buttons and conflict markers.' },
      { name: 'markerStyle', type: "'merge' | 'diff3'", defaultValue: "'merge'", description: 'diff3 also writes the base inside unresolved markers.' },
      { name: 'onMergedChange', type: '(text: string, unresolved: number) => void', description: 'The merged text and the number of open conflicts.' },
    ],
  },

  redactor: {
    description:
      'Finds personal data and secrets in text and removes them only after a review. Detectors check what can be checked — card numbers pass Luhn, IBANs mod-97, JWTs must decode, assigned secrets must look random — and each finding shows its confidence and reason. Confident findings start marked for redaction, the rest wait for a decision, anything missed can be added by selection, and before and after are shown side by side.',
    sections: [
      { title: 'A support ticket', description: 'Review each finding, switch between labels and masks, then copy or download the result.', Content: RedactorExample },
      rationale(
        'Tickets, logs and transcripts get pasted into tools and prompts with card numbers, emails and API keys still in them.',
        'Validated detectors keep false positives down, and nothing is removed without being shown, so people trust the output enough to use it.',
        'Before sharing logs, exporting support data, sending text to an LLM, or attaching transcripts to a bug report.',
        ['Textarea', 'SegmentedControl', 'Button', 'CopyButton', 'Text'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'string', description: 'The source text, controlled or not.' },
      { name: 'autoAccept', type: 'number', defaultValue: '0.85', description: 'Findings at or above this start marked for redaction.' },
      { name: 'defaultStyle', type: "'label' | 'mask'", defaultValue: "'label'", description: '[REDACTED:type] or a same-length mask.' },
      { name: 'onRedactedChange', type: '(text, findings) => void', description: 'The redacted text and the accepted findings.' },
      { name: 'detectRedactorFindings', type: '(text) => RedactorFinding[]', description: 'The detectors on their own, for server-side use.' },
    ],
  },

  'readability-meter': {
    description:
      'A writing field that grades itself as you type: Flesch reading ease and Flesch–Kincaid grade, with marks in the text for hard and very hard sentences, passive voice, adverbs and words with a plainer equivalent. The marks sit on a layer behind a real textarea, so editing, undo and spellcheck stay native, and every finding is also listed in words for screen readers.',
    sections: [
      { title: 'Grading a customer email', description: 'Rewrite the first paragraph and watch the grade drop.', Content: ReadabilityExample },
      rationale(
        'Product copy and support replies drift into long, passive, jargon-heavy sentences that customers skim or misread.',
        'The standard formulas are rough but consistent, and pointing at the exact sentence is what makes them actionable.',
        'Help-centre articles, release notes, onboarding copy, support macros and any form where people write for customers.',
        ['Text'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'string', description: 'The text, controlled or not.' },
      { name: 'targetGrade', type: 'number', defaultValue: '8', description: 'Grade to aim for; the summary says whether the text meets it.' },
      { name: 'label', type: 'string', defaultValue: "'Draft'", description: 'Visible label of the field.' },
      { name: 'rows', type: 'number', defaultValue: '8', description: 'Height in rows.' },
      { name: 'analyzeReadability', type: '(text) => ReadabilityMeterStats', description: 'The analysis on its own.' },
    ],
  },

  'expense-splitter': {
    description:
      'Shared costs split four ways — equally, by shares, by exact amounts or by percentages — and settled with as few transfers as the greedy method finds. Money is held in integer minor units from the moment it is typed, and every split uses largest-remainder rounding, so each expense adds up to the cent and the balances always net to zero.',
    sections: [
      { title: 'A weekend away', description: 'Four people, four expenses, one of each split mode.', Content: ExpenseExample },
      { title: 'A currency without cents', description: 'JPY has no minor unit: ¥1,000 between three is ¥334, ¥333, ¥333.', Content: ExpenseYenExample },
      rationale(
        'Floating-point splits lose pennies, and a settlement of twelve small transfers is one nobody completes.',
        'Integer minor units with largest-remainder rounding are exact by construction, and pairing debtors with creditors keeps transfers under the number of people.',
        'Group trips, shared households, team expenses, and marketplaces that split a bill.',
        ['Input', 'Select', 'SegmentedControl', 'Checkbox', 'Button', 'IconButton'],
      ),
    ],
    props: [
      { name: 'people', type: 'ExpenseSplitterPerson[]', description: 'Everyone in the group: id and name.' },
      { name: 'expenses / defaultExpenses / onExpensesChange', type: 'ExpenseSplitterExpense[]', description: 'Amounts in minor units, payer, split mode and weights.' },
      { name: 'currency', type: 'string', defaultValue: "'USD'", description: 'ISO 4217 code; decides how many decimals are accepted.' },
      { name: 'locale', type: 'string', description: 'Locale for formatting. Defaults to the reader’s.' },
      { name: 'splitExpenseSplitterAmount / settleExpenseSplitter', type: 'functions', description: 'The rounding and settlement on their own.' },
    ],
  },

  'sql-builder': {
    description:
      'A visual query builder that knows the schema. Choose tables and the joins are found by a breadth-first search along foreign keys, adding any table in between; pick columns and aggregates and grouping follows; add conditions, ordering and a limit. The SQL is written as you go, quoted for PostgreSQL or MySQL, beside every reason the database would refuse it.',
    sections: [
      { title: 'Sales by country and product', description: 'customers and products join through orders and order_items. Try adding addresses to choose between billing and shipping.', Content: SqlExample },
      rationale(
        'People who need data but not SQL either wait on an analyst or write joins that silently multiply rows.',
        'Letting the foreign keys choose the joins removes the hardest step, and live validation catches the GROUP BY errors before the database does.',
        'Internal tools, reporting builders, admin panels and data exploration in SaaS products.',
        ['FilterBuilder', 'Checkbox', 'Select', 'SegmentedControl', 'Switch', 'Input', 'CopyButton'],
      ),
    ],
    props: [
      { name: 'schema', type: 'SqlBuilderTable[]', description: 'Tables with columns (name, type) and foreignKeys (column, table, references).' },
      { name: 'value / defaultValue / onValueChange', type: 'SqlBuilderQuery', description: 'Tables, joins, columns, groupBy, where, match, orderBy and limit.' },
      { name: 'defaultDialect', type: "'postgres' | 'mysql'", defaultValue: "'postgres'", description: 'Identifier quoting to start with.' },
      { name: 'onSqlChange', type: '(sql: string, errors: string[]) => void', description: 'The generated SQL and the validation errors.' },
      { name: 'buildSqlBuilderQuery', type: '(schema, query, dialect) => { sql, errors }', description: 'The generator on its own.' },
    ],
  },

  'jwt-inspector': {
    description:
      'Decodes a JSON Web Token, explains each claim, and checks it in the browser. Times are dates with a live countdown, the status says valid, expired, not yet valid, bad signature or unchecked, and signatures are verified with Web Crypto — HMAC secrets, RSA and ECDSA public keys as PEM or JWK. alg none is called out, and HS256 test tokens can be signed on the spot.',
    sections: [
      { title: 'HS256, expired', description: 'The secret is filled in; the audience is checked.', Content: JwtHmacExample },
      { title: 'ES256 with a JWK', description: 'Verified with a public key; the token is valid until 2100.', Content: JwtEcExample },
      { title: 'alg: none', description: 'Unsigned tokens are flagged, whatever they claim.', Content: JwtNoneExample },
      rationale(
        'Developers debug auth by pasting production tokens into third-party websites.',
        'Decoding and verifying locally with Web Crypto answers the same questions without the token leaving the page.',
        'Developer settings, API key and SSO setup screens, support tooling and internal auth dashboards.',
        ['Textarea', 'Input', 'Select', 'Button', 'StatusPill', 'Text'],
      ),
    ],
    props: [
      { name: 'value / defaultValue / onValueChange', type: 'string', description: 'The token, controlled or not.' },
      { name: 'defaultKey', type: 'string', description: 'HMAC secret, SPKI PEM, JWK or JWKS to verify with.' },
      { name: 'audience / issuer', type: 'string', description: 'Flag an aud or iss that does not match.' },
      { name: 'allowSigning', type: 'boolean', defaultValue: 'true', description: 'Show the panel that signs HS256/384/512 test tokens.' },
      { name: 'verifyJwtInspectorToken / signJwtInspectorToken', type: 'functions', description: 'Verification and signing on their own.' },
    ],
  },
}
