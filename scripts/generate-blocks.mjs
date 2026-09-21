// Writes data/blocks.json from the site's block list and the block files.
//
// The list says what each screen is for; the files say what it is built from.
// Both go into one JSON bundle so the CLI and the MCP server — which run in
// plain Node, with no build step — can offer blocks the way they offer
// components. What a block uses is read off its imports rather than trusted
// from the hand-written `uses` list, and a `uses` entry the file does not
// import fails the build: the page would be claiming a part the screen lacks.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')
const BLOCKS_DIR = join(ROOT, 'src', 'site', 'blocks')

// blocks.ts is plain data behind a few types. Transpile it rather than match it
// with a pattern, so a multi-line entry can never be silently skipped.
const listSource = readFileSync(join(ROOT, 'src', 'site', 'data', 'blocks.ts'), 'utf8')
const { outputText } = ts.transpileModule(listSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { blocks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

/**
 * Which component folder exports each name. A block imports `useToast`, not
 * `Toast`, and `DEFAULT_PASSWORD_RULES`, not `PasswordStrength` — the folder is
 * what the catalogue, the CLI and the page all mean by a component.
 */
const OWNER = new Map()
for (const folder of readdirSync(COMPONENTS).sort()) {
  const index = join(COMPONENTS, folder, 'index.ts')
  if (!existsSync(index)) continue
  const file = ts.createSourceFile('index.ts', readFileSync(index, 'utf8'), ts.ScriptTarget.Latest, true)
  for (const statement of file.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue
    const clause = statement.exportClause
    if (!clause || !ts.isNamedExports(clause)) continue
    for (const element of clause.elements) {
      if (!element.isTypeOnly) OWNER.set(element.name.text, folder)
    }
  }
}

/** The library components and the npm packages one block file imports. */
function importsOf(code) {
  const file = ts.createSourceFile('block.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const components = new Set()
  const packages = new Set()

  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const from = statement.moduleSpecifier.text
    if (from.startsWith('.') || statement.importClause?.isTypeOnly) continue
    packages.add(from.startsWith('@') ? from.split('/').slice(0, 2).join('/') : from.split('/')[0])

    if (from !== 'klyv') continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue
      const owner = OWNER.get((element.propertyName ?? element.name).text)
      if (owner) components.add(owner)
    }
  }
  return { components: [...components].sort(), packages: [...packages].sort() }
}

const problems = []
const unclaimed = new Set(readdirSync(BLOCKS_DIR).filter((name) => name.endsWith('.tsx')))
const out = []

for (const block of blocks) {
  if (!unclaimed.has(block.file)) {
    problems.push(`${block.slug}: ${block.file} is not in src/site/blocks`)
    continue
  }
  unclaimed.delete(block.file)

  const { components, packages } = importsOf(readFileSync(join(BLOCKS_DIR, block.file), 'utf8'))
  const claimed = block.uses.filter((name) => !components.includes(name))
  if (claimed.length) {
    problems.push(`${block.slug}: "Built from" lists ${claimed.join(', ')}, which ${block.file} does not import`)
  }

  out.push({
    slug: block.slug,
    name: block.name,
    category: block.category,
    blurb: block.blurb,
    uses: block.uses,
    keywords: block.keywords ?? [],
    file: `src/site/blocks/${block.file}`,
    components,
    packages,
  })
}

for (const file of unclaimed) problems.push(`${file} is in src/site/blocks but not in the block list`)

if (problems.length) {
  console.error(`blocks: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(join(ROOT, 'data', 'blocks.json'), `${JSON.stringify({ blocks: out }, null, 2)}\n`)

const distinct = new Set(out.flatMap((block) => block.components)).size
console.log(`blocks: ${out.length} blocks, ${distinct} distinct components across them`)
