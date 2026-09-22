import { useState } from 'react'
import {
  Button,
  DiceRoller,
  GravityTags,
  RopeCursor,
  SegmentedControl,
  SlotReels,
  Surface,
  Text,
  type GravityTag,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const TAGS: GravityTag[] = [
  { id: '1', label: 'typescript' },
  { id: '2', label: 'canvas', color: '#8b5cf6' },
  { id: '3', label: 'web audio', color: '#22d3ee' },
  { id: '4', label: 'verlet' },
  { id: '5', label: 'svg filters', color: '#f472b6' },
  { id: '6', label: 'no dependencies' },
  { id: '7', label: 'reduced motion', color: '#10b981' },
  { id: '8', label: 'tokens' },
  { id: '9', label: 'aria', color: '#fb923c' },
  { id: '10', label: 'boids' },
  { id: '11', label: '60fps', color: '#3b82f6' },
  { id: '12', label: 'zero renders' },
]

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣']

/* ----------------------------------------------------------- specimens */

function TagsExample() {
  const [round, setRound] = useState(0)

  return (
    <div className="flex w-full flex-col gap-3">
      <GravityTags key={round} tags={TAGS} label="Things this library uses" height={300} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setRound((value) => value + 1)}>
          Drop them again
        </Button>
        <Text size="caption" tone="faint">
          Push the pile around with the pointer. Every tag is still real, selectable text.
        </Text>
      </div>
    </div>
  )
}

function RopeExample() {
  const [gravity, setGravity] = useState(0.55)

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Gravity"
        size="sm"
        value={String(gravity)}
        onValueChange={(value) => setGravity(Number(value))}
        className="self-start"
        options={[
          { value: '0', label: 'Weightless' },
          { value: '0.55', label: 'Rope' },
          { value: '1.6', label: 'Chain' },
        ]}
      />

      <div className="relative h-[300px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-[#0b0d12]">
        <div className="pointer-events-none grid h-full place-items-center">
          <Text size="title" className="text-white/30">
            move your pointer in here
          </Text>
        </div>
        <RopeCursor key={gravity} gravity={gravity} segments={30} />
      </div>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Nothing stores velocity. Each point remembers where it was, and the constraint pass that
        keeps the links the right length changes the velocity automatically — that is Verlet.
      </Text>
    </div>
  )
}

function DiceExample() {
  const [log, setLog] = useState<string | null>(null)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg">
        <DiceRoller count={3} onRoll={(values) => setLog(values.join(', '))} />
      </Surface>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {log ? `Last roll: ${log}.` : 'The result is decided before the tumble starts, not read off wherever it stops.'}
      </Text>
    </div>
  )
}

