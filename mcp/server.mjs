#!/usr/bin/env node
// Citrine's Model Context Protocol server.
//
// Gives an AI harness the same knowledge the documentation site has: what
// components exist and what each is for, every prop with its real type and
// default, the design tokens in both themes, the house rules, and each
// component's actual source with the files it depends on.
//
// Hand-written JSON-RPC over stdio rather than the MCP SDK, for one reason:
// this ships inside a library whose whole pitch is two runtime dependencies.
// The stdio transport is newline-delimited JSON-RPC 2.0, which is small enough
// to implement exactly.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data')

const read = (file) => JSON.parse(readFileSync(join(DATA, file), 'utf8'))

const meta = read('components.json')
const props = read('props.json')
const aria = read('aria.json')
const sizes = read('sizes.json')
const tokens = read('tokens.json')
const BLOCKS = read('blocks.json').blocks

const { components, shared, catalog } = meta
const NAMES = Object.keys(components).sort()
const BY_SLUG = Object.fromEntries(Object.entries(catalog).map(([name, e]) => [e.slug, name]))
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

/* ------------------------------------------------------------------ lookup */

/** "data-table", "DataTable" and "datatable" all name the same component. */
function resolveName(input = '') {
  if (components[input]) return input
  if (BY_SLUG[input]) return BY_SLUG[input]
  const flat = input.replace(/[-_\s]/g, '').toLowerCase()
  return NAMES.find((name) => name.toLowerCase() === flat) ?? null
}

/** Everything one component needs to compile elsewhere, depth first. */
function resolve(name) {
  const seen = new Set()
  const order = []
  const walk = (current) => {
    if (seen.has(current)) return
    seen.add(current)
    for (const dep of components[current]?.internal ?? []) walk(dep)
    order.push(current)
  }
  walk(name)

  const sharedFiles = new Set()
  const external = new Set()
  for (const component of order) {
    for (const path of components[component].shared) {
      sharedFiles.add(path)
      for (const nested of shared[path] ?? []) sharedFiles.add(nested)
    }
    for (const pkg of components[component].external) external.add(pkg)
  }
  return {
    components: order,
    shared: [...sharedFiles].sort(),
    external: [...external].sort(),
    files: [...sharedFiles, ...order.flatMap((c) => components[c].files)],
  }
}

function describe(name) {
  const entry = catalog[name] ?? {}
  const resolved = resolve(name)
  return {
    name,
    slug: entry.slug,
    group: entry.group,
    section: entry.section,
    summary: entry.blurb,
    import: `import { ${name} } from 'citrine'`,
    cli: entry.slug ? `npx citrine add ${entry.slug}` : undefined,
    props: props[name]?.props ?? [],
    inherits: props[name]?.inherits ?? [],
    ariaRoles: aria[name] ?? [],
    size: sizes.components?.[name],
    dependsOn: resolved.components.filter((c) => c !== name),
    sharedModules: resolved.shared,
    npmDependencies: resolved.external,
  }
}

function search(query = '', group) {
  const needle = query.trim().toLowerCase()
  return NAMES.filter((name) => {
    const entry = catalog[name]
    if (!entry) return false
    if (group && entry.group.toLowerCase() !== group.toLowerCase()) return false
    if (!needle) return true
    const fields = [name, entry.slug, entry.group, entry.section, entry.blurb]
    if (fields.some((field) => String(field).toLowerCase().includes(needle))) return true
    // "data table", "data-table" and "datatable" are one search.
    const flat = needle.replace(/[^a-z0-9]/g, '')
    return (
      flat.length > 2 &&
      fields.some((field) => String(field).toLowerCase().replace(/[^a-z0-9]/g, '').includes(flat))
    )
  }).map((name) => ({
    name,
    slug: catalog[name].slug,
    group: catalog[name].group,
    section: catalog[name].section,
    summary: catalog[name].blurb,
  }))
}

