import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { DISPLAY_LG } from '../internal/StatusPill'

export interface SectionHeadingProps {
  /** Small uppercase line above the title — the section's name. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'start' | 'center'
  /** Heading level. The visual size never changes. */
  as?: 'h1' | 'h2' | 'h3'
  /** Right-aligned (or, centred, underneath) affordances — a link, a toggle. */
  children?: ReactNode
  className?: string
}

/**
 * The eyebrow, title and lede every marketing section opens with.
 *
 * It exists because a landing page is eight of these in a row, and eight
 * hand-written ones drift — a different tracking here, a lede that runs to the
 * full width there. The lede is held to a measure so it stays readable however
 * wide the section is.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  as: Heading = 'h2',
  children,
  className,
}: SectionHeadingProps) {
  const centred = align === 'center'

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        centred ? 'items-center text-center' : 'items-start sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-3', centred && 'items-center')}>
        {eyebrow && (
          <Text size="caption" weight="bold" tone="soft" className="uppercase tracking-[0.14em]">
            {eyebrow}
          </Text>
        )}
        <Heading className={cn(DISPLAY_LG, 'max-w-[22ch] text-ink')}>{title}</Heading>
        {description && (
          <Text
            size="stat"
            weight="medium"
            tone="soft"
            leading="normal"
            className="max-w-[60ch] text-[15px]"
          >
            {description}
          </Text>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
