import { brand } from '../brand'

/**
 * How the library meets the rest of a stack.
 *
 * Only things with a real path are listed, and each status says exactly how
 * real it is:
 *
 *   official     shipped and exercised in this repository
 *   supported    works by design, with the path written out below, but not
 *                run against that tool in this repository
 *   community    maintained by someone else
 *   coming-soon  planned; nothing to set up yet
 *
 * Nothing is marked official for a service the library has no code for. The
 * payment and authentication entries are "supported" because the components
 * are built to take a provider's data and callbacks — not because there is an
 * SDK wrapper, and the text says so.
 */
export type IntegrationStatus = 'official' | 'supported' | 'community' | 'coming-soon'

export const INTEGRATION_STATUSES: { id: IntegrationStatus; label: string; meaning: string }[] = [
  { id: 'official', label: 'Official', meaning: 'Shipped and exercised in this repository.' },
  { id: 'supported', label: 'Supported', meaning: 'Works by design, with a written path; not run against it here.' },
  { id: 'community', label: 'Community', meaning: 'Maintained outside this project.' },
  { id: 'coming-soon', label: 'Coming soon', meaning: 'Planned. Nothing to set up yet.' },
]

export type IntegrationCategory = 'Frameworks' | 'Styling' | 'Icons' | 'AI tooling' | 'Authentication' | 'Payments'

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'Frameworks',
  'Styling',
  'Icons',
  'AI tooling',
  'Authentication',
  'Payments',
]

export interface IntegrationStep {
  title: string
  body?: string
  code?: string
  language?: string
}

export interface IntegrationEntry {
  slug: string
  name: string
  /** Letters for the monogram tile. The site ships no third-party logos. */
  monogram: string
  category: IntegrationCategory
  status: IntegrationStatus
  description: string
  /** Why the status is what it is — the evidence, in a sentence. */
  basis: string
  setup: IntegrationStep[]
  example?: { code: string; language: string }
  /** Where to read more. Routes on this site, or external URLs. */
  docs: { label: string; to?: string; href?: string }[]
  /** Components this integration is mostly about. */
  components?: string[]
  tags: string[]
}

const pkg = brand.pkg

