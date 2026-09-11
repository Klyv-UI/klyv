import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { StarIcon } from '../internal/icons'

export interface TestimonialCardProps {
  quote: ReactNode
  name: string
  /** Job title. */
  role?: string
  company?: string
  avatarSrc?: string
  /** The company's mark, in the corner. */
  logo?: ReactNode
  /** Out of five. */
  rating?: number
  /** Larger quote on the accent-soft ground, for the one that leads the wall. */
  featured?: boolean
  className?: string
}

/**
 * A customer quote with the person attached.
 *
 * Marked up as a `figure` holding a `blockquote` and a `figcaption`, which is
 * the only structure that tells assistive tech whose words these are. The
 * rating is one image with a sentence for a name, not five announced stars.
 */
export function TestimonialCard({
  quote,
  name,
  role,
  company,
  avatarSrc,
  logo,
  rating,
  featured = false,
  className,
}: TestimonialCardProps) {
  const byline = [role, company].filter(Boolean).join(' · ')

  return (
    <Surface
      as="figure"
      variant="card"
      padding="lg"
      className={cn('m-0 gap-5', featured && 'border-accent-soft bg-accent-soft/60', className)}
    >
      {rating !== undefined && (
        <span role="img" aria-label={`Rated ${rating} out of 5`} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, index) => (
            <StarIcon
              key={index}
              size={14}
              className={index < Math.round(rating) ? 'text-warning' : 'text-line-strong'}
            />
          ))}
        </span>
      )}

      <blockquote
        className={cn(
          'm-0 font-semibold tracking-[-0.01em] text-ink',
          featured ? 'text-[18px] leading-[1.45]' : 'text-[14px] leading-[1.55]',
        )}
      >
        {quote}
      </blockquote>

      <figcaption className="mt-auto flex items-center gap-3">
        <Avatar name={name} src={avatarSrc} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text as="span" size="body">
            {name}
          </Text>
          {byline && (
            <Text as="span" size="caption" tone="soft" truncate>
              {byline}
            </Text>
          )}
        </div>
        {logo && (
          <span aria-hidden="true" className="flex h-6 shrink-0 items-center text-ink-faint [&_svg]:h-full [&_svg]:w-auto">
            {logo}
          </span>
        )}
      </figcaption>
    </Surface>
  )
}
