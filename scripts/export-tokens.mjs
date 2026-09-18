// Exports the design tokens as W3C-format JSON, so a designer's tool or another
// codebase can consume the same values the components read at runtime.
//
// Parsed out of the stylesheet rather than duplicated in JS: there is one
// source of truth for a token and it is the CSS that ships.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')

/** The `@theme` block holds the design tokens; everything after it is plumbing. */
const theme = CSS.slice(CSS.indexOf('@theme {') + 8, CSS.indexOf('\n}', CSS.indexOf('@theme {')))

const GROUPS = [
  { prefix: '--color-', group: 'color', type: 'color' },
  { prefix: '--radius-', group: 'radius', type: 'dimension' },
  { prefix: '--shadow-', group: 'shadow', type: 'shadow' },
  { prefix: '--font-', group: 'font', type: 'fontFamily' },
]

/**
 * The value a token has in the default theme. Neutrals and shadows read a
 * runtime hook first (`var(--base-light-canvas, #f4f7f0)`) and radii are
 * multiplied by `--radius-scale`; the JSON carries what they resolve to when
 * no theme is applied, which is the fallback.
 */
function defaultOf(value) {
  const hook = value.match(/^var\(--(?:base|style)-[\w-]+,\s*([\s\S]+)\)$/)
  if (hook) return defaultOf(hook[1].trim())
  const scaled = value.match(/^calc\((.+?) \* var\(--radius-scale, 1\)\)$/)
  return scaled ? scaled[1] : value
}

const tokens = {}
let count = 0

for (const line of theme.split('\n')) {
  const match = line.match(/^\s*(--[\w-]+):\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/)
  if (!match) continue

  const [, name, rawValue, comment] = match
  const group = GROUPS.find((entry) => name.startsWith(entry.prefix))
  if (!group) continue

  const key = name.slice(group.prefix.length)
  tokens[group.group] ??= {}
  tokens[group.group][key] = {
    $value: defaultOf(rawValue.trim()),
    $type: group.type,
    ...(comment ? { $description: comment } : {}),
  }
  count += 1
}

// The dark theme overrides only values, never names, so it ships as a mode
// rather than as a second set of tokens.
const darkBlock = CSS.slice(CSS.indexOf("[data-theme='dark'] {"))
const dark = {}
for (const line of darkBlock.split('\n')) {
  const match = line.match(/^\s*(--color-[\w-]+):\s*([^;]+);/)
  if (!match) continue
  dark[match[1].slice('--color-'.length)] = defaultOf(match[2].trim())
  if (line.includes('}')) break
}

const output = {
  $schema: 'https://tr.designtokens.org/format/',
  $description: 'Klyv design tokens. Names are stable; the dark mode changes values only.',
  ...tokens,
  $modes: { dark: { color: dark } },
}

// dist/ for the package export; data/ for the repo, the CLI and the MCP server.
const json = `${JSON.stringify(output, null, 2)}\n`
for (const dir of ['dist', 'data']) {
  mkdirSync(join(ROOT, dir), { recursive: true })
  writeFileSync(join(ROOT, dir, 'tokens.json'), json)
}
console.log(`tokens: ${count} exported, ${Object.keys(dark).length} dark overrides`)
