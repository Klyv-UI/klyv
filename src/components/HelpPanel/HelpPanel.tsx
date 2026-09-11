'use client'

import { useMemo, useState } from 'react'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconTile } from '../IconTile'
import { StatusDot, type StatusDotTone } from '../StatusDot'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { SearchField } from '../SearchField'
import { ArrowRightIcon, ExternalIcon } from '../internal/icons'

export interface HelpArticle {
  id: string
  title: string
  excerpt?: string
  category?: string
  href: string
}

export interface HelpResource {
  id: string
  label: string
  description?: string
  icon?: IconComponent
  href?: string
  onSelect?: () => void
}

export type SystemStatus = 'operational' | 'degraded' | 'outage'

const STATUS_TONE: Record<SystemStatus, StatusDotTone> = {
  operational: 'success',
  degraded: 'warning',
  outage: 'danger',
}

export interface HelpPanelProps {
  articles: HelpArticle[]
  /** Ids shown before anything is typed. Defaults to the first four. */
  popular?: string[]
  /** Docs, community, shortcuts — the tiles under the search. */
  resources?: HelpResource[]
  status?: { state: SystemStatus; label: string; href?: string }
  onContact?: () => void
  contactLabel?: string
  title?: string
  /** Drop the card chrome, for use inside a Drawer or Popover. */
  bare?: boolean
  maxResults?: number
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The panel behind the help button: search the docs, jump to a resource, see
 * whether the product is actually down, and reach a person.
 *
 * Search runs over the articles it is given, per word, so "reset 2fa" finds
 * "Resetting two-factor authentication" by its category and excerpt. When
 * nothing matches, contact is offered right there — a dead-end search is the
 * moment people are most ready to write in, and making them hunt for the
 * button then is how support tickets arrive angry.
 *
 * Status sits at the bottom because "is it me or is it you?" is the question
 * behind a third of all help-panel opens.
 */
export function HelpPanel({
  articles,
  popular,
  resources = [],
  status,
  onContact,
  contactLabel = 'Contact support',
  title = 'Help & support',
  bare = false,
  maxResults = 5,
  headingLevel: Heading = 'h2',
  className,
}: HelpPanelProps) {
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const results = useMemo(() => {
    if (words.length === 0) {
      const picked = popular ? articles.filter((article) => popular.includes(article.id)) : articles
      return picked.slice(0, 4)
    }
    return articles
      .filter((article) => {
        const haystack = `${article.title} ${article.excerpt ?? ''} ${article.category ?? ''}`.toLowerCase()
        return words.every((word) => haystack.includes(word))
      })
      .slice(0, maxResults)
    // `words` is derived from `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, popular, query, maxResults])

  const body = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Heading className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">{title}</Heading>
        <SearchField value={query} onValueChange={setQuery} label="Search help articles" placeholder="Search for answers" />
      </div>

      <div className="flex flex-col gap-2">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider" role="status" aria-live="polite">
          {words.length === 0 ? 'Popular articles' : results.length === 0 ? 'No articles found' : `${results.length} ${results.length === 1 ? 'article' : 'articles'}`}
        </Text>

        {results.length > 0 ? (
          <ul className="-mx-2 flex flex-col">
            {results.map((article) => (
              <li key={article.id}>
                <a
                  href={article.href}
                  className="group flex items-start gap-3 rounded-[var(--radius-glyph)] px-2 py-2 transition-colors hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Text as="span" size="label" weight="bold" leading="normal">
                      {article.title}
                    </Text>
                    {(article.category || article.excerpt) && (
                      <Text as="span" size="caption" tone="faint" truncate>
                        {[article.category, article.excerpt].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </span>
                  <ArrowRightIcon size={13} className="mt-0.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Surface variant="sunken" padding="md" className="items-start gap-2">
            <Text size="caption" weight="medium" tone="soft" leading="normal">
              Nothing matches “{query.trim()}”. Try other words, or ask the team directly.
            </Text>
            {onContact && (
              <Button size="sm" onClick={onContact}>
                {contactLabel}
              </Button>
            )}
          </Surface>
        )}
      </div>

      {resources.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {resources.map((resource) => {
            const content = (
              <>
                {resource.icon && <IconTile icon={resource.icon} size="sm" />}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" size="label" weight="bold">
                    {resource.label}
                  </Text>
                  {resource.description && (
                    <Text as="span" size="caption" tone="faint" leading="normal">
                      {resource.description}
                    </Text>
                  )}
                </span>
              </>
            )
            const style =
              'flex h-full w-full items-start gap-2.5 rounded-[var(--radius-tile)] border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-sunken'
            return (
              <li key={resource.id}>
                {resource.href ? (
                  <a href={resource.href} className={style}>
                    {content}
                  </a>
                ) : (
                  <button type="button" onClick={resource.onSelect} className={style}>
                    {content}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {(status || onContact) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {status ? (
            status.href ? (
              <a href={status.href} className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-soft hover:text-ink">
                <StatusDot tone={STATUS_TONE[status.state]} />
                {status.label}
                <ExternalIcon size={11} className="text-ink-faint" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
                <StatusDot tone={STATUS_TONE[status.state]} />
                {status.label}
              </span>
            )
          ) : (
            <span />
          )}
          {onContact && (
            <Button size="sm" variant="outline" onClick={onContact}>
              {contactLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )

  return bare ? (
    <div className={className}>{body}</div>
  ) : (
    <Surface variant="card" padding="lg" className={className}>
      {body}
    </Surface>
  )
}
