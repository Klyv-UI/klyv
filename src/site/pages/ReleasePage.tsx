import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Surface, Tag, Text } from 'klyv'
import { ChangeItem, formatReleaseDate } from '../components/Changes'
import { Section } from '../components/Doc'
import { Missing } from '../components/Links'
import { PageIntro } from '../components/PageIntro'
import { CHANGE_CATEGORIES, findRelease, releaseLabel, releases } from '../data/changelog'

/** One release, its changes grouped by kind. */
export default function ReleasePage() {
  const { version } = useParams()
  const release = findRelease(version)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [version])

  if (!release) {
    return (
      <Missing title="No such release" to="/changelog" label="Back to the changelog">
        There is no release “{version}”.
      </Missing>
    )
  }

  const index = releases.indexOf(release)
  const newer = releases[index - 1]
  const older = releases[index + 1]

  return (
    <article className="flex flex-col gap-8">
      <PageIntro
        breadcrumb={[{ label: 'Changelog', to: '/changelog' }, { label: releaseLabel(release) }]}
        title={release.title}
        meta={
          <span className="inline-flex items-center gap-2">
            <Tag size="sm" tone={release.status === 'unreleased' ? 'accent' : 'outline'}>
              {releaseLabel(release)}
            </Tag>
            {release.date ? <time dateTime={release.date}>{formatReleaseDate(release)}</time> : 'On the current branch; not in a published version yet.'}
          </span>
        }
      >
        {release.summary}
      </PageIntro>

      {CHANGE_CATEGORIES.map((category) => {
        const changes = release.changes.filter((change) => change.category === category.id)
        if (changes.length === 0) return null
        return (
          <Section key={category.id} title={category.label}>
            <ul className="flex flex-col">
              {changes.map((change) => (
                <ChangeItem key={change.title} change={change} />
              ))}
            </ul>
          </Section>
        )
      })}

      {(newer || older) && (
        <nav aria-label="Other releases" className="grid grid-cols-1 gap-2.5 border-t border-line pt-6 sm:grid-cols-2">
          {older ? (
            <Link to={`/changelog/${older.version}`} className="rounded-[var(--radius-tile)]">
              <Surface variant="tile" padding="sm" interactive className="h-full gap-0.5">
                <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                  Older
                </Text>
                <Text size="caption" weight="bold">{`← ${releaseLabel(older)} · ${older.title}`}</Text>
              </Surface>
            </Link>
          ) : (
            <span aria-hidden />
          )}
          {newer && (
            <Link to={`/changelog/${newer.version}`} className="rounded-[var(--radius-tile)]">
              <Surface variant="tile" padding="sm" interactive className="h-full items-end gap-0.5 text-right">
                <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
                  Newer
                </Text>
                <Text size="caption" weight="bold">{`${releaseLabel(newer)} · ${newer.title} →`}</Text>
              </Surface>
            </Link>
          )}
        </nav>
      )}
    </article>
  )
}
