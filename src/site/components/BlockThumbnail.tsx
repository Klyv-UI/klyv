import { Suspense, useEffect, useRef, useState } from 'react'
import { cn } from 'klyv'
import { findBlock } from '../data/blocks'
import { blockComponent } from '../lib/blocks'

/**
 * A block, live, at two-fifths size — the screen itself rather than a
 * screenshot of it, so it always matches the current accent and theme.
 *
 * It mounts only when it scrolls near the viewport, so a page of cards loads
 * one screen at a time. The preview is decoration for the card beside it: it
 * is hidden from assistive technology and made inert, so its controls are not
 * tab stops and its headings do not join the page outline.
 */
export function BlockThumbnail({ slug, className }: { slug: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const block = findBlock(slug)
  const Block = block ? blockComponent(block.file) : undefined

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      {...({ inert: '' } as object)}
      className={cn('relative h-[220px] overflow-hidden border-b border-line bg-app', className)}
    >
      {Block && near && (
        <div className="pointer-events-none absolute left-0 top-0 w-[250%] origin-top-left scale-[0.4] p-6">
          <Suspense fallback={null}>
            <Block embedded />
          </Suspense>
        </div>
      )}
    </div>
  )
}
