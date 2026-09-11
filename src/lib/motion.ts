'use client'

import { useEffect, useRef, useState } from 'react'

/** True once the element has entered the viewport. Never flips back. */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return

    // Content that is already on screen is shown at once rather than on the
    // observer's first callback. Two reasons: above-the-fold content should
    // not wait on an async hop to become visible, and where
    // IntersectionObserver is missing or its delivery is starved, waiting
    // means the content never appears at all.
    const box = node.getBoundingClientRect()
    const onScreen = box.top < window.innerHeight && box.bottom > 0 && box.width + box.height > 0
    if (onScreen || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, inView])

  return { ref, inView }
}

/** Whether the user has asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
