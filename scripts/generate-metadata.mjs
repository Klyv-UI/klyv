// Reads the component tree and writes the dependency graph the docs site and
// the CLI both work from.
//
// It is generated rather than hand-maintained because it has to be exactly
// right: "Copy with dependencies" and `klyv add` both hand someone a set of
// files that must compile, and a stale edge means a broken paste.
//
// Run by `predev` and `prebuild`, so it cannot drift from the source.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')

const isComponentDir = (name) => /^[A-Z]/.test(name)

/** Every import specifier in a file, with the quotes stripped. */
function importsOf(source) {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
}

const components = {}
const aria = {}

// Only literals that name a real ARIA role count. `role={role}` passes a value
// through and names nothing, and a data field that happens to be called `role`
// (an approver's job title, say) is not an ARIA role at all.
const ARIA_ROLES = new Set(
  (
    'alert alertdialog application article banner button cell checkbox columnheader ' +
    'combobox complementary contentinfo definition dialog directory document feed figure ' +
    'form grid gridcell group heading img link list listbox listitem log main marquee math ' +
    'menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option ' +
    'presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search ' +
    'searchbox separator slider spinbutton status switch tab table tablist tabpanel term ' +
    'textbox timer toolbar tooltip tree treegrid treeitem'
  ).split(' '),
)

