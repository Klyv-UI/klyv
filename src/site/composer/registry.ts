/**
 * Which components the Composer can place — names only.
 *
 * Kept apart from the definitions (which import every one of these and their
 * renderers) so a component page can ask "can I open this in the Composer?"
 * without pulling the Composer into its chunk. The definitions file is typed
 * against this list, so the two cannot disagree.
 */
export const COMPOSABLE = [
  // Layout
  'Column',
  'Row',
  'Card',
  'Surface',
  // Content
  'Text',
  'PageHeader',
  'SectionHeading',
  'Divider',
  'Badge',
  'Tag',
  'Chip',
  'Kbd',
  'Avatar',
  // Actions
  'Button',
  'CopyButton',
  // Forms
  'Field',
  'Input',
  'PasswordInput',
  'Textarea',
  'Checkbox',
  'Switch',
  'Rating',
  // Data
  'StatCard',
  'Metric',
  'Progress',
  'ProgressRing',
  'Meter',
  // Feedback
  'Alert',
  'Banner',
  'InlineMessage',
  'EmptyState',
  'Spinner',
  'StatusDot',
  'Skeleton',
] as const

export type ComposableName = (typeof COMPOSABLE)[number]

/** Layout helpers that are plain elements in the output, not library components. */
export const LAYOUT_ONLY: ReadonlySet<ComposableName> = new Set(['Column', 'Row'])

/** The ones that take other nodes as children. */
export const CONTAINERS: ReadonlySet<string> = new Set(['Column', 'Row', 'Card', 'Surface', 'Field'])

const names: ReadonlySet<string> = new Set(COMPOSABLE)

export function isComposable(name: string): name is ComposableName {
  return names.has(name) && !LAYOUT_ONLY.has(name as ComposableName)
}
