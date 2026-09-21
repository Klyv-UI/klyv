import { catalog } from './catalog'
import { isNewComponent, isShowpiece } from './catalog'
import { groupOf } from './groups'
import { blocks } from './blocks'
import { templates } from './templates'
import { recipes } from './recipes'
import { integrations } from './integrations'
import { BLOCK_TAGS, COMPONENT_TAGS, SECTION_TAGS, type TagId } from './taxonomy'
import { statusOf, type ComponentStatus } from './health'

/**
 * One shape for everything a person can find, save or be recommended.
 *
 * Components, blocks, templates, recipes and integrations each keep their own
 * data file — they carry different details — but every feature that treats
 * them alike reads them through this index: search, Find My UI, favourites,
 * collections, the New marker and the recommendations. So a new block or
 * recipe reaches all of them by being added to its own file, and a feature
 * never needs to know how many kinds of thing there are.
 *
 * Built once at module load. It is a few hundred plain objects.
 */
export type LibraryItemType = 'component' | 'block' | 'template' | 'recipe' | 'integration'

export const ITEM_TYPES: { id: LibraryItemType; one: string; many: string }[] = [
  { id: 'component', one: 'Component', many: 'Components' },
  { id: 'block', one: 'Block', many: 'Blocks' },
  { id: 'template', one: 'Template', many: 'Templates' },
  { id: 'recipe', one: 'Recipe', many: 'Recipes' },
  { id: 'integration', one: 'Integration', many: 'Integrations' },
]

export function itemTypeLabel(type: LibraryItemType, plural = false): string {
  const entry = ITEM_TYPES.find((item) => item.id === type)
  return entry ? (plural ? entry.many : entry.one) : type
}

export interface LibraryItem {
  /** `${type}:${slug}` — stable, and what favourites and collections store. */
  id: string
  slug: string
  name: string
  type: LibraryItemType
  /** Group, block category, integration category — whatever it is filed under. */
  category: string
  description: string
  tags: TagId[]
  /**
   * The tags that say what this item is mainly about: a component's own tags
   * and its section's first. Search ranks a match on these above a match on a
   * tag it only inherits from its section.
   */
  primaryTags?: TagId[]
  /** Extra words search should match: slugs, sections, what it is built from. */
  keywords: string[]
  /** Where it lives on the site. */
  to: string
  /** Components only. See data/health.ts. */
  status?: ComponentStatus
  isNew?: boolean
  /** One of the showpieces — tagged instead of New. See SHOWPIECE_COMPONENTS. */
  isShowpiece?: boolean
  isFeatured?: boolean
  /** Templates and recipes name the kinds of product they suit outright. */
  projectTypes?: string[]
  /** Components it is built from or about. */
  uses?: string[]
}

/**
 * The handful surfaced before anyone has typed or chosen anything — the
 * components most screens need, and the largest worked examples.
 */
const FEATURED = new Set([
  'component:button',
  'component:input',
  'component:field',
  'component:card',
  'component:data-table',
  'component:modal',
  'component:command-palette',
  'component:toast',
  'block:saas-dashboard',
  'block:login',
  'template:saas-starter',
  'recipe:login-flow',
])

const unique = (values: string[]) => [...new Set(values)]

const componentItems: LibraryItem[] = catalog.map((entry) => {
  const group = groupOf(entry.group)
  const id = `component:${entry.slug}`
  return {
    id,
    slug: entry.slug,
    name: entry.name,
    type: 'component',
    category: entry.group,
    description: entry.blurb,
    tags: unique([...(SECTION_TAGS[entry.group]?.[entry.section] ?? []), ...(COMPONENT_TAGS[entry.name] ?? [])]),
    primaryTags: unique([...(SECTION_TAGS[entry.group]?.[entry.section] ?? []).slice(0, 1), ...(COMPONENT_TAGS[entry.name] ?? [])]),
    keywords: unique([
      entry.slug,
      entry.slug.replace(/-/g, ''),
      entry.slug.replace(/-/g, ' '),
      entry.section,
      entry.group,
      group.slug,
      ...(isShowpiece(entry.name) ? ['showpiece', 'wow', 'showcase'] : []),
    ]),
    to: `/components/${entry.slug}`,
    status: statusOf(entry.name),
    isNew: isNewComponent(entry.name),
    isShowpiece: isShowpiece(entry.name),
    isFeatured: FEATURED.has(id),
  }
})

