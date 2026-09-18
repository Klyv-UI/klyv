'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'

export type WebVitalsName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
export type WebVitalsRating = 'good' | 'needs-improvement' | 'poor'

export interface WebVitalsMetric {
  name: WebVitalsName
  /** Milliseconds, except CLS, which is unitless. */
  value: number
  rating: WebVitalsRating
  /** The element or selector responsible — the LCP element, the largest shift, the slowest interaction. */
  attribution?: string
}

export interface WebVitalsProps {
  /** Which metrics to show, in order. */
  metrics?: WebVitalsName[]
  /** Called each time a metric’s value changes — send it to your analytics. */
  onReport?: (metric: WebVitalsMetric) => void
  /** Merged last, so it wins. */
  className?: string
}

/** Google’s published thresholds: [good up to, poor from]. */
const THRESHOLDS: Record<WebVitalsName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
}

const INFO: Record<WebVitalsName, { title: string; entry: string }> = {
  LCP: { title: 'Largest Contentful Paint', entry: 'largest-contentful-paint' },
  CLS: { title: 'Cumulative Layout Shift', entry: 'layout-shift' },
  INP: { title: 'Interaction to Next Paint', entry: 'event' },
  FCP: { title: 'First Contentful Paint', entry: 'paint' },
  TTFB: { title: 'Time to First Byte', entry: 'navigation' },
}

const rate = (name: WebVitalsName, value: number): WebVitalsRating =>
  value <= THRESHOLDS[name][0] ? 'good' : value <= THRESHOLDS[name][1] ? 'needs-improvement' : 'poor'

