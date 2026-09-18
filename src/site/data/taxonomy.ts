import type { GroupId } from './groups'

/**
 * The shared vocabulary every discovery feature reads.
 *
 * Search, Find My UI and the recommendations all ask one question of an item —
 * "which of these tags does it carry?" — and this file is the only place that
 * decides the answer. Tags are assigned by where a component is filed (its
 * group and section), topped up by a short list of per-name additions for the
 * components whose job is not obvious from their section. Adding a component
 * to a section tags it; nothing else needs to change.
 */
export type TagId = string

/* ------------------------------------------------------------ what you need */

export interface NeedDefinition {
  id: TagId
  label: string
  description: string
}

/** Step two of Find My UI. Each need is itself a tag. */
export const NEEDS: NeedDefinition[] = [
  { id: 'authentication', label: 'Authentication', description: 'Sign-in, sign-up, two-factor and SSO.' },
  { id: 'billing', label: 'Billing', description: 'Plans, pricing, invoices and usage.' },
  { id: 'navigation', label: 'Navigation', description: 'Shells, sidebars, tabs and menus.' },
  { id: 'analytics', label: 'Analytics', description: 'Metrics, charts and dashboards.' },
  { id: 'forms', label: 'Forms', description: 'Fields, validation and structured input.' },
  { id: 'tables', label: 'Tables', description: 'Sortable, selectable, filterable data.' },
  { id: 'settings', label: 'Settings', description: 'Preferences, workspace and account pages.' },
  { id: 'notifications', label: 'Notifications', description: 'Toasts, alerts, banners and inboxes.' },
  { id: 'search', label: 'Search', description: 'Command palettes, filters and saved views.' },
  { id: 'onboarding', label: 'Onboarding', description: 'Wizards, checklists and product tours.' },
]

/* ------------------------------------------------------- what you are building */

export interface ProjectTypeDefinition {
  id: string
  label: string
  /** As it reads mid-sentence: "for a SaaS product". */
  phrase: string
  description: string
  /** The tags that matter most for this kind of product. */
  tags: TagId[]
}

