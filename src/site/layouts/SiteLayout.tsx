import { Suspense, memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches } from 'react-router-dom'
import { ChevronRight, Heart, Menu as MenuIcon } from 'lucide-react'
import { createStore, sessionStorageAdapter, useStoreValue } from '../lib/store'
import { AccentMenu } from '../components/AccentMenu'
import { Drawer, IconButton, SearchField, Surface, Text, cn } from 'citrine'
import { AccentPicker } from '../components/AccentPicker'
import { SearchPalette, SearchTrigger, useSearchPalette } from '../components/SearchPalette'
import { ThemeToggle } from '../components/ThemeToggle'
import { brand } from '../brand'
import { blocks } from '../data/blocks'
import { catalog, componentCount, isNewComponent, type CatalogEntry } from '../data/catalog'
import { NewBadge } from '../components/NewBadge'
import { groups } from '../data/groups'
import { SITE_PAGES, SITE_SECTIONS, type SitePage } from '../data/pages'
import { rememberVisit } from '../lib/history'
import { useSavedCount } from '../lib/saved'

/** What a route can ask of the shell, through its `handle`. */
export interface RouteHandle {
  /** Drop the docs sidebar and give the page the full width. */
  fullBleed?: boolean
}

/**
 * The docs shell: a sticky header on every page, plus a component sidebar on
 * the pages that need one.
 *
 * The landing page renders inside the same shell but without the sidebar, so
 * the header — and the accent picker in it — never reloads or jumps when
 * someone crosses from the pitch into the documentation.
 *
 * Everything this component hands its children is stable across navigation:
 * the callbacks are memoised and the header and sidebar are memo components,
 * so changing route re-renders the page and nothing beside it. Active links
 * still update, because each NavLink reads the router itself.
 */
export function SiteLayout() {
  const { pathname } = useLocation()
  const matches = useMatches()
  const [navOpen, setNavOpen] = useState(false)
  const { open: searchOpen, setOpen: setSearchOpen } = useSearchPalette()

  const isLanding = pathname === '/'
  const fullBleed = matches.some((match) => (match.handle as RouteHandle | undefined)?.fullBleed)

  useEffect(() => {
    setNavOpen(false)
    rememberVisit(pathname)
  }, [pathname])

  const openNav = useCallback(() => setNavOpen(true), [])
  const closeNav = useCallback(() => setNavOpen(false), [])
  const openSearch = useCallback(() => setSearchOpen(true), [setSearchOpen])
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-ink-inverse"
      >
        Skip to content
      </a>

      <SiteHeader
        onOpenNav={openNav}
        onOpenSearch={openSearch}
        navButton={isLanding ? 'none' : fullBleed ? 'always' : 'narrow'}
      />

      {isLanding ? (
        <main id="main">
          <Outlet />
        </main>
      ) : fullBleed ? (
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-6">
          <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>
            <Outlet />
          </Suspense>
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

      {!fullBleed && <SiteFooter />}

      <Drawer open={navOpen} onClose={closeNav} title="Navigation" side="left">
        <ComponentNav inDrawer />
      </Drawer>

      <SearchPalette open={searchOpen} onClose={closeSearch} />
    </div>
  )
}

/* ------------------------------------------------------------------ header */

/**
 * Header links, in priority order, each with the width it earns a place from.
 *
 * Seven links and the search do not fit a tablet, and `nowrap` alone just moved
 * the overflow off the right edge. The paths a newcomer needs first stay at
 * every width; the rest arrive as room does. Nothing is lost below that — the
 * sidebar, the footer and ⌘K all reach every page.
 */
const TOP_LINKS: { to: string; label: string; from: 'md' | 'lg' | 'xl' }[] = [
  { to: '/getting-started', label: 'Get started', from: 'md' },
  { to: '/components', label: 'Components', from: 'md' },
  { to: '/blocks', label: 'Blocks', from: 'md' },
  { to: '/templates', label: 'Templates', from: 'lg' },
  { to: '/composer', label: 'Composer', from: 'lg' },
  { to: '/foundations', label: 'Foundations', from: 'xl' },
  { to: '/agents', label: 'AI agents', from: 'xl' },
]

/** Static strings, so Tailwind can see every class it has to generate. */
const SHOW_FROM = {
  md: '',
  lg: 'hidden lg:inline-flex',
  xl: 'hidden xl:inline-flex',
} as const

const SiteHeader = memo(function SiteHeader({
  onOpenNav,
  onOpenSearch,
  navButton,
}: {
  onOpenNav: () => void
  onOpenSearch: () => void
  /** Where the drawer button shows: never, below lg (where the sidebar hides), or always. */
  navButton: 'none' | 'narrow' | 'always'
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--color-canvas)_82%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1400px] items-center gap-3 px-5 lg:px-8">
        {navButton !== 'none' && (
          <IconButton
            label="Open navigation"
            icon={MenuIcon}
            tone="muted"
            onClick={onOpenNav}
            className={navButton === 'narrow' ? 'lg:hidden' : undefined}
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

        {/* One track for the links, so they read as a single control with the
            current page raised out of it, rather than loose words between the
            logo and the tools. */}
        <nav
          aria-label="Sections"
          className="ml-2 hidden items-center gap-0.5 rounded-full border border-line bg-surface-muted/60 p-1 md:flex lg:ml-4"
        >
          {TOP_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  SHOW_FROM[link.from],
                  isActive
                    ? 'bg-surface text-ink shadow-[var(--shadow-tile)]'
                    : 'text-ink-soft hover:bg-surface/70 hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger onOpen={onOpenSearch} />
          {/* Between md and lg the section links take the room these need, so
              they step out there; the drawer and the footer still reach both. */}
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block md:hidden lg:block" />
          <SavedLink />
          <ThemeToggle className="hidden sm:flex md:hidden lg:flex" />
          <AccentMenu />
        </div>
      </div>
    </header>
  )
})

/** Saved, as an icon with its count — its own subscriber, so saving re-renders only this. */
function SavedLink() {
  const count = useSavedCount()
  return (
    <NavLink
      to="/saved"
      aria-label={count ? `Saved, ${count} favorites` : 'Saved'}
      className={({ isActive }) =>
        cn(
          'relative hidden size-9 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid md:hidden lg:grid',
          isActive ? 'border-line-strong bg-surface-muted text-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
        )
      }
    >
      <Heart size={15} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-accent-ink tabular-nums"
        >
          {count}
        </span>
      )}
    </NavLink>
  )
}

