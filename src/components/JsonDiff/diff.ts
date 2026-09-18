/**
 * Structural JSON diff for JsonDiff.
 *
 * Objects are compared key by key. Arrays are aligned with a longest common
 * subsequence, so an insertion in the middle is one addition rather than a
 * change to every element after it. When every element carries an `id` (or
 * `key`) the alignment is by that identity, which also exposes moves: matched
 * elements outside the common subsequence changed position. Without ids, an
 * element removed in one place and added unchanged in another is a move too.
 */

export type JsonDiffStatus = 'same' | 'modified' | 'changed' | 'added' | 'removed' | 'moved'

export interface JsonDiffNode {
  /** Property name or array index on the side it is shown; `null` for the root. */
  key: string | number | null
  /** JSON Pointer: the new path, or the old one for a removal. */
  path: string
  status: JsonDiffStatus
  before?: unknown
  after?: unknown
  /** Old pointer of a moved element. */
  from?: string
  /** Children, for an object or array present on both sides. */
  children?: JsonDiffNode[]
  /** Whether the node is an object or array on both sides. */
  container?: 'object' | 'array'
}

export interface JsonDiffChange {
  op: 'add' | 'remove' | 'replace' | 'move'
  path: string
  from?: string
  before?: unknown
  after?: unknown
}

export interface JsonDiffCounts {
  added: number
  removed: number
  changed: number
  moved: number
}

