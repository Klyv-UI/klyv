'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Popover } from '../Popover'
import { CheckIcon, ChevronRightIcon, MinusIcon, SearchIcon, SelectorIcon } from '../internal/icons'

export interface TreeSelectNode {
  id: string
  label: string
  /** Shown but cannot be chosen. In multiple mode its leaves are skipped by a parent’s check. */
  disabled?: boolean
  children?: TreeSelectNode[]
}

export interface TreeSelectProps {
  /** The hierarchy. */
  nodes: TreeSelectNode[]
  /** Controlled ids. In multiple mode these are leaf ids; a branch is checked when all its leaves are. */
  value?: string[]
  /** Starting ids when uncontrolled. */
  defaultValue?: string[]
  /** Called with the chosen ids, in tree order. */
  onValueChange?: (value: string[]) => void
  /** Checkboxes and many values, instead of one. */
  multiple?: boolean
  /** Accessible name for the trigger and the tree. */
  label: string
  /** Shown on the trigger while nothing is chosen. */
  placeholder?: string
  /** Show a filter above the tree that reveals matching branches. */
  searchable?: boolean
  /** Chips shown on the trigger before the rest collapse into “+N”. */
  maxChips?: number
  /** Ids expanded when the panel first opens. */
  defaultExpanded?: string[]
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Marks the control as failing validation. */
  invalid?: boolean
  /** Goes on the trigger, so a Field label points at it. */
  id?: string
  /** Merged onto the trigger. */
  className?: string
}

interface TreeSelectRow {
  node: TreeSelectNode
  depth: number
  parentId?: string
  position: number
  siblings: number
}

type Check = boolean | 'mixed'

function walk(nodes: TreeSelectNode[], visit: (node: TreeSelectNode, parent?: TreeSelectNode) => void, parent?: TreeSelectNode) {
  for (const node of nodes) {
    visit(node, parent)
    if (node.children) walk(node.children, visit, node)
  }
}

/** Enabled leaves at or under a node — what checking it means. */
function leavesOf(node: TreeSelectNode): string[] {
  if (node.disabled) return []
  if (!node.children?.length) return [node.id]
  return node.children.flatMap(leavesOf)
}

/** Keeps every node that matches, with its whole subtree, and the ancestors that lead to one. */
function filterTree(nodes: TreeSelectNode[], needle: string, reveal: Set<string>): TreeSelectNode[] {
  return nodes.flatMap((node) => {
    if (node.label.toLowerCase().includes(needle)) return [node]
    const children = filterTree(node.children ?? [], needle, reveal)
    if (children.length === 0) return []
    reveal.add(node.id)
    return [{ ...node, children }]
  })
}

function flatten(nodes: TreeSelectNode[], expanded: Set<string>, depth = 0, parentId?: string): TreeSelectRow[] {
  return nodes.flatMap((node, index) => [
    { node, depth, parentId, position: index + 1, siblings: nodes.length },
    ...(node.children?.length && expanded.has(node.id) ? flatten(node.children, expanded, depth + 1, node.id) : []),
  ])
}

/**
 * A select whose options are a hierarchy — a team inside a department, a
 * category inside a catalogue.
 *
 * Flattening a tree into a long Select loses the one thing that helps people
 * find an option: where it lives. This keeps the tree, inside a popover, with
 * the WAI-ARIA tree keyboard model — arrows move, Right opens or steps in, Left
 * closes or steps out, Enter chooses — and a filter that reveals the branches
 * a match is in rather than listing it out of context.
 *
 * In multiple mode a parent is a shortcut for its leaves: checking it checks
 * every enabled leaf below, and its box is mixed when only some are. The value
 * holds leaves only, so “all of Engineering” and every engineering team ticked
 * one by one are the same value, not two that have to be reconciled.
 */
