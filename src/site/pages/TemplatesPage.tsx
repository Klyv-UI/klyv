import { Link } from 'react-router-dom'
import { Badge, Button, Text } from 'klyvui'
import { BlockThumbnail } from '../components/BlockThumbnail'
import { PageIntro } from '../components/PageIntro'
import { FavoriteButton } from '../components/SaveControls'
import { templateBlocks, templateComponents, templates, type TemplateEntry } from '../data/templates'

/**
 * The templates index. Each card leads with the first screen of the product,
 * live, then lists the screens inside it — the thing someone choosing between
 * templates actually needs to compare.
 */
export default function TemplatesPage() {
  const screens = new Set(templates.flatMap((template) => template.blocks)).size

  return (
    <div className="flex flex-col gap-12">
      <PageIntro
        eyebrow="Explore"
        title="Templates"
        stats={[
          { value: templates.length, label: 'templates' },
          { value: screens, label: 'distinct screens' },
          { value: 'One', label: 'CLI command each' },
        ]}
        actions={
          <Button as={Link} to="/blocks" size="sm" variant="outline">
            Browse single screens
          </Button>
        }
      >
        Starting points larger than one screen. A template is the set of blocks a product needs together — nothing in
        one is new, so what you see is exactly what the library produces, and all of it is one CLI command away.
      </PageIntro>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <li key={template.slug}>
            <TemplateCard template={template} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function TemplateCard({ template }: { template: TemplateEntry }) {
  const screens = templateBlocks(template)
  const first = screens[0]

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-colors focus-within:border-line-strong hover:border-line-strong">
      {first && <BlockThumbnail slug={first.slug} />}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <Text as="h2" size="heading" className="min-w-0">
            <Link
              to={`/templates/${template.slug}`}
              className="rounded-sm after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
            >
              {template.name}
            </Link>
          </Text>
          <FavoriteButton itemId={`template:${template.slug}`} name={template.name} variant="icon" className="relative z-10 -mr-1 -mt-1" />
        </div>
        <Text size="caption" tone="soft" leading="normal" className="line-clamp-3">
          {template.description}
        </Text>
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <ol aria-label={`Screens in ${template.name}`} className="flex flex-wrap gap-1">
            {screens.map((block) => (
              <li key={block.slug}>
                <Badge tone="neutral">{block.name}</Badge>
              </li>
            ))}
          </ol>
          <Text size="micro" weight="semibold" tone="faint" tabular>
            {screens.length} screens · {templateComponents(template).length} components
          </Text>
        </div>
      </div>
    </article>
  )
}
