import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, CodeBlock, Surface, Text } from 'citrine'
import { Section } from '../components/Doc'
import { ItemCard } from '../components/ItemCard'
import { ComponentLinks, Missing } from '../components/Links'
import { PageIntro } from '../components/PageIntro'
import { SaveControls } from '../components/SaveControls'
import { brand } from '../brand'
import { findItem } from '../data/library'
import { recipes } from '../data/recipes'
import { findTemplate, templateBlocks, templateComponents } from '../data/templates'

/** One template: its screens in build order, the command that takes them, and what they are made of. */
export default function TemplatePage() {
  const { slug } = useParams()
  const template = findTemplate(slug)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (!template) {
    return (
      <Missing title="No such template" to="/templates" label="Browse the templates">
        There is no template at “{slug}”.
      </Missing>
    )
  }

  const screens = templateBlocks(template)
  const components = templateComponents(template)
  const related = recipes
    .filter((recipe) => recipe.blocks.some((block) => template.blocks.includes(block)))
    .map((recipe) => findItem(`recipe:${recipe.slug}`))
    .filter((item) => item !== undefined)

  return (
    <article className="flex flex-col gap-8">
      <PageIntro
        breadcrumb={[{ label: 'Templates', to: '/templates' }, { label: template.name }]}
        title={template.name}
        meta={`${screens.length} screens · ${components.length} components`}
        actions={
          <>
            <Button as={Link} to={`/composer?template=${template.slug}`} size="sm" variant="ghost">
              Open in Composer
            </Button>
            <SaveControls itemId={`template:${template.slug}`} name={template.name} />
          </>
        }
      >
        {template.description}
      </PageIntro>

      <Section title="Screens" description="In the order you would build them. Each is a live block page.">
        <ol className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {screens.map((block, index) => (
            <li key={block.slug}>
              <Link
                to={`/blocks/${block.slug}`}
                className="group block h-full rounded-[var(--radius-tile)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Surface
                  variant="tile"
                  padding="md"
                  className="h-full gap-1.5 bg-surface transition-colors group-hover:border-line-strong group-hover:bg-surface-sunken"
                >
                  <Text size="micro" weight="bold" tone="faint" tabular className="uppercase tracking-[0.14em]">
                    {String(index + 1).padStart(2, '0')} · {block.category}
                  </Text>
                  <Text size="body" weight="bold">
                    {block.name}
                  </Text>
                  <Text size="caption" tone="faint" leading="normal" className="line-clamp-2">
                    {block.blurb}
                  </Text>
                </Surface>
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Take it"
        description="Install the package, then write every screen into src/blocks. Each block imports from the package, so the order matters."
      >
        <CodeBlock
          language="bash"
          code={`npm install ${brand.pkg}\nnpx ${brand.pkg} add block ${template.blocks.join(' ')}`}
          highlight={false}
        />
      </Section>

      <Section title="Built from" description="Every library component the screens use.">
        <ComponentLinks names={components} />
      </Section>

      {related.length > 0 && (
        <Section title="Related recipes" description="The reasoning behind the screens in this template.">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {related.map((item) => (
              <ItemCard key={item.id} item={item} showType={false} />
            ))}
          </div>
        </Section>
      )}
    </article>
  )
}
