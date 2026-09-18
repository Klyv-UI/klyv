import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  ErrorBoundary,
  FindInPage,
  FitText,
  Hotkeys,
  KeyboardShortcutsDialog,
  Kbd,
  LazyMount,
  MiddleTruncate,
  Modal,
  ScrollSync,
  ScrollSyncPane,
  SegmentedControl,
  Sidenote,
  Sidenotes,
  Slider,
  SpatialNavigation,
  Surface,
  Switch,
  Text,
  VisionSimulator,
  useActiveHotkeyScopes,
  useHotkey,
  useHotkeyScope,
  useRegisteredHotkeys,
  type KeyboardShortcutsDialogGroup,
  type ScrollSyncMode,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

/* ------------------------------------------------------------------ shared bits */

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
      {children}
      {label}
    </label>
  )
}

function WidthSlider({ value, onChange, min, max, label }: { value: number; onChange: (value: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex w-full max-w-[360px] items-center gap-3">
      <Text as="span" size="caption" weight="semibold" tone="soft" className="shrink-0">
        {label}
      </Text>
      <Slider aria-label={label} min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <Text as="span" size="caption" tone="faint" className="w-12 shrink-0 tabular-nums">
        {value}px
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ ErrorBoundary */

interface Invoice {
  id: string
  customer: string
  lines: { label: string; amount: number }[] | null
}

const INVOICES: Invoice[] = [
  { id: 'INV-1041', customer: 'Northwind Studio', lines: [{ label: 'Design retainer', amount: 4200 }, { label: 'Usability study', amount: 1850 }] },
  { id: 'INV-1042', customer: 'Harbor & Pine', lines: null },
  { id: 'INV-1043', customer: 'Lumen Health', lines: [{ label: 'Annual licence', amount: 12000 }] },
]

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const [broken, setBroken] = useState(false)
  if (broken) throw new Error('The preview renderer crashed while laying out the totals.')
  // A malformed record from the API: the render genuinely throws on it.
  const total = invoice.lines!.reduce((sum, line) => sum + line.amount, 0)
  return (
    <div className="flex flex-col gap-2">
      <Text size="label" weight="bold">
        {invoice.id} · {invoice.customer}
      </Text>
      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {invoice.lines!.map((line) => (
          <li key={line.label} className="flex justify-between py-1.5 text-[13px] text-ink-soft">
            <span>{line.label}</span>
            <span className="tabular-nums">${line.amount.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Text size="label" weight="bold">
          Total ${total.toLocaleString('en-US')}
        </Text>
        <Button size="sm" variant="ghost" onClick={() => setBroken(true)}>
          Break this widget
        </Button>
      </div>
    </div>
  )
}

function ErrorBoundaryExample() {
  const [id, setId] = useState(INVOICES[0].id)
  const [log, setLog] = useState<string[]>([])
  const invoice = INVOICES.find((item) => item.id === id)!
  const note = (entry: string) => setLog((current) => [entry, ...current].slice(0, 4))
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label="Invoice"
          size="sm"
          value={id}
          onValueChange={setId}
          options={INVOICES.map((item) => ({ value: item.id, label: item.id }))}
          className="self-start"
        />
        <Surface variant="card" padding="md">
          <ErrorBoundary
            resetKeys={[id]}
            onError={(error) => note(`Caught: ${error.message}`)}
            onReset={(reason) => note(reason === 'keys' ? 'Reset: another invoice was picked' : 'Reset: retried')}
            title="This invoice preview didn’t load"
          >
            <InvoicePreview invoice={invoice} />
          </ErrorBoundary>
        </Surface>
        <Text size="caption" tone="faint">
          INV-1042 arrives without line items and throws. Picking another invoice clears it — no retry needed.
        </Text>
      </div>
      <Surface variant="sunken" padding="sm" className="gap-1.5">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          onError / onReset
        </Text>
        {log.length === 0 ? (
          <Text size="caption" tone="faint">
            Nothing yet.
          </Text>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {log.map((entry, index) => (
              <li key={`${entry}-${index}`} className="text-[12px] leading-snug text-ink-soft">
                {entry}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  )
}

function FlakyChart({ attempt }: { attempt: number }) {
  if (attempt < 3) throw new Error(`Chart data timed out (attempt ${attempt} of 3).`)
  return (
    <svg viewBox="0 0 200 60" className="h-16 w-full" role="img" aria-label="Signups rising over twelve weeks">
      <polyline
        fill="none"
        stroke="var(--color-accent-strong)"
        strokeWidth="3"
        points="0,52 18,48 36,50 54,40 72,42 90,33 108,35 126,24 144,26 162,16 180,14 200,6"
      />
    </svg>
  )
}

function ErrorBoundaryRenderFallback() {
  const [mounted, setMounted] = useState(false)
  const [attempt, setAttempt] = useState(1)
  return (
    <Surface variant="card" padding="md" className="w-full max-w-[420px] gap-2">
      <Text size="label" weight="bold">
        Weekly signups
      </Text>
      {mounted ? (
        <ErrorBoundary
          onReset={() => setAttempt((value) => value + 1)}
          fallback={({ error, reset }) => (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-muted p-3">
              <Text size="caption" tone="soft">
                {error.message}
              </Text>
              <Button size="sm" variant="outline" onClick={reset}>
                Retry
              </Button>
            </div>
          )}
        >
          <FlakyChart attempt={attempt} />
        </ErrorBoundary>
      ) : (
        <Button
          size="sm"
          variant="muted"
          className="self-start"
          onClick={() => setMounted(true)}
        >
          Load chart
        </Button>
      )}
    </Surface>
  )
}

/* ------------------------------------------------------------------ Hotkeys */

const FOLDERS = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts' } as const
type Folder = keyof typeof FOLDERS
const MESSAGES = ['Quarterly numbers are in', 'Offsite agenda, draft 2', 'Your invoice from Lumen', 'Design review moved to 3pm']

function MailDemo() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [selected, setSelected] = useState(0)
  const [composing, setComposing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [last, setLast] = useState('Press ? to see every shortcut.')
  const searchRef = useRef<HTMLInputElement>(null)
  const scopes = useActiveHotkeyScopes()
  const registered = useRegisteredHotkeys()

  const go = (next: Folder) => {
    setFolder(next)
    setSelected(0)
    setLast(`g ${next[0]} → ${FOLDERS[next]}`)
  }

  useHotkey('g i', () => go('inbox'), { description: 'Go to Inbox', group: 'Navigation' })
  useHotkey('g s', () => go('sent'), { description: 'Go to Sent', group: 'Navigation' })
  useHotkey('g d', () => go('drafts'), { description: 'Go to Drafts', group: 'Navigation' })
  useHotkey('j', () => setSelected((value) => Math.min(MESSAGES.length - 1, value + 1)), { description: 'Next message', group: 'Navigation' })
  useHotkey('k', () => setSelected((value) => Math.max(0, value - 1)), { description: 'Previous message', group: 'Navigation' })
  useHotkey('/', () => searchRef.current?.focus(), { description: 'Search mail', group: 'Actions' })
  useHotkey('c', () => setComposing(true), { description: 'Compose', group: 'Actions' })
  useHotkey('?', () => setHelpOpen(true), { description: 'Show shortcuts', group: 'Help' })
  useHotkey(
    'mod+enter',
    () => {
      setComposing(false)
      setLast(`Sent “${draft.trim() || 'Untitled'}” with mod+Enter`)
      setDraft('')
    },
    { scope: 'compose', allowInInputs: true, description: 'Send message', group: 'Compose' },
  )

  // Each dialog takes the keyboard while it is open; the mail shortcuts pause underneath.
  useHotkeyScope('compose', { active: composing, exclusive: true })
  useHotkeyScope('help', { active: helpOpen, exclusive: true })

  const groups = useMemo<KeyboardShortcutsDialogGroup[]>(() => {
    const byGroup = new Map<string, KeyboardShortcutsDialogGroup>()
    for (const hotkey of registered) {
      if (!hotkey.description) continue
      const title = hotkey.group ?? 'General'
      if (!byGroup.has(title)) byGroup.set(title, { title, shortcuts: [] })
      byGroup.get(title)!.shortcuts.push({ label: hotkey.description, keys: hotkey.keys, sequence: hotkey.sequence })
    }
    return [...byGroup.values()]
  }, [registered])

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
      <Surface variant="card" padding="md" className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Text size="label" weight="bold" className="mr-auto">
            {FOLDERS[folder]}
          </Text>
          <input
            ref={searchRef}
            type="search"
            aria-label="Search mail"
            placeholder="Search  /"
            className="h-8 w-40 rounded-full border border-line-strong bg-surface px-3 text-[12px] text-ink"
          />
          <Button size="sm" variant="accent" onClick={() => setComposing(true)}>
            Compose
          </Button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={`${FOLDERS[folder]} messages`}>
          {MESSAGES.map((subject, index) => (
            <li
              key={subject}
              aria-current={index === selected ? 'true' : undefined}
              className={
                index === selected
                  ? 'rounded-[10px] bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] px-3 py-2 text-[13px] font-semibold text-ink'
                  : 'rounded-[10px] px-3 py-2 text-[13px] text-ink-soft'
              }
            >
              {folder === 'inbox' ? subject : `${FOLDERS[folder]}: ${subject}`}
            </li>
          ))}
        </ul>
      </Surface>
      <Surface variant="sunken" padding="sm" className="gap-2">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Active scopes
        </Text>
        <Text size="caption" weight="semibold">
          {scopes.join(', ')}
        </Text>
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Last shortcut
        </Text>
        <Text size="caption" tone="soft" role="status">
          {last}
        </Text>
        <Text size="caption" tone="faint">
          Try <Kbd>g</Kbd> then <Kbd>s</Kbd>, <Kbd>j</Kbd>/<Kbd>k</Kbd>, <Kbd>c</Kbd> and <Kbd>?</Kbd>.
        </Text>
      </Surface>

      <Modal open={composing} onClose={() => setComposing(false)} title="New message" size="md">
        <label htmlFor="hotkeys-demo-draft" className="text-[12px] font-semibold text-ink-soft">
          Message
        </label>
        <textarea
          id="hotkeys-demo-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          className="w-full rounded-[12px] border border-line-strong bg-surface p-3 text-[13px] text-ink"
        />
        <Text size="caption" tone="faint">
          <Kbd>Ctrl</Kbd> or <Kbd>⌘</Kbd> + <Kbd>Enter</Kbd> sends. While this is open, the compose scope is exclusive, so typing c or g does
          nothing behind it.
        </Text>
      </Modal>
      <KeyboardShortcutsDialog groups={groups} open={helpOpen} onOpenChange={setHelpOpen} hotkey={false} />
    </div>
  )
}

function HotkeysExample() {
  return (
    <div className="flex w-full flex-col gap-2">
      <Text size="caption" tone="faint">
        This demo listens only inside its own box (<code>contained</code>), so click in it first.
      </Text>
      <Hotkeys contained className="w-full rounded-[var(--radius-card)] outline-offset-4">
        <div role="region" aria-label="Mail demo" tabIndex={0} className="rounded-[var(--radius-card)]">
          <MailDemo />
        </div>
      </Hotkeys>
    </div>
  )
}

/* ------------------------------------------------------------------ LazyMount */

function spark(seed: number) {
  const values = Array.from({ length: 14 }, (_, index) => 30 + Math.round(18 * Math.sin(seed * 1.7 + index * 0.6) + ((seed * 7 + index * 13) % 11)))
  return values.map((value, index) => `${(index / 13) * 200},${70 - value}`).join(' ')
}

const REGIONS = ['North America', 'Brazil', 'United Kingdom', 'Germany', 'Nordics', 'India', 'Japan', 'Australia', 'South Africa', 'Mexico', 'France', 'Singapore']

function ExpensiveChart({ seed, label }: { seed: number; label: string }) {
  const [mountedAt] = useState(() => new Date().toLocaleTimeString('en-GB'))
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="flex items-baseline justify-between">
        <Text size="label" weight="bold">
          {label}
        </Text>
        <Text size="micro" tone="faint">
          mounted {mountedAt}
        </Text>
      </div>
      <svg viewBox="0 0 200 70" preserveAspectRatio="none" className="h-[70px] w-full" role="img" aria-label={`${label} revenue, last fourteen weeks`}>
        <polyline fill="none" stroke="var(--color-accent-strong)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" points={spark(seed)} />
      </svg>
    </div>
  )
}

function LazyMountExample() {
  const [unmount, setUnmount] = useState(false)
  const [mounted, setMounted] = useState<Set<number>>(new Set())
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Labelled label="unmountWhenHidden">
          <Switch
            checked={unmount}
            onChange={(event) => {
              setUnmount(event.target.checked)
              setMounted(new Set())
            }}
          />
        </Labelled>
        <Text size="caption" weight="semibold" tone="soft" role="status">
          Charts mounted so far: {mounted.size} of {REGIONS.length}
        </Text>
      </div>
      <div role="region" aria-label="Revenue by region" tabIndex={0} className="h-[320px] overflow-auto rounded-[var(--radius-card)] border border-line bg-app p-3">
        <div key={String(unmount)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REGIONS.map((region, index) => (
            <LazyMount
              key={region}
              rootMargin="0px"
              minHeight={112}
              unmountWhenHidden={unmount}
              onMount={() => setMounted((current) => new Set(current).add(index))}
              className="rounded-[var(--radius-card)] border border-line bg-surface"
            >
              <ExpensiveChart seed={index + 1} label={region} />
            </LazyMount>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ MiddleTruncate */

const FILES = [
  'quarterly-report-2024-q3-board-pack-v3-final.pdf',
  'quarterly-report-2024-q3-board-pack-v3-final-signed.pdf',
  'IMG_20240914_183022_HDR_panorama_stitched.jpg',
  'customer-interviews-transcripts-batch-07.docx',
]

function MiddleTruncateExample() {
  const [width, setWidth] = useState(260)
  return (
    <div className="flex w-full flex-col gap-3">
      <WidthSlider label="Column width" value={width} onChange={setWidth} min={120} max={520} />
      <Surface variant="card" padding="sm" style={{ width }} className="max-w-full gap-0">
        <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
          {FILES.map((file) => (
            <li key={file} className="flex items-center gap-2 py-2">
              <span aria-hidden="true" className="size-6 shrink-0 rounded-[6px] bg-surface-muted" />
              <MiddleTruncate text={file} className="flex-1 text-[13px] font-medium text-ink" />
            </li>
          ))}
        </ul>
      </Surface>
      <Text size="caption" tone="faint">
        The two board packs stay tellable apart at any width. Hover for the full name; copy a row and the clipboard gets
        all of it.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ VisionSimulator */

function StatusChip({ tone, children }: { tone: 'success' | 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-ink"
      style={{ background: `color-mix(in oklab, var(--color-${tone}) 22%, transparent)` }}
    >
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--color-${tone})` }} />
      {children}
    </span>
  )
}

function VisionSimulatorExample() {
  const bars = [
    { label: 'Mon', ok: 62, failed: 8 },
    { label: 'Tue', ok: 71, failed: 4 },
    { label: 'Wed', ok: 55, failed: 17 },
    { label: 'Thu', ok: 68, failed: 6 },
    { label: 'Fri', ok: 74, failed: 3 },
  ]
  return (
    <VisionSimulator defaultValue="deuteranopia" className="w-full">
      <Surface variant="card" padding="md" className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Text size="label" weight="bold" className="mr-auto">
            Deploy health
          </Text>
          <StatusChip tone="success">Passing</StatusChip>
          <StatusChip tone="warning">Flaky</StatusChip>
          <StatusChip tone="danger">Failing</StatusChip>
        </div>
        <svg viewBox="0 0 300 120" className="h-36 w-full" role="img" aria-label="Builds per day: passing in green, failing in red. Wednesday had the most failures.">
          {bars.map((bar, index) => (
            <g key={bar.label} transform={`translate(${20 + index * 56}, 0)`}>
              <rect x="0" y={100 - bar.ok - bar.failed} width="36" height={bar.ok} rx="3" fill="var(--color-success)" />
              <rect x="0" y={100 - bar.failed} width="36" height={bar.failed} rx="3" fill="var(--color-danger)" />
              <text x="18" y="114" textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">
                {bar.label}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex gap-2">
          <Button size="sm" variant="accent">
            Promote build
          </Button>
          <Button size="sm" variant="outline">
            Roll back
          </Button>
        </div>
      </Surface>
    </VisionSimulator>
  )
}

/* ------------------------------------------------------------------ SpatialNavigation */

const TILES = [
  { label: 'Revenue', span: 'sm:col-span-2 sm:row-span-2', value: '$184k' },
  { label: 'Churn', span: '', value: '2.1%' },
  { label: 'NPS', span: '', value: '48' },
  { label: 'Active seats', span: 'sm:col-span-2', value: '3,912' },
  { label: 'Tickets', span: 'sm:row-span-2', value: '37' },
  { label: 'Trials', span: '', value: '128' },
  { label: 'Expansion', span: 'sm:col-span-2', value: '$22k' },
]

function SpatialNavigationExample() {
  const [last, setLast] = useState('Focus a tile, then use the arrow keys.')
  const [threshold, setThreshold] = useState(40)
  return (
    <div className="flex w-full flex-col gap-3">
      <SpatialNavigation
        label="Dashboard tiles"
        onNavigate={(element, direction) => setLast(`${direction} → ${element.dataset.tile ?? element.getAttribute('aria-label') ?? 'control'}`)}
        className="grid w-full grid-cols-2 gap-3 sm:auto-rows-[88px] sm:grid-cols-4"
      >
        {TILES.map((tile) => (
          <button
            key={tile.label}
            type="button"
            data-tile={tile.label}
            className={`flex flex-col items-start justify-between rounded-[var(--radius-card)] border border-line bg-surface p-3 text-left hover:border-line-strong focus-visible:bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-surface))] ${tile.span}`}
          >
            <span className="text-[12px] font-semibold text-ink-faint">{tile.label}</span>
            <span className="text-[20px] font-bold text-ink">{tile.value}</span>
          </button>
        ))}
        <div className="col-span-2 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:col-span-4">
          <Text as="span" size="caption" weight="semibold" tone="soft" className="shrink-0">
            Alert threshold
          </Text>
          <Slider aria-label="Alert threshold" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
          <Text as="span" size="caption" tone="faint" className="w-10 shrink-0 tabular-nums">
            {threshold}%
          </Text>
        </div>
      </SpatialNavigation>
      <Text size="caption" weight="semibold" tone="soft" role="status">
        {last}
      </Text>
      <Text size="caption" tone="faint">
        The slider keeps its arrow keys; Tab out of it to move on. Home and End jump to the first and last tile.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ FitText */

function FitTextExample() {
  const [width, setWidth] = useState(420)
  const [size, setSize] = useState<number | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <WidthSlider label="Container width" value={width} onChange={setWidth} min={160} max={640} />
      <div style={{ width }} className="max-w-full rounded-[var(--radius-card)] border border-dashed border-line-strong p-3">
        <FitText as="p" min={14} max={120} onFit={setSize} className="font-extrabold tracking-tight text-ink">
          Ship on Friday
        </FitText>
        <FitText as="p" min={12} max={48} className="font-semibold text-ink-soft">
          Release notes, week 38
        </FitText>
      </div>
      <Text size="caption" tone="faint" role="status">
        {size === null ? 'Measuring needs layout; nothing to fit yet.' : `Headline fitted at ${size}px.`}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ Sidenotes */

function SidenotesExample() {
  const [width, setWidth] = useState<'wide' | 'narrow'>('wide')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Container width"
        size="sm"
        value={width}
        onValueChange={setWidth}
        className="self-start"
        options={[
          { value: 'wide', label: 'Wide' },
          { value: 'narrow', label: 'Narrow' },
        ]}
      />
      <div className={width === 'wide' ? 'w-full' : 'w-full max-w-[420px]'}>
        <Sidenotes label="Notes on the migration" collapseBelow={620} className="text-[14px] leading-[1.7] text-ink-soft">
          <p className="m-0 mb-4">
            We moved the ledger from nightly batch jobs to an event stream
            <Sidenote note="Kafka, with one partition per account so an account’s events stay in order.">
              {' '}
              over six weeks
            </Sidenote>
            . The old jobs ran at 02:00 UTC and anything posted after that waited a full day to show up.
          </p>
          <p className="m-0 mb-4">
            The hardest part was idempotency
            <Sidenote note="Every event carries the id of the request that caused it; replays are dropped on that key." />
            , closely followed by backfills
            <Sidenote note="Two years of history, replayed at 40× speed over a weekend." />
            and reconciliation against the bank files
            <Sidenote note="Still daily — the bank sends them once a day, so there is nothing faster to reconcile against." />
            . Three notes in one sentence: watch them stack instead of overlapping.
          </p>
          <p className="m-0">
            Balances now update within two seconds of a card swipe, and the support queue for “missing transaction”
            tickets fell by about four fifths in the first month.
          </p>
        </Sidenotes>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ ScrollSync */

const SECTIONS = [
  {
    id: 'scope',
    en: ['Scope', 'This agreement covers the hosted service, its APIs and the support that comes with them.'],
    de: ['Geltungsbereich', 'Diese Vereinbarung umfasst den gehosteten Dienst, seine Programmierschnittstellen sowie den damit verbundenen Support, einschließlich aller Aktualisierungen, die während der Laufzeit bereitgestellt werden.'],
  },
  {
    id: 'data',
    en: ['Your data', 'You own everything you upload. We process it only to run the service, and delete it within 30 days of the end of the agreement. Backups are rotated out within a further 30 days, and we will confirm deletion in writing on request.'],
    de: ['Ihre Daten', 'Alle hochgeladenen Inhalte gehören Ihnen. Wir verarbeiten sie nur zum Betrieb des Dienstes.'],
  },
  {
    id: 'uptime',
    en: ['Availability', 'We aim for 99.9% monthly uptime, excluding announced maintenance.'],
    de: ['Verfügbarkeit', 'Wir streben eine monatliche Verfügbarkeit von 99,9 % an, ausgenommen angekündigte Wartungsarbeiten, die mindestens 72 Stunden im Voraus per E-Mail und auf der Statusseite bekannt gegeben werden.'],
  },
  {
    id: 'fees',
    en: ['Fees', 'Fees are billed monthly in advance. Seats added mid-month are prorated to the day.'],
    de: ['Gebühren', 'Die Gebühren werden monatlich im Voraus berechnet.'],
  },
  {
    id: 'end',
    en: ['Ending the agreement', 'Either side may end this agreement with 30 days’ written notice. Prepaid fees for the remaining period are refunded.'],
    de: ['Beendigung', 'Jede Partei kann diese Vereinbarung mit einer Frist von 30 Tagen schriftlich kündigen. Im Voraus bezahlte Gebühren für den verbleibenden Zeitraum werden erstattet, sofern keine offenen Forderungen bestehen.'],
  },
]

function ScrollSyncExample() {
  const [mode, setMode] = useState<ScrollSyncMode>('anchor')
  const [enabled, setEnabled] = useState(true)
  const pane = (lang: 'en' | 'de') =>
    SECTIONS.map((section) => (
      <section key={section.id} data-sync-anchor={section.id} className="mb-5">
        <h3 className="m-0 mb-1 text-[13px] font-bold text-ink">{section[lang][0]}</h3>
        {Array.from({ length: lang === 'en' ? (section.id === 'data' ? 3 : 1) : section.id === 'data' ? 1 : 2 }, (_, index) => (
          <p key={index} className="m-0 mb-2 text-[13px] leading-[1.6] text-ink-soft">
            {section[lang][1]}
          </p>
        ))}
      </section>
    ))
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Sync mode"
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'anchor', label: 'Anchor' },
            { value: 'proportional', label: 'Proportional' },
          ]}
        />
        <Labelled label="Keep in step">
          <Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        </Labelled>
      </div>
      <ScrollSync mode={mode} enabled={enabled}>
        <div className="grid w-full grid-cols-2 gap-3">
          <ScrollSyncPane label="English original" className="h-[260px] rounded-[var(--radius-card)] border border-line bg-surface p-4">
            {pane('en')}
          </ScrollSyncPane>
          <ScrollSyncPane label="German translation" className="h-[260px] rounded-[var(--radius-card)] border border-line bg-surface p-4">
            {pane('de')}
          </ScrollSyncPane>
        </div>
      </ScrollSync>
      <Text size="caption" tone="faint">
        Sections differ in length on each side. In anchor mode each heading arrives at the top of both panes together;
        proportional mode drifts between them.
      </Text>
    </div>
  )
}

const WEEKS = Array.from({ length: 26 }, (_, index) => `W${index + 1}`)

function ScrollSyncHorizontal() {
  return (
    <ScrollSync axis="horizontal">
      <div className="flex w-full flex-col gap-2">
        <ScrollSyncPane label="Week headers" className="rounded-[10px] border border-line bg-surface-muted">
          <div className="flex w-max">
            {WEEKS.map((week) => (
              <div key={week} className="w-16 shrink-0 px-2 py-1.5 text-center text-[11px] font-bold text-ink-faint">
                {week}
              </div>
            ))}
          </div>
        </ScrollSyncPane>
        <ScrollSyncPane label="Capacity by week" className="rounded-[10px] border border-line bg-surface">
          <div className="flex w-max items-end">
            {WEEKS.map((week, index) => (
              <div key={week} className="flex h-24 w-16 shrink-0 items-end justify-center px-2 pb-2">
                <div
                  className="w-full rounded-[4px] bg-accent"
                  style={{ height: `${30 + ((index * 37) % 60)}%` }}
                  title={`${week}: ${30 + ((index * 37) % 60)}% booked`}
                />
              </div>
            ))}
          </div>
        </ScrollSyncPane>
      </div>
    </ScrollSync>
  )
}

/* ------------------------------------------------------------------ FindInPage */

function FindInPageExample() {
  const [open, setOpen] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => setSupported(typeof CSS !== 'undefined' && 'highlights' in CSS), [])
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} aria-expanded={open}>
          Find in handbook
        </Button>
        <Text size="caption" tone="faint">
          Or click in the text and press <Kbd>Ctrl</Kbd> + <Kbd>F</Kbd> (<Kbd>⌘</Kbd> + <Kbd>F</Kbd> on a Mac). Try “refund”.
        </Text>
      </div>
      <FindInPage label="the handbook" open={open} onOpenChange={setOpen} className="h-[340px] overflow-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <article className="flex flex-col gap-3 p-4 text-[13px] leading-[1.65] text-ink-soft">
          <h3 className="m-0 text-[15px] font-bold text-ink">Support handbook</h3>
          <p className="m-0">
            Answer within one business day. When a customer asks for a <strong>refund</strong>, check the plan first:
            annual plans are refunded pro rata, monthly plans are not refunded but can be cancelled at any time.
          </p>
          <details className="rounded-[10px] border border-line p-3">
            <summary className="cursor-pointer font-semibold text-ink">Billing disputes</summary>
            <p className="m-0 mt-2">
              A chargeback freezes the workspace. Offer a refund before it reaches the bank — it is cheaper for both
              sides, and the workspace stays open.
            </p>
          </details>
          <details className="rounded-[10px] border border-line p-3">
            <summary className="cursor-pointer font-semibold text-ink">Account recovery</summary>
            <p className="m-0 mt-2">
              Never change an email address from a support ticket alone. Ask for the recovery code, or verify through
              the billing contact on file.
            </p>
          </details>
          <details className="rounded-[10px] border border-line p-3">
            <summary className="cursor-pointer font-semibold text-ink">Outages</summary>
            <p className="m-0 mt-2">
              Link the status page rather than guessing at a cause. Credits for downtime follow the SLA, not a refund
              request, and are applied automatically to the next invoice.
            </p>
          </details>
          <p className="m-0">
            Escalate anything involving personal data to the privacy team the same day. Refund requests older than 90
            days go to finance.
          </p>
        </article>
      </FindInPage>
      {supported === false && (
        <Text size="caption" tone="faint">
          This browser has no CSS Custom Highlight API, so matches are counted and the current one is selected instead of
          painted.
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'error-boundary': {
    description:
      'Catches a render error in its subtree and shows a fallback in its place, so one broken widget does not blank the page. The fallback can be a node or a function given the error and a reset; resetKeys reset it automatically when the input that caused the error changes, and focus moves to the fallback when the element that had it disappears.',
    sections: [
      { title: 'Reset by key, or retry', Content: ErrorBoundaryExample },
      {
        title: 'Render-function fallback',
        description: 'The chart fails twice before it loads; the fallback is written by the caller and gets reset.',
        Content: ErrorBoundaryRenderFallback,
      },
      rationale(
        'A single throwing render unmounts the entire React tree, so a bad record in a side panel takes the checkout down with it.',
        'React only catches render errors in class components with getDerivedStateFromError; this wraps that once, with the resetKeys pattern that makes recovery automatic.',
        'Around any widget that renders data it does not control: previews, charts, third-party embeds, plugin slots.',
        ['Button', 'Text'],
      ),
    ],
    props: [
      { name: 'fallback', type: 'ReactNode | ({ error, reset }) => ReactNode', description: 'What replaces the failed subtree. Omit for the built-in panel with a retry.' },
      { name: 'resetKeys', type: 'unknown[]', description: 'Reset automatically when any of these change while the fallback is showing.' },
      { name: 'onError', type: '(error: Error, info: ErrorInfo) => void', description: 'Called once per caught error with the component stack. Report from here.' },
      { name: 'onReset', type: "(reason: 'retry' | 'keys') => void", description: 'Called after the error clears, with what cleared it.' },
      { name: 'title', type: 'string', defaultValue: "'This part didn’t load'", description: 'Heading of the built-in fallback.' },
      { name: 'retryLabel', type: 'string', defaultValue: "'Try again'", description: 'Label of the built-in retry button.' },
    ],
  },

  hotkeys: {
    description:
      'An app-wide shortcut registry. Components register with useHotkey; the provider resolves mod to ⌘ or Ctrl for the device, matches sequences like “g i” within a timeout, ignores keys typed into fields unless asked, and warns in development when one scope claims a combo twice. Scopes let a dialog take the keyboard while it is open, and useRegisteredHotkeys feeds the shortcuts dialog from the shortcuts that actually exist.',
    sections: [
      { title: 'A mail client', Content: HotkeysExample },
      rationale(
        'Shortcuts wired one keydown listener at a time collide silently, keep firing under open dialogs, and cannot be listed.',
        'One registry sees every shortcut, so conflicts, scopes and the help dialog all come from the same source of truth.',
        'Keyboard-heavy apps: inboxes, editors, dashboards — anywhere with a “?” shortcuts sheet.',
        ['KeyboardShortcutsDialog', 'Modal', 'Kbd'],
      ),
    ],
    props: [
      { name: 'Hotkeys / HotkeysProvider', type: 'component', description: 'The registry. Wrap the app once; props below.' },
      { name: 'sequenceTimeout', type: 'number', defaultValue: '1000', description: 'Milliseconds allowed between the steps of a sequence.' },
      { name: 'initialScopes', type: 'string[]', defaultValue: '[]', description: 'Scopes active from the start, besides global.' },
      { name: 'contained', type: 'boolean', defaultValue: 'false', description: 'Listen only to key presses inside the provider’s element.' },
      { name: 'useHotkey(combo, handler, options)', type: 'hook', description: 'Register a shortcut: “mod+k”, “shift+?”, or a sequence “g i”.' },
      { name: 'options.scope', type: 'string', defaultValue: "'global'", description: 'Only fires while this scope is active.' },
      { name: 'options.enabled', type: 'boolean', defaultValue: 'true', description: 'Turn it off while keeping it registered.' },
      { name: 'options.allowInInputs', type: 'boolean', defaultValue: 'false', description: 'Fire while a field has focus.' },
      { name: 'options.description / group', type: 'string', description: 'How it is listed by useRegisteredHotkeys.' },
      { name: 'useHotkeyScope(scope, { active, exclusive })', type: 'hook', description: 'Activate a scope while mounted; exclusive suspends every earlier scope.' },
      { name: 'useRegisteredHotkeys()', type: 'HotkeysRegistration[]', description: 'Every shortcut, live, with keys in KeyboardShortcutsDialog form.' },
    ],
  },

  'lazy-mount': {
    description:
      'Mounts its children only when it comes within rootMargin of the viewport, holding their space with a minHeight or aspect ratio until then so the page does not jump. unmountWhenHidden lets them go again once far away, keeping the measured height. It mounts at once where IntersectionObserver is missing, and everything mounts before printing.',
    sections: [
      { title: 'Twelve charts, a few on screen', Content: LazyMountExample },
      rationale(
        'A long dashboard pays to render every chart on load, although the reader sees a handful.',
        'IntersectionObserver is the one reliable way to know what is about to be seen; reserving space keeps the scrollbar honest.',
        'Long dashboards, feeds with heavy embeds, report pages with many charts.',
        ['Switch'],
      ),
    ],
    props: [
      { name: 'rootMargin', type: 'string', defaultValue: "'200px'", description: 'How far outside the viewport to start mounting.' },
      { name: 'minHeight', type: 'number | string', description: 'Space held before mount. Number is px.' },
      { name: 'aspectRatio', type: 'number | string', description: 'Aspect ratio held before mount, for media.' },
      { name: 'placeholder', type: 'ReactNode', description: 'Shown in the reserved space. Defaults to a sunken block.' },
      { name: 'unmountWhenHidden', type: 'boolean', defaultValue: 'false', description: 'Unmount again when far away, keeping the last height.' },
      { name: 'onMount', type: '() => void', description: 'Called each time the children mount.' },
    ],
  },

  'middle-truncate': {
    description:
      'Cuts the middle of a string that does not fit and keeps its end — by default the file extension and a few characters before it — so similar names stay tellable apart. The cut is computed from the element’s own font on a canvas and redone on resize; screen readers, the tooltip and the clipboard all get the full value.',
    sections: [
      { title: 'File names in a narrow column', Content: MiddleTruncateExample },
      {
        title: 'keepEnd',
        stack: true,
        specimens: [
          { label: "'extension'", hint: 'default', node: <div className="w-[220px]"><MiddleTruncate text="brand-guidelines-2024-master-approved.sketch" className="text-[13px]" /></div> },
          { label: '8', hint: 'a commit hash’s tail', node: <div className="w-[160px]"><MiddleTruncate text="feature/billing-proration-7f3a9c2e" keepEnd={8} className="font-mono text-[12px]" /></div> },
          { label: '0', hint: 'balanced', node: <div className="w-[180px]"><MiddleTruncate text="https://klyvui.xyz/components/middle-truncate" keepEnd={0} className="text-[13px]" /></div> },
        ],
      },
      rationale(
        'End-truncation hides exactly the part that distinguishes file names, branches and IDs.',
        'Measuring the real font with canvas gives the longest string that fits instead of a character-count guess.',
        'File lists, branch pickers, table cells with paths or IDs.',
        [],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'The full value — what is read, shown on hover and copied.' },
      { name: 'keepEnd', type: "number | 'extension'", defaultValue: "'extension'", description: 'Characters always kept at the end.' },
      { name: 'ellipsis', type: 'string', defaultValue: "'…'", description: 'What stands in for the cut.' },
      { name: 'as', type: 'ElementType', defaultValue: "'span'", description: 'Element to render.' },
    ],
  },

  'vision-simulator': {
    description:
      'Shows an interface as people with a colour-vision deficiency or low vision see it. Content is run through SVG filters defined in the page — the Machado et al. (2009) matrices for protanopia, deuteranopia and tritanopia, a luminance matrix for achromatopsia, a blur and a contrast squeeze — and stays live and interactive underneath.',
    sections: [
      { title: 'Is red and green enough?', Content: VisionSimulatorExample },
      rationale(
        'Whether a status colour scheme survives colour blindness is usually a guess made once and never checked.',
        'Published simulation matrices applied as SVG filters are accurate, cheap, and need no screenshot or plugin.',
        'Design reviews, the docs for a chart palette, an in-app accessibility checker.',
        ['Select'],
      ),
    ],
    props: [
      { name: 'value', type: 'VisionSimulatorMode', description: 'The simulated condition. Omit to let the component manage it.' },
      { name: 'defaultValue', type: 'VisionSimulatorMode', defaultValue: "'none'", description: 'Starting condition when uncontrolled.' },
      { name: 'onValueChange', type: '(value: VisionSimulatorMode) => void', description: 'Called when the picker changes.' },
      { name: 'showPicker', type: 'boolean', defaultValue: 'true', description: 'Show the built-in picker.' },
      { name: 'label', type: 'string', defaultValue: "'Simulated vision'", description: 'Accessible name of the picker.' },
    ],
  },

  'spatial-navigation': {
    description:
      'Arrow keys move focus to the nearest focusable element in that direction by on-screen geometry — for dashboards of mixed-size cards and tile layouts that are neither a list nor a regular grid. A cone rules out things behind or far to the side, sideways distance costs more than forward distance, and controls that use the arrow keys themselves are left alone.',
    sections: [
      { title: 'A bento dashboard', Content: SpatialNavigationExample },
      rationale(
        'Tab through a mixed-size grid zigzags in source order, and roving focus needs rows and columns that such layouts do not have.',
        'Geometry is the only thing that matches what the reader sees, whatever the DOM order.',
        'Dashboards, TV-style shelves, canvases of cards, toolbars of irregular shape.',
        ['Slider'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name; makes the container a labelled group.' },
      { name: 'homeEnd', type: 'boolean', defaultValue: 'true', description: 'Home and End jump to the first and last element.' },
      { name: 'coneAngle', type: 'number', defaultValue: '60', description: 'Half-angle of the search cone, in degrees.' },
      { name: 'ignore', type: 'string', description: 'Extra selector for elements that keep their arrow keys. data-spatial-ignore also works.' },
      { name: 'onNavigate', type: '(element, direction) => void', description: 'Called after focus moves.' },
      { name: 'as', type: 'ElementType', defaultValue: "'div'", description: 'Element to render.' },
    ],
  },

  'fit-text': {
    description:
      'Sizes one line of text to fill its container exactly: it measures at a known size, scales by the width ratio and corrects once for anything non-linear. It refits on resize and when web fonts load, clamps between min and max, and stays ordinary selectable text.',
    sections: [
      { title: 'Headline that fills its column', Content: FitTextExample },
      rationale(
        'Viewport units follow the window, not the column, and a longer translation overflows.',
        'Measuring the rendered line is exact for any font, weight or language.',
        'Hero headlines, big numbers on a stat card, posters and covers.',
        [],
      ),
    ],
    props: [
      { name: 'children', type: 'string', description: 'The line to fit. It never wraps.' },
      { name: 'min', type: 'number', defaultValue: '16', description: 'Smallest font size in px.' },
      { name: 'max', type: 'number', defaultValue: '160', description: 'Largest font size in px.' },
      { name: 'as', type: 'ElementType', defaultValue: "'div'", description: 'Element to render.' },
      { name: 'onFit', type: '(fontSize: number) => void', description: 'Called with the fitted size after each fit.' },
    ],
  },

  sidenotes: {
    description:
      'Margin notes placed at the height of their markers and pushed down just enough to clear each other, re-laid out when the text reflows. Below a container width the margin is too narrow to read, so each marker becomes a button that opens its note inline. Markers and notes are linked for assistive technology in both modes.',
    sections: [
      { title: 'An engineering write-up', Content: SidenotesExample },
      rationale(
        'Footnotes send the reader to the bottom and back; tooltips hide the note from anyone not hovering.',
        'A note beside its sentence is read in context, and collision-free placement is what makes several per paragraph work.',
        'Long-form articles, documentation, post-mortems and essays.',
        [],
      ),
    ],
    props: [
      { name: 'label', type: 'string', defaultValue: "'Notes'", description: 'Accessible name of the list of notes in the margin.' },
      { name: 'noteWidth', type: 'number', defaultValue: '224', description: 'Width of the margin column in px.' },
      { name: 'gap', type: 'number', defaultValue: '32', description: 'Space between text and margin in px.' },
      { name: 'collapseBelow', type: 'number', defaultValue: '640', description: 'Container width in px below which notes become inline toggles.' },
      { name: 'Sidenote note', type: 'ReactNode', description: 'The note. Its children, if any, are the text it is about.' },
    ],
  },

  'scroll-sync': {
    description:
      'Keeps several scroll containers in step. Proportional mode matches the fraction scrolled; anchor mode lines up elements that share a data-sync-anchor value and interpolates between them. Positions it writes are remembered and their echo events dropped, so panes never feed back into each other.',
    sections: [
      { title: 'Original and translation', Content: ScrollSyncExample },
      { title: 'Horizontal', description: 'A header strip that follows the chart under it.', Content: ScrollSyncHorizontal },
      rationale(
        'Syncing scroll naively loops: each pane’s programmatic scroll fires an event that scrolls the other one back.',
        'Recognising echoes breaks the loop, and anchors keep sections aligned when their lengths differ.',
        'Diffs, source and preview, translations side by side, frozen headers over wide charts.',
        ['SegmentedControl', 'Switch'],
      ),
    ],
    props: [
      { name: 'mode', type: "'proportional' | 'anchor'", defaultValue: "'proportional'", description: 'How positions are matched.' },
      { name: 'axis', type: "'vertical' | 'horizontal' | 'both'", defaultValue: "'vertical'", description: 'Which direction is kept in step.' },
      { name: 'enabled', type: 'boolean', defaultValue: 'true', description: 'Turn syncing off without unmounting anything.' },
      { name: 'ScrollSyncPane label', type: 'string', description: 'Accessible name of the pane, a focusable region.' },
    ],
  },

  'find-in-page': {
    description:
      'Ctrl/⌘+F for one part of a page. It searches only its own content, counts matches (“3 of 17”, announced), steps with Enter and Shift+Enter, and opens any closed details that hides the current match. Matches are painted with the CSS Custom Highlight API so the DOM is never rewritten; without it, the current match is selected and scrolled to.',
    sections: [
      { title: 'A support handbook', Content: FindInPageExample },
      rationale(
        'The browser’s find searches the whole page and cannot see into collapsed sections.',
        'Highlights paint ranges without touching the DOM, so React’s tree and the content’s handlers stay intact.',
        'Long documents, logs, settings pages, help panels.',
        ['Input', 'IconButton'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', defaultValue: "'this section'", description: 'What the content is, for the field’s name.' },
      { name: 'open', type: 'boolean', description: 'Whether the bar shows. Omit to let the component manage it.' },
      { name: 'defaultOpen', type: 'boolean', defaultValue: 'false', description: 'Starting state when uncontrolled.' },
      { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Called when the bar asks to open or close.' },
      { name: 'shortcut', type: "'within' | 'document' | false", defaultValue: "'within'", description: 'Where Ctrl/⌘+F opens this bar instead of the browser’s.' },
    ],
  },
}
