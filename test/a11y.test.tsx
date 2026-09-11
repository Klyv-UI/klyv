import { Component, act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axe from 'axe-core'
import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import ComponentPage from '../src/site/pages/ComponentPage'
import LandingPage from '../src/site/pages/LandingPage'
import BlockPage from '../src/site/pages/BlockPage'
import { blocks } from '../src/site/data/blocks'
import { catalog } from '../src/site/data/catalog'

/**
 * Renders every component page — its examples, its API table, its source — and
 * audits the result with axe.
 *
 * Colour contrast is off here because jsdom does no layout and cannot know what
 * colour anything is; it is audited in the browser instead. `region` is off
 * because a page is rendered without the site shell that supplies landmarks.
 * Everything else axe knows about is on.
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

const findings: Finding[] = []
const crashes: { slug: string; error: string }[] = []

class Boundary extends Component<{ slug: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    crashes.push({ slug: this.props.slug, error: error.message.slice(0, 160) })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
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

describe('component pages pass axe', () => {
  it.each(catalog.map((entry) => entry.slug))('%s', async (slug) => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

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

    // Examples load lazily; wait until the page has its heading.
    await waitFor(() => !!container.querySelector('article h1'))

    // The Code section is the same viewer on every page — hundreds of spans of
    // source each time. It is audited once, as CodeBlock on its own page, rather
    // than once per page here, which is what made the suite take forty minutes.
    const codeSection = [...container.querySelectorAll('section')].find(
      (section) => section.querySelector('h2')?.textContent === 'Code',
    )
    const result = await axe.run(
      { include: [container], exclude: codeSection ? [codeSection] : [] },
      { rules: RULES },
    )
    for (const violation of result.violations) {
      findings.push({
        slug,
        rule: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
        target: String(violation.nodes[0]?.target ?? ''),
        why: (violation.nodes[0]?.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240),
      })
    }

    act(() => root.unmount())
    container.remove()
  })

  afterAll(() => {
    writeFileSync(
      'test/a11y-report.json',
      `${JSON.stringify({ crashes, findings }, null, 2)}\n`,
    )
  })
})

/**
 * The landing page, audited like the component pages are.
 *
 * It was never in this suite, which is how it shipped a button nested inside a
 * link. It renders the hero, the first live block and the component bento, so
 * it is also the one page where many components meet at once.
 */
describe('landing page passes axe', () => {
  it('landing', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <Boundary slug="landing">
          {/* Inside a main, as the site renders it — see the block suite. */}
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
    for (const violation of result.violations) {
      findings.push({
        slug: 'landing',
        rule: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
        target: String(violation.nodes[0]?.target ?? ''),
        why: (violation.nodes[0]?.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240),
      })
    }

    act(() => root.unmount())
    container.remove()
  }, 30000)
})

/**
 * Every block page, rendered inside a `main` the way the site renders it.
 *
 * The wrapper is the point. A block that brings its own AppShell is only wrong
 * when there is already a main landmark around it — and the docs always have
 * one. Without the wrapper this suite would pass a dashboard that nests one
 * main inside another, which is exactly what it did before blocks were added.
 */
describe('block pages pass axe', () => {
  it.each(blocks.map((block) => block.slug))(
    '%s',
    async (slug) => {
      const container = document.createElement('div')
      document.body.append(container)
      const root = createRoot(container)

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
      const codeSection = [...container.querySelectorAll('section')].find(
        (section) => section.querySelector('h2')?.textContent === 'Code',
      )
      const result = await axe.run(
        { include: [container], exclude: codeSection ? [codeSection] : [] },
        { rules: RULES },
      )
      for (const violation of result.violations) {
        findings.push({
          slug: `block:${slug}`,
          rule: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
          help: violation.help,
          target: String(violation.nodes[0]?.target ?? ''),
          why: (violation.nodes[0]?.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240),
        })
      }

      act(() => root.unmount())
      container.remove()
    },
    30000,
  )
})

describe('audit summary', () => {
  it('has no violations and no crashes', () => {
    // Runs after the per-page tests, so the report is complete.
    const summary = findings.map((f) => `${f.slug}: ${f.rule} (${f.impact}, ${f.nodes})`)
    expect({ crashes, violations: summary }).toEqual({ crashes: [], violations: [] })
  })
})
