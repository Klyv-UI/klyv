import { useState } from 'react'
import {
  Button,
  Card,
  Confetti,
  FlipCard,
  KineticText,
  MagneticButton,
  Metric,
  PageTransition,
  Parallax,
  Reveal,
  RotatingWord,
  Spotlight,
  SplitFlap,
  Stagger,
  Surface,
  Text,
  TextScramble,
  TiltCard,
} from 'klyvui'
import type { ExampleModule } from './types'

function Replay({ children }: { children: (key: number) => React.ReactNode }) {
  const [key, setKey] = useState(0)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Button size="sm" variant="outline" onClick={() => setKey((value) => value + 1)}>
        Replay
      </Button>
      <div key={key} className="w-full">
        {children(key)}
      </div>
    </div>
  )
}

function RevealExample() {
  return (
    <Replay>
      {() => (
        <div className="grid w-full gap-3 sm:grid-cols-4">
          {(['up', 'down', 'left', 'right'] as const).map((direction) => (
            <Reveal key={direction} direction={direction}>
              <Surface variant="card" padding="lg" className="items-center">
                <Text size="caption" weight="bold">
                  {direction}
                </Text>
              </Surface>
            </Reveal>
          ))}
        </div>
      )}
    </Replay>
  )
}

function StaggerExample() {
  return (
    <Replay>
      {() => (
        <div className="grid w-full gap-3 sm:grid-cols-3">
          <Stagger interval={90}>
            {['Balance', 'Cashback', 'Subscriptions', 'Bills', 'Transfers', 'Rewards'].map((label) => (
              <Surface key={label} variant="card" padding="lg" className="gap-1">
                <Text size="label" tone="faint">
                  {label}
                </Text>
                <Text size="stat" tabular>
                  $1,154.00
                </Text>
              </Surface>
            ))}
          </Stagger>
        </div>
      )}
    </Replay>
  )
}

