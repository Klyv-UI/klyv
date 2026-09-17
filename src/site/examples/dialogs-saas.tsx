import { useState } from 'react'
import { Filter, LayoutGrid, Sparkles } from 'lucide-react'
import {
  AccessRequests,
  Button,
  CancellationFlow,
  DataExportPanel,
  DomainSetup,
  KeyboardShortcutsDialog,
  LocaleSettings,
  MemoryGame,
  PromptDialog,
  ReleaseNotesModal,
  SeatSelector,
  Text,
  type AccessRequestsItem,
  type DataExportPanelExport,
  type DomainSetupRecord,
  type DomainSetupSslStatus,
  type LocaleSettingsValue,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const DAY = 86_400_000
const HOUR = 3_600_000

function Note({ children }: { children: string }) {
  return (
    <Text size="caption" tone="faint" leading="normal" aria-live="polite">
      {children}
    </Text>
  )
}

/* ------------------------------------------------------------ shortcuts */

const SHORTCUT_GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { label: 'Open command palette', keys: ['mod', 'k'] },
      { label: 'Show keyboard shortcuts', keys: ['?'] },
      { label: 'Close panel or dialog', keys: ['esc'] },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { label: 'Go to inbox', keys: ['g', 'i'], sequence: true },
      { label: 'Go to projects', keys: ['g', 'p'], sequence: true },
      { label: 'Next item', keys: ['j'] },
      { label: 'Previous item', keys: ['k'] },
    ],
  },
  {
    title: 'Issues',
    shortcuts: [
      { label: 'Create issue', keys: ['c'] },
      { label: 'Assign to me', keys: ['i'] },
      { label: 'Change status', keys: ['s'] },
      { label: 'Copy issue link', keys: ['mod', 'shift', 'c'] },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { label: 'Bold', keys: ['mod', 'b'] },
      { label: 'Insert link', keys: ['mod', 'l'] },
      { label: 'Submit comment', keys: ['mod', 'enter'] },
    ],
  },
]

function ShortcutsExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Keyboard shortcuts
      </Button>
      <Note>Or press ? anywhere on this page while no field has focus.</Note>
      <KeyboardShortcutsDialog groups={SHORTCUT_GROUPS} open={open} onOpenChange={setOpen} />
    </div>
  )
}

function PlatformExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Show as on Windows
      </Button>
      <KeyboardShortcutsDialog
        groups={SHORTCUT_GROUPS.slice(3)}
        open={open}
        onOpenChange={setOpen}
        platform="other"
        hotkey={false}
        searchable={false}
        title="Editor shortcuts"
      />
    </div>
  )
}

/* --------------------------------------------------------------- prompt */

const TAKEN = ['q3-board-deck.pdf', 'roadmap.pdf']

function PromptExample() {
  const [name, setName] = useState('q3-report-final.pdf')
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-3">
        <Text as="span" size="body" className="font-mono">
          {name}
        </Text>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Rename
        </Button>
      </div>
      <Note>{`Try a name already in the folder (${TAKEN.join(', ')}), or one containing “draft” to see a server error.`}</Note>
      <PromptDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename file"
        label="File name"
        defaultValue={name}
        selection="name"
        confirmLabel="Rename"
        maxLength={80}
        validate={(value) =>
          /[\\/:*?"<>|]/.test(value)
            ? 'Names cannot contain \\ / : * ? " < > or |.'
            : TAKEN.includes(value) && value !== name
              ? 'A file with that name is already in this folder.'
              : undefined
        }
        onSubmit={async (value) => {
          await new Promise((resolve) => window.setTimeout(resolve, 700))
          if (value.includes('draft')) throw new Error('Files marked as draft are locked by the retention policy.')
          setName(value)
        }}
      />
    </div>
  )
}

function FolderExample() {
  const [folders, setFolders] = useState(['Contracts', 'Invoices'])
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button size="sm" onClick={() => setOpen(true)}>
        New folder
      </Button>
      <Note>{`Folders: ${folders.join(', ')}`}</Note>
      <PromptDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New folder"
        description="Folders are visible to everyone in this project."
        label="Folder name"
        placeholder="Untitled folder"
        confirmLabel="Create folder"
        validate={(value) => (folders.some((folder) => folder.toLowerCase() === value.toLowerCase()) ? 'There is already a folder with that name.' : undefined)}
        onSubmit={(value) => setFolders((current) => [...current, value])}
      />
    </div>
  )
}

