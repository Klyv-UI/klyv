'use client'

import { useEffect, useRef, useSyncExternalStore, type ChangeEvent } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { Textarea } from '../Textarea'

/** A Lamport timestamp paired with the site that made it — unique across every replica. */
export interface CollaborativeTextOpId {
  counter: number
  site: string
}

export type CollaborativeTextOperation =
  | { type: 'insert'; id: CollaborativeTextOpId; after: CollaborativeTextOpId | null; value: string }
  | { type: 'delete'; id: CollaborativeTextOpId }

interface RgaNode {
  id: CollaborativeTextOpId
  key: string
  value: string
  deleted: boolean
}

const keyOf = (id: CollaborativeTextOpId) => `${id.counter}@${id.site}`
const compare = (a: CollaborativeTextOpId, b: CollaborativeTextOpId) =>
  a.counter - b.counter || (a.site < b.site ? -1 : a.site > b.site ? 1 : 0)

/**
 * One replica of a replicated growable array (RGA).
 *
 * Every character keeps the id it was born with and the id it was typed after.
 * A concurrent insert after the same character is placed by comparing ids, so
 * every replica orders it the same way whatever order the operations arrive
 * in; deletes leave a tombstone, so an insert after a deleted character still
 * has somewhere to go. Operations whose dependency has not arrived yet wait in
 * a queue, and duplicates are ignored — delivery can be late, reordered or
 * repeated and the replicas still converge.
 */
export class CollaborativeTextDoc {
  readonly site: string
  private clock = 0
  private nodes: RgaNode[] = []
  private byKey = new Map<string, RgaNode>()
  private log: CollaborativeTextOperation[] = []
  private waiting: CollaborativeTextOperation[] = []
  private listeners = new Set<(remote: boolean) => void>()
  /** Increments on every change; a cheap snapshot for React. */
  version = 0

  constructor(site: string, initial = '') {
    this.site = site
    if (initial) {
      // A shared seed with a fixed site, so every replica starts identical.
      let after: CollaborativeTextOpId | null = null
      for (let i = 0; i < initial.length; i += 1) {
        const id = { counter: ++this.clock, site: '' }
        this.integrate({ type: 'insert', id, after, value: initial[i]! })
        after = id
      }
    }
  }

  /** The visible text. */
  text() {
    let out = ''
    for (const node of this.nodes) if (!node.deleted) out += node.value
    return out
  }

  /** Every operation this replica has integrated, for syncing a newcomer. */
  operations() {
    return [...this.log]
  }

  /** Operations received whose dependencies have not arrived. */
  get pending() {
    return this.waiting.length
  }

