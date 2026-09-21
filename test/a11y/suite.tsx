import { Component, act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axe from 'axe-core'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import ComponentPage from '../../src/site/pages/ComponentPage'
import LandingPage from '../../src/site/pages/LandingPage'
import BlockPage from '../../src/site/pages/BlockPage'
import TemplatesPage from '../../src/site/pages/TemplatesPage'
import TemplatePage from '../../src/site/pages/TemplatePage'
import RecipesPage from '../../src/site/pages/RecipesPage'
import RecipePage from '../../src/site/pages/RecipePage'
import IntegrationsPage from '../../src/site/pages/IntegrationsPage'
import IntegrationPage from '../../src/site/pages/IntegrationPage'
import ChangelogPage from '../../src/site/pages/ChangelogPage'
import ReleasePage from '../../src/site/pages/ReleasePage'
import BuiltWithPage from '../../src/site/pages/BuiltWithPage'
import FindPage from '../../src/site/pages/FindPage'
import SavedPage from '../../src/site/pages/SavedPage'
import ThemesPage from '../../src/site/pages/ThemesPage'
import { blocks } from '../../src/site/data/blocks'
import { catalog } from '../../src/site/data/catalog'
import { SHARD_REPORTS, type ShardReport } from './report'

/**
 * Renders every component page — its examples, its API table, its source — and
 * audits the result with axe. So do the landing page, every block and the
 * platform pages.
 *
 * Colour contrast is off here because jsdom does no layout and cannot know what
 * colour anything is; it is audited in the browser instead. `region` is off
 * because a page is rendered without the site shell that supplies landmarks.
 * Everything else axe knows about is on.
 *
 * The pages are split across the shard-N.test.tsx files, because vitest runs
 * files in parallel but the tests in one file in sequence: as a single file,
 * all 641 pages went through one core, and took seven minutes in CI. Each shard
 * writes what it found; test/a11y/merge.ts joins them into test/a11y-report.json.
 */
const RULES = {
  'color-contrast': { enabled: false },
  region: { enabled: false },
}

interface Finding {
  slug: string
  rule: string
  impact: string | null | undefined
  nodes: number
  help: string
  /** The first offending element, and axe's explanation of it. */
  target: string
  why: string
}

/* ------------------------------------------------------------------ the pages */

/**
 * The platform pages — templates, recipes, integrations, the changelog, Built
 * With, Find My UI, Saved and Themes — rendered inside a main, as the site renders
 * them. The Composer is not here: its canvas is an iframe, which jsdom does
 * not lay out, so it is audited in the browser instead.
 */
const PLATFORM_PAGES: { url: string; path: string; Page: ComponentType }[] = [
  { url: '/templates', path: '/templates', Page: TemplatesPage },
  { url: '/templates/saas-starter', path: '/templates/:slug', Page: TemplatePage },
  { url: '/recipes', path: '/recipes', Page: RecipesPage },
  { url: '/recipes/login-flow', path: '/recipes/:slug', Page: RecipePage },
  { url: '/integrations', path: '/integrations', Page: IntegrationsPage },
  { url: '/integrations/stripe', path: '/integrations/:slug', Page: IntegrationPage },
  { url: '/changelog', path: '/changelog', Page: ChangelogPage },
  { url: '/changelog/1.0.0', path: '/changelog/:version', Page: ReleasePage },
  { url: '/built-with', path: '/built-with', Page: BuiltWithPage },
  { url: '/find', path: '/find', Page: FindPage },
  { url: '/find?type=saas&needs=billing,authentication&step=results', path: '/find', Page: FindPage },
  { url: '/saved', path: '/saved', Page: SavedPage },
  { url: '/themes', path: '/themes', Page: ThemesPage },
  { url: '/themes?theme=8b5cf6.zinc.lg.geist.elevated', path: '/themes', Page: ThemesPage },
]

interface Page {
  /** The name the test and the report use. */
  slug: string
  group: string
  audit: () => Promise<void>
  timeout?: number
}

/** Every audited page, in the order the report lists them. */
const PAGES: Page[] = [
  ...catalog.map((entry) => ({
    slug: entry.slug,
    group: 'component pages pass axe',
    audit: () => auditComponentPage(entry.slug),
  })),
  // Its own budget, and a large one: measured at ~200s under jsdom, against
  // under 10s for a typical page. It passes — it is slow, not stuck — but at
  // the shared 60s limit it failed on every run, and a hard-coded 30s here
  // left its container behind to fail the next test as well. The slowness
  // is worth finding; until then, a red suite teaches people to ignore it.
  { slug: 'landing', group: 'landing page passes axe', audit: auditLandingPage, timeout: 300_000 },
  ...blocks.map((block) => ({
    slug: `block:${block.slug}`,
    group: 'block pages pass axe',
    audit: () => auditBlockPage(block.slug),
  })),
  ...PLATFORM_PAGES.map((page) => ({
    slug: page.url,
    group: 'platform pages pass axe',
    audit: () => auditPlatformPage(page),
  })),
]

/* -------------------------------------------------------------- per shard */

let at = 0
let findings: (Finding & { at: number })[] = []
let crashes: { slug: string; error: string; at: number }[] = []

class Boundary extends Component<{ slug: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    crashes.push({ slug: this.props.slug, error: error.message.slice(0, 160), at })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Mounting, with cleanup that does not depend on the test reaching its own end.
 *
 * A test that times out never runs its last two lines, so its container stays
 * in the body — and a stray `main` left behind makes the *next* page's landmark
 * check fail for a fault it does not have. One slow page used to fail two
 * tests and blame the wrong one.
 */
const mounted: { root: Root; container: HTMLElement }[] = []

function mount() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  return { root, container }
}

async function waitFor(check: () => boolean, timeout = 8000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) return false
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
  }
  return true
}