function SlotsExample() {
  const [wins, setWins] = useState(0)
  const [spins, setSpins] = useState(0)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg">
        <SlotReels
          symbols={SYMBOLS}
          reels={3}
          onSettle={(result) => {
            setSpins((value) => value + 1)
            if (result.every((entry) => entry === result[0])) setWins((value) => value + 1)
          }}
        />
      </Surface>
      <Text size="caption" tone="faint" tabular role="status" aria-live="polite">
        {spins} spins, {wins} triples. Reels stop left to right — two matching and one still going
        is the entire drama.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'gravity-tags': {
    description:
      'Tags that fall, collide, and pile up. Bodies are axis-aligned rectangles separated along whichever axis they overlap least — separating along the larger overlap makes boxes shove each other sideways when they should be stacking.',
    sections: [
      {
        title: 'Twelve tags',
        description: 'Push them around. The loop parks itself once the pile settles.',
        bare: true,
        Content: TagsExample,
        note: motionNote('unchanged in this build — the pile is the content, and it needs to land somewhere.'),
      },
      rationale(
        'A tag cloud is a list of words arranged by nothing. Giving them weight makes the same list something people push around for a while, which is the only reason anyone reads a tag cloud.',
        'Writing transforms to real elements rather than drawing on a canvas keeps every tag as selectable, searchable, announceable text — a canvas would be simpler and would turn words into a picture.',
        'An about page, a skills section, a topic filter, a footer.',
        ['VisuallyHidden', 'AABB collision', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'tags', type: 'GravityTag[]', description: 'id, label, and an optional colour.' },
      { name: 'gravity / bounce', type: 'number / number', defaultValue: '0.42 / 0.35', description: 'Downward pull, and how much speed survives a collision.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'The pointer pushes the pile.' },
      { name: 'height', type: 'number', defaultValue: '320', description: 'The floor.' },
    ],
  },

  'rope-cursor': {
    description:
      'A rope that trails the pointer and swings under its own weight. Verlet integration: each point stores where it is and where it was, and velocity is the difference — nothing stores velocity explicitly.',
    sections: [
      {
        title: 'Three weights',
        description: 'The head is pinned to the pointer, not steered towards it.',
        bare: true,
        Content: RopeExample,
        note: motionNote('the rope is not drawn at all — there is no static state worth showing.'),
      },
      rationale(
        'Cursor trails are usually a queue of past positions, which produces a shape with no physics in it: it cannot swing, settle or overshoot.',
        'Verlet gives all three for about thirty lines, and the constraint pass is simple precisely because moving a point to satisfy a distance also updates its velocity.',
        'A portfolio, a landing hero, a game menu, an interactive banner.',
        ['canvas', 'Verlet integration', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'segments / length', type: 'number / number', defaultValue: '26 / 9', description: 'Points in the rope, and the distance between them.' },
      { name: 'gravity / damping', type: 'number / number', defaultValue: '0.55 / 0.96', description: 'Weight, and how much speed survives each frame.' },
      { name: 'stiffness', type: 'number', defaultValue: '5', description: 'Constraint passes. One pass is visibly stretchy.' },
      { name: 'taper', type: 'boolean', defaultValue: 'true', description: 'Thickest at the pointer, fading to nothing at the tail.' },
    ],
  },

  'dice-roller': {
    description:
      'Dice that tumble and land on a value. The result is decided before the animation starts and the tumble is arranged to arrive at it — rolling first and reading the transform afterwards makes the outcome a function of frame timing.',
    sections: [
      {
        title: 'Three dice',
        description: 'Whole extra turns are added on top. Being multiples of 360 they cost nothing in accuracy.',
        bare: true,
        Content: DiceExample,
        note: motionNote('the dice change face without tumbling; the values and the total are identical.'),
      },
      rationale(
        'Anything with a random outcome has to be able to prove it was fair, and an outcome derived from where an animation happened to stop cannot be tested, seeded or replayed.',
        'Deciding first and animating towards it separates the two completely — the same roll can be driven by a server, a seed or a test.',
        'A game, a giveaway, a randomiser, a decision tool.',
        ['CSS 3D transforms', 'VisuallyHidden', 'Text'],
      ),
    ],
    props: [
      { name: 'count / size', type: 'number / number', defaultValue: '2 / 72', description: 'How many dice, and how big.' },
      { name: 'onRoll', type: '(values: number[]) => void', description: 'Called once they land.' },
      { name: 'duration', type: 'number', defaultValue: '1100', description: 'Milliseconds of tumbling.' },
    ],
  },

  'slot-reels': {
    description:
      'Reels that spin up, blur, and stop one after another. Each reel is a tall strip translated upwards, and landing is the strip’s final offset — the result is chosen first and the distance computed to reach it.',
    sections: [
      {
        title: 'Three reels',
        description: 'The blur is removed on the last leg — a symbol arriving sharp is a jump cut.',
        bare: true,
        Content: SlotsExample,
        note: motionNote('the reels arrive at their result without the spin; the outcome is unchanged.'),
      },
      rationale(
        'The stagger is the whole component. Three reels landing together is an animation; two matching and one still spinning is suspense, and it costs one number.',
        'Choosing the result first also means it can come from anywhere — a server, a promotion, a test — instead of from an animation nobody can control.',
        'A giveaway, a rewards page, a game, a launch stunt.',
        ['Text', 'VisuallyHidden', 'CSS transitions'],
      ),
    ],
    props: [
      { name: 'symbols', type: 'string[]', description: 'What can land. Short strings; emoji read best.' },
      { name: 'reels', type: 'number', defaultValue: '3', description: 'How many.' },
      { name: 'result', type: 'number[]', description: 'Force an outcome. Omit and it picks one at random.' },
      { name: 'duration / stagger', type: 'number / number', defaultValue: '1200 / 320', description: 'First reel, and the gap between each stop.' },
      { name: 'onSettle', type: '(result: number[]) => void', description: 'Fires once every reel has stopped.' },
    ],
  },
}
