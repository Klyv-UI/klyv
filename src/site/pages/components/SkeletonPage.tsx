import { useState } from 'react'
import { Music } from 'lucide-react'
import { Avatar, IconTile, Skeleton, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { NumberControl, Playground, SelectControl, ToggleControl } from '../../components/Playground'

const SHAPES = ['text', 'rect', 'circle'] as const

function TransactionRow() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2.5">
      <Avatar name="Sarah Rosewood" />
      <div className="min-w-0 flex-1">
        <Text truncate>Sarah Rosewood</Text>
        <Text size="caption" tone="faint" truncate>
          Today, 4:28 PM
        </Text>
      </div>
      <Text tabular>+$125,00</Text>
    </div>
  )
}

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2.5">
      <Skeleton shape="circle" width={36} height={36} />
      <div className="min-w-0 flex-1">
        <Skeleton width="55%" />
        <Skeleton width="35%" className="mt-1.5 h-2.5" />
      </div>
      <Skeleton width={64} />
    </div>
  )
}

export default function SkeletonPage() {
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('text')
  const [lines, setLines] = useState(3)
  const [loading, setLoading] = useState(true)

  return (
    <DocPage
      name="Skeleton"
      description="A loading placeholder. It knows only geometry — never what it stands in for — so the caller sizes it to match the real content. Getting those sizes right is the whole job: a skeleton that does not match causes a layout jump the moment data arrives."
      propNotes={[
            {
              name: 'shape',
              type: "'text' | 'rect' | 'circle'",
              defaultValue: "'text'",
              description: 'Radius and default height.',
            },
            {
              name: 'width / height',
              type: 'number | string',
              description: 'Any CSS length. Match the real content to avoid a layout jump.',
            },
            {
              name: 'lines',
              type: 'number',
              defaultValue: '1',
              description: 'Stacked text lines. The last is shortened. text shape only.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <div className="w-[280px]">
            <Skeleton />
          </div>
        </Preview>
      </Section>

      <Section
        title="Shapes"
        description="Three, matching the three things that load: a line of text, a block, and an avatar or glyph."
      >
        <Preview>
          <Specimen label="text" hint="Line height, small radius">
            <Skeleton width={160} />
          </Specimen>
          <Specimen label="rect" hint="Glyph radius">
            <Skeleton shape="rect" width={72} height={48} />
          </Specimen>
          <Specimen label="circle" hint="Avatars">
            <Skeleton shape="circle" width={40} height={40} />
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Multiple lines"
        description="lines stacks text placeholders. The last one is shortened, because real paragraphs rarely fill their final line."
      >
        <Preview stack>
          {[1, 2, 3].map((count) => (
            <Specimen key={count} label={`lines={${count}}`} fill>
              <div className="w-full max-w-[300px]">
                <Skeleton lines={count} />
              </div>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="A skeleton is only ever loading. What matters is the container: it should carry aria-busy, and the skeleton itself stays hidden from assistive tech."
      >
        <Preview stack>
          <Specimen label="hidden from assistive tech" hint="aria-hidden is always set" fill>
            <div className="w-full max-w-[300px]">
              <Skeleton lines={2} />
            </div>
          </Specimen>
        </Preview>
        <Note>
          Announce loading once, on the region — <Code>aria-busy=&quot;true&quot;</Code> on the card
          — not once per placeholder. Otherwise a list of ten skeleton rows announces ten times.
        </Note>
      </Section>

      <Section
        title="Examples"
        description="A transaction list in both states. Toggle it: the row geometry should not shift."
      >
        <Preview stack>
          <Surface
            variant="card"
            padding="lg"
            aria-busy={loading}
            className="w-full max-w-[380px] gap-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <Text size="heading">Recent transactions</Text>
              {loading ? (
                <Skeleton width={48} className="h-2.5" />
              ) : (
                <Text size="label" tone="faint">
                  View All
                </Text>
              )}
            </div>
            {loading
              ? [0, 1, 2].map((index) => <TransactionRowSkeleton key={index} />)
              : [0, 1, 2].map((index) => <TransactionRow key={index} />)}
          </Surface>
          <button
            type="button"
            onClick={() => setLoading((previous) => !previous)}
            className="h-8 rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-muted"
          >
            {loading ? 'Show loaded state' : 'Show loading state'}
          </button>
        </Preview>
        <Preview background="app">
          <Surface variant="tile" padding="sm" className="w-[160px] bg-surface">
            <IconTile icon={Music} />
            <Skeleton width="70%" className="mt-2.5" />
            <Skeleton width="45%" className="mt-1.5 h-2.5" />
          </Surface>
          <Text size="caption" tone="faint" leading="normal" className="max-w-[240px]">
            Real elements and placeholders can be mixed — here the glyph is already known, so only
            the text is a skeleton.
          </Text>
        </Preview>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <div className="w-full max-w-[280px]">
              <Skeleton
                shape={shape}
                lines={shape === 'text' ? lines : 1}
                width={shape === 'circle' ? 48 : undefined}
                height={shape === 'circle' ? 48 : shape === 'rect' ? 64 : undefined}
              />
            </div>
          }
          controls={
            <>
              <SelectControl label="shape" value={shape} options={SHAPES} onChange={setShape} />
              <NumberControl label="lines" value={lines} min={1} max={6} onChange={setLines} />
              <ToggleControl label="example loading" checked={loading} onChange={setLoading} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
