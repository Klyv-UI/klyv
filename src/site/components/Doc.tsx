import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Surface, Text, cn } from 'citrine'
import { catalog, findComponentByName, type CatalogEntry } from '../data/catalog'
import { sizeOf } from '../data/sizes'
import { dependenciesOf } from '../data/dependencies'
import { ariaRoles } from '../data/aria'
import { groupOf, type GroupDefinition } from '../data/groups'
import { ComponentApi } from './ComponentApi'
import { SourceCode } from './SourceCode'

/**
 * Documentation chrome. It lives with the site rather than in the library so
 * the published package never carries docs-only layout.
 */

interface DocPageProps {
  /** Exported component name. Its group, section and source are looked up. */
  name: string
  description: string
  /**
   * Hand-written prop prose, used only where a prop has no JSDoc. The table
   * itself is generated from the type.
   */
  propNotes?: PropRow[]
  /** Prose that belongs under the API table rather than beside the examples. */
  apiNote?: ReactNode
  children: ReactNode
}

/**
 * One component page: where it sits, what it is, the examples, then the file.
 *
 * The source section is appended here rather than by each page, so every
 * component in the library is copyable without a page having to remember to
 * offer it.
 */
export function DocPage({ name, description, propNotes, apiNote, children }: DocPageProps) {
  const entry = findComponentByName(name)
  const group = entry ? groupOf(entry.group) : undefined
  const articleRef = useRef<HTMLElement>(null)
  const [outline, setOutline] = useState<OutlineItem[]>([])

  // The sections come from the page's own children — hand-written for the
  // primitives, data-driven for everything else — so the outline is read off
  // what actually rendered rather than being declared a second time.
  useEffect(() => {
    const root = articleRef.current
    if (!root) return

    const found: OutlineItem[] = []
    for (const section of root.querySelectorAll(':scope > section')) {
      const title = section.querySelector('h2')?.textContent?.trim()
      if (!title) continue
      const id = section.id || slugify(title)
      section.id = id
      found.push({ id, title })
    }

    // Only replace when it actually changed, so this can never drive itself.
    setOutline((previous) =>
      previous.map((item) => item.id).join('|') === found.map((item) => item.id).join('|')
        ? previous
        : found,
    )
  })

  const index = entry ? catalog.findIndex((item) => item.slug === entry.slug) : -1
  const previous = index > 0 ? catalog[index - 1] : undefined
  const next = index >= 0 && index < catalog.length - 1 ? catalog[index + 1] : undefined

  return (
    <div className="flex gap-10">
      <article ref={articleRef} className="flex min-w-0 flex-1 flex-col gap-8">
        <header className="flex flex-col gap-3">
          {entry && group && <Breadcrumb group={group} section={entry.section} />}
          <Text as="h1" size="title">
            {name}
          </Text>
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[68ch]">
            {description}
          </Text>
          <Facts name={name} />
        </header>

        {children}

        <Section
          title="API"
          description="Every prop the component declares, read off its type at build time."
        >
          <ComponentApi component={name} notes={propNotes} />
          {apiNote && <Note>{apiNote}</Note>}
        </Section>

        <Section
          title="Code"
          description="The implementation, verbatim. Copy it into your own project, or install the package and import it."
        >
          <SourceCode component={name} />
        </Section>

        <Neighbours previous={previous} next={next} />
      </article>

      {outline.length > 1 && <Outline items={outline} />}
    </div>
  )
}