export function TreeSelect({
  nodes,
  value,
  defaultValue = [],
  onValueChange,
  multiple = false,
  label,
  placeholder = 'Choose…',
  searchable = true,
  maxChips = 3,
  defaultExpanded = [],
  disabled = false,
  invalid = false,
  id,
  className,
}: TreeSelectProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selected = useMemo(() => new Set(value ?? uncontrolled), [value, uncontrolled])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded))
  const [focused, setFocused] = useState<string>()
  const treeRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const moveDomFocus = useRef(false)

  const { byId, order } = useMemo(() => {
    const map = new Map<string, TreeSelectNode>()
    const ids: string[] = []
    walk(nodes, (node) => {
      map.set(node.id, node)
      ids.push(node.id)
    })
    return { byId: map, order: ids }
  }, [nodes])

  const needle = query.trim().toLowerCase()
  const reveal = new Set<string>()
  const shown = needle ? filterTree(nodes, needle, reveal) : nodes

  // A search opens the branches its matches are in; the reader can still close them.
  useEffect(() => {
    if (needle) setExpanded(new Set(reveal))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle])

  const rows = flatten(shown, expanded)
  const tabStop = rows.some((row) => row.node.id === focused) ? focused : rows[0]?.node.id

  useEffect(() => {
    if (!moveDomFocus.current) return
    moveDomFocus.current = false
    treeRef.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus()
  }, [focused, rows.length])

  const commit = (next: Set<string>) => {
    const ordered = order.filter((nodeId) => next.has(nodeId))
    if (value === undefined) setUncontrolled(ordered)
    onValueChange?.(ordered)
  }

  const checkOf = (node: TreeSelectNode): Check => {
    const leaves = leavesOf(byId.get(node.id) ?? node)
    const on = leaves.filter((leaf) => selected.has(leaf)).length
    return leaves.length > 0 && on === leaves.length ? true : on > 0 ? 'mixed' : false
  }

  const choose = (node: TreeSelectNode) => {
    if (node.disabled) return
    if (!multiple) {
      commit(new Set([node.id]))
      setOpen(false)
      return
    }
    const leaves = leavesOf(byId.get(node.id) ?? node)
    const next = new Set(selected)
    const on = checkOf(node) !== true
    leaves.forEach((leaf) => (on ? next.add(leaf) : next.delete(leaf)))
    commit(next)
  }

  const toggle = (nodeId: string, force?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (force ?? !next.has(nodeId)) next.add(nodeId)
      else next.delete(nodeId)
      return next
    })

  const focusRow = (nodeId?: string) => {
    if (!nodeId) return
    moveDomFocus.current = true
    setFocused(nodeId)
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: TreeSelectRow, index: number) => {
    const { node } = row
    const branch = Boolean(node.children?.length)
    const isOpen = expanded.has(node.id)
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(rows[Math.min(rows.length - 1, index + 1)]?.node.id),
      ArrowUp: () => (index === 0 && searchable ? searchRef.current?.focus() : focusRow(rows[Math.max(0, index - 1)]?.node.id)),
      Home: () => focusRow(rows[0]?.node.id),
      End: () => focusRow(rows[rows.length - 1]?.node.id),
      ArrowRight: () => (branch && !isOpen ? toggle(node.id, true) : branch ? focusRow(rows[index + 1]?.node.id) : undefined),
      ArrowLeft: () => (branch && isOpen ? toggle(node.id, false) : focusRow(row.parentId)),
      Enter: () => choose(node),
      ' ': () => choose(node),
    }
    const handler = keys[event.key]
    if (handler) {
      event.preventDefault()
      handler()
      return
    }
    // Type-ahead: the next visible row starting with the letter.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const letter = event.key.toLowerCase()
      const later = [...rows.slice(index + 1), ...rows.slice(0, index)]
      focusRow(later.find((candidate) => candidate.node.label.toLowerCase().startsWith(letter))?.node.id)
    }
  }

  const chosen = order.filter((nodeId) => selected.has(nodeId)).map((nodeId) => byId.get(nodeId)!)
  const summary = chosen.map((node) => node.label).join(', ')

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
        if (!next) setQuery('')
      }}
      label={label}
      placement="bottom"
      align="start"
      initialFocus={searchable ? 'input' : '[role="treeitem"][tabindex="0"]'}
      className="flex w-[300px] flex-col gap-1 p-1.5"
      trigger={
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="tree"
          aria-expanded={open}
          aria-controls={open ? `${uid}-tree` : undefined}
          aria-label={id ? undefined : label}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'flex min-h-10 w-full min-w-[220px] items-center gap-2 rounded-[20px] border border-line bg-surface py-1.5 pl-3 pr-3 text-left text-[13px] font-medium text-ink transition-colors',
            'hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40',
            invalid && 'border-danger',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {chosen.length === 0 && <span className="text-ink-faint">{placeholder}</span>}
            {!multiple && chosen[0] && <span className="truncate">{chosen[0].label}</span>}
            {multiple &&
              chosen.slice(0, maxChips).map((node) => (
                <span key={node.id} className="inline-flex h-6 max-w-[140px] items-center rounded-full bg-surface-muted px-2.5 text-[12px] font-semibold text-ink-soft">
                  <span className="truncate">{node.label}</span>
                </span>
              ))}
            {multiple && chosen.length > maxChips && (
              <span className="inline-flex h-6 items-center rounded-full px-1.5 text-[12px] font-semibold text-ink-faint" title={summary}>
                +{chosen.length - maxChips}
              </span>
            )}
          </span>
          <SelectorIcon size={14} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      {searchable && (
        <Input
          ref={searchRef}
          inputSize="sm"
          type="search"
          aria-label={`Filter ${label}`}
          placeholder="Filter"
          value={query}
          leading={<SearchIcon size={14} />}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              focusRow(tabStop)
              treeRef.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus()
            }
          }}
        />
      )}
      <div
        ref={treeRef}
        role="tree"
        id={`${uid}-tree`}
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        className="flex max-h-[280px] flex-col overflow-y-auto"
      >
        {rows.map((row, index) => {
          const { node, depth, position, siblings } = row
          const branch = Boolean(node.children?.length)
          const isOpen = expanded.has(node.id)
          const check = multiple ? checkOf(node) : selected.has(node.id)
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-posinset={position}
              aria-setsize={siblings}
              aria-expanded={branch ? isOpen : undefined}
              aria-checked={multiple ? check : undefined}
              aria-selected={multiple ? undefined : check === true}
              aria-disabled={node.disabled || undefined}
              tabIndex={node.id === tabStop ? 0 : -1}
              onKeyDown={(event) => onRowKeyDown(event, row, index)}
              onFocus={() => setFocused(node.id)}
              onClick={() => choose(node)}
              style={{ paddingLeft: depth * 16 + 4 }}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-[10px] py-1.5 pr-2.5 text-[13px] font-semibold text-ink-soft outline-none transition-colors',
                'hover:bg-surface-sunken focus-visible:bg-surface-muted focus-visible:text-ink focus-visible:ring-1 focus-visible:ring-ink-faint',
                !multiple && check === true && 'bg-surface-muted text-ink',
                node.disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              {branch ? (
                <span
                  aria-hidden="true"
                  onClick={(event) => {
                    // The chevron opens the branch; the rest of the row chooses it.
                    event.stopPropagation()
                    toggle(node.id)
                  }}
                  className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-ink-faint hover:bg-line-strong"
                >
                  <ChevronRightIcon size={12} className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} />
                </span>
              ) : (
                <span aria-hidden="true" className="size-5 shrink-0" />
              )}
              {multiple && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-accent-ink',
                    check ? 'border-accent-strong bg-accent-strong' : 'border-line-strong bg-surface',
                  )}
                >
                  {check === true && <CheckIcon size={11} strokeWidth={2.75} />}
                  {check === 'mixed' && <MinusIcon size={11} strokeWidth={2.75} />}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {!multiple && check === true && <CheckIcon size={13} className="shrink-0 text-ink" />}
            </div>
          )
        })}
        {rows.length === 0 && <p className="px-3 py-4 text-center text-[12px] font-medium text-ink-faint">No matches</p>}
      </div>
      {multiple && chosen.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-2 pt-1.5 text-[12px] font-medium text-ink-faint">
          <span aria-live="polite">{chosen.length} selected</span>
          <button type="button" onClick={() => commit(new Set())} className="rounded-full px-2 py-1 font-semibold text-ink-soft hover:bg-surface-muted hover:text-ink">
            Clear
          </button>
        </div>
      )}
    </Popover>
  )
}
