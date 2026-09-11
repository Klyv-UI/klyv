import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Layers,
  LayoutGrid,
  Menu as MenuIcon,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { Drawer, IconButton, SearchField, Surface, Text, cn } from 'citrine'
import { AccentPicker } from '../components/AccentPicker'
import { SearchPalette, SearchTrigger, useSearchPalette } from '../components/SearchPalette'
import { ThemeToggle } from '../components/ThemeToggle'
import { brand } from '../brand'
import { catalog, componentCount, type CatalogEntry } from '../data/catalog'
import { groups } from '../data/groups'

/**
 * The docs shell: a sticky header on every page, plus a component sidebar on
 * the pages that need one.
 *
 * The landing page renders inside the same shell but without the sidebar, so
 * the header — and the accent picker in it — never reloads or jumps when
 * someone crosses from the pitch into the documentation.
 */
export function SiteLayout() {
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const search = useSearchPalette()

  const isLanding = pathname === '/'

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-ink-inverse"
      >
        Skip to content
      </a>

      <SiteHeader
        onOpenNav={() => setNavOpen(true)}
        onOpenSearch={() => search.setOpen(true)}
        showNavButton={!isLanding}
      />

      {isLanding ? (
        <main id="main">
          <Outlet />
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-[1400px] gap-10 px-5 lg:px-8">
          <div className="hidden w-[248px] shrink-0 lg:block">
            <div className="sticky top-[88px] py-8">
              <ComponentNav />
            </div>
          </div>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8 pb-24 lg:py-10">
            <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      )}

      <SiteFooter />

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} title="Components" side="left">
        <ComponentNav inDrawer />
      </Drawer>

      <SearchPalette open={search.open} onClose={() => search.setOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ header */

const TOP_LINKS = [
  { to: '/components', label: 'Components' },
  { to: '/foundations', label: 'Foundations' },
  { to: '/tokens', label: 'Tokens' },
  { to: '/playground', label: 'Playground' },
  { to: '/agents', label: 'AI agents' },
]

function SiteHeader({
  onOpenNav,
  onOpenSearch,
  showNavButton,
}: {
  onOpenNav: () => void
  onOpenSearch: () => void
  showNavButton: boolean
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--color-canvas)_82%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1400px] items-center gap-3 px-5 lg:px-8">
        {showNavButton && (
          <IconButton
            label="Open navigation"
            icon={MenuIcon}
            tone="muted"
            onClick={onOpenNav}
            className="lg:hidden"
          />
        )}

        <Link to="/" className="flex items-center gap-2.5 rounded-full">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-ink"
          >
            <span className="text-[15px] font-extrabold leading-none">C</span>
          </span>
          <span className="flex flex-col leading-none">
            <Text size="heading" weight="extrabold" className="tracking-[-0.02em]">
              {brand.name}
            </Text>
          </span>
        </Link>

        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {TOP_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
                  isActive ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <SearchTrigger onOpen={onOpenSearch} />
          <ThemeToggle />
          <AccentPicker compact className="hidden xl:flex" />
        </div>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------- component nav */

const DOC_LINKS = [
  { to: '/', label: 'Overview', icon: Sparkles, end: true },
  { to: '/foundations', label: 'Foundations', icon: Layers, end: false },
  { to: '/tokens', label: 'Design Tokens', icon: Palette, end: false },
  { to: '/components', label: 'All components', icon: LayoutGrid, end: true },
  { to: '/playground', label: 'Playground', icon: SlidersHorizontal, end: false },
]

/**
 * The component index.
 *
 * It sits on its own panel rather than loose on the page, because 238 links
 * next to a document need an edge to be a column instead of a wall of text.
 * Filtering searches the name, the section and the group, so "chart", "drag"
 * and "Overlays" all find something.
 */
function ComponentNav({ inDrawer = false }: { inDrawer?: boolean }) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return null
    return catalog.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        entry.section.toLowerCase().includes(needle) ||
        entry.group.toLowerCase().includes(needle),
    )
  }, [query])

  const body = (
    <>
      <SearchField
        value={query}
        onValueChange={setQuery}
        inputSize="sm"
        label="Search components"
        placeholder="Search components"
      />

      <div className={cn('flex min-h-0 flex-col gap-5', !inDrawer && 'overflow-y-auto pr-1')}>
        {!matches && (
          <div className="flex flex-col gap-0.5">
            {DOC_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-semibold transition-colors',
                    isActive
                      ? 'bg-surface-muted text-ink'
                      : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                  )
                }
              >
                <link.icon size={15} aria-hidden />
                {link.label}
              </NavLink>
            ))}
          </div>
        )}

        {matches ? (
          <div className="flex flex-col gap-0.5">
            <GroupHeading count={matches.length}>
              {matches.length === 1 ? 'Match' : 'Matches'}
            </GroupHeading>
            {matches.length === 0 ? (
              <Text size="caption" tone="faint" className="px-2.5 py-2">
                Nothing matches “{query}”.
              </Text>
            ) : (
              matches.map((entry) => <NavItem key={entry.slug} entry={entry} />)
            )}
          </div>
        ) : (
          groups.map((group) => {
            const entries = catalog.filter((entry) => entry.group === group.id)
            return (
              <div key={group.id} className="flex flex-col gap-0.5">
                <GroupHeading count={entries.length} to={`/components?group=${group.slug}`}>
                  {group.id}
                </GroupHeading>
                {group.sections.map((section) => (
                  <div key={section} className="flex flex-col">
                    <Text
                      size="caption"
                      weight="medium"
                      tone="faint"
                      className="px-2.5 pb-1 pt-2.5"
                    >
                      {section}
                    </Text>
                    {entries
                      .filter((entry) => entry.section === section)
                      .map((entry) => (
                        <NavItem key={entry.slug} entry={entry} />
                      ))}
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </>
  )

  if (inDrawer) return <div className="flex flex-col gap-4">{body}</div>

  return (
    <Surface
      variant="card"
      padding="sm"
      className="max-h-[calc(100dvh-104px)] gap-4 overflow-hidden"
    >
      {body}
    </Surface>
  )
}

function GroupHeading({
  children,
  count,
  to,
}: {
  children: ReactNode
  count: number
  to?: string
}) {
  const content = (
    <>
      <Text
        as="span"
        size="micro"
        weight="bold"
        tone="faint"
        className="uppercase tracking-[0.14em]"
      >
        {children}
      </Text>
      <Text as="span" size="micro" weight="bold" tone="faint" tabular>
        {count}
      </Text>
    </>
  )

  return (
    <div className="px-2.5 pb-1 pt-4">
      {to ? (
        <Link to={to} className="flex items-baseline justify-between gap-2 rounded-md group/head">
          {content}
        </Link>
      ) : (
        <div className="flex items-baseline justify-between gap-2">{content}</div>
      )}
    </div>
  )
}

function NavItem({ entry }: { entry: CatalogEntry }) {
  return (
    <NavLink
      to={`/components/${entry.slug}`}
      className={({ isActive }) =>
        cn(
          'truncate rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors',
          isActive
            ? 'bg-accent-soft text-ink'
            : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      {entry.name}
    </NavLink>
  )
}

/* ------------------------------------------------------------------ footer */

const RESOURCES = [
  { to: '/components', label: 'All components' },
  { to: '/foundations', label: 'Foundations' },
  { to: '/tokens', label: 'Tokens' },
  { to: '/playground', label: 'Playground' },
  { to: '/agents', label: 'For AI agents' },
]

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-14 lg:px-8">
        <div className="grid gap-10 pb-12 md:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" className="flex items-center gap-2.5 rounded-full">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-ink"
              >
                <span className="text-[15px] font-extrabold leading-none">C</span>
              </span>
              <Text size="heading" weight="extrabold" className="tracking-[-0.02em]">
                {brand.name}
              </Text>
            </Link>
            <Text size="caption" tone="soft" leading="normal" className="max-w-[42ch]">
              {brand.tagline} {componentCount} components, three runtime dependencies, and a theme
              that is one call wide.
            </Text>
            <div className="flex flex-wrap items-center gap-3">
              <AccentPicker compact />
              <ThemeToggle />
            </div>
          </div>

          <nav aria-label="Resources" className="flex flex-col gap-2.5">
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.16em]">
              Documentation
            </Text>
            {RESOURCES.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Groups" className="flex flex-col gap-2.5">
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.16em]">
              Groups
            </Text>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  to={`/components?group=${group.slug}`}
                  className="text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                >
                  {group.id}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-5">
          <Text size="caption" tone="faint">
            Built with the library it documents.
          </Text>
          <Text size="caption" tone="faint" tabular>
            {componentCount} components · v1.0
          </Text>
        </div>
      </div>

      {/* The wordmark, at the size a wordmark is meant to be read. It is clipped
          at the baseline so it reads as part of the page edge rather than as a
          heading, and it takes the accent like everything else. */}
      <div className="overflow-hidden px-5 lg:px-8" aria-hidden>
        <div className="mx-auto max-w-[1400px]">
          <span className="block translate-y-[0.14em] select-none bg-gradient-to-b from-ink to-[color-mix(in_oklab,var(--color-accent)_70%,var(--color-ink))] bg-clip-text text-[clamp(3.25rem,25.5vw,23rem)] font-extrabold leading-[0.78] tracking-[-0.06em] text-transparent">
            {brand.name}
          </span>
        </div>
      </div>
    </footer>
  )
}
