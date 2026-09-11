import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Text } from 'citrine'

/**
 * The top of a page: where it sits, the title, one paragraph, and anything
 * that acts on the whole page. The same shape the component and block pages
 * already use, so the new sections read as the same site.
 */
export function PageIntro({
  title,
  children,
  breadcrumb,
  meta,
  actions,
}: {
  title: ReactNode
  /** The lede. */
  children?: ReactNode
  breadcrumb?: { label: string; to?: string }[]
  /** A quiet line under the lede — counts, dates. */
  meta?: ReactNode
  /** Right of the title — save, copy, open. */
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Documentation breadcrumb" className="flex flex-wrap items-center gap-1.5">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-[11.5px] font-bold text-ink-faint">
                  /
                </span>
              )}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[11.5px] font-bold text-ink-soft">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Text as="h1" size="title" className="min-w-0">
          {title}
        </Text>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && (
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
          {children}
        </Text>
      )}
      {meta && (
        <Text size="caption" weight="semibold" tone="faint" tabular>
          {meta}
        </Text>
      )}
    </header>
  )
}
