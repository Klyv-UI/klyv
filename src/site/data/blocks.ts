/**
 * Blocks: whole screens rather than single components.
 *
 * A component page answers "what does this prop do". A block answers "what does
 * a real screen look like when it is built only from these parts" — so every
 * block here composes library components and nothing else. No block introduces
 * a colour, a radius or a spacing value of its own, which is the whole point:
 * if a production screen needs something the system does not have, that is a
 * gap in the system.
 */
export interface BlockEntry {
  slug: string
  name: string
  /** Sidebar and index grouping. */
  category: BlockCategory
  /** One line, for the index card and the page lede. */
  blurb: string
  /** What it is assembled from, shown on the page. */
  uses: string[]
  /** Give a block the full content width instead of the reading column. */
  wide?: boolean
}

export type BlockCategory = 'Authentication' | 'Application' | 'Marketing'

export const BLOCK_CATEGORIES: BlockCategory[] = ['Authentication', 'Application', 'Marketing']

export const blocks: BlockEntry[] = [
  {
    slug: 'login',
    name: 'Login',
    category: 'Authentication',
    blurb:
      'A sign-in screen with real validation, a pending state, and an error that is announced rather than just coloured red.',
    uses: ['Surface', 'Field', 'Input', 'PasswordInput', 'Checkbox', 'Button', 'Alert', 'Text'],
  },
  {
    slug: 'signup',
    name: 'Signup',
    category: 'Authentication',
    blurb:
      'Account creation with a live password strength meter and terms that must be accepted before the button will submit.',
    uses: ['Surface', 'Field', 'Input', 'PasswordInput', 'Meter', 'Checkbox', 'Button', 'Text'],
  },
  {
    slug: 'authentication',
    name: 'Two-factor',
    category: 'Authentication',
    blurb:
      'The six-digit step after a password: an OTP field that submits on completion, a resend timer, and a verified state.',
    uses: ['Surface', 'InputOTP', 'Button', 'Alert', 'SuccessMark', 'Text'],
  },
  {
    slug: 'dashboard',
    name: 'Dashboard',
    category: 'Application',
    blurb:
      'A freight operations console: live KPIs, a sortable consignment table with selection, volume and fleet charts, and a route event feed.',
    uses: [
      'AppShell',
      'Navbar',
      'Sidebar',
      'PageHeader',
      'StatCard',
      'AreaChart',
      'DonutChart',
      'DataTable',
      'Timeline',
      'Progress',
    ],
    wide: true,
  },
  {
    slug: 'settings',
    name: 'Settings',
    category: 'Application',
    blurb:
      'Tabbed account settings with real switches, a regional panel, and a save bar that sticks to the foot of the form.',
    uses: [
      'PageHeader',
      'Tabs',
      'Card',
      'Field',
      'Input',
      'Textarea',
      'Select',
      'Switch',
      'Button',
      'Alert',
    ],
    wide: true,
  },
  {
    slug: 'profile',
    name: 'Profile',
    category: 'Application',
    blurb:
      'A person page: identity, shift status, four measured figures, a definition list of facts, and a recent-activity timeline.',
    uses: ['Avatar', 'Badge', 'StatusDot', 'Metric', 'DescriptionList', 'Timeline', 'Card', 'Button'],
  },
  {
    slug: 'featured',
    name: 'Featured',
    category: 'Marketing',
    blurb:
      'A landing section — headline, feature grid, measured figures and a closing call to action — themed entirely by the accent.',
    uses: ['Badge', 'Text', 'Button', 'Surface', 'Metric'],
  },
]

export const blockCount = blocks.length

export function findBlock(slug: string | undefined): BlockEntry | undefined {
  return blocks.find((block) => block.slug === slug)
}

export function blocksInCategory(category: BlockCategory): BlockEntry[] {
  return blocks.filter((block) => block.category === category)
}
