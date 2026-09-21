import { useRef, useState } from 'react'
import { Badge, Button, ClothPanel, Slider, Text, type ClothPanelRef } from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- hero */

// A woven swatch in the accent, drawn with gradients so it needs no image.
const WEAVE = {
  backgroundColor: 'var(--color-accent)',
  backgroundImage: [
    'repeating-linear-gradient(0deg, color-mix(in oklab, var(--color-accent-ink) 12%, transparent) 0 2px, transparent 2px 6px)',
    'repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-accent-ink) 10%, transparent) 0 2px, transparent 2px 6px)',
    'radial-gradient(120% 90% at 20% 10%, color-mix(in oklab, var(--color-shell) 45%, transparent), transparent 60%)',
  ].join(','),
}

function HeroExample() {
  const [bag, setBag] = useState(0)
  const [moving, setMoving] = useState(false)
  return (
    <div className="flex w-full flex-col items-center gap-5 px-4 pb-10 pt-16">
      <ClothPanel pins="corners" wind={0.55} label="product card" onMotionChange={setMoving} className="w-full max-w-[340px]">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="relative h-32" style={WEAVE}>
            <span className="absolute left-3 top-3">
              <Badge tone="neutral">Linen · 180 gsm</Badge>
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <Text as="h3" size="subtitle" weight="bold">
                Washed linen overshirt
              </Text>
              <Text as="span" weight="semibold" className="tabular-nums">
                €89
              </Text>
            </div>
            <Text size="body" tone="soft">
              Garment-dyed and stone-washed, so it arrives already soft. Loose through the body, with a curved hem.
            </Text>
            <div className="mt-1 flex items-center justify-between gap-3">
              <Text as="span" size="label" tone="faint" aria-live="polite">
                {bag === 0 ? 'Free returns for 30 days' : `${bag} in your bag`}
              </Text>
              <Button size="sm" onClick={() => setBag((count) => count + 1)}>
                Add to bag
              </Button>
            </div>
          </div>
        </div>
      </ClothPanel>
      <Text as="p" size="label" tone="faint" className="text-center">
        {moving ? 'In the wind: you are looking at 108 inert clones.' : 'At rest: this is the real card, and its button works.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- tear */

const TABS = ['0142', '0187', '0163', '0120', '0155', '0199']

function TearExample() {
  const cloth = useRef<ClothPanelRef>(null)
  const [broken, setBroken] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-4 px-4 pb-24 pt-14">
      <ClothPanel ref={cloth} pins="top" tearable rows={8} label="flyer" onTear={setBroken} className="w-full max-w-[300px]">
        <div className="flex flex-col gap-2 border border-line bg-surface-sunken p-5 font-sans">
          <Text as="span" size="label" weight="bold" tone="faint" className="uppercase tracking-[0.18em]">
            Notice board
          </Text>
          <Text as="h3" size="title" weight="extrabold" leading="tight">
            Guitar lessons, any level
          </Text>
          <Text size="body" tone="soft">
            Thursday evenings at the library annexe. Bring your own instrument, or borrow one of ours.
          </Text>
          <div className="mt-2 grid grid-cols-6 border-t border-dashed border-line-strong">
            {TABS.map((tab) => (
              <span
                key={tab}
                className="border-r border-dashed border-line-strong py-2 text-center font-mono text-[10px] text-ink-soft [writing-mode:vertical-rl] last:border-r-0"
              >
                555-{tab}
              </span>
            ))}
          </div>
        </div>
      </ClothPanel>
      <div className="flex items-center gap-3">
        <Text as="span" size="body" tone="soft" aria-live="polite">
          {broken === 0 ? 'Grab the bottom and pull hard.' : `${broken} threads torn.`}
        </Text>
        <Button size="sm" variant="outline" onClick={() => cloth.current?.reset()}>
          Mend it
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- flag */

function FlagExample() {
  const [wind, setWind] = useState(60)
  const [direction, setDirection] = useState(-10)
  return (
    <div className="flex w-full flex-col items-center gap-8 px-4 pb-10 pt-14">
      <div className="pl-3">
        <ClothPanel pins="left" wind={wind / 100} windDirection={direction} gusts={false} calmOnHover={false} gravity={0.22} label="flag" className="w-[280px] max-w-full">
          <div className="grid h-[168px] grid-rows-[1fr_auto_1fr] overflow-hidden bg-accent">
            <span className="bg-ink" />
            <span className="flex items-center justify-center gap-2 py-3 text-accent-ink">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="currentColor">
                <path d="M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.4 6.5 20 8 13.3 3 9l6.4-.6z" />
              </svg>
              <span className="text-[26px] font-extrabold tracking-[0.2em]">KLYV</span>
            </span>
            <span className="bg-surface" />
          </div>
        </ClothPanel>
      </div>
      <div className="grid w-full max-w-[420px] grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <Text as="span" size="label" weight="semibold" tone="soft">
            Wind strength · {wind}%
          </Text>
          <Slider min={0} max={100} value={wind} onChange={(event) => setWind(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="label" weight="semibold" tone="soft">
            Direction · {direction}°
          </Text>
          <Slider min={-90} max={90} value={direction} onChange={(event) => setDirection(Number(event.target.value))} />
        </label>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'cloth-panel': {
    description:
      'A panel that hangs like fabric — the real card, with its real text and buttons, pinned and moving in the wind. A coarse Verlet cloth drives it, and every cell is drawn as two triangles, each a clone of the content clipped to that triangle and moved by the affine map from its rest corners to its current ones. Affine maps agree exactly along a shared edge, so there are no seams; when the cloth comes to rest the clones go and the real, clickable DOM is back.',
    sections: [
      {
        title: 'A card on two pins',
        description:
          'Gusts come and go. Point at the card and the wind drops, so it settles and the button works. Drag any part of it; the handle above takes arrow keys.',
        bare: true,
        Content: HeroExample,
        note: motionNote('the card never moves. The real content is shown as it is, fully usable.'),
      },
      {
        title: 'Tear it',
        description: 'With `tearable`, a link stretched past `tearLimit` breaks, and the triangles across it go with it.',
        bare: true,
        Content: TearExample,
        note: motionNote('nothing moves, so nothing can tear.'),
      },
      {
        title: 'A flag',
        description: 'Pinned along the left edge, in a steady wind. The wind presses on each triangle along its normal, which is what makes it billow.',
        bare: true,
        Content: FlagExample,
        note: motionNote('the flag hangs still with a slight static skew.'),
      },
      rationale(
        'A card that moves is almost always a picture of a card: a canvas or a video that looks right and cannot be clicked, read by a screen reader or selected.',
        'Clipped, affine-mapped clones of the real DOM keep the text crisp and the colours theme-true, and swapping back to the real content at rest keeps it a working interface.',
        'A launch page, a product drop, a campaign card, a playful empty state.',
        ['Verlet integration', 'clip-path', 'CSS matrix()', 'canvas', 'Button', 'Slider'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The panel itself. It is cloned while moving and shown for real at rest.' },
      { name: 'pins', type: "'top' | 'corners' | 'left' | 'none'", defaultValue: "'top'", description: 'Where the cloth is held.' },
      { name: 'cols / rows', type: 'number / number', defaultValue: '10 / 7', description: 'The mesh. Trimmed to stay under 140 triangles, which is the clone budget.' },
      { name: 'wind / windDirection', type: 'number / number', defaultValue: '0 / 0', description: 'Strength from 0 to 1, and the heading in degrees (0 is right, 90 is down).' },
      { name: 'gusts', type: 'boolean', defaultValue: 'true', description: 'Blow in gusts with calm spells, in which the cloth settles into the real panel.' },
      { name: 'gravity / damping / iterations', type: 'number', defaultValue: '0.32 / 0.985 / 8', description: 'Weight, how much speed survives a step, and constraint passes.' },
      { name: 'tearable / tearLimit', type: 'boolean / number', defaultValue: 'false / 1.9', description: 'Let links break past this stretch ratio.' },
      { name: 'onTear', type: '(broken: number) => void', description: 'The running count of broken links.' },
      { name: 'onMotionChange', type: '(moving: boolean) => void', description: 'True when clones take over, false when the real content is back.' },
      { name: 'calmOnHover', type: 'boolean', defaultValue: 'true', description: 'Drop the wind while a pointer is over the panel.' },
      { name: 'shading / bleed', type: 'number / number', defaultValue: '1 / 24', description: 'Fold shading strength, and px drawn past each edge so a shadow travels too.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the simulation where it is.' },
      { name: 'ref', type: 'ClothPanelRef', description: '`reset()`, `shake()` and `settle()`.' },
    ],
  },
}
