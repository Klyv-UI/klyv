import { useMemo, useState } from 'react'
import { Download, PanelRight } from 'lucide-react'
import {
  AccessDeniedState,
  Button,
  Checkbox,
  ChecklistPopover,
  FeatureBeacon,
  Field,
  FloatingPanel,
  FullscreenDialog,
  Input,
  LinkPreview,
  MaintenanceNotice,
  NotFoundState,
  SearchField,
  Surface,
  SwipeToConfirm,
  Text,
  Textarea,
  UpdateAvailable,
  type ChecklistPopoverItem,
  type FloatingPanelPosition,
  type LinkPreviewData,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const MINUTE = 60_000
const HOUR = 3_600_000

function Note({ children }: { children: string }) {
  return (
    <Text size="caption" tone="faint" leading="normal" aria-live="polite">
      {children}
    </Text>
  )
}

/* ----------------------------------------------------- update available */

function UpdateToastExample() {
  const [available, setAvailable] = useState(true)
  const [version, setVersion] = useState('v4.12.0')
  const [reloading, setReloading] = useState(false)
  const [log, setLog] = useState('A deploy has just finished.')

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = `v4.${12 + Math.floor(Math.random() * 8)}.${Math.floor(Math.random() * 9)}`
            setVersion(next)
            setAvailable(true)
            setReloading(false)
            setLog(`Deployed ${next}.`)
          }}
        >
          Simulate a deploy
        </Button>
      </div>
      <UpdateAvailable
        available={available}
        version={version}
        reloading={reloading}
        whatsNewHref="#changelog"
        snoozeMinutes={1}
        onReload={() => {
          setReloading(true)
          window.setTimeout(() => {
            setReloading(false)
            setAvailable(false)
            setLog(`Reloaded onto ${version}.`)
          }, 1200)
        }}
        onLater={() => setLog('Put off until the next version.')}
        onSnooze={(until) => setLog(`Snoozed until ${until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}.`)}
      />
      <Note>{log}</Note>
    </div>
  )
}

function UpdateBannerExample() {
  const [available, setAvailable] = useState(true)
  return (
    <div className="flex w-full flex-col gap-3">
      <UpdateAvailable
        variant="banner"
        available={available}
        version="v4.12.0"
        snoozeMinutes={0}
        description="Reload to get the latest fixes."
        onReload={() => setAvailable(false)}
        whatsNewHref="#changelog"
      />
      {!available && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setAvailable(true)}>
          Show again
        </Button>
      )}
    </div>
  )
}

/* ---------------------------------------------------- maintenance notice */

function MaintenanceLiveExample() {
  const [key, setKey] = useState(0)
  const { start, end } = useMemo(() => {
    const base = Math.ceil((Date.now() + 3 * HOUR) / (15 * MINUTE)) * 15 * MINUTE
    return { start: new Date(base), end: new Date(base + 2 * HOUR) }
  }, [])
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <MaintenanceNotice
        key={key}
        start={start}
        end={end}
        title="Database upgrade"
        impact="degraded"
        description="Reports will be read-only while the upgrade runs. Scheduled exports will run afterwards."
        statusHref="#status"
        storageKey="klyv-demo-maintenance"
        className="w-full"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          try {
            window.localStorage.removeItem(`klyv-demo-maintenance:${start.getTime()}`)
          } catch {
            // Storage blocked; the notice was never remembered.
          }
          setKey((value) => value + 1)
        }}
      >
        Forget dismissal
      </Button>
      <Note>The window is shown in your own time zone. Dismissal is stored for this window only.</Note>
    </div>
  )
}

function MaintenancePhases() {
  const start = useMemo(() => new Date(Date.UTC(2026, 9, 3, 1, 0)), [])
  const end = useMemo(() => new Date(Date.UTC(2026, 9, 3, 3, 0)), [])
  return (
    <div className="flex w-full flex-col gap-3">
      <MaintenanceNotice start={start} end={end} now={new Date(start.getTime() - 26 * MINUTE)} impact="outage" title="Billing migration" />
      <MaintenanceNotice start={start} end={end} now={new Date(start.getTime() + 50 * MINUTE)} impact="outage" title="Billing migration" statusHref="#status" />
      <MaintenanceNotice start={start} end={end} now={new Date(end.getTime() + 5 * MINUTE)} title="Billing migration" onDismiss={() => undefined} />
    </div>
  )
}

