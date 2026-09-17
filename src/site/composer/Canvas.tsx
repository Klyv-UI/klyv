import {
  Suspense,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Text, cn } from 'klyv'
import { findBlock } from '../data/blocks'
import { blockComponent } from '../lib/blocks'
import { createNode, definitions, nodeLabel } from './definitions'
import { isContainer, newNodeId, type ComposerAction, type ComposerNode, type Target } from './model'
import type { ComposableName } from './registry'

/**
 * The canvas: the composition rendered with the real components, each wrapped
 * in a frame that selects, drags and accepts drops.
 *
 * In edit mode a leaf component is inert — its inputs cannot be typed into and
 * its buttons do nothing — because a click on the canvas means "select this",
 * not "press this". Preview mode renders the same tree with no frames at all,
 * so the components work exactly as they will in the exported file.
 */

/* ------------------------------------------------------------------- drags */

export type DragPayload =
  | { kind: 'new'; type: ComposableName }
  | { kind: 'block'; slug: string }
  | { kind: 'move'; id: string }

/**
 * What is being dragged. Kept here rather than read from dataTransfer, which
 * browsers hide until the drop — and the drop position depends on it before
 * then. One module-level value is enough: there is one pointer.
 */
let dragging: DragPayload | null = null

export function startDrag(event: DragEvent, payload: DragPayload) {
  dragging = payload
  event.dataTransfer.effectAllowed = payload.kind === 'move' ? 'move' : 'copy'
  event.dataTransfer.setData('text/plain', payload.kind === 'move' ? payload.id : payload.kind === 'new' ? payload.type : payload.slug)
}

export function endDrag() {
  dragging = null
}

export function nodeFromPayload(payload: DragPayload): ComposerNode | null {
  if (payload.kind === 'new') return createNode(payload.type)
  if (payload.kind === 'block') return { id: newNodeId(), kind: 'block', slug: payload.slug }
  return null
}

type Marker = { id: string; position: 'before' | 'after' | 'inside' } | { id: 'root'; position: 'end' }