const RULES = `# Citrine design rules

## One accent drives everything
Nothing in the library names a colour. Every emphasis resolves to
\`--color-accent\` and three values derived from it: \`--color-accent-strong\`
(the same hue at a different lightness, for hover and press),
\`--color-accent-soft\` (a wash behind selected rows), and
\`--color-accent-ink\` (text sitting on the accent).

\`--color-accent-ink\` is chosen by contrast, not by a lightness threshold:
the tinted near-black where it reads, otherwise white, otherwise whichever of
pure black or white is stronger. Across 22,680 swept hues none falls below
4.5:1. Call \`applyAccent('#8b5cf6')\` to retheme everything at runtime.

## The rules every component obeys
1. No new tokens. Colour, radius, shadow and type come from one file. A
   component that needs a new value is a component that breaks the system.
2. Reduced motion is a real state, not the animation with the movement
   deleted — the still frame still has to say what the component means.
3. Every gesture has a key. Swipe, drag, hold and pinch each have a keyboard
   path and the ARIA pattern that makes them announceable.
4. No React render per animation frame. Animation writes to CSS custom
   properties or node styles inside one requestAnimationFrame.
5. Decoration is aria-hidden. Anything carrying no meaning is hidden from
   assistive technology rather than described to it.

## Surfaces stack, they do not tint
Six tokens, stacked: \`canvas\` (behind the window), \`shell\` (the window), \`app\`
(content area), \`surface\` (cards), \`surface-muted\` and \`surface-sunken\`
(nested fields and recessed rows). Depth comes from stack order and a
hairline, never from a heavy shadow.

## Text
Three ink steps, each clearing 4.5:1 on \`surface\`: \`ink\` (primary),
\`ink-soft\` (secondary), \`ink-faint\` (meta). \`ink-inverse\` is text on
\`ink\`, and flips with the theme.

## Dark mode
Only values change; every token keeps its name and its job. No component has a
dark variant or a \`dark:\` class. Set it with \`applyMode('dark' | 'light' |
'system')\`.

## Two ways to take a component
Install the package and import, or run \`npx citrine add <slug>\` to copy the
source — the folders are flat and the imports relative, so the copy compiles
with no rewriting.`

const USAGE = `# Using Citrine

\`\`\`bash
npm install citrine
\`\`\`

\`\`\`tsx
import { Button, DataTable, applyAccent } from 'citrine'
import 'citrine/styles.css'
\`\`\`

\`citrine/styles.css\` is prebuilt (~14.7 KB gzipped) and contains the tokens,
the base layer and exactly the utilities the library uses — Tailwind is not
required. If you already run Tailwind, import \`citrine/preset.css\` instead so
those utilities land in your build rather than shipping twice.

ESM only, one module per component with \`sideEffects\` declared, so bundlers
drop what you do not use. \`react\` and \`react-dom\` are peer dependencies; the
only runtime dependencies are \`clsx\` and \`tailwind-merge\`.

Icons are a structural type, not an import: any component taking \`size\`,
\`strokeWidth\` and \`className\` works, so bring your own set.

Server components: modules that can run on a server boundary do, and the rest
carry \`'use client'\`. Nothing to configure.

Whole screens are blocks: \`npx citrine add block dashboard\` copies one into
\`src/blocks\`, and the \`list_blocks\` and \`get_block\` tools return them with
their full source.`

/** 'dashboard', 'Dashboard', 'two-factor' and 'DashboardBlock' all find a block. */
function resolveBlock(input = '') {
  const flat = String(input).replace(/[-_\s]/g, '').toLowerCase()
  return BLOCKS.find((block) =>
    [block.slug, block.name, block.file.split('/').pop().replace(/\.tsx$/, '')].some(
      (key) => key.replace(/[-_\s]/g, '').toLowerCase() === flat,
    ),
  )
}

/* ------------------------------------------------------------------- tools */

