// Adds the `'use client'` directive to every module that cannot run on a React
// Server Component boundary, and leaves the ones that can.
//
// Marking the whole library would be simpler and would throw away what makes
// RSC worth having: Text, Surface, Badge and 80-odd others are pure functions of
// their props and should stay on the server.
//
// Run with `--check` to verify without writing (used by `npm run generate`).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const DIRECTIVE = "'use client'"

/**
 * What forces a module onto the client.
 *
 * `forwardRef` is on the list because it is a client-only API in RSC, which
 * catches a set of otherwise-pure components — Input and Switch among them.
 */
const CLIENT_SIGNALS = [
  [/\buse[A-Z]\w*\s*[(<]/, 'hooks'],
  [/\bforwardRef\b/, 'forwardRef'],
  [/\bcreatePortal\b/, 'portal'],
  [/\son[A-Z]\w+=\{/, 'event handler'],
  [/\b(?:window|document|navigator|localStorage|sessionStorage|performance)\s*\./, 'browser global'],
  [/\b(?:matchMedia|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|AudioContext|webkitAudioContext|getComputedStyle)\b/, 'browser API'],
]

/** Directories whose modules ship to consumers. The docs site is not one. */
const ROOTS = [join(SRC, 'components'), join(SRC, 'lib'), join(SRC, 'theme')]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Barrels only re-export; the directive belongs on the module that defines. */
const isBarrel = (path) => path.endsWith(`${'index'}.ts`) && !path.endsWith('src/index.ts')

const check = process.argv.includes('--check')
const added = []
const stale = []
let client = 0
let server = 0

for (const path of ROOTS.flatMap((dir) => walk(dir))) {
  const source = readFileSync(path, 'utf8')
  const has = source.trimStart().startsWith(DIRECTIVE)
  const rel = relative(SRC, path).replace(/\\/g, '/')

  if (isBarrel(path)) {
    if (has) stale.push(rel)
    continue
  }

  const reason = CLIENT_SIGNALS.find(([pattern]) => pattern.test(source))
  const needs = Boolean(reason)

  if (needs) client += 1
  else server += 1

  if (needs && !has) {
    added.push(`${rel} (${reason[1]})`)
    if (!check) writeFileSync(path, `${DIRECTIVE}\n\n${source}`)
  }
  if (!needs && has) {
    stale.push(rel)
    if (!check) writeFileSync(path, source.replace(/^'use client'\n\n?/, ''))
  }
}

if (check) {
  if (added.length || stale.length) {
    if (added.length) console.error(`missing 'use client':\n  ${added.join('\n  ')}`)
    if (stale.length) console.error(`unnecessary 'use client':\n  ${stale.join('\n  ')}`)
    console.error("\nRun `node scripts/client-directives.mjs` to fix.")
    process.exit(1)
  }
  console.log(`client directives: ${client} client, ${server} server-safe`)
} else {
  console.log(
    `client directives: ${client} client, ${server} server-safe` +
      (added.length ? `, ${added.length} added` : '') +
      (stale.length ? `, ${stale.length} removed` : ''),
  )
}
