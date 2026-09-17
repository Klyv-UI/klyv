'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatPrice, plural } from '../../lib/format'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { CheckIcon, StarIcon } from '../internal/icons'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface ProductCardImage {
  src: string
  /** What the photo shows. */
  alt: string
}

export interface ProductCardSwatch {
  value: string
  /** Colour name, announced and shown on hover — "Sage". */
  label: string
  /** Any CSS colour for the chip. It is product content, not theme. */
  color: string
}

export type ProductCardBadge = 'sale' | 'new'

export interface ProductCardProps {
  title: string
  /** Product page. Makes the title a link. */
  href?: string
  image: ProductCardImage
  /** A second photo shown while the card is hovered — the product worn, or from behind. */
  hoverImage?: ProductCardImage
  /** Corner label. sale uses the accent fill; new the neutral one. */
  badge?: ProductCardBadge
  price: number
  /** The earlier price. Shown struck through when higher than `price`. */
  compareAtPrice?: number
  /** Currency symbol prefixed to prices. */
  currency?: string
  /** Average rating and review count. */
  rating?: { value: number; count: number }
  /** Colour options, as a radio group. */
  swatches?: ProductCardSwatch[]
  /** Controlled selected swatch value. */
  swatch?: string
  /** Initial swatch when uncontrolled. Defaults to the first. */
  defaultSwatch?: string
  /** Called when a swatch is chosen. */
  onSwatchChange?: (value: string) => void
  /** Add to cart. Return a promise to show the loading state until it settles. */
  onAddToCart?: (swatch: string | undefined) => void | Promise<void>
  /** Controlled wishlist state. */
  wishlisted?: boolean
  /** Initial wishlist state when uncontrolled. */
  defaultWishlisted?: boolean
  /** Called when the heart is toggled. */
  onWishlistChange?: (wishlisted: boolean) => void
  /** Heading level for the title. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** Merged last, so it wins. */
  className?: string
}

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 16 16" width={16} height={16} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
    <path d="M8 13.5S2 10 2 5.75A3.25 3.25 0 018 4a3.25 3.25 0 016 1.75C14 10 8 13.5 8 13.5z" />
  </svg>
)

/**
 * A product in a grid: enough to decide whether to open it, and enough to buy
 * it without doing so.
 *
 * The add-to-cart button runs through three states — ready, adding, added — in
 * place, and the result is also announced, because a cart count changing in a
 * header far away is not feedback anyone notices. Swatches are native radios,
 * so arrow keys choose a colour, and the wishlist heart is a toggle button with
 * a pressed state rather than an icon that silently changes fill.
 *
 * The hover photo is a crossfade the reader causes, and it switches instantly
 * under reduced motion.
 */
