import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchField, Surface, Text, cn } from 'citrine'
import { catalog, componentCount, type CatalogEntry } from '../data/catalog'
import { findGroupBySlug, groups } from '../data/groups'

/**
 * The catalogue: everything, filterable, one card per component.
 *
 * The group filter is a URL parameter rather than local state, so a filtered
 * view is a link someone can send — the sidebar headings and the landing page's
 * group cards both point straight at one.
 */
export default function ComponentsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const active = findGroupBySlug(params.get('group') ?? undefined)

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalog.filter((entry) => {
      if (active && entry.group !== active.id) return false
      if (!needle) return true
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.blurb.toLowerCase().includes(needle) ||
        entry.section.toLowerCase().includes(needle) ||
        entry.group.toLowerCase().includes(needle)
      )
    })
  }, [active, query])

  const visibleGroups = groups.filter((group) => results.some((entry) => entry.group === group.id))

  const setGroup = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('group', slug)
    else next.delete('group')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Text as="h1" size="title">
          {active ? active.id : 'Components'}
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
          {active ? active.tagline : `All ${componentCount} of them, grouped by what they are for.`}
        </Text>
      </header>

      <div className="flex flex-col gap-4">
        <SearchField
          value={query}
          onValueChange={setQuery}
          label="Search components"
          placeholder="Search by name, or by what it does…"
          className="max-w-[420px]"
        />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!active} onClick={() => setGroup(null)}>
            All
            <Count>{componentCount}</Count>
          </FilterChip>
          {groups.map((group) => (
            <FilterChip
              key={group.id}
              active={active?.id === group.id}
              onClick={() => setGroup(group.slug)}
            >
              {group.id}
              <Count>{catalog.filter((entry) => entry.group === group.id).length}</Count>
            </FilterChip>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <Surface variant="card" padding="lg" className="items-start gap-1">
          <Text size="heading">Nothing matches “{query}”</Text>
          <Text size="caption" tone="faint">
            Try a shorter word, or clear the group filter.
          </Text>
        </Surface>
      ) : (
        <div className="flex flex-col gap-10">
          {visibleGroups.map((group) => {
            const inGroup = results.filter((entry) => entry.group === group.id)
            return (
              <section key={group.id} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2.5">
                  <Text as="h2" size="subtitle">
                    {group.id}
                  </Text>
                  <Text size="caption" weight="bold" tone="faint" tabular>
                    {inGroup.length}
                  </Text>
                </div>

                {group.sections
                  .filter((section) => inGroup.some((entry) => entry.section === section))
                  .map((section) => (
                    <div key={section} className="flex flex-col gap-2.5">
                      <Text
                        size="micro"
                        weight="bold"
                        tone="faint"
                        className="uppercase tracking-[0.14em]"
                      >
                        {section}
                      </Text>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {inGroup
                          .filter((entry) => entry.section === section)
                          .map((entry) => (
                            <ComponentCard key={entry.slug} entry={entry} />
                          ))}
                      </div>
                    </div>
                  ))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ComponentCard({ entry }: { entry: CatalogEntry }) {
  return (
    <Link to={`/components/${entry.slug}`} className="group rounded-[var(--radius-tile)]">
      <Surface
        variant="tile"
        padding="md"
        className="h-full gap-1.5 bg-surface transition-colors group-hover:border-line-strong group-hover:bg-surface-sunken"
      >
        <Text size="body" weight="bold">
          {entry.name}
        </Text>
        <Text size="caption" tone="faint" leading="normal" className="line-clamp-3">
          {entry.blurb}
        </Text>
      </Surface>
    </Link>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
        active
          ? 'bg-ink text-ink-inverse'
          : 'bg-surface-muted text-ink-soft hover:bg-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function Count({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-bold opacity-55 tabular-nums">{children}</span>
  )
}
