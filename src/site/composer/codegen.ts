import blocksData from '../../../data/blocks.json'
import { brand } from '../brand'
import { findBlock, type BlockEntry } from '../data/blocks'
import { findComponentByName } from '../data/catalog'
import { dependenciesOf } from '../data/dependencies'
import { blockExportName } from '../lib/blocks'
import { definitions, type Definition, type Props } from './definitions'
import { attr, element, indentLines, text } from './jsx'
import type { ComposerDoc, ComposerNode } from './model'
import { LAYOUT_ONLY } from './registry'

/**
 * A composition, printed as the file a person would have written by hand.
 *
 * Props equal to the component's default are left out, text children are
 * inlined, and the imports are exactly what the file uses. Alongside the file:
 * the packages to install, the blocks to take with the CLI, and every
 * component the composition brings — read from the same dependency graph the
 * component pages and `klyv add` use, so all three agree.
 */
const blockPackages = new Map(blocksData.blocks.map((block) => [block.slug, block.packages]))

export function propAttributes(definition: Definition, props: Props): string[] {
  return definition.props.flatMap((spec) => {
    if (spec.name === definition.textChild) return []
    const value = props[spec.name]
    if (value === undefined || value === 'auto') return []
    if (spec.default !== undefined && value === spec.default) return []
    return [attr(spec.name, value)]
  })
}

interface Collected {
  components: Set<string>
  blocks: Map<string, BlockEntry>
}

function print(node: ComposerNode, collected: Collected): string[] {
  if (node.kind === 'block') {
    const block = findBlock(node.slug)
    if (!block) return []
    collected.blocks.set(block.slug, block)
    return [`<${blockExportName(block.file)} />`]
  }

  const definition = definitions[node.type]
  if (!LAYOUT_ONLY.has(node.type)) collected.components.add(node.type)
  for (const name of definition.imports ?? []) collected.components.add(name)

  const childText = definition.textChild ? String(node.props[definition.textChild] ?? '') : ''
  const children = definition.textChild
    ? childText
      ? [text(childText)]
      : []
    : node.children.flatMap((child) => print(child, collected))
  const attrs = propAttributes(definition, node.props)
  return definition.code ? definition.code(node.props, attrs, children) : element(node.type, attrs, children)
}

export interface Generated {
  path: string
  code: string
  /** Library components the file imports. */
  components: string[]
  blocks: BlockEntry[]
  /** Every component needed if the source is copied instead of installed. */
  resolved: string[]
  packages: string[]
  commands: string
  tree: string
}

export function generate(doc: ComposerDoc, name = 'Screen'): Generated {
  const collected: Collected = { components: new Set(), blocks: new Map() }
  const printed = doc.nodes.map((node) => print(node, collected))

  const body =
    printed.length === 0
      ? ['return null']
      : [
          'return (',
          ...indentLines(
            printed.length === 1
              ? (printed[0] ?? [])
              : element("div", ["style={{ display: 'flex', flexDirection: 'column', gap: 24 }}"], printed.flat()),
            1,
          ),
          ')',
        ]

  const components = [...collected.components].sort()
  const blocks = [...collected.blocks.values()]

  const imports = [
    ...(components.length ? [`import { ${components.join(', ')} } from '${brand.pkg}'`] : []),
    ...blocks.map((block) => `import ${blockExportName(block.file)} from '../blocks/${blockExportName(block.file)}'`),
  ]

  const code = [
    ...imports,
    ...(imports.length ? [''] : []),
    `export default function ${name}() {`,
    ...indentLines(body, 1),
    '}',
    '',
  ].join('\n')

  const packages = new Set<string>([brand.pkg])
  for (const block of blocks) {
    for (const pkg of blockPackages.get(block.slug) ?? []) {
      if (pkg !== 'react' && pkg !== 'react-dom') packages.add(pkg)
    }
  }

  const resolved = new Set<string>()
  for (const component of [...components, ...blocks.flatMap((block) => block.uses)]) {
    for (const dependency of dependenciesOf(component).components) resolved.add(dependency)
  }

  const slugs = components.map((component) => findComponentByName(component)?.slug).filter(Boolean)
  const commands = [
    `npm install ${[...packages].join(' ')}`,
    ...(blocks.length ? [`npx ${brand.pkg} add block ${blocks.map((block) => block.slug).join(' ')}`] : []),
    `# once, at your entry: import '${brand.pkg}/styles.css'`,
    ...(slugs.length ? ['', '# or own the source instead of installing the package:', `npx ${brand.pkg} add ${slugs.join(' ')}`] : []),
  ].join('\n')

  const tree = [
    'src/',
    `├── screens/`,
    `│   └── ${name}.tsx`,
    ...(blocks.length
      ? ['└── blocks/', ...blocks.map((block, index) => `    ${index === blocks.length - 1 ? '└──' : '├──'} ${block.file}   ← klyv add block ${block.slug}`)]
      : []),
  ].join('\n')

  return {
    path: `src/screens/${name}.tsx`,
    code,
    components,
    blocks,
    resolved: [...resolved].sort(),
    packages: [...packages],
    commands,
    tree,
  }
}
