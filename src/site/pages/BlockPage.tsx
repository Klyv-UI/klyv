import { Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScanSearch } from 'lucide-react'
import { Badge, Button, CodeBlock, Skeleton, Surface, Text } from 'klyvui'
import { Preview, Section } from '../components/Doc'
import { PageIntro } from '../components/PageIntro'
import { SaveControls } from '../components/SaveControls'
import { Xray } from '../components/Xray'
import { brand } from '../brand'
import { blocks, findBlock } from '../data/blocks'
import { blockSource } from '../data/source'
import { blockComponent } from '../lib/blocks'

/**
 * One block: the screen, then the file that produces it.
 *
 * Deliberately the same page shape as a component — breadcrumb, live example in
 * a frame, source, then previous/next — because a block is not a different kind
 * of documentation, only a larger subject.
 */
export default function BlockPage() {
  const { slug } = useParams()
  const [xray, setXray] = useState(false)
  const block = findBlock(slug)
  const Block = block ? blockComponent(block.file) : undefined

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
    <article className="flex flex-col gap-12">
      <PageIntro
        breadcrumb={[{ label: 'Blocks', to: '/blocks' }, { label: block.category }]}
        title={block.name}
        meta={`${block.uses.length} components · ${block.category}`}
        actions={
          <>
            <Button as={Link} to={`/composer?block=${block.slug}`} size="sm" variant="ghost">
              Open in Composer
            </Button>
            <SaveControls itemId={`block:${block.slug}`} name={block.name} />
          </>
        }
      >
        {block.blurb}
      </PageIntro>

      <Section
        title="Screen"
        description={
          xray
            ? 'X-ray is on: point at anything to see which component drew it. Clicks inspect rather than operate.'
            : 'Live, and interactive — try it rather than reading it.'
        }
      >
        <div className="flex justify-end">
          <Button size="sm" variant={xray ? 'accent' : 'outline'} aria-pressed={xray} onClick={() => setXray((on) => !on)}>
            <ScanSearch size={14} aria-hidden />
            {xray ? 'X-ray on' : 'X-ray this screen'}
          </Button>
        </div>
        <Xray enabled={xray} onExit={() => setXray(false)}>
          <Preview frame="canvas" className="p-0">
            <Suspense
              fallback={
                <div aria-busy="true" className="p-3 sm:p-5">
                  <Skeleton shape="rect" height={420} className="w-full rounded-[var(--radius-card)]" />
                </div>
              }
            >
              <Block embedded />
            </Suspense>
          </Preview>
        </Xray>
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
        description="The whole screen, verbatim. Take it with the CLI, or paste it in and change the copy."
      >
        <CodeBlock language="bash" code={`npx ${brand.pkg} add block ${block.slug}`} highlight={false} />
        <BlockCode file={block.file} />
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
