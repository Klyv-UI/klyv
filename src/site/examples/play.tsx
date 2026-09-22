import { useState } from 'react'
import {
  AchievementPop,
  Button,
  SegmentedControl,
  StreakCounter,
  Surface,
  Text,
  VibePoll,
  XPBar,
  type AchievementTier,
  type PollOption,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const OPTIONS: PollOption[] = [
  { id: 'a', emoji: '🌀', label: 'Dark mode by default', votes: 1841 },
  { id: 'b', emoji: '🔥', label: 'Keyboard shortcuts everywhere', votes: 1204 },
  { id: 'c', emoji: '🧊', label: 'Offline-first', votes: 736 },
  { id: 'd', emoji: '✨', label: 'More stickers', votes: 402 },
]

/* ----------------------------------------------------------- specimens */

function XPExample() {
  const [level, setLevel] = useState(7)
  const [xp, setXp] = useState(240)
  const needed = 400

  const gain = (amount: number) => {
    const total = xp + amount
    if (total >= needed) {
      setLevel((current) => current + 1)
      setXp(total - needed)
    } else {
      setXp(total)
    }
  }

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-4">
      <Surface variant="card" padding="lg">
        <XPBar level={level} xp={xp} needed={needed} label="Level" />
      </Surface>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => gain(60)}>
          +60 XP
        </Button>
        <Button size="sm" onClick={() => gain(220)}>
          +220 XP (overflows)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setLevel(7); setXp(240) }}>
          Reset
        </Button>
      </div>
      <Text size="caption" tone="faint" leading="normal">
        The overflow is three phases — fill to full, snap to zero with the transition off, then
        animate the remainder. Snapping with the transition on is what makes a bar sweep backwards.
      </Text>
    </div>
  )
}

function StreakExample() {
  const [state, setState] = useState<'open' | 'done' | 'broken'>('done')

  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Today"
        size="sm"
        value={state}
        onValueChange={(value) => setState(value as typeof state)}
        className="self-start"
        options={[
          { value: 'open', label: 'Not done yet' },
          { value: 'done', label: 'Banked' },
          { value: 'broken', label: 'Streak ended' },
        ]}
      />

      <Surface variant="card" padding="lg" className="items-start gap-6">
        <StreakCounter
          days={state === 'broken' ? 41 : 42}
          todayDone={state === 'done'}
          broken={state === 'broken'}
          milestone={50}
          week={[true, true, true, true, true, true, state === 'done']}
          size="lg"
        />
        <div className="flex flex-wrap items-center gap-6">
          <StreakCounter days={3} todayDone size="sm" />
          <StreakCounter days={128} todayDone milestone={150} size="md" />
        </div>
      </Surface>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        The flame only flickers once today is banked. A streak of 42 with today still open is a
        warning; the same number with today done is a reward — one figure cannot say both.
      </Text>
    </div>
  )
}

function AchievementExample() {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<AchievementTier>('gold')

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Tier"
        size="sm"
        value={tier}
        onValueChange={(value) => setTier(value as AchievementTier)}
        className="self-start"
        options={[
          { value: 'bronze', label: 'Bronze' },
          { value: 'silver', label: 'Silver' },
          { value: 'gold', label: 'Gold' },
          { value: 'mythic', label: 'Mythic' },
        ]}
      />

      <Button className="self-start" onClick={() => setOpen(true)}>
        Unlock it
      </Button>

      <AchievementPop
        open={open}
        onClose={() => setOpen(false)}
        tier={tier}
        glyph={tier === 'mythic' ? '🐉' : '★'}
        title="Thirty days in a row"
        description="You have not missed a single day this month."
      />

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        It overshoots to 1.12 and settles — an arrival that eases cleanly to 1 reads as a panel
        appearing. The shine runs after the landing, never with it.
      </Text>
    </div>
  )
}