/** Step one of Find My UI. */
export const PROJECT_TYPES: ProjectTypeDefinition[] = [
  {
    id: 'saas',
    label: 'SaaS',
    phrase: 'a SaaS product',
    description: 'A subscription product with accounts, teams and billing.',
    tags: ['authentication', 'billing', 'settings', 'team', 'onboarding'],
  },
  {
    id: 'ai',
    label: 'AI application',
    phrase: 'an AI application',
    description: 'Streaming responses, chat, feedback and usage limits.',
    tags: ['ai', 'chat', 'feedback', 'developer'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    phrase: 'a dashboard',
    description: 'Metrics, charts and the tables behind them.',
    tags: ['analytics', 'charts', 'tables', 'navigation'],
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    phrase: 'an e-commerce store',
    description: 'Products, pricing, checkout and payment.',
    tags: ['commerce', 'billing', 'media'],
  },
  {
    id: 'marketing',
    label: 'Marketing website',
    phrase: 'a marketing website',
    description: 'Heroes, features, pricing and social proof.',
    tags: ['marketing', 'motion'],
  },
  {
    id: 'devtool',
    label: 'Developer tool',
    phrase: 'a developer tool',
    description: 'Code, keys, webhooks, logs and keyboard-first UI.',
    tags: ['developer', 'search', 'data'],
  },
  {
    id: 'internal',
    label: 'Internal tool',
    phrase: 'an internal tool',
    description: 'Admin panels, workflows and approvals.',
    tags: ['tables', 'forms', 'workflow', 'data', 'team'],
  },
  {
    id: 'other',
    label: 'Something else',
    phrase: 'your project',
    description: 'Skip this — recommendations will come from what you need.',
    tags: [],
  },
]

/* -------------------------------------------------------- how items get tags */

/** Every component filed under a section inherits its tags. */
export const SECTION_TAGS: Partial<Record<GroupId, Record<string, TagId[]>>> = {
  Foundations: { Primitives: ['foundations'], Utilities: ['accessibility'] },
  Layout: {
    Structure: ['layout'],
    Disclosure: ['layout'],
    'Stacks & scrolling': ['layout', 'media'],
  },
  Navigation: {
    'Bars & shells': ['navigation', 'layout'],
    'Tabs & steps': ['navigation'],
    'Menus & search': ['navigation', 'search'],
  },
  Actions: { Buttons: ['actions', 'forms'], Composed: ['actions'] },
  'Forms & Inputs': {
    'Text fields': ['forms'],
    Choice: ['forms'],
    'Numeric & range': ['forms'],
    'Date & time': ['forms', 'scheduling'],
    'Rich input': ['forms', 'media'],
    'Form structure': ['forms'],
  },
  'Data Display': {
    Identity: ['data'],
    'Lists & tables': ['tables', 'data'],
    Metrics: ['analytics', 'data'],
    Records: ['data', 'developer'],
    Media: ['media'],
  },
  Charts: {
    Plots: ['charts', 'analytics'],
    'Gauges & rings': ['charts', 'analytics'],
    Distribution: ['charts', 'analytics'],
    'Flow & hierarchy': ['charts', 'analytics'],
    'Time & activity': ['charts', 'analytics', 'scheduling'],
    'Chart parts': ['charts'],
  },
  Feedback: {
    Status: ['feedback'],
    Messages: ['notifications', 'feedback'],
    'Empty & error': ['feedback'],
    'System state': ['feedback', 'notifications'],
    Celebration: ['feedback'],
  },
  Overlays: { Dialogs: ['overlays'], Popovers: ['overlays'], Guidance: ['onboarding', 'overlays'] },
  'Motion & Effects': {
    'Entrance & scroll': ['motion', 'marketing'],
    Text: ['motion', 'marketing'],
    'Surfaces & light': ['motion', 'marketing'],
    Numbers: ['motion', 'analytics'],
    'Micro-interaction': ['motion'],
  },
  Interaction: {
    'Touch & drag': ['interaction'],
    'Presence & collaboration': ['collaboration', 'chat'],
    'Trust & workflow': ['workflow'],
  },
  'Canvas & Play': { Generative: ['creative'], Audio: ['creative'], Physics: ['creative'], Toys: ['creative'] },
  SaaS: {
    Marketing: ['marketing'],
    Pricing: ['billing', 'marketing', 'commerce'],
    'Auth & onboarding': ['authentication', 'onboarding'],
    Billing: ['billing'],
    Workspace: ['team', 'settings'],
    'Settings & developer': ['settings', 'developer'],
    'Data & views': ['tables', 'search'],
    Engagement: ['notifications', 'marketing'],
    // Security first: a session list or an IP allowlist is about securing the
    // account; signing in is what it protects, not what it is.
    Security: ['security', 'authentication', 'settings'],
  },
}

/**
 * Additions for components whose section undersells them. Keep this short:
 * if a whole section needs a tag, it belongs in SECTION_TAGS instead.
 */
export const COMPONENT_TAGS: Record<string, TagId[]> = {
  DataTable: ['analytics'],
  DataExplorer: ['analytics', 'search'],
  BulkActionBar: ['workflow'],
  CommandPalette: ['developer'],
  SearchField: ['search'],
  Combobox: ['search'],
  MultiSelect: ['search'],
  FilterBar: ['search', 'tables'],
  Sidebar: ['settings'],
  Stepper: ['onboarding'],
  Pagination: ['tables'],
  PasswordInput: ['authentication'],
  PasswordStrength: ['authentication'],
  InputOTP: ['authentication'],
  PinPad: ['authentication'],
  Field: ['authentication'],
  ValidationSummary: ['authentication'],
  Switch: ['settings'],
  SegmentedControl: ['settings'],
  Toast: ['feedback'],
  NotificationCenter: ['feedback'],
  SessionTimeout: ['authentication', 'security'],
  PermissionGate: ['security', 'team'],
  ConsentManager: ['settings', 'security'],
  AuditTrail: ['security', 'team'],
  ApprovalChain: ['team'],
  StatCard: ['charts'],
  Metric: ['charts'],
  Sparkline: ['tables'],
  CodeBlock: ['ai'],
  JsonViewer: ['ai'],
  CopyButton: ['developer'],
  Kbd: ['developer'],
  ShortcutRecorder: ['developer', 'settings'],
  Terminal: ['developer'],
  DiffView: ['developer'],
  DiffSummary: ['developer'],
  TreeView: ['developer', 'navigation'],
  TypingIndicator: ['ai'],
  MentionInput: ['ai', 'forms'],
  Typewriter: ['ai'],
  TextReveal: ['ai'],
  Skeleton: ['ai', 'data'],
  RateLimitMeter: ['ai', 'developer', 'billing'],
  RetryQueue: ['ai', 'developer'],
  FeedbackWidget: ['ai', 'feedback'],
  ReactionBar: ['ai', 'feedback'],
  UsageMeter: ['ai'],
  CoachTour: ['onboarding'],
  Spotlight: ['onboarding'],
  EmptyState: ['onboarding'],
  Rating: ['commerce', 'feedback'],
  Carousel: ['commerce', 'marketing'],
  ImageCompare: ['commerce', 'marketing'],
  Lightbox: ['commerce'],
  Figure: ['commerce'],
  NumberInput: ['commerce'],
  AmountField: ['commerce', 'billing'],
  QRCode: ['commerce'],
  CheckoutSummary: ['commerce'],
  PaymentMethodCard: ['commerce'],
  Countdown: ['commerce', 'marketing'],
  Badge: ['marketing'],
  Avatar: ['team'],
  AvatarGroup: ['team', 'collaboration'],
  KanbanBoard: ['workflow'],
  Timeline: ['workflow'],
  ActivityFeed: ['notifications', 'team'],
  DescriptionList: ['settings'],
}

/** Blocks have no section, so their tags are written out once, here. */
export const BLOCK_TAGS: Record<string, TagId[]> = {
  login: ['authentication', 'forms'],
  signup: ['authentication', 'onboarding', 'forms'],
  authentication: ['authentication', 'security'],
  admin: ['tables', 'team', 'settings', 'analytics', 'workflow'],
  dashboard: ['analytics', 'charts', 'tables', 'navigation'],
  settings: ['settings', 'notifications', 'forms'],
  profile: ['data', 'team'],
  featured: ['marketing'],
  'saas-landing': ['marketing', 'billing'],
  'saas-dashboard': ['onboarding', 'analytics', 'navigation', 'billing'],
  'saas-admin': ['settings', 'team', 'billing', 'security', 'developer'],
}

/**
 * Words people type that are not the tag's own name. Search reads a query word
 * through this table, so "login" finds everything tagged authentication —
 * PasswordInput, InputOTP, AuthCard — without any of them being called that.
 */
export const SEARCH_ALIASES: Record<string, TagId[]> = {
  login: ['authentication'],
  logon: ['authentication'],
  signin: ['authentication'],
  auth: ['authentication'],
  password: ['authentication'],
  signup: ['authentication', 'onboarding'],
  register: ['authentication', 'onboarding'],
  mfa: ['authentication', 'security'],
  payment: ['billing'],
  payments: ['billing'],
  subscription: ['billing'],
  subscriptions: ['billing'],
  invoice: ['billing'],
  invoices: ['billing'],
  pricing: ['billing'],
  checkout: ['commerce', 'billing'],
  shop: ['commerce'],
  store: ['commerce'],
  chart: ['charts'],
  graph: ['charts'],
  graphs: ['charts'],
  metrics: ['analytics'],
  kpi: ['analytics'],
  dashboard: ['analytics'],
  table: ['tables'],
  grid: ['tables'],
  modal: ['overlays'],
  dialog: ['overlays'],
  popup: ['overlays'],
  toast: ['notifications'],
  alert: ['notifications'],
  notification: ['notifications'],
  inbox: ['notifications'],
  wizard: ['onboarding'],
  tour: ['onboarding'],
  preferences: ['settings'],
  account: ['settings'],
  team: ['team'],
  members: ['team'],
  filter: ['search'],
  filters: ['search'],
  chat: ['chat', 'ai'],
  llm: ['ai'],
  animation: ['motion'],
  animations: ['motion'],
  landing: ['marketing'],
  hero: ['marketing'],
}

/** Human names for the tags that are shown as chips. */
export const TAG_LABELS: Record<TagId, string> = {
  ai: 'AI',
  commerce: 'E-commerce',
  developer: 'Developer',
  ...Object.fromEntries(NEEDS.map((need) => [need.id, need.label])),
}

export function tagLabel(tag: TagId): string {
  return TAG_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1)
}