/** Roles a component renders, and whether it opens a modal layer. */
function rolesOf(source) {
  const found = []
  for (const match of source.matchAll(/\brole\s*=\s*"([a-z]+)"/g)) found.push(match[1])
  for (const match of source.matchAll(/\brole\s*:\s*'([a-z]+)'/g)) found.push(match[1])
  // role={open ? 'alertdialog' : 'dialog'} — every literal inside the braces.
  for (const match of source.matchAll(/\brole\s*=\s*\{([^}]*)\}/g)) {
    for (const literal of match[1].matchAll(/['"]([a-z]+)['"]/g)) found.push(literal[1])
  }
  const roles = new Set(found.filter((role) => ARIA_ROLES.has(role)))
  if (/aria-modal/.test(source)) roles.add('modal')
  return [...roles].sort()
}

for (const name of readdirSync(COMPONENTS).filter(isComponentDir)) {
  const dir = join(COMPONENTS, name)
  if (!statSync(dir).isDirectory()) continue

  const files = readdirSync(dir).filter((file) => /\.tsx?$/.test(file)).sort()
  const ownRoles = new Set()
  for (const file of files) {
    for (const role of rolesOf(readFileSync(join(dir, file), 'utf8'))) ownRoles.add(role)
  }
  if (ownRoles.size) aria[name] = [...ownRoles].sort()
  const internal = new Set()
  const shared = new Set()
  const external = new Set()

  for (const file of files) {
    for (const spec of importsOf(readFileSync(join(dir, file), 'utf8'))) {
      const sibling = spec.match(/^\.\.\/([A-Z][A-Za-z0-9]*)(?:\/|$)/)
      if (sibling) {
        internal.add(sibling[1])
      } else if (spec.startsWith('../../lib/')) {
        shared.add(`lib/${spec.slice('../../lib/'.length)}.ts`)
      } else if (spec.startsWith('../internal/')) {
        // Either extension: the icon set is .tsx, the WebGL helpers are .ts.
        const base = `components/internal/${spec.slice('../internal/'.length)}`
        shared.add(existsSync(join(ROOT, 'src', `${base}.tsx`)) ? `${base}.tsx` : `${base}.ts`)
      } else if (spec.startsWith('../../theme/')) {
        shared.add(`theme/${spec.slice('../../theme/'.length)}.ts`)
      } else if (!spec.startsWith('.')) {
        external.add(spec)
      }
    }
  }

  components[name] = {
    files: files.map((file) => `components/${name}/${file}`),
    internal: [...internal].sort(),
    shared: [...shared].sort(),
    external: [...external].sort(),
  }
}

// Shared modules pull in their own dependencies; `lib/motion` is imported by 16
// components and would otherwise arrive without whatever it needs. Resolved
// transitively, because `theme/mode` needs `theme/accent`, which needs
// `lib/contrast`, and a copy that stops one level down does not compile.
const sharedDeps = {}
const resolveShared = (from, spec) => {
  const base = join(dirname(from), spec).replaceAll('\\', '/')
  for (const ext of ['.ts', '.tsx']) {
    if (existsSync(join(ROOT, 'src', base + ext))) return base + ext
  }
  return null
}
const collectShared = (path) => {
  if (sharedDeps[path]) return sharedDeps[path]
  sharedDeps[path] = []
  const deps = new Set()
  for (const spec of importsOf(readFileSync(join(ROOT, 'src', path), 'utf8'))) {
    if (!spec.startsWith('.')) continue
    const resolved = resolveShared(path, spec)
    if (!resolved || (resolved.startsWith('components/') && !resolved.startsWith('components/internal/'))) continue
    deps.add(resolved)
    for (const nested of collectShared(resolved)) deps.add(nested)
  }
  deps.delete(path)
  return (sharedDeps[path] = [...deps].sort())
}
for (const entry of Object.values(components)) {
  for (const path of entry.shared) collectShared(path)
}

// The catalogue is the site's source of truth for what a component is *for*.
// Reading it here lets `klyv list drag` find the same things the site's
// search does, rather than matching names only.
const catalogSource = readFileSync(join(ROOT, 'src', 'site', 'data', 'catalog.ts'), 'utf8')
const catalog = {}
for (const match of catalogSource.matchAll(
  /\{ name: '([^']+)', slug: '([^']+)', group: '([^']+)', section: '([^']+)', blurb: '((?:[^'\\]|\\.)*)' \}/g,
)) {
  const [, name, slug, group, section, blurb] = match
  catalog[name] = { slug, group, section, blurb: blurb.replace(/\\'/g, "'") }
}

const names = Object.keys(components).sort()
const missing = names.flatMap((name) =>
  components[name].internal.filter((dep) => !components[dep]).map((dep) => `${name} -> ${dep}`),
)
if (missing.length) {
  console.error('unresolved component imports:\n  ' + missing.join('\n  '))
  process.exit(1)
}

const totalEdges = names.reduce((sum, name) => sum + components[name].internal.length, 0)

// ------------------------------------------------------------------ outputs
mkdirSync(join(ROOT, 'src', 'site', 'data'), { recursive: true })

const ts = `// GENERATED by scripts/generate-metadata.mjs - do not edit.
//
// Direct edges only; the transitive set is resolved by \`dependenciesOf\`. Kept
// as edges rather than closures so the file stays readable and small.

export interface ComponentDependencies {
  /** Files this component is made of, relative to the library root. */
  files: string[]
  /** Sibling components it imports. */
  internal: string[]
  /** Shared modules it imports, relative to the library root. */
  shared: string[]
  /** npm packages it imports. */
  external: string[]
}

export const dependencies: Record<string, ComponentDependencies> = ${JSON.stringify(
  Object.fromEntries(names.map((name) => [name, components[name]])),
  null,
  2,
)}

/** What each shared module itself needs. */
export const sharedDependencies: Record<string, string[]> = ${JSON.stringify(sharedDeps, null, 2)}

export interface ResolvedDependencies {
  /** Every component needed, including the one asked for, in copy order. */
  components: string[]
  /** Every shared module needed. */
  shared: string[]
  /** Every npm package needed. */
  external: string[]
  /** Every file to copy, in the order they should be written. */
  files: string[]
}

/**
 * The full set required to make one component compile somewhere else.
 *
 * Depth-first with the requested component last, so a concatenated paste reads
 * bottom-up: the things it is built from first, the thing you asked for at the
 * end.
 */
export function dependenciesOf(name: string): ResolvedDependencies {
  const seen = new Set<string>()
  const order: string[] = []

  const walk = (current: string) => {
    if (seen.has(current)) return
    seen.add(current)
    for (const dep of dependencies[current]?.internal ?? []) walk(dep)
    order.push(current)
  }
  walk(name)

  const shared = new Set<string>()
  const external = new Set<string>()
  for (const component of order) {
    const entry = dependencies[component]
    if (!entry) continue
    for (const path of entry.shared) {
      shared.add(path)
      for (const nested of sharedDependencies[path] ?? []) shared.add(nested)
    }
    for (const pkg of entry.external) external.add(pkg)
  }

  const sharedFiles = [...shared].sort()
  return {
    components: order,
    shared: sharedFiles,
    external: [...external].sort(),
    files: [...sharedFiles, ...order.flatMap((component) => dependencies[component].files)],
  }
}
`

writeFileSync(join(ROOT, 'src', 'site', 'data', 'dependencies.ts'), ts)

// The CLI and the MCP server read JSON, so neither needs a build step. Made
// before the first write into it, so a fresh clone without data/ still works.
mkdirSync(join(ROOT, 'data'), { recursive: true })

writeFileSync(join(ROOT, 'data', 'aria.json'), `${JSON.stringify(aria, null, 2)}
`)

writeFileSync(
  join(ROOT, 'src', 'site', 'data', 'aria.ts'),
  `// GENERATED by scripts/generate-metadata.mjs - do not edit.
//
// The ARIA roles each component renders itself, read off its source. Roles that
// arrive only through a child component are listed on that child, not here.

export const ariaRoles: Record<string, string[]> = ${JSON.stringify(
    Object.fromEntries(Object.keys(aria).sort().map((key) => [key, aria[key]])),
    null,
    2,
  )}
`,
)

writeFileSync(
  join(ROOT, 'data', 'components.json'),
  `${JSON.stringify({ components, shared: sharedDeps, catalog }, null, 2)}\n`,
)

console.log(
  `metadata: ${names.length} components, ${totalEdges} internal edges, ` +
    `${Object.keys(sharedDeps).length} shared modules, ${Object.keys(catalog).length} catalogued`,
)