interface OutlineItem {
  id: string
  title: string
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Where you are, and how to get back out.
 *
 * The group links to the filtered catalogue — the same URL the sidebar and the
 * landing page use — rather than to a path that looks like a component slug.
 */
function Breadcrumb({ group, section }: { group: GroupDefinition; section: string }) {
  return (
    // Named for the docs rather than "Breadcrumb": this page may be documenting
    // the Breadcrumb component itself, and two landmarks sharing a name is a
    // real failure for anyone navigating by landmark.
    <nav aria-label="Documentation breadcrumb" className="flex flex-wrap items-center gap-1.5">
      <Link
        to="/components"
        className="rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink"
      >
        Components
      </Link>
      <Separator />
      <Link
        to={`/components?group=${group.slug}`}
        className="rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink"
      >
        {group.id}
      </Link>
      <Separator />
      <span className="text-[11.5px] font-bold text-ink-soft">{section}</span>
    </nav>
  )
}

function Separator() {
  return (
    <span aria-hidden className="text-[11.5px] font-bold text-ink-faint">
      /
    </span>
  )
}

/** Jump list for a page that is mostly examples, so it is mostly long. */
function Outline({ items }: { items: OutlineItem[] }) {
  return (
    <aside className="hidden w-[186px] shrink-0 xl:block">
      <div className="sticky top-[88px] flex flex-col gap-2">
        <Text size="micro" weight="bold" tone="faint" className="px-3 uppercase tracking-[0.14em]">
          On this page
        </Text>
        {/* Not "On this page" — that is AnchorNav's own default label, and its
            page would then carry two landmarks with the same name. */}
        <nav aria-label="Documentation page sections" className="flex flex-col">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="truncate border-l-2 border-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-l-accent hover:text-ink"
            >
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}

/** The catalogue order, walked one at a time. */
function Neighbours({ previous, next }: { previous?: CatalogEntry; next?: CatalogEntry }) {
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Nearby components"
      className="grid grid-cols-1 gap-2.5 border-t border-line pt-6 sm:grid-cols-2"
    >
      {previous ? <Neighbour entry={previous} direction="Previous" /> : <span aria-hidden />}
      {next && <Neighbour entry={next} direction="Next" align="end" />}
    </nav>
  )
}

function Neighbour({
  entry,
  direction,
  align = 'start',
}: {
  entry: CatalogEntry
  direction: string
  align?: 'start' | 'end'
}) {
  return (
    <Link to={`/components/${entry.slug}`} className="group rounded-[var(--radius-tile)]">
      <Surface
        variant="tile"
        padding="sm"
        interactive
        className={cn('h-full gap-0.5', align === 'end' && 'items-end text-right')}
      >
        <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
          {direction}
        </Text>
        <Text size="caption" weight="bold">
          {align === 'end' ? `${entry.name} →` : `← ${entry.name}`}
        </Text>
      </Surface>
    </Link>
  )
}

/**
 * The three numbers worth knowing before you import something: what it weighs,
 * how many files come with it, and whether it can run on a server.
 *
 * All measured, none asserted — the weight comes from the built package over
 * the component's whole dependency set, which is what a bundler would actually
 * add.
 */
function Facts({ name }: { name: string }) {
  const size = sizeOf(name)
  if (!size) return null

  const resolved = dependenciesOf(name)
  const brought = resolved.components.length - 1

  return (
    <dl className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <Fact label="Size">
        {(size.gzip / 1024).toFixed(2)} kB{' '}
        <span className="font-normal text-ink-faint">gzipped</span>
      </Fact>
      <Fact label="Brings">
        {brought === 0 ? 'nothing' : `${brought} component${brought === 1 ? '' : 's'}`}
      </Fact>
      <Fact label="Files">{resolved.files.length}</Fact>
      {ariaRoles[name] && <Fact label="Roles">{ariaRoles[name].join(', ')}</Fact>}
    </dl>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>
        <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
          {label}
        </Text>
      </dt>
      <dd>
        <Text as="span" size="caption" weight="bold" tabular>
          {children}
        </Text>
      </dd>
    </div>
  )
}

interface SectionProps {
  title: string
  description?: string
  id?: string
  children: ReactNode
}

export function Section({ title, description, id, children }: SectionProps) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Text as="h2" size="heading">
          {title}
        </Text>
        {description && (
          <Text size="label" weight="medium" tone="faint" leading="normal" className="max-w-[72ch]">
            {description}
          </Text>
        )}
      </div>
      {children}
    </section>
  )
}

export type PreviewBackground = 'surface' | 'app' | 'canvas' | 'accent'

const BACKGROUNDS: Record<PreviewBackground, string> = {
  surface: 'bg-surface',
  app: 'bg-app',
  canvas: 'bg-canvas',
  accent: 'bg-accent',
}

interface PreviewProps {
  children: ReactNode
  background?: PreviewBackground
  /** Stack specimens instead of laying them out in a row. */
  stack?: boolean
  className?: string
}

/** The canvas a demo sits on. */
export function Preview({ children, background = 'surface', stack = false, className }: PreviewProps) {
  return (
    <Surface
      variant="card"
      className={cn(
        'overflow-hidden p-6',
        BACKGROUNDS[background],
        // `flex-row` is explicit: Surface defaults to a column, and `flex-wrap`
        // alone does not override a flex-direction.
        stack ? 'flex flex-col gap-5' : 'flex flex-row flex-wrap items-center gap-5',
        className,
      )}
    >
      {children}
    </Surface>
  )
}

interface SpecimenProps {
  /** The prop value or state this cell demonstrates. */
  label: string
  hint?: string
  /** Stretch the cell and its content to the full row width. */
  fill?: boolean
  children: ReactNode
  className?: string
}

/** One labelled demo cell. */
export function Specimen({ label, hint, fill = false, children, className }: SpecimenProps) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-2.5', fill && 'w-full', className)}>
      <div className={cn('flex min-h-11 items-center', fill && 'w-full')}>{children}</div>
      <div className="flex flex-col gap-0.5">
        <Text size="caption" weight="semibold" tone="soft">
          {label}
        </Text>
        {hint && (
          <Text size="caption" weight="medium" tone="faint">
            {hint}
          </Text>
        )}
      </div>
    </div>
  )
}

/** Inline monospace for a prop or token name. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[6px] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
      {children}
    </code>
  )
}

export interface PropRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

/** The component's public API, written out by hand next to its demos. */
export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <Surface variant="card" className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {['Prop', 'Type', 'Default', 'Description'].map((heading) => (
              <th key={heading} className="px-4 py-3">
                <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                  {heading}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-line last:border-0 align-top">
              <td className="px-4 py-3">
                <Code>{row.name}</Code>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-[11px] font-medium leading-relaxed text-ink-soft">
                  {row.type}
                </span>
              </td>
              <td className="px-4 py-3">
                {row.defaultValue ? (
                  <span className="font-mono text-[11px] font-medium text-ink-faint">
                    {row.defaultValue}
                  </span>
                ) : (
                  <Text size="caption" tone="faint">
                    —
                  </Text>
                )}
              </td>
              <td className="px-4 py-3">
                <Text size="caption" weight="medium" tone="soft" leading="normal">
                  {row.description}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  )
}

/** Callout for a rule that is easy to get wrong. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <Surface variant="sunken" padding="sm" className="border-l-2 border-l-accent-strong">
      <Text size="caption" weight="medium" tone="soft" leading="normal">
        {children}
      </Text>
    </Surface>
  )
}
