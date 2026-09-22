import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { SearchField, Tabs, Text, cn } from 'klyvui'
import { SelectControl } from '../components/Playground'
import { BLOCK_CATEGORIES, blocksInCategory } from '../data/blocks'
import { findComponentByName } from '../data/catalog'
import { GROUP_IDS } from '../data/groups'
import { endDrag, startDrag } from './Canvas'
import { definitions, nodeLabel } from './definitions'
import { flatten, type ComposerNode } from './model'
import { COMPOSABLE, LAYOUT_ONLY, type ComposableName } from './registry'

/**
 * The left panel: what can be added, and the outline of what has been.
 *
 * Components are filed by the same groups the catalogue uses, so "where is
 * Metric" has the same answer here as in the sidebar. Every row can be dragged
 * onto the canvas or clicked — clicking is the keyboard and touch path, and
 * adds to whatever is selected.
 */
const ENTRIES = COMPOSABLE.map((name) => {
  const entry = findComponentByName(name)
  return {
    name,
    group: LAYOUT_ONLY.has(name) ? 'Layout' : (entry?.group ?? 'Layout'),
    blurb: definitions[name].description ?? entry?.blurb ?? '',
  }
})

const GROUPS = GROUP_IDS.filter((group) => ENTRIES.some((entry) => entry.group === group))

type Tab = 'components' | 'blocks' | 'layers'

export function Palette({
  nodes,
  selectedId,
  onAddComponent,
  onAddBlock,
  onSelect,
}: {
  nodes: ComposerNode[]
  selectedId: string | null
  onAddComponent: (type: ComposableName) => void
  onAddBlock: (slug: string) => void
  onSelect: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>('components')

  return (
    <Tabs<Tab>
      label="Add to the canvas"
      value={tab}
      onValueChange={setTab}
      variant="underline"
      fullWidth
      items={[
        { value: 'components', label: 'Components', content: <ComponentList onAdd={onAddComponent} /> },
        { value: 'blocks', label: 'Blocks', content: <BlockList onAdd={onAddBlock} /> },
        {
          value: 'layers',
          label: 'Layers',
          badge: flatten(nodes).length || undefined,
          content: <Layers nodes={nodes} selectedId={selectedId} onSelect={onSelect} />,
        },
      ]}
    />
  )
}

const rowClass =
  'group flex w-full cursor-grab items-start gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing'

function ComponentList({ onAdd }: { onAdd: (type: ComposableName) => void }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All groups')

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ENTRIES.filter(
      (entry) =>
        (group === 'All groups' || entry.group === group) &&
        (!needle || `${entry.name} ${entry.group} ${entry.blurb}`.toLowerCase().includes(needle)),
    )
  }, [query, group])

  return (
    <div className="flex flex-col gap-3 pt-3">
      <SearchField value={query} onValueChange={setQuery} inputSize="sm" label="Search components" placeholder="Search components" />
      <SelectControl label="Group" value={group} options={['All groups', ...GROUPS]} onChange={setGroup} />
      {shown.length === 0 && (
        <Text size="caption" tone="faint" className="px-1">
          Nothing matches “{query}”. The Composer places {COMPOSABLE.length} components; the rest are on their pages.
        </Text>
      )}
      {GROUPS.map((name) => {
        const inGroup = shown.filter((entry) => entry.group === name)
        if (inGroup.length === 0) return null
        return (
          <section key={name} aria-label={name} className="flex flex-col">
            <Text as="h3" size="micro" weight="bold" tone="faint" className="px-2.5 pb-1 uppercase tracking-[0.14em]">
              {name}
            </Text>
            <ul className="flex flex-col">
              {inGroup.map((entry) => (
                <li key={entry.name}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => startDrag(event, { kind: 'new', type: entry.name })}
                    onDragEnd={endDrag}
                    onClick={() => onAdd(entry.name)}
                    className={rowClass}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Text as="span" size="caption" weight="bold">
                        <span className="sr-only">Add </span>
                        {entry.name}
                      </Text>
                      <Text as="span" size="micro" tone="faint" truncate>
                        {entry.blurb}
                      </Text>
                    </span>
                    <Plus size={14} aria-hidden className="mt-0.5 shrink-0 text-ink-faint group-hover:text-ink" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function BlockList({ onAdd }: { onAdd: (slug: string) => void }) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <Text size="caption" tone="faint" leading="normal" className="px-1">
        Blocks are placed whole — they are finished screens. Take one with the CLI to change its insides.
      </Text>
      {BLOCK_CATEGORIES.map((category) => (
        <section key={category} aria-label={category} className="flex flex-col">
          <Text as="h3" size="micro" weight="bold" tone="faint" className="px-2.5 pb-1 uppercase tracking-[0.14em]">
            {category}
          </Text>
          <ul className="flex flex-col">
            {blocksInCategory(category).map((block) => (
              <li key={block.slug}>
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => startDrag(event, { kind: 'block', slug: block.slug })}
                  onDragEnd={endDrag}
                  onClick={() => onAdd(block.slug)}
                  className={rowClass}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text as="span" size="caption" weight="bold">
                      <span className="sr-only">Add the </span>
                      {block.name}
                      <span className="sr-only"> block</span>
                    </Text>
                    <Text as="span" size="micro" tone="faint" truncate>
                      {block.blurb}
                    </Text>
                  </span>
                  <Plus size={14} aria-hidden className="mt-0.5 shrink-0 text-ink-faint group-hover:text-ink" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Layers({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: ComposerNode[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const rows = flatten(nodes)
  if (rows.length === 0) {
    return (
      <Text size="caption" tone="faint" className="px-1 pt-3">
        Nothing on the canvas yet.
      </Text>
    )
  }
  return (
    <ul aria-label="Layers" className="flex flex-col pt-3">
      {rows.map(({ node, depth }) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-current={node.id === selectedId ? 'true' : undefined}
            style={{ paddingLeft: 10 + depth * 14 }}
            className={cn(
              'flex w-full items-center rounded-[10px] py-1.5 pr-2.5 text-left text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              node.id === selectedId ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            )}
          >
            <span className="truncate">{nodeLabel(node)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