/* -------------------------------------------------------- release notes */

function Illustration({ icon: Icon, caption }: { icon: typeof Filter; caption: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)]" role="img" aria-label={caption}>
      <Icon size={40} strokeWidth={1.75} className="text-ink" aria-hidden="true" />
    </div>
  )
}

const RELEASE_PAGES = [
  {
    title: 'Filters you can save',
    description: 'Build a filter once and pin it to the sidebar. Saved filters are shared with the project, so the whole team works from the same list.',
    media: <Illustration icon={Filter} caption="A filter bar with a pinned saved view" />,
  },
  {
    title: 'A board view for every list',
    description: 'Any list can now be shown as a board grouped by status, assignee or priority. Drag a card to change the field it is grouped by.',
    media: <Illustration icon={LayoutGrid} caption="Cards arranged in columns by status" />,
  },
  {
    title: 'Summaries on long threads',
    description: 'Threads with more than twenty comments open with a short summary of what was decided and what is still open.',
    media: <Illustration icon={Sparkles} caption="A summary card above a comment thread" />,
  },
]

function ReleaseExample() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('Closed')
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        What’s new
      </Button>
      <Note>{status}</Note>
      <ReleaseNotesModal
        open={open}
        version="4.2"
        pages={RELEASE_PAGES}
        changelogHref="#changelog"
        onClose={() => {
          setOpen(false)
          setStatus((current) => (current.startsWith('Muted') ? current : 'Closed — seen version 4.2'))
        }}
        onDontShowAgain={() => setStatus('Muted — release notes will not open by themselves again')}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- seats */

function SeatsExample() {
  const [seats, setSeats] = useState(15)
  const [saved, setSaved] = useState(15)
  const [message, setMessage] = useState('12 seats are occupied, so the count cannot go below 12.')
  const now = new Date()
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <SeatSelector
        current={saved}
        inUse={12}
        max={100}
        value={seats}
        onValueChange={setSeats}
        pricePerSeat={{ monthly: 12, annual: 120 }}
        periodEnd={new Date(now.getTime() + 18 * DAY)}
        now={now}
        onConfirm={async (next, cycle) => {
          await new Promise((resolve) => window.setTimeout(resolve, 700))
          setSaved(next)
          setMessage(`Updated to ${next} seats on ${cycle} billing.`)
        }}
      />
      <Note>{message}</Note>
    </div>
  )
}

/* ---------------------------------------------------------- cancellation */

