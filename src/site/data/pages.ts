import {
  ArrowLeftRight,
  Blocks,
  Bot,
  ChefHat,
  Compass,
  Heart,
  History,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Paintbrush,
  Palette,
  PanelsTopLeft,
  Plug,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { IconComponent } from 'klyv'

/**
 * The site's own map: every top-level page, grouped by what someone came to
 * do. The sidebar, the footer and search all read this list, so a new page is
 * one entry here rather than four hand-kept link arrays that drift.
 */
export interface SitePage {
  to: string
  label: string
  icon: IconComponent
  /** One line, for search results and cards. */
  description: string
  /** Match only the exact path when highlighting the nav. */
  end?: boolean
  keywords?: string[]
}

export interface SiteSection {
  id: string
  label: string
  pages: SitePage[]
}

export const SITE_SECTIONS: SiteSection[] = [
  {
    id: 'start',
    label: 'Start',
    pages: [
      { to: '/', label: 'Overview', icon: Sparkles, end: true, description: 'What the library is, with live components.', keywords: ['home', 'landing'] },
      { to: '/getting-started', label: 'Get started', icon: Rocket, description: 'Install, import the stylesheet, render something.', keywords: ['install', 'setup', 'npm'] },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    pages: [
      { to: '/components', label: 'All components', icon: LayoutGrid, end: true, description: 'The catalogue, filterable by group.', keywords: ['catalogue', 'catalog', 'library'] },
      { to: '/blocks', label: 'Blocks', icon: LayoutTemplate, end: true, description: 'Whole screens built only from the library.', keywords: ['screens', 'sections'] },
      { to: '/templates', label: 'Templates', icon: PanelsTopLeft, description: 'Sets of blocks that make a product together.', keywords: ['starter', 'kit'] },
      { to: '/recipes', label: 'Recipes', icon: ChefHat, description: 'How to build one common thing, step by step.', keywords: ['guide', 'how to', 'tutorial'] },
      { to: '/built-with', label: 'Built With', icon: Blocks, description: 'Interfaces made from the library.', keywords: ['showcase', 'examples', 'projects'] },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    pages: [
      { to: '/composer', label: 'Composer', icon: WandSparkles, description: 'Compose a screen from real components and copy the code.', keywords: ['builder', 'canvas', 'editor', 'visual'] },
      { to: '/playground', label: 'Playground', icon: SlidersHorizontal, description: 'Change props on live primitives side by side.', keywords: ['props', 'sandbox'] },
      { to: '/migrate', label: 'Migrate', icon: ArrowLeftRight, description: 'Paste a file from another library and get this one back.', keywords: ['shadcn', 'mui', 'chakra', 'convert', 'codemod', 'port', 'switch'] },
      { to: '/find', label: 'Find My UI', icon: Compass, description: 'Two questions, then what to use.', keywords: ['recommend', 'wizard', 'discover', 'quiz'] },
    ],
  },
  {
    id: 'system',
    label: 'Design system',
    pages: [
      { to: '/foundations', label: 'Foundations', icon: Layers, description: 'The six rules behind the tokens.', keywords: ['principles', 'rules'] },
      { to: '/tokens', label: 'Design Tokens', icon: Palette, description: 'Every colour, radius, shadow and type step.', keywords: ['colors', 'colours', 'theme', 'variables'] },
      { to: '/themes', label: 'Themes', icon: Paintbrush, description: 'Customise accent, base colour, radius, font and style, and copy the theme.', keywords: ['theme', 'customize', 'customise', 'customizer', 'presets', 'font', 'radius', 'base colour', 'color', 'style', 'dark mode'] },
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    pages: [
      { to: '/integrations', label: 'Integrations', icon: Plug, description: 'How the library fits the rest of a stack.', keywords: ['nextjs', 'tailwind', 'vite', 'stripe'] },
      { to: '/agents', label: 'AI agents', icon: Bot, description: 'MCP server and Agent Skill for coding agents.', keywords: ['mcp', 'claude', 'llm', 'skill'] },
      { to: '/changelog', label: 'Changelog', icon: History, description: 'What shipped, and when.', keywords: ['releases', 'versions', 'whats new'] },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    pages: [
      { to: '/saved', label: 'Saved', icon: Heart, description: 'Your favourites and collections, kept in this browser.', keywords: ['favorites', 'favourites', 'collections', 'bookmarks'] },
    ],
  },
]

export const SITE_PAGES: SitePage[] = SITE_SECTIONS.flatMap((section) => section.pages)

/**
 * Documentation sections worth landing on directly — the headings people
 * search for ("dark mode", "install") on pages that are not items themselves.
 */
export const DOC_ENTRIES: { label: string; to: string; page: string; keywords?: string[] }[] = [
  { label: 'Install', to: '/getting-started', page: 'Get started', keywords: ['npm', 'pnpm', 'yarn'] },
  { label: 'Import the stylesheet', to: '/getting-started', page: 'Get started', keywords: ['css', 'styles'] },
  { label: 'Pick your accent', to: '/getting-started', page: 'Get started', keywords: ['theme', 'colour', 'color', 'brand'] },
  { label: 'Dark mode', to: '/getting-started', page: 'Get started', keywords: ['theme', 'light', 'system'] },
  { label: 'Copy the source with the CLI', to: '/getting-started', page: 'Get started', keywords: ['cli', 'add', 'npx'] },
  { label: 'Server components', to: '/getting-started', page: 'Get started', keywords: ['rsc', 'use client', 'nextjs'] },
  { label: 'Connect the MCP server', to: '/agents', page: 'AI agents', keywords: ['mcp', 'claude code'] },
  { label: 'The Agent Skill', to: '/agents', page: 'AI agents', keywords: ['skill'] },
  { label: 'Surfaces stack, they do not tint', to: '/foundations', page: 'Foundations', keywords: ['surface', 'elevation'] },
  { label: 'Three inks, always in the same order', to: '/foundations', page: 'Foundations', keywords: ['text', 'contrast'] },
  { label: 'One accent, spent sparingly', to: '/foundations', page: 'Foundations', keywords: ['accent', 'colour'] },
  { label: 'Radius grows with the container', to: '/foundations', page: 'Foundations', keywords: ['radius', 'corners'] },
  { label: 'Interaction is a colour change', to: '/foundations', page: 'Foundations', keywords: ['hover', 'states'] },
  { label: 'Focus is global and visible', to: '/foundations', page: 'Foundations', keywords: ['focus', 'keyboard', 'accessibility', 'a11y'] },
  { label: 'Theme switcher', to: '/tokens#theme', page: 'Design Tokens', keywords: ['dark', 'light', 'accent'] },
  { label: 'Theme presets', to: '/themes', page: 'Themes', keywords: ['theme', 'preset', 'palette'] },
  { label: 'Change the font', to: '/themes', page: 'Themes', keywords: ['font', 'typeface', 'typography', 'google fonts'] },
  { label: 'Corner radius', to: '/themes', page: 'Themes', keywords: ['radius', 'rounded', 'corners', 'square'] },
  { label: 'Copy theme CSS', to: '/themes', page: 'Themes', keywords: ['themeToCss', 'css', 'export', 'applyTheme'] },
  { label: 'Share a theme link', to: '/themes', page: 'Themes', keywords: ['share', 'url', 'serializeTheme', 'link'] },
  { label: 'Accessibility, audited', to: '/foundations', page: 'Foundations', keywords: ['a11y', 'axe', 'screen reader', 'wcag'] },
]
