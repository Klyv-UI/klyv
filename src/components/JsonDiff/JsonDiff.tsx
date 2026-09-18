'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SegmentedControl } from '../SegmentedControl'
import { Textarea } from '../Textarea'
import { ChevronRightIcon } from '../internal/icons'
import { changes, count, diff, type JsonDiffChange, type JsonDiffNode } from './diff'

export interface JsonDiffProps {
  /** The old value. */
  before: unknown
  /** The new value. */
  after: unknown
  /** Show both sides as editable JSON above the diff. */
  editable?: boolean
  /** Array elements are matched by the first of these fields they all carry. */
  keys?: string[]
  /** Heading of the old side. */
  beforeLabel?: string
  /** Heading of the new side. */
  afterLabel?: string
  /** Which view opens first. */
  defaultView?: 'changes' | 'tree'
  /** Merged last, so it wins. */
  className?: string
}

const STATUS_TINT = {
  added: 'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)]',
  removed: 'bg-[color-mix(in_oklab,var(--color-danger)_11%,transparent)]',
  changed: 'bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)]',
  moved: 'bg-[color-mix(in_oklab,var(--syntax-type)_14%,transparent)]',
}

const OP_LABEL: Record<JsonDiffChange['op'], string> = { add: 'Added', remove: 'Removed', replace: 'Changed', move: 'Moved' }
const OP_STYLE: Record<JsonDiffChange['op'], string> = {
  add: 'text-success',
  remove: 'text-danger',
  replace: 'text-[color-mix(in_oklab,var(--color-warning)_45%,var(--color-ink))]',
  move: 'text-[var(--syntax-type)]',
}

const brief = (value: unknown, max = 60) => {
  const text = JSON.stringify(value) ?? 'undefined'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function parse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Not valid JSON' }
  }
}

/**
 * What changed between two JSON documents, as a list of operations and as the
 * two documents side by side.
 *
 * A line diff of pretty-printed JSON reports noise — a key that moved, a
 * trailing comma, a reordered array — and misses structure. This compares
 * values: object keys by name, arrays by a longest common subsequence, and
 * arrays of records by their `id`, so a record that moved is one move rather
 * than a removal and an addition. Every change carries its JSON Pointer, and
 * the side-by-side tree folds unchanged branches away so the edits are what
 * you see.
 */
