// Writes the files a crawler asks for, into public/ so the build serves them:
//
//   robots.txt      what may be crawled, and where the sitemap is
//   sitemap.xml     every page on the site, generated rather than hand-kept
//   llms.txt        the short version, for models that read a site before using it
//   llms-full.txt   every component with its blurb and props, in one file
//
// All four come from the same generated data the docs site, the CLI and the MCP
// server read, so none of them can describe a library that no longer exists.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const SITE = 'https://klyvui.xyz'

const read = (...path) => readFileSync(join(ROOT, ...path), 'utf8')
const json = (...path) => JSON.parse(read(...path))

const { catalog } = json('data', 'components.json')
const { blocks } = json('data', 'blocks.json')
const props = json('data', 'props.json')
const componentNames = Object.keys(catalog).sort()

/* --------------------------------------------------------------- the routes */

// The static paths, read off the router so a new page reaches the sitemap by
// existing rather than by being remembered here. Parameterised routes are
// expanded from the data below instead.
const app = read('src', 'site', 'App.tsx')
const staticRoutes = [...app.matchAll(/\bpath: '([^']*)'/g)]
  .map((match) => match[1])
  .filter((path) => !path.includes(':') && path !== '*')
  .map((path) => (path === '/' ? '/' : `/${path.replace(/^\//, '')}`))

// Pages behind a personal choice or a canvas have nothing to index.
const SKIP = new Set(['/saved', '/composer', '/playground', '/proving-ground'])

// `slug: '...'` off each data file, which is how each one is routed.
const slugsOf = (file) => [...new Set([...read('src', 'site', 'data', file).matchAll(/\bslug: '([^']+)'/g)].map((m) => m[1]))]
const versions = [...new Set([...read('src', 'site', 'data', 'changelog.ts').matchAll(/\bversion: '([^']+)'/g)].map((m) => m[1]))]
  .filter((version) => version !== 'unreleased')

const routes = [
  ...staticRoutes.filter((path) => !SKIP.has(path)),
  ...componentNames.map((name) => `/components/${catalog[name].slug}`),
  ...blocks.map((block) => `/blocks/${block.slug}`),
  ...slugsOf('templates.ts').map((slug) => `/templates/${slug}`),
  ...slugsOf('recipes.ts').map((slug) => `/recipes/${slug}`),
  ...slugsOf('integrations.ts').map((slug) => `/integrations/${slug}`),
  ...versions.map((version) => `/changelog/${version}`),
]

if (routes.length < 600) throw new Error(`generate-seo: only ${routes.length} routes — the data did not load`)

/* -------------------------------------------------------------- sitemap.xml */

// No lastmod: a date that is wrong is worse than no date, and nothing here
// tracks when a page's content last changed.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(routes)]
  .sort()
  .map((route) => `  <url><loc>${SITE}${route === '/' ? '/' : route}</loc></url>`)
  .join('\n')}
</urlset>
`

/* --------------------------------------------------------------- robots.txt */

const robots = `# https://klyvui.xyz
User-agent: *
Allow: /

# Nothing to index: a personal list kept in the browser, and a canvas that
# renders from a query string.
Disallow: /saved
Disallow: /composer

Sitemap: ${SITE}/sitemap.xml
`

/* ----------------------------------------------------------------- llms.txt */

const groups = {}
for (const name of componentNames) (groups[catalog[name].group] ??= []).push(name)

const llms = `# Klyv

> An accent-led React component library: ${componentNames.length} accessible React
> components and ${blocks.length} finished screens, published on npm as \`klyvui\`.
> Every component takes its colour from four CSS custom properties derived from
> one accent, so changing one colour restyles the whole set without a rebuild.

Install with \`npm install klyvui\`, then \`import { Button } from 'klyvui'\` and
\`import 'klyvui/styles.css'\`. The stylesheet is prebuilt: Tailwind is optional.
The only runtime dependencies are clsx and tailwind-merge; React 18.3 or 19 is a
peer dependency. Components can also be copied into a project with
\`npx klyvui add <component>\`, which brings everything that component imports.

## Docs

- [Getting started](${SITE}/getting-started): install, the stylesheet, the theme API
- [Components](${SITE}/components): all ${componentNames.length}, searchable by name or by job
- [Blocks](${SITE}/blocks): ${blocks.length} finished screens assembled from the library
- [Templates](${SITE}/templates) and [Recipes](${SITE}/recipes): products, and step-by-step guides
- [Tokens](${SITE}/tokens) and [Themes](${SITE}/themes): every token, and the theme builder
- [Foundations](${SITE}/foundations): the rules the tokens follow
- [Integrations](${SITE}/integrations): React, Next.js, Vite, Tailwind, MCP and more
- [Agents](${SITE}/agents): the MCP server and the Agent Skill

## Groups

${Object.keys(groups)
  .sort()
  .map((group) => `- ${group} (${groups[group].length}): ${groups[group].slice(0, 8).join(', ')}${groups[group].length > 8 ? ', …' : ''}`)
  .join('\n')}

## For agents

An MCP server ships with the package — \`npx -y klyvui mcp\` — serving component
search, props, source, blocks, tokens and the house rules. There is also an
Agent Skill at \`skills/klyv/SKILL.md\` inside the package.

## Optional

- [Every component in detail](${SITE}/llms-full.txt): each one's group, description and props
- [Changelog](${SITE}/changelog)
- [Source](https://github.com/Klyv-UI/klyv)
`

/* ------------------------------------------------------------ llms-full.txt */

const propsOf = (name) => {
  const entry = props[name]
  if (!entry?.props?.length) return '  props: none declared'
  return entry.props
    .map((prop) => `  - ${prop.name}${prop.required ? '*' : ''}: ${String(prop.type).replace(/\s+/g, ' ').slice(0, 120)}`)
    .join('\n')
}

const llmsFull = `# Klyv — every component

${componentNames.length} components, published as \`klyvui\`. A \`*\` marks a required
prop. Import any of them from 'klyvui'. Full docs: ${SITE}

${componentNames
  .map((name) => {
    const entry = catalog[name]
    return `## ${name}
${entry.blurb}
  group: ${entry.group} / ${entry.section}
  docs: ${SITE}/components/${entry.slug}
  copy: npx klyvui add ${entry.slug}
${propsOf(name)}`
  })
  .join('\n\n')}
`

mkdirSync(PUBLIC, { recursive: true })
for (const [file, contents] of [
  ['robots.txt', robots],
  ['sitemap.xml', sitemap],
  ['llms.txt', llms],
  ['llms-full.txt', llmsFull],
]) {
  writeFileSync(join(PUBLIC, file), contents)
}

const kB = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} kB`
console.log(
  `seo: ${[...new Set(routes)].length} urls in sitemap.xml; ` +
    `llms.txt ${kB(llms)}, llms-full.txt ${kB(llmsFull)}`,
)
