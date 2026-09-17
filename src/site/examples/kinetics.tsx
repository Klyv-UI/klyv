import { useState } from 'react'
import {
  BlobMorph,
  Button,
  CubeCarousel,
  GooeyLoader,
  RippleSurface,
  SegmentedControl,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

function CubeExample() {
  const [index, setIndex] = useState(0)
  const [axis, setAxis] = useState<'y' | 'x'>('y')

  const face = (emoji: string, title: string, body: string, background: string) => (
    <div className="flex h-full flex-col justify-between p-5" style={{ background }}>
      <span className="text-[34px]">{emoji}</span>
      <div className="flex flex-col gap-1">
        <Text size="subtitle">{title}</Text>
        <Text size="caption" tone="soft" leading="normal">
          {body}
        </Text>
      </div>
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <SegmentedControl
        label="Axis"
        size="sm"
        value={axis}
        onValueChange={(value) => setAxis(value as 'y' | 'x')}
        options={[
          { value: 'y', label: 'Spin' },
          { value: 'x', label: 'Roll' },
        ]}
      />

      <CubeCarousel
        label="Feature cube"
        index={index}
        onIndexChange={setIndex}
        axis={axis}
        size={250}
        faces={[
          face('🎧', 'Sound on', 'Every face is a real panel, not a texture.', 'var(--color-accent-soft)'),
          face('🧊', 'Four sides', 'The whole cube turns, so corners never split.', '#e6f2ff'),
          face('🌗', 'Shortest path', 'Face 4 to face 1 keeps going forwards.', '#f6e6ff'),
          face('⚡', 'Tab-safe', 'Only the front face is in the tab order.', '#fff0e0'),
        ]}
      />

      <Text size="caption" tone="faint">
        Focus the cube and use the arrow keys. Face {index + 1} of 4.
      </Text>
    </div>
  )
}

function BlobExample() {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-8 py-2">
      <BlobMorph size={230}>
        <Text size="subtitle" className="text-ink">
          move your pointer
        </Text>
      </BlobMorph>

      <BlobMorph
        size={170}
        wobble={0.32}
        points={6}
        duration={5}
        fill="linear-gradient(135deg,#ff5f6d,#ffc371)"
      >
        <Text size="caption" weight="bold" className="text-white">
          wobble 0.32
        </Text>
      </BlobMorph>

      <BlobMorph
        size={140}
        wobble={0.1}
        points={10}
        duration={14}
        reactive={false}
        fill="linear-gradient(135deg,#17191c,#5b6470)"
      >
        <Text size="micro" weight="bold" className="text-white">
          calm
        </Text>
      </BlobMorph>
    </div>
  )
}

function GooExample() {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-10 py-4">
      {[
        { count: 3, goo: 14, label: 'three, loose' },
        { count: 4, goo: 18, label: 'four, default' },
        { count: 6, goo: 26, label: 'six, fused' },
      ].map((entry) => (
        <div key={entry.label} className="flex flex-col items-center gap-2">
          <GooeyLoader
            label={`Loading — ${entry.label}`}
            count={entry.count}
            goo={entry.goo}
            size={110}
          />
          <Text size="caption" tone="faint">
            {entry.label}
          </Text>
        </div>
      ))}
    </div>
  )
}

