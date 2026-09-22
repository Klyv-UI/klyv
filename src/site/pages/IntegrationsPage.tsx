import { Link, useSearchParams } from 'react-router-dom'
import { IntegrationCard, Surface, Text } from 'klyvui'
import { Count, FilterChip } from '../components/FilterChip'
import { PageIntro } from '../components/PageIntro'
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATUSES,
  integrationStatusLabel,
  integrations,
  type IntegrationCategory,
} from '../data/integrations'

/**
 * The integrations index.
 *
 * Each card is the library's own IntegrationCard with no connect action — this
 * is documentation, not a marketplace, so there is nothing to connect and the
 * card does not pretend there is. The whole card links to the setup page.
 */
export default function IntegrationsPage() {
  const [params, setParams] = useSearchParams()
  const active = INTEGRATION_CATEGORIES.find((category) => category === params.get('category'))

  const setCategory = (category: IntegrationCategory | null) => {
    const next = new URLSearchParams(params)
    if (category) next.set('category', category)
    else next.delete('category')
    setParams(next, { replace: true })
  }

  const shown = INTEGRATION_CATEGORIES.filter((category) => !active || category === active)

  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow="Developer" title="Integrations" meta={`${integrations.length} integrations`}>
        How the library fits the rest of a stack. Only things with a real path are listed, and each one says
        how real that path is — nothing is marked official unless it is shipped and exercised here.
      </PageIntro>

      <Surface variant="sunken" padding="md" className="gap-2">
        <Text size="caption" weight="bold">
          What the statuses mean
        </Text>
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {INTEGRATION_STATUSES.map((status) => (
            <div key={status.id} className="flex gap-2">
              <dt>
                <Text as="span" size="caption" weight="bold">
                  {status.label}
                </Text>
              </dt>
              <dd>
                <Text as="span" size="caption" tone="soft">
                  {status.meaning}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      </Surface>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
        <FilterChip active={!active} onClick={() => setCategory(null)}>
          All
          <Count>{integrations.length}</Count>
        </FilterChip>
        {INTEGRATION_CATEGORIES.map((category) => (
          <FilterChip key={category} active={active === category} onClick={() => setCategory(category)}>
            {category}
            <Count>{integrations.filter((entry) => entry.category === category).length}</Count>
          </FilterChip>
        ))}
      </div>

      {shown.map((category) => {
        const entries = integrations.filter((entry) => entry.category === category)
        if (entries.length === 0) return null
        return (
          <section key={category} className="flex flex-col gap-4">
            <Text as="h2" size="subtitle">
              {category}
            </Text>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((integration) => (
                <Link
                  key={integration.slug}
                  to={`/integrations/${integration.slug}`}
                  className="rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <IntegrationCard
                    name={integration.name}
                    description={integration.description}
                    logo={<span className="text-[12px] font-extrabold tracking-[-0.02em] text-ink">{integration.monogram}</span>}
                    badge={integrationStatusLabel(integration.status)}
                    meta={`${integration.setup.length} setup ${integration.setup.length === 1 ? 'step' : 'steps'}`}
                  />
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