/* --------------------------------------------------------------- component nav */

/**
 * The nav tree, built once at module load.
 *
 * The catalogue and the groups are static, so grouping them was pure waste on
 * every navigation: twelve `catalog.filter` passes plus one per section, for a
 * result that can never differ.
 */
const NAV_TREE = groups.map((group) => ({
  group,
  count: catalog.filter((entry) => entry.group === group.id).length,
  /** Every page in the group, so it can tell when it holds the current one. */
  paths: new Set(catalog.filter((entry) => entry.group === group.id).map((entry) => `/components/${entry.slug}`)),
  sections: group.sections
    .map((section) => ({
      section,
      entries: catalog.filter((entry) => entry.group === group.id && entry.section === section),
    }))
    .filter(({ entries }) => entries.length > 0),
}))

const BLOCK_PATHS = new Set(blocks.map((block) => `/blocks/${block.slug}`))

/**
 * Which library groups are open, shared by the sidebar and the drawer and
 * kept for the session — so collapsing a group stays collapsed as you move
 * around, and a reload in the same tab does not throw it away.
 */
const openGroups = createStore<Record<string, boolean>>('nav-open', {}, {
  adapter: sessionStorageAdapter,
  parse: (raw) => (raw && typeof raw === 'object' ? (raw as Record<string, boolean>) : undefined),
})

/**
 * One collapsible library group.
 *
 * Collapsed groups render no links at all, which is most of what makes the
 * sidebar light: two hundred and fifty links become the dozen in the open
 * group. Each group reads the location itself, so the tree around it stays
 * memoised; when navigation lands in a closed group it opens, and after that
 * the reader's choice holds.
 */
const NavGroup = memo(function NavGroup({
  id,
  label,
  count,
  paths,
  allTo,
  children,
}: {
  id: string
  label: string
  count: number
  paths: ReadonlySet<string>
  allTo: string
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const active = paths.has(pathname)
  const stored = useStoreValue(openGroups, (state) => state[id])
  const open = stored ?? active
  const panelId = `nav-group-${id}`

  useEffect(() => {
    if (active) openGroups.set((state) => (state[id] ? state : { ...state, [id]: true }))
  }, [active, id])

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => openGroups.set((state) => ({ ...state, [id]: !open }))}
        className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronRight
          size={13}
          aria-hidden
          className={cn('shrink-0 text-ink-faint transition-transform motion-reduce:transition-none', open && 'rotate-90')}
        />
        <Text as="span" size="label" weight="bold" className="min-w-0 flex-1 truncate">
          {label}
        </Text>
        {active && !open && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-strong" />}
        <Text as="span" size="micro" weight="bold" tone="faint" tabular>
          {count}
        </Text>
      </button>
      {open && (
        <div id={panelId} className="mb-1 ml-[17px] flex flex-col border-l border-line pl-2">
          <NavLink
            to={allTo}
            end
            className="rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
          >
            All {label.toLowerCase()}
          </NavLink>
          {children}
        </div>
      )}
    </div>
  )
})

