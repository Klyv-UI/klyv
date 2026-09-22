import { useState } from 'react'
import {
  ApiKeyManager,
  Button,
  Card,
  DangerZone,
  Field,
  Input,
  InviteMembers,
  InvoiceList,
  MemberList,
  PageHeader,
  PaymentMethodCard,
  PlanSummary,
  RolePermissions,
  SegmentedControl,
  SessionList,
  SettingsRow,
  SettingsSection,
  Switch,
  WebhookEndpoints,
  type ApiKey,
  type Member,
} from 'klyvui'

/**
 * A SaaS admin area: workspace settings, the team, billing, security and
 * developer access, in the tabs products settle on.
 *
 * Every control works. Invite someone and they appear as pending; the only
 * owner cannot be demoted; a created API key's secret is shown exactly once.
 */

type Tab = 'general' | 'team' | 'billing' | 'security' | 'developer'

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms)

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Everything, including billing' },
  { value: 'admin', label: 'Admin', description: 'Members and settings' },
  { value: 'member', label: 'Member', description: 'Create and edit projects' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only' },
]

const MEMBERS: Member[] = [
  { id: 'u1', name: 'Alex Morgan', email: 'alex@northwind.io', role: 'owner', lastActive: 'Active now' },
  { id: 'u2', name: 'Sam Whitfield', email: 'sam@northwind.io', role: 'admin', lastActive: 'Active 2 hours ago' },
  { id: 'u3', name: 'Jordan Lee', email: 'jordan@northwind.io', role: 'member', lastActive: 'Active yesterday' },
  { id: 'u4', name: 'taylor@northwind.io', email: 'taylor@northwind.io', role: 'member', status: 'invited' },
]

const PERMISSIONS = [
  { title: 'Projects', permissions: [{ id: 'projects.view', label: 'View projects' }, { id: 'projects.edit', label: 'Create and edit projects' }, { id: 'projects.delete', label: 'Delete projects' }] },
  { title: 'Workspace', permissions: [{ id: 'members.manage', label: 'Invite and remove members' }, { id: 'billing.manage', label: 'Manage billing' }, { id: 'api.manage', label: 'Create API keys' }] },
]

const ALL = PERMISSIONS.flatMap((group) => group.permissions.map((permission) => permission.id))

const secret = () => 'sk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, '0')).join('')

