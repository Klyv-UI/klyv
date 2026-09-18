/**
 * The dock layout as data: a binary tree whose leaves are tab groups and whose
 * inner nodes split their area in two. Every operation here is pure and
 * returns a new tree, so the layout can be controlled, stored and undone like
 * any other value.
 */

export interface DockLayoutGroup {
  type: 'group'
  id: string
  /** Panel ids, in tab order. */
  tabs: string[]
  /** The visible tab. */
  active: string
}

export interface DockLayoutSplit {
  type: 'split'
  id: string
  /** `row` puts the children side by side; `column` stacks them. */
  direction: 'row' | 'column'
  /** The first child’s share of the space, 0 to 1. */
  ratio: number
  children: [DockLayoutNode, DockLayoutNode]
}

export type DockLayoutNode = DockLayoutGroup | DockLayoutSplit

/** Where a dragged tab lands: into a group, or beside it. */
export type DockLayoutZone = 'center' | 'left' | 'right' | 'top' | 'bottom'

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`

/** Every group, in reading order. */
export function dockGroups(node: DockLayoutNode): DockLayoutGroup[] {
  return node.type === 'group' ? [node] : [...dockGroups(node.children[0]), ...dockGroups(node.children[1])]
}

function map(node: DockLayoutNode, visit: (node: DockLayoutNode) => DockLayoutNode): DockLayoutNode {
  const next = visit(node)
  if (next !== node || next.type === 'group') return next
  const [a, b] = next.children
  const left = map(a, visit)
  const right = map(b, visit)
  return left === a && right === b ? next : { ...next, children: [left, right] }
}

/** Take a tab out. A group left empty disappears and its sibling takes the space. */
function without(node: DockLayoutNode, tab: string): DockLayoutNode | null {
  if (node.type === 'group') {
    if (!node.tabs.includes(tab)) return node
    const index = node.tabs.indexOf(tab)
    const tabs = node.tabs.filter((id) => id !== tab)
    if (tabs.length === 0) return null
    return { ...node, tabs, active: node.active === tab ? tabs[Math.min(index, tabs.length - 1)] : node.active }
  }
  const [a, b] = node.children
  const left = without(a, tab)
  const right = without(b, tab)
  if (!left) return right
  if (!right) return left
  return left === a && right === b ? node : { ...node, children: [left, right] }
}

export function closeDockTab(layout: DockLayoutNode, tab: string): DockLayoutNode {
  return without(layout, tab) ?? { type: 'group', id: newId('group'), tabs: [], active: '' }
}

/** Move a tab into a group (`center`) or into a new group split off one of its edges. */
export function dockTab(layout: DockLayoutNode, tab: string, target: string, zone: DockLayoutZone, index?: number): DockLayoutNode {
  const host = dockGroups(layout).find((group) => group.id === target)
  if (!host) return layout
  if (host.tabs.includes(tab) && (zone === 'center' || host.tabs.length === 1)) {
    if (zone !== 'center' || index === undefined) return activateDockTab(layout, target, tab)
    const tabs = host.tabs.filter((id) => id !== tab)
    tabs.splice(Math.min(index, tabs.length), 0, tab)
    return map(layout, (node) => (node.id === target ? { ...host, tabs, active: tab } : node))
  }
  const rest = without(layout, tab)
  if (!rest || !dockGroups(rest).some((group) => group.id === target)) return layout
  return map(rest, (node) => {
    if (node.id !== target || node.type !== 'group') return node
    if (zone === 'center') {
      const tabs = [...node.tabs]
      tabs.splice(index ?? tabs.length, 0, tab)
      return { ...node, tabs, active: tab }
    }
    const fresh: DockLayoutGroup = { type: 'group', id: newId('group'), tabs: [tab], active: tab }
    const before = zone === 'left' || zone === 'top'
    return {
      type: 'split',
      id: newId('split'),
      direction: zone === 'left' || zone === 'right' ? 'row' : 'column',
      ratio: 0.5,
      children: before ? [fresh, node] : [node, fresh],
    }
  })
}

export function activateDockTab(layout: DockLayoutNode, group: string, tab: string): DockLayoutNode {
  return map(layout, (node) => (node.id === group && node.type === 'group' && node.active !== tab ? { ...node, active: tab } : node))
}

export function resizeDockSplit(layout: DockLayoutNode, split: string, ratio: number): DockLayoutNode {
  const clamped = Math.min(0.9, Math.max(0.1, ratio))
  return map(layout, (node) => (node.id === split && node.type === 'split' && node.ratio !== clamped ? { ...node, ratio: clamped } : node))
}
