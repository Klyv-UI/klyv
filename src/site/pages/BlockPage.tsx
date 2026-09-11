import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, CodeBlock, Surface, Text } from 'citrine'
import { Preview, Section } from '../components/Doc'
import { blocks, findBlock } from '../data/blocks'
import { blockSource } from '../data/source'

/**
 * One block: the screen, then the file that produces it.
 *
 * Deliberately the same page shape as a component — breadcrumb, live example in
 * a frame, source, then previous/next — because a block is not a different kind
 * of documentation, only a larger subject.
 */
/**
 * Every block is shown inside this page's own main landmark, so each one is
 * told it is embedded. Blocks without a shell of their own simply ignore it.
 */
interface BlockProps {
  embedded?: boolean
}

const BLOCK_COMPONENTS: Record<string, LazyExoticComponent<ComponentType<BlockProps>>> = {
  login: lazy(() => import('../blocks/LoginBlock')),
  signup: lazy(() => import('../blocks/SignupBlock')),
  authentication: lazy(() => import('../blocks/AuthenticationBlock')),
  admin: lazy(() => import('../blocks/AdminBlock')),
  dashboard: lazy(() => import('../blocks/DashboardBlock')),
  settings: lazy(() => import('../blocks/SettingsBlock')),
  profile: lazy(() => import('../blocks/ProfileBlock')),
  featured: lazy(() => import('../blocks/FeaturedBlock')),
}

const FILES: Record<string, string> = {
  login: 'LoginBlock.tsx',
  signup: 'SignupBlock.tsx',
  authentication: 'AuthenticationBlock.tsx',
  admin: 'AdminBlock.tsx',
  dashboard: 'DashboardBlock.tsx',
  settings: 'SettingsBlock.tsx',
  profile: 'ProfileBlock.tsx',
  featured: 'FeaturedBlock.tsx',
}

export default function BlockPage() {
  const { slug } = useParams()
  const block = findBlock(slug)
  const Block = slug ? BLOCK_COMPONENTS[slug] : undefined

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (!block || !Block) {
    return (
      <Surface variant="card" className="items-start gap-2 p-8">
        <Text size="subtitle">No such block</Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          There is no block at “{slug}”.
        </Text>
        <Link to="/blocks" className="mt-2 text-[13px] font-bold text-ink underline underline-offset-2">
          Browse the blocks
        </Link>
      </Surface>
    )
  }

  const index = blocks.findIndex((entry) => entry.slug === block.slug)
  const previous = index > 0 ? blocks[index - 1] : undefined
  const next = index < blocks.length - 1 ? blocks[index + 1] : undefined

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <nav aria-label="Documentation breadcrumb" className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/blocks"
            className="rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink"
          >
            Blocks
          </Link>
          <span aria-hidden className="text-[11.5px] font-bold text-ink-faint">
            /
          </span>
          <span className="text-[11.5px] font-bold text-ink-soft">{block.category}</span>
        </nav>

        <Text as="h1" size="title">
          {block.name}
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[68ch]">
          {block.blurb}
        </Text>
      </header>

      <Section title="Screen" description="Live, and interactive — try it rather than reading it.">
        <Preview frame="canvas" className="p-0">
          <Suspense fallback={<div className="min-h-[420px]" aria-busy="true" />}>
            <Block embedded />
          </Suspense>
        </Preview>
      </Section>

      <Section
        title="Built from"
        description="Library components only. A block that needed a value the system does not have would be a gap in the system."
      >
        <div className="flex flex-wrap gap-1.5">
          {block.uses.map((name) => (
            <Badge key={name} tone="neutral">
              {name}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        title="Code"
        description="The whole screen, verbatim. Paste it in and change the copy."
      >
        <BlockCode file={FILES[block.slug]} />
      </Section>

      <BlockNeighbours previous={previous} next={next} />
    </article>
  )
}

function BlockCode({ file }: { file: string }) {
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCode(null)
    blockSource(file)?.().then((text) => {
      if (!cancelled) setCode(text)
    })
    return () => {
      cancelled = true
    }
  }, [file])

  return <CodeBlock key={file} language={file} code={code ?? '…'} numbered collapsible collapsedLines={20} />
}

function BlockNeighbours({
  previous,
  next,
}: {
  previous?: { slug: string; name: string }
  next?: { slug: string; name: string }
}) {
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Nearby blocks"
      className="grid grid-cols-1 gap-2.5 border-t border-line pt-6 sm:grid-cols-2"
    >
      {previous ? (
        <Link to={`/blocks/${previous.slug}`} className="rounded-[var(--radius-tile)]">
          <Surface variant="tile" padding="sm" interactive className="h-full gap-0.5">
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
              Previous
            </Text>
            <Text size="caption" weight="bold">{`← ${previous.name}`}</Text>
          </Surface>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next && (
        <Link to={`/blocks/${next.slug}`} className="rounded-[var(--radius-tile)]">
          <Surface variant="tile" padding="sm" interactive className="h-full items-end gap-0.5 text-right">
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
              Next
            </Text>
            <Text size="caption" weight="bold">{`${next.name} →`}</Text>
          </Surface>
        </Link>
      )}
    </nav>
  )
}