/* ------------------------------------------------------- not found state */

const POPULAR = [
  { label: 'Documentation', href: '#docs', description: 'Guides, API reference and examples' },
  { label: 'Pricing', href: '#pricing', description: 'Plans for teams of every size' },
  { label: 'Changelog', href: '#changelog', description: 'What shipped this month' },
]

function NotFoundExample() {
  const [query, setQuery] = useState('')
  return (
    <NotFoundState
      headingLevel="h2"
      links={POPULAR}
      homeHref="#home"
      onBack={() => undefined}
      search={
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <SearchField value={query} onValueChange={setQuery} label="Search the site" placeholder="Search the site" />
        </form>
      }
    />
  )
}

function NotFoundCompact() {
  return (
    <NotFoundState
      headingLevel="h3"
      illustration={null}
      code="404"
      title="This project no longer exists"
      description="It may have been deleted or moved to another workspace."
      showBack={false}
      homeHref="#projects"
      homeLabel="All projects"
      className="py-6"
    />
  )
}

/* --------------------------------------------------- access denied state */

function AccessDeniedExample() {
  const [attempts, setAttempts] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <AccessDeniedState
        key={attempts}
        headingLevel="h2"
        resource="Q3 board deck"
        resourceType="document"
        owner={{ name: 'Priya Raman', email: 'priya@northwind.io' }}
        account="sam.lee@example.com"
        onSwitchAccount={() => undefined}
        onRequestAccess={() => new Promise((resolve) => window.setTimeout(resolve, 900))}
      />
      <Button size="sm" variant="ghost" onClick={() => setAttempts((value) => value + 1)}>
        Reset example
      </Button>
    </div>
  )
}

/* ------------------------------------------------------ fullscreen dialog */

function ComposeExample() {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [log, setLog] = useState('Nothing posted yet.')
  const dirty = subject.trim() !== '' || body.trim() !== ''

  const close = () => {
    setOpen(false)
    setSubject('')
    setBody('')
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => setOpen(true)}>Write an update</Button>
      <Note>{log}</Note>
      <FullscreenDialog
        open={open}
        onClose={close}
        title="New team update"
        actionLabel="Post"
        actionDisabled={subject.trim() === ''}
        actionLoading={saving}
        dirty={dirty && !saving}
        onAction={() => {
          setSaving(true)
          window.setTimeout(() => {
            setSaving(false)
            setLog(`Posted “${subject.trim()}”.`)
            close()
          }, 800)
        }}
      >
        <div className="flex flex-col gap-4">
          <Field label="Subject">
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Sprint 42 wrap-up" />
          </Field>
          <Field label="Update" hint="Type anything, then press Escape or Close to see the discard question.">
            <Textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
          </Field>
        </div>
      </FullscreenDialog>
    </div>
  )
}

function AlwaysFullExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open terms
      </Button>
      <FullscreenDialog open={open} onClose={() => setOpen(false)} title="Workspace terms" mode="always">
        <div className="mx-auto flex max-w-[640px] flex-col gap-3">
          {Array.from({ length: 12 }, (_, index) => (
            <Text key={index} size="body" weight="medium" tone="soft" leading="normal">
              {index + 1}. Content you add to the workspace stays yours. Admins can export or delete it at any time, and
              removed members lose access immediately. Only the body scrolls — the header stays put.
            </Text>
          ))}
        </div>
      </FullscreenDialog>
    </div>
  )
}

/* ---------------------------------------------------------- feature beacon */

