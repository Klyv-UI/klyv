import { useRef, useState } from 'react'
import {
  Button,
  CursorAura,
  GlitchText,
  ScrollVelocity,
  SegmentedControl,
  Surface,
  Text,
} from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

function GlitchExample() {
  const [mode, setMode] = useState<'always' | 'hover'>('always')

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Trigger"
        size="sm"
        value={mode}
        onValueChange={(value) => setMode(value as typeof mode)}
        className="self-start"
        options={[
          { value: 'always', label: 'On its own' },
          { value: 'hover', label: 'On hover' },
        ]}
      />

      <div className="flex min-h-[190px] w-full flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] bg-[#0b0d12] p-8">
        <GlitchText
          onHover={mode === 'hover'}
          duration={3.4}
          className="text-[44px] font-extrabold tracking-[-0.03em] text-white"
        >
          SIGNAL LOST
        </GlitchText>
        <GlitchText
          onHover={mode === 'hover'}
          duration={5}
          colors={['#c8f24e', '#b06ab3']}
          offset={3}
          className="text-[18px] font-bold text-white/80"
        >
          reconnecting to the mainframe
        </GlitchText>
      </div>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Three copies are stacked and only one is readable — the two coloured ghosts are
        `aria-hidden`, so a screen reader hears the line once rather than three times.
      </Text>
    </div>
  )
}

function VelocityExample() {
  const scroller = useRef<HTMLDivElement>(null)

  const row = (text: string, reverse: boolean) => (
    <ScrollVelocity scrollRef={scroller} reverse={reverse} skew={7} drift={50}>
      <div className="whitespace-nowrap py-1 text-[36px] font-extrabold tracking-[-0.03em] text-ink">
        {text}
      </div>
    </ScrollVelocity>
  )

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        ref={scroller}
        className="h-[300px] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-app px-6"
      >
        <div className="py-[120px]">
          <div className="flex flex-col gap-1">
            {row('SCROLL FAST ✦ SCROLL FAST ✦', false)}
            {row('THEN STOP ✦ THEN STOP ✦', true)}
            {row('IT HAS WEIGHT ✦ IT HAS', false)}
            {row('WEIGHT ✦ IT HAS WEIGHT', true)}
          </div>
        </div>
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Flick the panel and let go. Velocity eases towards the measurement and back to zero, so a
        wheel burst reads as momentum rather than a snap.
      </Text>
    </div>
  )
}

