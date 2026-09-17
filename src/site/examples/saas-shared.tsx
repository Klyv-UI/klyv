import {
  BarChart3,
  BookOpen,
  Keyboard,
  LifeBuoy,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import {
  Sparkline,
  StatCard,
  Surface,
  Text,
  type ApiKey,
  type ApiScope,
  type ChangelogEntry,
  type ComparisonGroup,
  type ComparisonPlan,
  type FeatureItem,
  type HelpArticle,
  type HelpResource,
  type Invoice,
  type LogoItem,
  type Member,
  type PermissionGroup,
  type PermissionRole,
  type PricingPlan,
  type RoleOption,
  type UsageItem,
  type Workspace,
} from 'klyv'

/**
 * Fixture data shared by the SaaS Kit demos and the templates page. Every
 * company, person and product here is invented — the library ships no brand
 * artwork, so the marks are drawn from a shape and a name.
 */

export const DAY = 86_400_000
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY)

const SHAPES = [
  <circle key="c" cx="11" cy="14" r="8" />,
  <rect key="r" x="3" y="6" width="16" height="16" rx="4" />,
  <path key="p" d="M11 4l9 18H2z" />,
]

/** A made-up company mark: one shape and a word, in currentColor. */
export function FakeLogo({ name, variant = 0 }: { name: string; variant?: number }) {
  return (
    <svg viewBox={`0 0 ${30 + name.length * 9.5} 28`} fill="currentColor" aria-hidden="true">
      {SHAPES[variant % SHAPES.length]}
      <text x="27" y="19.5" fontSize="15" fontWeight="800" fontFamily="inherit" letterSpacing="-0.3">
        {name}
      </text>
    </svg>
  )
}

export const LOGOS: LogoItem[] = ['Northwind', 'Kestrel', 'Lumen', 'Orbital', 'Fathom', 'Quarry'].map(
  (name, index) => ({ name, logo: <FakeLogo name={name} variant={index} /> }),
)

export const FEATURES: FeatureItem[] = [
  { icon: Zap, title: 'Real-time by default', description: 'Every chart and list updates as events arrive — no refresh button, no stale numbers.', href: '#realtime' },
  { icon: Workflow, title: 'Workflows', description: 'Turn a threshold into an action: alert a channel, open a ticket, pause a campaign.', href: '#workflows', badge: 'New' },
  { icon: ShieldCheck, title: 'Secure by design', description: 'SSO, SCIM, audit logs and data residency in the EU or the US.', href: '#security' },
  { icon: Users, title: 'Built for teams', description: 'Roles, shared views and comments, so the whole team reads the same numbers.', href: '#teams' },
  { icon: BarChart3, title: 'Reports that explain', description: 'Every metric shows its definition and its source, one click away.', href: '#reports' },
  { icon: Sparkles, title: 'Answers, not queries', description: 'Ask in plain language and get a chart you can pin to a dashboard.', href: '#answers' },
]

export const TESTIMONIALS = [
  {
    quote: 'We replaced three internal dashboards in a week. The team finally argues about decisions instead of about whose numbers are right.',
    name: 'Maya Okafor',
    role: 'Head of Growth',
    company: 'Northwind',
    rating: 5,
  },
  {
    quote: 'The workflows paid for the plan in the first month — churn alerts now reach the account owner the same morning.',
    name: 'Daniel Reyes',
    role: 'VP Customer Success',
    company: 'Kestrel',
    rating: 5,
  },
  {
    quote: 'Setup took an afternoon. SSO and the audit log got us through security review without a single follow-up.',
    name: 'Priya Natarajan',
    role: 'IT Lead',
    company: 'Orbital',
    rating: 4,
  },
]

