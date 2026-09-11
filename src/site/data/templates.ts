import { findBlock, type BlockEntry } from './blocks'

/**
 * Templates: starting points larger than a block.
 *
 * A template is a set of blocks that make a product together — a SaaS app is a
 * landing page, a sign-in, a dashboard and an admin area. Nothing here is a
 * new screen; every template is assembled from blocks that already exist and
 * can be taken with one CLI command, so a template can never show something
 * the library cannot actually produce.
 */
export interface TemplateEntry {
  slug: string
  name: string
  description: string
  /** Block slugs, in the order a person would build them. */
  blocks: string[]
  tags: string[]
  projectTypes: string[]
}

export const templates: TemplateEntry[] = [
  {
    slug: 'saas-starter',
    name: 'SaaS starter',
    description:
      'The whole shape of a subscription product: the marketing homepage, sign-up and sign-in with a two-factor step, the signed-in home, and the admin area with billing and security.',
    blocks: ['saas-landing', 'signup', 'login', 'authentication', 'saas-dashboard', 'saas-admin'],
    tags: ['authentication', 'billing', 'settings', 'onboarding', 'marketing', 'team'],
    projectTypes: ['saas'],
  },
  {
    slug: 'operations-console',
    name: 'Operations console',
    description:
      'An internal tool for a team that watches numbers and manages people: the live dashboard, the members table, account settings and a profile page.',
    blocks: ['dashboard', 'admin', 'settings', 'profile'],
    tags: ['analytics', 'tables', 'settings', 'team', 'navigation'],
    projectTypes: ['dashboard', 'internal'],
  },
  {
    slug: 'authentication-kit',
    name: 'Authentication kit',
    description: 'Sign-up with a password strength meter, sign-in with validation, and the six-digit step after it.',
    blocks: ['signup', 'login', 'authentication'],
    tags: ['authentication', 'forms', 'security', 'onboarding'],
    projectTypes: ['saas', 'internal', 'ecommerce', 'ai', 'devtool'],
  },
  {
    slug: 'marketing-site',
    name: 'Marketing site',
    description: 'A SaaS homepage end to end, plus a shorter featured landing section to reuse on campaign pages.',
    blocks: ['saas-landing', 'featured'],
    tags: ['marketing', 'billing'],
    projectTypes: ['marketing', 'saas'],
  },
]

export function findTemplate(slug: string | undefined): TemplateEntry | undefined {
  return templates.find((template) => template.slug === slug)
}

export function templateBlocks(template: TemplateEntry): BlockEntry[] {
  return template.blocks.map((slug) => findBlock(slug)).filter((block): block is BlockEntry => Boolean(block))
}

/** Every component the template's blocks use, once each, in first-use order. */
export function templateComponents(template: TemplateEntry): string[] {
  return [...new Set(templateBlocks(template).flatMap((block) => block.uses))]
}
