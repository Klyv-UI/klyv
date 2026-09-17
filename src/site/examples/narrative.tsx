import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import {
  Button,
  IconButton,
  ReactionBar,
  StackedCards,
  StoryProgress,
  Surface,
  Tag,
  Text,
  type Reaction,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const CHAPTERS = [
  {
    id: 'one',
    tag: 'One',
    title: 'Everything you spent, in one place',
    body: 'Cards, transfers and direct debits arrive on the same timeline, in the order they happened.',
  },
  {
    id: 'two',
    tag: 'Two',
    title: 'Named, not coded',
    body: 'Every line is resolved to a real merchant name before you ever see it — no reference strings.',
  },
  {
    id: 'three',
    tag: 'Three',
    title: 'Grouped by the month you care about',
    body: 'Not by the statement period your bank happens to run on.',
  },
  {
    id: 'four',
    tag: 'Four',
    title: 'And exportable, always',
    body: 'The same data, as a file, whenever you want it. No support ticket.',
  },
]

const SLIDES = [
  { title: 'You saved $1,154 this year', body: 'That is 12% more than last year, mostly from cashback on groceries.' },
  { title: 'Your biggest month was March', body: '$312 back, on a holiday you had already budgeted for.' },
  { title: 'Five subscriptions renew in June', body: 'Worth $213 a month. Two of them have not been used since March.' },
]

/* ----------------------------------------------------------- specimens */

function StackedExample() {
  const scroller = useRef<HTMLDivElement>(null)

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        ref={scroller}
        className="h-[340px] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-app p-5"
      >
        <StackedCards
          items={CHAPTERS}
          itemId={(chapter) => chapter.id}
          scrollRef={scroller}
          top={16}
          step={12}
          spacing={190}
          renderItem={(chapter) => (
            <Surface variant="card" padding="lg" className="items-start gap-2">
              <Tag size="sm" tone="accent">
                {chapter.tag}
              </Tag>
              <Text size="subtitle" className="mt-1">
                {chapter.title}
              </Text>
              <Text size="body" weight="medium" tone="soft" leading="normal">
                {chapter.body}
              </Text>
            </Surface>
          )}
        />
        <div className="h-[80px]" aria-hidden="true" />
      </div>
      <Text size="caption" tone="faint">
        Scroll inside the panel. Cards stick, and the ones underneath recede.
      </Text>
    </div>
  )
}

function StoryExample() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const slide = SLIDES[index]

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <Surface variant="card" padding="lg" className="gap-4">
        <StoryProgress
          count={SLIDES.length}
          index={index}
          onIndexChange={setIndex}
          onComplete={() => setIndex(0)}
          playing={playing}
          duration={4000}
          label="Your year in review"
        />

        <div className="flex min-h-[110px] flex-col gap-2">
          <Text size="subtitle">{slide.title}</Text>
          <Text size="body" weight="medium" tone="soft" leading="normal">
            {slide.body}
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon={ArrowLeft}
            label="Previous"
            size="sm"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          />
          <IconButton
            icon={ArrowRight}
            label="Next"
            size="sm"
            onClick={() => setIndex((value) => Math.min(SLIDES.length - 1, value + 1))}
          />
          <Button size="sm" variant="ghost" onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={13} strokeWidth={2.5} /> : <Play size={13} strokeWidth={2.5} />}
            {playing ? 'Pause' : 'Play'}
          </Button>
        </div>
      </Surface>
      <Text size="caption" tone="faint">
        Hover or focus the bar to hold it — the advance banks its remaining time rather than restarting.
      </Text>
    </div>
  )
}

