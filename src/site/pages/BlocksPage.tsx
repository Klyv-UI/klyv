import { Link } from 'react-router-dom'
import { Badge, Surface, Text } from 'citrine'
import { BLOCK_CATEGORIES, blockCount, blocksInCategory } from '../data/blocks'

/**
 * The blocks index.
 *
 * Components answer "what does this prop do". Blocks answer "what does a real
 * screen look like when it is built only from these parts" — so they are filed
 * by the job the screen does rather than by the components inside it.
 */
export default function BlocksPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Text as="h1" size="title">
          Blocks
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
          Whole screens, assembled from the library and nothing else — no block introduces a colour,
          a radius or a spacing value of its own. Take one as the starting point for a real product
          screen, or read it to see how the pieces are meant to fit together.
        </Text>
        <Text size="caption" weight="semibold" tone="faint" tabular>
          {blockCount} blocks
        </Text>
      </header>

      {BLOCK_CATEGORIES.map((category) => {
        const entries = blocksInCategory(category)
        if (entries.length === 0) return null

        return (
          <section key={category} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5">
              <Text as="h2" size="subtitle">
                {category}
              </Text>
              <Text size="caption" weight="bold" tone="faint" tabular>
                {entries.length}
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {entries.map((block) => (
                <Link
                  key={block.slug}
                  to={`/blocks/${block.slug}`}
                  className="group rounded-[var(--radius-tile)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Surface
                    variant="tile"
                    padding="md"
                    className="h-full gap-2 bg-surface transition-colors group-hover:border-line-strong group-hover:bg-surface-sunken"
                  >
                    <Text size="body" weight="bold">
                      {block.name}
                    </Text>
                    <Text size="caption" tone="faint" leading="normal">
                      {block.blurb}
                    </Text>
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                      {block.uses.slice(0, 4).map((name) => (
                        <Badge key={name} tone="neutral">
                          {name}
                        </Badge>
                      ))}
                      {block.uses.length > 4 && (
                        <Text as="span" size="micro" weight="semibold" tone="faint">
                          +{block.uses.length - 4}
                        </Text>
                      )}
                    </div>
                  </Surface>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