function CancellationExample() {
  const [key, setKey] = useState(0)
  const [log, setLog] = useState('Choose “It costs too much” or “I only need it part of the year” to see an offer.')
  const endsAt = new Date(Date.now() + 23 * DAY)
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-3">
      <CancellationFlow
        key={key}
        planName="Team plan"
        accessEndsAt={endsAt}
        losses={['Version history beyond 7 days', 'Guest access for 14 clients', 'Priority support', 'SSO for northwind.io']}
        offers={{
          discount: { title: '40% off for the next 3 months', description: 'Your plan drops to $36 a month until March, then returns to $60. Nothing else changes.', actionLabel: 'Apply 40% off' },
          pause: { title: 'Pause instead, for up to 3 months', description: 'No charges while paused. Your projects stay exactly as they are and reopen when you come back.', actionLabel: 'Pause subscription' },
          downgrade: { title: 'Switch to Starter at $12 a month', description: 'Keep your projects and up to 3 members. Advanced permissions and SSO turn off.', actionLabel: 'Switch to Starter' },
        }}
        onAcceptOffer={async (offer) => {
          await new Promise((resolve) => window.setTimeout(resolve, 600))
          setLog(`Accepted the ${offer} offer.`)
        }}
        onCancel={async (feedback) => {
          await new Promise((resolve) => window.setTimeout(resolve, 800))
          setLog(`Cancelled. Reason: ${feedback.reason ?? 'none given'}.`)
        }}
        onKeep={() => setLog('Kept the subscription.')}
      />
      <div className="flex items-center justify-between gap-3">
        <Note>{log}</Note>
        <Button size="sm" variant="ghost" onClick={() => setKey((value) => value + 1)}>
          Start over
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- export */

const DATASETS = [
  { id: 'projects', label: 'Projects and issues', description: 'Every issue with its fields, labels and history' },
  { id: 'comments', label: 'Comments', description: 'Including edits and reactions' },
  { id: 'members', label: 'Members and roles', description: 'Names, emails, roles and last sign-in' },
  { id: 'audit', label: 'Audit log', description: 'Security and admin events' },
]

function ExportExample() {
  const [exports, setExports] = useState<DataExportPanelExport[]>(() => {
    const now = Date.now()
    return [
      { id: 'e3', datasets: ['projects', 'comments'], format: 'csv', status: 'processing', requestedAt: new Date(now - 0.2 * HOUR) },
      { id: 'e2', datasets: ['members'], format: 'json', status: 'ready', requestedAt: new Date(now - 20 * HOUR), expiresAt: new Date(now + 4 * HOUR), href: '#members.json', size: '84 KB' },
      { id: 'e1', datasets: ['audit'], format: 'csv', status: 'expired', requestedAt: new Date(now - 9 * DAY), size: '2.1 MB' },
    ]
  })
  return (
    <div className="w-full max-w-[680px]">
      <DataExportPanel
        datasets={DATASETS}
        exports={exports}
        onRequest={async (request) => {
          await new Promise((resolve) => window.setTimeout(resolve, 600))
          const id = `e${Date.now()}`
          setExports((current) => [{ id, datasets: request.datasets, format: request.format, status: 'queued', requestedAt: new Date() }, ...current])
          window.setTimeout(() => {
            setExports((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'ready', expiresAt: new Date(Date.now() + 24 * HOUR), href: `#export.${request.format}`, size: '1.4 MB' } : item,
              ),
            )
          }, 3000)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------ access requests */

const ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
]

const REQUESTS: AccessRequestsItem[] = [
  { id: 'r1', name: 'Priya Raman', email: 'priya@northwind.io', role: 'editor', resource: 'Q4 Planning', requestedAt: '12 minutes ago', message: 'Joining the planning group from marketing — need to update the launch timeline.' },
  { id: 'r2', name: 'Tomás Ortega', email: 'tomas@contractor.dev', role: 'admin', requestedAt: '3 hours ago', message: 'Setting up the webhook integration for the data team.' },
  { id: 'r3', name: 'Lena Fischer', email: 'lena@northwind.io', role: 'viewer', requestedAt: 'Yesterday' },
]

function AccessExample() {
  const [requests, setRequests] = useState(REQUESTS)
  const [log, setLog] = useState('Change a role before approving, or select rows for bulk actions.')
  const remove = (ids: string[]) => setRequests((current) => current.filter((request) => !ids.includes(request.id)))
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3">
      <AccessRequests
        requests={requests}
        roles={ROLES}
        resourceName="Northwind"
        onApprove={async (approvals) => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          remove(approvals.map((approval) => approval.id))
          setLog(`Approved ${approvals.map((approval) => `${approval.id} as ${approval.role}`).join(', ')}.`)
        }}
        onDeny={async (ids, reason) => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          remove(ids)
          setLog(`Denied ${ids.length}${reason ? ` — “${reason}”` : ''}.`)
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <Note>{log}</Note>
        <Button size="sm" variant="ghost" onClick={() => setRequests(REQUESTS)}>
          Reset
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- domain */

const RECORDS = (domain: string): DomainSetupRecord[] => [
  { id: 'cname', type: 'CNAME', name: domain.split('.')[0], value: 'cname.acme-dns.net', status: 'pending' },
  { id: 'txt', type: 'TXT', name: `_acme-verify.${domain.split('.')[0]}`, value: 'acme-verify=7f3c9a1e2b4d', status: 'pending' },
]

function DomainExample() {
  const [domain, setDomain] = useState<string | null>(null)
  const [records, setRecords] = useState<DomainSetupRecord[]>([])
  const [ssl, setSsl] = useState<DomainSetupSslStatus>('waiting')
  const [attempts, setAttempts] = useState(0)
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <DomainSetup
        domain={domain}
        records={records}
        sslStatus={ssl}
        onAdd={async (value) => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          if (value.endsWith('.local')) throw new Error('Only public domains can be connected.')
          setDomain(value)
          setRecords(RECORDS(value))
        }}
        onVerify={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 1200))
          const next = attempts + 1
          setAttempts(next)
          setRecords((current) =>
            current.map((record) =>
              record.id === 'txt' && next === 1
                ? { ...record, status: 'failed', detail: 'No TXT record found. Check the name does not repeat the domain.' }
                : { ...record, status: 'verified', detail: undefined },
            ),
          )
          if (next > 1) {
            setSsl('provisioning')
            window.setTimeout(() => setSsl('active'), 2500)
          }
        }}
        onRemove={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          setDomain(null)
          setRecords([])
          setSsl('waiting')
          setAttempts(0)
        }}
      />
      <Note>Add any domain — paste a full URL if you like. The first check fails the TXT record; the second passes and issues a certificate.</Note>
    </div>
  )
}