type Json = unknown
const isObject = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)
const escape = (key: string | number) => String(key).replace(/~/g, '~0').replace(/\//g, '~1')
const join = (path: string, key: string | number) => `${path}/${escape(key)}`
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** A canonical string for a value: object keys sorted, so equal values hash equal. */
export function stable(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

/** Index pairs of a longest common subsequence of two sequences of hashes. */
function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  // Trim the common head and tail first; most real edits are local.
  let head = 0
  while (head < n && head < m && a[head] === b[head]) head++
  let tail = 0
  while (tail < n - head && tail < m - head && a[n - 1 - tail] === b[m - 1 - tail]) tail++
  const pairs: [number, number][] = []
  for (let k = 0; k < head; k++) pairs.push([k, k])
  const an = n - head - tail
  const bm = m - head - tail
  if (an > 0 && bm > 0 && an * bm <= 4_000_000) {
    const table = Array.from({ length: an + 1 }, () => new Uint32Array(bm + 1))
    for (let i = an - 1; i >= 0; i--) {
      for (let j = bm - 1; j >= 0; j--) {
        table[i][j] = a[head + i] === b[head + j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < an && j < bm) {
      if (a[head + i] === b[head + j]) {
        pairs.push([head + i, head + j])
        i++
        j++
      } else if (table[i + 1][j] >= table[i][j + 1]) i++
      else j++
    }
  }
  for (let k = 0; k < tail; k++) pairs.push([n - tail + k, m - tail + k])
  return pairs
}

function leaf(key: string | number | null, path: string, status: JsonDiffStatus, before?: Json, after?: Json): JsonDiffNode {
  return { key, path, status, before, after }
}

function settle(node: JsonDiffNode): JsonDiffNode {
  if (node.status === 'same' && node.children?.some((child) => child.status !== 'same')) node.status = 'modified'
  return node
}

/** The identity field every element of both arrays carries uniquely, if there is one. */
function identity(a: Json[], b: Json[], keys: string[]): string | null {
  for (const field of keys) {
    const ok = (list: Json[]) => {
      const seen = new Set<unknown>()
      return list.every((item) => {
        if (!isObject(item)) return false
        const id = item[field]
        if ((typeof id !== 'string' && typeof id !== 'number') || seen.has(id)) return false
        seen.add(id)
        return true
      })
    }
    if (a.length + b.length > 0 && ok(a) && ok(b)) return field
  }
  return null
}

function diffArrays(a: Json[], b: Json[], key: string | number | null, path: string, oldPath: string, keys: string[]): JsonDiffNode {
  const children: { node: JsonDiffNode; order: number }[] = []
  const field = identity(a, b, keys)
  const ha = field ? a.map((item) => String((item as Record<string, Json>)[field])) : a.map(stable)
  const hb = field ? b.map((item) => String((item as Record<string, Json>)[field])) : b.map(stable)

  const pairs = lcs(ha, hb)
  const matchedA = new Map(pairs.map(([i, j]) => [i, j]))
  const matchedB = new Map(pairs.map(([i, j]) => [j, i]))
  // Moves: an element outside the common subsequence whose identity (or, without
  // ids, whole value) appears on both sides.
  const movedB = new Map<number, number>()
  const movedA = new Set<number>()
  const freeA = new Map<string, number[]>()
  ha.forEach((h, i) => !matchedA.has(i) && freeA.set(h, [...(freeA.get(h) ?? []), i]))
  hb.forEach((h, j) => {
    if (matchedB.has(j)) return
    const i = freeA.get(h)?.shift()
    if (i !== undefined) {
      movedB.set(j, i)
      movedA.add(i)
    }
  })

  // Walk the gaps between anchors, pairing leftovers position by position as
  // in-place edits, and the rest as additions and removals.
  const anchors: [number, number][] = [...pairs, [a.length, b.length]]
  let ia = 0
  let jb = 0
  for (const [ai, bj] of anchors) {
    const gapA: number[] = []
    const gapB: number[] = []
    for (let i = ia; i < ai; i++) if (!movedA.has(i)) gapA.push(i)
    for (let j = jb; j < bj; j++) {
      if (movedB.has(j)) {
        const i = movedB.get(j)!
        const inner = diff(a[i], b[j], j, join(path, j), join(oldPath, i), keys)
        children.push({ node: { ...inner, status: 'moved', from: join(oldPath, i) }, order: j })
      } else gapB.push(j)
    }
    const paired = field ? 0 : Math.min(gapA.length, gapB.length)
    for (let k = 0; k < paired; k++) {
      children.push({ node: diff(a[gapA[k]], b[gapB[k]], gapB[k], join(path, gapB[k]), join(oldPath, gapA[k]), keys), order: gapB[k] })
    }
    gapA.slice(paired).forEach((i) => children.push({ node: leaf(i, join(oldPath, i), 'removed', a[i]), order: jb - 0.5 + i / (a.length + 1) / 2 }))
    gapB.slice(paired).forEach((j) => children.push({ node: leaf(j, join(path, j), 'added', undefined, b[j]), order: j }))
    if (ai < a.length && bj < b.length) children.push({ node: diff(a[ai], b[bj], bj, join(path, bj), join(oldPath, ai), keys), order: bj })
    ia = ai + 1
    jb = bj + 1
  }
  children.sort((x, y) => x.order - y.order)
  return settle({ key, path, status: 'same', before: a, after: b, container: 'array', children: children.map((child) => child.node) })
}

/** Diff two JSON values into a tree. */
export function diff(a: Json, b: Json, key: string | number | null = null, path = '', oldPath = path, keys: string[] = ['id', 'key']): JsonDiffNode {
  if (Array.isArray(a) && Array.isArray(b)) return diffArrays(a, b, key, path, oldPath, keys)
  if (isObject(a) && isObject(b)) {
    const children: JsonDiffNode[] = []
    for (const k of Object.keys(a)) {
      if (has(b, k)) children.push(diff(a[k], b[k], k, join(path, k), join(oldPath, k), keys))
      else children.push(leaf(k, join(oldPath, k), 'removed', a[k]))
    }
    for (const k of Object.keys(b)) if (!has(a, k)) children.push(leaf(k, join(path, k), 'added', undefined, b[k]))
    return settle({ key, path, status: 'same', before: a, after: b, container: 'object', children })
  }
  return stable(a) === stable(b) ? leaf(key, path, 'same', a, b) : leaf(key, path, 'changed', a, b)
}

/** Flatten the tree into an ordered change list. */
export function changes(root: JsonDiffNode): JsonDiffChange[] {
  const out: JsonDiffChange[] = []
  const walk = (node: JsonDiffNode) => {
    if (node.status === 'added') out.push({ op: 'add', path: node.path, after: node.after })
    else if (node.status === 'removed') out.push({ op: 'remove', path: node.path, before: node.before })
    else if (node.status === 'changed') out.push({ op: 'replace', path: node.path, before: node.before, after: node.after })
    else if (node.status === 'moved') out.push({ op: 'move', from: node.from, path: node.path })
    if (node.status !== 'same') node.children?.forEach(walk)
  }
  walk(root)
  return out
}

export function count(list: JsonDiffChange[]): JsonDiffCounts {
  return {
    added: list.filter((c) => c.op === 'add').length,
    removed: list.filter((c) => c.op === 'remove').length,
    changed: list.filter((c) => c.op === 'replace').length,
    moved: list.filter((c) => c.op === 'move').length,
  }
}
