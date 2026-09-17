import { findBlock } from './blocks'
import { siteComponents } from './evidence'

/**
 * Built With: interfaces made from the library.
 *
 * There are no outside submissions yet, so every project here was built in
 * this repository and says so — `sample: true`, credited to the maintainers,
 * never to a company or a person. They are real in the sense that matters:
 * each one runs on the site, and its component list is read from what it
 * actually uses, not typed in to look impressive.
 *
 * The shape is what an API or CMS would return, so outside projects can be
 * added — or loaded — without the page changing.
 */
export type ShowcaseCategory = 'SaaS' | 'AI' | 'Dashboard' | 'Developer Tools' | 'Marketing' | 'E-commerce'

export const SHOWCASE_CATEGORIES: ShowcaseCategory[] = [
  'SaaS',
  'AI',
  'Dashboard',
  'Developer Tools',
  'Marketing',
  'E-commerce',
]

export type ShowcasePreview =
  | { kind: 'block'; slug: string }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'none' }

export interface ShowcaseProject {
  slug: string
  name: string
  description: string
  category: ShowcaseCategory
  /** Component names it uses. */
  components: string[]
  creator: { name: string; url?: string }
  /** The live project, when it is somewhere else. */
  url?: string
  /** The live project, when it is on this site. */
  to?: string
  tags: string[]
  preview: ShowcasePreview
  /** Built by the maintainers as a reference, not submitted by a user. */
  sample: boolean
}

const MAINTAINERS = { name: 'Klyv maintainers' }

function fromBlock(slug: string, category: ShowcaseCategory, tags: string[]): ShowcaseProject | undefined {
  const block = findBlock(slug)
  if (!block) return undefined
  return {
    slug: `block-${slug}`,
    name: block.name,
    description: block.blurb,
    category,
    components: block.uses,
    creator: MAINTAINERS,
    to: `/blocks/${slug}`,
    tags,
    preview: { kind: 'block', slug },
    sample: true,
  }
}

export const showcase: ShowcaseProject[] = [
  {
    slug: 'klyv-docs',
    name: 'This documentation site',
    description:
      'The site you are reading: the sidebar, search, catalogue, Composer and every page around the examples are built from the library they document.',
    category: 'Developer Tools',
    components: siteComponents,
    creator: MAINTAINERS,
    to: '/',
    tags: ['docs', 'search', 'navigation'],
    preview: { kind: 'none' },
    sample: true,
  },
  fromBlock('saas-dashboard', 'SaaS', ['onboarding', 'billing']),
  fromBlock('saas-admin', 'SaaS', ['settings', 'billing', 'security']),
  fromBlock('dashboard', 'Dashboard', ['analytics', 'tables']),
  fromBlock('admin', 'Dashboard', ['tables', 'team']),
  fromBlock('saas-landing', 'Marketing', ['marketing', 'pricing']),
].filter((project): project is ShowcaseProject => Boolean(project))
