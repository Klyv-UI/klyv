import { useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  Cropper,
  IconButton,
  MarqueeSelect,
  MiniMap,
  PanZoom,
  SegmentedControl,
  SignaturePad,
  Surface,
  Tag,
  Text,
  type CropRect,
  type PanZoomView,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const CONTENT = { width: 1200, height: 760 }

const BOARD = [
  { id: 'a', x: 60, y: 60, w: 260, h: 150, label: 'Income', tone: 'bg-accent-soft' },
  { id: 'b', x: 380, y: 60, w: 300, h: 150, label: 'Everyday account', tone: 'bg-surface-muted' },
  { id: 'c', x: 740, y: 60, w: 260, h: 150, label: 'Savings', tone: 'bg-accent-soft' },
  { id: 'd', x: 60, y: 280, w: 300, h: 190, label: 'Direct debits', tone: 'bg-surface-muted' },
  { id: 'e', x: 420, y: 280, w: 260, h: 190, label: 'Card spending', tone: 'bg-surface-muted' },
  { id: 'f', x: 740, y: 280, w: 300, h: 190, label: 'Investments', tone: 'bg-surface-muted' },
  { id: 'g', x: 200, y: 540, w: 340, h: 150, label: 'Monthly report', tone: 'bg-surface-muted' },
  { id: 'h', x: 600, y: 540, w: 340, h: 150, label: 'Year in review', tone: 'bg-accent-soft' },
]

const TILES = Array.from({ length: 12 }, (_, index) => ({
  id: `t${index}`,
  label: ['Rent', 'Energy', 'Music', 'Gym', 'Groceries', 'Transport'][index % 6],
  amount: [1250, 128, 5, 219, 480, 190][index % 6],
}))

/* ----------------------------------------------------------- specimens */

function PanZoomExample() {
  const [view, setView] = useState<PanZoomView>({ x: 0, y: 0, scale: 1 })
  const frameRef = useRef<HTMLDivElement>(null)

  // The visible window, converted back into content coordinates.
  const frame = frameRef.current?.getBoundingClientRect()
  const viewport = {
    x: -view.x / view.scale,
    y: -view.y / view.scale,
    width: (frame?.width ?? 520) / view.scale,
    height: (frame?.height ?? 320) / view.scale,
  }

  const board = (small: boolean) => (
    <div className="relative h-full w-full">
      {BOARD.map((node) => (
        <div
          key={node.id}
          className={`absolute rounded-[10px] border border-line ${node.tone}`}
          style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
        >
          {!small && (
            <Text size="body" className="p-3">
              {node.label}
            </Text>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={frameRef} className="relative">
        <PanZoom
          label="Money map"
          contentWidth={CONTENT.width}
          contentHeight={CONTENT.height}
          view={view}
          onViewChange={setView}
          className="h-[320px] w-full"
        >
          {board(false)}
        </PanZoom>

        <div className="absolute bottom-3 right-3 flex items-end gap-2">
          <MiniMap
            label="Board overview"
            contentWidth={CONTENT.width}
            contentHeight={CONTENT.height}
            viewport={viewport}
            width={148}
            onNavigate={(point) => {
              const box = frameRef.current?.getBoundingClientRect()
              setView((current) => ({
                ...current,
                x: (box?.width ?? 520) / 2 - point.x * current.scale,
                y: (box?.height ?? 320) / 2 - point.y * current.scale,
              }))
            }}
            className="shadow-[var(--shadow-float)]"
          >
            {board(true)}
          </MiniMap>

          <Surface variant="floating" className="flex-row gap-1 border border-line p-1">
            <IconButton
              icon={Minus}
              label="Zoom out"
              size="sm"
              onClick={() => setView((v) => ({ ...v, scale: Math.max(0.25, v.scale / 1.25) }))}
            />
            <IconButton
              icon={Plus}
              label="Zoom in"
              size="sm"
              onClick={() => setView((v) => ({ ...v, scale: Math.min(4, v.scale * 1.25) }))}
            />
            <IconButton
              icon={Maximize2}
              label="Fit"
              size="sm"
              onClick={() => setView({ x: 26, y: 12, scale: 0.4 })}
            />
          </Surface>
        </div>
      </div>

      <Text size="caption" tone="faint" tabular>
        Drag to pan, wheel to zoom at the pointer, {Math.round(view.scale * 100)}%. Focus the canvas
        for arrows, plus, minus and 0.
      </Text>
    </div>
  )
}

function MarqueeExample() {
  const [selected, setSelected] = useState<string[]>([])

  return (
    <div className="flex w-full flex-col gap-2">
      <MarqueeSelect
        label="Spending tiles"
        value={selected}
        onChange={setSelected}
        // Real background to start a drag from: a marquee needs somewhere to
        // press that is not an item.
        className="rounded-[var(--radius-card)] border border-line bg-app p-6 pb-12"
      >
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {TILES.map((tile) => {
            const on = selected.includes(tile.id)
            return (
              <div
                key={tile.id}
                data-select-id={tile.id}
                className={`rounded-[var(--radius-tile)] border p-3 transition-colors ${
                  on ? 'border-accent-strong bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <Text size="caption" truncate>
                  {tile.label}
                </Text>
                <Text size="micro" tone="faint" tabular>
                  ${tile.amount}
                </Text>
              </div>
            )
          })}
        </div>
      </MarqueeSelect>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {selected.length === 0
          ? 'Drag across the tiles. Shift adds, Escape clears, Ctrl or Cmd with A selects all.'
          : `${selected.length} selected.`}
      </Text>
    </div>
  )
}

function CropperExample() {
  const [aspect, setAspect] = useState<'free' | 'square' | 'wide'>('square')
  const [rect, setRect] = useState<CropRect>({ x: 0.15, y: 0.15, width: 0.7, height: 0.7 })

  const ratio = aspect === 'square' ? 1 : aspect === 'wide' ? 16 / 9 : undefined

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <SegmentedControl
        label="Aspect ratio"
        size="sm"
        value={aspect}
        onValueChange={(value) => setAspect(value as typeof aspect)}
        options={[
          { value: 'free', label: 'Free' },
          { value: 'square', label: '1:1' },
          { value: 'wide', label: '16:9' },
        ]}
      />

      <Cropper
        label="Crop the card artwork"
        value={rect}
        onChange={setRect}
        aspect={ratio}
        className="w-full max-w-[460px]"
      >
        <div className="grid h-[260px] w-full place-items-center bg-gradient-to-br from-[#dceec4] via-[#eef5e6] to-[#cfe3ff]">
          <Text size="display" tone="soft">
            Artwork
          </Text>
        </div>
      </Cropper>

      <Text size="caption" tone="faint" tabular>
        x {rect.x.toFixed(2)} · y {rect.y.toFixed(2)} · w {rect.width.toFixed(2)} · h{' '}
        {rect.height.toFixed(2)} — fractions, so a resize keeps the crop.
      </Text>
    </div>
  )
}

function SignatureExample() {
  const [signed, setSigned] = useState(false)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <SignaturePad
        label="Sign the mandate"
        onChange={(dataUrl) => setSigned(dataUrl !== null)}
      />
      <div className="flex items-center gap-2">
        <Tag size="sm" tone={signed ? 'accent' : 'neutral'}>
          {signed ? 'Mandate signed' : 'Awaiting signature'}
        </Tag>
        <Text size="caption" tone="faint">
          onChange hands you a PNG data URL after every stroke.
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'pan-zoom': {
    description:
      'A viewport you pan and zoom, framing content larger than the frame. Zoom is anchored to the pointer, not the centre — the point under the cursor has to stay under the cursor, which is the difference between a canvas that feels like a map and one that fights you.',
    sections: [
      {
        title: 'With a minimap and controls',
        description: 'Drag, wheel, or focus the canvas for arrows, plus, minus and 0.',
        bare: true,
        Content: PanZoomExample,
        note: motionNote('unchanged — every movement here is the reader driving directly.'),
      },
      rationale(
        'Anything bigger than its frame — a board, a diagram, a floor plan — needs panning and zooming, and every screen that needs it rebuilds the same pointer-anchored zoom slightly wrong.',
        'Doing it once as a single affine step means content coordinates convert to screen coordinates by one multiply and one add, which is what makes a minimap or a hit test on top possible at all.',
        'A canvas, a diagram viewer, a large schedule, an image inspector.',
        ['Surface tokens', 'pointer capture', 'native wheel listener'],
      ),
    ],
    props: [
      { name: 'contentWidth / contentHeight', type: 'number', description: 'Size of what is being framed, in its own coordinates.' },
      { name: 'view / onViewChange', type: 'PanZoomView / fn', description: '{ x, y, scale }. Omit for uncontrolled; supply it to drive a minimap.' },
      { name: 'min / max', type: 'number / number', defaultValue: '0.25 / 4', description: 'Zoom bounds.' },
      { name: 'wheelZoom', type: 'boolean', defaultValue: 'true', description: 'Off inside a scrolling page where it would fight the scroll.' },
      { name: 'fitOnMount', type: 'boolean', defaultValue: 'true', description: 'Fit once, on mount only.' },
    ],
  },

  'mini-map': {
    description:
      'A scaled-down survey of a large surface, with the on-screen part outlined and draggable. It takes the viewport as a rectangle in content coordinates and reports back a point to centre, so it knows nothing about transforms, scroll offsets or zoom.',
    sections: [
      {
        title: 'Example',
        description: 'Shown on the PanZoom page, bottom right — press or drag anywhere on it.',
        bare: true,
        Content: () => (
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[64ch]">
            The minimap in the PanZoom example above is this component. It is separate because the
            thing being surveyed does not have to be a canvas: a long document, a wide timeline or a
            spreadsheet can all say where they are looking and be told where to look instead.
          </Text>
        ),
      },
      rationale(
        'On a surface several screens wide, the reader loses track of where they are, and scrollbars answer that badly in one dimension and not at all in two.',
        'A survey with the viewport drawn on it answers where am I and where else is there in one object — and dragging moves the outline to the pointer, not by a delta, so it stays aligned at any zoom.',
        'Beside a canvas, a large diagram, a long document, a wide gantt or timeline.',
        ['pointer capture', 'surface and accent tokens'],
      ),
    ],
    props: [
      { name: 'contentWidth / contentHeight', type: 'number', description: 'Size of the whole surface.' },
      { name: 'viewport', type: '{ x, y, width, height }', description: 'The part on screen, in content coordinates.' },
      { name: 'onNavigate', type: '({ x, y }) => void', description: 'The content point the reader wants centred.' },
      { name: 'width', type: 'number', defaultValue: '168', description: 'Map width. Height follows the aspect ratio.' },
      { name: 'children', type: 'ReactNode', description: 'A cheap likeness — blocks, not the real content.' },
    ],
  },

  'marquee-select': {
    description:
      'Drag a rectangle across a region to select everything it touches. Items are found by attribute rather than passed in, so a grid, a canvas of absolutely positioned nodes and a list of cards all become selectable by adding one attribute to each item.',
    sections: [
      {
        title: 'Example',
        description: 'Drag on the background. Shift adds, Escape clears, Ctrl or Cmd with A selects all.',
        bare: true,
        Content: MarqueeExample,
        note: motionNote('unchanged — the rectangle follows the pointer and nothing is animated.'),
      },
      rationale(
        'Selecting a dozen items one click at a time is the kind of tedium that makes people give up on a bulk action entirely.',
        'Measuring once at the start of the drag keeps it to one layout read per gesture rather than one per frame — and the keyboard gets select-all and clear, so the region is usable without drawing anything.',
        'A file grid, a canvas of nodes, a photo picker, a bulk-edit table.',
        ['VisuallyHidden', 'pointer capture', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'string[] / fn', description: 'Selected ids. The region is controlled.' },
      { name: 'attribute', type: 'string', defaultValue: "'data-select-id'", description: 'How items are found and identified.' },
      { name: 'children', type: 'ReactNode', description: 'Anything. Items carry the attribute; the rest is background.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Turns off the drag; the keyboard shortcuts stay.' },
    ],
  },

  cropper: {
    description:
      'A crop frame over any content, with eight handles and a keyboard. Everything is stored as fractions of the frame rather than pixels, so a crop survives a resize, a late-loading image and a different breakpoint.',
    sections: [
      {
        title: 'Example',
        description: 'Drag the frame or a handle. Focus a handle and use the arrows — Shift for coarse steps.',
        bare: true,
        Content: CropperExample,
        note: motionNote('unchanged — the frame follows the pointer with no transition of its own.'),
      },
      rationale(
        'Cropping is normally either an upload-time modal from a third-party bundle, or nothing at all — and both leave the product unable to crop anything that is not a photograph.',
        'Taking children rather than an image source means it crops a chart, a screenshot or a card design too, and fractions mean the result is meaningful at any rendered size.',
        'An avatar picker, a card artwork editor, a screenshot tool, a report export.',
        ['box-shadow scrim', 'fractional geometry', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'CropRect / fn', description: '{ x, y, width, height } as fractions, 0 to 1.' },
      { name: 'aspect', type: 'number', description: 'Width ÷ height. Width leads, so the ratio cannot drift.' },
      { name: 'minSize', type: 'number', defaultValue: '0.08', description: 'Smallest crop, as a fraction of the frame.' },
      { name: 'guides', type: 'boolean', defaultValue: 'true', description: 'Thirds inside the crop.' },
    ],
  },

  'signature-pad': {
    description:
      'A pad you sign with a pointer, the stroke thinning as the hand moves faster. Points are joined through their midpoints with quadratic curves, because a polyline through raw pointer samples is visibly faceted at speed.',
    sections: [
      {
        title: 'Example',
        description: 'Sign it, then undo a stroke. Strokes are points, so undo repaints rather than stacking bitmaps.',
        bare: true,
        Content: SignatureExample,
        note: motionNote('unchanged — the line is drawn by hand, not animated.'),
      },
      rationale(
        'A signature captured as a fixed-width polyline looks like a drawing of a signature, not one — the weight variation is most of what makes handwriting legible as handwriting.',
        'Width from sample distance costs nothing and gives that back, and keeping strokes as points means a resize redraws at the new size instead of stretching a bitmap.',
        'A mandate, a delivery confirmation, an agreement, an onboarding step.',
        ['canvas', 'ResizeObserver', 'Text', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'onChange', type: '(dataUrl: string | null) => void', description: 'Fires after each finished stroke. null once cleared.' },
      { name: 'weight', type: 'number', defaultValue: '2.4', description: 'Nominal width. Speed varies it either side.' },
      { name: 'height / guide / hint', type: 'number / boolean / string', description: 'Pad height, the signing line, and the placeholder copy.' },
    ],
  },
}