export function JsonDiff({
  before,
  after,
  editable = false,
  keys = ['id', 'key'],
  beforeLabel = 'Before',
  afterLabel = 'After',
  defaultView = 'changes',
  className,
}: JsonDiffProps) {
  const uid = useId()
  const [leftText, setLeftText] = useState(() => JSON.stringify(before, null, 2))
  const [rightText, setRightText] = useState(() => JSON.stringify(after, null, 2))
  const [view, setView] = useState<'changes' | 'tree'>(defaultView)
  const left = useMemo(() => (editable ? parse(leftText) : ({ ok: true, value: before } as const)), [editable, leftText, before])
  const right = useMemo(() => (editable ? parse(rightText) : ({ ok: true, value: after } as const)), [editable, rightText, after])
  const keyList = JSON.stringify(keys)
  const tree = useMemo(
    () => (left.ok && right.ok ? diff(left.value, right.value, null, '', '', JSON.parse(keyList) as string[]) : null),
    [left, right, keyList],
  )
  const list = useMemo(() => (tree ? changes(tree) : []), [tree])
  const totals = count(list)

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      {editable && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: beforeLabel, text: leftText, set: setLeftText, parsed: left, id: `${uid}-before` },
            { label: afterLabel, text: rightText, set: setRightText, parsed: right, id: `${uid}-after` },
          ].map((side) => (
            <div key={side.id} className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={side.id} className="text-[12px] font-semibold text-ink">
                {side.label}
              </label>
              <Textarea
                id={side.id}
                value={side.text}
                onChange={(event) => side.set(event.target.value)}
                invalid={!side.parsed.ok}
                aria-describedby={side.parsed.ok ? undefined : `${side.id}-error`}
                rows={8}
                spellCheck={false}
                className="font-mono text-[12px]"
              />
              {!side.parsed.ok && (
                <span id={`${side.id}-error`} className="text-[11px] font-semibold text-danger">
                  {side.parsed.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tree && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-soft">
              {list.length === 0 ? (
                <span>No differences</span>
              ) : (
                <>
                  <span className="text-success">{totals.added} added</span>
                  <span className="text-danger">{totals.removed} removed</span>
                  <span className={OP_STYLE.replace}>{totals.changed} changed</span>
                  <span className={OP_STYLE.move}>{totals.moved} moved</span>
                </>
              )}
            </p>
            <SegmentedControl
              label="Diff view"
              size="sm"
              value={view}
              onValueChange={setView}
              options={[
                { value: 'changes', label: 'Changes' },
                { value: 'tree', label: 'Side by side' },
              ]}
            />
          </div>

          {view === 'changes' ? (
            list.length > 0 && (
              <ol className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
                {list.map((change, index) => (
                  <li key={index} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className={cn('w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider', OP_STYLE[change.op])}>{OP_LABEL[change.op]}</span>
                    <code className="shrink-0 font-mono text-[12px] font-semibold text-ink">{change.path || '(root)'}</code>
                    <span className="min-w-0 truncate font-mono text-[12px] text-ink-soft">
                      {change.op === 'add' && brief(change.after)}
                      {change.op === 'remove' && brief(change.before)}
                      {change.op === 'replace' && `${brief(change.before, 30)} → ${brief(change.after, 30)}`}
                      {change.op === 'move' && `from ${change.from}`}
                    </span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-tile)] border border-line">
              <div className="grid min-w-[480px] grid-cols-2 border-b border-line bg-surface-muted text-[11px] font-bold text-ink-soft">
                <span className="px-3 py-2">{beforeLabel}</span>
                <span className="border-l border-line px-3 py-2">{afterLabel}</span>
              </div>
              <div className="min-w-[480px] py-1 font-mono text-[12px]">
                <TreeRows node={tree} depth={0} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Cell({ text, tint, depth, faint, children }: { text?: string; tint?: string; depth: number; faint?: boolean; children?: ReactNode }) {
  return (
    <div className={cn('min-w-0 truncate px-3 py-0.5', tint, faint ? 'text-ink-faint' : 'text-ink')} style={{ paddingInlineStart: `${20 + depth * 14}px` }}>
      {children}
      {text}
    </div>
  )
}

function TreeRows({ node, depth }: { node: JsonDiffNode; depth: number }) {
  const [open, setOpen] = useState(node.status !== 'same')
  const label = node.key === null ? '' : `${typeof node.key === 'number' ? node.key : JSON.stringify(node.key)}: `

  if (node.children && node.container) {
    const [o, c] = node.container === 'array' ? ['[', ']'] : ['{', '}']
    const size = node.children.length
    const note = node.status === 'moved' ? ` ← was ${node.from}` : ''
    const toggle = (
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${node.path || 'root'}`}
        onClick={() => setOpen(!open)}
        className="-ml-4 mr-0.5 inline-flex size-3.5 items-center justify-center rounded-[var(--radius-3)] align-middle text-ink-faint hover:text-ink"
      >
        <ChevronRightIcon size={11} className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-90')} />
      </button>
    )
    const tint = node.status === 'moved' ? STATUS_TINT.moved : undefined
    return (
      <>
        <div className="grid grid-cols-2">
          <Cell depth={depth} text={`${label}${o}${open ? '' : ` … ${size} ${node.container === 'array' ? 'items' : 'keys'} ${c}`}`} faint={node.status === 'same'}>
            {toggle}
          </Cell>
          <div className="border-l border-line">
            <Cell depth={depth} tint={tint} text={`${label}${o}${open ? '' : ` … ${c}`}${note}`} faint={node.status === 'same'} />
          </div>
        </div>
        {open && node.children.map((child, index) => <TreeRows key={`${child.path}-${index}`} node={child} depth={depth + 1} />)}
        {open && (
          <div className="grid grid-cols-2">
            <Cell depth={depth} text={c} faint={node.status === 'same'} />
            <div className="border-l border-line">
              <Cell depth={depth} text={c} faint={node.status === 'same'} />
            </div>
          </div>
        )}
      </>
    )
  }

  const status = node.status
  const leftText = status === 'added' ? '' : `${label}${brief(node.before, 80)}`
  const rightText = status === 'removed' ? '' : `${label}${brief(node.after, 80)}${status === 'moved' ? ` ← was ${node.from}` : ''}`
  const leftTint = status === 'removed' ? STATUS_TINT.removed : status === 'changed' ? STATUS_TINT.changed : undefined
  const rightTint = status === 'added' ? STATUS_TINT.added : status === 'changed' ? STATUS_TINT.changed : status === 'moved' ? STATUS_TINT.moved : undefined
  return (
    <div className="grid grid-cols-2">
      <Cell depth={depth} text={leftText} tint={leftTint} faint={status === 'same'} />
      <div className="border-l border-line">
        <Cell depth={depth} text={rightText} tint={rightTint} faint={status === 'same'} />
      </div>
    </div>
  )
}
