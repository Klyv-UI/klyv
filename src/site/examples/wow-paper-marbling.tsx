import { useRef, useState } from 'react'
import { Button, PaperMarbling, Text, type PaperMarblingHandle, type PaperMarblingPattern, type PaperMarblingStatus } from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const RECIPES: Record<PaperMarblingPattern, string> = {
  stone: 'Stone (battal): drops alone. Each one pushes every earlier drop outwards into a ring round itself.',
  'gel-git': 'Gel-git, “come-go”: a stone ground, then a stylus drawn down and back up in parallel strokes across the bath.',
  nonpareil: 'Nonpareil: a gel-git, then one pass of a fine comb at right angles, pulling each stripe into small chevrons.',
  bouquet: 'Bouquet: a nonpareil, then a wide comb drawn back and forth in wavy strokes, gathering the chevrons into fans.',
  free: 'Freehand: a few drops to start from. Click to drop ink, drag to draw a tine.',
}

function MarblingHeroExample() {
  const [pattern, setPattern] = useState<PaperMarblingPattern>('bouquet')
  const [status, setStatus] = useState<PaperMarblingStatus>('ready')
  return (
    <div className="flex w-full flex-col gap-3">
      <PaperMarbling
        label="Marbled paper"
        pattern={pattern}
        onPatternChange={setPattern}
        onStatusChange={setStatus}
      />
      <Text size="caption" tone="faint" aria-live="polite">
        {status === 'playing' ? 'Playing: ' : ''}
        {RECIPES[pattern]}
      </Text>
    </div>
  )
}

function MarblingCodeExample() {
  const paper = useRef<PaperMarblingHandle>(null)
  const timers = useRef<number[]>([])
  const bullseye = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    // Every drop at the same point: each one pushes the ones before it into a ring.
    timers.current = [0, 1, 2, 3, 4, 5].map((i) =>
      window.setTimeout(() => paper.current?.drop(0.5, 0.5, { radius: 0.07, color: i % 4 }), i * 340),
    )
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <PaperMarbling
        ref={paper}
        defaultPattern="free"
        autoplay={false}
        controls={false}
        aspectRatio={2}
        label="Marbled paper driven by the buttons below"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={bullseye}>
          Bull’s-eye
        </Button>
        <Button size="sm" variant="muted" onClick={() => paper.current?.comb(0.5, 0.1, 0.5, 0.45, { spacing: 0.04, decay: 0.2 })}>
          Straight tine
        </Button>
        <Button size="sm" variant="muted" onClick={() => paper.current?.comb(0.05, 0.5, 0.35, 0.5, { spacing: 0.06, decay: 0.3, amplitude: 0.06, wavelength: 0.25 })}>
          Wavy tine
        </Button>
        <Button size="sm" variant="outline" onClick={() => paper.current?.undo()}>
          Undo
        </Button>
        <Button size="sm" variant="ghost" onClick={() => paper.current?.reset()}>
          Clear
        </Button>
      </div>
      <Text size="caption" tone="faint">
        Undo does not invert anything: the bath is replayed from an empty one without the last operation, which is exact and takes milliseconds.
      </Text>
    </div>
  )
}

function MarblingInksExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <PaperMarbling
          defaultPattern="nonpareil"
          autoplay={false}
          controls={false}
          aspectRatio={4 / 3}
          palette={['var(--color-danger)', 'var(--color-warning)', 'var(--color-success)', 'var(--color-ink)']}
          label="Nonpareil in the status colours"
        />
        <Text size="caption" tone="soft">
          Nonpareil in the four status tokens.
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <PaperMarbling
          defaultPattern="gel-git"
          autoplay={false}
          controls={false}
          aspectRatio={4 / 3}
          palette={['var(--color-ink)', 'var(--color-accent)']}
          label="Gel-git in ink and accent"
        />
        <Text size="caption" tone="soft">
          Gel-git in two inks: the accent and the ink token.
        </Text>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'paper-marbling': {
    description:
      'Ebru — Turkish paper marbling — with Aubrey Jaffer’s closed-form maps from “Mathematical Marbling”. The bath holds closed polygons of ink, and nothing is ever painted: a drop moves every existing vertex by P′ = C + (P−C)·√(1 + r²/|P−C|²), which preserves area and is why older drops become exact concentric rings round a new one, and a tine drawn through the bath shifts every vertex along the stroke by u·λ^(d/α), a wake that decays with distance d from the line. A wavy tine measures d from a sine instead. Edges are split wherever they stretch, and the inks are filled oldest first with a feathered edge. The list of operations is the state, so undo and resize are a replay from an empty bath.',
    sections: [
      {
        title: 'Run the recipe',
        description:
          'A historical pattern made in front of you, one drop and one stroke at a time. Pick another pattern, or stop it and carry on by hand: click to drop, drag to comb.',
        Content: MarblingHeroExample,
        bare: true,
        note: motionNote(
          'every operation lands at once, so a pattern appears finished and a click or drag shows its result directly. Undo steps back through the recipe one operation at a time.',
        ),
      },
      {
        title: 'Driven from code',
        description:
          'The ref drops ink and draws tines in paper coordinates. Six drops at one point make a bull’s-eye; a stroke through it drags the rings into a tongue.',
        Content: MarblingCodeExample,
      },
      {
        title: 'Your own inks',
        description: 'Any CSS colours or tokens. Without autoplay the finished pattern is shown at once, which suits a card or a cover.',
        Content: MarblingInksExample,
      },
      rationale(
        'Generative patterns are usually noise shaders or baked images: they look alike, and nothing about them can be taken back or replayed.',
        'Jaffer’s maps are exact, area-preserving and cheap, so a pattern is a short list of operations — replayable at any size, undoable by dropping one, and recoloured by the theme.',
        'Covers and endpapers, generative art sections, onboarding moments that reward play, and a pattern a reader can make and keep as a PNG.',
        ['SegmentedControl', 'Slider', 'Button', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'pattern', type: "'stone' | 'gel-git' | 'nonpareil' | 'bouquet' | 'free'", description: 'Controlled pattern. A change empties the bath and makes the new one from its recipe.' },
      { name: 'defaultPattern', type: 'PaperMarblingPattern', defaultValue: "'bouquet'", description: 'Uncontrolled starting pattern.' },
      { name: 'onPatternChange', type: '(pattern: PaperMarblingPattern) => void', description: 'Called when the pattern control changes.' },
      { name: 'palette', type: "'accent' | string[]", defaultValue: "'accent'", description: 'Ink colours as CSS colours or tokens, or four inks mixed from the accent and the ink token.' },
      { name: 'dropSize', type: 'number', description: 'Controlled drop radius, as a fraction of the paper’s height.' },
      { name: 'defaultDropSize', type: 'number', defaultValue: '0.1', description: 'Uncontrolled starting drop radius.' },
      { name: 'onDropSizeChange', type: '(size: number) => void', description: 'Called when the drop-size slider moves.' },
      { name: 'autoplay', type: 'boolean', defaultValue: 'true', description: 'Play the recipe when the paper scrolls into view. Off, the finished pattern is shown at once.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Hold the recipe where it is. Clicks and drags still work.' },
      { name: 'speed', type: 'number', defaultValue: '1', description: 'Recipe playback speed. At 1 a bouquet takes about ten seconds.' },
      { name: 'aspectRatio', type: 'number', defaultValue: '1.5', description: 'Width over height of the paper.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the recipe, ink colour, drop size and edit controls.' },
      { name: 'label', type: 'string', description: 'Accessible name; the canvas is described with the pattern and its counts. Without it the canvas is decorative.' },
      { name: 'onStatusChange', type: "(status: 'playing' | 'ready') => void", description: 'Called when a recipe starts, and when it ends or is stopped.' },
      {
        name: 'ref',
        type: 'PaperMarblingHandle',
        description: '{ drop(x?, y?, options?), comb(x0, y0, x1, y1, options?), undo(), reset(), play(), toBlob() } — coordinates are 0–1 across and down the paper.',
      },
    ],
  },
}