/* --------------------------------------------------------------- locale */

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
  { value: 'pt', label: 'Português' },
]

const REGIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' },
]

function LocaleExample() {
  const [value, setValue] = useState<LocaleSettingsValue>({
    language: 'en',
    region: 'GB',
    timeZone: 'Europe/London',
    dateFormat: 'auto',
    numberFormat: 'auto',
    weekStart: 'monday',
  })
  const [message, setMessage] = useState('Change the region and watch the preview line.')
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <LocaleSettings
        value={value}
        languages={LANGUAGES}
        regions={REGIONS}
        currency="EUR"
        onSave={async (next) => {
          await new Promise((resolve) => window.setTimeout(resolve, 600))
          setValue(next)
          setMessage(`Saved: ${next.language}-${next.region}, ${next.timeZone}.`)
        }}
      />
      <Note>{message}</Note>
    </div>
  )
}

/* ----------------------------------------------------------------- game */

const ANIMALS = [
  { id: 'fox', face: '🦊', label: 'Fox' },
  { id: 'owl', face: '🦉', label: 'Owl' },
  { id: 'frog', face: '🐸', label: 'Frog' },
  { id: 'whale', face: '🐳', label: 'Whale' },
  { id: 'bee', face: '🐝', label: 'Bee' },
  { id: 'panda', face: '🐼', label: 'Panda' },
  { id: 'octopus', face: '🐙', label: 'Octopus' },
  { id: 'turtle', face: '🐢', label: 'Turtle' },
]

function MemoryExample() {
  const [best, setBest] = useState<number | null>(null)
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <MemoryGame cards={ANIMALS} onWin={({ moves }) => setBest((current) => (current === null ? moves : Math.min(current, moves)))} />
      <Note>{best === null ? 'Use the arrow keys to move between cards, Enter or Space to flip.' : `Best so far: ${best} moves.`}</Note>
    </div>
  )
}

function SmallBoardExample() {
  return <MemoryGame cards={ANIMALS.slice(0, 3)} columns={3} className="max-w-[300px]" />
}