export const TOOLS = [
  {
    name: 'search_components',
    description:
      'Find components by name, by group, or by what they do. Returns name, slug, group, section and a one-line summary. Start here when you know the job but not the name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text: a name, or what it is for ("drag", "chart", "empty state").' },
        group: { type: 'string', description: 'Optional group filter, e.g. "Forms & Inputs".' },
      },
    },
    run: ({ query, group }) => search(query, group),
  },
  {
    name: 'get_component',
    description:
      "Everything about one component: its summary, every prop with real type, default and description, the ARIA roles it renders, its gzipped size, and what it depends on. Accepts 'DataTable', 'data-table' or 'datatable'.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Component name or slug.' } },
      required: ['name'],
    },
    run: ({ name }) => {
      const resolved = resolveName(name)
      if (!resolved) return { error: `No component named "${name}".`, didYouMean: search(name).slice(0, 5) }
      return describe(resolved)
    },
  },
  {
    name: 'get_component_source',
    description:
      'The real source of a component. With withDependencies, also returns every sibling component and shared module it imports, in the order they should be written — which is exactly what `citrine add` copies.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Component name or slug.' },
        withDependencies: { type: 'boolean', description: 'Include everything it imports. Default false.' },
      },
      required: ['name'],
    },
    run: ({ name, withDependencies = false }) => {
      const resolved = resolveName(name)
      if (!resolved) return { error: `No component named "${name}".` }
      const paths = withDependencies
        ? resolve(resolved).files
        : components[resolved].files
      const files = paths
        .map((path) => {
          const full = join(ROOT, 'src', path)
          return existsSync(full) ? { path, source: readFileSync(full, 'utf8') } : null
        })
        .filter(Boolean)
      return {
        name: resolved,
        note: 'Imports are relative and the folders are flat: keep this layout and everything resolves unchanged.',
        files,
      }
    },
  },
  {
    name: 'list_blocks',
    description:
      'Whole screens built only from library components — sign-in, signup, two-factor, an admin panel, an operations dashboard, settings, a profile, a landing section. Reach for one when the job is a page rather than a part.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional: "Authentication", "Application" or "Marketing".' },
      },
    },
    run: ({ category }) =>
      BLOCKS.filter(
        (block) => !category || block.category.toLowerCase() === String(category).toLowerCase(),
      ).map((block) => ({
        slug: block.slug,
        name: block.name,
        category: block.category,
        summary: block.blurb,
        builtFrom: block.components.length,
        cli: `npx citrine add block ${block.slug}`,
      })),
  },
  {
    name: 'get_block',
    description:
      "One block in full: what it is for, every library component it uses, the npm packages it needs, and its complete source — a working screen to adapt rather than write from nothing. Accepts the slug or the name: 'dashboard', 'Dashboard', 'two-factor'.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Block slug or name.' } },
      required: ['name'],
    },
    run: ({ name }) => {
      const block = resolveBlock(name)
      if (!block) return { error: `No block named "${name}".`, blocks: BLOCKS.map((entry) => entry.slug) }
      const path = join(ROOT, block.file)
      return {
        slug: block.slug,
        name: block.name,
        category: block.category,
        summary: block.blurb,
        components: block.components,
        packages: block.packages,
        cli: `npx citrine add block ${block.slug}`,
        note: 'Imports come from the citrine package. If you copied components with `citrine add` instead of installing it, point the imports at those copies — the names are the same.',
        file: block.file,
        source: existsSync(path) ? readFileSync(path, 'utf8') : null,
      }
    },
  },
  {
    name: 'list_groups',
    description: 'The thirteen groups the library is organised by, with what each is for and how many components it holds.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const counts = {}
      for (const entry of Object.values(catalog)) counts[entry.group] = (counts[entry.group] ?? 0) + 1
      return Object.entries(counts).map(([group, count]) => ({ group, count }))
    },
  },
  {
    name: 'get_design_tokens',
    description:
      'The design tokens in W3C Design Tokens format: colour, radius, shadow and type, plus the dark-mode overrides. Use these values rather than inventing colours.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string', description: 'Optional: "color", "radius", "shadow" or "font".' } },
    },
    run: ({ group }) => (group ? { [group]: tokens[group], $modes: tokens.$modes } : tokens),
  },
  {
    name: 'get_design_rules',
    description:
      'How the design system works and the rules every component obeys: the accent derivation, the surface stack, the ink scale, dark mode, and the five house rules. Read this before writing UI with Citrine.',
    inputSchema: { type: 'object', properties: {} },
    run: () => RULES,
  },
  {
    name: 'how_to_install',
    description: 'Install and setup: the package, the stylesheet, Tailwind users, peer dependencies, icons, server components.',
    inputSchema: { type: 'object', properties: {} },
    run: () => USAGE,
  },
]

