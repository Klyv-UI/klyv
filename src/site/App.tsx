import { Suspense, lazy } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Surface, Text } from 'citrine'
import { Link } from 'react-router-dom'
import { SiteLayout } from './layouts/SiteLayout'

/**
 * Routes for the documentation site.
 *
 * Everything below the layout is lazy, so the landing page does not carry the
 * catalogue, and the catalogue does not carry any component's examples.
 */
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ComponentsPage = lazy(() => import('./pages/ComponentsPage'))
const ComponentPage = lazy(() => import('./pages/ComponentPage'))
const FoundationsPage = lazy(() => import('./pages/FoundationsPage'))
const TokensPage = lazy(() => import('./pages/TokensPage'))
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'))
const AgentsPage = lazy(() => import('./pages/AgentsPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
            <LandingPage />
          </Suspense>
        ),
      },
      { path: 'components', element: <ComponentsPage /> },
      { path: 'components/:slug', element: <ComponentPage /> },
      { path: 'foundations', element: <FoundationsPage /> },
      { path: 'tokens', element: <TokensPage /> },
      { path: 'playground', element: <PlaygroundPage /> },
      { path: 'agents', element: <AgentsPage /> },
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
  return <RouterProvider router={router} />
}