export const integrations: IntegrationEntry[] = [
  {
    slug: 'react',
    name: 'React',
    monogram: 'Re',
    category: 'Frameworks',
    status: 'official',
    description: 'Every component is a React component. React and React DOM are peer dependencies, so the app brings its own.',
    basis: 'Peer dependency, ^18.3 or ^19, declared in package.json.',
    setup: [
      { title: 'Install', code: `npm install ${pkg}`, language: 'bash' },
      { title: 'Import the stylesheet once, at the entry', code: `import '${pkg}/styles.css'`, language: 'tsx' },
    ],
    example: {
      language: 'tsx',
      code: `import { Badge, Button } from '${pkg}'
import '${pkg}/styles.css'

export default function App() {
  return (
    <>
      <Button>Send</Button>
      <Badge>+10%</Badge>
    </>
  )
}`,
    },
    docs: [{ label: 'Get started', to: '/getting-started' }],
    tags: ['developer'],
  },
  {
    slug: 'nextjs',
    name: 'Next.js',
    monogram: 'N',
    category: 'Frameworks',
    status: 'supported',
    description:
      "Works with the App Router and React Server Components. Modules that need the client already carry 'use client'; the rest stay on the server.",
    basis:
      "The directives are derived from the code and verified on every build (scripts/client-directives.mjs --check). There is no Next.js app in this repository.",
    setup: [
      { title: 'Install', code: `npm install ${pkg}`, language: 'bash' },
      {
        title: 'Import the stylesheet in the root layout',
        code: `// app/layout.tsx
import '${pkg}/styles.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
        language: 'tsx',
      },
      {
        title: 'Use components from server components',
        body: "No wrapper is needed. A component that needs the browser is already a client module, so importing it from a server component creates the boundary for you.",
      },
    ],
    example: {
      language: 'tsx',
      code: `// app/page.tsx — a server component
import { Button, Surface, Text } from '${pkg}'

export default function Page() {
  return (
    <Surface variant="card" padding="lg">
      <Text size="title">Welcome back</Text>
      <Button>Continue</Button>
    </Surface>
  )
}`,
    },
    docs: [
      { label: 'Get started', to: '/getting-started' },
      { label: 'Next.js App Router docs', href: 'https://nextjs.org/docs/app' },
    ],
    tags: ['developer'],
  },
  {
    slug: 'vite',
    name: 'Vite',
    monogram: 'Vi',
    category: 'Frameworks',
    status: 'official',
    description: 'ESM only, one module per component with sideEffects declared, so Vite drops everything you do not import.',
    basis: 'This documentation site is a Vite app (vite.config.ts), importing the library by its package name.',
    setup: [
      { title: 'Create an app', code: 'npm create vite@latest my-app -- --template react-ts', language: 'bash' },
      { title: 'Install', code: `cd my-app && npm install ${pkg}`, language: 'bash' },
      {
        title: 'Import the stylesheet in main.tsx',
        code: `import '${pkg}/styles.css'`,
        language: 'tsx',
      },
    ],
    docs: [
      { label: 'Get started', to: '/getting-started' },
      { label: 'Vite guide', href: 'https://vite.dev/guide/' },
    ],
    tags: ['developer'],
  },
  {
    slug: 'tailwind',
    name: 'Tailwind CSS',
    monogram: 'Tw',
    category: 'Styling',
    status: 'official',
    description:
      'Optional. Without Tailwind, use the prebuilt stylesheet. With Tailwind v4, import the preset so the utilities are generated into your build instead of shipped twice.',
    basis: `The library and this site are built with Tailwind v4; ${pkg}/preset.css is a published export.`,
    setup: [
      {
        title: 'In your CSS entry',
        code: `@import 'tailwindcss';
@import '${pkg}/preset.css';`,
        language: 'css',
      },
      {
        title: 'Merge your own classes',
        body: 'className is merged last on every component, through the same cn helper the library uses, so your utility wins a conflict.',
        code: `import { cn } from '${pkg}'`,
        language: 'tsx',
      },
    ],
    docs: [
      { label: 'Get started', to: '/getting-started' },
      { label: 'Tokens', to: '/tokens' },
    ],
    tags: ['developer'],
  },
  {
    slug: 'css-variables',
    name: 'CSS variables',
    monogram: '--',
    category: 'Styling',
    status: 'official',
    description: 'Every colour, radius and shadow is a custom property. One call derives four accent values from a single colour and writes them to the document.',
    basis: 'The theme API (applyAccent, applyMode) is part of the public package, and this site runs on it.',
    setup: [
      { title: 'The tokens on their own', code: `@import '${pkg}/tokens.css';`, language: 'css' },
      {
        title: 'Repaint from one colour',
        code: `import { applyAccent, restoreAccent, saveAccent } from '${pkg}'

restoreAccent()        // on boot
applyAccent('#8b5cf6') // now
saveAccent('#8b5cf6')  // and next time`,
        language: 'ts',
      },
    ],
    docs: [
      { label: 'Tokens', to: '/tokens' },
      { label: 'Foundations', to: '/foundations' },
    ],
    tags: ['developer'],
  },
  {
    slug: 'design-tokens',
    name: 'Design Tokens (W3C)',
    monogram: '{}',
    category: 'Styling',
    status: 'official',
    description: 'The token set as W3C Design Tokens data, for Figma plugins, Style Dictionary or anything else that reads the format. Dark mode ships as a $modes entry.',
    basis: `Generated from the stylesheet by scripts/export-tokens.mjs and published as ${pkg}/tokens.json.`,
    setup: [{ title: 'Read it', code: `import tokens from '${pkg}/tokens.json'`, language: 'ts' }],
    docs: [{ label: 'Tokens', to: '/tokens' }],
    tags: ['developer'],
  },
  {
    slug: 'lucide',
    name: 'Lucide icons',
    monogram: 'Lu',
    category: 'Icons',
    status: 'supported',
    description: 'Icons are a structural type, not an import. Anything taking size, strokeWidth and className fits — Lucide, Phosphor, or your own SVG components.',
    basis: 'IconComponent matches LucideIcon structurally, and this site passes lucide-react icons to the library throughout.',
    setup: [
      { title: 'Install', code: 'npm install lucide-react', language: 'bash' },
      {
        title: 'Pass the component, not an element',
        code: `import { Bell } from 'lucide-react'
import { IconButton } from '${pkg}'

<IconButton icon={Bell} label="Notifications" />`,
        language: 'tsx',
      },
    ],
    docs: [{ label: 'Lucide', href: 'https://lucide.dev' }],
    components: ['IconButton', 'IconTile', 'EmptyState', 'StatCard'],
    tags: ['developer'],
  },
  {
    slug: 'mcp',
    name: 'MCP server',
    monogram: 'MCP',
    category: 'AI tooling',
    status: 'official',
    description:
      'A coding agent reads the real props, tokens, blocks and source over the Model Context Protocol instead of guessing them.',
    basis: `Shipped in the package as the "${pkg} mcp" command and exercised over real pipes by npm run test:mcp.`,
    setup: [
      { title: 'Claude Code', code: `claude mcp add ${pkg} -- npx -y ${pkg} mcp`, language: 'bash' },
      {
        title: 'Anything that reads mcp.json',
        code: `{ "mcpServers": { "${pkg}": { "command": "npx", "args": ["-y", "${pkg}", "mcp"] } } }`,
        language: 'json',
      },
    ],
    docs: [{ label: 'AI agents', to: '/agents' }],
    tags: ['ai', 'developer'],
  },
  {
    slug: 'agent-skill',
    name: 'Agent Skill',
    monogram: 'Sk',
    category: 'AI tooling',
    status: 'official',
    description: 'The same guidance as the MCP server, for harnesses that load skills: which component to reach for, the theming API and the house rules.',
    basis: 'Published in the package as skills/klyv/SKILL.md.',
    setup: [{ title: 'Point your harness at the skill file', code: `node_modules/${pkg}/skills/klyv/SKILL.md`, language: 'bash' }],
    docs: [{ label: 'AI agents', to: '/agents' }],
    tags: ['ai', 'developer'],
  },
  {
    slug: 'auth-providers',
    name: 'Auth providers',
    monogram: 'ID',
    category: 'Authentication',
    status: 'supported',
    description:
      'AuthCard renders provider buttons from data — a label, an optional mark and a click handler — so any provider whose sign-in starts from a function call fits.',
    basis: 'There is no SDK wrapper: the component takes callbacks, and your provider supplies them.',
    setup: [
      {
        title: 'Hand the card your providers',
        body: 'The library ships no logos; pass your own mark as the icon. Set loading on the one in flight.',
        code: `<AuthCard
  title="Sign in to Acme"
  providers={[
    { id: 'github', label: 'Continue with GitHub', onClick: () => signIn('github'), loading: pending === 'github' },
    { id: 'google', label: 'Continue with Google', onClick: () => signIn('google') },
  ]}
  error={error}
>
  {/* your email form, if you have one */}
</AuthCard>`,
        language: 'tsx',
      },
      {
        title: 'SSO for workspaces',
        body: 'SsoSetup walks an admin through SAML in the order it has to happen, and keeps enforcement locked until a test passes.',
      },
    ],
    docs: [
      { label: 'AuthCard', to: '/components/auth-card' },
      { label: 'Build a login flow', to: '/recipes/login-flow' },
    ],
    components: ['AuthCard', 'TwoFactorSetup', 'SsoSetup', 'SessionList'],
    tags: ['authentication', 'security'],
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    monogram: 'St',
    category: 'Payments',
    status: 'supported',
    description:
      'The billing components display what a payment provider stores and leave card entry to the provider. Stripe’s card fields map onto PaymentMethodCard one to one.',
    basis: 'There is no Stripe code in the library. Card entry is deliberately left to the provider’s own elements.',
    setup: [
      {
        title: 'Show the stored card',
        body: 'Fetch the customer’s payment method on your server and pass its card fields through.',
        code: `<PaymentMethodCard
  brand={pm.card.brand}
  last4={pm.card.last4}
  expMonth={pm.card.exp_month}
  expYear={pm.card.exp_year}
  isDefault={pm.id === customer.invoice_settings.default_payment_method}
  onRemove={() => detach(pm.id)}
/>`,
        language: 'tsx',
      },
      {
        title: 'Summarise before charging',
        body: 'CheckoutSummary totals the lines, applies tax after discounts and validates promo codes through your own function — call your server from onApplyPromo.',
        code: `<CheckoutSummary
  lines={[{ id: 'pro', label: 'Pro plan', description: '10 seats, billed monthly', amount: 490 }]}
  taxRate={0.2}
  onApplyPromo={validateCode}
  action={<Button fullWidth>Confirm and pay</Button>}
/>`,
        language: 'tsx',
      },
    ],
    docs: [
      { label: 'Build a billing page', to: '/recipes/billing-page' },
      { label: 'Stripe payment methods', href: 'https://docs.stripe.com/api/payment_methods' },
    ],
    components: ['PaymentMethodCard', 'CheckoutSummary', 'InvoiceList', 'PlanSummary'],
    tags: ['billing', 'commerce'],
  },
]

export function findIntegration(slug: string | undefined): IntegrationEntry | undefined {
  return integrations.find((integration) => integration.slug === slug)
}

export function integrationStatusLabel(status: IntegrationStatus): string {
  return INTEGRATION_STATUSES.find((entry) => entry.id === status)?.label ?? status
}
