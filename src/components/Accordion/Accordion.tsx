'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Collapsible } from '../Collapsible'

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  meta?: ReactNode
  disabled?: boolean
}

export interface AccordionProps {
  items: AccordionItem[]
  /** single closes the others when one opens; multiple leaves them alone. */
  mode?: 'single' | 'multiple'
  /** Ids open on first render. */
  defaultOpen?: string[]
  /** Hairline between items. */
  divided?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A set of disclosures with an open policy. `single` is the accordion proper —
 * opening one closes the rest; `multiple` is a plain stack of Collapsibles that
 * happens to share a container.
 */
export function Accordion({
  items,
  mode = 'single',
  defaultOpen = [],
  divided = true,
  className,
}: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultOpen)

  const toggle = (id: string, next: boolean) => {
    setOpen((previous) => {
      if (!next) return previous.filter((entry) => entry !== id)
      return mode === 'single' ? [id] : [...previous, id]
    })
  }

  return (
    <div className={cn('flex flex-col', divided && 'divide-y divide-line', className)}>
      {items.map((item) => (
        <Collapsible
          key={item.id}
          title={item.title}
          meta={item.meta}
          disabled={item.disabled}
          open={open.includes(item.id)}
          onOpenChange={(next) => toggle(item.id, next)}
          className={divided ? 'py-1 first:pt-0 last:pb-0' : undefined}
        >
          {item.content}
        </Collapsible>
      ))}
    </div>
  )
}
