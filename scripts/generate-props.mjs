// Reads each component's props type and writes the API tables the docs render.
//
// The tables used to be hand-written next to the examples, which meant they
// could disagree with the implementation and nothing would notice. These come
// off the AST, so the name, the type, whether it is required and its default
// are the compiler's answer rather than someone's memory of it.
//
// Descriptions still come from prose: the JSDoc on the member where there is
// one, and the old hand-written row where there is not. That is the one part a
// type cannot supply.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')

const oneLine = (text) => text.replace(/\s+/g, ' ').trim()

/** The `/** … *\/` block immediately above a member, as plain prose. */
function docOf(node, source) {
  const ranges = ts.getLeadingCommentRanges(source.text, node.pos) ?? []
  const block = ranges
    .map((range) => source.text.slice(range.pos, range.end))
    .filter((text) => text.startsWith('/**'))
    .pop()
  if (!block) return ''

  return oneLine(
    block
      .replace(/^\/\*\*/, '')
      .replace(/\*\/$/, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\* ?/, ''))
      .join(' '),
  )
}

/** Members of a props declaration, plus whatever it is built on top of. */
function readProps(name, source) {
  const members = []
  const inherits = []
  const seen = new Set()
  let found = false

  // Polymorphic components split their own props into `<Name>OwnProps` and
  // intersect it with the element's attributes. Following that reference is the
  // difference between documenting Surface and documenting nothing.
  const local = new Map()
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement)) local.set(statement.name.text, statement)
  }

  const collect = (node) => {
    if (ts.isTypeLiteralNode(node)) {
      members.push(...node.members)
    } else if (ts.isIntersectionTypeNode(node)) {
      node.types.forEach(collect)
    } else if (
      ts.isTypeReferenceNode(node) &&
      ts.isIdentifier(node.typeName) &&
      local.has(node.typeName.text) &&
      !seen.has(node.typeName.text)
    ) {
      seen.add(node.typeName.text)
      const declaration = local.get(node.typeName.text)
      members.push(...declaration.members)
      for (const clause of declaration.heritageClauses ?? []) {
        for (const type of clause.types) collect(type)
      }
    } else {
      inherits.push(oneLine(node.getText(source)))
    }
  }

  for (const statement of source.statements) {
    if (!statement.name || statement.name.text !== `${name}Props`) continue

    if (ts.isInterfaceDeclaration(statement)) {
      found = true
      members.push(...statement.members)
      for (const clause of statement.heritageClauses ?? []) {
        for (const type of clause.types) collect(type)
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      found = true
      collect(statement.type)
    }
  }

  return { found, members, inherits }
}

/**
 * Defaults, read off the destructured parameter.
 *
 * This is where a component's real defaults live — the props type only says a
 * prop is optional, never what happens when it is left out.
 */