function RippleExample() {
  const [rain, setRain] = useState(0)

  return (
    <div className="flex w-full flex-col gap-3">
      <RippleSurface
        rain={rain}
        rings={3}
        className="w-full rounded-[var(--radius-card)]"
        color="rgba(255,255,255,0.85)"
      >
        <div
          className="grid min-h-[260px] place-items-center p-8"
          style={{
            background:
              'radial-gradient(120% 100% at 20% 0%, #1e5f8f 0%, #0d2b45 45%, #071726 100%)',
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Text size="title" className="text-white">
              press anywhere
            </Text>
            <Text size="body" weight="medium" leading="normal" className="max-w-[38ch] text-white/70">
              Press several times quickly — each drop keeps its own clock, so the rings overlap
              instead of restarting each other.
            </Text>
          </div>
        </div>
      </RippleSurface>

      <Button size="sm" variant="outline" className="self-start" onClick={() => setRain(rain ? 0 : 700)}>
        {rain ? 'Stop the rain' : 'Make it rain'}
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'cube-carousel': {
    description:
      'Four panels on the sides of a cube that turns to show the one you ask for. The faces are pushed out from a shared centre and the whole cube rotates — rotating each face independently produces a shape that visibly comes apart at the corners.',
    sections: [
      {
        title: 'Spin and roll',
        description: 'Click the dots or focus the cube and use the arrow keys.',
        bare: true,
        Content: CubeExample,
        note: motionNote('the cube cuts to each face instead of turning; the content is identical.'),
      },
      rationale(
        'A carousel of four short panels is a solved problem visually and a boring one — and 3D carousels usually break at exactly the moment they matter, wrapping from the last item back to the first.',
        'Accumulating the rotation and choosing the shortest path fixes the wrap, and only the front face being in the tab order stops three hidden screens turning up under Tab.',
        'A feature tour, a plan comparison, a product gallery, a landing hero.',
        ['CSS 3D transforms', 'roving focus', 'surface tokens'],
      ),
    ],
    props: [
      { name: 'faces', type: 'ReactNode[]', description: 'Four. Fewer are padded, more ignored.' },
      { name: 'index / onIndexChange', type: 'number / fn', description: 'Which face is front. Omit for uncontrolled.' },
      { name: 'axis', type: "'y' | 'x'", defaultValue: "'y'", description: 'Spinning or rolling.' },
      { name: 'autoRotate', type: 'number', defaultValue: '0', description: 'Milliseconds between automatic turns. 0 is off.' },
      { name: 'size', type: 'number', defaultValue: '260', description: 'Cube edge in pixels.' },
    ],
  },

  'blob-morph': {
    description:
      'An organic shape that never stops moving and never repeats. Two sine waves at unrelated frequencies drive the radius, so the outline has no period a viewer can catch — which is the difference between an organic blob and a loop of one.',
    sections: [
      {
        title: 'Three settings',
        description: 'Move the pointer over the first two: the outline bulges towards it.',
        bare: true,
        Content: BlobExample,
        note: motionNote('a single frame is built and the shape holds still — still a blob, just a calm one.'),
      },
      rationale(
        'The usual CSS blob is an eight-value border-radius animating between two states, which loops visibly in about four seconds and cannot react to anything.',
        'Building the path from control points means it can respond — a Gaussian bulge towards the pointer, falling off with angular distance, so it leans rather than deforming all at once.',
        'A hero shape, an empty state, an avatar frame, a loading mascot.',
        ['SVG', 'Catmull–Rom splines', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'wobble', type: 'number', defaultValue: '0.18', description: 'How far the outline wanders from a circle.' },
      { name: 'points', type: 'number', defaultValue: '8', description: 'Control points. Six to ten reads best.' },
      { name: 'duration', type: 'number', defaultValue: '9', description: 'Seconds for the slowest wave.' },
      { name: 'reactive', type: 'boolean', defaultValue: 'true', description: 'Bulge towards the pointer.' },
      { name: 'fill', type: 'string', description: 'Any CSS background. A gradient stops it looking like a puddle.' },
    ],
  },

  'gooey-loader': {
    description:
      'Blobs that orbit, merge into one mass, and separate again. Blur the group heavily, then push the alpha channel through a steep contrast curve — overlapping blurred edges sum past the threshold and snap into one connected shape.',
    sections: [
      {
        title: 'Three strengths',
        description: 'Higher goo fuses earlier. The filter has to wrap the group; per blob it does nothing.',
        bare: true,
        Content: GooExample,
        note: motionNote('the blobs stop where they are, still fused, and the label still announces.'),
      },
      rationale(
        'A spinner says "wait" and nothing else, and the metaball effect is the one loader people actually watch.',
        'The recipe is two SVG filter primitives, which is far cheaper than the canvas implementations this usually attracts — and the reason it looks broken for most people is applying the filter per blob instead of to the group.',
        'A long operation, a splash, a placeholder, an empty canvas.',
        ['SVG filters', 'VisuallyHidden', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Required. The blobs are decorative; this is what is announced.' },
      { name: 'count', type: 'number', defaultValue: '4', description: 'Orbiting blobs. Three or four reads best.' },
      { name: 'goo', type: 'number', defaultValue: '18', description: 'Alpha multiplier. Steeper fuses earlier and blows out the edges.' },
      { name: 'size / duration / color', type: 'number / number / string', description: 'Appearance.' },
    ],
  },

  'ripple-surface': {
    description:
      'Water: press anywhere and rings spread out from the point. Every drop keeps its own birth timestamp, which is what lets six ripples overlap correctly instead of each press restarting a single animation.',
    sections: [
      {
        title: 'Press it, then make it rain',
        description: 'Opacity falls off with the square of age, so it reads as energy dissipating.',
        bare: true,
        Content: RippleExample,
        note: motionNote('the canvas loop never starts and the surface stays perfectly still.'),
      },
      rationale(
        'Material-style ripples are per-button and single. A whole surface that responds to being touched is a different thing, and the naive version can only ever show one ring.',
        'A list of drops with timestamps, pruned each frame, means a hundred presses cost the same as two — and the squared falloff is what stops it reading as a shrinking circle.',
        'A hero, a login background, an interactive banner, a screensaver state.',
        ['canvas', 'ResizeObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'rings / duration', type: 'number / number', defaultValue: '3 / 1.8', description: 'Rings per drop, and seconds to fade.' },
      { name: 'onHover', type: 'boolean', defaultValue: 'false', description: 'Drop on move as well as on press.' },
      { name: 'rain', type: 'number', defaultValue: '0', description: 'Milliseconds between random drops. 0 is off.' },
      { name: 'color', type: 'string', description: 'Ring colour. Light on dark is the one that reads.' },
    ],
  },
}
