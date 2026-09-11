'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { ChevronRightIcon } from '../internal/icons'
import { Surface } from '../Surface'

export interface JsonViewerProps {
  /** Any JSON-serialisable value. */
  data: unknown
  /** Accessible name for the viewer. */
  label: string
  /** How many levels start open. */
  defaultExpandDepth?: number
  /** Name shown for the root. Omit to show the root's contents directly. */
  rootName?: string
  /** Merged last, so it wins. */
  className?: string
}

/** The code palette, so JSON here and in a CodeBlock read the same. */
const COLOR = {
  string: 'var(--syntax-string)',
  number: 'var(--syntax-number)',
  literal: 'var(--syntax-keyword)',
}

function Primitive({ value }: { value: unknown }) {
  if (typeof value === 'string') return <span style={{ color: COLOR.string }}>"{value}"</span>
  if (typeof value === 'number') return <span style={{ color: COLOR.number }}>{String(value)}</span>
  if (typeof value === 'boolean' || value === null) {
    return <span style={{ color: COLOR.literal }}>{String(value)}</span>
  }
  return <span className="text-ink-faint">{String(value)}</span>
}

function Key({ name, quoted }: { name: string; quoted: boolean }) {
  return (
    <>
      <span className="text-ink">{quoted ? `"${name}"` : name}</span>
      <span className="text-ink-faint">: </span>
    </>
  )
}

function Branch({
  name,
  quoted,
  value,
  depth,
  expandDepth,
}: {
  name?: string
  quoted: boolean
  value: unknown
  depth: number
  expandDepth: number
}) {
  const nested = value !== null && typeof value === 'object'
  const [open, setOpen] = useState(depth < expandDepth)

  if (!nested) {
    return (
      <li className="py-px pl-[18px]">
        {name !== undefined && <Key name={name} quoted={quoted} />}
        <Primitive value={value} />
      </li>
    )
  }

  const array = Array.isArray(value)
  const entries: [string, unknown][] = array
    ? (value as unknown[]).map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>)
  const summary = array ? `[${entries.length}]` : `{${entries.length}}`

  return (
    <li className="py-px">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-[var(--radius-glyph)] pr-1 text-left transition-colors hover:bg-surface-muted"
      >
        <ChevronRightIcon
          size={12}
          className={cn('shrink-0 text-ink-faint transition-transform motion-safe-only', open && 'rotate-90')}
        />
        {name !== undefined && <Key name={name} quoted={quoted} />}
        <span className="text-ink-faint">{summary}</span>
      </button>

      {open && entries.length > 0 && (
        <ul className="ml-[5px] border-l border-line pl-3">
          {entries.map(([key, item]) => (
            <Branch
              key={key}
              name={key}
              quoted={!array}
              value={item}
              depth={depth + 1}
              expandDepth={expandDepth}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * A payload, as a collapsible tree — an API response, a webhook body, a log line.
 *
 * Each object and array is a disclosure button with aria-expanded, so the tree
 * is navigable by Tab and announced as open or closed without the full ARIA
 * tree pattern a reader would have to learn. Values take the code palette, so
 * JSON here and JSON in a CodeBlock read the same, and nothing is truncated:
 * collapsing hides a branch, it never cuts a value short.
 */
export function JsonViewer({
  data,
  label,
  defaultExpandDepth = 1,
  rootName,
  className,
}: JsonViewerProps) {
  const top =
    rootName === undefined && data !== null && typeof data === 'object'
      ? Array.isArray(data)
        ? data.map((item, index) => [String(index), item] as [string, unknown])
        : Object.entries(data as Record<string, unknown>)
      : null

  return (
    <Surface
      variant="sunken"
      padding="sm"
      className={cn('overflow-auto font-mono text-[12px] leading-relaxed', className)}
    >
      <ul aria-label={label}>
        {top
          ? top.map(([key, item]) => (
              <Branch
                key={key}
                name={key}
                quoted={!Array.isArray(data)}
                value={item}
                depth={1}
                expandDepth={defaultExpandDepth + 1}
              />
            ))
          : (
              <Branch
                name={rootName}
                quoted={false}
                value={data}
                depth={0}
                expandDepth={defaultExpandDepth}
              />
            )}
      </ul>
    </Surface>
  )
}
