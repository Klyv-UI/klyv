/**
 * Recipes: how to build one common thing from the library.
 *
 * A block is a finished screen; a recipe is the reasoning behind one — which
 * components, in what order, and the props that matter. Every snippet uses
 * only props the components declare (the API tables are generated from the
 * same types), and names the block to start from when one exists.
 */
export interface RecipeStep {
  title: string
  body: string
  code?: string
  language?: string
}

export interface RecipeEntry {
  slug: string
  title: string
  summary: string
  tags: string[]
  projectTypes: string[]
  /** Component names, in the order the steps introduce them. */
  components: string[]
  /** Block slugs to start from. */
  blocks: string[]
  steps: RecipeStep[]
}

export const recipes: RecipeEntry[] = [
  {
    slug: 'login-flow',
    title: 'Build a login flow',
    summary: 'Email and password, provider buttons, a pending state, an announced error, then the two-factor step.',
    tags: ['authentication', 'forms', 'security'],
    projectTypes: ['saas', 'internal', 'ai', 'devtool', 'ecommerce'],
    components: ['AuthCard', 'Field', 'Input', 'PasswordInput', 'Button', 'InputOTP'],
    blocks: ['login', 'authentication'],
    steps: [
      {
        title: 'Start from the blocks',
        body: 'Both screens exist as blocks. Take them with the CLI and change the copy, or read on to see how they are put together.',
        code: 'npx klyv add block login authentication',
        language: 'bash',
      },
      {
        title: 'Frame it with AuthCard',
        body: 'AuthCard owns the title, the provider buttons, the divider and the error, so the form inside it is only fields. Pass the error as a string: the card announces it rather than only colouring it red.',
        code: `<AuthCard
  title="Sign in to Acme"
  providers={[{ id: 'github', label: 'Continue with GitHub', onClick: startGitHub }]}
  error={error}
>
  <form onSubmit={submit} className="flex flex-col gap-4">
    <Field label="Email">
      <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    </Field>
    <Field label="Password">
      <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
    </Field>
    <Button type="submit" loading={pending} fullWidth>
      Sign in
    </Button>
  </form>
</AuthCard>`,
        language: 'tsx',
      },
      {
        title: 'Add the second factor',
        body: 'InputOTP submits itself when the last digit lands, so there is no button to press after typing a code.',
        code: `<InputOTP label="Verification code" length={6} value={code} onValueChange={setCode} onComplete={verify} />`,
        language: 'tsx',
      },
    ],
  },
  {
    slug: 'billing-page',
    title: 'Build a billing page',
    summary: 'The plan, what has been used against it, the card on file and the invoices — the four things a billing page is for.',
    tags: ['billing', 'settings', 'commerce'],
    projectTypes: ['saas', 'ai', 'ecommerce'],
    components: ['PlanSummary', 'UsageMeter', 'PaymentMethodCard', 'InvoiceList'],
    blocks: ['saas-admin'],
    steps: [
      {
        title: 'Lead with the plan',
        body: 'PlanSummary takes a subscription status — active, trialing, past_due, canceled or paused — and says what it means, including when it renews or ends.',
        code: `<PlanSummary plan="Pro" price="$49" period="per month" status="active" renewsAt={renewsAt} seats={{ used: 8, total: 10 }} />`,
        language: 'tsx',
      },
      {
        title: 'Show usage against the limit',
        body: 'A null limit means unlimited on this plan. The meter warns before a limit is reached, and offers the upgrade when you give it somewhere to go.',
        code: `<UsageMeter
  title="This month"
  items={[
    { id: 'seats', label: 'Seats', used: 8, limit: 10 },
    { id: 'storage', label: 'Storage', used: 42, limit: 100, unit: 'GB' },
    { id: 'api', label: 'API calls', used: 81_200, limit: null },
  ]}
  onUpgrade={openUpgrade}
/>`,
        language: 'tsx',
      },
      {
        title: 'The card on file, and the invoices',
        body: 'Neither component takes card numbers — entry belongs to your payment provider. They display what the provider already stores.',
        code: `<PaymentMethodCard brand="Visa" last4="4242" expMonth={4} expYear={2028} isDefault onEdit={editCard} />
<InvoiceList invoices={invoices} onDownload={download} />`,
        language: 'tsx',
      },
    ],
  },
  {
    slug: 'onboarding-flow',
    title: 'Build an onboarding flow',
    summary: 'A checklist on the home screen that tracks real progress, with a way out at every stage.',
    tags: ['onboarding', 'authentication'],
    projectTypes: ['saas', 'ai', 'devtool'],
    components: ['SetupChecklist', 'Button', 'OnboardingWizard', 'CoachTour'],
    blocks: ['signup', 'saas-dashboard'],
    steps: [
      {
        title: 'Begin at sign-up',
        body: 'The Signup block holds the password strength meter and the terms that must be accepted before the button submits.',
        code: 'npx klyv add block signup saas-dashboard',
        language: 'bash',
      },
      {
        title: 'Track setup on the home screen',
        body: 'Each step is done or not, from your own data — the checklist never marks a step done because it was clicked. Optional steps do not hold back completion.',
        code: `<SetupChecklist
  title="Get set up"
  steps={[
    { id: 'profile', title: 'Complete your profile', done: true },
    { id: 'invite', title: 'Invite your team', done: invited, action: <Button size="sm" variant="outline">Invite</Button> },
    { id: 'connect', title: 'Connect a data source', done: connected, optional: true },
  ]}
  onDismiss={hideChecklist}
/>`,
        language: 'tsx',
      },
      {
        title: 'Walk through anything that needs order',
        body: 'OnboardingWizard is for steps that depend on each other; CoachTour points at parts of a screen that already exist. Both are on their pages with working examples.',
      },
    ],
  },
  {
    slug: 'settings-page',
    title: 'Build a settings page',
    summary: 'Sections that save on their own, a save bar that only appears when something changed, and a danger zone at the foot.',
    tags: ['settings', 'forms'],
    projectTypes: ['saas', 'internal', 'devtool'],
    components: ['SettingsSection', 'Field', 'Input', 'Switch', 'DangerZone'],
    blocks: ['settings', 'saas-admin'],
    steps: [
      {
        title: 'One section per concern',
        body: 'SettingsSection owns its save and reset. Tell it whether it is dirty and whether it is saving; it shows the footer only when there is something to do.',
        code: `<SettingsSection
  title="Workspace"
  description="Shown to everyone you invite."
  dirty={name !== saved.name}
  saving={saving}
  onSave={save}
  onReset={() => setName(saved.name)}
>
  <Field label="Workspace name">
    <Input value={name} onChange={(e) => setName(e.target.value)} />
  </Field>
</SettingsSection>`,
        language: 'tsx',
      },
      {
        title: 'Finish with the danger zone',
        body: 'DangerZone confirms each action through ConfirmDialog, so deleting a workspace is never one click.',
      },
    ],
  },
  {
    slug: 'data-view',
    title: 'Build a filterable data view',
    summary: 'A sortable, selectable table with bulk actions — the shape of every admin list.',
    tags: ['tables', 'search', 'analytics', 'workflow'],
    projectTypes: ['internal', 'dashboard', 'saas', 'devtool'],
    components: ['DataTable', 'BulkActionBar', 'Button', 'FilterBuilder', 'SavedViews'],
    blocks: ['admin'],
    steps: [
      {
        title: 'Describe the columns',
        body: 'A column is sortable when it has a sortValue. Use tabular on any column of figures so the digits line up.',
        code: `const columns: DataTableColumn<Member>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
  { id: 'seats', header: 'Seats', cell: (row) => row.seats, sortValue: (row) => row.seats, tabular: true },
]

<DataTable
  label="Members"
  columns={columns}
  rows={members}
  rowId={(row) => row.id}
  selectable
  selected={selected}
  onSelectedChange={setSelected}
  pageSize={10}
/>`,
        language: 'tsx',
      },
      {
        title: 'Act on the selection',
        body: 'BulkActionBar counts the selection in words and clears it; the actions are yours.',
        code: `{selected.length > 0 && (
  <BulkActionBar count={selected.length} noun="member" onClear={() => setSelected([])}>
    <Button size="sm" variant="outline">Remove</Button>
  </BulkActionBar>
)}`,
        language: 'tsx',
      },
      {
        title: 'Let people keep their filters',
        body: 'FilterBuilder edits a list of conditions and a match mode; SavedViews names a combination so it can be returned to. The Admin panel block wires a table end to end.',
      },
    ],
  },
  {
    slug: 'analytics-dashboard',
    title: 'Build an analytics dashboard',
    summary: 'A header, a row of KPIs with deltas, the charts behind them and the table underneath.',
    tags: ['analytics', 'charts', 'tables', 'navigation'],
    projectTypes: ['dashboard', 'saas', 'internal'],
    components: ['PageHeader', 'StatCard', 'AreaChart', 'DonutChart', 'DataTable'],
    blocks: ['dashboard', 'saas-dashboard'],
    steps: [
      {
        title: 'Take the Dashboard block',
        body: 'It already has live KPIs, a sortable table with selection, two charts and an event feed, laid out inside an AppShell.',
        code: 'npx klyv add block dashboard',
        language: 'bash',
      },
      {
        title: 'A row of figures',
        body: 'StatCard carries the delta and its direction, so "up" is not left to the colour alone.',
        code: `<PageHeader title="Overview" description="Last 30 days" actions={<Button size="sm" variant="outline">Export</Button>} />
<div className="grid gap-3 sm:grid-cols-3">
  <StatCard title="Revenue" value="$48,210" delta="+12%" trend="up" caption="vs last month" />
  <StatCard title="Active users" value="3,904" delta="+4%" trend="up" />
  <StatCard title="Churn" value="1.8%" delta="-0.3%" trend="down" />
</div>`,
        language: 'tsx',
      },
      {
        title: 'Then the charts',
        body: 'AreaChart and DonutChart are drawn with SVG — there is no charting dependency — and each announces its data to assistive technology.',
      },
    ],
  },
]

export function findRecipe(slug: string | undefined): RecipeEntry | undefined {
  return recipes.find((recipe) => recipe.slug === slug)
}
