import { Link } from 'react-router-dom'
import { Button, Text } from 'citrine'
import { BlockThumbnail } from '../components/BlockThumbnail'
import { PageIntro } from '../components/PageIntro'
import { FavoriteButton } from '../components/SaveControls'
import { BLOCK_CATEGORIES, blockCount, blocks, blocksInCategory, type BlockEntry } from '../data/blocks'

const componentsUsed = new Set(blocks.flatMap((block) => block.uses)).size

/**
 * The blocks index.
 *
 * Components answer "what does this prop do". Blocks answer "what does a real
 * screen look like when it is built only from these parts" — so each card
 * leads with the screen itself, live and scaled down, and they are filed by
 * the job the screen does rather than by the components inside it.
 */
export default function BlocksPage() {
  return (
    <div className="flex flex-col gap-12">
      <PageIntro
        eyebrow="Explore"
        title="Blocks"
        stats={[
          { value: blockCount, label: 'screens' },
          { value: BLOCK_CATEGORIES.length, label: 'categories' },
          { value: componentsUsed, label: 'components used' },
        ]}
        actions={
          <>
            <Button as={Link} to="/templates" size="sm" variant="outline">
              Browse templates
            </Button>
            <Button as={Link} to="/composer" size="sm" variant="ghost">
              Open the Composer
            </Button>
          </>
        }
      >
        Whole screens, assembled from the library and nothing else — no block introduces a colour, a radius or a
        spacing value of its own. Take one as the starting point for a real product screen, or read it to see how the
        pieces are meant to fit together.
      </PageIntro>

      {BLOCK_CATEGORIES.map((category) => {
        const entries = blocksInCategory(category)
        if (entries.length === 0) return null

        return (
          <section key={category} aria-labelledby={`blocks-${category}`} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5">
              <Text as="h2" id={`blocks-${category}`} size="subtitle" className="tracking-[-0.02em]">
                {category}
              </Text>
              <Text size="caption" weight="bold" tone="faint" tabular>
                {entries.length}
              </Text>
            </div>

            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {entries.map((block) => (
                <li key={block.slug}>
                  <BlockCard block={block} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * One block as a card: the screen on top, then what it is. The title link
 * stretches over the whole card, and the favourite button is lifted above it,
 * so the card is one target without nesting a button inside a link.
 */
function BlockCard({ block }: { block: BlockEntry }) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-colors focus-within:border-line-strong hover:border-line-strong">
      <BlockThumbnail slug={block.slug} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <Text as="h3" size="heading" className="min-w-0">
            <Link
              to={`/blocks/${block.slug}`}
              className="rounded-sm after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
            >
              {block.name}
            </Link>
          </Text>
          <FavoriteButton itemId={`block:${block.slug}`} name={block.name} variant="icon" className="relative z-10 -mr-1 -mt-1" />
        </div>
        <Text size="caption" tone="soft" leading="normal" className="line-clamp-2">
          {block.blurb}
        </Text>
        <Text size="micro" weight="semibold" tone="faint" className="mt-auto pt-2">
          {block.uses.length} components · {block.uses.slice(0, 4).join(', ')}
          {block.uses.length > 4 ? ` +${block.uses.length - 4}` : ''}
        </Text>
      </div>
    </article>
  )
}