function PageTransitionExample() {
  const [route, setRoute] = useState('overview')
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        {['overview', 'activity', 'reports'].map((option) => (
          <Button
            key={option}
            size="sm"
            variant={route === option ? 'accent' : 'outline'}
            onClick={() => setRoute(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <PageTransition transitionKey={route}>
        <Card title={route} className="w-full">
          <Text size="caption" tone="faint" className="mt-2">
            This panel lifts and fades in whenever the route key changes.
          </Text>
        </Card>
      </PageTransition>
    </div>
  )
}

function PointerExample() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-3">
      <TiltCard>
        <Card className="h-[140px] justify-center">
          <Text size="caption" weight="bold">
            TiltCard
          </Text>
          <Text size="caption" tone="faint">
            Point at me
          </Text>
        </Card>
      </TiltCard>

      <Spotlight className="rounded-[var(--radius-card)]">
        <Card className="h-[140px] justify-center">
          <Text size="caption" weight="bold">
            Spotlight
          </Text>
          <Text size="caption" tone="faint">
            Move across me
          </Text>
        </Card>
      </Spotlight>

      <Card className="h-[140px] items-center justify-center">
        <MagneticButton>
          <Button variant="outline">MagneticButton</Button>
        </MagneticButton>
        <Text size="caption" tone="faint" className="mt-2">
          Approach the button
        </Text>
      </Card>
    </div>
  )
}

function FlipCardExample() {
  return (
    <div className="w-full max-w-[280px]">
      <FlipCard
        label="Card details"
        height={170}
        front={
          <Card className="h-full justify-end border-0 bg-accent">
            <Text size="caption" weight="bold" tone="accent">
              Klyv
            </Text>
            <Text size="amount" tabular tone="accent">
              **** 5199
            </Text>
          </Card>
        }
        back={
          <Card className="h-full justify-center gap-1 border-0 bg-ink">
            <Text size="caption" className="text-white/60">
              Security code
            </Text>
            <Text size="amount" tabular className="text-white">
              •••
            </Text>
            <Text size="caption" className="text-white/60">
              Valid thru 06/28
            </Text>
          </Card>
        }
      />
    </div>
  )
}

function TextExample() {
  return (
    <Replay>
      {(key) => (
        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Text size="caption" tone="faint">
              KineticText
            </Text>
            <Text size="title">
              <KineticText>Smart banking</KineticText>
            </Text>
          </div>
          <div className="flex flex-col gap-1">
            <Text size="caption" tone="faint">
              TextScramble
            </Text>
            <Text size="amount" tabular>
              <TextScramble key={key}>GBP 369.41</TextScramble>
            </Text>
          </div>
          <div className="flex flex-col gap-1">
            <Text size="caption" tone="faint">
              RotatingWord
            </Text>
            <Text size="title">
              Banking made{' '}
              <RotatingWord words={['simple.', 'faster.', 'different.']} className="text-accent-ink" />
            </Text>
          </div>
          <div className="flex flex-col gap-1">
            <Text size="caption" tone="faint">
              SplitFlap
            </Text>
            <SplitFlap key={key} size="md">
              GBP 369.41
            </SplitFlap>
          </div>
        </div>
      )}
    </Replay>
  )
}

function ConfettiExample() {
  const [firing, setFiring] = useState(false)
  return (
    <div className="relative w-full max-w-[360px]">
      <Card className="items-center gap-3 py-8">
        <Metric label="Cashback withdrawn" value="$1,154.00" className="items-center" />
        <Button
          size="sm"
          onClick={() => {
            setFiring(false)
            requestAnimationFrame(() => setFiring(true))
          }}
        >
          Celebrate
        </Button>
      </Card>
      <Confetti active={firing} />
    </div>
  )
}

const REDUCED_MOTION_NOTE =
  'It stops entirely under prefers-reduced-motion — not merely slows, which is the whole point of the preference.'

export const demos: ExampleModule = {
  reveal: {
    description:
      'Fades and slides content in as it scrolls into view, once. Content is never hidden from assistive tech while it waits, and under prefers-reduced-motion it is simply present from the start.',
    sections: [{ title: 'Directions', bare: true, Content: RevealExample }],
    props: [
      { name: 'direction', type: "'up' | 'down' | 'left' | 'right' | 'none'", defaultValue: "'up'", description: 'Where it comes from.' },
      { name: 'delay / duration', type: 'number', defaultValue: '0 / 500', description: 'Milliseconds.' },
    ],
  },

  stagger: {
    description:
      'Sequences Reveal across a list, so items arrive one after another. The delay is capped: without it a long list would still be animating seconds after it appeared, and the last rows would feel broken.',
    sections: [{ title: 'Example', bare: true, Content: StaggerExample }],
    props: [
      { name: 'interval', type: 'number', defaultValue: '60', description: 'Milliseconds between children.' },
      { name: 'maxDelay', type: 'number', defaultValue: '400', description: 'Caps the total delay.' },
      { name: 'direction / duration', type: 'RevealDirection / number', description: 'Passed to each Reveal.' },
    ],
  },

  'page-transition': {
    description:
      'Fades and lifts a route in when it changes. It transitions in only: an exit transition would mean holding the previous route on screen after navigation, which delays the new content and makes the application feel slower rather than smoother.',
    sections: [{ title: 'Example', bare: true, Content: PageTransitionExample }],
    props: [
      { name: 'transitionKey', type: 'string', description: 'Changing it replays the transition. Pass the route key.' },
      { name: 'duration', type: 'number', defaultValue: '260', description: 'Milliseconds.' },
    ],
  },

  parallax: {
    description:
      'Moves content slightly slower than the page as it scrolls, to suggest depth. Strength is capped low on purpose — heavy parallax detaches content from the scroll and is a common trigger for motion sickness.',
    sections: [
      {
        title: 'Example',
        description: 'Scroll the page with this in view.',
        bare: true,
        Content: () => (
          <Parallax strength={0.12} className="h-[180px] w-full rounded-[var(--radius-card)] bg-accent-soft/50">
            <div className="flex h-[240px] items-center justify-center">
              <Text size="title" tone="accent">
                Depth, gently
              </Text>
            </div>
          </Parallax>
        ),
        note: REDUCED_MOTION_NOTE,
      },
    ],
    props: [
      { name: 'strength', type: 'number', defaultValue: '0.15', description: 'Relative movement, 0 to 1. Clamped at 0.4.' },
    ],
  },

  spotlight: {
    description:
      'A soft highlight that follows the pointer across a surface. Purely decorative and pointer-only, so it is aria-hidden and changes nothing about the content — which is what keeps it safe on a card that is also a link.',
    sections: [{ title: 'Example', bare: true, Content: PointerExample }],
    props: [
      { name: 'radius', type: 'number', defaultValue: '220', description: 'Highlight radius in pixels.' },
      { name: 'color', type: 'string', description: 'Any CSS colour. Defaults to a soft accent wash.' },
    ],
  },

  'tilt-card': {
    description:
      'Tilts towards the pointer in three dimensions. The tilt is capped low: past a few degrees the text inside starts to distort and the card stops being readable while it is being pointed at — exactly when the reader needs it.',
    sections: [{ title: 'Example', bare: true, Content: PointerExample }],
    props: [
      { name: 'maxTilt', type: 'number', defaultValue: '6', description: 'Maximum tilt in degrees.' },
      { name: 'scale', type: 'number', defaultValue: '1.01', description: 'Lift while tilting.' },
    ],
  },

  'flip-card': {
    description:
      'Two faces on one card, with a flip between them. The trigger is a real button with aria-pressed and the hidden face is marked aria-hidden, so it is not announced twice. A fixed height is required because the faces are stacked.',
    sections: [{ title: 'Example', description: 'Click or focus and press Enter.', bare: true, Content: FlipCardExample }],
    props: [
      { name: 'front / back', type: 'ReactNode', description: 'The two faces.' },
      { name: 'label', type: 'string', description: 'Accessible name for the flip toggle.' },
      { name: 'axis', type: "'y' | 'x'", defaultValue: "'y'", description: 'Flip around the vertical or horizontal axis.' },
      { name: 'height', type: 'number', defaultValue: '200', description: 'Required, since the faces are stacked.' },
    ],
  },

  'magnetic-button': {
    description:
      'Pulls its content slightly towards the pointer as it approaches. It wraps a control rather than being one, so the button keeps its own semantics and hit area — and the drift is capped well below the control size, because a target that moves away from the pointer is worse than a static one.',
    sections: [{ title: 'Example', bare: true, Content: PointerExample }],
    props: [
      { name: 'strength', type: 'number', defaultValue: '6', description: 'Maximum drift in pixels.' },
      { name: 'radius', type: 'number', defaultValue: '60', description: 'Distance at which the pull starts.' },
    ],
  },

  'kinetic-text': {
    description:
      'Reveals a headline character by character as it scrolls into view. The whole string is exposed once through VisuallyHidden and the animated pieces are aria-hidden — otherwise a screen reader reads the line one letter at a time.',
    sections: [{ title: 'Example', bare: true, Content: TextExample }],
    props: [
      { name: 'children', type: 'string', description: 'The line to animate.' },
      { name: 'by', type: "'character' | 'word'", defaultValue: "'character'", description: 'Granularity.' },
      { name: 'interval', type: 'number', defaultValue: '28', description: 'Milliseconds between pieces.' },
    ],
  },

  'text-scramble': {
    description:
      'Settles into its text from a run of random glyphs. The real string is exposed once through VisuallyHidden while the scrambling characters are aria-hidden, so assistive tech never reads the noise.',
    sections: [{ title: 'Example', bare: true, Content: TextExample }],
    props: [
      { name: 'children', type: 'string', description: 'The final text. Changing it replays the scramble.' },
      { name: 'frame / settle', type: 'number', defaultValue: '40 / 8', description: 'Milliseconds per frame; frames before each character settles.' },
    ],
  },

  'rotating-word': {
    description:
      'Cycles a word inside a headline. The container is sized to the longest word so the surrounding line never reflows as it cycles, and each change is announced politely rather than continuously.',
    sections: [{ title: 'Example', bare: true, Content: TextExample }],
    props: [
      { name: 'words', type: 'string[]', description: 'Cycled in order.' },
      { name: 'interval', type: 'number', defaultValue: '2200', description: 'Milliseconds each word is held.' },
    ],
  },

  'split-flap': {
    description:
      'A split-flap board: each cell riffles through the alphabet until it reaches its target character. The cells are aria-hidden and the final string is exposed once, so assistive tech reads the value rather than the noise.',
    sections: [{ title: 'Example', bare: true, Content: TextExample }],
    props: [
      { name: 'children', type: 'string', description: 'The text to display. Changing it re-runs the flap.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: 'Cell size.' },
      { name: 'length', type: 'number', description: 'Pad to this many cells for a fixed-width board.' },
    ],
  },

  confetti: {
    description:
      'A one-off celebration burst, positioned over its container. It is aria-hidden and never blocks pointer events, because it carries no information — the confirmation itself must be in the copy. It renders nothing at all under prefers-reduced-motion.',
    sections: [{ title: 'Example', bare: true, Content: ConfettiExample, note: REDUCED_MOTION_NOTE }],
    props: [
      { name: 'active', type: 'boolean', description: 'Set true to fire a burst.' },
      { name: 'count', type: 'number', defaultValue: '40', description: 'Pieces. These are real elements, so keep it modest.' },
      { name: 'duration', type: 'number', defaultValue: '2200', description: 'Milliseconds before it clears itself.' },
      { name: 'colors', type: 'string[]', description: 'Defaults to the accent ramp.' },
    ],
  },
}
