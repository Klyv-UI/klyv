import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Surface, Text, cn } from 'klyv'
import { itemTypeLabel, type LibraryItem } from '../data/library'
import { FavoriteButton } from './SaveControls'
import { NewBadge } from './NewBadge'
import { ShowpieceBadge } from './ShowpieceBadge'

/**
 * One library item as a card — the same tile the catalogue uses, for any kind
 * of item.
 *
 * The favourite button sits on the card, so the link cannot wrap the whole
 * card (a button inside a link is invalid, and the axe suite caught exactly
 * that once before). Instead the title link stretches over the card with a
 * pseudo-element, and the button is lifted above it.
 */
export function ItemCard({
  item,
  footer,
  showType = true,
  headingLevel: Heading = 'h3',
  className,
}: {
  item: LibraryItem
  /** Under the description — why it was recommended, what it is built from. */
  footer?: ReactNode
  showType?: boolean
  headingLevel?: 'h2' | 'h3' | 'h4'
  className?: string
}) {
  return (
    <Surface
      variant="tile"
      padding="md"
      className={cn(
        'relative h-full gap-1.5 bg-surface transition-colors focus-within:border-line-strong hover:border-line-strong hover:bg-surface-sunken',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {showType && (
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
              {itemTypeLabel(item.type)}
              {item.type === 'component' || item.type === 'integration' ? ` · ${item.category}` : ''}
            </Text>
          )}
          <span className="flex min-w-0 items-center gap-1.5">
            <Heading className="min-w-0 truncate text-[13px] font-bold leading-snug text-ink">
              <Link
                to={item.to}
                className="rounded-sm after:absolute after:inset-0 after:rounded-[var(--radius-tile)] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
              >
                {item.name}
              </Link>
            </Heading>
            {item.isShowpiece ? <ShowpieceBadge /> : item.isNew && <NewBadge />}
          </span>
        </div>
        <FavoriteButton itemId={item.id} name={item.name} variant="icon" className="relative z-10 -mr-1 -mt-1" />
      </div>
      <Text size="caption" tone="faint" leading="normal" className="line-clamp-2">
        {item.description}
      </Text>
      {footer && <div className="relative mt-auto pt-2">{footer}</div>}
    </Surface>
  )
}