export const RESOURCES = [
  { uri: 'citrine://catalog', name: 'Component catalogue', description: 'Every component with its group, section and summary.', mimeType: 'application/json', read: () => JSON.stringify(search(''), null, 2) },
  { uri: 'citrine://blocks', name: 'Blocks', description: 'Every block — a whole screen — with the components it is built from.', mimeType: 'application/json', read: () => JSON.stringify(BLOCKS, null, 2) },
  { uri: 'citrine://tokens', name: 'Design tokens', description: 'Tokens in W3C Design Tokens format, including dark mode.', mimeType: 'application/json', read: () => JSON.stringify(tokens, null, 2) },
  { uri: 'citrine://rules', name: 'Design rules', description: 'The design system and the rules every component obeys.', mimeType: 'text/markdown', read: () => RULES },
  { uri: 'citrine://usage', name: 'Install and usage', description: 'How to install the package and set up the stylesheet.', mimeType: 'text/markdown', read: () => USAGE },
]

/* ------------------------------------------------------------------ server */

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

/** Tool results are text content; JSON is stringified so it survives intact. */
const asContent = (value) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

function handle(request) {
  const { id, method, params = {} } = request

  switch (method) {
    case 'initialize':
      return reply(id, {
        // Echo the client's version when it names one: the negotiated version
        // must be one both sides speak, and every client that connects here
        // has told us which it wants.
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'citrine', version: VERSION },
      })

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return // notifications take no reply

    case 'ping':
      return reply(id, {})

    case 'tools/list':
      return reply(
        id,
        { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      )

    case 'tools/call': {
      const tool = TOOLS.find((entry) => entry.name === params.name)
      if (!tool) return fail(id, -32602, `Unknown tool: ${params.name}`)
      try {
        return reply(id, asContent(tool.run(params.arguments ?? {})))
      } catch (error) {
        return reply(id, { ...asContent(`Error: ${error.message}`), isError: true })
      }
    }

    case 'resources/list':
      return reply(
        id,
        { resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })) },
      )

    case 'resources/read': {
      const resource = RESOURCES.find((entry) => entry.uri === params.uri)
      if (!resource) return fail(id, -32602, `Unknown resource: ${params.uri}`)
      return reply(id, { contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }] })
    }

    case 'prompts/list':
      return reply(id, { prompts: [] })

    default:
      if (id === undefined) return // an unknown notification is not an error
      return fail(id, -32601, `Method not found: ${method}`)
  }
}

// Listen only when run as a program. The docs generator imports this module to
// read its own tool definitions, and taking stdin there would hang the build.
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createInterface({ input: process.stdin }).on('line', (line) => {
    const text = line.trim()
    if (!text) return
    let request
    try {
      request = JSON.parse(text)
    } catch {
      return fail(null, -32700, 'Parse error')
    }
    try {
      handle(request)
    } catch (error) {
      if (request.id !== undefined) fail(request.id, -32603, error.message)
    }
  })
}
