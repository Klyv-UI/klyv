import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, Surface, Text } from 'citrine'
import { Note } from '../components/Doc'
import { Count, FilterChip } from '../components/FilterChip'
import { PageIntro } from '../components/PageIntro'
import { brand } from '../brand'
import { findBlock } from '../data/blocks'
import { SHOWCASE_CATEGORIES, showcase, type ShowcaseCategory, type ShowcaseProject } from '../data/showcase'
import { blockComponent } from '../lib/blocks'

/**
 * Built With: real interfaces made from the library.
 *
 * Every project so far was built in this repository, and the page says so at
 * the top rather than in a footnote. The previews are the projects themselves,
 * rendered live and scaled down — not screenshots — and each loads only when
 * it scrolls near the viewport.
 */
export default function BuiltWithPage() {
  const [params, setParams] = useSearchParams()
  const active = SHOWCASE_CATEGORIES.find((category) => category === params.get('category'))

  const setCategory = (category: ShowcaseCategory | null) => {
    const next = new URLSearchParams(params)
    if (category) next.set('category', category)
    else next.delete('category')
    setParams(next, { replace: true })
  }

  const projects = active ? showcase.filter((project) => project.category === active) : showcase

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="Built With" meta={`${showcase.length} projects`}>
        Interfaces made from the library and nothing else. Each one is live on this site, and its component
        count is read from what it actually imports.
      </PageIntro>

      <Note>
        There are no outside submissions yet, so every project here is a sample built by the maintainers in
        this repository, and is marked that way. Submissions are not open — there is no backend to receive
        them — but the data shape is ready for one.
      </Note>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
        <FilterChip active={!active} onClick={() => setCategory(null)}>
          All
          <Count>{showcase.length}</Count>
        </FilterChip>
        {SHOWCASE_CATEGORIES.map((category) => (
          <FilterChip key={category} active={active === category} onClick={() => setCategory(category)}>
            {category}
            <Count>{showcase.filter((project) => project.category === category).length}</Count>
          </FilterChip>
        ))}
      </div>

      {projects.length === 0 ? (
        <Surface variant="card" padding="lg">
          <EmptyState
            title={`No ${active} projects yet`}
            description="Nothing in this category has been built with the library so far."
          />
        </Surface>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <li key={project.slug}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: ShowcaseProject }) {
  const shown = project.components.slice(0, 6)
  return (
    <Surface variant="card" className="h-full overflow-hidden">
      <Preview project={project} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <Text as="h2" size="heading">
            {project.name}
          </Text>
          <Text size="micro" weight="bold" tone="faint" className="shrink-0 uppercase tracking-[0.14em]">
            {project.category}
          </Text>
        </div>
        <Text size="caption" tone="soft" leading="normal" className="line-clamp-3">
          {project.description}
        </Text>
        <Text size="caption" weight="bold" tabular className="pt-1">
          Built with {project.components.length} components
        </Text>
        <Text size="caption" tone="faint" leading="normal">
          {shown.join(', ')}
          {project.components.length > shown.length ? ` and ${project.components.length - shown.length} more` : ''}
        </Text>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <Text size="caption" weight="semibold" tone="faint">
            {project.creator.name}
            {project.sample ? ' · Sample' : ''}
          </Text>
          {project.to ? (
            <Link to={project.to} className="rounded-md text-[12px] font-bold text-ink underline-offset-4 hover:underline">
              View project
              <span className="sr-only">: {project.name}</span>
            </Link>
          ) : project.url ? (
            <a href={project.url} target="_blank" rel="noreferrer" className="rounded-md text-[12px] font-bold text-ink underline-offset-4 hover:underline">
              View project
              <span className="sr-only">: {project.name} (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </Surface>
  )
}

/** The project itself, a quarter size, inert — or a plain tile when there is nothing to render. */
function Preview({ project }: { project: ShowcaseProject }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || project.preview.kind !== 'block') return
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
  }, [project.preview.kind])

  const preview = project.preview
  const block = preview.kind === 'block' ? findBlock(preview.slug) : undefined
  const Block = block ? blockComponent(block.file) : undefined

  return (
    <div
      ref={ref}
      aria-hidden="true"
      {...({ inert: '' } as object)}
      className="relative h-[220px] overflow-hidden border-b border-line bg-app"
    >
      {preview.kind === 'image' && <img src={preview.src} alt="" className="size-full object-cover object-top" />}
      {preview.kind === 'none' && (
        <div className="grid size-full place-items-center">
          <span className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-[12px] bg-accent text-[18px] font-extrabold text-accent-ink">C</span>
            <span className="text-[22px] font-extrabold tracking-[-0.03em] text-ink">{brand.name}</span>
          </span>
        </div>
      )}
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
