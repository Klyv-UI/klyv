import { useSearchParams } from 'react-router-dom'
import { ReleaseEntry } from '../components/Changes'
import { Count, FilterChip } from '../components/FilterChip'
import { PageIntro } from '../components/PageIntro'
import { CHANGE_CATEGORIES, releases, type ChangeCategory } from '../data/changelog'

/**
 * The changelog: every release as a timeline, filterable by kind of change.
 * The filter is a URL parameter, so "just the fixes" is a link.
 */
export default function ChangelogPage() {
  const [params, setParams] = useSearchParams()
  const active = CHANGE_CATEGORIES.find((category) => category.id === params.get('type'))?.id

  const setType = (type: ChangeCategory | null) => {
    const next = new URLSearchParams(params)
    if (type) next.set('type', type)
    else next.delete('type')
    setParams(next, { replace: true })
  }

  const total = releases.reduce((sum, release) => sum + release.changes.length, 0)
  const countOf = (type: ChangeCategory) =>
    releases.reduce((sum, release) => sum + release.changes.filter((change) => change.category === type).length, 0)

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Changelog"
        meta={`${releases.filter((release) => release.status === 'released').length} released · ${total} changes`}
      >
        What shipped, and when. Every released change is a commit in this repository — the hash is beside it —
        and work that has not shipped yet is marked as such.
      </PageIntro>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by kind of change">
        <FilterChip active={!active} onClick={() => setType(null)}>
          All
          <Count>{total}</Count>
        </FilterChip>
        {CHANGE_CATEGORIES.map((category) => {
          const count = countOf(category.id)
          return (
            <FilterChip
              key={category.id}
              active={active === category.id}
              onClick={() => setType(category.id)}
              disabled={count === 0}
            >
              {category.label}
              <Count>{count}</Count>
            </FilterChip>
          )
        })}
      </div>

      <ol aria-label="Releases" className="flex flex-col">
        {releases.map((release) => (
          <ReleaseEntry
            key={release.version}
            release={release}
            changes={active ? release.changes.filter((change) => change.category === active) : release.changes}
          />
        ))}
      </ol>
    </div>
  )
}
