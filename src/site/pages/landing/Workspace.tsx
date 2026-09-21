import { Link } from 'react-router-dom'
import { FolderOpen, Heart, WandSparkles } from 'lucide-react'
import { Button, JsonViewer, Reveal, Surface, Tag, Text } from 'klyv'
import { useSaved } from '../../lib/saved'
import { LandingSection } from './primitives'

/**
 * The personal side of the library: what you save is a document you own.
 *
 * The document on the right is live — it is this visitor's own saved state,
 * read from the same store the Saved page writes. Only when they have saved
 * nothing yet does it show an example, and it says which one it is showing.
 * Nothing here claims more than exists: there is no account and no sync, and
 * the copy says so.
 */
const POINTS = [
  {
    icon: FolderOpen,
    title: 'Collections are documents',
    body: 'File components, screens, templates, recipes and integrations into named collections — one per project, screen or client.',
  },
  {
    icon: WandSparkles,
    title: 'Compositions are documents',
    body: 'A Composer draft is a JSON composition: save it, return to it, copy it — or copy the code it becomes.',
  },
  {
    icon: Heart,
    title: 'Yours, and nobody else’s',
    body: 'No account, nothing sent anywhere. It lives in your browser and exports as one JSON document. Sync between devices is not available yet.',
  },
]

export function Workspace() {
  const state = useSaved()
  const yours = state.favorites.length > 0 || state.collections.length > 0
  const saved = yours
    ? {
        favorites: state.favorites,
        collections: state.collections.map((collection) => ({ name: collection.name, items: collection.items })),
      }
    : {
        favorites: ['component:data-table', 'block:login'],
        collections: [
          { name: 'SaaS dashboard', items: ['component:data-table', 'component:stat-card', 'block:saas-dashboard'] },
          { name: 'Authentication', items: ['block:login', 'block:signup', 'recipe:login-flow'] },
        ],
      }

  return (
    <LandingSection
      id="workspace"
      eyebrow="Your workspace"
      index={13}
      title="Keep what you use,"
      tail="as documents you own"
      lede="Favourites, collections and Composer drafts — a personal, document-based workspace that comes with Klyv. No account, no extra install, nothing to set up."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <Reveal className="flex flex-col gap-6">
          <ul className="flex flex-col">
            {POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-4 border-b border-line py-4 first:pt-0 last:border-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-glyph)] bg-accent-soft text-ink">
                  <point.icon size={16} aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                  <Text as="h3" size="heading" className="text-[16px] leading-snug">
                    {point.title}
                  </Text>
                  <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
                    {point.body}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button as={Link} to="/saved">
              Open your workspace
            </Button>
            <Button as={Link} to="/composer" variant="outline">
              Start a composition
            </Button>
          </div>
        </Reveal>

        <Reveal delay={80} className="flex min-w-0">
          <Surface variant="card" padding="lg" className="landing-card w-full gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text as="h3" size="heading">
                {yours ? 'Your saved items, as a document' : 'A saved-items document'}
              </Text>
              <Tag size="sm" tone={yours ? 'accent' : 'neutral'}>
                {yours ? 'Live — yours' : 'Example'}
              </Tag>
            </div>
            <JsonViewer label="Saved items document" data={saved} defaultExpandDepth={3} className="min-h-[260px]" />
            <Text size="caption" tone="faint" leading="normal">
              {yours
                ? 'Read from your browser as you look at it. Favourite something anywhere on the site and it appears here.'
                : 'Favourite anything on the site and this becomes your own document.'}
            </Text>
          </Surface>
        </Reveal>
      </div>
    </LandingSection>
  )
}
