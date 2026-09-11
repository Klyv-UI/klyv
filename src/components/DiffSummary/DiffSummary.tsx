'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'

export interface FieldChange {
  field: string
  /** The field's name in the reader's language, not the schema's. */
  label: string
  from?: ReactNode
  to?: ReactNode
  /** The field is being set for the first time. */
  added?: boolean
  /** The field is being cleared. */
  removed?: boolean
  /** Say why this one matters — a limit rise, a payee change. */
  note?: string
}

export interface DiffSummaryProps {
  changes: FieldChange[]
  /** Accessible name. */
  label: string
  /** Put a single field back. */
  onRevert?: (field: string) => void
  /** Copy shown when nothing has changed. */
  emptyLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The list of what is about to change, before it is submitted.
 *
 * A form that has been edited for ten minutes is not a thing anyone can review
 * by looking at it — the fields show what the values *will be*, and the reader
 * has long since forgotten what they *were*. This states both, per field, at
 * the moment it matters.
 *
 * Cleared and newly set fields are called out rather than shown as a change
 * from an empty string. "Reference: removed" is a different fact from
 * "Reference: 'ABC' → ''", and only one of them reads as deliberate.
 *
 * Reverting is per field. A single Discard forces an all-or-nothing decision on
 * someone who has spotted one mistake among six deliberate edits, and it is why
 * that person retypes everything instead.
 */
export function DiffSummary({
  changes,
  label,
  onRevert,
  emptyLabel = 'Nothing has changed yet.',
  className,
}: DiffSummaryProps) {
  if (changes.length === 0) {
    return (
      <Text size="caption" tone="faint" className={className}>
        {emptyLabel}
      </Text>
    )
  }

  return (
    <Surface
      variant="tile"
      padding="md"
      role="group"
      aria-label={label}
      className={cn('gap-2', className)}
    >
      <Text size="caption" weight="bold" role="status" aria-live="polite">
        {changes.length} {changes.length === 1 ? 'change' : 'changes'} to review
      </Text>

      <ul className="flex flex-col divide-y divide-line">
        {changes.map((change) => (
          <li key={change.field} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
            <Text as="span" size="caption" tone="faint" className="min-w-[110px]">
              {change.label}
            </Text>

            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
              {/* Set and cleared are their own facts, not changes from "". */}
              {change.added ? (
                <>
                  <Tag size="sm" tone="accent">
                    Set
                  </Tag>
                  <Text as="span" size="body">
                    {change.to}
                  </Text>
                </>
              ) : change.removed ? (
                <>
                  <Tag size="sm">Removed</Tag>
                  <Text as="span" size="body" className="text-ink-faint line-through">
                    {change.from}
                  </Text>
                </>
              ) : (
                <>
                  <Text as="span" size="body" className="text-ink-faint line-through">
                    {change.from}
                  </Text>
                  <span aria-hidden="true" className="text-ink-faint">
                    →
                  </span>
                  <Text as="span" size="body">
                    {change.to}
                  </Text>
                </>
              )}

              {change.note && (
                <Text as="span" size="caption" tone="soft" className="basis-full">
                  {change.note}
                </Text>
              )}
            </span>

            {onRevert && (
              <button
                type="button"
                onClick={() => onRevert(change.field)}
                className="shrink-0 rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                Revert
              </button>
            )}
          </li>
        ))}
      </ul>
    </Surface>
  )
}