function record(slug: string, violations: axe.Result[]) {
  for (const violation of violations) {
    findings.push({
      slug,
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      help: violation.help,
      target: String(violation.nodes[0]?.target ?? ''),
      why: (violation.nodes[0]?.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240),
      at,
    })
  }
}

/** The Code section of a docs page, if it has one. */
function codeSection(container: HTMLElement) {
  return [...container.querySelectorAll('section')].find(
    (section) => section.querySelector('h2')?.textContent === 'Code',
  )
}

async function auditComponentPage(slug: string) {
  const { root, container } = mount()

  await act(async () => {
    root.render(
      <Boundary slug={slug}>
        <MemoryRouter initialEntries={[`/components/${slug}`]}>
          <Routes>
            <Route path="/components/:slug" element={<ComponentPage />} />
          </Routes>
        </MemoryRouter>
      </Boundary>,
    )
  })

  // Examples load lazily, and so do the API table, the source and the
  // facts; wait for the heading and for every placeholder to be replaced.
  await waitFor(() => !!container.querySelector('article h1') && !container.querySelector('[data-doc-pending]'))

  // The Code section is the same viewer on every page — hundreds of spans of
  // source each time. It is audited once, as CodeBlock on its own page, rather
  // than once per page here, which is what made the suite take forty minutes.
  const code = codeSection(container)
  const result = await axe.run({ include: [container], exclude: code ? [code] : [] }, { rules: RULES })
  record(slug, result.violations)
}

/**
 * The landing page, audited like the component pages are.
 *
 * It was never in this suite, which is how it shipped a button nested inside a
 * link. It renders the hero, the first live block and the component bento, so
 * it is also the one page where many components meet at once.
 */
async function auditLandingPage() {
  const { root, container } = mount()

  await act(async () => {
    root.render(
      <Boundary slug="landing">
        {/* Inside a main, as the site renders it — see the block pages. */}
        <MemoryRouter initialEntries={['/']}>
          <main>
            <LandingPage />
          </main>
        </MemoryRouter>
      </Boundary>,
    )
  })

  // The first block in the showcase loads lazily. Audit the screen itself,
  // not the placeholder it replaces.
  await waitFor(() => !!container.querySelector('h1'))
  await waitFor(() => !container.querySelector('[aria-busy="true"]'))

  const result = await axe.run(container, { rules: RULES })
  record('landing', result.violations)
}