export const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individuals trying things out.',
    monthly: 0,
    yearly: 0,
    features: ['Up to 3 projects', '10k events a month', 'Community support'],
    ctaLabel: 'Start for free',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For small teams shipping every week.',
    monthly: 24,
    yearly: 19,
    featured: true,
    badge: 'Most popular',
    featuresTitle: 'Everything in Free, plus',
    features: ['Unlimited projects', '1M events a month', 'Workflows and alerts', 'Email support'],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For growing teams that need control.',
    monthly: 49,
    yearly: 39,
    featuresTitle: 'Everything in Pro, plus',
    features: ['SSO with SAML', 'Roles and permissions', 'Audit log', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organisations with custom needs.',
    monthly: null,
    yearly: null,
    featuresTitle: 'Everything in Team, plus',
    features: ['Dedicated success manager', '99.99% uptime SLA', 'Custom contract and DPA'],
  },
]

export const COMPARISON_PLANS: ComparisonPlan[] = [
  { id: 'free', name: 'Free' },
  { id: 'pro', name: 'Pro', highlight: true },
  { id: 'team', name: 'Team' },
  { id: 'enterprise', name: 'Enterprise' },
]

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    title: 'Usage',
    rows: [
      { label: 'Projects', values: { free: '3', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' } },
      { label: 'Events a month', values: { free: '10k', pro: '1M', team: '10M', enterprise: 'Custom' } },
      { label: 'Data retention', hint: 'How far back reports can look', values: { free: '30 days', pro: '1 year', team: '3 years', enterprise: 'Custom' } },
    ],
  },
  {
    title: 'Features',
    rows: [
      { label: 'Dashboards', values: { free: true, pro: true, team: true, enterprise: true } },
      { label: 'Workflows and alerts', values: { free: false, pro: true, team: true, enterprise: true } },
      { label: 'Plain-language answers', values: { free: false, pro: true, team: true, enterprise: true } },
    ],
  },
  {
    title: 'Security',
    rows: [
      { label: 'SSO with SAML', values: { free: false, pro: false, team: true, enterprise: true } },
      { label: 'Audit log', values: { free: false, pro: false, team: true, enterprise: true } },
      { label: 'Data residency', values: { free: false, pro: false, team: false, enterprise: true } },
    ],
  },
]

