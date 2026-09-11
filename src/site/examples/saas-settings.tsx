import { useState } from 'react'
import {
  ApiKeyManager,
  ChangelogList,
  DangerZone,
  Field,
  HelpPanel,
  Input,
  IntegrationCard,
  SegmentedControl,
  SettingsRow,
  SettingsSection,
  Surface,
  Switch,
  Text,
  WebhookDeliveries,
  WebhookEndpoints,
  type ApiKey,
  type WebhookDelivery,
  type WebhookEndpoint,
  type IntegrationStatus,
} from 'citrine'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { API_KEYS, API_SCOPES, ARTICLES, CHANGELOG, RESOURCES, daysFromNow, randomSecret } from './saas-shared'

function SettingsExample() {
  const saved = { name: 'Northwind', url: 'northwind' }
  const [form, setForm] = useState(saved)
  const [base, setBase] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [digest, setDigest] = useState(true)
  const [mentions, setMentions] = useState(true)
  const dirty = form.name !== base.name || form.url !== base.url

  return (
    <div className="flex w-full flex-col gap-8">
      <SettingsSection
        title="Workspace"
        description="How your workspace appears to members and in links."
        dirty={dirty}
        saving={saving}
        onReset={() => setForm(base)}
        onSave={async () => {
          setSaving(true)
          await new Promise((resolve) => window.setTimeout(resolve, 700))
          setBase(form)
          setSaving(false)
        }}
        footerNote="Saved"
      >
        <Field label="Workspace name">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="URL" hint="Changing it breaks existing links.">
          <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} leading={<span className="text-[12px] font-semibold">acme.app/</span>} className="pl-[88px]" />
        </Field>
      </SettingsSection>

      <SettingsSection title="Email notifications" description="Changes here apply immediately.">
        <SettingsRow label="Weekly digest" description="A summary of your key metrics every Monday." htmlFor="digest">
          <Switch id="digest" checked={digest} onChange={(event) => setDigest(event.target.checked)} />
        </SettingsRow>
        <SettingsRow label="Mentions" description="When someone @mentions you in a comment." htmlFor="mentions">
          <Switch id="mentions" checked={mentions} onChange={(event) => setMentions(event.target.checked)} />
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}

function DangerExample() {
  const [log, setLog] = useState<string>()
  return (
    <div className="flex w-full flex-col gap-3">
      <DangerZone
        description="These cannot be undone. Export anything you need first."
        actions={[
          {
            id: 'transfer',
            title: 'Transfer ownership',
            description: 'Make another member the owner. You become an admin.',
            actionLabel: 'Transfer',
            confirmDescription: 'You will lose access to billing and to deleting the workspace.',
            onConfirm: () => setLog('Ownership transferred.'),
          },
          {
            id: 'delete',
            title: 'Delete workspace',
            description: 'Permanently delete Northwind, its projects and every report.',
            actionLabel: 'Delete workspace',
            confirmTitle: 'Delete Northwind?',
            confirmDescription: 'Everything in it is deleted for everyone, immediately.',
            confirmationText: 'Northwind',
            onConfirm: async () => {
              await new Promise((resolve) => window.setTimeout(resolve, 600))
              throw new Error('Cancel the active subscription before deleting this workspace.')
            },
          },
        ]}
      />
      <Text size="caption" tone="faint" aria-live="polite">
        {log ?? 'Delete fails on purpose, to show the reason kept on its row.'}
      </Text>
    </div>
  )
}

function ApiKeysExample() {
  const [keys, setKeys] = useState<ApiKey[]>(API_KEYS)
  return (
    <ApiKeyManager
      keys={keys}
      scopes={API_SCOPES}
      defaultScopes={['read']}
      limit={5}
      description="Keys act on behalf of this workspace. Treat them like passwords."
      onCreate={async ({ name, scopes }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 600))
        const secret = randomSecret()
        setKeys((current) => [{ id: crypto.randomUUID(), name, scopes, prefix: secret.slice(0, 12), createdAt: new Date(), lastUsedAt: null }, ...current])
        return { secret }
      }}
      onRevoke={async (key) => {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        setKeys((current) => current.filter((item) => item.id !== key.id))
      }}
    />
  )
}

