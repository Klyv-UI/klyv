import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, X } from 'lucide-react'
import { SearchField, Surface, Text, cn } from 'citrine'
import { NEW_COMPONENTS, catalog, componentCount, isNewComponent, type CatalogEntry } from '../data/catalog'
import { NewBadge } from '../components/NewBadge'
import { findGroupBySlug, groups } from '../data/groups'
import { dependenciesOf } from '../data/dependencies'
import { sizeOf } from '../data/sizes'

/**
 * The catalogue: everything, filterable, with the numbers that decide an import.
 *
 * A name and a blurb were not enough to choose between two components that do
 * similar things, so every row carries what it weighs and how much it drags in
 * with it — both already measured for the component pages. The group filter is
 * a URL parameter rather than local state, so a filtered view is a link someone
 * can send.
 */
type View = 'grid' | 'list'
type Sort = 'group' | 'name' | 'size'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'group', label: 'Grouped' },
  { id: 'name', label: 'A–Z' },
  { id: 'size', label: 'Lightest' },
]

export default function ComponentsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('grid')
  const [sort, setSort] = useState<Sort>('group')

  const active = findGroupBySlug(params.get('group') ?? undefined)
  // A URL parameter like the group, so "what is new" is a link someone can share.
  const onlyNew = params.get('new') === '1'
  const toggleNew = () => {
    const next = new URLSearchParams(params)
    if (onlyNew) next.delete('new')
    else next.set('new', '1')
    setParams(next, { replace: true })
  }

  /** Measured once for the whole catalogue rather than per card on every render. */
  const facts = useMemo(() => {
    const map = new Map<string, { gzip: number; brings: number }>()
    for (const entry of catalog) {
      map.set(entry.slug, {
        gzip: sizeOf(entry.name)?.gzip ?? 0,
        brings: Math.max(0, dependenciesOf(entry.name).components.length - 1),
      })
    }
    return map
  }, [])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = catalog.filter((entry) => {
      if (active && entry.group !== active.id) return false
      if (onlyNew && !isNewComponent(entry.name)) return false
      if (!needle) return true
      const fields = [entry.name, entry.slug, entry.blurb, entry.section, entry.group]
      if (fields.some((field) => field.toLowerCase().includes(needle))) return true
      // "data table", "data-table" and "datatable" are one search: people type
      // the spacing they remember, which is rarely the spelling of the slug.
      const flat = needle.replace(/[^a-z0-9]/g, '')
      return (
        flat.length > 2 &&
        fields.some((field) => field.toLowerCase().replace(/[^a-z0-9]/g, '').includes(flat))
      )
    })

    if (sort === 'name') return [...matched].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'size') {
      return [...matched].sort(
        (a, b) => (facts.get(a.slug)?.gzip ?? 0) - (facts.get(b.slug)?.gzip ?? 0),
      )
    }
    return matched
  }, [active, query, sort, facts])

  const visibleGroups = groups.filter((group) => results.some((entry) => entry.group === group.id))
  const filtered = Boolean(active) || onlyNew || query.trim().length > 0

  const setGroup = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('group', slug)
    else next.delete('group')
    setParams(next, { replace: true })
  }

  const clear = () => {
    setQuery('')
    setGroup(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Text as="h1" size="title">
          {active ? active.id : 'Components'}
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
          {active ? active.tagline : `All ${componentCount} of them, grouped by what they are for.`}
        </Text>
      </header>

      {/* Sticky, because the filters are useless once you have scrolled past
          the fold of a 250-item list. */}
      <div className="sticky top-[72px] z-20 -mt-2 flex flex-col gap-3 bg-[color-mix(in_oklab,var(--color-canvas)_88%,transparent)] py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onValueChange={setQuery}
            inputSize="sm"
            label="Search components"
            placeholder="Search by name, or by what it does…"
            className="min-w-[200px] max-w-[380px] flex-1"
          />

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1" role="group" aria-label="Sort">
              {SORTS.map((option) => (
                <Toggle
                  key={option.id}
                  active={sort === option.id}
                  onClick={() => setSort(option.id)}
                >
                  {option.label}
                </Toggle>
              ))}
            </div>

            <div className="flex items-center gap-1" role="group" aria-label="View">
              <Toggle active={view === 'grid'} onClick={() => setView('grid')} label="Grid view">
                <LayoutGrid size={14} aria-hidden />
              </Toggle>
              <Toggle active={view === 'list'} onClick={() => setView('list')} label="List view">
                <List size={14} aria-hidden />
              </Toggle>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={!active} onClick={() => setGroup(null)}>
            All
            <Count>{componentCount}</Count>
          </FilterChip>
          <FilterChip active={onlyNew} onClick={toggleNew}>
            New
            <Count>{NEW_COMPONENTS.size}</Count>
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

          <div className="ml-auto flex items-center gap-2.5">
            <Text size="caption" weight="semibold" tone="faint" tabular>
              <span role="status" aria-live="polite">
                {filtered ? `${results.length} of ${componentCount}` : `${componentCount} components`}
              </span>
            </Text>
            {filtered && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={12} aria-hidden />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <Surface variant="card" padding="lg" className="items-start gap-1">
          <Text size="heading">Nothing matches “{query}”</Text>
          <Text size="caption" tone="faint">
            Try a shorter word, or clear the group filter.
          </Text>
        </Surface>
      ) : sort === 'group' ? (
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
                      <Results
                        entries={inGroup.filter((entry) => entry.section === section)}
                        view={view}
                        facts={facts}
                      />
                    </div>
                  ))}
              </section>
            )
          })}
        </div>
      ) : (
        <Results entries={results} view={view} facts={facts} showGroup />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- results */

type Facts = Map<string, { gzip: number; brings: number }>

const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} kB`

function Results({
  entries,
  view,
  facts,
  showGroup = false,
}: {
  entries: CatalogEntry[]
  view: View
  facts: Facts
  showGroup?: boolean
}) {
  if (view === 'list') {
    return (
      <Surface variant="card" className="overflow-hidden">
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.slug} className="border-b border-line last:border-0">
              <ComponentRow entry={entry} facts={facts} showGroup={showGroup} />
            </li>
          ))}
        </ul>
      </Surface>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <ComponentCard key={entry.slug} entry={entry} facts={facts} showGroup={showGroup} />
      ))}
    </div>
  )
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

function ComponentCard({
  entry,
  facts,
  showGroup,
}: {
  entry: CatalogEntry
  facts: Facts
  showGroup?: boolean
}) {
  const fact = facts.get(entry.slug)
  return (
    <Link
      to={`/components/${entry.slug}`}
      className={cn('group rounded-[var(--radius-tile)]', focusRing)}
    >
      <Surface
        variant="tile"
        padding="md"
        className="h-full gap-1.5 bg-surface transition-colors group-hover:border-line-strong group-hover:bg-surface-sunken"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Text size="body" weight="bold" truncate>
              {entry.name}
            </Text>
            {isNewComponent(entry.name) && <NewBadge />}
          </span>
          {showGroup && (
            <Text size="micro" weight="semibold" tone="faint" truncate>
              {entry.group}
            </Text>
          )}
        </div>
        <Text size="caption" tone="faint" leading="normal" className="line-clamp-2">
          {entry.blurb}
        </Text>
        {fact && <FactLine fact={fact} />}
      </Surface>
    </Link>
  )
}

function ComponentRow({
  entry,
  facts,
  showGroup,
}: {
  entry: CatalogEntry
  facts: Facts
  showGroup?: boolean
}) {
  const fact = facts.get(entry.slug)
  return (
    <Link
      to={`/components/${entry.slug}`}
      className={cn(
        'flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-muted',
        focusRing,
      )}
    >
      <span className="flex w-[170px] shrink-0 items-center gap-1.5">
        <Text size="caption" weight="bold" truncate>
          {entry.name}
        </Text>
        {isNewComponent(entry.name) && <NewBadge />}
      </span>
      <Text size="caption" tone="faint" truncate className="min-w-0 flex-1">
        {entry.blurb}
      </Text>
      {showGroup && (
        <Text size="micro" weight="semibold" tone="faint" className="hidden w-[110px] shrink-0 truncate lg:block">
          {entry.group}
        </Text>
      )}
      {fact && (
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Text size="micro" weight="semibold" tone="faint" tabular className="w-[54px] text-right">
            {kb(fact.gzip)}
          </Text>
          <Text size="micro" weight="semibold" tone="faint" tabular className="w-[58px] text-right">
            {fact.brings === 0 ? 'standalone' : `+${fact.brings}`}
          </Text>
        </div>
      )}
    </Link>
  )
}

/** What it weighs, and how much it drags in with it. */
function FactLine({ fact }: { fact: { gzip: number; brings: number } }) {
  return (
    <div className="mt-auto flex items-center gap-2 pt-2">
      <Text size="micro" weight="semibold" tone="faint" tabular>
        {kb(fact.gzip)}
      </Text>
      <span aria-hidden className="h-2.5 w-px bg-line-strong" />
      <Text size="micro" weight="semibold" tone="faint" tabular>
        {fact.brings === 0 ? 'standalone' : `brings ${fact.brings}`}
      </Text>
    </div>
  )
}

/* ----------------------------------------------------------------- controls */

function Toggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-colors',
        focusRing,
        active
          ? 'bg-surface-muted text-ink'
          : 'text-ink-faint hover:bg-surface-muted hover:text-ink',
      )}
    >
      {children}
    </button>
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
        focusRing,
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
    // No opacity: it multiplies against whatever colour the row inherits and
    // throws away the contrast the ink tokens were chosen for. The mono face at
    // 10px already reads as secondary.
    <span className="font-mono text-[10px] font-bold tabular-nums">{children}</span>
  )
}
