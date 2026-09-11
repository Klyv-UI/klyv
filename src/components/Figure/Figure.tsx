import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface FigureProps {
  /** The media — an image, an SVG, a chart. */
  children: ReactNode
  caption?: ReactNode
  /** Aspect ratio as a CSS value, e.g. 16 / 9. */
  ratio?: string
  /** Rounded, bordered frame around the media. */
  framed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Media with its caption, as a real figure and figcaption pair — so the caption
 * is programmatically tied to the media rather than merely sitting near it.
 */
export function Figure({ children, caption, ratio, framed = true, className }: FigureProps) {
  return (
    <figure className={cn('m-0 flex flex-col gap-2', className)}>
      <div
        style={{ aspectRatio: ratio }}
        className={cn(
          'flex items-center justify-center overflow-hidden',
          framed && 'rounded-[var(--radius-tile)] border border-line bg-surface-sunken',
          '[&>img]:size-full [&>img]:object-cover',
        )}
      >
        {children}
      </div>
      {caption && (
        <figcaption>
          <Text size="caption" tone="faint" leading="normal">
            {caption}
          </Text>
        </figcaption>
      )}
    </figure>
  )
}
