import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CodeXml, Eye, Monitor, Redo2, RotateCcw, Save, Smartphone, Tablet, Undo2 } from 'lucide-react'
import { Button, ConfirmDialog, IconButton, SaveIndicator, SegmentedControl, Surface, Text, cn } from 'klyv'
import { blocks, findBlock } from '../data/blocks'
import { findTemplate } from '../data/templates'
import { createStore, useStore } from '../lib/store'
import { Canvas } from '../composer/Canvas'
import { CodeView } from '../composer/CodeView'
import { createNode } from '../composer/definitions'
import { Frame } from '../composer/Frame'
import { Inspector } from '../composer/Inspector'
import { Palette } from '../composer/Palette'
import {
  composerReducer,
  initialState,
  newNodeId,
  parseDoc,
  type ComposerAction,
  type ComposerDoc,
  type ComposerNode,
} from '../composer/model'
import { COMPOSABLE, type ComposableName } from '../composer/registry'

/**
 * The Composer: build a screen from the real components and blocks, then take
 * the code.
 *
 * Everything on the canvas is the library itself, rendered in an iframe so
 * the device widths answer media queries honestly. The draft is saved to this
 * browser when you press Save, through the same persistence seam as the rest
 * of the site, so moving drafts to an account later is a new adapter.
 */
const KNOWN_TYPES: ReadonlySet<string> = new Set(COMPOSABLE)
const KNOWN_BLOCKS: ReadonlySet<string> = new Set(blocks.map((block) => block.slug))

interface Draft {
  doc: ComposerDoc
  savedAt: number
}

const draftStore = createStore<Draft | null>('composer-draft', null, {
  parse: (raw) => {
    if (!raw || typeof raw !== 'object') return undefined
    const doc = parseDoc((raw as Draft).doc, KNOWN_TYPES, KNOWN_BLOCKS)
    return doc ? { doc, savedAt: Number((raw as Draft).savedAt) || Date.now() } : undefined
  },
})

/** Where a new composition starts: the sign-in card from the brief, built from real parts. */
function starterDoc(): ComposerDoc {
  const card = createNode('Card')
  card.props.title = 'Welcome back'
  const column = createNode('Column')
  column.props.gap = '16'
  const email = createNode('Field')
  const password = createNode('Field')
  password.props.label = 'Password'
  password.children = [createNode('PasswordInput')]
  const button = createNode('Button')
  button.props.children = 'Continue'
  button.props.fullWidth = true
  column.children = [email, password, button]
  card.children = [column]
  return { version: 1, nodes: [card] }
}

type Viewport = 'desktop' | 'tablet' | 'mobile'
const WIDTHS: Record<Viewport, string> = { desktop: '100%', tablet: '768px', mobile: '390px' }

type Mode = 'edit' | 'preview' | 'code'
/** Below lg, one panel at a time. */
type Panel = 'add' | 'canvas' | 'inspect'