const INTEGRATIONS: { id: string; name: string; category: string; description: string; status: IntegrationStatus; meta?: string; badge?: string; requiresPlan?: string }[] = [
  { id: 'slack', name: 'Slack', category: 'Messaging', description: 'Send alerts and weekly digests to any channel.', status: 'connected', meta: 'Posting to #growth', badge: 'Popular' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'Sync account health to company records every hour.', status: 'error', meta: 'Token expired 2 days ago' },
  { id: 'segment', name: 'Segment', category: 'Data', description: 'Stream events from your existing Segment sources.', status: 'available' },
  { id: 'snowflake', name: 'Snowflake', category: 'Data', description: 'Query your warehouse tables directly from reports.', status: 'available', requiresPlan: 'Team' },
  { id: 'linear', name: 'Linear', category: 'Productivity', description: 'Open an issue from any anomaly in one click.', status: 'available' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', description: 'Connect workflows to five thousand other apps.', status: 'available', badge: 'Beta' },
]

function IntegrationsExample() {
  const [category, setCategory] = useState('All')
  const [states, setStates] = useState<Record<string, IntegrationStatus>>(() => Object.fromEntries(INTEGRATIONS.map((item) => [item.id, item.status])))
  const categories = ['All', ...new Set(INTEGRATIONS.map((item) => item.category))]

  const connect = (id: string) => {
    setStates((current) => ({ ...current, [id]: 'pending' }))
    window.setTimeout(() => setStates((current) => ({ ...current, [id]: 'connected' })), 1200)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* The track sizes to its content, so the scroll has to live on a wrapper that is held to the column. */}
      <div className="no-scrollbar -mx-1 max-w-full self-start overflow-x-auto px-1 py-0.5">
        <SegmentedControl label="Category" size="sm" value={category} onValueChange={setCategory} options={categories.map((value) => ({ value, label: value }))} />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.filter((item) => category === 'All' || item.category === category).map((item) => {
          const status = states[item.id] ?? item.status
          return (
            <li key={item.id}>
              <IntegrationCard
                name={item.name}
                category={item.category}
                description={item.description}
                logo={<span className="text-[16px] font-extrabold text-ink">{item.name[0]}</span>}
                status={status}
                badge={item.badge}
                requiresPlan={item.requiresPlan}
                meta={status === 'connected' ? (item.meta ?? 'Connected just now') : status === 'error' ? item.meta : undefined}
                onConnect={() => connect(item.id)}
                onDisconnect={() => setStates((current) => ({ ...current, [item.id]: 'available' }))}
                onConfigure={() => undefined}
                onUpgrade={() => undefined}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export const demos: ExampleModule = {
  'settings-section': {
    description:
      'One block of a settings page with its own save bar. Each section saves on its own, and Save stays disabled until something has changed — the bar says so when it has.',
    sections: [
      { title: 'Example', description: 'Edit the name to see the bar wake up; Discard puts it back.', bare: true, Content: SettingsExample },
      rationale(
        'A single Save at the bottom of a long settings page loses every section’s edits when one fails validation, and nothing warns about unsaved changes.',
        'Split layout from md puts the explanation beside the card; SettingsRow gives label-and-switch lines their own rhythm and dividers.',
        'Every settings page: profile, workspace, notifications, security.',
        ['Surface', 'Button', 'Text', 'Field', 'Switch'],
      ),
    ],
    props: [
      { name: 'title / description', type: 'string / ReactNode', description: 'The left column.' },
      { name: 'onSave / onReset', type: 'fn', description: 'Adds the save bar and makes the card a form.' },
      { name: 'dirty / saving', type: 'boolean', description: 'Whether anything changed; a save in flight.' },
      { name: 'layout', type: "'split' | 'stacked'", defaultValue: 'split', description: 'Description beside or above.' },
      { name: 'SettingsRow', type: '{ label, description?, htmlFor?, children }', description: 'A setting as a sentence and a control.' },
    ],
  },

  'danger-zone': {
    description:
      'The irreversible actions, fenced off at the bottom of a settings page. Each confirms what will be lost, the worst can require the name typed out, and a failure stays on its row.',
    sections: [
      { title: 'Example', bare: true, Content: DangerExample },
      rationale(
        'Destructive actions end up as red buttons scattered through settings, and when one fails the reason is a toast that fades before it is read.',
        'Built on ConfirmDialog with type-to-confirm; errors thrown from onConfirm are kept on the row until the next attempt.',
        'Workspace, project and account settings.',
        ['ConfirmDialog', 'Surface', 'Button', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'actions', type: 'DangerAction[]', description: '{ id, title, description, actionLabel, onConfirm, confirmTitle?, confirmDescription?, confirmationText? }.' },
      { name: 'title / description', type: 'string / ReactNode', defaultValue: "'Danger zone'", description: 'Header.' },
    ],
  },

  'api-key-manager': {
    description:
      'Create, list and revoke API keys. The secret is shown exactly once, in a dialog that cannot be dismissed by accident, and the list shows only the prefix and when each key was last used.',
    sections: [
      { title: 'Example', description: 'Create a key to see the one-time secret; revoke the one that was never used.', bare: true, Content: ApiKeysExample },
      rationale(
        'API key screens either show the secret forever (and so store it) or show it in a toast that disappears — and never say which keys are unused.',
        'Escape and the backdrop are off while the secret is on screen; “Never used” and “last used eight months ago” are the facts that decide which key to revoke.',
        'Developer settings, integration setup.',
        ['Modal', 'ConfirmDialog', 'Field', 'CheckboxGroup', 'Alert', 'EmptyState'],
      ),
    ],
    props: [
      { name: 'keys', type: 'ApiKey[]', description: '{ id, name, prefix, createdAt, lastUsedAt?, scopes? } — never the secret.' },
      { name: 'onCreate', type: '({ name, scopes }) => Promise<{ secret }>', description: 'Returns the secret once.' },
      { name: 'onRevoke', type: '(key) => void | Promise', description: 'After confirmation.' },
      { name: 'scopes / defaultScopes', type: 'ApiScope[] / string[]', description: 'Offered when creating.' },
      { name: 'limit', type: 'number', description: 'Most keys an account may hold.' },
    ],
  },

  'integration-card': {
    description:
      'One integration in a marketplace grid, with exactly one next step per state — Connect, Configure, Reconnect, or Upgrade — and a broken connection shown as broken, on the card.',
    sections: [
      { title: 'A marketplace', description: 'Connect one to see the pending state.', bare: true, Content: IntegrationsExample },
      rationale(
        'A broken integration silently stops data flowing, and most marketplaces show it identically to a healthy one.',
        'The card is interactive in hover only — its buttons carry the integration name, and a plan-gated card offers Upgrade instead of a dead Connect.',
        'Integrations page, onboarding, an empty data source.',
        ['Surface', 'Badge', 'Tag', 'Button', 'Spinner', 'StatusDot'],
      ),
    ],
    props: [
      { name: 'name / description / logo / category', type: 'string / ReactNode', description: 'Identity.' },
      { name: 'status', type: "'available' | 'connected' | 'error' | 'pending'", defaultValue: 'available', description: 'Drives the pill and the action.' },
      { name: 'meta', type: 'ReactNode', description: 'Sync time, or what went wrong.' },
      { name: 'requiresPlan', type: 'string', description: 'Replaces Connect with Upgrade.' },
      { name: 'onConnect / onDisconnect / onConfigure / onUpgrade', type: 'fn', description: 'State actions.' },
    ],
  },

  'changelog-list': {
    description:
      'Product updates, newest first — as a changelog page or compact in an in-app “What’s new”. Entries newer than the reader’s last visit are marked, which is what makes it news rather than an archive.',
    sections: [
      {
        title: 'timeline',
        bare: true,
        Content: () => (
          <Surface variant="card" padding="lg">
            <ChangelogList entries={CHANGELOG} unreadSince={daysFromNow(-10)} />
          </Surface>
        ),
      },
      {
        title: 'compact, for a popover',
        bare: true,
        Content: () => (
          <Surface variant="floating" padding="md" className="w-full max-w-[360px] border border-line">
            <Text size="heading" className="px-1 pb-1">
              What’s new
            </Text>
            <ChangelogList entries={CHANGELOG} unreadSince={daysFromNow(-10)} variant="compact" headingLevel="h3" />
          </Surface>
        ),
      },
      rationale(
        'In-app changelogs are a list of everything ever shipped with nothing marking what this person has not seen.',
        'The unread dot is backed by “New:” for assistive tech; tags New, Improved and Fixed take accent, neutral and outline tones.',
        'A public changelog page, a “What’s new” popover behind the bell, release notes in settings.',
        ['Tag', 'Text', 'Surface'],
      ),
    ],
    props: [
      { name: 'entries', type: 'ChangelogEntry[]', description: '{ id, date, title, version?, body?, tags?, href?, media? }.' },
      { name: 'unreadSince', type: 'Date', description: 'Later entries are marked new.' },
      { name: 'variant', type: "'timeline' | 'compact'", defaultValue: 'timeline', description: 'Page or popover.' },
    ],
  },

  'help-panel': {
    description:
      'The panel behind the help button: search the docs, jump to a resource, see whether the product is actually down, and reach a person — offered right at a dead-end search.',
    sections: [
      {
        title: 'Example',
        description: 'Search “reset 2fa”, then something with no answer.',
        bare: true,
        Content: () => (
          <HelpPanel
            className="w-full max-w-[440px]"
            articles={ARTICLES}
            popular={['a1', 'a2', 'a4', 'a6']}
            resources={RESOURCES}
            status={{ state: 'operational', label: 'All systems operational', href: '#status' }}
            onContact={() => undefined}
          />
        ),
      },
      rationale(
        'Help widgets end in a dead-end “No results”, and people who could not find an answer then hunt for the contact button.',
        'Per-word search over title, excerpt and category; the result count is announced; status answers “is it me or is it you?”.',
        'Behind a help button in a Drawer or Popover (bare), or on a support page.',
        ['SearchField', 'IconTile', 'StatusDot', 'Button', 'Surface'],
      ),
    ],
    props: [
      { name: 'articles / popular', type: 'HelpArticle[] / string[]', description: 'Searched locally; popular shown before typing.' },
      { name: 'resources', type: 'HelpResource[]', description: 'Tiles — { id, label, description?, icon?, href?, onSelect? }.' },
      { name: 'status', type: "{ state: 'operational' | 'degraded' | 'outage', label, href? }", description: 'System status row.' },
      { name: 'onContact / contactLabel', type: 'fn / string', description: 'Also offered at a dead-end search.' },
      { name: 'bare', type: 'boolean', description: 'No card chrome, for a Drawer.' },
    ],
  },

  'webhook-endpoints': {
    description:
      'The endpoints a workspace sends events to, with three states rather than two: an enabled endpoint that has answered 500 all day is live and broken, and it is shown as failing, with its last response.',
    sections: [
      { title: 'Endpoints and their deliveries', description: 'Open Deliveries on the failing endpoint.', bare: true, Content: WebhooksExample },
      rationale(
        '“Enabled” says nothing about whether the receiver is answering, so broken integrations stay invisible until a customer asks why data stopped.',
        'The last delivery and its status code sit on every row; test sends are disabled for disabled endpoints; deletion confirms and warns about queued events.',
        'Developer settings, an integration’s configuration page.',
        ['Surface', 'Switch', 'Tag', 'Button', 'ConfirmDialog', 'EmptyState'],
      ),
    ],
    props: [
      { name: 'endpoints', type: 'WebhookEndpoint[]', description: '{ id, url, events, enabled, failing?, lastDelivery?, description? }.' },
      { name: 'onAdd / onToggle / onTest / onView / onDelete', type: 'fn', description: 'Row actions; onDelete may return a promise.' },
      { name: 'selectedId', type: 'string', description: 'Highlights the endpoint whose log is open.' },
    ],
  },

  'webhook-deliveries': {
    description:
      'The delivery log for one endpoint. Every row opens to the exact payload and response, a timeout is its own outcome, and “Failed” is one tap away because that is the list anyone opens this to read.',
    sections: [
      { title: 'Example', bare: true, Content: () => <WebhookDeliveries deliveries={DELIVERIES} onRetry={() => undefined} /> },
      rationale(
        'Debugging a webhook without the body is guessing, and most logs show only a status code.',
        'Request and response in copyable code blocks side by side; retry is offered only on failures and turns into “Queued” once pressed.',
        'Beside WebhookEndpoints, in an integration’s debug view.',
        ['CodeBlock', 'Collapse', 'SegmentedControl', 'Tag'],
      ),
    ],
    props: [
      { name: 'deliveries', type: 'WebhookDelivery[]', description: '{ id, event, at, statusCode (null = timeout), durationMs?, attempt?, request?, response? }.' },
      { name: 'onRetry', type: '(delivery) => void', description: 'Offered on failed deliveries.' },
    ],
  },
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

const DELIVERIES: WebhookDelivery[] = [
  { id: 'd1', event: 'invoice.payment_failed', at: minutesAgo(3), statusCode: 500, durationMs: 212, attempt: 3, request: '{\n  "type": "invoice.payment_failed",\n  "data": { "invoice": "INV-2026-0142", "amount": 46800 }\n}', response: '{ "error": "Internal Server Error" }' },
  { id: 'd2', event: 'invoice.payment_failed', at: minutesAgo(18), statusCode: null, durationMs: 10_000, attempt: 2, request: '{\n  "type": "invoice.payment_failed",\n  "data": { "invoice": "INV-2026-0142" }\n}' },
  { id: 'd3', event: 'customer.updated', at: minutesAgo(64), statusCode: 200, durationMs: 88, request: '{\n  "type": "customer.updated",\n  "data": { "customer": "cus_4f2a" }\n}', response: '{ "received": true }' },
  { id: 'd4', event: 'invoice.paid', at: minutesAgo(190), statusCode: 200, durationMs: 102, request: '{ "type": "invoice.paid" }', response: '{ "received": true }' },
]

function WebhooksExample() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    { id: 'w1', url: 'https://api.northwind.io/hooks/acme', events: ['invoice.paid', 'invoice.payment_failed', 'customer.updated', 'subscription.deleted'], enabled: true, failing: true, lastDelivery: { ok: false, at: minutesAgo(3), statusCode: 500 } },
    { id: 'w2', url: 'https://hooks.zapier.com/hooks/catch/1234/abcd', events: ['customer.created'], enabled: true, lastDelivery: { ok: true, at: minutesAgo(40), statusCode: 200 }, description: 'Zapier' },
    { id: 'w3', url: 'https://staging.northwind.io/hooks', events: ['invoice.paid'], enabled: false },
  ])
  const [viewing, setViewing] = useState<string>()

  return (
    <div className="flex w-full flex-col gap-6">
      <WebhookEndpoints
        endpoints={endpoints}
        description="Events are signed and retried with backoff for up to three days."
        selectedId={viewing}
        onAdd={() => undefined}
        onToggle={(id, enabled) => setEndpoints((current) => current.map((item) => (item.id === id ? { ...item, enabled } : item)))}
        onTest={() => undefined}
        onView={(endpoint) => setViewing(endpoint.id)}
        onDelete={(endpoint) => setEndpoints((current) => current.filter((item) => item.id !== endpoint.id))}
      />
      {viewing && (
        <div className="flex flex-col gap-2">
          <Text as="h3" size="heading">
            Deliveries · {endpoints.find((item) => item.id === viewing)?.url}
          </Text>
          <WebhookDeliveries deliveries={viewing === 'w1' ? DELIVERIES : DELIVERIES.filter((item) => item.statusCode === 200)} onRetry={() => undefined} />
        </div>
      )}
    </div>
  )
}
