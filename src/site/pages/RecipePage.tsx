import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CodeBlock, Text } from 'klyvui'
import { Section } from '../components/Doc'
import { ItemCard } from '../components/ItemCard'
import { ComponentLinks, DocLink, Missing } from '../components/Links'
import { PageIntro } from '../components/PageIntro'
import { SaveControls } from '../components/SaveControls'
import { findBlock } from '../data/blocks'
import { findItem } from '../data/library'
import { findRecipe, recipes } from '../data/recipes'

/** One recipe: where to start, then the steps, each with the code that matters. */
export default function RecipePage() {
  const { slug } = useParams()
  const recipe = findRecipe(slug)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (!recipe) {
    return (
      <Missing title="No such recipe" to="/recipes" label="Browse the recipes">
        There is no recipe at “{slug}”.
      </Missing>
    )
  }

  // Related by shared tags, strongest overlap first.
  const related = recipes
    .filter((other) => other.slug !== recipe.slug)
    .map((other) => ({ other, overlap: other.tags.filter((tag) => recipe.tags.includes(tag)).length }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2)
    .map(({ other }) => findItem(`recipe:${other.slug}`))
    .filter((item) => item !== undefined)

  return (
    <article className="flex flex-col gap-8">
      <PageIntro
        breadcrumb={[{ label: 'Recipes', to: '/recipes' }, { label: recipe.title }]}
        title={recipe.title}
        actions={<SaveControls itemId={`recipe:${recipe.slug}`} name={recipe.title} />}
      >
        {recipe.summary}
      </PageIntro>

      {recipe.blocks.length > 0 && (
        <Section title="Start from" description="The finished screens this recipe explains.">
          <div className="flex flex-wrap gap-1.5">
            {recipe.blocks.map((slug) => {
              const block = findBlock(slug)
              return block ? <DocLink key={slug} label={`${block.name} block`} to={`/blocks/${slug}`} /> : null
            })}
          </div>
        </Section>
      )}

      <Section title="Steps">
        <ol className="flex flex-col gap-6">
          {recipe.steps.map((step, index) => (
            <li key={step.title} className="grid gap-3 sm:grid-cols-[32px_minmax(0,1fr)]">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-surface-muted font-mono text-[12px] font-bold text-ink"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-2.5">
                <Text as="h3" size="heading">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </Text>
                <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
                  {step.body}
                </Text>
                {step.code && <CodeBlock language={step.language ?? 'tsx'} code={step.code} highlight={step.language !== 'bash'} />}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Components used" description="Each links to its page, with the full API and source.">
        <ComponentLinks names={recipe.components} />
      </Section>

      {related.length > 0 && (
        <Section title="Related recipes">
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
