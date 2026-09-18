'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

export type LiveRegionPoliteness = 'polite' | 'assertive'

/** Says `message` to screen readers. Politeness defaults to polite. */
export type LiveRegionAnnounce = (message: string, politeness?: LiveRegionPoliteness) => void

export interface LiveRegionProps {
  /**
   * Components below call `useAnnounce()` and speak through this region. Optional: without children the region only
   * announces `message`.
   */
  children?: ReactNode
  /** Declarative announcement: each new value is spoken once. */
  message?: string
  /** How `message` interrupts: `polite` waits for the reader to pause, `assertive` cuts in. Keep assertive for errors. */
  politeness?: LiveRegionPoliteness
  /** Milliseconds before the spoken text is cleared from the region. 0 keeps it. */
  clearAfter?: number
}

interface Channel {
  node: HTMLElement | null
  last: string
  repeat: boolean
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Writes one message into a region.
 *
 * A live region only speaks when its content changes, so saying the same
 * thing twice — “Saved”, then “Saved” again a minute later — used to be
 * silent the second time. A repeat alternates a trailing no-break space,
 * which changes the text without changing what is read.
 */
function speak(channel: Channel, message: string, clearAfter: number) {
  const node = channel.node
  if (!node) return
  channel.repeat = message === channel.last ? !channel.repeat : false
  channel.last = message
  node.textContent = channel.repeat ? `${message} ` : message
  clearTimeout(channel.timer)
  if (clearAfter > 0) {
    channel.timer = setTimeout(() => {
      node.textContent = ''
      channel.last = ''
    }, clearAfter)
  }
}

const REGION_CLASS = 'sr-only'
const AnnounceContext = createContext<LiveRegionAnnounce | null>(null)

/** Regions made on demand for a `useAnnounce()` with no LiveRegion above it. One pair per document. */
let fallback: Record<LiveRegionPoliteness, Channel> | null = null

function documentChannels() {
  if (fallback?.polite.node?.isConnected) return fallback
  const make = (politeness: LiveRegionPoliteness): Channel => {
    const node = document.createElement('div')
    node.className = REGION_CLASS
    node.setAttribute('aria-live', politeness)
    node.setAttribute('aria-atomic', 'true')
    document.body.append(node)
    return { node, last: '', repeat: false }
  }
  fallback = { polite: make('polite'), assertive: make('assertive') }
  return fallback
}

/**
 * The page’s voice for things that change without moving focus — a save
 * finishing, a filter narrowing to twelve results, a row moving.
 *
 * The regions are rendered empty and on the page from the start, because a
 * region that appears in the same update as its text is often not registered
 * in time to be read. Text is then written straight into them, so announcing
 * does not re-render whatever called it. Messages clear after a few seconds so
 * a reader browsing the page later does not stumble over stale news.
 *
 * `useAnnounce()` works without a LiveRegion above it, falling back to one
 * shared pair appended to the body — so a component can announce without
 * asking every app to mount a provider, and an app that does gets the regions
 * where it wants them, inside a dialog’s focus trap for instance.
 */
export function LiveRegion({ children, message, politeness = 'polite', clearAfter = 5000 }: LiveRegionProps) {
  const polite = useRef<Channel>({ node: null, last: '', repeat: false })
  const assertive = useRef<Channel>({ node: null, last: '', repeat: false })

  const announce = useCallback<LiveRegionAnnounce>(
    (text, level = 'polite') => speak(level === 'assertive' ? assertive.current : polite.current, text, clearAfter),
    [clearAfter],
  )

  useEffect(() => {
    if (message) announce(message, politeness)
  }, [message, politeness, announce])

  useEffect(() => {
    const channels = [polite.current, assertive.current]
    return () => channels.forEach((channel) => clearTimeout(channel.timer))
  }, [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div
        ref={(node) => {
          polite.current.node = node
        }}
        aria-live="polite"
        aria-atomic="true"
        className={REGION_CLASS}
      />
      <div
        ref={(node) => {
          assertive.current.node = node
        }}
        aria-live="assertive"
        aria-atomic="true"
        className={REGION_CLASS}
      />
    </AnnounceContext.Provider>
  )
}

/**
 * Returns `announce(message, politeness?)`. Uses the nearest LiveRegion, or a shared pair of regions on the body when
 * there is none.
 */
export function useAnnounce(options: { clearAfter?: number } = {}): LiveRegionAnnounce {
  const scoped = useContext(AnnounceContext)
  const clearAfter = options.clearAfter ?? 5000
  return useMemo<LiveRegionAnnounce>(
    () =>
      scoped ??
      ((text, level = 'polite') => {
        if (typeof document === 'undefined') return
        speak(documentChannels()[level], text, clearAfter)
      }),
    [scoped, clearAfter],
  )
}
