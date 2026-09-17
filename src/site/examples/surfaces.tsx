import { useState } from 'react'
import {
  Button,
  HoloCard,
  LiquidGlass,
  NeonSign,
  SegmentedControl,
  StickerPeel,
  Tag,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

/** Something busy to put behind the glass — frosting hides nothing. */
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-card)]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 0%, #ff5f6d 0%, transparent 55%), radial-gradient(110% 100% at 85% 20%, #4facfe 0%, transparent 58%), radial-gradient(120% 120% at 50% 110%, #c8f24e 0%, transparent 60%), #10131a',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 1.5px, transparent 1.5px 22px), repeating-linear-gradient(0deg, rgba(255,255,255,0.85) 0 1.5px, transparent 1.5px 22px)',
        }}
      />
      <div className="relative grid min-h-[300px] place-items-center p-8">{children}</div>
    </div>
  )
}

function GlassExample() {
  const [refraction, setRefraction] = useState(28)

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Refraction"
        size="sm"
        value={String(refraction)}
        onValueChange={(value) => setRefraction(Number(value))}
        className="self-start"
        options={[
          { value: '0', label: 'Blur only' },
          { value: '28', label: 'Refracting' },
          { value: '60', label: 'Heavy' },
        ]}
      />

      <Backdrop>
        <LiquidGlass refraction={refraction} blur={16} className="w-full max-w-[380px]">
          <div className="flex flex-col items-start gap-2 p-6">
            <Tag size="sm" tone="accent">
              Members only
            </Tag>
            <Text size="title" className="mt-1 text-white">
              The grid bends at the edge
            </Text>
            <Text size="body" weight="medium" leading="normal" className="text-white/75">
              Watch the lines behind the panel where they meet the border. Blur alone leaves them
              straight — that is frosting, not glass.
            </Text>
            <Button size="sm" className="mt-2 self-start">
              Join
            </Button>
          </div>
        </LiquidGlass>
      </Backdrop>
    </div>
  )
}

function HoloExample() {
  return (
    <div className="flex w-full flex-wrap justify-center gap-6 py-2">
      <HoloCard className="w-[240px]" contentClassName="bg-[#12141c]">
        <div className="flex h-[330px] flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <Text size="micro" className="uppercase tracking-[0.2em] text-white/60">
              Series 01
            </Text>
            <Text size="micro" className="text-white/60">
              ✦ 042 / 500
            </Text>
          </div>
          <div className="grid h-[150px] place-items-center rounded-[var(--radius-tile)] bg-white/5 text-[52px]">
            🛸
          </div>
          <div className="flex flex-col gap-1">
            <Text size="subtitle" className="text-white">
              Night Drifter
            </Text>
            <Text size="caption" className="text-white/60">
              Holographic · Mythic
            </Text>
          </div>
        </div>
      </HoloCard>

      <HoloCard className="w-[240px]" foil={0.85} tilt={18} contentClassName="bg-[#1d1030]">
        <div className="flex h-[330px] flex-col justify-between p-5">
          <Text size="micro" className="uppercase tracking-[0.2em] text-white/60">
            Foil at 0.85
          </Text>
          <div className="grid h-[150px] place-items-center rounded-[var(--radius-tile)] bg-white/5 text-[52px]">
            🐉
          </div>
          <div className="flex flex-col gap-1">
            <Text size="subtitle" className="text-white">
              Ember Wyrm
            </Text>
            <Text size="caption" className="text-white/60">
              Full art · 1 of 1
            </Text>
          </div>
        </div>
      </HoloCard>
    </div>
  )
}