  subscribe = (listener: (remote: boolean) => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  /** Id of the visible character at `index`, or null before the first. */
  idBefore(index: number): string | null {
    if (index <= 0) return null
    let seen = 0
    for (const node of this.nodes) if (!node.deleted && ++seen === index) return node.key
    const visible = this.nodes.filter((node) => !node.deleted)
    return visible[visible.length - 1]?.key ?? null
  }

  /** Visible index just after a character, deleted or not — how a caret survives remote edits. */
  indexAfter(key: string | null) {
    if (key === null) return 0
    let seen = 0
    for (const node of this.nodes) {
      if (!node.deleted) seen += 1
      if (node.key === key) return seen
    }
    return seen
  }

  /** Inserts `value` at a visible index and returns the operations to broadcast. */
  insert(index: number, value: string): CollaborativeTextOperation[] {
    const ops: CollaborativeTextOperation[] = []
    const anchor = this.idBefore(index)
    let after = anchor ? this.byKey.get(anchor)!.id : null
    // UTF-16 units, not code points, so indices match the textarea's own.
    for (let i = 0; i < value.length; i += 1) {
      const id = { counter: ++this.clock, site: this.site }
      const op: CollaborativeTextOperation = { type: 'insert', id, after, value: value[i]! }
      this.integrate(op)
      ops.push(op)
      after = id
    }
    if (ops.length) this.emit(false)
    return ops
  }

  /** Deletes `length` visible characters from `index`. */
  remove(index: number, length: number): CollaborativeTextOperation[] {
    const targets = this.nodes.filter((node) => !node.deleted).slice(index, index + length)
    const ops = targets.map((node): CollaborativeTextOperation => ({ type: 'delete', id: node.id }))
    ops.forEach((op) => this.integrate(op))
    if (ops.length) this.emit(false)
    return ops
  }

  /** Applies remote operations in any order. Returns how many took effect. */
  apply(ops: CollaborativeTextOperation[]) {
    let applied = 0
    let queue = [...this.waiting, ...ops]
    this.waiting = []
    // Keep sweeping while something lands: one arrival can unblock a chain.
    for (let progress = true; progress && queue.length; ) {
      progress = false
      const blocked: CollaborativeTextOperation[] = []
      for (const op of queue) {
        const result = this.integrate(op)
        if (result === 'blocked') blocked.push(op)
        else if (result === 'applied') (applied += 1), (progress = true)
      }
      queue = blocked
    }
    this.waiting = queue
    if (applied) this.emit(true)
    return applied
  }

  private integrate(op: CollaborativeTextOperation): 'applied' | 'duplicate' | 'blocked' {
    this.clock = Math.max(this.clock, op.id.counter)
    if (op.type === 'delete') {
      const node = this.byKey.get(keyOf(op.id))
      if (!node) return 'blocked'
      if (node.deleted) return 'duplicate'
      node.deleted = true
      this.log.push(op)
      return 'applied'
    }
    const key = keyOf(op.id)
    if (this.byKey.has(key)) return 'duplicate'
    let index = 0
    if (op.after) {
      const ref = this.byKey.get(keyOf(op.after))
      if (!ref) return 'blocked'
      index = this.nodes.indexOf(ref) + 1
    }
    // The RGA rule: skip anything newer already sitting after the reference.
    while (index < this.nodes.length && compare(this.nodes[index]!.id, op.id) > 0) index += 1
    const node = { id: op.id, key, value: op.value, deleted: false }
    this.nodes.splice(index, 0, node)
    this.byKey.set(key, node)
    this.log.push(op)
    return 'applied'
  }

  private emit(remote: boolean) {
    this.version += 1
    this.listeners.forEach((listener) => listener(remote))
  }
}

export interface CollaborativeTextProps {
  /** The replica this field edits. Create one per peer with `new CollaborativeTextDoc(site)`. */
  doc: CollaborativeTextDoc
  /** Local edits, as operations to send to the other replicas. */
  onOperations?: (ops: CollaborativeTextOperation[]) => void
  /** Also sync with other tabs of this origin over a BroadcastChannel of this name. */
  channel?: string
  /** Accessible name. */
  label: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A textarea bound to a sequence CRDT replica.
 *
 * Each keystroke is diffed against the replica — common prefix and suffix off,
 * what is left is a delete and an insert — and turned into operations. Remote
 * operations change the text under the caret, so the caret is remembered as
 * the id of the character before it rather than as a number; tombstones mean
 * that id still exists after a remote delete, and the caret lands where the
 * person left it.
 */
export function CollaborativeText({ doc, onOperations, channel, label, rows = 6, placeholder, disabled, className }: CollaborativeTextProps) {
  const version = useSyncExternalStore(doc.subscribe, () => doc.version, () => doc.version)
  const ref = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<{ start: string | null; end: string | null }>({ start: null, end: null })
  const busRef = useRef<BroadcastChannel | null>(null)
  const text = doc.text()

  const remember = () => {
    const field = ref.current
    if (!field) return
    caret.current = { start: doc.idBefore(field.selectionStart), end: doc.idBefore(field.selectionEnd) }
  }

  useIsomorphicLayoutEffect(() => {
    const field = ref.current
    if (!field || document.activeElement !== field) return
    field.setSelectionRange(doc.indexAfter(caret.current.start), doc.indexAfter(caret.current.end))
  }, [version])

  useEffect(() => {
    if (!channel || typeof BroadcastChannel === 'undefined') return
    const bus = new BroadcastChannel(channel)
    busRef.current = bus
    bus.onmessage = (event: MessageEvent<{ type: string; ops?: CollaborativeTextOperation[] }>) => {
      if (event.data.type === 'ops' && event.data.ops) doc.apply(event.data.ops)
      if (event.data.type === 'hello') bus.postMessage({ type: 'ops', ops: doc.operations() })
    }
    bus.postMessage({ type: 'hello' })
    return () => {
      bus.close()
      busRef.current = null
    }
  }, [channel, doc])

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    let start = 0
    while (start < text.length && start < next.length && text[start] === next[start]) start += 1
    let tail = 0
    while (tail < text.length - start && tail < next.length - start && text[text.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1
    const ops = [...doc.remove(start, text.length - start - tail), ...doc.insert(start, next.slice(start, next.length - tail))]
    remember()
    if (ops.length) {
      onOperations?.(ops)
      busRef.current?.postMessage({ type: 'ops', ops })
    }
  }

  return (
    <Textarea
      ref={ref}
      aria-label={label}
      value={text}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      onSelect={remember}
      onKeyUp={remember}
      onClick={remember}
      spellCheck={false}
      className={cn('font-mono text-[12.5px]', className)}
    />
  )
}