interface CanvasContextValue {
  selectedId: string | null
  editing: boolean
  dispatch: (action: ComposerAction) => void
  marker: Marker | null
  setMarker: (marker: Marker | null) => void
  drop: (target: Target) => void
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

function useCanvas(): CanvasContextValue {
  const value = useContext(CanvasContext)
  if (!value) throw new Error('Canvas parts must render inside Canvas')
  return value
}

/** `inert` is not in React 18's types yet, but the DOM has understood it for years. */
const inert = { inert: '' } as object

/* ------------------------------------------------------------------ canvas */

export function Canvas({
  nodes,
  selectedId,
  editing,
  dispatch,
}: {
  nodes: ComposerNode[]
  selectedId: string | null
  editing: boolean
  dispatch: (action: ComposerAction) => void
}) {
  const [marker, setMarker] = useState<Marker | null>(null)

  const value = useMemo<CanvasContextValue>(
    () => ({
      selectedId,
      editing,
      dispatch,
      marker,
      setMarker,
      drop: (target) => {
        const payload = dragging
        dragging = null
        setMarker(null)
        if (!payload) return
        if (payload.kind === 'move') dispatch({ type: 'move', id: payload.id, target })
        else {
          const node = nodeFromPayload(payload)
          if (node) dispatch({ type: 'insert', node, target })
        }
      },
    }),
    [selectedId, editing, dispatch, marker],
  )

  const onRootDragOver = (event: DragEvent) => {
    if (!editing || !dragging) return
    event.preventDefault()
    if (marker?.id !== 'root') setMarker({ id: 'root', position: 'end' })
  }

  return (
    <CanvasContext.Provider value={value}>
      <div
        className="flex min-h-[100dvh] flex-col gap-6 p-5 sm:p-8"
        onClick={() => editing && dispatch({ type: 'select', id: null })}
        onDragOver={onRootDragOver}
        onDragLeave={(event) => {
          if (!event.relatedTarget) setMarker(null)
        }}
        onDrop={(event) => {
          if (!editing || !dragging) return
          event.preventDefault()
          value.drop({ parentId: null, index: nodes.length })
        }}
      >
        {nodes.length === 0 ? (
          editing ? (
            <div className="grid min-h-[240px] place-items-center rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center">
              <div className="flex max-w-[34ch] flex-col gap-1.5">
                <Text size="heading">An empty canvas</Text>
                <Text size="caption" tone="faint" leading="normal">
                  Drag a component or a block here, or pick one from the list — it lands inside whatever is selected.
                </Text>
              </div>
            </div>
          ) : null
        ) : (
          nodes.map((node, index) => <NodeView key={node.id} node={node} parentId={null} index={index} axis="y" />)
        )}
        {editing && marker?.id === 'root' && nodes.length > 0 && (
          <span aria-hidden className="h-[3px] rounded-full bg-accent-strong" />
        )}
      </div>
    </CanvasContext.Provider>
  )
}

/* ------------------------------------------------------------------- nodes */

const NodeView = memo(function NodeView({
  node,
  parentId,
  index,
  axis,
}: {
  node: ComposerNode
  parentId: string | null
  index: number
  /** How siblings are laid out, so a drop lands before or after along the right axis. */
  axis: 'x' | 'y'
}) {
  const { selectedId, editing, dispatch, marker, setMarker, drop } = useCanvas()
  const frameRef = useRef<HTMLDivElement>(null)
  const selected = selectedId === node.id
  const container = isContainer(node)

  useEffect(() => {
    if (selected) frameRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  let children: ReactNode = null
  if (container) {
    const childAxis = node.type === 'Row' ? 'x' : 'y'
    children =
      node.children.length > 0
        ? node.children.map((child, childIndex) => (
            <NodeView key={child.id} node={child} parentId={node.id} index={childIndex} axis={childAxis} />
          ))
        : editing
          ? <EmptySlot parentId={node.id} />
          : null
  }

  const content = node.kind === 'block' ? <BlockView slug={node.slug} /> : definitions[node.type].render(node.props, children)
  if (!editing) return <>{content}</>

  const label = nodeLabel(node)
  const mine = marker && marker.id === node.id ? marker.position : null

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!dragging || (dragging.kind === 'move' && dragging.id === node.id)) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = axis === 'x' ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height
    const position = container && ratio > 0.25 && ratio < 0.75 ? 'inside' : ratio < 0.5 ? 'before' : 'after'
    if (mine !== position) setMarker({ id: node.id, position })
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.preventDefault()
    event.stopPropagation()
    const position = mine ?? 'after'
    drop(
      position === 'inside' && node.kind === 'component'
        ? { parentId: node.id, index: node.children.length }
        : { parentId, index: position === 'before' ? index : index + 1 },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      dispatch({ type: 'select', id: node.id })
    }
  }

  return (
    <div
      ref={frameRef}
      role="group"
      aria-roledescription="canvas item"
      aria-label={selected ? `${label}, selected` : label}
      tabIndex={0}
      draggable
      data-node-id={node.id}
      onClick={(event) => {
        event.stopPropagation()
        dispatch({ type: 'select', id: node.id })
      }}
      onKeyDown={onKeyDown}
      onDragStart={(event) => {
        event.stopPropagation()
        startDrag(event, { kind: 'move', id: node.id })
      }}
      onDragEnd={() => {
        endDrag()
        setMarker(null)
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'relative min-w-0 cursor-default rounded-[8px] outline outline-1 outline-offset-4 transition-[outline-color]',
        'focus-visible:outline-2 focus-visible:outline-accent',
        selected ? 'outline-2 outline-accent-strong' : 'outline-transparent hover:outline-line-strong',
        mine === 'inside' && 'outline-2 outline-dashed outline-accent-strong',
      )}
    >
      {selected && (
        <span className="pointer-events-none absolute -top-[26px] left-0 z-20 max-w-full truncate rounded-[6px] bg-accent-strong px-1.5 py-0.5 text-[10.5px] font-bold text-accent-ink">
          {label}
        </span>
      )}
      {(mine === 'before' || mine === 'after') && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute z-20 rounded-full bg-accent-strong',
            axis === 'y' && 'inset-x-0 h-[3px]',
            axis === 'x' && 'inset-y-0 w-[3px]',
            axis === 'y' && (mine === 'before' ? '-top-[7px]' : '-bottom-[7px]'),
            axis === 'x' && (mine === 'before' ? '-left-[7px]' : '-right-[7px]'),
          )}
        />
      )}
      {container ? content : <div {...inert} className="pointer-events-none">{content}</div>}
    </div>
  )
})

function EmptySlot({ parentId }: { parentId: string }) {
  const { marker, setMarker, drop } = useCanvas()
  const active = marker?.id === parentId && marker.position === 'inside'
  return (
    <div
      onDragOver={(event) => {
        if (!dragging) return
        event.preventDefault()
        event.stopPropagation()
        if (!active) setMarker({ id: parentId, position: 'inside' })
      }}
      onDrop={(event) => {
        if (!dragging) return
        event.preventDefault()
        event.stopPropagation()
        drop({ parentId, index: 0 })
      }}
      className={cn(
        'grid min-h-[56px] min-w-[120px] place-items-center rounded-[8px] border border-dashed px-3 text-center text-[11px] font-semibold transition-colors',
        active ? 'border-accent-strong bg-accent-soft text-ink' : 'border-line-strong text-ink-faint',
      )}
    >
      Empty — drop here, or select it and add
    </div>
  )
}

function BlockView({ slug }: { slug: string }) {
  const block = findBlock(slug)
  const Block = block ? blockComponent(block.file) : undefined
  if (!Block) return null
  return (
    <Suspense fallback={<div className="min-h-[320px] rounded-[var(--radius-card)] bg-surface-sunken" aria-busy="true" />}>
      <Block embedded />
    </Suspense>
  )
}
