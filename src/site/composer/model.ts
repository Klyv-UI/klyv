import { CONTAINERS, type ComposableName } from './registry'

/**
 * The Composer's document, and every edit to it as a pure function.
 *
 * A composition is a tree of nodes: library components with the props the
 * Composer exposes, and whole blocks as leaves. Edits share structure — an
 * edit rebuilds only the path from the root to the node it touched — so the
 * canvas can skip every subtree whose node object did not change, and undo is
 * a stack of previous roots rather than a log of inverse operations.
 */
export type PropValue = string | number | boolean

export interface ComponentNode {
  id: string
  kind: 'component'
  type: ComposableName
  props: Record<string, PropValue>
  children: ComposerNode[]
}

export interface BlockNode {
  id: string
  kind: 'block'
  slug: string
}

export type ComposerNode = ComponentNode | BlockNode

export interface ComposerDoc {
  version: 1
  nodes: ComposerNode[]
}

/** Where a node goes: a parent (null for the top level) and an index in it. */
export interface Target {
  parentId: string | null
  index: number
}

export const newNodeId = () => Math.random().toString(36).slice(2, 10)

export const isContainer = (node: ComposerNode): node is ComponentNode =>
  node.kind === 'component' && CONTAINERS.has(node.type)

/* ------------------------------------------------------------------ queries */

export interface Located {
  node: ComposerNode
  parentId: string | null
  index: number
}

export function locate(nodes: ComposerNode[], id: string, parentId: string | null = null): Located | null {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) return { node, parentId, index }
    if (node.kind === 'component') {
      const found = locate(node.children, id, node.id)
      if (found) return found
    }
  }
  return null
}

function contains(node: ComposerNode, id: string): boolean {
  if (node.id === id) return true
  return node.kind === 'component' && node.children.some((child) => contains(child, id))
}

export function flatten(nodes: ComposerNode[], depth = 0): { node: ComposerNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(node.kind === 'component' ? flatten(node.children, depth + 1) : []),
  ])
}

/* ---------------------------------------------------------------- mutations */

/** Replaces the children of one parent, rebuilding only the path to it. */
function withChildren(
  nodes: ComposerNode[],
  parentId: string | null,
  change: (children: ComposerNode[]) => ComposerNode[],
): ComposerNode[] {
  if (parentId === null) return change(nodes)
  let touched = false
  const next = nodes.map((node) => {
    if (node.kind !== 'component') return node
    if (node.id === parentId) {
      touched = true
      return { ...node, children: change(node.children) }
    }
    const children = withChildren(node.children, parentId, change)
    if (children === node.children) return node
    touched = true
    return { ...node, children }
  })
  return touched ? next : nodes
}

export function insert(nodes: ComposerNode[], target: Target, node: ComposerNode): ComposerNode[] {
  return withChildren(nodes, target.parentId, (children) => {
    const index = Math.max(0, Math.min(target.index, children.length))
    return [...children.slice(0, index), node, ...children.slice(index)]
  })
}

export function remove(nodes: ComposerNode[], id: string): ComposerNode[] {
  const found = locate(nodes, id)
  if (!found) return nodes
  return withChildren(nodes, found.parentId, (children) => children.filter((child) => child.id !== id))
}

export function updateProps(nodes: ComposerNode[], id: string, patch: Record<string, PropValue>): ComposerNode[] {
  const found = locate(nodes, id)
  if (!found || found.node.kind !== 'component') return nodes
  const updated: ComponentNode = { ...found.node, props: { ...found.node.props, ...patch } }
  return withChildren(nodes, found.parentId, (children) =>
    children.map((child) => (child.id === id ? updated : child)),
  )
}

/** A deep copy with fresh ids, so a duplicate never shares an id with its source. */
export function cloneNode(node: ComposerNode): ComposerNode {
  if (node.kind === 'block') return { ...node, id: newNodeId() }
  return { ...node, id: newNodeId(), props: { ...node.props }, children: node.children.map(cloneNode) }
}

/**
 * Moves a node. The target index is read against the tree *before* the move,
 * as a drop indicator shows it; moving a node into itself or its own
 * descendants is refused.
 */
export function move(nodes: ComposerNode[], id: string, target: Target): ComposerNode[] {
  const found = locate(nodes, id)
  if (!found) return nodes
  if (target.parentId !== null && contains(found.node, target.parentId)) return nodes
  const index =
    found.parentId === target.parentId && found.index < target.index ? target.index - 1 : target.index
  if (found.parentId === target.parentId && found.index === index) return nodes
  return insert(remove(nodes, id), { parentId: target.parentId, index }, found.node)
}

/* ---------------------------------------------------------------- reducer */

const HISTORY = 100
/** Keystrokes into one field within this window are one undo step. */
const COALESCE_MS = 800

export interface ComposerState {
  doc: ComposerDoc
  selectedId: string | null
  past: ComposerDoc[]
  future: ComposerDoc[]
  /** The field last typed into, for coalescing. */
  lastEdit?: { key: string; at: number }
}