export default function SaasAdminBlock() {
  const [tab, setTab] = useState<Tab>('team')
  const [members, setMembers] = useState(MEMBERS)
  const [permissions, setPermissions] = useState<Record<string, string[]>>({
    owner: ALL,
    admin: ['projects.view', 'projects.edit', 'projects.delete', 'members.manage', 'api.manage'],
    member: ['projects.view', 'projects.edit'],
    viewer: ['projects.view'],
  })
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: 'k1', name: 'Production server', prefix: 'sk_live_4f2a', createdAt: ago(120 * DAY), lastUsedAt: ago(4 * 60_000), scopes: ['read', 'write'] },
    { id: 'k2', name: 'Old staging key', prefix: 'sk_test_71be', createdAt: ago(300 * DAY), lastUsedAt: null, scopes: ['read'] },
  ])
  const [name, setName] = useState('Northwind')
  const [savedName, setSavedName] = useState('Northwind')
  const [digest, setDigest] = useState(true)

  return (
    <div className="flex w-full flex-col gap-6 rounded-[var(--radius-window)] border border-line bg-app p-4 sm:p-6">
      <PageHeader headingLevel="h2" title="Settings" description="Manage the Northwind workspace, its members, billing and developer access." />
      <div className="no-scrollbar max-w-full self-start overflow-x-auto">
        <SegmentedControl
          label="Settings section"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'general', label: 'General' },
            { value: 'team', label: 'Team' },
            { value: 'billing', label: 'Billing' },
            { value: 'security', label: 'Security' },
            { value: 'developer', label: 'Developer' },
          ]}
        />
      </div>

      {tab === 'general' && (
        <div className="flex flex-col gap-10">
          <SettingsSection
            title="Workspace"
            description="How the workspace appears to members."
            dirty={name !== savedName}
            onReset={() => setName(savedName)}
            onSave={() => setSavedName(name)}
            footerNote="All changes saved"
          >
            <Field label="Workspace name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          </SettingsSection>
          <SettingsSection title="Notifications" description="Applied immediately.">
            <SettingsRow label="Weekly digest" description="A summary every Monday." htmlFor="admin-digest">
              <Switch id="admin-digest" checked={digest} onChange={(event) => setDigest(event.target.checked)} />
            </SettingsRow>
          </SettingsSection>
          <DangerZone
            actions={[
              { id: 'delete', title: 'Delete workspace', description: 'Permanently delete Northwind and everything in it.', actionLabel: 'Delete workspace', confirmationText: 'Northwind', onConfirm: () => undefined },
            ]}
          />
        </div>
      )}

      {tab === 'team' && (
        <div className="flex flex-col gap-6">
          <Card title="Invite people">
            <InviteMembers
              roles={ROLES.filter((role) => role.value !== 'owner')}
              defaultRole="member"
              existingEmails={members.map((member) => member.email)}
              seats={{ used: members.length, total: 10 }}
              onInvite={(invites) =>
                setMembers((current) => [
                  ...current,
                  ...invites.map((invite, index) => ({ id: `n${Date.now()}${index}`, name: invite.email, email: invite.email, role: invite.role, status: 'invited' as const })),
                ])
              }
            />
          </Card>
          <MemberList
            members={members}
            roles={ROLES}
            currentUserId="u1"
            onRoleChange={(id, role) => setMembers((current) => current.map((member) => (member.id === id ? { ...member, role } : member)))}
            onRemove={(member) => setMembers((current) => current.filter((item) => item.id !== member.id))}
            onResendInvite={() => undefined}
          />
          <RolePermissions
            label="Role permissions"
            roles={[{ id: 'owner', name: 'Owner', locked: true }, { id: 'admin', name: 'Admin' }, { id: 'member', name: 'Member' }, { id: 'viewer', name: 'Viewer' }]}
            groups={PERMISSIONS}
            value={permissions}
            onChange={setPermissions}
          />
        </div>
      )}

      {tab === 'billing' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <PlanSummary
              plan="Team"
              price="$468"
              period="per month · 12 seats"
              status="past_due"
              seats={{ used: 11, total: 12 }}
              paymentAction={<Button size="sm">Update payment method</Button>}
              actions={<Button size="sm">Change plan</Button>}
            />
            <Card title="Invoices" padded={false}>
              <InvoiceList
                onPay={() => undefined}
                onDownload={() => undefined}
                invoices={[
                  { id: 'i3', number: 'INV-2026-0142', date: ago(2 * DAY), amount: '$468.00', status: 'failed', description: 'Team plan · 12 seats' },
                  { id: 'i2', number: 'INV-2026-0118', date: ago(33 * DAY), amount: '$468.00', status: 'paid', description: 'Team plan · 12 seats' },
                  { id: 'i1', number: 'INV-2026-0097', date: ago(63 * DAY), amount: '$429.00', status: 'paid', description: 'Team plan · 11 seats' },
                ]}
              />
            </Card>
          </div>
          <Card title="Payment methods">
            <div className="flex flex-col gap-2">
              <PaymentMethodCard brand="visa" last4="4242" expMonth={8} expYear={2029} isDefault onEdit={() => undefined} onRemove={() => undefined} />
              <PaymentMethodCard brand="amex" last4="0005" expMonth={1} expYear={2025} onEdit={() => undefined} onRemove={() => undefined} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'security' && (
        <SessionList
          sessions={[
            { id: 's1', device: 'Chrome on macOS', location: 'London, UK', ip: '81.2.69.160', lastActive: new Date(), current: true },
            { id: 's2', device: 'Safari on iPhone', kind: 'mobile', location: 'London, UK', lastActive: ago(DAY) },
            { id: 's3', device: 'Firefox on Windows', location: 'Lisbon, Portugal', ip: '193.136.2.18', lastActive: ago(3 * DAY) },
          ]}
          onRevoke={() => undefined}
          onRevokeOthers={() => undefined}
        />
      )}

      {tab === 'developer' && (
        <div className="flex flex-col gap-8">
          <ApiKeyManager
            keys={keys}
            scopes={[{ value: 'read', label: 'Read' }, { value: 'write', label: 'Write' }]}
            defaultScopes={['read']}
            limit={5}
            description="Keys act on behalf of this workspace."
            onCreate={async ({ name: keyName, scopes }) => {
              const value = secret()
              setKeys((current) => [{ id: crypto.randomUUID(), name: keyName, scopes, prefix: value.slice(0, 12), createdAt: new Date(), lastUsedAt: null }, ...current])
              return { secret: value }
            }}
            onRevoke={(key) => setKeys((current) => current.filter((item) => item.id !== key.id))}
          />
          <WebhookEndpoints
            endpoints={[
              { id: 'w1', url: 'https://api.northwind.io/hooks/acme', events: ['invoice.paid', 'customer.updated'], enabled: true, failing: true, lastDelivery: { ok: false, at: ago(180_000), statusCode: 500 } },
              { id: 'w2', url: 'https://hooks.zapier.com/hooks/catch/1234', events: ['customer.created'], enabled: true, lastDelivery: { ok: true, at: ago(2_400_000), statusCode: 200 } },
            ]}
            onAdd={() => undefined}
            onToggle={() => undefined}
            onTest={() => undefined}
          />
        </div>
      )}
    </div>
  )
}
