'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'
import { IconButton } from '../IconButton'
import { Lightbox } from '../Lightbox'
import { Text } from '../Text'

export interface ImageGalleryImage {
  src: string
  /** What the image shows. Also names its thumbnail. */
  alt: string
  /** Smaller file for the thumbnail strip. Defaults to `src`. */
  thumbnail?: string
  /** Shown under the image in the full-screen viewer. */
  caption?: string
}

export interface ImageGalleryProps {
  images: ImageGalleryImage[]
  /** Accessible name for the thumbnail strip — "Product photos". */
  label: string
  /** Controlled index of the shown image. */
  index?: number
  /** Initial image when uncontrolled. */
  defaultIndex?: number
  /** Called when the shown image changes. */
  onIndexChange?: (index: number) => void
  /** Open the main image in the full-screen Lightbox on click. */
  lightbox?: boolean
  /** Aspect ratio of the main frame, as a CSS value. */
  aspectRatio?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * One large image and the rest as thumbnails — the product page, the listing.
 *
 * The strip is a tablist and the main frame its panel, which is what the
 * pattern is: choosing a thumbnail swaps the content above. Only the chosen
 * thumbnail is a tab stop; arrow keys, Home and End move and select at once,
 * since showing an image is cheap and immediate. Previous and next buttons and
 * the counter serve pointer users who never see the strip on a small screen.
 *
 * Clicking the main image opens the library’s Lightbox rather than a zoom of
 * its own, and closing the viewer leaves the gallery on the image last seen.
 */
export function ImageGallery({
  images,
  label,
  index: controlledIndex,
  defaultIndex = 0,
  onIndexChange,
  lightbox = true,
  aspectRatio = '4 / 3',
  className,
}: ImageGalleryProps) {
  const id = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultIndex)
  const [viewer, setViewer] = useState<number | null>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const count = images.length
  const index = count === 0 ? 0 : Math.min(Math.max(controlledIndex ?? uncontrolled, 0), count - 1)

  if (count === 0) return null
  const current = images[index]

  const go = (next: number, focus = false) => {
    const target = (next + count) % count
    if (controlledIndex === undefined) setUncontrolled(target)
    onIndexChange?.(target)
    if (focus) tabs.current[target]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: count - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    go(moves[event.key], true)
  }

  const image = <img src={current.src} alt={current.alt} className="size-full object-cover" />

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        id={`${id}-panel`}
        role={count > 1 ? 'tabpanel' : undefined}
        aria-labelledby={count > 1 ? `${id}-tab-${index}` : undefined}
        className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-muted"
        style={{ aspectRatio }}
      >
        {lightbox ? (
          <button
            type="button"
            onClick={() => setViewer(index)}
            aria-label={`View full screen: ${current.alt}`}
            className="block size-full cursor-zoom-in"
          >
            {image}
          </button>
        ) : (
          image
        )}
        {count > 1 && (
          <>
            <IconButton icon={ChevronLeftIcon} label="Previous image" tone="white" size="sm" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <IconButton icon={ChevronRightIcon} label="Next image" tone="white" size="sm" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 -translate-y-1/2" />
            <span className="absolute bottom-3 right-3 rounded-full bg-shell px-2.5 py-1 shadow-[var(--shadow-float)]">
              <Text as="span" size="caption" weight="bold" tabular aria-live="polite" aria-atomic="true">
                {index + 1} / {count}
              </Text>
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown} className="flex gap-2 overflow-x-auto p-0.5">
          {images.map((entry, at) => (
            <button
              key={`${entry.src}-${at}`}
              ref={(node) => {
                tabs.current[at] = node
              }}
              id={`${id}-tab-${at}`}
              type="button"
              role="tab"
              aria-selected={at === index}
              aria-controls={`${id}-panel`}
              aria-label={entry.alt}
              tabIndex={at === index ? 0 : -1}
              onClick={() => go(at)}
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded-[var(--radius-10)] border-2 transition-colors',
                at === index ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={entry.thumbnail ?? entry.src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={images}
          index={viewer}
          onIndexChange={(next) => {
            setViewer(next)
            if (next !== null && next !== index) go(next)
          }}
        />
      )}
    </div>
  )
}