export type ComposerAction =
  | { type: 'insert'; node: ComposerNode; target?: Target }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'move'; id: string; target: Target }
  | { type: 'nudge'; id: string; delta: -1 | 1 }
  | { type: 'setProp'; id: string; name: string; value: PropValue }
  | { type: 'select'; id: string | null }
  | { type: 'replace'; doc: ComposerDoc }
  | { type: 'undo' }
  | { type: 'redo' }

export function initialState(doc: ComposerDoc): ComposerState {
  return { doc, selectedId: null, past: [], future: [] }
}

function commit(
  state: ComposerState,
  nodes: ComposerNode[],
  selectedId: string | null,
  editKey?: string,
): ComposerState {
  if (nodes === state.doc.nodes) return selectedId === state.selectedId ? state : { ...state, selectedId }
  const now = Date.now()
  const coalesce = editKey !== undefined && state.lastEdit?.key === editKey && now - state.lastEdit.at < COALESCE_MS
  return {
    doc: { version: 1, nodes },
    selectedId,
    past: coalesce ? state.past : [...state.past, state.doc].slice(-HISTORY),
    future: [],
    lastEdit: editKey === undefined ? undefined : { key: editKey, at: now },
  }
}

/**
 * Where a new node lands when nobody said: inside the selection if it is a
 * container, after it if not, and at the end of the page if nothing is
 * selected. That is what "Add" should mean to someone who just clicked a card.
 */
export function defaultTarget(nodes: ComposerNode[], selectedId: string | null): Target {
  const selected = selectedId ? locate(nodes, selectedId) : null
  if (!selected) return { parentId: null, index: nodes.length }
  if (isContainer(selected.node)) return { parentId: selected.node.id, index: selected.node.children.length }
  return { parentId: selected.parentId, index: selected.index + 1 }
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  const { nodes } = state.doc
  switch (action.type) {
    case 'insert': {
      const target = action.target ?? defaultTarget(nodes, state.selectedId)
      return commit(state, insert(nodes, target, action.node), action.node.id)
    }
    case 'remove': {
      const found = locate(nodes, action.id)
      if (!found) return state
      const next = remove(nodes, action.id)
      // Select a neighbour, so Delete can be pressed again without reaching for the mouse.
      const siblings = found.parentId === null ? next : (locate(next, found.parentId)?.node as ComponentNode).children
      const neighbour = siblings[Math.min(found.index, siblings.length - 1)]
      return commit(state, next, neighbour?.id ?? found.parentId)
    }
    case 'duplicate': {
      const found = locate(nodes, action.id)
      if (!found) return state
      const copy = cloneNode(found.node)
      return commit(state, insert(nodes, { parentId: found.parentId, index: found.index + 1 }, copy), copy.id)
    }
    case 'move':
      return commit(state, move(nodes, action.id, action.target), action.id)
    case 'nudge': {
      const found = locate(nodes, action.id)
      if (!found) return state
      const index = found.index + (action.delta === 1 ? 2 : -1)
      if (index < 0) return state
      return commit(state, move(nodes, action.id, { parentId: found.parentId, index }), action.id)
    }
    case 'setProp':
      return commit(
        state,
        updateProps(nodes, action.id, { [action.name]: action.value }),
        state.selectedId,
        `${action.id}:${action.name}`,
      )
    case 'select':
      return action.id === state.selectedId ? state : { ...state, selectedId: action.id, lastEdit: undefined }
    case 'replace':
      return commit(state, action.doc.nodes, null)
    case 'undo': {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      return {
        doc: previous,
        selectedId: state.selectedId && locate(previous.nodes, state.selectedId) ? state.selectedId : null,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return {
        doc: next,
        selectedId: state.selectedId && locate(next.nodes, state.selectedId) ? state.selectedId : null,
        past: [...state.past, state.doc],
        future: rest,
      }
    }
  }
}

/* --------------------------------------------------------------- persistence */

/** Stored drafts outlive the code that wrote them; anything unrecognised is dropped. */
export function parseDoc(raw: unknown, knownTypes: ReadonlySet<string>, knownBlocks: ReadonlySet<string>): ComposerDoc | undefined {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as ComposerDoc).nodes)) return undefined
  const clean = (value: unknown): ComposerNode | null => {
    if (!value || typeof value !== 'object') return null
    const node = value as { id?: unknown; kind?: unknown; slug?: unknown; type?: unknown; props?: unknown; children?: unknown }
    if (typeof node.id !== 'string') return null
    if (node.kind === 'block') return typeof node.slug === 'string' && knownBlocks.has(node.slug) ? { id: node.id, kind: 'block', slug: node.slug } : null
    if (node.kind !== 'component' || typeof node.type !== 'string' || !knownTypes.has(node.type)) return null
    const props: Record<string, PropValue> = {}
    for (const [key, prop] of Object.entries(node.props && typeof node.props === 'object' ? node.props : {})) {
      if (typeof prop === 'string' || typeof prop === 'number' || typeof prop === 'boolean') props[key] = prop
    }
    const children = Array.isArray(node.children) ? node.children.map(clean).filter((child): child is ComposerNode => child !== null) : []
    return { id: node.id, kind: 'component', type: node.type as ComposableName, props, children }
  }
  return { version: 1, nodes: (raw as ComposerDoc).nodes.map(clean).filter((node): node is ComposerNode => node !== null) }
}