const blockItems: LibraryItem[] = blocks.map((block) => {
  const id = `block:${block.slug}`
  return {
    id,
    slug: block.slug,
    name: block.name,
    type: 'block',
    category: block.category,
    description: block.blurb,
    tags: BLOCK_TAGS[block.slug] ?? [],
    keywords: unique([block.slug, block.category, 'block', 'screen', ...(block.keywords ?? []), ...block.uses]),
    to: `/blocks/${block.slug}`,
    isFeatured: FEATURED.has(id),
    uses: block.uses,
  }
})

const templateItems: LibraryItem[] = templates.map((template) => {
  const id = `template:${template.slug}`
  return {
    id,
    slug: template.slug,
    name: template.name,
    type: 'template',
    category: 'Template',
    description: template.description,
    tags: template.tags,
    keywords: unique([template.slug, 'template', 'starter', ...template.blocks]),
    to: `/templates/${template.slug}`,
    isFeatured: FEATURED.has(id),
    projectTypes: template.projectTypes,
  }
})

const recipeItems: LibraryItem[] = recipes.map((recipe) => {
  const id = `recipe:${recipe.slug}`
  return {
    id,
    slug: recipe.slug,
    name: recipe.title,
    type: 'recipe',
    category: 'Recipe',
    description: recipe.summary,
    tags: recipe.tags,
    keywords: unique([recipe.slug.replace(/-/g, ' '), 'recipe', 'guide', 'how to', ...recipe.components]),
    to: `/recipes/${recipe.slug}`,
    isFeatured: FEATURED.has(id),
    projectTypes: recipe.projectTypes,
    uses: recipe.components,
  }
})

const integrationItems: LibraryItem[] = integrations.map((integration) => ({
  id: `integration:${integration.slug}`,
  slug: integration.slug,
  name: integration.name,
  type: 'integration',
  category: integration.category,
  description: integration.description,
  tags: integration.tags,
  keywords: unique([integration.slug, integration.category, integration.status, 'integration', ...(integration.components ?? [])]),
  to: `/integrations/${integration.slug}`,
  uses: integration.components,
}))

export const libraryItems: LibraryItem[] = [
  ...componentItems,
  ...blockItems,
  ...templateItems,
  ...recipeItems,
  ...integrationItems,
]

const byId = new Map(libraryItems.map((item) => [item.id, item]))
const byPath = new Map(libraryItems.map((item) => [item.to, item]))

export function findItem(id: string): LibraryItem | undefined {
  return byId.get(id)
}

/** The item a route shows, if it shows one. */
export function itemAtPath(pathname: string): LibraryItem | undefined {
  return byPath.get(pathname)
}

export function itemsOfType(type: LibraryItemType): LibraryItem[] {
  return libraryItems.filter((item) => item.type === type)
}

if (import.meta.env?.DEV) {
  // A tag table keyed by a name that is not in the catalogue is a typo that
  // would otherwise fail silently — the component just never gets the tag.
  const names = new Set(catalog.map((entry) => entry.name))
  const unknown = Object.keys(COMPONENT_TAGS).filter((name) => !names.has(name))
  if (unknown.length) console.warn(`taxonomy: COMPONENT_TAGS names unknown components: ${unknown.join(', ')}`)
  const blockSlugs = new Set(blocks.map((block) => block.slug))
  const strayTemplates = templates.flatMap((t) => t.blocks.filter((slug) => !blockSlugs.has(slug)))
  if (strayTemplates.length) console.warn(`templates: unknown blocks ${strayTemplates.join(', ')}`)
}
