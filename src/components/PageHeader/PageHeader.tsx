import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface PageHeaderProps {
  /** Page heading. */
  title: string
  /** Supporting line under it. */
  description?: string
  /** Rendered above the title — a Breadcrumb or a BackButton. */
  above?: ReactNode
  /** Right-aligned affordances. */
  actions?: ReactNode
  /** Metadata row under the description — Tags, a Metric, a timestamp. */
  meta?: ReactNode
  /** Heading level. The visual size never changes. */
  headingLevel?: 'h1' | 'h2'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The title block for a route: optional trail, heading, supporting line,
 * metadata and actions.
 *
 * Defaults to h1 because a page has exactly one — which is what makes the
 * heading outline of the application correct without each route remembering.
 */
export function PageHeader({
  title,
  description,
  above,
  actions,
  meta,
  headingLevel = 'h1',
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {above}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Text as={headingLevel} size="title">
            {title}
          </Text>
          {description && (
            <Text
              size="body"
              weight="medium"
              tone="soft"
              leading="normal"
              className="mt-1.5 max-w-[72ch]"
            >
              {description}
            </Text>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-3">{meta}</div>}
    </header>
  )
}
