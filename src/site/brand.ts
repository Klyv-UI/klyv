import { componentCountRounded } from './data/catalog'

/**
 * Everything about how the library presents itself, in one file.
 *
 * The name appears in the header, the page titles, the import snippets on
 * every component page and the terminal easter egg. Keeping it here means
 * renaming the library is one edit rather than a search across the site.
 */
export const brand = {
  name: 'Klyv',
  /** Used in code samples and the package name. */
  pkg: 'klyvui',
  /** Where the docs site is served. */
  url: 'https://klyvui.xyz',
  tagline: 'An accent-led React component library.',
  /**
   * One paragraph, for the landing hero and the meta description. The count is
   * derived, so the pitch cannot fall behind the catalogue.
   */
  pitch: `${componentCountRounded} components that take their entire personality from a single colour. Pick a hue and the whole set repaints — buttons, charts, focus rings, the page behind them.`,
  /**
   * Where the project lives elsewhere. The header and footer both read this
   * list, so adding a place is one entry here — with an icon for its id in
   * components/PlatformLinks. Only accounts that exist belong in it: a link
   * to somewhere that is not there yet is worse than no link at all.
   */
  links: [
    { id: 'github', label: 'GitHub', href: 'https://github.com/Klyv-UI/klyv' },
    { id: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/klyvui' },
  ],
} as const
