import { beforeEach, describe, expect, it } from 'vitest'
import { buildSearchIndex, search } from '../../src/site/lib/search'
import { recommend } from '../../src/site/lib/recommend'
import { saved, savedStore } from '../../src/site/lib/saved'
import { composerReducer, initialState, locate, parseDoc, type ComposerDoc, type ComposerState } from '../../src/site/composer/model'
import { createNode } from '../../src/site/composer/definitions'
import { generate } from '../../src/site/composer/codegen'
import { COMPOSABLE } from '../../src/site/composer/registry'
import { healthOf } from '../../src/site/data/health'
import { componentEvidence } from '../../src/site/data/evidence'
import { libraryItems } from '../../src/site/data/library'
import { findComponentByName } from '../../src/site/data/catalog'
import { recipes } from '../../src/site/data/recipes'
import { templates } from '../../src/site/data/templates'
import { findBlock } from '../../src/site/data/blocks'
import { COMPONENT_TAGS } from '../../src/site/data/taxonomy'

/**
 * The platform's logic, without a browser: the ranking behind ⌘K, the
 * recommendations behind Find My UI, the Composer's tree and its code, the
 * saved-items store, and the rule that no health claim appears without
 * evidence behind it.
 */

describe('search', () => {
  const index = buildSearchIndex()
  const titles = (query: string) => search(index, query).map((hit) => hit.entry.title)
  const inGroup = (query: string, group: string) =>
    search(index, query)
      .filter((hit) => hit.entry.group === group)
      .map((hit) => hit.entry.title)

  it('puts an exact name first', () => {
    expect(titles('button')[0]).toBe('Button')
  })

  it('finds a component by any spelling of its name', () => {
    for (const query of ['datatable', 'data table', 'data-table', 'DataTable']) {
      expect(titles(query)).toContain('DataTable')
    }
  })

  it('forgives one typo, including two swapped letters', () => {
    expect(titles('datatabel')).toContain('DataTable')
    expect(titles('calender')).toContain('Calendar')
  })

  it('reads a word as the tag it stands for', () => {
    expect(inGroup('login', 'Components')).toEqual(expect.arrayContaining(['PasswordInput', 'InputOTP']))
    expect(inGroup('login', 'Blocks')).toContain('Login')
    expect(inGroup('login', 'Recipes')).toContain('Build a login flow')
  })

  it('needs every word of a query to match somewhere', () => {
    expect(titles('billing zzqx')).toEqual([])
  })

  it('reaches pages, tokens, documentation and releases, not only components', () => {
    expect(inGroup('composer', 'Pages')).toContain('Composer')
    expect(inGroup('accent', 'Tokens')).toContain('--color-accent')
    expect(inGroup('dark mode', 'Documentation')).toContain('Dark mode')
    expect(inGroup('contrast', 'Changelog').length).toBeGreaterThan(0)
  })

  it('caps each group so one kind of result cannot crowd out the rest', () => {
    const counts = new Map<string, number>()
    for (const hit of search(index, 'a')) counts.set(hit.entry.group, (counts.get(hit.entry.group) ?? 0) + 1)
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(6)
  })
})

describe('recommendations', () => {
  it('only picks items that carry a chosen need', () => {
    const results = recommend('saas', ['billing'])
    expect(results.component.length).toBeGreaterThan(0)
    for (const { item, matched } of Object.values(results).flat()) {
      expect(item.tags).toContain('billing')
      expect(matched).toEqual(['billing'])
    }
  })

  it('falls back to the project type when no need is chosen', () => {
    expect(recommend('dashboard', []).block.map((entry) => entry.item.slug)).toContain('dashboard')
  })

  it('recommends nothing when there is nothing to go on', () => {
    expect(Object.values(recommend('other', [])).flat()).toEqual([])
  })
})

describe('composer model', () => {
  const empty = (): ComposerState => initialState({ version: 1, nodes: [] })

  it('adds into a selected container, and after a selected leaf', () => {
    const card = createNode('Card')
    const button = createNode('Button')
    const badge = createNode('Badge')
    let state = composerReducer(empty(), { type: 'insert', node: card })
    expect(state.selectedId).toBe(card.id)
    state = composerReducer(state, { type: 'insert', node: button })
    expect(locate(state.doc.nodes, button.id)?.parentId).toBe(card.id)
    state = composerReducer(state, { type: 'insert', node: badge })
    expect(locate(state.doc.nodes, badge.id)).toMatchObject({ parentId: card.id, index: 1 })
  })

  it('undoes and redoes whole edits', () => {
    const button = createNode('Button')
    let state = composerReducer(empty(), { type: 'insert', node: button })
    state = composerReducer(state, { type: 'undo' })
    expect(state.doc.nodes).toEqual([])
    state = composerReducer(state, { type: 'redo' })
    expect(state.doc.nodes[0]?.id).toBe(button.id)
  })

  it('treats a burst of typing into one field as one undo step', () => {
    const button = createNode('Button')
    let state = composerReducer(empty(), { type: 'insert', node: button })
    for (const text of ['S', 'Sh', 'Shi', 'Ship']) {
      state = composerReducer(state, { type: 'setProp', id: button.id, name: 'children', value: text })
    }
    state = composerReducer(state, { type: 'undo' })
    const restored = locate(state.doc.nodes, button.id)?.node
    expect(restored?.kind === 'component' && restored.props.children).toBe('Get started')
  })

  it('duplicates with fresh ids all the way down', () => {
    const field = createNode('Field')
    let state = composerReducer(empty(), { type: 'insert', node: field })
    state = composerReducer(state, { type: 'duplicate', id: field.id })
    const [original, copy] = state.doc.nodes
    expect(copy?.id).not.toBe(original?.id)
    const childIds = (node: typeof original) => (node?.kind === 'component' ? node.children.map((child) => child.id) : [])
    expect(childIds(copy)).not.toEqual(childIds(original))
  })

  it('refuses to move a node inside itself', () => {
    const column = createNode('Column')
    const inner = createNode('Column')
    let state = composerReducer(empty(), { type: 'insert', node: column })
    state = composerReducer(state, { type: 'insert', node: inner })
    const before = state.doc
    state = composerReducer(state, { type: 'move', id: column.id, target: { parentId: inner.id, index: 0 } })
    expect(state.doc).toBe(before)
  })

  it('drops anything unrecognised from a stored draft', () => {
    const doc = parseDoc(
      {
        nodes: [
          { id: 'a', kind: 'component', type: 'Button', props: { children: 'Go', bad: { nested: true } }, children: [] },
          { id: 'b', kind: 'component', type: 'NotAComponent', props: {}, children: [] },
          { id: 'c', kind: 'block', slug: 'no-such-block' },
        ],
      },
      new Set(COMPOSABLE),
      new Set(['login']),
    )
    expect(doc?.nodes).toEqual([{ id: 'a', kind: 'component', type: 'Button', props: { children: 'Go' }, children: [] }])
  })
})