/* -------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'keyboard-shortcuts-dialog': {
    description:
      'Every shortcut in the product on one screen, grouped by area and opened with “?”. Keys are written once — mod+k — and drawn for the device reading them, so a Windows user never sees ⌘. A filter narrows by action or key, each glyph carries its spoken name for screen readers, and the hotkey ignores presses made while typing.',
    sections: [
      { title: 'Grouped and searchable', description: 'Press ? on this page, or use the button. Type “copy” or “g” to filter.', Content: ShortcutsExample },
      { title: 'Platform forced', description: 'platform="other" shows Ctrl whatever the device; the hotkey and the filter are off for a short list.', Content: PlatformExample },
      rationale(
        'Shortcuts documented in a help centre are never found, and a list that shows ⌘ to Windows users is a list they cannot use.',
        'One dialog, opened by the key people already try, with keys drawn per platform. Built on Modal, so layering, Escape and focus return match every other dialog.',
        'Any app with more than a handful of shortcuts — issue trackers, editors, inboxes, dashboards.',
        ['Modal', 'Kbd', 'Input', 'Text'],
      ),
    ],
    props: [
      { name: 'groups', type: 'KeyboardShortcutsDialogGroup[]', description: 'Areas, each with shortcuts: label, keys (mod, alt, shift, enter, esc, arrows or a character) and optional sequence.' },
      { name: 'open / defaultOpen / onOpenChange', type: 'boolean', description: 'Open state, controlled or not.' },
      { name: 'hotkey', type: 'string | false', defaultValue: "'?'", description: 'The key that opens it from anywhere. Ignored while typing in a field.' },
      { name: 'platform', type: "'auto' | 'mac' | 'other'", defaultValue: 'auto', description: 'Which modifier glyphs to draw. auto reads the device after mount.' },
      { name: 'title', type: 'string', defaultValue: "'Keyboard shortcuts'", description: 'Visible title and accessible name.' },
      { name: 'searchable', type: 'boolean', defaultValue: 'true', description: 'Show the filter field, which takes focus on open.' },
    ],
  },

  'prompt-dialog': {
    description:
      'A dialog that asks for exactly one value — a new name, a folder to create. The field opens focused with its text selected, and name selection leaves a file extension alone. Submit stays disabled while the value is invalid, but the reason only appears once the person has typed; Enter submits, and a failed async submit keeps the dialog open with the error beside the field.',
    sections: [
      { title: 'Rename a file', description: 'Only “q3-report-final” is selected on open, so typing keeps “.pdf”.', Content: PromptExample },
      { title: 'Create a folder', description: 'Blank and duplicate names are refused; a synchronous onSubmit closes at once.', Content: FolderExample },
      rationale(
        'window.prompt cannot be styled, validated or made async, and hand-rolled rename dialogs forget to select the text, block Enter, or close on a failed save.',
        'The details that make a one-field dialog pleasant are all fiddly, so they live in one place: selection, deferred validation messages, pending and error states. Built on Modal.',
        'Rename, create folder, name a saved view, set a label — any single value asked for in context.',
        ['Modal', 'Field', 'Input', 'Button'],
      ),
    ],
    props: [
      { name: 'open / onClose', type: 'boolean / () => void', description: 'Visibility. onClose also runs after a successful submit.' },
      { name: 'title / description', type: 'string', description: 'The question, and an optional supporting line.' },
      { name: 'label', type: 'string', description: 'Visible label for the field.' },
      { name: 'defaultValue', type: 'string', defaultValue: "''", description: 'Starting value, restored each time the dialog opens.' },
      { name: 'selection', type: "'all' | 'name' | 'end'", defaultValue: 'all', description: 'What is selected on open. name stops before the last dot.' },
      { name: 'validate', type: '(value: string) => string | undefined', description: 'Returns a message when the trimmed value cannot be submitted.' },
      { name: 'onSubmit', type: '(value: string) => void | Promise<void>', description: 'Receives the trimmed value. A rejection keeps the dialog open with its message.' },
      { name: 'required', type: 'boolean', defaultValue: 'true', description: 'Refuse blank values.' },
      { name: 'confirmLabel / cancelLabel', type: 'string', defaultValue: "'Save', 'Cancel'", description: 'Button labels. Name the verb.' },
      { name: 'placeholder / maxLength', type: 'string / number', description: 'Passed to the field.' },
    ],
  },

  'release-notes-modal': {
    description:
      '“What’s new”, shown once per release and then out of the way. Highlights are paged, each with a media slot, and a step indicator says how many are left; arrow keys page too. With a storageKey it opens by itself for a version this browser has not seen, and storage that throws simply means the notes show again. Opting out is a checkbox honoured on close.',
    sections: [
      { title: 'Three highlights', description: 'Page with Next, the dots, or the arrow keys. Tick the checkbox before closing to fire onDontShowAgain.', Content: ReleaseExample },
      rationale(
        'Release notes live on a changelog nobody visits, while in-app announcements either nag on every load or vanish before they are read.',
        'Paged highlights get read to the end; remembering the last version seen means it appears exactly once, and the opt-out is quiet rather than a competing button. Built on Modal.',
        'After a deploy with user-visible changes — one dialog per release, three or four pages at most.',
        ['Modal', 'Button', 'Checkbox', 'Text'],
      ),
    ],
    props: [
      { name: 'version', type: 'string', description: 'The release announced, stored as the last seen.' },
      { name: 'pages', type: 'ReleaseNotesModalPage[]', description: 'title, description and optional media for each highlight.' },
      { name: 'open', type: 'boolean', description: 'Controlled visibility. Omit to let storageKey decide.' },
      { name: 'onClose', type: '() => void', description: 'Called however the dialog closes.' },
      { name: 'storageKey', type: 'string', description: 'localStorage key for the last version seen. Reads and writes are guarded.' },
      { name: 'onDontShowAgain', type: '() => void', description: 'Called on close when the opt-out was ticked.' },
      { name: 'title', type: 'string', defaultValue: "'What’s new'", description: 'Visible title.' },
      { name: 'changelogHref', type: 'string', description: 'Link to the full changelog, shown on the last page.' },
    ],
  },

  'seat-selector': {
    description:
      'The number of paid seats, with the money said out loud before anyone commits. The stepper takes typed numbers and cannot go below the seats already occupied, and the summary names the change, the new recurring total and exactly what is charged today — prorated for the days left in the period, with the arithmetic shown. Removing seats says plainly that no refund is issued now.',
    sections: [
      { title: 'Adding and removing seats', description: 'Eighteen days are left in the period. Switch to annual to see the other price.', Content: SeatsExample },
      rationale(
        'Seat changes produce surprise charges and refund tickets because the price of the change is only visible on the next invoice.',
        'Showing the delta, the new total and the prorated charge together turns a billing question into a sentence people can read before clicking.',
        'Billing settings for per-seat plans, and the upsell prompt when an invite hits the seat limit.',
        ['NumberInput', 'SegmentedControl', 'Surface', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'current', type: 'number', description: 'Seats paid for now; the change is measured from here.' },
      { name: 'inUse', type: 'number', description: 'Occupied seats — the minimum.' },
      { name: 'value / defaultValue / onValueChange', type: 'number', description: 'The chosen count, controlled or not. defaultValue falls back to current.' },
      { name: 'pricePerSeat', type: '{ monthly: number; annual: number }', description: 'Per seat per month on monthly billing, per seat per year on annual.' },
      { name: 'cycle / defaultCycle / onCycleChange', type: "'monthly' | 'annual'", defaultValue: 'monthly', description: 'Which price applies.' },
      { name: 'periodEnd / periodStart', type: 'Date', description: 'The billing period, for proration. periodStart defaults to one cycle earlier.' },
      { name: 'max', type: 'number', description: 'Seat cap for the plan.' },
      { name: 'currency', type: 'string', defaultValue: "'$'", description: 'Currency symbol.' },
      { name: 'onConfirm', type: '(seats, cycle) => void | Promise<void>', description: 'Adds the confirm button. A promise shows the pending state.' },
      { name: 'now', type: 'Date', description: 'The current moment, for previews and tests.' },
    ],
  },

  'cancellation-flow': {
    description:
      'Cancelling a subscription in a few honest steps: an optional reason, an offer chosen by that reason — a discount for price, a pause for seasonal use, a downgrade for low use — and a confirmation that lists what is lost and the date access ends. The cancel path is never hidden or blocked; every step keeps a plainly labelled way through, and focus moves to each new step’s heading.',
    sections: [
      { title: 'Reason, offer, confirm', Content: CancellationExample },
      rationale(
        'Cancellation screens either hide the button behind guilt trips — which breeds chargebacks and, in more places each year, legal trouble — or offer nothing at all to someone who only needed a pause.',
        'An offer that answers the stated reason retains people who wanted to stay; a clear path out keeps the ones who do not from resenting the product.',
        'Subscription settings in any self-serve SaaS. Render it in a page or inside a Modal.',
        ['RadioGroup', 'Field', 'Textarea', 'Button', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'planName', type: 'string', description: 'The plan being cancelled.' },
      { name: 'accessEndsAt', type: 'Date', description: 'When access ends if cancelled — stated before the final button.' },
      { name: 'losses', type: 'string[]', description: 'Specific things that stop working.' },
      { name: 'reasons', type: 'CancellationFlowReason[]', description: 'value, label and an optional offer kind. Five sensible defaults.' },
      { name: 'offers', type: 'Partial<Record<CancellationFlowOfferKind, CancellationFlowOffer>>', description: 'Copy for pause, discount and downgrade. Offers without copy are skipped.' },
      { name: 'onAcceptOffer', type: '(offer, feedback) => void | Promise<void>', description: 'Taking the offer. Without it, no offer step is shown.' },
      { name: 'onCancel', type: '(feedback) => void | Promise<void>', description: 'The final confirmation. A rejection shows its message.' },
      { name: 'onKeep', type: '() => void', description: 'Leave without changing anything.' },
    ],
  },

  'data-export-panel': {
    description:
      'Request a copy of your data and collect it later, on one panel. Choose datasets, a format and an optional date range — empty means all time — then follow the export in the list below as it moves from queued to ready. Ready links show how long they have left and turn to expired on their own.',
    sections: [
      { title: 'Request and history', description: 'A new request is queued, then becomes ready after three seconds.', Content: ExportExample },
      rationale(
        'Exports are asynchronous, so the request form and the download usually live in different places — an email link that expires before it is opened.',
        'Keeping the request and its results together, with explicit statuses and an expiry countdown, answers “where is my export?” without a support ticket.',
        'Account and workspace settings, GDPR data requests, admin reporting.',
        ['Checkbox', 'SegmentedControl', 'DateRangePicker', 'Button', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'datasets', type: 'DataExportPanelDataset[]', description: 'id, label and description of what can be exported.' },
      { name: 'exports', type: 'DataExportPanelExport[]', description: 'Past exports: datasets, format, status, requestedAt, expiresAt, href, size.' },
      { name: 'onRequest', type: '(request) => void | Promise<void>', description: 'Receives datasets, format and range. A rejection shows its message.' },
      { name: 'formats', type: '{ value: string; label: string }[]', defaultValue: 'CSV, JSON', description: 'Formats on offer.' },
      { name: 'now', type: 'Date', description: 'Starting moment for the countdown, which then ticks each minute.' },
    ],
  },

  'access-requests': {
    description:
      'The queue of people asking to join, with a decision for each. The role to grant starts as the one requested and can be changed before approving; denying asks for an optional reason sent to the requester. Selecting rows turns both actions into bulk actions, and an empty queue says what will appear there.',
    sections: [
      { title: 'Pending requests', Content: AccessExample },
      rationale(
        'Access requests pile up in email, get approved with whatever role was asked for, and denials arrive with no explanation — so the same request comes back next week.',
        'Adjusting the role in the row prevents over-granting, and a reason on denial closes the loop. Bulk selection clears a backlog in one pass.',
        'Workspace admin, shared documents and projects, private channels — anywhere joining needs an approver.',
        ['Checkbox', 'Avatar', 'Select', 'Modal', 'Textarea', 'EmptyState', 'Button'],
      ),
    ],
    props: [
      { name: 'requests', type: 'AccessRequestsItem[]', description: 'id, name, email, avatarSrc, requested role, resource, message and requestedAt.' },
      { name: 'roles', type: 'AccessRequestsRole[]', description: 'Roles an approver can grant.' },
      { name: 'onApprove', type: '(approvals: { id, role }[]) => void | Promise<void>', description: 'Approved requests with the role granted.' },
      { name: 'onDeny', type: '(ids: string[], reason: string) => void | Promise<void>', description: 'Denied ids and the optional reason.' },
      { name: 'resourceName', type: 'string', defaultValue: "'this workspace'", description: 'Used in the empty state.' },
    ],
  },

  'domain-setup': {
    description:
      'Connect a custom domain: enter it, add the DNS records shown, verify, done. Each record carries its own result — not found yet, checking, verified or failed with the reason — so one wrong record out of three is obvious. Values copy with a button, pasted URLs are trimmed to the domain, SSL status follows verification, and removal asks first.',
    sections: [
      { title: 'From empty to verified', Content: DomainExample },
      rationale(
        '“DNS not verified” with no detail is the most common custom-domain support ticket, usually caused by one mistyped record.',
        'Per-record status and copy buttons remove both the guesswork and the typo. Pending is worded as “not found yet” because DNS takes time, not because the user did something wrong.',
        'Custom domains for sites, help centres, status pages and email sending domains.',
        ['Field', 'Input', 'CopyButton', 'ConfirmDialog', 'Button', 'Surface'],
      ),
    ],
    props: [
      { name: 'domain', type: 'string | null', description: 'The connected domain, or null to show the add form.' },
      { name: 'records', type: 'DomainSetupRecord[]', description: 'type, name, value, status and failure detail for each record.' },
      { name: 'sslStatus', type: "'waiting' | 'provisioning' | 'active' | 'failed'", defaultValue: 'waiting', description: 'Certificate state.' },
      { name: 'onAdd', type: '(domain: string) => void | Promise<void>', description: 'Receives the normalised domain. A rejection shows its message.' },
      { name: 'onVerify', type: '() => void | Promise<void>', description: 'Re-check DNS; update records with the results. Records show checking meanwhile.' },
      { name: 'onRemove', type: '() => void | Promise<void>', description: 'Disconnect, after confirmation.' },
      { name: 'placeholder', type: 'string', defaultValue: "'app.example.com'", description: 'Field placeholder.' },
    ],
  },

  'locale-settings': {
    description:
      'Language, region, time zone and the formats that follow from them, with a live preview line rendered through Intl — today’s date and time, a large number and a price — so people recognise their own format instead of decoding “dd/MM/yyyy”. Formats default to matching the region, the time zone list is searchable, and edits are a draft until saved.',
    sections: [
      { title: 'Regional settings', description: 'Try Germany with “Match region”, then override the number format.', Content: LocaleExample },
      rationale(
        'Locale screens ask people to choose format codes they cannot read, and the result is only visible after saving — on an invoice.',
        'A preview formatted with the real Intl APIs shows the consequence of each choice immediately. Region-matching defaults make most visits one decision.',
        'Profile and workspace settings, onboarding for international teams.',
        ['Select', 'Combobox', 'Field', 'Button', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'value', type: 'LocaleSettingsValue', description: 'Saved settings: language, region, timeZone, dateFormat, numberFormat, weekStart.' },
      { name: 'onSave', type: '(value) => void | Promise<void>', description: 'Called with the draft. A promise shows the saving state.' },
      { name: 'languages / regions', type: 'SelectOption[]', description: 'Choices for language and region.' },
      { name: 'timeZones', type: 'string[]', description: 'IANA zones. Defaults to every zone the browser supports.' },
      { name: 'currency', type: 'string', defaultValue: "'USD'", description: 'ISO currency for the preview.' },
    ],
  },

  'memory-game': {
    description:
      'Card-matching pairs on a real grid: arrow keys move between cards, Enter flips, and every flip and match is announced. Moves and a timer that starts on the first flip sit above the board, a win state follows the last pair, and under reduced motion cards change face without turning.',
    sections: [
      { title: 'Eight pairs', Content: MemoryExample },
      { title: 'A small board', description: 'columns sets the row length; three pairs make a quick round.', Content: SmallBoardExample },
      rationale(
        'Casual games in products are usually mouse-only and silent, which shuts out keyboard and screen reader users from the one playful moment on the page.',
        'Grid semantics with roving focus and a live region make the same game playable by ear, and the reduced-motion path keeps it calm.',
        'Waiting screens, onboarding breaks, kids’ and learning products, 404 pages.',
        ['Button', 'Text'],
      ),
    ],
    props: [
      { name: 'cards', type: 'MemoryGameCard[]', description: 'One entry per pair: id, face (emoji or icon) and label.' },
      { name: 'columns', type: 'number', defaultValue: '4', description: 'Cards per row.' },
      { name: 'shuffle', type: 'boolean', defaultValue: 'true', description: 'Deal in random order, after mount.' },
      { name: 'mismatchDelay', type: 'number', defaultValue: '900', description: 'How long a mismatched pair stays up, in ms. Picking another card puts it away early.' },
      { name: 'onWin', type: '({ moves, seconds }) => void', description: 'Called once every pair is found.' },
    ],
  },
}