function NeonExample() {
  const [on, setOn] = useState(true)

  return (
    <div className="flex w-full flex-col gap-3">
      <Button size="sm" variant="outline" className="self-start" onClick={() => setOn((v) => !v)}>
        {on ? 'Turn the sign off' : 'Turn the sign on'}
      </Button>

      <div className="grid min-h-[220px] w-full place-items-center gap-5 rounded-[var(--radius-card)] bg-[#0b0d12] p-8">
        <NeonSign off={!on} color="#ff4fd8" className="text-[42px]">
          open late
        </NeonSign>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <NeonSign off={!on} color="#22e0ff" flicker={false} className="text-[22px]">
            no cover
          </NeonSign>
          <NeonSign off={!on} color="#c8f24e" outline={false} className="text-[22px]">
            solid fill
          </NeonSign>
        </div>
      </div>
    </div>
  )
}

function StickerExample() {
  const [peeled, setPeeled] = useState<Record<string, boolean>>({})

  const sticker = (id: string, emoji: string, text: string, background: string) => (
    <StickerPeel
      key={id}
      peeled={peeled[id]}
      onPeel={() => setPeeled((current) => ({ ...current, [id]: true }))}
      className="h-[130px] w-[130px]"
    >
      <div
        className="grid h-[130px] w-[130px] place-items-center gap-1 rounded-[var(--radius-tile)] text-center"
        style={{ background }}
      >
        <span className="text-[34px]">{emoji}</span>
        <Text size="micro" weight="bold" className="uppercase tracking-wider">
          {text}
        </Text>
      </div>
    </StickerPeel>
  )

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-5">
        {sticker('a', '🌀', 'certified', 'linear-gradient(140deg,#c8f24e,#7fd4ff)')}
        {sticker('b', '🔥', 'no notes', 'linear-gradient(140deg,#ffc371,#ff5f6d)')}
        {sticker('c', '💾', 'shipped', 'linear-gradient(140deg,#e6fbb0,#b06ab3)')}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => setPeeled({})}>
          Stick them back
        </Button>
        <Text size="caption" tone="faint">
          Hover lifts the corner. Drag it past 90px and it comes off.
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'liquid-glass': {
    description:
      'A pane of glass: blurred backdrop, a lit rim, and an edge that bends what is behind it. Real glass is not a translucent rectangle — the refraction at the border is the part almost every implementation leaves out.',
    sections: [
      {
        title: 'Blur only, versus refracting',
        description: 'Watch the grid lines where they pass under the border.',
        bare: true,
        Content: GlassExample,
        note: motionNote('unchanged — the glass is static; only the pointer glint moves, and it follows the hand.'),
      },
      rationale(
        'Glassmorphism as usually shipped is a blur and a white border, which reads as frosted plastic and looks identical over any background.',
        'A specular rim gives it a direction of light, and an feDisplacementMap driven by a centre-flat radial gradient bends only the edge — which is exactly what glass does.',
        'A floating panel over artwork, a media overlay, a sign-in card on a photo, a HUD.',
        ['SVG filters', 'backdrop-filter', 'CSS variables'],
      ),
      {
        title: 'It needs something behind it',
        bare: true,
        Content: () => (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
            Over a flat colour this component does nothing visible, which is not a bug — glass with
            nothing behind it is a window onto a wall. `backdrop-filter` with an SVG filter is also
            the one part here without full Safari support; the blur and the rim survive, the bend
            does not.
          </Text>
        ),
      },
    ],
    props: [
      { name: 'blur', type: 'number', defaultValue: '14', description: 'Backdrop blur in pixels.' },
      { name: 'refraction', type: 'number', defaultValue: '24', description: 'How much the edge bends what is behind. 0 leaves a plain blur.' },
      { name: 'tint', type: 'string', description: 'A wash over the blur. Keep it very low — glass is not paint.' },
      { name: 'glint', type: 'boolean', defaultValue: 'true', description: 'Specular highlight following the pointer.' },
      { name: 'radius', type: 'string', defaultValue: 'var(--radius-card)', description: 'Corner radius.' },
    ],
  },

  'holo-card': {
    description:
      'A trading-card foil: tilt it and a rainbow moves across the surface. The sheen runs against the turn, because real holographic film reflects a fixed light — a gradient that tracks the pointer directly looks like a spotlight.',
    sections: [
      {
        title: 'Two cards',
        description: 'Move the pointer across each. The second has the foil at 0.85 and more tilt.',
        bare: true,
        Content: HoloExample,
        note: motionNote('the tilt and the foil both hold still; the card stays a card.'),
      },
      rationale(
        'Tilt-on-hover is everywhere and reads as a rectangle rotating. The thing that makes people turn a real card over and over is the foil, and almost nobody ships it.',
        'A conic rainbow in color-dodge plus a noise grain in overlay is the whole recipe — and inverting the sheen against the tilt is what separates hologram from spotlight.',
        'A collectible, a premium plan card, a profile card, a launch announcement.',
        ['CSS 3D transforms', 'blend modes', 'CSS variables'],
      ),
    ],
    props: [
      { name: 'tilt', type: 'number', defaultValue: '14', description: 'Maximum rotation in degrees.' },
      { name: 'foil', type: 'number', defaultValue: '0.55', description: 'Rainbow strength, 0 to 1.' },
      { name: 'sparkle', type: 'boolean', defaultValue: 'true', description: 'Facet grain. Without it the foil is smooth plastic.' },
      { name: 'lift', type: 'number', defaultValue: '14', description: 'Pixels towards the viewer on hover.' },
      { name: 'contentClassName', type: 'string', description: 'Classes for the card face — put the background here.' },
    ],
  },

  'neon-sign': {
    description:
      'Text as a neon tube, with the buzz. Three stacked glows at different radii rather than one big blur: a tight core that keeps the letterform readable, a mid halo, and a wide bloom that bleeds into the background.',
    sections: [
      {
        title: 'On and off',
        description: 'Off leaves dark glass rather than nothing — which is what makes switching it on feel like switching something on.',
        bare: true,
        Content: NeonExample,
        note: motionNote('the flicker stops and the sign burns steady. It stays perfectly readable.'),
      },
      rationale(
        'Neon done with a single large text-shadow is a smudge, and a flicker on a steady beat announces itself as a CSS animation.',
        'Three radii build a tube; a keyframe that clusters its dropouts and then holds lit for seconds is what a failing tube actually does.',
        'A hero, a 404, an empty state with personality, a launch page, a dark-mode easter egg.',
        ['text-shadow', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'color', type: 'string', defaultValue: "'#ff4fd8'", description: 'Tube colour. The glows are all derived from it.' },
      { name: 'flicker', type: 'boolean', defaultValue: 'true', description: 'The buzz. Uneven and mostly off.' },
      { name: 'off', type: 'boolean', defaultValue: 'false', description: 'Dark glass, no glow.' },
      { name: 'outline', type: 'boolean', defaultValue: 'true', description: 'Hollow tubes, as real neon is. False fills the glyphs.' },
    ],
  },

  'sticker-peel': {
    description:
      'A sticker whose corner lifts when you touch it, and comes off if you pull. The curl casts a shadow back onto the part still stuck down — without that it reads as a flat shape changing colour.',
    sections: [
      {
        title: 'Three stickers',
        description: 'Hover to lift, drag past 90px to peel. Below the threshold it springs back.',
        bare: true,
        Content: StickerExample,
        note: motionNote('the curl appears without easing; peeling still works exactly the same way.'),
      },
      rationale(
        'Delight components usually animate on hover and end there. A sticker that can only be looked at is a picture of a sticker.',
        'Making the pull a real gesture with a threshold — spring back below it, come off above — is what turns the affordance into an interaction people repeat.',
        'A reward, a dismissible promo, an onboarding badge, a playful confirmation.',
        ['CSS 3D transforms', 'pointer capture', 'clip-path'],
      ),
    ],
    props: [
      { name: 'peek / threshold', type: 'number / number', defaultValue: '26 / 90', description: 'Lift on hover, and the pull that commits.' },
      { name: 'corner', type: "'tr' | 'tl' | 'br' | 'bl'", defaultValue: "'tr'", description: 'Which corner peels.' },
      { name: 'peeled / onPeel', type: 'boolean / fn', description: 'Controlled removal, and the moment it comes off.' },
    ],
  },
}
