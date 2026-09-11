import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Badge } from '../Badge'
import { IconTile } from '../IconTile'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { ArrowRightIcon } from '../internal/icons'

export interface FeatureItem {
  icon?: IconComponent
  title: string
  description: ReactNode
  /** A page that goes deeper. */
  href?: string
  linkLabel?: string
  /** Qualifier after the title — "New", "Beta". */
  badge?: string
}

export interface FeatureGridProps {
  features: FeatureItem[]
  columns?: 2 | 3 | 4
  /** plain sits on the page; card gives each feature its own surface. */
  variant?: 'plain' | 'card'
  headingLevel?: 'h3' | 'h4'
  className?: string
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

/**
 * A benefit-led grid of features: glyph, name, one sentence, and optionally a
 * link to the page that proves it.
 *
 * "Learn more" links are the classic unlabelled-link failure — nine identical
 * names in the links list. Each one here carries the feature's name for
 * assistive tech, so the visible label can stay short.
 */
export function FeatureGrid({
  features,
  columns = 3,
  variant = 'plain',
  headingLevel: Heading = 'h3',
  className,
}: FeatureGridProps) {
  const card = variant === 'card'

  return (
    <ul className={cn('grid gap-4', !card && 'gap-x-8 gap-y-10', COLUMNS[columns], className)}>
      {features.map((feature) => {
        const body = (
          <>
            {feature.icon && (
              <IconTile icon={feature.icon} tone={card ? 'muted' : 'accent'} size="lg" />
            )}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Heading className="text-[16px] font-bold leading-tight tracking-[-0.015em] text-ink">
                  {feature.title}
                </Heading>
                {feature.badge && <Badge>{feature.badge}</Badge>}
              </div>
              <Text size="body" weight="medium" tone="soft" leading="normal">
                {feature.description}
              </Text>
            </div>
            {feature.href && (
              <a
                href={feature.href}
                className="group mt-auto inline-flex items-center gap-1.5 self-start rounded-full text-[12px] font-bold text-ink underline-offset-4 hover:underline"
              >
                {feature.linkLabel ?? 'Learn more'}
                <VisuallyHidden>about {feature.title}</VisuallyHidden>
                <ArrowRightIcon size={12} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </>
        )

        return (
          <li key={feature.title} className="flex">
            {card ? (
              <Surface variant="card" padding="lg" className="w-full gap-4">
                {body}
              </Surface>
            ) : (
              <div className="flex w-full flex-col gap-4">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