function BeaconExample() {
  const [seen, setSeen] = useState(false)
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <Surface variant="tile" className="flex w-full flex-wrap items-center gap-2 p-2.5">
        <Button size="sm" variant="ghost">
          Filter
        </Button>
        <Button size="sm" variant="ghost">
          Sort
        </Button>
        <FeatureBeacon
          title="Export to CSV"
          description="Download exactly what this view shows — filters and column order included."
          dismissed={seen}
          onDismiss={() => setSeen(true)}
        >
          <Button size="sm" variant="outline">
            <Download size={14} aria-hidden="true" />
            Export
          </Button>
        </FeatureBeacon>
      </Surface>
      <div className="flex items-center gap-3">
        <Note>{seen ? 'Acknowledged — onDismiss stored it.' : 'Press the pulsing dot on Export.'}</Note>
        {seen && (
          <Button size="sm" variant="ghost" onClick={() => setSeen(false)}>
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- checklist popover */

const STEPS: Omit<ChecklistPopoverItem, 'done'>[] = [
  { id: 'profile', title: 'Complete your profile', description: 'A photo and a role help teammates find you.', href: '#profile', actionLabel: 'Open' },
  { id: 'invite', title: 'Invite your team', description: 'Work is faster with people in it.', href: '#invite', actionLabel: 'Invite' },
  { id: 'connect', title: 'Connect Slack', description: 'Get updates where you already talk.', href: '#slack', actionLabel: 'Connect' },
  { id: 'project', title: 'Create a project', href: '#project', actionLabel: 'Create' },
  { id: 'billing', title: 'Add a payment method', href: '#billing', actionLabel: 'Add' },
]

function ChecklistExample() {
  const [done, setDone] = useState<Record<string, boolean>>({ profile: true, invite: true })
  const items = STEPS.map((step) => ({ ...step, done: Boolean(done[step.id]) }))
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-ink-soft">Mark steps done elsewhere in the app</legend>
        {STEPS.map((step) => (
          <label key={step.id} className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Checkbox
              checked={Boolean(done[step.id])}
              onChange={(event) => setDone((current) => ({ ...current, [step.id]: event.target.checked }))}
            />
            {step.title}
          </label>
        ))}
      </fieldset>
      <ChecklistPopover items={items} onDismiss={() => setDone({})} />
    </div>
  )
}

/* ------------------------------------------------------------ link preview */

function artwork(from: string, to: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 382 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="382" height="200" fill="url(#g)"/><text x="24" y="170" font-family="system-ui" font-size="28" font-weight="800" fill="#16200c">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const PREVIEWS: Record<string, LinkPreviewData> = {
  'https://www.northwind.io/blog/offline-first': {
    title: 'Offline first, eighteen months in',
    description: 'What we learned moving a 40-screen app to a local database — sync conflicts, migrations and the bugs nobody warned us about.',
    image: artwork('#c8f24e', '#7fd1ae', 'Offline first'),
    siteName: 'Northwind Engineering',
  },
  'https://docs.example.com/guides/rate-limits': {
    title: 'Rate limits',
    description: 'Each key may make 600 requests a minute. Responses include headers that say how many remain and when the window resets.',
    siteName: 'Example API',
  },
}

function loadPreview(href: string) {
  return new Promise<LinkPreviewData>((resolve, reject) =>
    window.setTimeout(() => (PREVIEWS[href] ? resolve(PREVIEWS[href]) : reject(new Error('Not found'))), 700),
  )
}

function LinkPreviewExample() {
  return (
    <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[560px]">
      Before you start, read{' '}
      <LinkPreview href="https://www.northwind.io/blog/offline-first" data={PREVIEWS['https://www.northwind.io/blog/offline-first']}>
        how Northwind went offline first
      </LinkPreview>{' '}
      and check the{' '}
      <LinkPreview href="https://docs.example.com/guides/rate-limits" load={loadPreview}>
        rate limit guide
      </LinkPreview>
      . Some pages have{' '}
      <LinkPreview href="https://unknown.example.org/missing" load={loadPreview}>
        no preview at all
      </LinkPreview>
      .
    </Text>
  )
}

/* ----------------------------------------------------------- floating panel */

function FloatingPanelExample() {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<FloatingPanelPosition | undefined>(undefined)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen((value) => !value)} aria-pressed={open}>
        <PanelRight size={14} aria-hidden="true" />
        {open ? 'Hide inspector' : 'Show inspector'}
      </Button>
      <Note>
        {saved
          ? `Position saved at ${saved.x}, ${saved.y}. Close and reopen — it comes back there.`
          : 'Drag the title bar, or focus the grip and use the arrow keys.'}
      </Note>
      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        title="Inspector"
        defaultPosition={saved}
        onPositionChange={setSaved}
        width={280}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
          {[
            ['Element', 'Button'],
            ['Size', '120 × 40'],
            ['Padding', '0 20px'],
            ['Radius', '999px'],
            ['Fill', 'accent'],
          ].map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-semibold text-ink-soft">{term}</dt>
              <dd className="font-mono text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <Text size="caption" tone="faint" leading="normal" className="mt-3">
          The page behind stays usable — this panel is not modal.
        </Text>
      </FloatingPanel>
    </div>
  )
}

/* ---------------------------------------------------------- swipe to confirm */

function SwipeExample() {
  const [log, setLog] = useState('Nothing sent.')
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      <SwipeToConfirm
        label="Slide to send $240.00"
        pendingLabel="Sending…"
        doneLabel="Sent to Alex"
        resetAfter={2500}
        onConfirm={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 1100))
          setLog(`Sent $240.00 at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`)
        }}
      />
      <Note>{log}</Note>
    </div>
  )
}

