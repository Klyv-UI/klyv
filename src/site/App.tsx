import { useEffect, type ComponentType } from 'react'
import { Link, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router-dom'
import { Surface, Text } from 'klyvui'
import { BootScreen } from './components/BootScreen'
import { SiteLayout, type RouteHandle } from './layouts/SiteLayout'
import { findBlock } from './data/blocks'
import { findComponent } from './data/catalog'
import { preloadBlock } from './lib/blocks'
import { installPrefetch } from './lib/prefetch'

/**
 * Routes for the documentation site.
 *
 * Every page is its own chunk, loaded by the router rather than by a Suspense
 * boundary. The difference is what happens between pages: the router waits
 * for the next page's code before it commits the navigation, so the page you
 * are on stays on screen — under the progress bar — instead of the content
 * area going blank while the chunk downloads.
 *
 * The landing page still does not carry the catalogue, and the catalogue
 * does not carry any component's examples.
 */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

/** The Composer needs the whole width, so it drops the docs sidebar. */
const fullBleed: RouteHandle = { fullBleed: true }

/**
 * What the two detail pages load after they mount, warmed by the prefetcher
 * along with their chunk: a component's examples and API, and a block's
 * screen. The loaders are imported on demand, so none of their lookup tables
 * ride in the first page's bundle.
 */
const componentHandle: RouteHandle = {
  prefetch: ({ slug }) => {
    const entry = findComponent(slug)
    if (!entry) return undefined
    return Promise.all([
      import('./examples').then((module) => module.loadExamples(entry.slug)),
      import('./data/props').then((module) => module.loadProps(entry.name)),
    ])
  },
}
const blockHandle: RouteHandle = {
  prefetch: ({ slug }) => {
    const block = findBlock(slug)
    return block ? preloadBlock(block.file) : undefined
  },
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteLayout />,
    children: [
      { index: true, lazy: page(() => import('./pages/LandingPage')) },
      { path: 'components', lazy: page(() => import('./pages/ComponentsPage')) },
      { path: 'components/:slug', lazy: page(() => import('./pages/ComponentPage')), handle: componentHandle },
      { path: 'atlas', lazy: page(() => import('./pages/AtlasPage')), handle: fullBleed },
      { path: 'foundations', lazy: page(() => import('./pages/FoundationsPage')) },
      { path: 'tokens', lazy: page(() => import('./pages/TokensPage')) },
      { path: 'themes', lazy: page(() => import('./pages/ThemesPage')) },
      { path: 'playground', lazy: page(() => import('./pages/PlaygroundPage')) },
      { path: 'getting-started', lazy: page(() => import('./pages/GettingStartedPage')) },
      { path: 'blocks', lazy: page(() => import('./pages/BlocksPage')) },
      { path: 'blocks/:slug', lazy: page(() => import('./pages/BlockPage')), handle: blockHandle },
      { path: 'templates', lazy: page(() => import('./pages/TemplatesPage')) },
      { path: 'templates/:slug', lazy: page(() => import('./pages/TemplatePage')) },
      { path: 'recipes', lazy: page(() => import('./pages/RecipesPage')) },
      { path: 'recipes/:slug', lazy: page(() => import('./pages/RecipePage')) },
      { path: 'built-with', lazy: page(() => import('./pages/BuiltWithPage')) },
      { path: 'integrations', lazy: page(() => import('./pages/IntegrationsPage')) },
      { path: 'integrations/:slug', lazy: page(() => import('./pages/IntegrationPage')) },
      { path: 'changelog', lazy: page(() => import('./pages/ChangelogPage')) },
      { path: 'changelog/:version', lazy: page(() => import('./pages/ReleasePage')) },
      { path: 'find', lazy: page(() => import('./pages/FindPage')) },
      { path: 'saved', lazy: page(() => import('./pages/SavedPage')) },
      { path: 'composer', lazy: page(() => import('./pages/ComposerPage')), handle: fullBleed },
      { path: 'migrate', lazy: page(() => import('./pages/MigratePage')) },
      { path: 'proving-ground', lazy: page(() => import('./pages/ProvingGroundPage')) },
      { path: 'agents', lazy: page(() => import('./pages/AgentsPage')) },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function NotFound() {
  return (
    <Surface variant="card" padding="lg" className="items-start gap-2">
      <Text size="subtitle">Nothing here</Text>
      <Text size="body" weight="medium" tone="soft">
        That page does not exist.
      </Text>
      <Link to="/components" className="text-[13px] font-bold text-ink underline underline-offset-2">
        Browse the components
      </Link>
    </Surface>
  )
}

export function App() {
  // Pages start loading when a link is hovered, focused or touched, resolved
  // against this router's own routes. Installed once, outside every page, so
  // nothing in the shell re-renders for it.
  useEffect(() => installPrefetch(router.routes as RouteObject[]), [])

  // The boot screen covers the first page's download, continuing the splash
  // index.html painted before any script ran.
  return <RouterProvider router={router} fallbackElement={<BootScreen />} />
}