/**
 * Every block page, rendered inside a `main` the way the site renders it.
 *
 * The wrapper is the point. A block that brings its own AppShell is only wrong
 * when there is already a main landmark around it — and the docs always have
 * one. Without the wrapper this suite would pass a dashboard that nests one
 * main inside another, which is exactly what it did before blocks were added.
 */
async function auditBlockPage(slug: string) {
  const { root, container } = mount()

  await act(async () => {
    root.render(
      <Boundary slug={`block:${slug}`}>
        <MemoryRouter initialEntries={[`/blocks/${slug}`]}>
          <main>
            <Routes>
              <Route path="/blocks/:slug" element={<BlockPage />} />
            </Routes>
          </main>
        </MemoryRouter>
      </Boundary>,
    )
  })

  await waitFor(() => !!container.querySelector('article h1'))
  await waitFor(() => !container.querySelector('[aria-busy="true"]'))

  // Same reasoning as the component pages: the Code section is one viewer,
  // audited once on the CodeBlock page rather than on every block.
  const code = codeSection(container)
  const result = await axe.run({ include: [container], exclude: code ? [code] : [] }, { rules: RULES })
  record(`block:${slug}`, result.violations)
}

async function auditPlatformPage({ url, path, Page }: (typeof PLATFORM_PAGES)[number]) {
  const { root, container } = mount()

  await act(async () => {
    root.render(
      <Boundary slug={url}>
        <MemoryRouter initialEntries={[url]}>
          <main>
            <Routes>
              <Route path={path} element={<Page />} />
            </Routes>
          </main>
        </MemoryRouter>
      </Boundary>,
    )
  })

  await waitFor(() => !!container.querySelector('h1'))
  await waitFor(() => !container.querySelector('[aria-busy="true"]'))

  const result = await axe.run(container, { rules: RULES })
  record(url, result.violations)
}

/**
 * Audits every `count`th page, starting at `index`. Round-robin rather than in
 * blocks, so the slow pages — the landing page, the blocks — are spread out
 * instead of landing on one shard together.
 */
export function auditShard(index: number, count: number) {
  const mine = PAGES.map((page, position) => ({ ...page, position })).filter(
    (page) => page.position % count === index,
  )
  const audited = new Set<number>()

  afterEach(() => {
    for (const { root, container } of mounted.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
  })

  const groups = [...new Set(mine.map((page) => page.group))]
  for (const group of groups) {
    describe(group, () => {
      for (const page of mine.filter((candidate) => candidate.group === group)) {
        it(
          page.slug,
          async () => {
            at = page.position
            await page.audit()
            audited.add(page.position)
          },
          page.timeout,
        )
      }
    })
  }

  // After every page in the shard, whichever group it is in. The merge only
  // trusts a shard that audited every page it was given, so a filtered run
  // (`-t landing`) cannot overwrite the report with a fraction of it.
  afterAll(() => {
    const report: ShardReport = {
      index,
      count,
      total: PAGES.length,
      expected: mine.length,
      audited: audited.size,
      findings,
      crashes,
    }
    mkdirSync(SHARD_REPORTS, { recursive: true })
    writeFileSync(`${SHARD_REPORTS}/shard-${index + 1}.json`, `${JSON.stringify(report, null, 2)}\n`)
    findings = []
    crashes = []
  })

  describe('audit summary', () => {
    it('has no violations and no crashes', () => {
      // Runs after the shard's pages, so its findings are complete.
      const summary = findings.map((f) => `${f.slug}: ${f.rule} (${f.impact}, ${f.nodes})`)
      expect({ crashes: crashes.map(({ at: _, ...crash }) => crash), violations: summary }).toEqual({
        crashes: [],
        violations: [],
      })
    })
  })
}
