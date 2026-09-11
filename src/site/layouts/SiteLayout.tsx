import { Suspense, memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router-dom'
import { PageSkeleton } from '../components/PageSkeleton'
import { RouteProgress } from '../components/RouteProgress'
import { ChevronRight, Heart, Menu as MenuIcon } from 'lucide-react'
import { createStore, sessionStorageAdapter, useStoreValue } from '../lib/store'
import { AccentMenu } from '../components/AccentMenu'
import { PlatformLinks } from '../components/PlatformLinks'
import { Drawer, IconButton, SearchField, Text, cn } from 'citrine'
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
      <RouteProgress />
      {/* New pages open at the top; Back and Forward return to where you were. */}
      <ScrollRestoration />
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
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-[1400px] px-5 lg:px-8">
          {/* A full-height column on the page itself, set off by one hairline —
              the same way the header meets the page — rather than a card
              floating beside the content. It scrolls on its own. */}
          <div className="hidden w-[256px] shrink-0 border-r border-line lg:block">
            <div className="sticky top-[73px] flex h-[calc(100dvh-73px)] flex-col pb-2 pr-5 pt-6">
              <ComponentNav />
            </div>
          </div>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8 pb-24 lg:py-10 lg:pl-10">
            <Suspense fallback={<PageSkeleton />}>
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
          {/* From 1360px only: at xl the seven section links and the wide
              search already fill the row, and one more tool ran 6px over. */}
          <PlatformLinks only={['github']} className="hidden min-[1360px]:flex" />
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
        className={cn(
          'flex w-full items-center gap-2 rounded-[10px] px-3 py-[7px] text-left text-[13px] font-semibold transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open || active ? 'text-ink' : 'text-ink-soft hover:text-ink',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active && !open && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-strong" />}
        <span className="font-mono text-[10.5px] font-bold tabular-nums text-ink-faint">{count}</span>
        <ChevronRight
          size={14}
          aria-hidden
          className={cn('shrink-0 text-ink-faint transition-transform motion-reduce:transition-none', open && 'rotate-90')}
        />
      </button>
      {open && <NavTrail id={panelId} allTo={allTo}>{children}</NavTrail>}
    </div>
  )
})

/**
 * The indented list under an open group: a hairline guide on the left, which
 * the current item marks with an accent bar sitting on the line itself.
 */
function NavTrail({ id, allTo, children }: { id?: string; allTo?: string; children: ReactNode }) {
  return (
    <div id={id} className="mb-1.5 ml-[18px] flex flex-col border-l border-line py-1 pl-3">
      {allTo && (
        <NavLink
          to={allTo}
          end
          className="rounded-[8px] px-2 py-[5px] text-[12px] font-semibold text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          View all
        </NavLink>
      )}
      {children}
    </div>
  )
}

/** A leaf link inside a group. The accent bar lands on the trail's hairline. */
const leafClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group relative flex items-center gap-2 rounded-[8px] px-2 py-[5px] text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    isActive
      ? 'font-bold text-ink before:absolute before:inset-y-1 before:-left-[13.5px] before:w-[2px] before:rounded-full before:bg-accent-strong'
      : 'font-medium text-ink-soft hover:text-ink',
  )

const BlockNavItem = memo(function BlockNavItem({ slug, name }: { slug: string; name: string }) {
  return (
    <NavLink to={`/blocks/${slug}`} className={leafClass}>
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </NavLink>
  )
})

/**
 * The site navigation and the component index.
 *
 * It is a column of the page, set off by a hairline, with the site's pages
 * first and the library below as collapsible groups. Filtering searches the
 * site's pages too, then the components by name,
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

  const content = matches ? (
    <div className="flex flex-col">
      <NavLabel count={matchCount}>{matchCount === 1 ? 'Match' : 'Matches'}</NavLabel>
      {matchCount === 0 ? (
        <Text size="caption" tone="faint" className="px-3 py-2">
          Nothing matches “{query}”.
        </Text>
      ) : (
        <>
          {matches.pages.map((page) => (
            <PageLink key={page.to} page={page} />
          ))}
          {matches.components.length > 0 && (
            <NavTrail>
              {matches.components.map((entry) => (
                <NavItem key={entry.slug} entry={entry} />
              ))}
            </NavTrail>
          )}
        </>
      )}
    </div>
  ) : (
    <>
      {SITE_SECTIONS.map((section) => (
        <nav key={section.id} aria-label={section.label} className="flex flex-col gap-px">
          <NavLabel>{section.label}</NavLabel>
          {section.pages.map((page) => (
            <PageLink key={page.to} page={page} />
          ))}
        </nav>
      ))}

      <nav aria-label="Library" className="flex flex-col gap-px">
        <NavLabel>Library</NavLabel>
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
                <span className="px-2 pb-0.5 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  {section}
                </span>
                {entries.map((entry) => (
                  <NavItem key={entry.slug} entry={entry} />
                ))}
              </div>
            ))}
          </NavGroup>
        ))}
      </nav>
    </>
  )

  const filter = (
    <SearchField
      value={query}
      onValueChange={setQuery}
      inputSize="sm"
      label="Filter navigation"
      placeholder="Filter navigation"
    />
  )

  if (inDrawer) {
    return (
      <div className="flex flex-col gap-6">
        {filter}
        {content}
      </div>
    )
  }

  // The list scrolls inside the column and fades out at the foot, so the
  // last visible row reads as "more below" rather than as cut off. The
  // scrollbar itself is hidden — the fade does its job without the chrome —
  // but the column still scrolls by wheel, touch and keyboard.
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {filter}
      <div className="-mr-3 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-10 pr-3 [mask-image:linear-gradient(to_bottom,#000_calc(100%-40px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {content}
      </div>
    </div>
  )
})

/** A section label: the footer's small capitals, with an optional count. */
function NavLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 pb-1.5">
      <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.16em]">
        {children}
      </Text>
      {count !== undefined && (
        <span className="font-mono text-[10.5px] font-bold tabular-nums text-ink-faint">{count}</span>
      )}
    </div>
  )
}

const PageLink = memo(function PageLink({ page }: { page: SitePage }) {
  return (
    <NavLink
      to={page.to}
      end={page.end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-[10px] px-3 py-[7px] text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          // Raised out of the column the way the header raises the current
          // section out of its track.
          isActive
            ? 'bg-surface text-ink shadow-[var(--shadow-tile)] ring-1 ring-line'
            : 'text-ink-soft hover:bg-surface-muted/70 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <page.icon
            size={15}
            aria-hidden
            className={cn('shrink-0 transition-colors', isActive ? 'text-ink' : 'text-ink-faint group-hover:text-ink-soft')}
          />
          <span className="min-w-0 flex-1 truncate">{page.label}</span>
          {page.to === '/saved' && <SavedCount />}
        </>
      )}
    </NavLink>
  )
})

/** Subscribes to the favourites count alone. */
function SavedCount() {
  const count = useSavedCount()
  if (count === 0) return null
  return (
    <span className="rounded-full bg-surface-muted px-1.5 font-mono text-[10.5px] font-bold leading-[18px] tabular-nums text-ink-soft">
      {count}
      <span className="sr-only"> favorites</span>
    </span>
  )
}

/** Memoised too: Hundreds of these mount at once, and `entry` never changes. */
const NavItem = memo(function NavItem({ entry }: { entry: CatalogEntry }) {
  return (
    <NavLink to={`/components/${entry.slug}`} className={leafClass}>
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
            <PlatformLinks />
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
