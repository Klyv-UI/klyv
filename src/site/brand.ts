import { componentCountRounded } from './data/catalog'

/**
 * Everything about how the library presents itself, in one file.
 *
 * The name appears in the header, the page titles, the import snippets on
 * every component page and the terminal easter egg. Keeping it here means
 * renaming the library is one edit rather than a search across the site.
 */
export const brand = {
  name: 'Citrine',
  /** Used in code samples and the package name. */
  pkg: 'citrine',
  tagline: 'An accent-led React component library.',
  /**
   * One paragraph, for the landing hero and the meta description. The count is
   * derived, so the pitch cannot fall behind the catalogue.
   */
  pitch: `${componentCountRounded} components that take their entire personality from a single colour. Pick a hue and the whole set repaints — buttons, charts, focus rings, the page behind them.`,
} as const