const TONE = { good: 'success', 'needs-improvement': 'warning', poor: 'danger' } as const
const LABEL = { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' }

const format = (name: WebVitalsName, value: number) =>
  name === 'CLS' ? value.toFixed(3) : value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`

/** A short CSS path — `main > section.hero > img#cover` — enough to find the element in devtools. */
function selector(node: Node | null | undefined): string | undefined {
  const parts: string[] = []
  let element = node instanceof Element ? node : node?.parentElement ?? null
  while (element && parts.length < 4 && element !== document.body) {
    let part = element.tagName.toLowerCase()
    if (element.id) {
      parts.unshift(`${part}#${element.id}`)
      break
    }
    const classes = [...element.classList].filter((name) => /^[a-z][\w-]*$/i.test(name)).slice(0, 2)
    if (classes.length) part += `.${classes.join('.')}`
    parts.unshift(part)
    element = element.parentElement
  }
  return parts.length ? parts.join(' > ') : undefined
}

type Entry = PerformanceEntry & Record<string, unknown>
type State = Partial<Record<WebVitalsName, WebVitalsMetric>>

/**
 * The page’s Core Web Vitals, measured in the reader’s own browser as they use it.
 *
 * Each metric is observed the way Chrome’s field data defines it, not a lab
 * approximation: LCP is the last largest-contentful-paint candidate before the
 * first input; CLS is the worst session window of shifts (gaps under a second,
 * windows under five) that the reader did not cause; INP groups event timings by
 * interaction and takes the 98th percentile — the worst, until there are fifty
 * interactions, then one fewer for each fifty; FCP and TTFB come from the paint
 * and navigation entries. Each value is rated against Google’s thresholds and
 * names the element responsible, because a poor LCP is only useful once you know
 * which image it was. Browsers that do not expose an entry type say so for that
 * metric rather than showing a zero.
 */
export function WebVitals({ metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'], onReport, className }: WebVitalsProps) {
  const [values, setValues] = useState<State>({})
  const [support, setSupport] = useState<Partial<Record<WebVitalsName, boolean>> | null>(null)
  const report = useRef(onReport)
  report.current = onReport

  useEffect(() => {
    const Observer = typeof PerformanceObserver === 'undefined' ? undefined : PerformanceObserver
    const types: readonly string[] = Observer?.supportedEntryTypes ?? []
    const navigation = performance.getEntriesByType?.('navigation')?.[0] as Entry | undefined
    setSupport({
      LCP: types.includes('largest-contentful-paint'),
      CLS: types.includes('layout-shift'),
      INP: types.includes('event'),
      FCP: types.includes('paint'),
      TTFB: Boolean(navigation && typeof navigation.responseStart === 'number' && Number(navigation.responseStart) > 0),
    })

    const set = (name: WebVitalsName, value: number, attribution?: string) => {
      const metric: WebVitalsMetric = { name, value, rating: rate(name, value), attribution }
      setValues((current) => ({ ...current, [name]: metric }))
      report.current?.(metric)
    }

    if (navigation && Number(navigation.responseStart) > 0) {
      set('TTFB', Math.max(0, Number(navigation.responseStart) - Number(navigation.activationStart ?? 0)))
    }
    if (!Observer) return

    const observers: PerformanceObserver[] = []
    const observe = (type: string, callback: (entries: Entry[]) => void, extra: Record<string, unknown> = {}) => {
      if (!types.includes(type)) return
      const observer = new Observer((list) => callback(list.getEntries() as Entry[]))
      observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit)
      observers.push(observer)
    }

    // LCP stops at the first input: after that, new large paints are the reader’s doing.
    let lcpFinal = false
    const finalise = () => (lcpFinal = true)
    addEventListener('keydown', finalise, { once: true, capture: true })
    addEventListener('pointerdown', finalise, { once: true, capture: true })
    observe('largest-contentful-paint', (entries) => {
      if (lcpFinal) return
      const last = entries[entries.length - 1]
      if (last) set('LCP', last.startTime, selector(last.element as Element | null))
    })

    observe('paint', (entries) => {
      const fcp = entries.find((entry) => entry.name === 'first-contentful-paint')
      if (fcp) set('FCP', fcp.startTime)
    })

    // CLS: session windows, keep the worst.
    let session = { value: 0, first: 0, last: 0, largest: undefined as Entry | undefined }
    let worst = { value: 0, largest: undefined as Entry | undefined }
    observe('layout-shift', (entries) => {
      for (const entry of entries) {
        if (entry.hadRecentInput) continue
        const value = Number(entry.value)
        if (session.value && entry.startTime - session.last < 1000 && entry.startTime - session.first < 5000) {
          session.value += value
          session.last = entry.startTime
          if (!session.largest || value > Number(session.largest.value)) session.largest = entry
        } else {
          session = { value, first: entry.startTime, last: entry.startTime, largest: entry }
        }
        if (session.value > worst.value) worst = { value: session.value, largest: session.largest }
      }
      const sources = (worst.largest?.sources as { node?: Node | null; currentRect?: DOMRectReadOnly }[] | undefined) ?? []
      const biggest = [...sources].sort((a, b) => area(b.currentRect) - area(a.currentRect))[0]
      set('CLS', worst.value, selector(biggest?.node))
    })
    if (types.includes('layout-shift')) set('CLS', 0)

    // INP: the longest duration per interaction, then the p98 of those.
    const interactions = new Map<number, { duration: number; target?: string }>()
    const onEvents = (entries: Entry[]) => {
      for (const entry of entries) {
        const id = Number(entry.interactionId ?? 0)
        if (!id) continue
        const previous = interactions.get(id)
        if (!previous || entry.duration > previous.duration) {
          interactions.set(id, { duration: entry.duration, target: selector(entry.target as Node | null) ?? previous?.target })
        }
      }
      if (!interactions.size) return
      const sorted = [...interactions.values()].sort((a, b) => b.duration - a.duration)
      const pick = sorted[Math.min(sorted.length - 1, Math.floor(interactions.size / 50))]
      set('INP', pick.duration, pick.target)
    }
    observe('event', onEvents, { durationThreshold: 16 })
    observe('first-input', onEvents)

    return () => {
      observers.forEach((observer) => observer.disconnect())
      removeEventListener('keydown', finalise, { capture: true })
      removeEventListener('pointerdown', finalise, { capture: true })
    }
  }, [])

  const unsupported = support !== null && metrics.every((name) => !support[name])

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {unsupported && (
        <Text size="label" tone="soft" leading="normal" role="status" className="rounded-[var(--radius-tile)] border border-line bg-surface-sunken px-4 py-3">
          This browser does not expose the Performance Observer entry types these metrics need. Open the page in a
          recent Chromium browser to measure them; Firefox and Safari report only some.
        </Text>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Web vitals">
        {metrics.map((name) => {
          const metric = values[name]
          const [good, poor] = THRESHOLDS[name]
          const available = support?.[name] !== false
          const max = poor * 1.5
          const position = metric ? Math.min(1, metric.value / max) : 0
          return (
            <li key={name} className="flex flex-col gap-2.5 rounded-[var(--radius-tile)] border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <Text as="span" size="label" weight="bold">
                  <abbr title={INFO[name].title} className="no-underline">{name}</abbr>
                </Text>
                {metric && (
                  <span className="flex items-center gap-1.5">
                    <StatusDot tone={TONE[metric.rating]} />
                    <Text as="span" size="caption" tone="soft">{LABEL[metric.rating]}</Text>
                  </span>
                )}
              </div>
              <Text as="span" size="amount" tabular className={cn(!metric && 'text-ink-faint')}>
                {metric ? format(name, metric.value) : available ? 'Waiting…' : '—'}
              </Text>
              <div className="relative h-1.5" aria-hidden="true">
                <div className="flex h-full overflow-hidden rounded-full">
                  <span className="h-full bg-success/70" style={{ width: `${(good / max) * 100}%` }} />
                  <span className="h-full bg-warning/70" style={{ width: `${((poor - good) / max) * 100}%` }} />
                  <span className="h-full flex-1 bg-danger/70" />
                </div>
                {metric && (
                  <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink" style={{ left: `${position * 100}%` }} />
                )}
              </div>
              <Text size="caption" tone="faint" leading="normal">
                {!available
                  ? `${INFO[name].title} — not supported in this browser.`
                  : name === 'INP' && !metric
                    ? 'Click, tap or type anywhere on the page to measure it.'
                    : `${INFO[name].title}. Good ≤ ${format(name, good)}, poor > ${format(name, poor)}.`}
              </Text>
              {metric?.attribution && (
                <Text size="caption" tone="soft" className="break-all">
                  <span className="text-ink-faint">{name === 'CLS' ? 'Largest shift: ' : name === 'INP' ? 'Slowest target: ' : 'Element: '}</span>
                  <code className="font-mono text-[11px]">{metric.attribution}</code>
                </Text>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function area(rect?: DOMRectReadOnly) {
  return rect ? rect.width * rect.height : 0
}
