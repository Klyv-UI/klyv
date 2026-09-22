import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Text } from 'klyvui'
import { Eyebrow } from './Eyebrow'

export interface PageStat {
  value: ReactNode
  label: string
}

/**
 * The top of a documentation page: where it sits, the title, one paragraph,
 * the numbers worth knowing, and anything that acts on the whole page.
 *
 * It uses the landing page's heading scale and eyebrow, and closes on a
 * hairline, so every page in the site opens the same way and the content
 * below always starts at the same distance from the title.
 */
export function PageIntro({
  title,
  children,
  eyebrow,
  breadcrumb,
  stats,
  meta,
  actions,
}: {
  title: ReactNode
  /** The lede. */
  children?: ReactNode
  /** Which part of the site this is. Shown when there is no breadcrumb. */
  eyebrow?: string
  breadcrumb?: { label: string; to?: string }[]
  /** Derived figures, set under the lede. */
  stats?: PageStat[]
  /** A quiet line under the lede — counts, dates. */
  meta?: ReactNode
  /** Right of the title — save, copy, open. */
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-8">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Documentation breadcrumb" className="flex flex-wrap items-center gap-1.5">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-[11.5px] font-bold text-ink-faint">
                  /
                </span>
              )}
              {crumb.to ? (
                <Link to={crumb.to} className="rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[11.5px] font-bold text-ink-soft">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : (
        eyebrow && <Eyebrow>{eyebrow}</Eyebrow>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 max-w-[72ch] flex-col gap-3">
          <Text as="h1" size="title" className="text-balance leading-[1.05] sm:text-[36px]">
            {title}
          </Text>
          {children && (
            <Text size="body" weight="medium" tone="soft" leading="normal" className="sm:text-[15px]">
              {children}
            </Text>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dt className="order-2">
                <Text as="span" size="caption" weight="semibold" tone="faint">
                  {stat.label}
                </Text>
              </dt>
              <dd className="order-1">
                <Text as="span" size="subtitle" tabular className="tracking-[-0.02em]">
                  {stat.value}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {meta && (
        <Text size="caption" weight="semibold" tone="faint" tabular>
          {meta}
        </Text>
      )}
    </header>
  )
}
