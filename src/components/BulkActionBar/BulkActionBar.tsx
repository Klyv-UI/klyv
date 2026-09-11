'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface BulkActionBarProps {
  /** How many items are selected. At zero the bar is not shown. */
  count: number
  /** What is being counted, singular — "row", "file", "member". */
  noun?: string
  /** The plural, when adding an s would be wrong. */
  nounPlural?: string
  /** The actions — usually small Buttons. */
  children: ReactNode
  /** Clears the selection. */
  onClear: () => void
  clearLabel?: string
  /** Pin to the foot of the viewport instead of sitting in the flow. */
  floating?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The bar that appears once items are selected: how many, what can be done to
 * them, and a way out.
 *
 * The count is announced through a live region that stays mounted while the
 * bar is hidden — a region created at the same moment as its first message is
 * one many screen readers never read. The actions are grouped and named after
 * the selection, so "Archive" is heard in context rather than on its own.
 */
export function BulkActionBar({
  count,
  noun = 'item',
  nounPlural,
  children,
  onClear,
  clearLabel = 'Clear',
  floating = false,
  className,
}: BulkActionBarProps) {
  const word = count === 1 ? noun : (nounPlural ?? `${noun}s`)
  const message = count > 0 ? `${count} ${word} selected` : ''

  return (
    <>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {message}
        </span>
      </VisuallyHidden>

      {count > 0 && (
        <Surface
          variant="floating"
          padding="sm"
          role="group"
          aria-label={`Actions for ${message}`}
          className={cn(
            'flex-row flex-wrap items-center gap-2 rounded-full pl-4',
            floating && 'fixed inset-x-0 bottom-5 z-40 mx-auto w-fit',
            className,
          )}
        >
          <Text as="span" size="caption" weight="bold" tabular className="mr-1">
            {message}
          </Text>
          <span aria-hidden="true" className="h-4 w-px bg-line" />
          <div className="flex flex-wrap items-center gap-1.5">{children}</div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            {clearLabel}
          </Button>
        </Surface>
      )}
    </>
  )
}
