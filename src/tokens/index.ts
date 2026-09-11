/**
 * Token *metadata* for tooling (the showcase's token viewer reads this).
 *
 * Deliberately stores only the CSS custom-property name — never a copied
 * value — so documentation can never drift from `styles/tokens.css`.
 * Consumers resolve live values with `resolveToken`.
 */
export interface TokenEntry {
  /** CSS custom property, e.g. `--color-accent`. */
  readonly cssVar: string
  /** Short human name shown in the viewer. */
  readonly name: string
  /** Where the dashboard uses it. */
  readonly usage: string
}

export interface TokenGroup {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly kind: 'color' | 'radius' | 'shadow' | 'typography' | 'spacing' | 'motion' | 'layer'
  readonly tokens: readonly TokenEntry[]
}

const t = (cssVar: string, name: string, usage: string): TokenEntry => ({ cssVar, name, usage })

export const tokenGroups: readonly TokenGroup[] = [
  {
    id: 'surfaces',
    title: 'Surfaces',
    description: 'Five stacked planes, from the page behind the window to the cards on top of it.',
    kind: 'color',
    tokens: [
      t('--color-canvas', 'canvas', 'Page behind the app window'),
      t('--color-shell', 'shell', 'The app window itself'),
      t('--color-app', 'app', 'Content area inside the window'),
      t('--color-surface', 'surface', 'Cards, nav track, floating menus'),
      t('--color-surface-muted', 'surface-muted', 'Inner fields, inactive icon tiles'),
      t('--color-surface-sunken', 'surface-sunken', 'Rate rows, list-row hover'),
    ],
  },
  {
    id: 'lines',
    title: 'Lines',
    description: 'Hairlines separating surfaces. `line-strong` is the hover/emphasis step.',
    kind: 'color',
    tokens: [
      t('--color-line', 'line', 'Card and tile borders'),
      t('--color-line-strong', 'line-strong', 'Border on hover, filled control hover'),
      t('--color-track', 'track', 'Unfilled meter pips'),
    ],
  },
  {
    id: 'text',
    title: 'Text',
    description: 'A three-step ink hierarchy carries every label in the dashboard.',
    kind: 'color',
    tokens: [
      t('--color-ink', 'ink', 'Primary text, values, headings'),
      t('--color-ink-soft', 'ink-soft', 'Secondary text, inactive nav'),
      t('--color-ink-faint', 'ink-faint', 'Captions, meta, placeholders'),
    ],
  },
  {
    id: 'accent',
    title: 'Accent & status',
    description: 'One accent hue does all the emphasis work; status colours are reserved.',
    kind: 'color',
    tokens: [
      t('--color-accent', 'accent', 'Logo, active pill, primary action, badges'),
      t('--color-accent-strong', 'accent-strong', 'Accent hover, filled meters, focus ring'),
      t('--color-accent-soft', 'accent-soft', 'Tinted accent backgrounds'),
      t('--color-accent-ink', 'accent-ink', 'Text on accent'),
      t('--color-success', 'success', 'Positive amounts'),
      t('--color-warning', 'warning', 'Warnings'),
      t('--color-danger', 'danger', 'Errors, destructive actions'),
    ],
  },
  {
    id: 'radius',
    title: 'Radius',
    description: 'Radius grows with the size of the container it wraps.',
    kind: 'radius',
    tokens: [
      t('--radius-glyph', 'glyph', 'Icon tiles, rate rows'),
      t('--radius-tile', 'tile', 'Inner tiles, dropdown menus'),
      t('--radius-field', 'field', 'Exchange amount fields'),
      t('--radius-card', 'card', 'Cards'),
      t('--radius-banner', 'banner', 'Hero banner'),
      t('--radius-window', 'window', 'The app window frame'),
    ],
  },
  {
    id: 'shadow',
    title: 'Elevation',
    description: 'Four elevations. Everything else is flat and separated by a hairline instead.',
    kind: 'shadow',
    tokens: [
      t('--shadow-tile', 'tile', 'Nav track, rail tiles, header cluster'),
      t('--shadow-card', 'card', 'Cards'),
      t('--shadow-float', 'float', 'Dropdowns, carousel chevrons, banner CTA'),
      t('--shadow-window', 'window', 'The floating app window'),
    ],
  },
  {
    id: 'motion',
    title: 'Motion',
    description:
      'The dashboard animates colour only. These mirror the default transition it relies on.',
    kind: 'motion',
    tokens: [
      t('--duration-fast', 'fast', 'Hover and focus colour transitions'),
      t('--duration-slow', 'slow', 'Drawer and disclosure transitions'),
    ],
  },
  {
    id: 'layers',
    title: 'Layers',
    description: 'The four stacking contexts the dashboard actually creates.',
    kind: 'layer',
    tokens: [
      t('--z-raised', 'raised', 'Swap button over the exchange fields'),
      t('--z-sticky', 'sticky', 'Carousel chevrons over the card band'),
      t('--z-popover', 'popover', 'Dropdown menus'),
      t('--z-overlay', 'overlay', 'Mobile drawer and backdrop'),
    ],
  },
]

/** Read a token's computed value from the document. Returns '' when unresolved. */
export function resolveToken(cssVar: string, element?: Element): string {
  if (typeof window === 'undefined') return ''
  const root = element ?? document.documentElement
  return getComputedStyle(root).getPropertyValue(cssVar).trim()
}