export function ProductCard({
  title,
  href,
  image,
  hoverImage,
  badge,
  price,
  compareAtPrice,
  currency = '$',
  rating,
  swatches,
  swatch: controlledSwatch,
  defaultSwatch,
  onSwatchChange,
  onAddToCart,
  wishlisted: controlledWish,
  defaultWishlisted = false,
  onWishlistChange,
  headingLevel: Heading = 'h3',
  className,
}: ProductCardProps) {
  const name = useId()
  const [swatchState, setSwatchState] = useState(defaultSwatch ?? swatches?.[0]?.value)
  const [wishState, setWishState] = useState(defaultWishlisted)
  const [cart, setCart] = useState<'idle' | 'adding' | 'added'>('idle')
  const reset = useRef(0)
  useEffect(() => () => window.clearTimeout(reset.current), [])

  const swatch = controlledSwatch ?? swatchState
  const wishlisted = controlledWish ?? wishState
  const onSale = compareAtPrice !== undefined && compareAtPrice > price
  const swatchLabel = swatches?.find((entry) => entry.value === swatch)?.label

  const add = async () => {
    if (!onAddToCart || cart === 'adding') return
    window.clearTimeout(reset.current)
    setCart('adding')
    try {
      await onAddToCart(swatch)
      setCart('added')
      reset.current = window.setTimeout(() => setCart('idle'), 2000)
    } catch {
      setCart('idle')
    }
  }

  return (
    <Surface as="article" variant="card" className={cn('group overflow-hidden', className)}>
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
        <img src={image.src} alt={image.alt} className="size-full object-cover" />
        {hoverImage && (
          <img
            src={hoverImage.src}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
          />
        )}
        {badge && (
          <Badge tone={badge === 'sale' ? 'accent' : 'neutral'} className="absolute left-3 top-3 px-2.5 py-1 text-[11px]">
            {badge === 'sale' ? 'Sale' : 'New'}
          </Badge>
        )}
        <button
          type="button"
          aria-pressed={wishlisted}
          aria-label={`Save ${title} to wishlist`}
          title={wishlisted ? 'Saved to wishlist' : 'Save to wishlist'}
          onClick={() => {
            if (controlledWish === undefined) setWishState(!wishlisted)
            onWishlistChange?.(!wishlisted)
          }}
          className={cn(
            'absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-shell shadow-[var(--shadow-float)] transition-colors hover:bg-surface-muted',
            wishlisted ? 'text-danger' : 'text-ink-soft',
          )}
        >
          <HeartIcon filled={wishlisted} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <Text as={Heading} size="body" weight="semibold" leading="tight">
            {href ? (
              <a href={href} className="hover:underline">
                {title}
              </a>
            ) : (
              title
            )}
          </Text>
          {rating && (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft">
              <StarIcon size={12} className="text-accent-strong" />
              <span aria-hidden="true">
                {rating.value.toFixed(1)} ({rating.count.toLocaleString()})
              </span>
              <VisuallyHidden>
                Rated {rating.value.toFixed(1)} out of 5 from {plural(rating.count, 'review')}
              </VisuallyHidden>
            </span>
          )}
        </div>

        <p className="flex items-baseline gap-2">
          <Text as="span" size="stat" tabular>
            {onSale && <VisuallyHidden>Now </VisuallyHidden>}
            {formatPrice(price, currency)}
          </Text>
          {onSale && (
            <Text as="s" size="label" tone="faint" tabular>
              <VisuallyHidden>was </VisuallyHidden>
              {formatPrice(compareAtPrice as number, currency)}
            </Text>
          )}
        </p>

        {swatches && swatches.length > 0 && (
          <div role="radiogroup" aria-label={`Colour: ${swatchLabel ?? 'none selected'}`} className="flex flex-wrap gap-1.5">
            {swatches.map((entry) => (
              <label key={entry.value} title={entry.label} className="cursor-pointer">
                <input
                  type="radio"
                  name={name}
                  value={entry.value}
                  checked={swatch === entry.value}
                  onChange={() => {
                    if (controlledSwatch === undefined) setSwatchState(entry.value)
                    onSwatchChange?.(entry.value)
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="block size-6 rounded-full border border-line-strong ring-offset-2 ring-offset-surface transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent-strong"
                  style={{ backgroundColor: entry.color }}
                />
                <VisuallyHidden>{entry.label}</VisuallyHidden>
              </label>
            ))}
          </div>
        )}

        {onAddToCart && (
          <Button
            fullWidth
            variant={cart === 'added' ? 'muted' : 'accent'}
            loading={cart === 'adding'}
            onClick={add}
            className="mt-auto"
          >
            {cart === 'added' && <CheckIcon size={14} />}
            {cart === 'adding' ? 'Adding…' : cart === 'added' ? 'Added to cart' : 'Add to cart'}
          </Button>
        )}
        <VisuallyHidden>
          <span role="status" aria-live="polite">
            {cart === 'added' ? `${title} added to cart` : ''}
          </span>
        </VisuallyHidden>
      </div>
    </Surface>
  )
}
