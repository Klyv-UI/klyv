/**
 * The thirteen groups the library is browsed by.
 *
 * They describe what a component *is for*, which is the only question a
 * visitor arrives with. An earlier build filed everything by what it depended
 * on — useful while building the library, useless to anyone reading it.
 */
export const GROUP_IDS = [
  'Foundations',
  'Layout',
  'Navigation',
  'Actions',
  'Forms & Inputs',
  'Data Display',
  'Charts',
  'Feedback',
  'Overlays',
  'Motion & Effects',
  'Interaction',
  'Canvas & Play',
  'SaaS',
] as const

export type GroupId = (typeof GROUP_IDS)[number]

export interface GroupDefinition {
  id: GroupId
  /** URL segment. */
  slug: string
  /** One line for the sidebar and the group card. */
  tagline: string
  /** Sub-headings, in the order they appear. */
  sections: string[]
}

export const groups: GroupDefinition[] = [
  {
    id: 'Foundations',
    slug: 'foundations',
    tagline: 'The type scale, the container recipes, and the handful of utilities everything else is built on.',
    sections: ['Primitives', 'Utilities'],
  },
  {
    id: 'Layout',
    slug: 'layout',
    tagline: 'Page structure, disclosure, and the stacks and rails that content scrolls through.',
    sections: ['Structure', 'Disclosure', 'Stacks & scrolling'],
  },
  {
    id: 'Navigation',
    slug: 'navigation',
    tagline: 'Shells, bars, tabs and menus — everything that moves a person between places.',
    sections: ['Bars & shells', 'Tabs & steps', 'Menus & search'],
  },
  {
    id: 'Actions',
    slug: 'actions',
    tagline: 'Buttons, and the richer controls built on top of them.',
    sections: ['Buttons', 'Composed'],
  },
  {
    id: 'Forms & Inputs',
    slug: 'forms',
    tagline: 'Every way of capturing a value, from a text field to a signature pad.',
    sections: ['Text fields', 'Choice', 'Numeric & range', 'Date & time', 'Rich input', 'Form structure'],
  },
  {
    id: 'Data Display',
    slug: 'data-display',
    tagline: 'Showing what the system knows: identities, lists, tables, metrics and records.',
    sections: ['Identity', 'Lists & tables', 'Metrics', 'Records', 'Media'],
  },
  {
    id: 'Charts',
    slug: 'charts',
    tagline: 'Plots, gauges and diagrams drawn with SVG and canvas. No charting dependency.',
    sections: ['Plots', 'Gauges & rings', 'Distribution', 'Flow & hierarchy', 'Time & activity', 'Chart parts'],
  },
  {
    id: 'Feedback',
    slug: 'feedback',
    tagline: 'Telling someone what happened, what is happening, and what went wrong.',
    sections: ['Status', 'Messages', 'Empty & error', 'System state', 'Celebration'],
  },
  {
    id: 'Overlays',
    slug: 'overlays',
    tagline: 'Layers above the page, with focus containment and dismissal handled once.',
    sections: ['Dialogs', 'Popovers', 'Guidance'],
  },
  {
    id: 'Motion & Effects',
    slug: 'motion',
    tagline: 'Entrances, kinetic type, light and surface treatments. Every one has a still, legible reduced-motion state.',
    sections: ['Entrance & scroll', 'Text', 'Surfaces & light', 'Numbers', 'Micro-interaction'],
  },
  {
    id: 'Interaction',
    slug: 'interaction',
    tagline: 'Pointer and touch patterns, live presence, and the flows that need a person to agree to something.',
    sections: ['Touch & drag', 'Presence & collaboration', 'Trust & workflow'],
  },
  {
    id: 'Canvas & Play',
    slug: 'canvas',
    tagline: 'Generative canvas, Web Audio, physics and toys — the parts that make a product feel made by people.',
    sections: ['Generative', 'Audio', 'Physics', 'Toys'],
  },
  {
    id: 'SaaS',
    slug: 'saas',
    tagline: 'The patterns every SaaS product rebuilds: the marketing site, pricing, auth, billing, the team, settings, security and the developer area.',
    sections: ['Marketing', 'Pricing', 'Auth & onboarding', 'Billing', 'Workspace', 'Settings & developer', 'Data & views', 'Engagement', 'Security'],
  },
]

const bySlug = new Map(groups.map((group) => [group.slug, group]))
const byId = new Map(groups.map((group) => [group.id, group]))

export function findGroupBySlug(slug: string | undefined): GroupDefinition | undefined {
  return slug ? bySlug.get(slug) : undefined
}

export function groupOf(id: GroupId): GroupDefinition {
  const group = byId.get(id)
  if (!group) throw new Error(`Unknown group: ${id}`)
  return group
}