function PollExample() {
  const [picked, setPicked] = useState<string | null>(null)
  const [options, setOptions] = useState(OPTIONS)

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <Surface variant="card" padding="lg">
        <VibePoll
          question="What should we build next?"
          options={options}
          value={picked}
          footnote="closes friday"
          onVote={(id) => {
            if (picked === id) return
            setOptions((current) =>
              current.map((option) => ({
                ...option,
                votes: option.votes + (option.id === id ? 1 : option.id === picked ? -1 : 0),
              })),
            )
            setPicked(id)
          }}
        />
      </Surface>
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={() => {
          setPicked(null)
          setOptions(OPTIONS)
        }}
      >
        Un-vote
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'xp-bar': {
    description:
      'A level, a bar, and the moment it fills. The interesting state is the overflow: a gain that crosses the end of a level has to run to full, empty, and continue — three phases, because a bar that jumps to its new fraction throws away the only satisfying frame in the component.',
    sections: [
      {
        title: 'Try the overflow',
        description: '+220 crosses the boundary from 240 of 400.',
        bare: true,
        Content: XPExample,
        note: motionNote('the bar and the sparks are still; the level and the numbers change exactly as before.'),
      },
      rationale(
        'Progress towards a level is trivial to draw and the level-up is where every implementation gets it wrong — usually with a backwards sweep as the bar unwinds to zero.',
        'Sequencing it, and turning the transition off for the snap, is a dozen lines that turn the component’s whole reason for existing from a bug into a payoff.',
        'A profile, an onboarding checklist, a learning path, a loyalty tier.',
        ['Text', 'VisuallyHidden', 'CSS keyframes', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'level / xp / needed', type: 'number', description: 'Current level, points into it, points to finish it.' },
      { name: 'onLevelUp', type: '(level: number) => void', description: 'Fires when a change carries the bar past the end.' },
      { name: 'celebrate', type: 'boolean', defaultValue: 'true', description: 'Sparks on the level-up.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Bar and badge size.' },
    ],
  },

  'streak-counter': {
    description:
      'A streak, with a flame that only burns while it is alive. The state that matters is not the number, it is whether today counts yet — a streak of 42 with today open is a warning, and the same 42 with today banked is a reward.',
    sections: [
      {
        title: 'Three states',
        description: 'A broken streak keeps its final number rather than resetting to zero.',
        bare: true,
        Content: StreakExample,
        note: motionNote('the flame holds its shape. Colour still separates alive from open from ended.'),
      },
      rationale(
        'Streak counters stop motivating people the moment they show one number, because that number cannot distinguish "you are safe" from "you have hours left".',
        'Splitting the two into flame state and copy is the whole fix — and keeping the final number after a lapse is what stops a missed day reading as a reason to leave.',
        'A habit tracker, a learning app, a fitness log, a daily challenge.',
        ['SVG', 'Text', 'VisuallyHidden', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'days / todayDone', type: 'number / boolean', description: 'The count, and whether today is banked. Both are needed.' },
      { name: 'broken', type: 'boolean', defaultValue: 'false', description: 'Streak ended. Shown cold, with the number it reached.' },
      { name: 'week', type: 'boolean[]', description: 'Last seven days as pips — shape answers "how am I doing" faster than a total.' },
      { name: 'milestone', type: 'number', description: 'Next target worth reaching.' },
    ],
  },

  'achievement-pop': {
    description:
      'The badge that drops in, shines, and leaves. It overshoots to 1.12 before settling, because an overshoot is what makes an arrival feel like an arrival — easing cleanly to 1 reads as a panel appearing.',
    sections: [
      {
        title: 'Four tiers',
        description: 'The shine runs after the landing. Overlapping them wastes both.',
        bare: true,
        Content: AchievementExample,
        note: motionNote('it appears in place, fully formed, and still leaves on its timer.'),
      },
      rationale(
        'A reward delivered as a toast is indistinguishable from an error delivered as a toast, and gets dismissed with the same reflex.',
        'A different shape, a real overshoot, and a shine that arrives after the eye has stopped tracking are what make it register as a reward — and it is still dismissible, because one that is not is a modal wearing a party hat.',
        'A milestone, a completed course, a first transaction, a launch.',
        ['Portal', 'Text', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'open / onClose', type: 'boolean / fn', description: 'Controlled. It closes itself on the timer too.' },
      { name: 'tier', type: "'bronze' | 'silver' | 'gold' | 'mythic'", defaultValue: "'gold'", description: 'Plate finish and the word above the title.' },
      { name: 'glyph', type: 'ReactNode', defaultValue: "'★'", description: 'What sits on the plate.' },
      { name: 'duration', type: 'number', defaultValue: '4200', description: 'Milliseconds before it leaves. 0 waits for a click.' },
    ],
  },

  'vibe-poll': {
    description:
      'A poll where the bars grow out of the options themselves. Results stay hidden until this person has voted — showing the split first makes most people pick the winning side, and then the result stops meaning anything.',
    sections: [
      {
        title: 'Vote, then un-vote',
        description: 'Each row is its own bar, so the label stays legible as the fill passes it.',
        bare: true,
        Content: PollExample,
        note: motionNote('the bars appear at their final length instead of growing.'),
      },
      rationale(
        'Polls are usually built as a list with a separate bar underneath, which means the label sits on a background it cannot control as the fill arrives.',
        'Making the row its own bar fixes the legibility, and hiding the split until a vote is cast is the difference between measuring an opinion and manufacturing one.',
        'A community vote, a roadmap page, a feedback widget, a changelog reaction.',
        ['Text', 'VisuallyHidden', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'options', type: 'PollOption[]', description: 'id, label, emoji, votes.' },
      { name: 'value / onVote', type: 'string | null / fn', description: 'What this person picked. Controlled.' },
      { name: 'revealBeforeVote', type: 'boolean', defaultValue: 'false', description: 'Show the split first. Off is the honest default.' },
      { name: 'footnote', type: 'string', description: 'Copy beside the vote count.' },
    ],
  },
}