function AuraExample() {
  const scope = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  return (
    <div className="flex w-full flex-col gap-3">
      <Button size="sm" variant="outline" className="self-start" onClick={() => setOn((v) => !v)}>
        {on ? 'Give me my cursor back' : 'Take over the cursor'}
      </Button>

      <div
        ref={scope}
        className="relative min-h-[240px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-8"
      >
        <div className="flex flex-wrap items-center gap-4">
          <Button data-aura="press it">Primary action</Button>
          <Button variant="outline" data-aura="or this one">
            Secondary
          </Button>
          <a
            href="#aura"
            data-aura="a link"
            className="rounded-full border border-line px-4 py-2 text-[13px] font-bold"
          >
            A link
          </a>
          <Surface
            variant="tile"
            padding="md"
            data-aura="not a button"
            className="w-[190px] gap-1"
          >
            <Text size="body">Any element</Text>
            <Text size="caption" tone="faint" leading="normal">
              Add data-aura and it snaps here too.
            </Text>
          </Surface>
        </div>

        <Text size="caption" tone="faint" leading="normal" className="mt-6 max-w-[52ch]">
          The aura lags behind the pointer on purpose — arriving late is what gives it mass. Over a
          target it becomes that element's rectangle and the real cursor hides.
        </Text>

        {on && <CursorAura scopeRef={scope} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'glitch-text': {
    description:
      'Text that tears into its colour channels for a few frames at a time. The keyframes spend more than ninety per cent of their time perfectly still — a continuous glitch is noise the eye tunes out in seconds.',
    sections: [
      {
        title: 'Two triggers',
        description: 'Each burst clips a different band, so it never looks like the same loop.',
        bare: true,
        Content: GlitchExample,
        note: motionNote('the ghosts sit still behind the text. It reads as a coloured shadow, nothing more.'),
      },
      rationale(
        'Glitch effects are usually built by stacking three readable copies of the text, which makes a screen reader say the line three times.',
        'Marking the ghosts `aria-hidden` costs nothing and fixes that entirely — and clustering the tears into rare bursts is what keeps the effect readable rather than exhausting.',
        'A 404, a maintenance page, a game or music landing page, a dark-mode hero.',
        ['CSS keyframes', 'clip-path', 'aria-hidden'],
      ),
    ],
    props: [
      { name: 'children', type: 'string', description: 'Plain text — the layers are copies, so it cannot be markup.' },
      { name: 'duration', type: 'number', defaultValue: '4', description: 'Seconds between bursts.' },
      { name: 'onHover', type: 'boolean', defaultValue: 'false', description: 'Only tear on hover or focus-within.' },
      { name: 'colors / offset', type: '[string, string] / number', description: 'The two channels, and how far they separate.' },
    ],
  },

  'scroll-velocity': {
    description:
      'Content that leans, skews and stretches with how fast you are scrolling. Velocity is eased towards the raw measurement rather than used directly — a wheel produces bursts separated by nothing, and mapping it straight makes the row snap and stop.',
    sections: [
      {
        title: 'Four rows, alternating',
        description: 'Flick the panel and let go. Pairing reverse rows gives the shear.',
        bare: true,
        Content: VelocityExample,
        note: motionNote('the rows never leave their resting transform; the panel just scrolls.'),
      },
      rationale(
        'Scroll-linked motion is normally a parallax offset, which says the page is deep. Velocity says the page has weight, which is a different and rarer feeling.',
        'Everything is written straight to the node in one frame loop, and the loop parks itself when the row settles — so an idle page is not holding a frame callback open.',
        'A marquee band, an editorial index, a portfolio, a long landing page.',
        ['requestAnimationFrame', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'skew / drift / squash', type: 'number', defaultValue: '6 / 40 / 0.06', description: 'The three deformations at full speed.' },
      { name: 'ceiling', type: 'number', defaultValue: '45', description: 'Pixels per frame that counts as full speed.' },
      { name: 'reverse', type: 'boolean', defaultValue: 'false', description: 'Lean the other way. Pair two rows for a shear.' },
      { name: 'scrollRef', type: 'RefObject<HTMLElement>', description: 'Scroll container. Defaults to the window.' },
    ],
  },

  'cursor-aura': {
    description:
      'A blob that follows the pointer and swallows whatever it hovers. It lags on purpose — easing a fraction of the distance each frame is what gives it mass, and a cursor that tracks exactly is just a second cursor.',
    sections: [
      {
        title: 'Scoped to one panel',
        description: 'Turn it on, then move over the buttons. Any element with data-aura works.',
        bare: true,
        Content: AuraExample,
        note: motionNote('unchanged — it follows a pointer, which is the reader moving their own hand.'),
      },
      rationale(
        'A custom cursor is the fastest way to make a site feel authored, and the fastest way to make it feel broken — most of them lag the real pointer without ever admitting the real pointer exists.',
        'Becoming the hovered element rectangle and hiding the native cursor while it does is what resolves that: there is only ever one thing on screen pretending to be the pointer.',
        'A portfolio, an agency site, a product tour, a kiosk.',
        ['requestAnimationFrame', 'blend modes', 'accent tokens'],
      ),
      {
        title: 'Not for a whole product',
        bare: true,
        Content: () => (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
            It hides the system cursor over targets, which is a real cost: people rely on the
            pointer changing shape over a text field or a resize handle. Scope it to a hero or a
            landing page rather than mounting it over an application, and never over a form.
          </Text>
        ),
      },
    ],
    props: [
      { name: 'scopeRef', type: 'RefObject<HTMLElement>', description: 'Region it lives in. Omit and it follows the document.' },
      { name: 'target', type: 'string', defaultValue: "'a, button, [data-aura]'", description: 'What it snaps to and wraps.' },
      { name: 'ease', type: 'number', defaultValue: '0.16', description: 'How quickly it catches up. Lower is heavier.' },
      { name: 'labels', type: 'boolean', defaultValue: 'true', description: 'Show the target’s data-aura text inside the blob.' },
      { name: 'invert', type: 'boolean', defaultValue: 'false', description: 'Invert what is underneath instead of tinting.' },
    ],
  },
}