export const ROLES: RoleOption[] = [
  { value: 'owner', label: 'Owner', description: 'Everything, including billing' },
  { value: 'admin', label: 'Admin', description: 'Members and settings' },
  { value: 'member', label: 'Member', description: 'Create and edit projects' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only' },
]

export const MEMBERS: Member[] = [
  { id: 'u1', name: 'Alex Morgan', email: 'alex@northwind.io', role: 'owner', lastActive: 'Active now' },
  { id: 'u2', name: 'Sam Whitfield', email: 'sam@northwind.io', role: 'admin', lastActive: 'Active 2 hours ago' },
  { id: 'u3', name: 'Jordan Lee', email: 'jordan@northwind.io', role: 'member', lastActive: 'Active yesterday' },
  { id: 'u4', name: 'Riya Kapoor', email: 'riya@northwind.io', role: 'member', lastActive: 'Active 3 days ago' },
  { id: 'u5', name: 'Chris Alvarez', email: 'chris@contractor.dev', role: 'viewer', status: 'suspended' },
  { id: 'u6', name: 'taylor@northwind.io', email: 'taylor@northwind.io', role: 'member', status: 'invited' },
]

export const WORKSPACES: Workspace[] = [
  { id: 'northwind', name: 'Northwind', plan: 'Team plan' },
  { id: 'kestrel', name: 'Kestrel Labs', plan: 'Pro plan' },
  { id: 'side', name: 'Side project', plan: 'Free' },
]

export const MANY_WORKSPACES: Workspace[] = [
  ...WORKSPACES,
  { id: 'lumen', name: 'Lumen Studio', plan: 'Pro plan' },
  { id: 'orbital', name: 'Orbital', plan: 'Team plan' },
  { id: 'fathom', name: 'Fathom Health', plan: 'Enterprise' },
  { id: 'quarry', name: 'Quarry & Co', plan: 'Pro plan' },
  { id: 'harbor', name: 'Harbor Freight Tech', plan: 'Free trial' },
]

export const USAGE: UsageItem[] = [
  { id: 'events', label: 'Events', used: 842_000, limit: 1_000_000 },
  { id: 'seats', label: 'Seats', used: 8, limit: 10, unit: 'seats' },
  { id: 'storage', label: 'Storage', used: 61.4, limit: 50, unit: 'GB', format: (value) => value.toFixed(1) },
  { id: 'projects', label: 'Projects', used: 27, limit: null },
]

export const INVOICES: Invoice[] = [
  { id: 'i5', number: 'INV-2026-0142', date: daysFromNow(-2), amount: '$468.00', status: 'failed', description: 'Team plan · 12 seats' },
  { id: 'i4', number: 'INV-2026-0118', date: daysFromNow(-33), amount: '$468.00', status: 'paid', description: 'Team plan · 12 seats' },
  { id: 'i3', number: 'INV-2026-0097', date: daysFromNow(-63), amount: '$429.00', status: 'paid', description: 'Team plan · 11 seats' },
  { id: 'i2', number: 'INV-2026-0071', date: daysFromNow(-94), amount: '$24.00', status: 'refunded', description: 'Pro plan · proration' },
  { id: 'i1', number: 'INV-2026-0040', date: daysFromNow(-124), amount: '$390.00', status: 'paid', description: 'Team plan · 10 seats' },
]

export const PERMISSION_ROLES: PermissionRole[] = [
  { id: 'owner', name: 'Owner', locked: true },
  { id: 'admin', name: 'Admin' },
  { id: 'member', name: 'Member' },
  { id: 'viewer', name: 'Viewer' },
]

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Projects',
    permissions: [
      { id: 'projects.view', label: 'View projects' },
      { id: 'projects.edit', label: 'Create and edit projects' },
      { id: 'projects.delete', label: 'Delete projects', description: 'Removes every report inside' },
    ],
  },
  {
    title: 'Workspace',
    permissions: [
      { id: 'members.manage', label: 'Invite and remove members' },
      { id: 'billing.manage', label: 'Manage billing' },
      { id: 'api.manage', label: 'Create API keys' },
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id))

export const PERMISSION_VALUE: Record<string, string[]> = {
  owner: ALL_PERMISSIONS,
  admin: ['projects.view', 'projects.edit', 'projects.delete', 'members.manage', 'api.manage'],
  member: ['projects.view', 'projects.edit'],
  viewer: ['projects.view'],
}

export const API_SCOPES: ApiScope[] = [
  { value: 'read', label: 'Read', hint: 'Query projects and reports' },
  { value: 'write', label: 'Write', hint: 'Send events and edit projects' },
  { value: 'admin', label: 'Admin', hint: 'Manage members and settings' },
]

export const API_KEYS: ApiKey[] = [
  { id: 'k1', name: 'Production server', prefix: 'sk_live_4f2a', createdAt: daysFromNow(-120), lastUsedAt: new Date(Date.now() - 4 * 60_000), scopes: ['read', 'write'] },
  { id: 'k2', name: 'Zapier', prefix: 'sk_live_9c01', createdAt: daysFromNow(-45), lastUsedAt: daysFromNow(-3), scopes: ['read'] },
  { id: 'k3', name: 'Old staging key', prefix: 'sk_test_71be', createdAt: daysFromNow(-300), lastUsedAt: null, scopes: ['read', 'write', 'admin'] },
]

