import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'
import type { Plugin } from 'vite'

/**
 * Two small transforms over the site's imports from `klyv`.
 *
 * Import statements are found with the TypeScript parser rather than a regex:
 * the docs are full of copy-paste snippets, and a string that reads
 * `import { Button } from 'klyvui'` must be left exactly as written.
 */

const SRC = fileURLToPath(new URL('./src', import.meta.url))

interface Specifier {
  /** The exported name. */
  name: string
  /** The binding inside the importing module. */
  local: string
  typeOnly: boolean
}

interface KlyvImport {
  start: number
  end: number
  typeOnly: boolean
  specifiers: Specifier[]
}

function klyvImports(code: string, id: string): KlyvImport[] {
  if (!code.includes('klyvui')) return []
  const path = id.replace(/\?.*$/, '')
  if (path.includes('/node_modules/') || !/\.(ts|tsx)$/.test(path)) return []

  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, false, kind)
  const found: KlyvImport[] = []

  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'klyvui') continue
    const clause = statement.importClause
    const bindings = clause?.namedBindings
    if (!clause || clause.name || !bindings || !ts.isNamedImports(bindings)) continue

    found.push({
      start: statement.getStart(file),
      end: statement.getEnd(),
      typeOnly: clause.isTypeOnly,
      specifiers: bindings.elements.map((element) => ({
        name: (element.propertyName ?? element.name).text,
        local: element.name.text,
        typeOnly: element.isTypeOnly,
      })),
    })
  }
  return found
}

const isSiteModule = (id: string) => /\/src\/site\//.test(id.replace(/\\/g, '/'))

/* ------------------------------------------------------------- registry */

/**
 * Lets the docs site look a library component up by name while it runs.
 *
 * A production build minifies function names, so `Tabs.name` is not "Tabs" on
 * the shipped site. Instead, every site module that imports components from
 * `klyv` also hands them to a small registry (src/site/lib/registry.ts),
 * keyed by the name it imported. The live playground on a component page uses
 * it to recognise that component among the examples already on the page.
 *
 * Only names that are component folders are registered, so a type imported
 * without the `type` keyword is never referenced as a value. And only what a
 * module already imports is registered, so nothing is kept alive that
 * tree-shaking would otherwise have dropped.
 */
export function registerComponents(): Plugin {
  const components = new Set(readdirSync(`${SRC}/components`).filter((name) => /^[A-Z]/.test(name)))

  return {
    name: 'klyv:register-components',
    enforce: 'pre',
    transform(code, id) {
      const normalised = id.replace(/\\/g, '/')
      if (!isSiteModule(normalised) || normalised.endsWith('/src/site/lib/registry.ts')) return null

      const found = new Map<string, string>()
      for (const statement of klyvImports(code, normalised)) {
        if (statement.typeOnly) continue
        for (const { name, local, typeOnly } of statement.specifiers) {
          if (!typeOnly && components.has(name)) found.set(name, local)
        }
      }
      if (found.size === 0) return null

      const entries = [...found].map(([name, local]) => (name === local ? name : `${name}: ${local}`)).join(', ')
      return {
        code: `${code}\nimport { registerComponents as __registerComponents } from '@/site/lib/registry'\n__registerComponents({ ${entries} })\n`,
        map: null,
      }
    },
  }
}

/* ------------------------------------------------------- direct imports */

/** Every name the package exports, and the module that defines it. */
function exportMap(): Map<string, string> {
  const EXPORTS = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]\.\/([^'"]+)['"]/g
  const exported = (list: string) =>
    list
      .split(',')
      .map((part) => part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim())
      .filter(Boolean)

  const map = new Map<string, string>()
  for (const folder of readdirSync(`${SRC}/components`)) {
    const index = `${SRC}/components/${folder}/index.ts`
    if (!existsSync(index)) continue
    for (const match of readFileSync(index, 'utf8').matchAll(EXPORTS)) {
      for (const name of exported(match[1])) map.set(name, `@/components/${folder}`)
    }
  }
  for (const match of readFileSync(`${SRC}/index.ts`, 'utf8').matchAll(EXPORTS)) {
    for (const name of exported(match[1])) map.set(name, `@/${match[2]}`)
  }
  return map
}

/**
 * In development, imports from `klyv` go straight to the module that
 * defines each name.
 *
 * The package name points at src/index.ts, a barrel over every component. A
 * production build tree-shakes that down to what a page uses, but the dev
 * server does not bundle: importing the barrel makes the browser fetch every
 * file in the library — about six hundred requests on every load and every
 * reload, on every page.
 *
 * So `import { Tabs, Text } from 'klyvui'` becomes one import from
 * `@/components/Tabs` and one from `@/components/Text`. Those are the modules
 * the barrel re-exports, so nothing changes but the request count. A name the
 * map does not know (a component added while the server runs) stays on the
 * barrel: slower, still correct. Replacements keep the statement's line count,
 * so line numbers in errors still match the file.
 */
export function directImports(): Plugin {
  let map: Map<string, string> | undefined

  return {
    name: 'klyv:direct-imports',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const normalised = id.replace(/\\/g, '/')
      const statements = klyvImports(code, normalised).filter((statement) => !statement.typeOnly)
      if (statements.length === 0) return null
      map ??= exportMap()

      let output = code
      for (const statement of [...statements].reverse()) {
        const groups = new Map<string, string[]>()
        for (const { name, local, typeOnly } of statement.specifiers) {
          const target = map.get(name) ?? 'klyvui'
          const text = `${typeOnly ? 'type ' : ''}${name}${local === name ? '' : ` as ${local}`}`
          groups.set(target, [...(groups.get(target) ?? []), text])
        }
        const original = code.slice(statement.start, statement.end)
        const lines = original.split('\n').length - 1
        const replacement =
          [...groups].map(([target, names]) => `import { ${names.join(', ')} } from '${target}';`).join(' ') +
          '\n'.repeat(lines)
        output = output.slice(0, statement.start) + replacement + output.slice(statement.end)
      }
      return { code: output, map: null }
    },
  }
}
