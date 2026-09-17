// Reads the evidence behind every claim the site makes about a component's
// production readiness, and writes it where the Health panel can read it.
//
// A readiness badge that a person types by hand is a badge that drifts: the
// component changes, the claim does not. So nothing here is asserted — each
// field is measured from the source tree or from a test file, and a claim with
// no evidence is simply absent rather than defaulted to true.
//
//   serverSafe      no module in the folder carries 'use client'
//   tokenColours    no hex literal anywhere in the folder, so both themes are
//                   painted by the same tokens (the dark-mode claim)
//   animates        it runs continuous motion, by the rules script's definition
//   reducedMotion   …and it has an answer under prefers-reduced-motion
//   keyboardSuite   the interaction test file with a describe() block for it
//   axe             its docs page is in the axe suite and the last recorded
//                   report holds no finding or crash for it
//
// It also lists the components the docs site's own shell and pages import,
// which is what the Built With page counts for this site.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')
const SITE = join(ROOT, 'src', 'site')

// The same definitions check-rules.mjs enforces, so "animates" means one thing.
const ANIMATES = [/\banimate-\[/, /\banimate-(?:spin|ping|pulse|bounce)\b/, /animation:/]
const loops = (source) => (source.match(/requestAnimationFrame/g) ?? []).length >= 2
const ANSWERS = [/motion-safe-only/, /usePrefersReducedMotion/, /prefers-reduced-motion/, /motion-safe:/, /motion-reduce:/]
const HEX = /#[0-9a-fA-F]{3,8}\b/
const CLIENT = /^\s*['"]use client['"]/m

/* ------------------------------------------------------------- test evidence */

const INTERACTION = join(ROOT, 'test', 'interaction')

// "Keyboard tested" is a claim the docs print on a component's page, so it is
// earned by pressing keys, not by being named. It used to be granted for any
// `describe('Name')` at all — DataTable, VirtualList, BulkActionBar, Countdown
// and RelativeTime carried the badge from test blocks that never touched the
// keyboard, and any render-only test added later would have handed out more.
const PRESSES_KEYS = /\buser\.(?:keyboard|tab)\(|\bfireEvent\.key(?:Down|Up)\(/

const keyboard = {}
if (existsSync(INTERACTION)) {
  for (const file of readdirSync(INTERACTION).filter((name) => name.endsWith('.test.tsx'))) {
    const source = readFileSync(join(INTERACTION, file), 'utf8')
    const blocks = [...source.matchAll(/\bdescribe\(\s*'([A-Z][A-Za-z0-9]*)'/g)]
    blocks.forEach((match, index) => {
      // A block runs to the next top-level describe. Close enough for a check
      // that only has to find a key press inside it.
      const body = source.slice(match.index, blocks[index + 1]?.index ?? source.length)
      if (PRESSES_KEYS.test(body)) keyboard[match[1]] = `test/interaction/${file}`
    })
  }
}

const catalogSource = readFileSync(join(SITE, 'data', 'catalog.ts'), 'utf8')
const slugOf = {}
for (const match of catalogSource.matchAll(/\{ name: '([^']+)', slug: '([^']+)'/g)) {
  slugOf[match[1]] = match[2]
}

const REPORT = join(ROOT, 'test', 'a11y-report.json')
let failing = null
if (existsSync(REPORT)) {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  failing = new Set([...report.crashes, ...report.findings].map((entry) => entry.slug))
}

/* ------------------------------------------------------------ source evidence */

const evidence = {}
for (const name of readdirSync(COMPONENTS).filter((entry) => /^[A-Z]/.test(entry)).sort()) {
  const dir = join(COMPONENTS, name)
  if (!statSync(dir).isDirectory()) continue

  const sources = readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(join(dir, file), 'utf8'))
  const all = sources.join('\n')

  const animates = sources.some((source) => ANIMATES.some((pattern) => pattern.test(source)) || loops(source))
  const entry = {
    serverSafe: !sources.some((source) => CLIENT.test(source)),
    tokenColours: !HEX.test(all),
    animates,
    reducedMotion: animates && ANSWERS.some((pattern) => pattern.test(all)),
  }
  if (keyboard[name]) entry.keyboardSuite = keyboard[name]
  if (failing && slugOf[name] && !failing.has(slugOf[name])) entry.axe = true
  evidence[name] = entry
}

/* ------------------------------------------------------- what the site uses */

// The shell and the feature pages — not the per-component docs pages or the
// examples, which import each component because they document it, and not the
// blocks, which are counted on their own.
const SKIP = [join(SITE, 'examples'), join(SITE, 'blocks'), join(SITE, 'pages', 'components')]
const siteComponents = new Set()

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (SKIP.includes(path)) continue
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.tsx?$/.test(entry)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'citrine'/g)) {
        for (const raw of match[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0]
          if (name && !name.startsWith('type ') && evidence[name]) siteComponents.add(name)
        }
      }
    }
  }
}
walk(SITE)

/* ------------------------------------------------------------------- output */

const out = `// GENERATED by scripts/generate-evidence.mjs - do not edit.
//
// Measured, never asserted: see the script for where each field comes from. A
// field that is absent means there is no evidence for it, not that it is false.

export interface ComponentEvidence {
  /** No module in the folder carries 'use client'. */
  serverSafe: boolean
  /** No hex literal in the folder: every colour is a token, so dark mode repaints it. */
  tokenColours: boolean
  /** Runs continuous motion. */
  animates: boolean
  /** Animates, and opts out under prefers-reduced-motion. */
  reducedMotion: boolean
  /** The interaction suite that drives it from the keyboard. */
  keyboardSuite?: string
  /** Its docs page passed axe in the last recorded run. */
  axe?: boolean
}

export const componentEvidence: Record<string, ComponentEvidence> = ${JSON.stringify(evidence, null, 2)}

/** Components the docs site's own shell and feature pages import. */
export const siteComponents: string[] = ${JSON.stringify([...siteComponents].sort(), null, 2)}
`

writeFileSync(join(SITE, 'data', 'evidence.ts'), out)

const count = (key) => Object.values(evidence).filter((entry) => entry[key]).length
console.log(
  `evidence: ${Object.keys(evidence).length} components — ${count('serverSafe')} server-safe, ` +
    `${count('tokenColours')} token-only, ${count('keyboardSuite')} keyboard-tested, ` +
    `${count('axe')} axe-clean${failing ? '' : ' (no a11y report found)'}; ` +
    `site uses ${siteComponents.size} (${relative(ROOT, SITE).replace(/\\/g, '/')})`,
)
