import { useState } from 'react'
import {
  AsciiImage,
  BoidsFlock,
  Button,
  MatrixRain,
  SegmentedControl,
  StarField,
  Text,
} from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

/** A small SVG data URL, so the demo needs no network and no CORS. */
const PORTRAIT = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <defs>
    <radialGradient id="a" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#8a8f86"/>
      <stop offset="100%" stop-color="#0d0f12"/>
    </radialGradient>
  </defs>
  <rect width="240" height="240" fill="#0d0f12"/>
  <circle cx="120" cy="112" r="78" fill="url(#a)"/>
  <ellipse cx="120" cy="214" rx="104" ry="52" fill="#5a6058"/>
  <circle cx="96" cy="100" r="9" fill="#0d0f12"/>
  <circle cx="146" cy="100" r="9" fill="#0d0f12"/>
  <path d="M92 140c18 16 40 16 58 0" stroke="#0d0f12" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`)}`

function MatrixExample() {
  const [speed, setSpeed] = useState(14)

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Speed"
        size="sm"
        value={String(speed)}
        onValueChange={(value) => setSpeed(Number(value))}
        className="self-start"
        options={[
          { value: '6', label: 'Slow' },
          { value: '14', label: 'Normal' },
          { value: '30', label: 'Fast' },
        ]}
      />
      <div className="relative h-[260px] w-full overflow-hidden rounded-[var(--radius-card)]">
        <MatrixRain speed={speed} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Text size="display" className="text-white drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]">
            wake up
          </Text>
        </div>
      </div>
    </div>
  )
}

function StarsExample() {
  const [speed, setSpeed] = useState(6)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Throttle"
          size="sm"
          value={String(speed)}
          onValueChange={(value) => setSpeed(Number(value))}
          options={[
            { value: '2', label: 'Drift' },
            { value: '6', label: 'Cruise' },
            { value: '26', label: 'Warp' },
          ]}
        />
        <Text size="caption" tone="faint">
          Past 14 the stars become streaks. Move the pointer to steer.
        </Text>
      </div>

      <div className="relative h-[280px] w-full overflow-hidden rounded-[var(--radius-card)]">
        <StarField speed={speed} count={480} />
      </div>
    </div>
  )
}

function BoidsExample() {
  const [pointer, setPointer] = useState<'attract' | 'flee' | 'ignore'>('attract')

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Pointer"
        size="sm"
        value={pointer}
        onValueChange={(value) => setPointer(value as typeof pointer)}
        className="self-start"
        options={[
          { value: 'attract', label: 'Follow' },
          { value: 'flee', label: 'Scatter' },
          { value: 'ignore', label: 'Ignore' },
        ]}
      />
      <div className="relative h-[300px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app">
        <BoidsFlock pointer={pointer} count={200} />
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        No boid knows about the flock. Separation, alignment and cohesion are the only rules, and
        everything you can see is what they add up to.
      </Text>
    </div>
  )
}