export default function ComposerPage() {
  const [initialDoc] = useState(() => draftStore.get()?.doc ?? starterDoc())
  const [state, dispatch] = useReducer(composerReducer, initialDoc, initialState)
  const [baseline, setBaseline] = useState(initialDoc)
  const draft = useStore(draftStore)

  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [mode, setMode] = useState<Mode>('edit')
  const [panel, setPanel] = useState<Panel>('canvas')
  const [confirmReset, setConfirmReset] = useState(false)
  const [frameWindow, setFrameWindow] = useState<Window | null>(null)
  const [isMac, setIsMac] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  const dirty = state.doc !== baseline
  const editing = mode === 'edit'

  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(window.navigator.platform || window.navigator.userAgent))
  }, [])

  /* --------------------------------------------- arriving from another page */

  const [params, setParams] = useSearchParams()
  const handledParams = useRef(false)
  useEffect(() => {
    if (handledParams.current) return
    const add = params.get('add')
    const block = params.get('block')
    const template = params.get('template')
    if (!add && !block && !template) return
    handledParams.current = true

    const incoming: ComposerNode[] = []
    if (add && KNOWN_TYPES.has(add)) incoming.push(createNode(add as ComposableName))
    if (block && findBlock(block)) incoming.push({ id: newNodeId(), kind: 'block', slug: block })
    for (const slug of findTemplate(template ?? undefined)?.blocks ?? []) {
      incoming.push({ id: newNodeId(), kind: 'block', slug })
    }
    for (const node of incoming) {
      dispatch({ type: 'insert', node, target: { parentId: null, index: Number.MAX_SAFE_INTEGER } })
    }
    setParams({}, { replace: true })
  }, [params, setParams])

  /* ------------------------------------------------------------- actions */

  const addNode = useCallback((node: ComposerNode) => {
    dispatch({ type: 'insert', node })
    // On a phone the canvas is another panel; show what was just added.
    setPanel('canvas')
  }, [])

  const save = () => {
    draftStore.set({ doc: state.doc, savedAt: Date.now() })
    setBaseline(state.doc)
  }

  /* ----------------------------------------------------------- shortcuts */

  const stateRef = useRef(state)
  stateRef.current = state
  const editingRef = useRef(editing)
  editingRef.current = editing

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Only while working in the Composer: inside its panels, or inside the canvas frame.
      const inside = target?.ownerDocument !== document || Boolean(rootRef.current?.contains(target))
      if (!inside) return
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'))
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const selected = stateRef.current.selectedId

      const run = (action: ComposerAction) => {
        event.preventDefault()
        dispatch(action)
      }

      if (mod && key === 'z' && !typing) return run({ type: event.shiftKey ? 'redo' : 'undo' })
      if (mod && key === 'y' && !typing) return run({ type: 'redo' })
      if (typing || !editingRef.current || !selected) return
      if (key === 'delete' || key === 'backspace') return run({ type: 'remove', id: selected })
      if (mod && key === 'd') return run({ type: 'duplicate', id: selected })
      if (event.altKey && key === 'arrowup') return run({ type: 'nudge', id: selected, delta: -1 })
      if (event.altKey && key === 'arrowdown') return run({ type: 'nudge', id: selected, delta: 1 })
      if (key === 'escape') return run({ type: 'select', id: null })
    }

    window.addEventListener('keydown', onKeyDown)
    frameWindow?.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      frameWindow?.removeEventListener('keydown', onKeyDown)
    }
  }, [frameWindow])

  /* ------------------------------------------------------------------ view */

  const panelClass = (which: Panel) => cn(which === panel ? 'flex' : 'hidden', 'lg:flex')

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {/* ------------------------------------------------------------ toolbar */}
      <Surface variant="card" padding="sm" className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-col pl-1 leading-none">
          <Text as="span" size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.16em]">
            Build
          </Text>
          <Text as="h1" size="heading">
            Composer
          </Text>
        </div>

        <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />

        <div role="group" aria-label="History" className="flex items-center gap-0.5">
          <IconButton
            icon={Undo2}
            label="Undo"
            size="sm"
            tone="muted"
            disabled={state.past.length === 0}
            aria-keyshortcuts={isMac ? 'Meta+Z' : 'Control+Z'}
            onClick={() => dispatch({ type: 'undo' })}
          />
          <IconButton
            icon={Redo2}
            label="Redo"
            size="sm"
            tone="muted"
            disabled={state.future.length === 0}
            aria-keyshortcuts={isMac ? 'Meta+Shift+Z' : 'Control+Shift+Z'}
            onClick={() => dispatch({ type: 'redo' })}
          />
        </div>

        <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />

        <SegmentedControl<Viewport>
          label="Preview width"
          size="sm"
          value={viewport}
          onValueChange={setViewport}
          options={[
            { value: 'desktop', label: 'Desktop', icon: Monitor, iconOnly: true },
            { value: 'tablet', label: 'Tablet, 768 pixels', icon: Tablet, iconOnly: true },
            { value: 'mobile', label: 'Mobile, 390 pixels', icon: Smartphone, iconOnly: true },
          ]}
        />

        <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />

        <div role="group" aria-label="View" className="flex items-center gap-1">
          <Button size="sm" variant={mode === 'preview' ? 'accent' : 'outline'} aria-pressed={mode === 'preview'} onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}>
            <Eye size={14} aria-hidden />
            Preview
          </Button>
          <Button size="sm" variant={mode === 'code' ? 'accent' : 'outline'} aria-pressed={mode === 'code'} onClick={() => setMode(mode === 'code' ? 'edit' : 'code')}>
            <CodeXml size={14} aria-hidden />
            Code
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator
            compact
            state={dirty ? 'dirty' : draft ? 'saved' : 'idle'}
            lastSavedAt={draft ? new Date(draft.savedAt) : undefined}
          />
          <Button size="sm" variant="outline" onClick={save} disabled={!dirty}>
            <Save size={14} aria-hidden />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} aria-hidden />
            Reset
          </Button>
        </div>
      </Surface>

      {/* ------------------------------------------- panel switcher, below lg */}
      {mode === 'edit' && (
        <div className="lg:hidden">
          <SegmentedControl<Panel>
            label="Panel"
            fullWidth
            value={panel}
            onValueChange={setPanel}
            options={[
              { value: 'add', label: 'Add' },
              { value: 'canvas', label: 'Canvas' },
              { value: 'inspect', label: 'Properties' },
            ]}
          />
        </div>
      )}

      {/* ------------------------------------------------------------ panels */}
      <div
        className={cn(
          'grid min-h-[560px] gap-3 lg:h-[calc(100dvh-172px)]',
          mode === 'edit' ? 'lg:grid-cols-[264px_minmax(0,1fr)_288px]' : 'grid-cols-1',
        )}
      >
        {mode === 'edit' && (
          <Surface
            as="aside"
            aria-label="Components and blocks"
            variant="card"
            padding="sm"
            className={cn(panelClass('add'), 'min-h-0 overflow-y-auto')}
          >
            <Palette
              nodes={state.doc.nodes}
              selectedId={state.selectedId}
              onAddComponent={(type) => addNode(createNode(type))}
              onAddBlock={(slug) => addNode({ id: newNodeId(), kind: 'block', slug })}
              onSelect={(id) => dispatch({ type: 'select', id })}
            />
          </Surface>
        )}

        <section
          aria-label={mode === 'code' ? 'Code' : 'Canvas'}
          className={cn(
            mode === 'edit' ? panelClass('canvas') : 'flex',
            'min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken lg:min-h-0',
          )}
        >
          {mode === 'code' ? (
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
              <CodeView doc={state.doc} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 justify-center overflow-auto p-2 sm:p-4">
              <Frame
                title={editing ? 'Canvas — select, drag and drop components' : 'Preview'}
                onWindow={setFrameWindow}
                className="block h-full min-h-[520px] shrink-0 rounded-[var(--radius-tile)] border border-line bg-app shadow-[var(--shadow-card)] transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: WIDTHS[viewport], maxWidth: '100%' }}
              >
                <Canvas nodes={state.doc.nodes} selectedId={state.selectedId} editing={editing} dispatch={dispatch} />
              </Frame>
            </div>
          )}
        </section>

        {mode === 'edit' && (
          <Surface
            as="aside"
            aria-label="Properties"
            variant="card"
            padding="md"
            className={cn(panelClass('inspect'), 'min-h-0 flex-col overflow-y-auto')}
          >
            <Inspector nodes={state.doc.nodes} selectedId={state.selectedId} dispatch={dispatch} isMac={isMac} />
          </Surface>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          dispatch({ type: 'replace', doc: starterDoc() })
          setConfirmReset(false)
        }}
        title="Start again from the starter card?"
        description="The canvas goes back to the sign-in card. Undo brings your composition back, and your saved draft is kept until you save over it."
        confirmLabel="Reset the canvas"
      />
    </div>
  )
}
