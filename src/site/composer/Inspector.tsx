import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, CopyPlus, MousePointerClick, Trash2 } from 'lucide-react'
import { EmptyState, IconButton, Kbd, Text } from 'citrine'
import { NumberControl, SelectControl, TextControl, ToggleControl } from '../components/Playground'
import { findBlock } from '../data/blocks'
import { findComponentByName } from '../data/catalog'
import { definitions, nodeLabel, type PropSpec } from './definitions'
import { locate, type ComponentNode, type ComposerAction, type ComposerNode } from './model'
import { LAYOUT_ONLY } from './registry'

/**
 * The right panel: the selected node's props, and what can be done to it.
 *
 * The controls are the Playground's own, so a prop edited here looks and
 * behaves like one edited on the Playground page.
 */
export function Inspector({
  nodes,
  selectedId,
  dispatch,
  isMac,
}: {
  nodes: ComposerNode[]
  selectedId: string | null
  dispatch: (action: ComposerAction) => void
  isMac: boolean
}) {
  const found = selectedId ? locate(nodes, selectedId) : null

  if (!found) {
    const mod = isMac ? '⌘' : 'Ctrl'
    return (
      <div className="flex flex-col gap-5">
        <EmptyState
          size="sm"
          icon={MousePointerClick}
          title="Nothing selected"
          description="Select something on the canvas, or in Layers, to edit its props."
        />
        <div className="flex flex-col gap-2">
          <Text as="h3" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
            Shortcuts
          </Text>
          <dl className="flex flex-col gap-1.5">
            {[
              [[mod, 'Z'], 'Undo'],
              [[mod, '⇧', 'Z'], 'Redo'],
              [['Delete'], 'Remove the selection'],
              [[mod, 'D'], 'Duplicate'],
              [['Alt', '↑'], 'Move up'],
              [['Alt', '↓'], 'Move down'],
              [['Esc'], 'Clear the selection'],
            ].map(([keys, label]) => (
              <div key={label as string} className="flex items-center justify-between gap-3">
                <dt>
                  <Text as="span" size="caption" tone="soft">
                    {label as string}
                  </Text>
                </dt>
                <dd className="flex gap-0.5">
                  {(keys as string[]).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    )
  }

  const { node, parentId, index } = found
  const siblings = parentId === null ? nodes : ((locate(nodes, parentId)?.node as ComponentNode | undefined)?.children ?? [])

  const actions = (
    <div className="flex items-center gap-0.5">
      {parentId && (
        <IconButton icon={ChevronLeft} label="Select the parent" size="sm" tone="bare" onClick={() => dispatch({ type: 'select', id: parentId })} />
      )}
      <IconButton icon={ArrowUp} label="Move up" size="sm" tone="bare" disabled={index === 0} onClick={() => dispatch({ type: 'nudge', id: node.id, delta: -1 })} />
      <IconButton
        icon={ArrowDown}
        label="Move down"
        size="sm"
        tone="bare"
        disabled={index >= siblings.length - 1}
        onClick={() => dispatch({ type: 'nudge', id: node.id, delta: 1 })}
      />
      <IconButton icon={CopyPlus} label="Duplicate" size="sm" tone="bare" onClick={() => dispatch({ type: 'duplicate', id: node.id })} />
      <IconButton icon={Trash2} label="Remove" size="sm" tone="bare" onClick={() => dispatch({ type: 'remove', id: node.id })} className="hover:text-danger" />
    </div>
  )

  if (node.kind === 'block') {
    const block = findBlock(node.slug)
    return (
      <div className="flex flex-col gap-4">
        <Header title={nodeLabel(node)} actions={actions} />
        {block && (
          <>
            <Text size="caption" tone="soft" leading="normal">
              {block.blurb}
            </Text>
            <Text size="caption" tone="faint" leading="normal">
              A block is a finished screen, so it is placed whole. Take it with the CLI to change what is inside.
            </Text>
            <Link to={`/blocks/${block.slug}`} className="w-fit rounded-md text-[12px] font-bold text-ink underline underline-offset-2">
              Open the {block.name} block page
            </Link>
          </>
        )}
      </div>
    )
  }

  const definition = definitions[node.type]
  const entry = LAYOUT_ONLY.has(node.type) ? undefined : findComponentByName(node.type)

  return (
    <div className="flex flex-col gap-4">
      <Header title={node.type} actions={actions} />
      {definition.description && (
        <Text size="caption" tone="faint" leading="normal">
          {definition.description}
        </Text>
      )}
      <div className="flex flex-col gap-4">
        {definition.props.map((spec) => (
          <Control
            key={`${node.id}:${spec.name}`}
            spec={spec}
            value={node.props[spec.name] ?? spec.default ?? ''}
            onChange={(value) => dispatch({ type: 'setProp', id: node.id, name: spec.name, value })}
          />
        ))}
      </div>
      {entry && (
        <Link to={`/components/${entry.slug}`} className="w-fit rounded-md text-[12px] font-bold text-ink underline underline-offset-2">
          Every prop of {node.type}
        </Link>
      )}
    </div>
  )
}

function Header({ title, actions }: { title: string; actions: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
      <Text as="h2" size="heading" className="min-w-0 break-words pt-1">
        {title}
      </Text>
      {actions}
    </div>
  )
}

function Control({
  spec,
  value,
  onChange,
}: {
  spec: PropSpec
  value: string | number | boolean
  onChange: (value: string | number | boolean) => void
}) {
  switch (spec.kind) {
    case 'select':
      return <SelectControl label={spec.label} value={String(value)} options={spec.options} onChange={onChange} />
    case 'boolean':
      return <ToggleControl label={spec.label} checked={value === true} onChange={onChange} />
    case 'number':
      return <NumberControl label={spec.label} value={Number(value)} min={spec.min} max={spec.max} onChange={onChange} />
    case 'text':
      return <TextControl label={spec.label} value={String(value)} onChange={onChange} />
  }
}
