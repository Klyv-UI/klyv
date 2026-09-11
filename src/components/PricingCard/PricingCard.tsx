import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { CheckIcon, MinusIcon } from '../internal/icons'
import { formatPrice } from '../../lib/format'

export interface PricingFeature {
  label: string
  /** false draws the row struck out — for a comparison inside a single card. */
  included?: boolean
  hint?: string
}

export interface PricingCardProps {
  name: string
  description?: string
  /** Price per period. null is a custom plan — "Let's talk" pricing. */
  price: number | null
  currency?: string
  /** "/month", "/seat/month". */
  period?: string
  /** Line under the price — "Billed $468 yearly". */
  priceCaption?: ReactNode
  /** The price before a discount, struck through beside the real one. */
  compareAt?: number | null
  /** Shown in place of the figure when price is null. */
  customLabel?: string
  features?: (string | PricingFeature)[]
  /** Heading over the list — "Everything in Starter, plus". */
  featuresTitle?: string
  /** Usually a full-width Button. */
  action?: ReactNode
  /** Pill on the top edge — "Most popular". */
  badge?: string
  /** The recommended plan: accent border and lift. */
  featured?: boolean
  /** The plan this account is on. */
  current?: boolean
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * One plan: name, price, the action, and what you get.
 *
 * The action sits directly under the price rather than after the list. Pricing
 * pages are scanned price-to-button; burying the button below twelve bullet
 * points means the cards' buttons never line up, and the recommended one is
 * the lowest on the page.
 *
 * Excluded features are announced as excluded. A struck-out row that a screen
 * reader reads identically to an included one is worse than leaving it out.
 */
export function PricingCard({
  name,
  description,
  price,
  currency = '$',
  period = '/month',
  priceCaption,
  compareAt,
  customLabel = 'Custom',
  features = [],
  featuresTitle,
  action,
  badge,
  featured = false,
  current = false,
  headingLevel: Heading = 'h3',
  className,
}: PricingCardProps) {
  const rows = features.map((feature) =>
    typeof feature === 'string' ? { label: feature, included: true } : { included: true, ...feature },
  )

  return (
    <Surface
      variant="card"
      padding="lg"
      className={cn(
        'relative h-full gap-5',
        featured && 'border-accent-strong shadow-[var(--shadow-float)] ring-1 ring-accent-strong',
        className,
      )}
    >
      {badge && (
        <Badge className="absolute -top-2.5 left-5 px-2.5 py-[5px] shadow-[var(--shadow-tile)]">{badge}</Badge>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Heading className="text-[15px] font-bold leading-none tracking-[-0.01em] text-ink">{name}</Heading>
          {current && (
            <Tag size="sm" tone="accent">
              Current plan
            </Tag>
          )}
        </div>
        {description && (
          <Text size="caption" weight="medium" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {compareAt != null && price != null && compareAt > price && (
            <Text as="s" size="subtitle" weight="bold" tone="faint" tabular className="decoration-2">
              <VisuallyHidden>Was </VisuallyHidden>
              {formatPrice(compareAt, currency)}
            </Text>
          )}
          <span className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink tabular">
            {price == null ? customLabel : formatPrice(price, currency)}
          </span>
          {price != null && price > 0 && (
            <Text as="span" size="label" weight="semibold" tone="soft">
              {period}
            </Text>
          )}
        </div>
        {priceCaption && (
          <Text size="caption" weight="medium" tone="faint">
            {priceCaption}
          </Text>
        )}
      </div>

      {action && <div className="flex flex-col [&>*]:w-full">{action}</div>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          {featuresTitle && (
            <Text size="caption" weight="bold" tone="default">
              {featuresTitle}
            </Text>
          )}
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <li key={row.label} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full',
                    row.included ? 'bg-accent-soft text-accent-ink' : 'bg-surface-muted text-ink-faint',
                  )}
                >
                  {row.included ? <CheckIcon size={11} strokeWidth={3} /> : <MinusIcon size={11} strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <Text as="span" size="label" weight="semibold" tone={row.included ? 'default' : 'faint'} leading="normal">
                    {!row.included && <VisuallyHidden>Not included: </VisuallyHidden>}
                    {row.label}
                  </Text>
                  {row.hint && (
                    <Text as="span" size="caption" tone="faint">
                      {row.hint}
                    </Text>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
