import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Surface, Text, cn } from 'citrine'
import { findComponentByName } from '../data/catalog'
import { sizeOf } from '../data/sizes'
import { dependenciesOf } from '../data/dependencies'
import { ariaRoles } from '../data/aria'
import { groupOf } from '../data/groups'
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

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        {entry && group && (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/components/${group.slug}`} className="rounded-full">
              <Badge>{entry.group}</Badge>
            </Link>
            <Badge tone="neutral">{entry.section}</Badge>
          </div>
        )}
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
    </article>
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
