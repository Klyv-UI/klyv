'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface CarouselState {
  trackRef: React.RefObject<HTMLDivElement>
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
}

/**
 * Drives the chevron controls over a scrolling track. The controls appear only
 * while there is somewhere left to scroll, so they never sit there inert.
 */
export function useCarousel(gap = 16): CarouselState {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const sync = useCallback(() => {
    const element = trackRef.current
    if (!element) return
    const max = element.scrollWidth - element.clientWidth
    setCanScrollPrev(element.scrollLeft > 4)
    setCanScrollNext(element.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const element = trackRef.current
    if (!element) return
    sync()
    element.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [sync])

  const scrollBy = useCallback(
    (direction: 1 | -1) => {
      const element = trackRef.current
      if (!element) return
      const card = element.firstElementChild as HTMLElement | null
      const step = card ? card.offsetWidth + gap : element.clientWidth * 0.8
      element.scrollBy({ left: direction * step, behavior: 'smooth' })
    },
    [gap],
  )

  return {
    trackRef,
    canScrollPrev,
    canScrollNext,
    scrollPrev: () => scrollBy(-1),
    scrollNext: () => scrollBy(1),
  }
}
