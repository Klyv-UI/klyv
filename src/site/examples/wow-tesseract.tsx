import { useRef, useState } from 'react'
import {
  Button,
  SegmentedControl,
  Slider,
  Switch,
  Tesseract,
  Text,
  type TesseractAngles,
  type TesseractHandle,
  type TesseractProjection,
  type TesseractTone,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- hero */

function TesseractHeroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Tesseract cells label="Tesseract turning in the xw and yw planes" size={520} />
      <Text size="caption" tone="faint" className="max-w-[520px] text-center">
        The small cube in the middle is not smaller — it is the same cube, further away along w. Watch it swell out through the big one as the
        turn in xw carries it towards the 4D eye. Drag to throw it; hold Shift to turn in xz and yz instead.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- double rotations */

type SpinPreset = 'default' | 'simple' | 'double' | 'isoclinic'

/** Relative speeds per plane; the slider scales them. */
const SPINS: Record<SpinPreset, Partial<TesseractAngles>> = {
  default: { xw: 1, yw: 0.618, xz: 0.13 },
  simple: { xw: 1 },
  double: { xw: 1, yz: 0.618 },
  isoclinic: { xy: 1, zw: 1 },
}

const SPIN_NOTES: Record<SpinPreset, string> = {
  default: 'xw and yw in the golden ratio, with a slow xz drift: the two turns never fall back into step.',
  simple: 'A simple rotation in xw. Every point keeps its y and z, so the whole turn happens in x and w: the tesseract turns inside out along x.',
  double: 'xw and yz share no axis, so they commute: a true double rotation, two invariant planes each turning at its own speed, and no fixed point but the centre.',
  isoclinic: 'xy and zw at equal speed: the isoclinic, or Clifford, rotation. Every vertex runs round its own great circle at the same rate.',
}

function TesseractRotationExample() {
  const view = useRef<TesseractHandle>(null)
  const [preset, setPreset] = useState<SpinPreset>('double')
  const [speed, setSpeed] = useState(34)
  const [eye, setEye] = useState(18)
  const [projection, setProjection] = useState<TesseractProjection>('perspective')
  const [tone, setTone] = useState<TesseractTone>('duo')
  const [cells, setCells] = useState(false)
  const [paused, setPaused] = useState(false)
  const spin = Object.fromEntries(Object.entries(SPINS[preset]).map(([plane, rate]) => [plane, (rate ?? 0) * (speed / 100)]))
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Rotation"
        size="sm"
        value={preset}
        onValueChange={setPreset}
        options={[
          { value: 'default', label: 'xw + yw' },
          { value: 'simple', label: 'Simple' },
          { value: 'double', label: 'Double' },
          { value: 'isoclinic', label: 'Isoclinic' },
        ]}
      />
      <div className="flex flex-col items-start gap-6 md:flex-row">
        <Tesseract
          ref={view}
          spin={spin}
          paused={paused}
          eye={eye / 10}
          projection={projection}
          tone={tone}
          cells={cells}
          controls={false}
          size={400}
          label={`Tesseract, ${preset} rotation`}
        />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <Text size="caption" tone="soft">
            {SPIN_NOTES[preset]}
          </Text>
          <label className="flex flex-col gap-2">
            <Text as="span" size="caption" weight="semibold" tone="soft">
              Speed · {(speed / 100).toFixed(2)} rad/s
            </Text>
            <Slider min={0} max={120} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </label>
          <label className="flex flex-col gap-2">
            <Text as="span" size="caption" weight="semibold" tone="soft">
              4D eye distance · {(eye / 10).toFixed(1)} circumradii
            </Text>
            <Slider
              min={12}
              max={60}
              value={eye}
              disabled={projection === 'stereographic'}
              onChange={(event) => setEye(Number(event.target.value))}
            />
          </label>
          <SegmentedControl
            label="Projection"
            size="sm"
            value={projection}
            onValueChange={setProjection}
            options={[
              { value: 'perspective', label: 'Perspective' },
              { value: 'stereographic', label: 'Stereographic' },
            ]}
          />
          <SegmentedControl
            label="Tone"
            size="sm"
            value={tone}
            onValueChange={setTone}
            options={[
              { value: 'duo', label: 'Ink to accent' },
              { value: 'accent', label: 'Accent' },
              { value: 'ink', label: 'Ink' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={cells} onChange={(event) => setCells(event.target.checked)} />
              Faces
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
              Paused
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => view.current?.setRotation({ xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 })}>
              Face on
            </Button>
            <Button size="sm" variant="ghost" onClick={() => view.current?.reset()}>
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- the big two */

function TesseractGoldenExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Tesseract shape="600-cell" projection="stereographic" vertices={false} controls={false} spin={{ xy: 0.12, zw: 0.12 }} label="600-cell, stereographic" />
        <Text size="caption" tone="soft">
          The 600-cell under stereographic projection, turning isoclinically. Its 720 edges come out as circular arcs, and the rings of ten you
          can pick out are great circles of the 3-sphere.
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <Tesseract shape="120-cell" tone="accent" vertices={false} controls={false} eye={2.4} spin={{ xw: 0.16, yz: 0.1 }} label="120-cell, perspective" />
        <Text size="caption" tone="soft">
          The 120-cell in perspective: 600 vertices, 1,200 edges, 120 dodecahedra. The one nearest the eye fills the middle; the rest crowd into
          the shell behind it.
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  tesseract: {
    description:
      'A regular 4-polytope turning in four dimensions — the tesseract by default, and the 5-cell, 16-cell, 24-cell, 120-cell and 600-cell besides. The vertices are the textbook coordinates (the tesseract’s sixteen sign vectors, the golden-ratio families of the 120- and 600-cell), scaled onto the unit 3-sphere; edges are the pairs at the shortest distance and faces are the shortest cycles of the edge graph, which for regular polytopes is exactly the right answer. Orientation is an angle in each of the six planes of 4-space — xy, xz, xw, yz, yw, zw — composed into a 4×4 rotation matrix, and the picture is two projections in a row: 4D to 3D by a perspective divide from an eye on the w axis, or stereographically from the 3-sphere’s pole with edges bent into great-circle arcs, then 3D to 2D by an ordinary camera. Depth in w is the one thing a picture cannot show, so it is carried by the lines: near edges are thick, opaque and accent-coloured, far ones thin, faint and ink.',
    sections: [
      {
        title: 'The tesseract',
        description:
          'Turning in xw and yw at once, with the faces filled. Drag to turn it and let go to throw it; arrow keys turn it too, with Shift for the w planes. Click it first and the wheel turns zw.',
        Content: TesseractHeroExample,
        bare: true,
        note: motionNote(
          'it does not spin. It holds a three-quarter still, turned a little way out of w so the inner cube sits off-centre inside the outer, and six sliders — one per plane — turn it by hand. Drags and keys still turn it, without momentum or easing.',
        ),
      },
      {
        title: 'Simple, double and isoclinic rotations',
        description:
          'In four dimensions a rotation can turn two planes at once. Pick a rotation, then move the 4D eye closer to exaggerate the perspective, or switch to stereographic to see the edges as arcs.',
        Content: TesseractRotationExample,
      },
      {
        title: 'The golden-ratio pair',
        description: 'The 600-cell and 120-cell are duals, both built from φ. Edges are banded by depth so their thousand-odd lines stay cheap to draw.',
        Content: TesseractGoldenExample,
      },
      rationale(
        'Four-dimensional shapes are usually shown as a looping GIF of one rotation, or a CSS cube inside a cube that only looks the part and cannot be turned.',
        'The maths is small and exact — a 4×4 matrix and a divide — so the real object can be drawn live, turned by hand in any plane, and coloured from the theme.',
        'Maths and science teaching, landing pages for anything about dimensions or data, loading moments worth watching, and a hero that answers a drag.',
        ['Canvas 2D', 'SegmentedControl', 'Slider', 'Switch', 'Button', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'shape', type: "'5-cell' | 'tesseract' | '16-cell' | '24-cell' | '120-cell' | '600-cell'", defaultValue: "'tesseract'", description: 'Which regular 4-polytope to draw.' },
      { name: 'onShapeChange', type: '(shape) => void', description: 'Called when the built-in shape control picks another polytope.' },
      { name: 'projection', type: "'perspective' | 'stereographic'", defaultValue: "'perspective'", description: 'A perspective eye on the w axis, or stereographic from the 3-sphere’s pole with edges drawn as arcs.' },
      { name: 'onProjectionChange', type: '(projection) => void', description: 'Called when the built-in projection control changes.' },
      { name: 'rotation', type: 'Partial<Record<Plane, number>>', description: 'Controlled orientation in radians per plane; turns are reported through onRotationChange.' },
      { name: 'defaultRotation', type: 'Partial<Record<Plane, number>>', description: 'Starting orientation. Planes left out take the built-in three-quarter view.' },
      { name: 'onRotationChange', type: '(angles) => void', description: 'Called when a drag, key, wheel or slider turns it; not for the automatic spin.' },
      { name: 'spin', type: 'Partial<Record<Plane, number>>', defaultValue: '{ xw: 0.34, yw: 0.21, xz: 0.045 }', description: 'Radians per second in each plane.' },
      { name: 'autoRotate', type: 'boolean', defaultValue: 'true', description: 'Spin on its own. Off under reduced motion and when rotation is controlled.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the spin and any momentum; dragging still turns it.' },
      { name: 'eye', type: 'number', defaultValue: '1.8', description: 'Perspective only: the 4D eye’s distance along w in circumradii. Closer shrinks the far cell.' },
      { name: 'cells', type: 'boolean', defaultValue: 'false', description: 'Fill the faces as translucent polygons, sorted back to front.' },
      { name: 'vertices', type: 'boolean', defaultValue: 'true', description: 'A dot on every vertex, sized by nearness in w.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Drag, arrow keys and, once focused, the wheel turn it.' },
      { name: 'dragPlanes', type: "'4d' | '3d'", defaultValue: "'4d'", description: 'A plain drag turns xw and yw, or xz and yz. Shift swaps while held.' },
      { name: 'tone', type: "'duo' | 'accent' | 'ink'", defaultValue: "'duo'", description: 'Edge colour: ink far in w to accent near, or one token.' },
      { name: 'size', type: 'number', defaultValue: '480', description: 'Maximum width in pixels; the view is square.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Shape, projection and display controls, and per-plane sliders whenever it is still.' },
      { name: 'label', type: 'string', defaultValue: "'Four-dimensional polytope'", description: 'Accessible name, followed by a generated description of shape and orientation. Empty makes it decorative.' },
      { name: 'ref', type: 'TesseractHandle', description: '{ reset(), setRotation(angles, instant?), getRotation() } — turn it from code or a button.' },
      { name: 'className', type: 'string', description: 'Merged onto the outer wrapper.' },
    ],
  },
}