/* --------------------------------------------------------------- examples */

export const demos: ExampleModule = {
  'update-available': {
    description:
      'The prompt a long-lived app shows when a new version has been deployed. It asks rather than reloading, because a reload throws away unsaved work; it takes no focus and is announced politely. Reload now, snooze for a set time, or put it off until the next version — and a link to what changed.',
    sections: [
      { title: 'Toast', description: 'Snooze is set to one minute here so you can watch it come back. Simulate a deploy to bring back a prompt put off with Later.', Content: UpdateToastExample },
      { title: 'Banner', description: 'A full-width strip for apps where a corner toast would sit on top of controls.', Content: UpdateBannerExample },
      rationale(
        'Service workers and SPAs keep old code running for days, and the fixes shipped this morning never reach the tab opened on Monday — or reach it through a reload that eats a half-written form.',
        'A non-modal prompt keeps the reader in charge of when to reload, while snooze makes “later” mean a time rather than never.',
        'PWAs, dashboards, editors and anything else people keep open across deploys.',
        ['Button', 'IconButton', 'Text'],
      ),
    ],
    props: [
      { name: 'available', type: 'boolean', description: 'Whether a new version is waiting.' },
      { name: 'onReload', type: '() => void', description: 'Activates the waiting version and reloads.' },
      { name: 'version', type: 'string', description: 'Shown beside the title. A new value brings back a prompt put off with Later.' },
      { name: 'title / description', type: 'string / ReactNode', description: 'Headline and supporting line.' },
      { name: 'whatsNewHref / whatsNewLabel', type: 'string', defaultValue: "'What’s new'", description: 'Link to release notes.' },
      { name: 'reloadLabel', type: 'string', defaultValue: "'Reload now'", description: 'Label on the primary action.' },
      { name: 'onLater', type: '() => void', description: 'Called when the prompt is put off until the next version.' },
      { name: 'snoozeMinutes / onSnooze', type: 'number / (until: Date) => void', defaultValue: '60', description: 'How long a snooze hides it; 0 removes the snooze.' },
      { name: 'reloading', type: 'boolean', defaultValue: 'false', description: 'Shows the reload as in progress.' },
      { name: 'variant', type: "'toast' | 'banner'", defaultValue: 'toast', description: 'Floating card or full-width strip.' },
      { name: 'fixed', type: 'boolean', defaultValue: 'false', description: 'Pin to the viewport instead of the flow.' },
    ],
  },

  'maintenance-notice': {
    description:
      'A banner for planned downtime. The window is written in the reader’s own time zone with a relative countdown, the impact is stated plainly, and the notice turns into “in progress” and then “completed” by the clock. Dismissal is stored per window, so closing this one never hides the next.',
    sections: [
      { title: 'Upcoming, following the clock', description: 'Starts about three hours from now. Dismiss it, reload the page, and it stays gone.', Content: MaintenanceLiveExample },
      { title: 'Three phases', description: 'The same window with now pinned before, during and after.', Content: MaintenancePhases },
      rationale(
        'Maintenance notices say “02:00–04:00 UTC” and leave the reader to work out whether that is tonight, and they either never go away or vanish for next month too.',
        'Local time plus a countdown answers “do I need to save now?” at a glance, and a phase driven by the clock means a notice posted a week ahead stays true.',
        'Top of an app or status-sensitive page — billing, reporting, anything people schedule work around.',
        ['IconButton', 'Text'],
      ),
    ],
    props: [
      { name: 'start / end', type: 'Date', description: 'The maintenance window.' },
      { name: 'title / description', type: 'string / ReactNode', defaultValue: "'Scheduled maintenance'", description: 'What is being worked on, and extra detail.' },
      { name: 'impact', type: "'none' | 'degraded' | 'outage'", defaultValue: 'degraded', description: 'Drives the impact line.' },
      { name: 'statusHref / statusLabel', type: 'string', defaultValue: "'Status page'", description: 'Link to live updates.' },
      { name: 'storageKey', type: 'string', description: 'Remembers dismissal per window; the start time is added to the key.' },
      { name: 'onDismiss', type: '() => void', description: 'Called on dismiss. Without it or storageKey there is no close button.' },
      { name: 'completedFor', type: 'number', defaultValue: '3600000', description: 'Milliseconds the completed state stays up.' },
      { name: 'now', type: 'Date', description: 'Pins the current time, for demos and tests.' },
      { name: 'timeZone', type: 'string', description: 'IANA zone. Defaults to the reader’s.' },
    ],
  },

  'not-found-state': {
    description:
      'The body of a 404 page. The code is shown large because it is what people quote to support, but the title says it in words; below it are a search slot, the pages people usually meant, and back and home. The illustration is hidden from assistive technology, and the heading level is a prop so the same body works as a page or inside an app shell.',
    sections: [
      { title: 'Full page', description: 'headingLevel is h2 here because this page already has an h1.', Content: NotFoundExample },
      { title: 'Inside an app', description: 'No illustration, no back button, a record-specific title.', Content: NotFoundCompact },
      rationale(
        'A 404 that says only “not found” is a dead end reached by following a link someone trusted.',
        'Every way out in one place — search, likely pages, back, home — turns a broken link into a detour rather than an exit.',
        'Site and app 404 routes, and deleted-record screens inside a product.',
        ['Button', 'Text', 'SearchField'],
      ),
    ],
    props: [
      { name: 'code', type: 'string', defaultValue: "'404'", description: 'The status code, drawn large.' },
      { name: 'title / description', type: 'string / ReactNode', description: 'What happened and what to try.' },
      { name: 'search', type: 'ReactNode', description: 'A search field slot.' },
      { name: 'links / linksTitle', type: 'NotFoundStateLink[] / string', defaultValue: "'Popular pages'", description: 'label, href and optional description for each suggestion.' },
      { name: 'homeHref / homeLabel', type: 'string | null / string', defaultValue: "'/', 'Go to home'", description: 'The home action; null removes it.' },
      { name: 'showBack / backLabel / onBack', type: 'boolean / string / () => void', defaultValue: 'true', description: 'The back action; steps back through history unless onBack is given.' },
      { name: 'illustration', type: 'ReactNode | null', description: 'Artwork, hidden from assistive technology. null removes the default.' },
      { name: 'headingLevel', type: "'h1' | 'h2' | 'h3'", defaultValue: 'h1', description: 'Level of the title; the links heading sits one below.' },
    ],
  },

  'access-denied-state': {
    description:
      'The body of a 403. It names what the reader tried to open, who owns it, and which account they are signed in with — the most common cause is simply the wrong account. The request button becomes a sent state in place without losing focus, and the change is announced.',
    sections: [
      { title: 'Request access', description: 'The request takes a moment, then stays sent. Reset to try again.', Content: AccessDeniedExample },
      rationale(
        '“Access denied” gives the reader nothing to act on, so they message whoever sent the link and wait.',
        'Naming the owner and the signed-in account covers both usual fixes — ask, or switch — and a one-click request makes asking free.',
        'Shared documents, projects and admin pages reached from a link.',
        ['Avatar', 'Button', 'Spinner', 'Text'],
      ),
    ],
    props: [
      { name: 'resource / resourceType', type: 'string', defaultValue: "resourceType 'page'", description: 'What was being opened, for the sentence.' },
      { name: 'title / description', type: 'string / ReactNode', defaultValue: "'You need access'", description: 'Headline, and a replacement explanation.' },
      { name: 'owner', type: 'AccessDeniedStateOwner', description: 'name, email and avatarSrc of who can grant access.' },
      { name: 'onRequestAccess', type: '() => void | Promise<void>', description: 'Sends the request; a promise shows pending, a rejection shows its message.' },
      { name: 'requestStatus', type: "'idle' | 'pending' | 'sent'", description: 'Controlled status, e.g. sent when a request already exists.' },
      { name: 'account', type: 'string', description: 'The signed-in account.' },
      { name: 'switchAccountHref / onSwitchAccount', type: 'string / () => void', description: 'Where switching account goes, or a handler.' },
      { name: 'headingLevel', type: "'h1' | 'h2' | 'h3'", defaultValue: 'h1', description: 'Level of the title.' },
    ],
  },

  'fullscreen-dialog': {
    description:
      'A dialog for a whole task on a small screen. Below 640px it fills the viewport with close and the primary action in the header and only the body scrolling; above, it is a tall centred sheet. Focus trap, scroll lock and Escape come from the shared overlay stack, and closing with unsaved changes asks first.',
    sections: [
      { title: 'Compose with unsaved changes', description: 'Type something, then close. Narrow the window to see it go full screen.', Content: ComposeExample },
      { title: 'Always full screen', description: 'mode="always" fills the viewport at every width.', Content: AlwaysFullExample },
      rationale(
        'A centred modal on a phone is a small box scrolling inside itself, with the keyboard over half of it and the save button out of reach.',
        'Filling the screen gives the task all the room, and the header keeps close and save where they can always be reached. The discard question protects the work people put in.',
        'Compose, edit record, new event, checkout details — forms too long for a Modal on mobile.',
        ['FocusTrap', 'Portal', 'IconButton', 'Button', 'ConfirmDialog'],
      ),
    ],
    props: [
      { name: 'open / onClose', type: 'boolean / () => void', description: 'Visibility. onClose runs after the discard question when dirty.' },
      { name: 'title', type: 'string', description: 'Header title and accessible name.' },
      { name: 'actionLabel / onAction', type: 'string / () => void', description: 'The header’s primary action.' },
      { name: 'actionDisabled / actionLoading', type: 'boolean', defaultValue: 'false', description: 'Primary action state.' },
      { name: 'mode', type: "'responsive' | 'always'", defaultValue: 'responsive', description: 'Full screen below 640px only, or everywhere.' },
      { name: 'dirty', type: 'boolean', defaultValue: 'false', description: 'Ask before closing.' },
      { name: 'discardTitle / discardDescription / discardLabel', type: 'string', defaultValue: "'Discard changes?'", description: 'Wording of the discard question.' },
      { name: 'footer', type: 'ReactNode', description: 'Optional row pinned under the body.' },
    ],
  },

  'feature-beacon': {
    description:
      'A pulsing dot on something new. Pressing it opens a small popover explaining the feature, and “Got it” calls back so the app can store that it was seen. The dot is a named button, its pulse stops under reduced motion, and after dismissal focus moves to the feature itself.',
    sections: [
      { title: 'On a toolbar button', Content: BeaconExample },
      rationale(
        'New features ship into a UI people already know by heart, and nobody notices them; a full tour to point at one button is out of proportion.',
        'A beacon points at one thing and waits for curiosity. Persistence is a callback, because only the app knows where “seen” belongs.',
        'One or two new controls after a release — not a whole screen of them.',
        ['Popover', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The element the beacon is attached to.' },
      { name: 'title / description', type: 'string / ReactNode', description: 'Popover heading and explanation.' },
      { name: 'dismissLabel', type: 'string', defaultValue: "'Got it'", description: 'Label on the acknowledging button.' },
      { name: 'action', type: 'ReactNode', description: 'Extra link or button before dismiss.' },
      { name: 'dismissed / onDismiss', type: 'boolean / () => void', description: 'Whether it was seen, and the callback to persist it.' },
      { name: 'label', type: 'string', defaultValue: "'New: {title}'", description: 'Accessible name for the dot.' },
      { name: 'corner', type: "'top-end' | 'top-start' | 'bottom-end' | 'bottom-start'", defaultValue: 'top-end', description: 'Where the dot sits.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: "'bottom', 'start'", description: 'Popover position.' },
    ],
  },

  'checklist-popover': {
    description:
      'An onboarding checklist behind a small button, with progress on the trigger itself. Open steps show their description and an action; finished ones fold into a line that expands. When everything is done the panel says so with a tick that draws once, or simply appears under reduced motion.',
    sections: [
      { title: 'Driven by app state', description: 'Tick steps on the left as if they were done elsewhere. Finish all five to see the complete state.', Content: ChecklistExample },
      rationale(
        'A setup card is right on day one and in the way on day eight, still taking a third of the dashboard for two optional steps.',
        'One click away keeps the list available without renting space for it, and progress on the trigger answers “how much is left?” without opening anything.',
        'App headers and sidebars in the first weeks of a new workspace.',
        ['Popover', 'ProgressRing', 'SuccessMark', 'Text'],
      ),
    ],
    props: [
      { name: 'items', type: 'ChecklistPopoverItem[]', description: 'id, title, description?, done, href? or onAction?, actionLabel?.' },
      { name: 'title / triggerLabel', type: 'string', defaultValue: "'Get set up', 'Setup guide'", description: 'Panel heading and trigger text.' },
      { name: 'open / defaultOpen / onOpenChange', type: 'boolean', description: 'Open state, controlled or not.' },
      { name: 'completeTitle / completeDescription', type: 'string / ReactNode', description: 'Shown once every step is done.' },
      { name: 'onDismiss', type: '() => void', description: 'Offered when complete — hide the guide.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: "'bottom', 'end'", description: 'Panel position.' },
    ],
  },

  'link-preview': {
    description:
      'A preview card for a link, shown after a short hover or focus: image, site, title and description. The link stays an ordinary link — click, middle-click and copy all work — and the card holds no controls, never takes focus, and closes on Escape or blur. Data comes as a prop or from a loader cached per href.',
    sections: [
      { title: 'In running text', description: 'The first link has its data up front; the second loads it; the third fails and says so.', Content: LinkPreviewExample },
      rationale(
        'Readers hesitate over links in docs and chat because they cannot tell where one goes without leaving the page.',
        'A delayed, pointer-friendly card answers that without turning the link into a button or the card into a focus trap.',
        'Docs, knowledge bases, comments and chat — anywhere links to other pages sit in prose.',
        ['Portal', 'Skeleton', 'Text'],
      ),
    ],
    props: [
      { name: 'href / children', type: 'string / ReactNode', description: 'The link and its text. Other anchor attributes pass through.' },
      { name: 'data', type: 'LinkPreviewData', description: 'title, description?, image?, siteName?.' },
      { name: 'load', type: '(href: string) => Promise<LinkPreviewData>', description: 'Fetches on first open; cached per href.' },
      { name: 'openDelay / closeDelay', type: 'number', defaultValue: '500, 200', description: 'Hover intent and grace period, in milliseconds.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: "'bottom', 'start'", description: 'Card position.' },
      { name: 'cardClassName', type: 'string', description: 'Merged onto the card.' },
    ],
  },

  'floating-panel': {
    description:
      'A non-modal panel that floats over the page — an inspector or a helper chat. It is a dialog without aria-modal: no scrim, no focus trap, the page stays usable. Drag it by its title bar, or focus the grip and use the arrow keys; it stays inside the viewport, minimises to its bar, and reports where it was left.',
    sections: [
      { title: 'Inspector', description: 'Move it, close it and reopen it: onPositionChange fed defaultPosition.', Content: FloatingPanelExample },
      rationale(
        'Tools that need to stay open while you work — inspectors, chat, colour pickers — get built as modals that block the work or as fixed sidebars that cover it.',
        'A movable, non-modal panel leaves the page fully usable, and a keyboard-movable grip keeps it from being a pointer-only convenience.',
        'Design tools, dashboards with a detail inspector, in-app help chat.',
        ['Portal', 'IconButton', 'Text'],
      ),
    ],
    props: [
      { name: 'open / onClose', type: 'boolean / () => void', description: 'Visibility. Escape closes only while focus is inside.' },
      { name: 'title', type: 'string', description: 'Title bar text and accessible name.' },
      { name: 'defaultPosition / onPositionChange', type: 'FloatingPanelPosition', description: '{ x, y } to start at, and the position when a move ends.' },
      { name: 'minimized / defaultMinimized / onMinimizedChange', type: 'boolean', description: 'Collapsed to the title bar, controlled or not.' },
      { name: 'width', type: 'number', defaultValue: '320', description: 'Panel width in pixels.' },
      { name: 'autoFocus', type: 'boolean', defaultValue: 'true', description: 'Focus the panel on open; focus returns on close.' },
    ],
  },

  'swipe-to-confirm': {
    description:
      'Drag the thumb to the end of the track to confirm; let go early and it springs back. The thumb is a slider, so the keyboard has its own deliberate route: End confirms, or hold Enter or Space to fill the track. An async confirm shows pending, then done, and under reduced motion nothing animates.',
    sections: [
      { title: 'Send money', description: 'Resets after a moment so you can try it again, with the pointer and the keyboard.', Content: SwipeExample },
      {
        title: 'States',
        stack: true,
        specimens: [
          { label: 'done', fill: true, node: <SwipeToConfirm label="Slide to end shift" doneLabel="Shift ended" status="done" onConfirm={() => undefined} className="max-w-[360px]" /> },
          { label: 'disabled', fill: true, node: <SwipeToConfirm label="Slide to pay" disabled onConfirm={() => undefined} className="max-w-[360px]" /> },
        ],
      },
      rationale(
        'A tap-to-confirm button fires from a pocket, a bump or a thumb resting in the wrong place, and a confirm dialog after it is dismissed by reflex.',
        'A full-length slide cannot happen by accident, and springing back shows an unfinished gesture without an error. Keyboard users get an equally deliberate hold rather than a bypass.',
        'Mobile payments, sending, ending a timed session — commitments made on the move.',
        ['Spinner', 'Text'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Track text and accessible name.' },
      { name: 'onConfirm', type: '() => void | Promise<void>', description: 'Runs at the end; a promise shows pending, a rejection springs back.' },
      { name: 'pendingLabel / doneLabel', type: 'string', defaultValue: "'Confirming…', 'Confirmed'", description: 'Text for the later states.' },
      { name: 'status', type: "'idle' | 'pending' | 'done'", description: 'Controlled status.' },
      { name: 'resetAfter', type: 'number', description: 'Milliseconds before done resets. Omit to stay done.' },
      { name: 'holdDuration', type: 'number', defaultValue: '900', description: 'How long Enter or Space must be held.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Blocks interaction.' },
    ],
  },
}
