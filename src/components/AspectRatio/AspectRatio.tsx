import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type AspectRatioFit = 'cover' | 'contain'

export interface AspectRatioProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Width over height: a number (`1.5`) or a ratio string (`"16/9"`, `"4:3"`).
   * Unparseable strings fall back to a square.
   */
  ratio?: number | string
  /** How an image, video or iframe child fills the box. */
  fit?: AspectRatioFit
  /** Usually one img, video, iframe or picture. It is stretched to the box. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/** Turns `16/9`, `16:9` or `1.78` into the value CSS `aspect-ratio` wants. */
function toAspect(ratio: number | string): string {
  if (typeof ratio === 'number') return ratio > 0 && Number.isFinite(ratio) ? String(ratio) : '1'
  const [width, height] = ratio.split(/[/:]/).map((part) => Number(part.trim()))
  if (height === undefined) return width > 0 ? String(width) : '1'
  return width > 0 && height > 0 ? `${width} / ${height}` : '1'
}

/**
 * A box that holds its shape before anything inside it has loaded.
 *
 * Media without known dimensions arrives at zero height and then shoves the
 * page down, which is the layout shift readers notice most. The box reserves
 * the space from the ratio alone, using CSS `aspect-ratio` rather than the old
 * padding-top hack, so it needs no wrapper and no script.
 *
 * The child is stretched across the whole box and cropped with `object-cover`
 * by default: a thumbnail grid wants every cell the same shape more than it
 * wants every pixel of every picture. `fit="contain"` letterboxes instead, for
 * the cases where the crop would cut off the point — a chart, a diagram.
 */
export function AspectRatio({ ratio = 1, fit = 'cover', children, className, style, ...rest }: AspectRatioProps) {
  return (
    <div
      {...rest}
      style={{ aspectRatio: toAspect(ratio), ...style }}
      className={cn(
        'relative w-full overflow-hidden',
        '[&>*]:absolute [&>*]:inset-0 [&>*]:size-full',
        fit === 'cover'
          ? '[&>img]:object-cover [&>video]:object-cover [&>picture>img]:size-full [&>picture>img]:object-cover'
          : '[&>img]:object-contain [&>video]:object-contain [&>picture>img]:size-full [&>picture>img]:object-contain',
        className,
      )}
    >
      {children}
    </div>
  )
}
