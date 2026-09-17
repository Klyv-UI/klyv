import type { ReactNode } from 'react'
import { Text } from 'klyv'

/**
 * The small label above a heading, marked with the accent. One component, so
 * the landing page and every documentation page introduce a title the same way.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-1.5 rounded-full bg-accent-strong" />
      <Text as="span" size="micro" weight="bold" tone="soft" className="uppercase tracking-[0.18em]">
        {children}
      </Text>
    </span>
  )
}
