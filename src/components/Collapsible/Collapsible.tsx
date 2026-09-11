'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { Collapse } from '../Collapse'

export interface CollapsibleProps {
  /** Visible trigger text. */
  title: string
  /** Content revealed when open. */
  children: ReactNode
  /** Uncontrolled starting state. */
  defaultOpen?: boolean
  /** Controlled state. Pass with onOpenChange. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Quiet text on the right of the trigger — a count, a summary. */
  meta?: ReactNode
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      aria-hidden="true"
      className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A disclosure: one trigger, one panel. The trigger owns aria-expanded and
 * aria-controls, so the relationship between the two is announced rather than
 * merely implied by their position.
 */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  meta,
  disabled = false,
  className,
}: CollapsibleProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const panelId = useId()
  const open = controlledOpen ?? uncontrolled

  const toggle = () => {
    const next = !open
    if (controlledOpen === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--radius-tile)] px-2.5 py-2.5 text-left transition-colors',
          'hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Text as="span" className="min-w-0 flex-1" truncate>
          {title}
        </Text>
        {meta && (
          <Text as="span" size="caption" tone="faint">
            {meta}
          </Text>
        )}
        <Chevron open={open} />
      </button>
      <Collapse open={open} id={panelId}>
        <div className="px-2.5 pb-3 pt-1">{children}</div>
      </Collapse>
    </div>
  )
}