export function randomSecret(prefix = 'sk_live_') {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return prefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 'c4',
    date: daysFromNow(-1),
    version: 'v2.14',
    title: 'Workflows can now post to any webhook',
    tags: ['New'],
    body: 'Point a workflow at any HTTPS endpoint. Payloads are signed, retried with backoff, and every delivery is listed with its response.',
  },
  {
    id: 'c3',
    date: daysFromNow(-6),
    version: 'v2.13',
    title: 'Dashboards load twice as fast',
    tags: ['Improved'],
    body: 'Charts now stream in as their queries finish instead of waiting for the slowest one.',
  },
  {
    id: 'c2',
    date: daysFromNow(-15),
    version: 'v2.12',
    title: 'Fixed CSV exports with non-Latin column names',
    tags: ['Fixed'],
    body: 'Exports are now UTF-8 with a byte-order mark, so spreadsheets open them correctly.',
  },
  {
    id: 'c1',
    date: daysFromNow(-28),
    version: 'v2.11',
    title: 'SCIM provisioning for Team and Enterprise',
    tags: ['New', 'Security'],
    body: 'Create, update and deactivate members from your identity provider.',
  },
]

export const ARTICLES: HelpArticle[] = [
  { id: 'a1', title: 'Inviting your team', category: 'Getting started', excerpt: 'Add people and choose their role', href: '#invite' },
  { id: 'a2', title: 'Sending your first event', category: 'Getting started', excerpt: 'Install the SDK in five minutes', href: '#events' },
  { id: 'a3', title: 'Resetting two-factor authentication', category: 'Account', excerpt: 'Lost your phone? Recover access (2fa)', href: '#2fa' },
  { id: 'a4', title: 'Changing your plan', category: 'Billing', excerpt: 'Upgrades apply now, downgrades at renewal', href: '#plan' },
  { id: 'a5', title: 'Downloading invoices', category: 'Billing', excerpt: 'Every invoice as a PDF', href: '#invoices' },
  { id: 'a6', title: 'Setting up SSO with SAML', category: 'Security', excerpt: 'Okta, Entra ID and Google Workspace', href: '#sso' },
  { id: 'a7', title: 'Rotating an API key', category: 'Developers', excerpt: 'Create the new key before revoking the old', href: '#rotate' },
]

export const RESOURCES: HelpResource[] = [
  { id: 'docs', label: 'Documentation', description: 'Guides and API reference', icon: BookOpen, href: '#docs' },
  { id: 'community', label: 'Community', description: 'Ask other customers', icon: MessageCircle, href: '#community' },
  { id: 'shortcuts', label: 'Keyboard shortcuts', description: 'Press ? anywhere', icon: Keyboard, onSelect: () => undefined },
  { id: 'status', label: 'Onboarding call', description: 'Book 30 minutes with us', icon: LifeBuoy, href: '#call' },
]

/** A small product screenshot made of real library components, for hero media. */
export function ProductShot() {
  return (
    <div className="flex flex-col gap-3 bg-app p-3 sm:p-5" aria-hidden="true">
      <div className="flex items-center gap-1.5">
        {['bg-danger', 'bg-warning', 'bg-success'].map((tone) => (
          <span key={tone} className={`size-2.5 rounded-full ${tone} opacity-70`} />
        ))}
        <Text as="span" size="caption" weight="semibold" tone="faint" className="ml-2">
          app.example.com / overview
        </Text>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="Active users" value="12,481" delta="+8.2%" trend="up" caption="Last 7 days" />
        <StatCard title="Conversion" value="4.9%" delta="+0.6%" trend="up" caption="Trial to paid" />
        <StatCard title="Churn" value="1.8%" delta="-0.3%" trend="down" caption="Monthly" className="hidden sm:flex" />
      </div>
      <Surface variant="card" padding="lg" className="gap-3">
        <Text size="heading">Weekly active users</Text>
        <Sparkline
          values={[32, 38, 35, 44, 48, 46, 55, 61, 58, 66, 72, 70, 78, 84]}
          label="Weekly active users, rising"
          width={640}
          height={120}
          area
          showLast
          className="h-auto w-full"
        />
      </Surface>
    </div>
  )
}