describe('composer code', () => {
  const docOf = (...nodes: ComposerDoc['nodes']): ComposerDoc => ({ version: 1, nodes })

  it('leaves out props that equal the default, and imports exactly what it uses', () => {
    const button = createNode('Button')
    const code = generate(docOf(button)).code
    expect(code).toContain("import { Button } from 'citrine'")
    expect(code).toContain('<Button>Get started</Button>')
    button.props.variant = 'outline'
    expect(generate(docOf(button)).code).toContain('<Button variant="outline">Get started</Button>')
  })

  it('nests children and sorts imports', () => {
    const generated = generate(docOf(createNode('Field')))
    expect(generated.code).toContain("import { Field, Input } from 'citrine'")
    expect(generated.components).toEqual(['Field', 'Input'])
    expect(generated.resolved).toEqual(expect.arrayContaining(['Field', 'Input', 'Label']))
  })

  it('brings a block in whole, with the packages it needs', () => {
    const generated = generate(docOf({ id: 'x', kind: 'block', slug: 'login' }))
    expect(generated.code).toContain("import LoginBlock from '../blocks/LoginBlock'")
    expect(generated.commands).toContain('npx citrine add block login')
    expect(generated.packages).toContain('lucide-react')
  })

  it('prints an empty canvas as a component that renders nothing', () => {
    expect(generate(docOf()).code).toContain('return null')
  })
})

describe('saved items', () => {
  beforeEach(() => savedStore.set({ version: 1, favorites: [], collections: [] }))

  it('toggles a favourite', () => {
    saved.toggleFavorite('component:button')
    expect(savedStore.get().favorites).toEqual(['component:button'])
    saved.toggleFavorite('component:button')
    expect(savedStore.get().favorites).toEqual([])
  })

  it('creates, renames, moves between and deletes collections', () => {
    const a = saved.createCollection('Auth', ['block:login'])
    const b = saved.createCollection('Marketing')
    saved.renameCollection(a, '  Authentication  ')
    saved.renameCollection(a, '   ')
    saved.moveItem('block:login', a, b)
    const [first, second] = savedStore.get().collections
    expect(first).toMatchObject({ name: 'Authentication', items: [] })
    expect(second).toMatchObject({ name: 'Marketing', items: ['block:login'] })
    saved.deleteCollection(a)
    expect(savedStore.get().collections.map((collection) => collection.name)).toEqual(['Marketing'])
  })

  it('persists through the storage adapter', () => {
    saved.toggleFavorite('block:login')
    expect(JSON.parse(window.localStorage.getItem('citrine:saved') ?? '{}').favorites).toEqual(['block:login'])
  })
})

describe('health and metadata', () => {
  it('claims no capability without evidence for it', () => {
    for (const [name, evidence] of Object.entries(componentEvidence)) {
      const ids = healthOf(name)?.capabilities.map((capability) => capability.id) ?? []
      expect(ids.includes('darkMode'), name).toBe(evidence.tokenColours)
      expect(ids.includes('keyboard'), name).toBe(Boolean(evidence.keyboardSuite))
      expect(ids.includes('server'), name).toBe(evidence.serverSafe)
      expect(ids.includes('accessible'), name).toBe(Boolean(evidence.axe))
      expect(ids.includes('reducedMotion'), name).toBe(evidence.reducedMotion)
    }
  })

  it('gives every library item a unique id', () => {
    const ids = libraryItems.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only refers to components and blocks that exist', () => {
    for (const name of Object.keys(COMPONENT_TAGS)) expect(findComponentByName(name), name).toBeDefined()
    for (const recipe of recipes) {
      for (const name of recipe.components) expect(findComponentByName(name), `${recipe.slug}: ${name}`).toBeDefined()
      for (const slug of recipe.blocks) expect(findBlock(slug), `${recipe.slug}: ${slug}`).toBeDefined()
    }
    for (const template of templates) {
      for (const slug of template.blocks) expect(findBlock(slug), `${template.slug}: ${slug}`).toBeDefined()
    }
  })
})
