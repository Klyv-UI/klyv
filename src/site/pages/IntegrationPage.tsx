import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, CodeBlock, Text } from 'klyv'
import { Note, Section } from '../components/Doc'
import { ComponentLinks, DocLink, Missing } from '../components/Links'
import { PageIntro } from '../components/PageIntro'
import { SaveControls } from '../components/SaveControls'
import { INTEGRATION_STATUSES, findIntegration } from '../data/integrations'

/** One integration: its status and why, the setup, an example, and where to read more. */
export default function IntegrationPage() {
  const { slug } = useParams()
  const integration = findIntegration(slug)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (!integration) {
    return (
      <Missing title="No such integration" to="/integrations" label="Browse the integrations">
        There is no integration at “{slug}”.
      </Missing>
    )
  }

  const status = INTEGRATION_STATUSES.find((entry) => entry.id === integration.status)

  return (
    <article className="flex flex-col gap-8">
      <PageIntro
        breadcrumb={[
          { label: 'Integrations', to: '/integrations' },
          { label: integration.category, to: `/integrations?category=${encodeURIComponent(integration.category)}` },
        ]}
        title={
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-glyph)] border border-line bg-surface text-[13px] font-extrabold tracking-[-0.02em]"
            >
              {integration.monogram}
            </span>
            {integration.name}
          </span>
        }
        actions={<SaveControls itemId={`integration:${integration.slug}`} name={integration.name} />}
      >
        {integration.description}
      </PageIntro>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={integration.status === 'official' ? 'accent' : 'neutral'}>{status?.label}</Badge>
          <Text size="caption" tone="soft">
            {status?.meaning}
          </Text>
        </div>
        <Note>{integration.basis}</Note>
      </div>

      <Section title="Setup">
        <ol className="flex flex-col gap-5">
          {integration.setup.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <Text as="h3" size="heading">
                <span className="font-mono text-ink-faint">{index + 1}.</span> {step.title}
              </Text>
              {step.body && (
                <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
                  {step.body}
                </Text>
              )}
              {step.code && (
                <CodeBlock language={step.language ?? 'tsx'} code={step.code} highlight={step.language !== 'bash'} />
              )}
            </li>
          ))}
        </ol>
      </Section>

      {integration.example && (
        <Section title="Example">
          <CodeBlock language={integration.example.language} code={integration.example.code} />
        </Section>
      )}

      {integration.components && integration.components.length > 0 && (
        <Section title="Components involved">
          <ComponentLinks names={integration.components} />
        </Section>
      )}

      <Section title="Documentation">
        <div className="flex flex-wrap gap-1.5">
          {integration.docs.map((doc) => (
            <DocLink key={doc.label} {...doc} />
          ))}
        </div>
      </Section>
    </article>
  )
}
