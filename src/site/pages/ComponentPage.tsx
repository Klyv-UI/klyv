import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Surface, Text } from 'citrine'
import { DocPage, Note, Preview, Section, Specimen } from '../components/Doc'
import { LivePlayground } from '../components/LivePlayground'
import { PageSkeleton } from '../components/PageSkeleton'
import { findComponent } from '../data/catalog'
import { loadProps } from '../data/props'
import { loadExamples } from '../examples'
import type { ComponentExamples } from '../examples/types'

/**
 * Resolves `/components/:slug`.
 *
 * Two kinds of page coexist. The primitives have pages written by hand because
 * each one needed its own argument; everything else is described as data and
 * rendered by the same shell below. Both end up inside `DocPage`, so both get
 * the same header and the same copyable source section.
 */
const HAND_WRITTEN_PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  text: lazy(() => import('./components/TextPage')),
  surface: lazy(() => import('./components/SurfacePage')),
  divider: lazy(() => import('./components/DividerPage')),
  button: lazy(() => import('./components/ButtonPage')),
  'icon-button': lazy(() => import('./components/IconButtonPage')),
  input: lazy(() => import('./components/InputPage')),
  textarea: lazy(() => import('./components/TextareaPage')),
  label: lazy(() => import('./components/LabelPage')),
  checkbox: lazy(() => import('./components/CheckboxPage')),
  radio: lazy(() => import('./components/RadioPage')),
  switch: lazy(() => import('./components/SwitchPage')),
  slider: lazy(() => import('./components/SliderPage')),
  avatar: lazy(() => import('./components/AvatarPage')),
  'icon-tile': lazy(() => import('./components/IconTilePage')),
  badge: lazy(() => import('./components/BadgePage')),
  tag: lazy(() => import('./components/TagPage')),
  chip: lazy(() => import('./components/ChipPage')),
  kbd: lazy(() => import('./components/KbdPage')),
  meter: lazy(() => import('./components/MeterPage')),
  progress: lazy(() => import('./components/ProgressPage')),
  'progress-ring': lazy(() => import('./components/ProgressRingPage')),
  'status-dot': lazy(() => import('./components/StatusDotPage')),
  spinner: lazy(() => import('./components/SpinnerPage')),
  skeleton: lazy(() => import('./components/SkeletonPage')),
  'skip-link': lazy(() => import('./components/SkipLinkPage')),
  'visually-hidden': lazy(() => import('./components/VisuallyHiddenPage')),
  wordmark: lazy(() => import('./components/WordmarkPage')),
}

export default function ComponentPage() {
  const { slug } = useParams()
  const entry = findComponent(slug)
  const Page = slug ? HAND_WRITTEN_PAGES[slug] : undefined

  const [examples, setExamples] = useState<ComponentExamples | null | undefined>(undefined)

  useEffect(() => {
    if (!slug || !entry) return
    // The API table's data is its own chunk; fetched alongside the examples so
    // the page arrives whole instead of the table filling in afterwards.
    const props = loadProps(entry.name)
    if (Page) return

    let cancelled = false
    setExamples(undefined)
    Promise.all([loadExamples(slug), props]).then(([result]) => {
      if (!cancelled) setExamples(result ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [slug, entry, Page])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (!entry) {
    return (
      <Surface variant="card" className="items-start gap-2 p-8">
        <Text size="subtitle">Not in the library</Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          There is no component at “{slug}”.
        </Text>
        <Link
          to="/components"
          className="mt-2 text-[13px] font-bold text-ink underline underline-offset-2"
        >
          Browse everything
        </Link>
      </Surface>
    )
  }

  if (Page) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Page />
      </Suspense>
    )
  }

  if (examples === undefined) return <PageSkeleton />

  if (examples === null) {
    return (
      <DocPage name={entry.name} description={entry.blurb}>
        <Note>
          This component is exported from the package, but its examples have not been written yet.
          The implementation is below.
        </Note>
      </DocPage>
    )
  }

  return (
    <DocPage name={entry.name} description={examples.description} propNotes={examples.props}>
      <LivePlayground key={entry.name} name={entry.name} />
      {examples.sections.map((section) => {
        const { Content } = section
        const body = (
          <>
            {section.specimens?.map((specimen) => (
              <Specimen
                key={specimen.label}
                label={specimen.label}
                hint={specimen.hint}
                fill={specimen.fill}
              >
                {specimen.node}
              </Specimen>
            ))}
            {Content && <Content />}
          </>
        )

        return (
          <Section key={section.title} title={section.title} description={section.description}>
            {/* `bare` no longer means "no frame" — it means the content brings
                its own cards, so the frame recedes to a canvas instead of
                stacking a card inside a card. Every example keeps one outer
                container, which is what makes the pages feel like one system. */}
            <Preview
              stack={section.stack}
              background={section.background}
              frame={section.bare ? 'canvas' : 'card'}
            >
              {body}
            </Preview>
            {section.note && <Note>{section.note}</Note>}
          </Section>
        )
      })}
    </DocPage>
  )
}

