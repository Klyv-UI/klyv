import { Text } from 'klyvui'
import { ItemCard } from '../components/ItemCard'
import { PageIntro } from '../components/PageIntro'
import { findItem } from '../data/library'
import { recipes } from '../data/recipes'

/** The recipes index. */
export default function RecipesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow="Explore" title="Recipes" meta={`${recipes.length} recipes`}>
        How to build one common thing from the library — which components, in what order, and the props that
        matter. A block is the finished screen; a recipe is the reasoning behind one.
      </PageIntro>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {recipes.map((recipe) => {
          const item = findItem(`recipe:${recipe.slug}`)
          if (!item) return null
          return (
            <ItemCard
              key={recipe.slug}
              item={item}
              showType={false}
              headingLevel="h2"
              footer={
                <Text size="micro" weight="semibold" tone="faint">
                  {recipe.steps.length} steps · {recipe.components.slice(0, 4).join(', ')}
                  {recipe.components.length > 4 ? ` +${recipe.components.length - 4}` : ''}
                </Text>
              }
            />
          )
        })}
      </div>
    </div>
  )
}
