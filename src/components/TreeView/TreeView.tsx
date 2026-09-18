'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { ChevronRightIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface TreeNode {
  id: string
  label: string
  icon?: IconComponent
  /** Count or status on the right. */
  meta?: ReactNode
  children?: TreeNode[]
}

export interface TreeViewProps {
  nodes: TreeNode[]
  /** Accessible name for the tree. */
  label: string
  /** Ids expanded on first render. */
  defaultExpanded?: string[]
  selected?: string
  onSelect?: (id: string) => void
  /** Merged last, so it wins. */
  className?: string
}

interface VisibleRow {
  node: TreeNode
  depth: number
  parentId?: string
  /** Position among its siblings, and how many there are — for aria-posinset/setsize. */
  position: number
  siblings: number
}

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0, parentId?: string): VisibleRow[] {
  return nodes.flatMap((node, index) => [
    { node, depth, parentId, position: index + 1, siblings: nodes.length },
    ...(node.children && expanded.has(node.id) ? flatten(node.children, expanded, depth + 1, node.id) : []),
  ])
}

/**
 * Recursive disclosure with the full tree keyboard model: up and down move
 * through visible rows, right expands or steps in, left collapses or steps out,
 * Home and End jump to the ends.
 *
 * Rows carry aria-level, aria-expanded and aria-selected, so depth and state
 * are announced rather than only indented.
 */
export function TreeView({
  nodes,
  label,
  defaultExpanded = [],
  selected,
  onSelect,
  className,
}: TreeViewProps) {
  const [expanded, setExpanded] = useState(new Set(defaultExpanded))
  const [focused, setFocused] = useState<string | undefined>(nodes[0]?.id)
  const treeRef = useRef<HTMLDivElement>(null)
  const moveDomFocus = useRef(false)

  const visible = flatten(nodes, expanded)

  // If the focused row goes away — its parent collapsed, the data changed —
  // the tree would have no tab stop at all. The nearest thing left takes it.
  const tabStop = visible.some((row) => row.node.id === focused) ? focused : visible[0]?.node.id

  // Arrows used to move the tab stop and leave focus behind: the ring stayed on
  // the first row and every later press started from there again.
  useEffect(() => {
    if (!moveDomFocus.current) return
    moveDomFocus.current = false
    treeRef.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus()
  }, [focused])

  const toggle = (id: string, open?: boolean) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      const shouldOpen = open ?? !next.has(id)
      if (shouldOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, node: TreeNode, index: number) => {
    const focusRow = (id: string | undefined) => {
      if (!id) return
      moveDomFocus.current = true
      setFocused(id)
    }
    const move = (target: number) => {
      event.preventDefault()
      focusRow(visible[Math.min(visible.length - 1, Math.max(0, target))]?.node.id)
    }

    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(visible.length - 1)
    else if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (node.children && !expanded.has(node.id)) toggle(node.id, true)
      else if (node.children) move(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      // Collapse an open parent; otherwise step out to the parent — not to
      // whatever row happens to sit above, which is what this used to do.
      if (node.children && expanded.has(node.id)) toggle(node.id, false)
      else focusRow(visible[index].parentId)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (node.children) toggle(node.id)
      onSelect?.(node.id)
    }
  }

  return (
    <div ref={treeRef} role="tree" aria-label={label} className={cn('flex flex-col', className)}>
      {visible.map(({ node, depth, position, siblings }, index) => {
        const hasChildren = Boolean(node.children?.length)
        const isOpen = expanded.has(node.id)
        const Icon = node.icon
        return (
          <div
            key={node.id}
            role="treeitem"
            aria-level={depth + 1}
            // The rows are a flat list in the DOM, so the tree's shape has to be
            // stated: "3 of 5" is otherwise lost to a screen reader.
            aria-posinset={position}
            aria-setsize={siblings}
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-selected={node.id === selected}
            tabIndex={node.id === tabStop ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, node, index)}
            onFocus={() => setFocused(node.id)}
            onClick={() => {
              if (hasChildren) toggle(node.id)
              onSelect?.(node.id)
            }}
            style={{ paddingLeft: depth * 16 + 8 }}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-[var(--radius-10)] py-1.5 pr-2.5 transition-colors',
              node.id === selected ? 'bg-surface-muted' : 'hover:bg-surface-sunken',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center text-ink-faint transition-transform',
                !hasChildren && 'opacity-0',
                isOpen && 'rotate-90',
              )}
            >
              <ChevronRightIcon size={12} />
            </span>
            {Icon && (
              <Icon size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-soft" />
            )}
            <Text
              as="span"
              size="body"
              weight={hasChildren ? 'bold' : 'medium'}
              truncate
              className="min-w-0 flex-1"
            >
              {node.label}
            </Text>
            {node.meta}
          </div>
        )
      })}
    </div>
  )
}
