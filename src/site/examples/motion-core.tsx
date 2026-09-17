import { useEffect, useState } from 'react'
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CountUp,
  IconTile,
  Marquee,
  Odometer,
  Presence,
  PressScale,
  Ripple,
  Surface,
  Text,
  Ticker,
} from 'klyv'
import { Gamepad2, Music, Zap } from 'lucide-react'
import type { ExampleModule } from './types'

function PresenceExample() {
  const [shown, setShown] = useState(true)
  const [animation, setAnimation] = useState<'fade' | 'scale' | 'slide-up' | 'slide-right'>('scale')

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        {(['fade', 'scale', 'slide-up', 'slide-right'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={animation === option ? 'accent' : 'outline'}
            onClick={() => setAnimation(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <Button size="sm" onClick={() => setShown((previous) => !previous)}>
        {shown ? 'Unmount' : 'Mount'}
      </Button>
      <div className="flex h-[110px] items-start">
        <Presence present={shown} animation={animation} duration={220}>
          <Surface variant="card" padding="lg" className="w-[260px]">
            <Text size="heading">Cashback ready</Text>
            <Text size="caption" tone="faint" className="mt-1">
              Without Presence this would vanish instantly.
            </Text>
          </Surface>
        </Presence>
      </div>
    </div>
  )
}

function NumbersExample() {
  const [balance, setBalance] = useState(27829.83)
  const [price, setPrice] = useState(369.41)

  useEffect(() => {
    const timer = setInterval(() => {
      setPrice((previous) => {
        const drift = (Math.random() - 0.48) * 4
        return Math.max(1, Number((previous + drift).toFixed(2)))
      })
    }, 1800)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            AnimatedNumber
          </Text>
          <Text size="display">
            <AnimatedNumber
              value={balance}
              format={(next) =>
                `$${next.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            />
          </Text>
        </div>
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            Odometer
          </Text>
          <Odometer value={balance} decimals={2} prefix="$" size="lg" label="Balance" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            Ticker — updates every 1.8s
          </Text>
          <Text size="amount">
            <Ticker value={price} label="GBP rate" />
          </Text>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setBalance((value) => value + 1250.5)}>
          Add $1,250.50
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBalance((value) => Math.max(0, value - 840.25))}>
          Take $840.25
        </Button>
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        All three respect prefers-reduced-motion: the value jumps straight to its target rather than
        tweening. Every one renders with tabular figures, so the text does not jitter as digits
        change width.
      </Text>
    </div>
  )
}

function CountUpExample() {
  const [key, setKey] = useState(0)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Button size="sm" variant="outline" onClick={() => setKey((value) => value + 1)}>
        Replay
      </Button>
      <div key={key} className="grid w-full gap-3 sm:grid-cols-3">
        {[
          { label: 'Transactions', value: 1284 },
          { label: 'Cashback earned', value: 1154 },
          { label: 'Partners', value: 36 },
        ].map((stat) => (
          <Surface key={stat.label} variant="card" padding="lg" className="gap-1">
            <Text size="label" tone="faint">
              {stat.label}
            </Text>
            <Text size="title">
              <CountUp value={stat.value} />
            </Text>
          </Surface>
        ))}
      </div>
    </div>
  )
}

function InteractionExample() {
  const [count, setCount] = useState(0)
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          Ripple
        </Text>
        <Ripple className="rounded-full">
          <Button onClick={() => setCount((value) => value + 1)}>Press me</Button>
        </Ripple>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          PressScale
        </Text>
        <PressScale className="rounded-full">
          <Button variant="outline">Hold me</Button>
        </PressScale>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Text size="caption" tone="faint">
          Both
        </Text>
        <PressScale>
          <Ripple className="rounded-[var(--radius-tile)]">
            <Surface variant="tile" padding="sm" className="w-[140px] bg-surface">
              <IconTile icon={Zap} />
              <Text className="mt-2">Quick action</Text>
            </Surface>
          </Ripple>
        </PressScale>
      </div>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Pressed {count} times
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  presence: {
    description:
      'Keeps children mounted long enough to animate out. Without it, setting a flag to false removes the node instantly and the exit transition never runs — the single most common reason an exit animation "does not work".',
    sections: [
      { title: 'Animations', bare: true, Content: PresenceExample },
    ],
    props: [
      { name: 'present', type: 'boolean', description: 'Whether the content should be shown.' },
      { name: 'animation', type: "'fade' | 'scale' | 'slide-up' | 'slide-right'", defaultValue: "'fade'", description: 'Enter and exit treatment.' },
      { name: 'duration', type: 'number', defaultValue: '150', description: 'Must match the transition so the unmount is not cut short.' },
    ],
  },

  ripple: {
    description:
      'Spawns a circle at the pointer and expands it. It wraps content rather than replacing a control, so the button underneath keeps its own semantics and focus ring — which is what makes it safe to add to anything.',
    sections: [
      { title: 'Example', description: 'Press anywhere on these.', bare: true, Content: InteractionExample },
      {
        title: 'Options',
        specimens: [
          { label: 'default', node: <Ripple className="rounded-full"><Button variant="outline">Default wash</Button></Ripple> },
          { label: 'accent colour', node: <Ripple color="rgba(185, 233, 58, 0.55)" className="rounded-full"><Button variant="outline">Accent ripple</Button></Ripple> },
          { label: 'disabled', node: <Ripple disabled className="rounded-full"><Button variant="outline">No ripple</Button></Ripple> },
        ],
      },
    ],
    props: [
      { name: 'color', type: 'string', description: 'Any CSS colour. Defaults to a translucent ink wash.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Stop spawning ripples.' },
    ],
  },

  'press-scale': {
    description:
      'Shrinks slightly while held. Tactile feedback for touch, where there is no hover state to confirm that a press landed. Kept subtle on purpose — a large scale reads as a bug rather than as feedback.',
    sections: [
      { title: 'Example', bare: true, Content: InteractionExample },
      {
        title: 'Scale',
        specimens: [
          { label: 'scale={0.98}', node: <PressScale scale={0.98} className="rounded-full"><Button variant="outline">Subtle</Button></PressScale> },
          { label: 'scale={0.96}', hint: 'The default', node: <PressScale className="rounded-full"><Button variant="outline">Default</Button></PressScale> },
          { label: 'scale={0.9}', hint: 'Too much for most controls', node: <PressScale scale={0.9} className="rounded-full"><Button variant="outline">Heavy</Button></PressScale> },
        ],
      },
    ],
    props: [
      { name: 'scale', type: 'number', defaultValue: '0.96', description: 'Scale applied while pressed.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Stop responding to presses.' },
    ],
  },

  'animated-number': {
    description:
      'Tweens between two numbers with an animation frame loop. It always renders with tabular figures, so the text does not jitter as digits change width — and it jumps straight to the target under prefers-reduced-motion.',
    sections: [
      { title: 'Example', description: 'Change the balance and watch all three respond.', bare: true, Content: NumbersExample },
    ],
    props: [
      { name: 'value', type: 'number', description: 'Target. Changing it tweens from the current display value.' },
      { name: 'duration', type: 'number', defaultValue: '600', description: 'Tween length in milliseconds.' },
      { name: 'format', type: '(value: number) => string', description: 'Turn the animated value into display text.' },
    ],
  },

  'count-up': {
    description:
      'AnimatedNumber that waits until it is actually on screen before counting. A figure that has already animated off-screen is a figure the reader missed — which is why the plain AnimatedNumber is the wrong choice for stats below the fold.',
    sections: [
      { title: 'Example', description: 'These counted when they scrolled into view. Replay to see it again.', bare: true, Content: CountUpExample },
    ],
    props: [
      { name: 'value / from', type: 'number', defaultValue: '— / 0', description: 'Final and starting values.' },
      { name: 'duration', type: 'number', defaultValue: '900', description: 'Tween length.' },
      { name: 'format', type: '(value: number) => string', description: 'Display formatting.' },
    ],
  },

  odometer: {
    description:
      'Digit-roll presentation of a number. Each digit is a strip that translates to its target, so only the digits that actually changed appear to move. The strips are hidden from assistive tech and the plain value exposed instead, so a screen reader reads one number rather than ten columns.',
    sections: [
      { title: 'Example', bare: true, Content: NumbersExample },
      {
        title: 'Sizes',
        specimens: [
          { label: 'sm', node: <Odometer value={1154} size="sm" prefix="$" label="Cashback" /> },
          { label: 'md', node: <Odometer value={1154} size="md" prefix="$" label="Cashback" /> },
          { label: 'lg', node: <Odometer value={1154} decimals={2} size="lg" prefix="$" label="Cashback" /> },
        ],
      },
    ],
    props: [
      { name: 'value', type: 'number', description: 'Digits roll when it changes.' },
      { name: 'decimals', type: 'number', defaultValue: '0', description: 'Fixed decimal places.' },
      { name: 'prefix', type: 'string', description: 'Currency symbol or similar.' },
      { name: 'label', type: 'string', description: 'Accessible text; defaults to the formatted value.' },
    ],
  },

  ticker: {
    description:
      'A live value that flashes green or red in the direction it moved. The colour is transient and the arrow is decorative, so the change is also announced through a polite live region rather than by colour alone.',
    sections: [
      { title: 'Example', description: 'The rate below updates on its own every 1.8 seconds.', bare: true, Content: NumbersExample },
    ],
    props: [
      { name: 'value', type: 'number', description: 'Changing it flashes the direction of travel.' },
      { name: 'label', type: 'string', description: 'Accessible name for the figure.' },
      { name: 'format', type: '(value: number) => string', description: 'Display formatting.' },
      { name: 'flashDuration', type: 'number', defaultValue: '900', description: 'How long the directional flash lasts.' },
    ],
  },

  marquee: {
    description:
      'Infinite horizontal scroller. The content is rendered twice so the loop has no visible seam, and the duplicate is hidden from assistive tech. It stops entirely under prefers-reduced-motion — a requirement for continuous motion, not a nicety.',
    sections: [
      {
        title: 'Example',
        description: 'Hover to pause. The edges fade so items enter and leave rather than being clipped.',
        bare: true,
        Content: () => (
          <Card className="w-full gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Cashback partners
            </Text>
            <Marquee speed={26} className="w-full">
              {[
                { name: 'Mcdonalds', rate: '+10%', icon: Music },
                { name: 'Starbucks', rate: '+3%', icon: Gamepad2 },
                { name: 'GumZone', rate: '+5%', icon: Gamepad2 },
                { name: 'Water Co', rate: '+2%', icon: Zap },
                { name: 'Apple', rate: '+4%', icon: Music },
              ].map((partner) => (
                <span key={partner.name} className="mr-3 flex items-center gap-2 rounded-full border border-line px-3 py-1.5">
                  <IconTile icon={partner.icon} size="sm" />
                  <Text as="span" size="caption" weight="bold">
                    {partner.name}
                  </Text>
                  <Badge>{partner.rate}</Badge>
                </span>
              ))}
            </Marquee>
          </Card>
        ),
      },
      {
        title: 'Options',
        stack: true,
        specimens: [
          {
            label: 'fade={false}',
            hint: 'Hard edges',
            fill: true,
            node: (
              <Marquee fade={false} speed={14} className="w-full max-w-[420px] rounded-[var(--radius-tile)] border border-line py-2">
                {['USD 1.00', 'GBP 0.73', 'EUR 0.92', 'JPY 157.4'].map((rate) => (
                  <Text key={rate} as="span" size="caption" weight="bold" tabular className="mr-6">
                    {rate}
                  </Text>
                ))}
              </Marquee>
            ),
          },
          {
            label: 'pauseOnHover={false}',
            fill: true,
            node: (
              <Marquee pauseOnHover={false} speed={18} className="w-full max-w-[420px] py-2">
                {['Never pauses', 'Keeps going', 'On and on'].map((label) => (
                  <Text key={label} as="span" size="caption" weight="bold" className="mr-6">
                    {label}
                  </Text>
                ))}
              </Marquee>
            ),
          },
        ],
        note: 'Never put anything essential in a marquee. Moving text is hard to read, impossible to select reliably, and gone before a slow reader reaches it.',
      },
    ],
    props: [
      { name: 'speed', type: 'number', defaultValue: '20', description: 'Seconds for one full pass. Higher is slower.' },
      { name: 'pauseOnHover', type: 'boolean', defaultValue: 'true', description: 'Pause while the pointer is over the strip.' },
      { name: 'fade', type: 'boolean', defaultValue: 'true', description: 'Fade the leading and trailing edges.' },
    ],
  },
}
