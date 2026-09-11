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
    $value: rawValue.trim(),
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
  dark[match[1].slice('--color-'.length)] = match[2].trim()
  if (line.includes('}')) break
}

const output = {
  $schema: 'https://tr.designtokens.org/format/',
  $description: 'Citrine design tokens. Names are stable; the dark mode changes values only.',
  ...tokens,
  $modes: { dark: { color: dark } },
}

mkdirSync(join(ROOT, 'dist'), { recursive: true })
writeFileSync(join(ROOT, 'dist', 'tokens.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(`tokens: ${count} exported, ${Object.keys(dark).length} dark overrides`)