function ReactionExample() {
  const [picked, setPicked] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([
    { id: 'like', emoji: '👍', label: 'Helpful', count: 24 },
    { id: 'love', emoji: '🎉', label: 'Celebrate', count: 9 },
    { id: 'think', emoji: '🤔', label: 'Not sure', count: 3 },
    { id: 'money', emoji: '💸', label: 'Costly', count: 1 },
  ])

  const change = (id: string | null) => {
    setReactions((previous) =>
      previous.map((reaction) => {
        const was = reaction.id === picked
        const now = reaction.id === id
        if (was === now) return reaction
        return { ...reaction, count: reaction.count + (now ? 1 : -1) }
      }),
    )
    setPicked(id)
  }

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <Surface variant="card" padding="lg" className="gap-2">
        <Text size="heading">September in review is ready</Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          Spending is down 8% and your cashback covered two subscriptions outright.
        </Text>
        <div className="mt-2">
          <ReactionBar
            label="React to this update"
            reactions={reactions}
            value={picked}
            onChange={change}
          />
        </div>
      </Surface>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {picked ? `You picked ${reactions.find((r) => r.id === picked)?.label}. Pick it again to take it back.` : 'Nothing picked.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'stacked-cards': {
    description:
      'Cards that stick as you scroll and pile up behind each other. Sticky positioning does the stacking on its own; a single scroll measurement per frame supplies the one thing it cannot — how many cards are now on top of this one — and each card scales and dims by that count.',
    sections: [
      {
        title: 'Example',
        description: 'Scroll inside the panel. Pass a ref for a container, or omit it to use the window.',
        bare: true,
        Content: StackedExample,
        note: motionNote('the depth scripting is skipped and the cards stack flat. Nothing disappears.'),
      },
      rationale(
        'A four-point argument laid out as four cards down a page is skimmed as one block, and each point loses the one before it.',
        'Sticking each card keeps every point on screen while the next arrives, so the argument accumulates instead of scrolling away — and the layout is CSS, so it survives without the JavaScript.',
        'A landing page argument, a feature walkthrough, an onboarding sequence, a release note.',
        ['Surface', 'sticky positioning', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'items / itemId / renderItem', type: 'T[] / fn / fn', description: 'The sequence, a stable key, and one card.' },
      { name: 'top / step', type: 'number / number', defaultValue: '24 / 14', description: 'Where the first card sticks, and how far each next one is stepped down.' },
      { name: 'spacing', type: 'number', defaultValue: '220', description: 'Scroll each card gets before the next arrives.' },
      { name: 'scrollRef', type: 'RefObject<HTMLElement>', description: 'Scroll container. Defaults to the window.' },
    ],
  },

  'story-progress': {
    description:
      'The segmented bar above a story: one segment per step, the current one filling as its time runs out. Its key is the index, which is what makes re-entering the same segment restart the fill — otherwise it sits at 100% and never runs again.',
    sections: [
      {
        title: 'Example',
        description: 'Hover the bar to hold it. The buttons drive it by hand at any point.',
        bare: true,
        Content: StoryExample,
        note: motionNote('the active segment shows full rather than filling; the sequence still advances on time.'),
      },
      rationale(
        'A timed sequence needs to show both where you are and how long is left, and a plain step counter shows only the first.',
        'Segments give position and remaining time in one object — and the pause banks its remaining time, so the bar and the advance can never drift apart.',
        'A year-in-review, an onboarding sequence, a product tour, a highlights reel.',
        ['CSS keyframes', 'usePrefersReducedMotion', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'count / index / onIndexChange', type: 'number / number / fn', description: 'Controlled position in the sequence.' },
      { name: 'duration', type: 'number', defaultValue: '5000', description: 'Milliseconds per segment. Shared by the fill and the advance.' },
      { name: 'playing', type: 'boolean', defaultValue: 'true', description: 'False hands the whole sequence to the caller.' },
      { name: 'pauseOnHover', type: 'boolean', defaultValue: 'true', description: 'Covers pointer hover and keyboard focus.' },
      { name: 'onComplete', type: '() => void', description: 'Called instead of advancing past the last segment.' },
    ],
  },

  'reaction-bar': {
    description:
      'A row of reactions with counts, and a small burst when one is picked. Picking is a toggle, not an increment: the caller owns the counts and is told which reaction this person now holds, or null when they take it back.',
    sections: [
      {
        title: 'Example',
        description: 'Pick one, then pick it again to take it back. The counts are the caller state.',
        bare: true,
        Content: ReactionExample,
        note: motionNote('no particles; the count and the pressed state change exactly as before.'),
      },
      rationale(
        'Reaction rows are usually built as increment buttons, which produces the familiar bug where a double tap leaves you holding two likes.',
        'Modelling it as a single-choice toggle makes that impossible, and the burst is additive decoration — the count changes whether or not anything animated.',
        'A shared report, a team update, a changelog entry, a comment.',
        ['Text', 'CSS keyframes', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'reactions', type: 'Reaction[]', description: 'id, emoji, label and count. The label is what is announced.' },
      { name: 'value / onChange', type: 'string | null / fn', description: 'The reaction this person holds. null means none.' },
      { name: 'particles', type: 'number', defaultValue: '7', description: 'Glyphs thrown on pick. 0 turns the burst off.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Compact rows for a dense list.' },
    ],
  },
}
