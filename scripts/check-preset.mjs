// Compiles `klyv/preset.css` the way an installed consumer does, and fails
// if the scan comes back empty.
//
// The preset exists so Tailwind users build the library's utilities themselves
// instead of shipping them twice. That only works if `@source` points at the
// components — and when it did not, nothing failed: Tailwind resolved the path,
// found no files, emitted no utilities, and every component rendered unstyled.
// A silent break of the whole styling story deserves a check of its own.
//
// Resolution goes through the package's own `exports` map rather than a path,
// so a broken subpath export fails here too.
import { compile } from 'tailwindcss'
import { Scanner } from '@tailwindcss/oxide'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { exports: subpaths } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

/** What `@import 'klyv/preset.css'` resolves to from a consumer's stylesheet. */
function resolveStylesheet(id, base) {
  if (id === 'tailwindcss') return join(ROOT, 'node_modules', 'tailwindcss', 'index.css')
  if (id === 'klyv' || id.startsWith('klyv/')) {
    const key = id === 'klyv' ? '.' : `./${id.slice('klyv/'.length)}`
    const entry = subpaths[key]
    if (!entry) throw new Error(`package.json exports has no ${key}`)
    return resolve(ROOT, typeof entry === 'string' ? entry : entry.default)
  }
  return resolve(base, id)
}

const consumer = ["@import 'tailwindcss';", "@import 'klyv/preset.css';", ''].join('\n')

const compiled = await compile(consumer, {
  // A consumer's own stylesheet, somewhere that is not the package.
  base: join(ROOT, 'fixture'),
  loadStylesheet: async (id, base) => {
    const path = resolveStylesheet(id, base)
    return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
  },
  loadModule: async (id) => {
    throw new Error(`the preset should not load JS modules (asked for ${id})`)
  },
})

const scanner = new Scanner({ sources: compiled.sources })
const candidates = scanner.scan()
const css = compiled.build(candidates)

// A handful of classes the components genuinely rely on. If the scan silently
// misses the component folder these are the first things to disappear.
const expected = ['.bg-accent', '.text-ink', '.bg-surface', '.border-line', '.rounded-full']
const missing = expected.filter((selector) => !css.includes(selector))

const report = [
  `sources    ${compiled.sources.length}`,
  `files      ${scanner.files.length}`,
  `candidates ${candidates.length}`,
  `css        ${(css.length / 1024).toFixed(1)} KB`,
]

if (scanner.files.length === 0 || missing.length > 0) {
  console.error('check-preset: the preset compiled to nothing usable.')
  console.error(report.map((line) => `  ${line}`).join('\n'))
  if (missing.length) console.error(`  missing   ${missing.join(' ')}`)
  console.error('\n  `@source` in src/styles/preset.css resolves relative to that file.')
  process.exit(1)
}

console.log(`check-preset: ${report.join('  ')}`)