const BlockNavItem = memo(function BlockNavItem({ slug, name }: { slug: string; name: string }) {
  return (
    <NavLink
      to={`/blocks/${slug}`}
      className={({ isActive }) =>
        cn(
          'truncate rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors',
          isActive ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      {name}
    </NavLink>
  )
})

/**
 * The component index.
 *
 * It sits on its own panel rather than loose on the page, because 250-odd links
 * next to a document need an edge to be a column instead of a wall of text.
 * Filtering searches the site's pages too, then the components by name,
 * section and group, so "chart", "drag", "Overlays" and "composer" all find
 * something.
 *
 * Above the components, the site's own pages are grouped by what someone came
 * to do — explore, build, the design system, developer, and their own saved
 * things — so the new sections arrive as five short clusters rather than one
 * long list.
 *
 * Memoised, because it is a sibling of the page outlet: without this, changing
 * route re-rendered every link to produce identical markup. The active
 * highlight still tracks the URL, since each NavLink subscribes to the router
 * itself and context updates are not blocked by memo. The one thing in here
 * that changes with user action — the saved count — is its own small
 * subscriber, so saving a favourite re-renders a number and not the tree.
 */
const ComponentNav = memo(function ComponentNav({ inDrawer = false }: { inDrawer?: boolean }) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return null
    return {
      pages: SITE_PAGES.filter(
        (page) =>
          page.label.toLowerCase().includes(needle) ||
          page.keywords?.some((keyword) => keyword.includes(needle)),
      ),
      components: catalog.filter(
        (entry) =>
          entry.name.toLowerCase().includes(needle) ||
          entry.section.toLowerCase().includes(needle) ||
          entry.group.toLowerCase().includes(needle),
      ),
    }
  }, [query])

  const matchCount = matches ? matches.pages.length + matches.components.length : 0

  const body = (
    <>
      <SearchField
        value={query}
        onValueChange={setQuery}
        inputSize="sm"
        label="Filter navigation"
        placeholder="Filter pages and components"
      />

      <div className={cn('flex min-h-0 flex-col gap-4', !inDrawer && 'overflow-y-auto pr-1')}>
        {!matches &&
          SITE_SECTIONS.map((section) => (
            <nav key={section.id} aria-label={section.label} className="flex flex-col">
              <Text
                as="span"
                size="micro"
                weight="bold"
                tone="faint"
                className="px-2.5 pb-1 uppercase tracking-[0.14em]"
              >
                {section.label}
              </Text>
              {section.pages.map((page) => (
                <PageLink key={page.to} page={page} />
              ))}
            </nav>
          ))}

        {matches ? (
          <div className="flex flex-col gap-0.5">
            <GroupHeading count={matchCount}>{matchCount === 1 ? 'Match' : 'Matches'}</GroupHeading>
            {matchCount === 0 ? (
              <Text size="caption" tone="faint" className="px-2.5 py-2">
                Nothing matches “{query}”.
              </Text>
            ) : (
              <>
                {matches.pages.map((page) => (
                  <PageLink key={page.to} page={page} />
                ))}
                {matches.components.map((entry) => (
                  <NavItem key={entry.slug} entry={entry} />
                ))}
              </>
            )}
          </div>
        ) : (
          <nav aria-label="Library" className="flex flex-col gap-0.5">
            <Text as="span" size="micro" weight="bold" tone="faint" className="px-2.5 pb-1 uppercase tracking-[0.14em]">
              Library
            </Text>
            <NavGroup id="blocks" label="Blocks" count={blocks.length} paths={BLOCK_PATHS} allTo="/blocks">
              {blocks.map((block) => (
                <BlockNavItem key={block.slug} slug={block.slug} name={block.name} />
              ))}
            </NavGroup>
            {NAV_TREE.map(({ group, count, sections, paths }) => (
              <NavGroup
                key={group.id}
                id={group.slug}
                label={group.id}
                count={count}
                paths={paths}
                allTo={`/components?group=${group.slug}`}
              >
                {sections.map(({ section, entries }) => (
                  <div key={section} className="flex flex-col">
                    <Text size="caption" weight="medium" tone="faint" className="px-2.5 pb-1 pt-2">
                      {section}
                    </Text>
                    {entries.map((entry) => (
                      <NavItem key={entry.slug} entry={entry} />
                    ))}
                  </div>
                ))}
              </NavGroup>
            ))}
          </nav>
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
})

const PageLink = memo(function PageLink({ page }: { page: SitePage }) {
  return (
    <NavLink
      to={page.to}
      end={page.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[12.5px] font-semibold transition-colors',
          isActive ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      <page.icon size={15} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{page.label}</span>
      {page.to === '/saved' && <SavedCount />}
    </NavLink>
  )
})

/** Subscribes to the favourites count alone. */
function SavedCount() {
  const count = useSavedCount()
  if (count === 0) return null
  return (
    <Text as="span" size="micro" weight="bold" tone="faint" tabular>
      {count}
      <span className="sr-only"> favorites</span>
    </Text>
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

/** Memoised too: Hundreds of these mount at once, and `entry` never changes. */
const NavItem = memo(function NavItem({ entry }: { entry: CatalogEntry }) {
  return (
    <NavLink
      to={`/components/${entry.slug}`}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors',
          isActive
            ? 'bg-accent-soft text-ink'
            : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {isNewComponent(entry.name) && <NewBadge />}
    </NavLink>
  )
})

/* ------------------------------------------------------------------ footer */

/** Every page except the two the logo and the sidebar already make obvious. */
const RESOURCES = SITE_PAGES.filter((page) => page.to !== '/' && page.to !== '/saved')

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
              {brand.tagline} {componentCount} components, two runtime dependencies, and a theme
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {RESOURCES.map((page) => (
                <Link
                  key={page.to}
                  to={page.to}
                  className="text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                >
                  {page.label}
                </Link>
              ))}
            </div>
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