function readDefaults(name, source) {
  const defaults = {}

  const visit = (node) => {
    const isTarget =
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.name &&
      node.name.text === name

    if (isTarget) {
      const [first] = node.parameters
      if (first && ts.isObjectBindingPattern(first.name)) {
        for (const element of first.name.elements) {
          if (element.initializer) {
            defaults[element.name.text] = oneLine(element.initializer.getText(source))
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return defaults
}

const entries = {}
let propCount = 0
let documented = 0
const missing = []

for (const name of readdirSync(COMPONENTS).filter((entry) => /^[A-Z]/.test(entry))) {
  const dir = join(COMPONENTS, name)
  if (!statSync(dir).isDirectory()) continue

  const file = join(dir, `${name}.tsx`)
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const { found, members, inherits } = readProps(name, source)
  if (!found) {
    missing.push(name)
    continue
  }

  const defaults = readDefaults(name, source)
  const props = []

  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.name) continue

    const propName = member.name.getText(source)
    const description = docOf(member, source)
    propCount += 1
    if (description) documented += 1

    props.push({
      name: propName,
      type: member.type ? oneLine(member.type.getText(source)) : 'unknown',
      required: !member.questionToken,
      ...(defaults[propName] ? { defaultValue: defaults[propName] } : {}),
      ...(description ? { description } : {}),
    })
  }

  entries[name] = {
    props,
    ...(inherits.length ? { inherits } : {}),
  }
}

const names = Object.keys(entries).sort()
const sorted = Object.fromEntries(names.map((name) => [name, entries[name]]))

const output = `// GENERATED by scripts/generate-props.mjs - do not edit.
//
// Names, types, required-ness and defaults are read off the AST, so this file
// cannot disagree with the implementation. Descriptions come from the JSDoc on
// each member; where a prop has none, the page falls back to the prose written
// beside its examples.

export interface GeneratedProp {
  name: string
  /** The declared type, printed as written. */
  type: string
  required: boolean
  /** Read off the destructured parameter, not the type. */
  defaultValue?: string
  /** From the member's JSDoc, when it has one. */
  description?: string
}

export interface GeneratedProps {
  props: GeneratedProp[]
  /** What the props type is built on — native attributes, or another props type. */
  inherits?: string[]
}

export const generatedProps: Record<string, GeneratedProps> = ${JSON.stringify(sorted, null, 2)}

/** The API for one component, or undefined when it declares no props type. */
export function propsFor(component: string): GeneratedProps | undefined {
  return generatedProps[component]
}
`

writeFileSync(join(ROOT, 'src', 'site', 'data', 'props.ts'), output)

console.log(
  `props: ${names.length} components, ${propCount} props, ` +
    `${Math.round((documented / propCount) * 100)}% with JSDoc` +
    (missing.length ? `, ${missing.length} without a props type (${missing.slice(0, 3).join(', ')}…)` : ''),
)

/* ---------------------------------------------------------------- drift */

// The prose beside the examples is now only a fallback, which means a row for
// a prop that has been renamed or removed goes quiet instead of going wrong.
// This finds those, so the descriptions stay attached to props that exist.
const SITE = join(ROOT, 'src', 'site')

const catalogPath = join(ROOT, 'scripts', 'components.json')
let slugToName = {}
try {
  const meta = JSON.parse(readFileSync(catalogPath, 'utf8'))
  slugToName = Object.fromEntries(
    Object.entries(meta.catalog ?? {}).map(([name, entry]) => [entry.slug, name]),
  )
} catch {
  // generate-metadata has not run yet; drift reporting is skipped rather than
  // failing the build over a file it does not own.
}

/** Every `name:` string inside an array-of-objects node. */
function namesIn(node, source) {
  const found = []
  if (!node || !ts.isArrayLiteralExpression(node)) return found
  for (const element of node.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue
    for (const property of element.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        property.name.getText(source) === 'name' &&
        ts.isStringLiteralLike(property.initializer)
      ) {
        found.push(property.initializer.text)
      }
    }
  }
  return found
}

const orphans = []
const describedByNotes = {}

function checkRows(component, rows, where) {
  const known = new Set((entries[component]?.props ?? []).map((prop) => prop.name))
  if (known.size === 0) return
  const covered = (describedByNotes[component] ??= new Set())
  for (const row of rows) {
    // A row may cover several props at once, as "min / max" does.
    const parts = row.split(/[\s/,|]+/).filter(Boolean)
    const matched = parts.filter((part) => known.has(part))
    if (matched.length === 0) {
      orphans.push(`${where}: ${component}.${row}`)
      continue
    }
    for (const part of matched) covered.add(part)
  }
}

// Hand-written pages: propNotes={[ … ]}
for (const file of readdirSync(join(SITE, 'pages', 'components'))) {
  if (!file.endsWith('Page.tsx')) continue
  const component = file.replace(/Page\.tsx$/, '')
  const full = join(SITE, 'pages', 'components', file)
  const source = ts.createSourceFile(full, readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const visit = (node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === 'propNotes' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    ) {
      checkRows(component, namesIn(node.initializer.expression, source), file)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

// Example modules: '<slug>': { … props: [ … ] }
for (const file of readdirSync(join(SITE, 'examples'))) {
  if (!file.endsWith('.tsx')) continue
  const full = join(SITE, 'examples', file)
  const source = ts.createSourceFile(full, readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer)) {
      const slug = node.name.getText(source).replace(/^['"]|['"]$/g, '')
      const component = slugToName[slug]
      if (component) {
        for (const property of node.initializer.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText(source) === 'props') {
            checkRows(component, namesIn(property.initializer, source), file)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

if (orphans.length) {
  console.log(
    `props: ${orphans.length} description(s) for props the type does not declare ` +
      `(rendered as "Inherited"; check for renames):`,
  )
  for (const orphan of orphans.slice(0, 40)) console.log(`  ${orphan}`)
  if (orphans.length > 40) console.log(`  …and ${orphans.length - 40} more`)
}

// Coverage after the fallback: what a reader actually sees in the Description
// column. A blank cell is honest, but it is also a gap worth knowing the size of.
let undescribed = 0
const worst = []
for (const [component, entry] of Object.entries(entries)) {
  const covered = describedByNotes[component] ?? new Set()
  const blank = entry.props.filter((prop) => !prop.description && !covered.has(prop.name))
  undescribed += blank.length
  if (blank.length >= 6) worst.push(`${component} (${blank.length})`)
}

const total = Object.values(entries).reduce((sum, entry) => sum + entry.props.length, 0)
console.log(
  `props: ${total - undescribed}/${total} rows described ` +
    `(${Math.round(((total - undescribed) / total) * 100)}%)` +
    (worst.length ? `; thinnest: ${worst.slice(0, 5).join(', ')}` : ''),
)