function AsciiExample() {
  const [columns, setColumns] = useState(100)
  const [colored, setColored] = useState(false)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Resolution"
          size="sm"
          value={String(columns)}
          onValueChange={(value) => setColumns(Number(value))}
          options={[
            { value: '48', label: 'Coarse' },
            { value: '100', label: 'Normal' },
            { value: '170', label: 'Fine' },
          ]}
        />
        <Button size="sm" variant={colored ? 'accent' : 'outline'} onClick={() => setColored((v) => !v)}>
          {colored ? 'Coloured' : 'One colour'}
        </Button>
      </div>

      <div className="w-full overflow-hidden rounded-[var(--radius-card)] bg-[#0b0d12] p-4">
        <AsciiImage
          src={PORTRAIT}
          alt="A cartoon face, rendered as ASCII"
          columns={columns}
          colored={colored}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'matrix-rain': {
    description:
      'Glyphs falling in columns, brightest at the leading edge. The tail is not drawn — each frame paints a translucent black rectangle over the canvas, so everything already there fades by a fixed fraction and the trail is accumulated residue.',
    sections: [
      {
        title: 'Three speeds',
        description: 'Columns fall at their own rates and reset at random heights, so no band forms.',
        bare: true,
        Content: MatrixExample,
        note: motionNote('a couple of dozen frames are painted and it stops — the texture without the fall.'),
      },
      rationale(
        'The obvious implementation keeps an array of characters per column and redraws the tail, which is a lot of state to move one glyph.',
        'Fading the whole canvas by a fraction each frame gives the same picture for one fill and one glyph per column, and it is what makes hundreds of columns free.',
        'A 404, a loading screen, a hero, a terminal-themed landing page.',
        ['canvas', 'usePrefersReducedMotion', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'glyphs', type: 'string', description: 'Characters to fall. Katakana by default, because that is the look.' },
      { name: 'speed', type: 'number', defaultValue: '14', description: 'Rows advanced per second.' },
      { name: 'trail', type: 'number', defaultValue: '0.92', description: 'How much of each frame survives. Higher is a longer tail.' },
      { name: 'size / color / headColor', type: 'number / string / string', description: 'Glyph size, tail colour, and the brighter leading glyph.' },
    ],
  },

  'star-field': {
    description:
      'Flying through stars, with a warp when you go fast enough. Each star is a point in three dimensions and the screen position is x divided by z — that one division produces the entire effect.',
    sections: [
      {
        title: 'Drift, cruise, warp',
        description: 'Streaks are drawn between where each star is and where it was, so the edges stretch most.',
        bare: true,
        Content: StarsExample,
        note: motionNote('one frame is painted and the field holds still.'),
      },
      rationale(
        'A starfield is the cheapest sense of depth available and the usual version draws fixed-length streaks in the direction of travel, which gets the geometry wrong exactly where it is most visible.',
        'Storing each star’s previous z and drawing between the two positions is the same amount of code and correct at every eccentricity.',
        'A splash, a hero, a loading screen, a game menu.',
        ['canvas', 'ResizeObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'count', type: 'number', defaultValue: '420', description: 'How many stars.' },
      { name: 'speed', type: 'number', defaultValue: '6', description: 'Travel speed. Negative flies backwards.' },
      { name: 'warpAt', type: 'number', defaultValue: '14', description: 'Speed past which stars become streaks.' },
      { name: 'steer', type: 'boolean', defaultValue: 'true', description: 'Drift the vanishing point towards the pointer.' },
    ],
  },

  'boids-flock': {
    description:
      'A flock, from three rules and nothing else. Separation, alignment and cohesion — steer away from anyone too close, match your neighbours’ heading, drift towards their centre. No boid knows about the flock.',
    sections: [
      {
        title: 'Follow, scatter, ignore',
        description: 'Two hundred boids, neighbours found on a spatial grid rather than by comparing every pair.',
        bare: true,
        Content: BoidsExample,
        note: motionNote('a single frame is drawn; the flock is a still photograph of itself.'),
      },
      rationale(
        'Ambient motion usually means particles drifting on fixed vectors, which reads as a screensaver because nothing in it is responding to anything.',
        'Three local rules produce behaviour that looks decided rather than random — and bucketing by vision radius is what keeps two hundred of them running on a phone.',
        'A hero, an empty state, a background for a landing page, a loading screen.',
        ['canvas', 'spatial hashing', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'count / vision', type: 'number / number', defaultValue: '180 / 46', description: 'Flock size, and how far a boid can see.' },
      { name: 'separation / alignment / cohesion', type: 'number', defaultValue: '1.5 / 1 / 0.9', description: 'Weights for the three rules.' },
      { name: 'pointer', type: "'attract' | 'flee' | 'ignore'", defaultValue: "'attract'", description: 'What the pointer does to them.' },
      { name: 'speed', type: 'number', defaultValue: '2.6', description: 'Top speed, in pixels per frame.' },
    ],
  },

  'ascii-image': {
    description:
      'An image, redrawn as characters. The source is painted into a canvas one pixel per output character, so the browser’s own filtered downscale does the averaging — a hand-rolled block average is both slower and aliases.',
    sections: [
      {
        title: 'Three resolutions',
        description: 'Vertical sampling is halved, because monospace cells are about twice as tall as wide.',
        bare: true,
        Content: AsciiExample,
        note: motionNote('unchanged — the conversion happens once and nothing moves.'),
      },
      rationale(
        'ASCII art is a whole aesthetic and the naive conversion always comes out stretched, because nobody accounts for the cell aspect ratio.',
        'That, plus a ramp ordered by how much ink each glyph puts down, is the difference between a recognisable picture and grey noise.',
        'A profile page, a 404, an about section, a terminal-themed site.',
        ['canvas', 'VisuallyHidden', 'monospace metrics'],
      ),
    ],
    props: [
      { name: 'src / alt', type: 'string / string', description: 'The image, and its real alt text — the ASCII is decorative.' },
      { name: 'columns', type: 'number', defaultValue: '90', description: 'Characters across. Height follows the aspect ratio.' },
      { name: 'ramp', type: 'string', description: 'Darkest to lightest. Hand-picked ramps beat generated ones.' },
      { name: 'colored / invert', type: 'boolean / boolean', description: 'Colour each character from its pixel; or flip for light-on-dark.' },
    ],
  },
}
