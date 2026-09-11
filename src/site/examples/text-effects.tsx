import { useRef, useState } from 'react'
import {
  GradientText,
  SegmentedControl,
  Surface,
  Text,
  TextReveal,
  Typewriter,
} from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

function TypewriterExample() {
  const [reserve, setReserve] = useState(true)

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <SegmentedControl
        label="Width behaviour"
        size="sm"
        value={reserve ? 'reserve' : 'fluid'}
        onValueChange={(value) => setReserve(value === 'reserve')}
        options={[
          { value: 'reserve', label: 'Reserve space' },
          { value: 'fluid', label: 'Let it reflow' },
        ]}
      />

      <Surface variant="tile" padding="lg" className="w-full gap-1">
        <Text as="h3" size="title" className="flex flex-wrap items-baseline gap-x-2">
          <span>Money for</span>
          <Typewriter
            reserveSpace={reserve}
            words={['freelancers.', 'families.', 'small teams.', 'everyone.']}
            label="Money for freelancers, families, small teams, everyone."
            className="text-ink"
          />
        </Text>
        <Text size="caption" tone="faint" leading="normal">
          {reserve
            ? 'The width of the longest phrase is held open, so nothing after it moves.'
            : 'Without the reservation, every keystroke reflows the line — watch the full stop.'}
        </Text>
      </Surface>
    </div>
  )
}

function TextRevealExample() {
  const scroller = useRef<HTMLDivElement>(null)

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        ref={scroller}
        className="h-[300px] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-6"
      >
        <div className="h-[180px]" aria-hidden="true" />
        <TextReveal
          scrollRef={scroller}
          as="p"
          className="max-w-[46ch] text-[22px] font-extrabold leading-[1.35] tracking-[-0.02em]"
          text="A statement should not need explaining. Every charge, every refund, every fee, in the order it happened, in words a person actually uses."
        />
        <div className="h-[220px]" aria-hidden="true" />
      </div>
      <Text size="caption" tone="faint">
        Scroll inside the panel. Scrolling back up unlights the words again.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  typewriter: {
    description:
      'Text that types itself, deletes, and moves to the next phrase. It is announced once, as static text in a hidden node, while the animated glyphs are kept out of the accessibility tree — a screen reader hearing a phrase re-announced character by character is unusable.',
    sections: [
      {
        title: 'Example',
        description: 'Switch the width behaviour to see the layout problem this normally causes.',
        bare: true,
        Content: TypewriterExample,
        note: motionNote('the first phrase is rendered in full, with no caret and no cycling.'),
      },
      rationale(
        'A hero often has to name several audiences or use cases, and a list of them reads as a list — nobody finishes it.',
        'Cycling one phrase at a time keeps the sentence short, and `reserveSpace` fixes the reflow that makes most implementations of this feel cheap.',
        'A landing hero, a sign-in panel, an empty search field suggesting what can be searched.',
        ['VisuallyHidden', 'usePrefersReducedMotion', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'words', type: 'string[]', description: 'Phrases, typed in order.' },
      { name: 'typeSpeed / deleteSpeed / pause', type: 'number', defaultValue: '62 / 32 / 1600', description: 'Milliseconds per character, and the hold on a finished phrase.' },
      { name: 'loop', type: 'boolean', defaultValue: 'true', description: 'Stop on the last phrase when false.' },
      { name: 'reserveSpace', type: 'boolean', defaultValue: 'false', description: 'Hold the width of the longest phrase open.' },
      { name: 'label', type: 'string', description: 'What a screen reader hears. Defaults to every phrase, joined.' },
    ],
  },

  'gradient-text': {
    description:
      'Text painted with a gradient that slides across it. The gradient is duplicated end to end and the background sized to 200%, so one pass lands exactly where it started — the loop has no seam and needs no reverse leg.',
    sections: [
      {
        title: 'Example',
        description: 'The glyphs are a window onto the gradient, so the text is still selectable text.',
        bare: true,
        Content: () => (
          <div className="flex w-full flex-col items-start gap-5">
            <Text as="h3" size="display">
              Spend smarter, <GradientText>every single month</GradientText>
            </Text>

            <Text as="h3" size="title">
              <GradientText
                glow
                colors={['#f5a524', 'var(--color-accent-strong)', '#7fd4ff', '#f5a524']}
                duration={7}
              >
                With a glow underneath
              </GradientText>
            </Text>

            <Text as="h3" size="title">
              <GradientText animate={false} colors={['#7fd4ff', 'var(--color-accent-strong)']}>
                Static, when the movement is not the point
              </GradientText>
            </Text>
          </div>
        ),
        note: motionNote('the gradient stops moving and stays as a static fill — the text is unaffected.'),
      },
      rationale(
        'Highlighting a phrase inside a headline usually means a second colour, and a flat second colour rarely carries enough weight against a large display size.',
        'A gradient gives the phrase presence without a new token, and `background-clip: text` means the headline is still text — selectable, searchable, read normally.',
        'A landing headline, a plan name, a figure worth celebrating, an empty state that wants to feel like an invitation.',
        ['Text', 'background-clip', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'colors', type: 'string[]', description: 'Two or more. Repeated end to end to make the loop seamless.' },
      { name: 'duration / animate', type: 'number / boolean', defaultValue: '5 / true', description: 'Seconds per pass, and whether it moves at all.' },
      { name: 'angle', type: 'number', defaultValue: '90', description: 'Sweep angle in degrees.' },
      { name: 'glow', type: 'boolean', defaultValue: 'false', description: 'A blurred duplicate underneath — for a dark or busy background.' },
      { name: 'as', type: 'ElementType', defaultValue: "'span'", description: 'Element for the text itself.' },
    ],
  },

  'text-reveal': {
    description:
      'A passage whose words light up one by one as it scrolls through the view. Unlike Reveal, which fires once at a threshold, this is scroll-linked: the reader sets the pace, and scrolling back up unlights the words again.',
    sections: [
      {
        title: 'Example',
        description: 'Scroll-linked to the panel, not the window — pass a ref to any scrolling element.',
        bare: true,
        Content: TextRevealExample,
        note: motionNote('every word is rendered lit; the passage reads as ordinary text.'),
      },
      rationale(
        'A manifesto paragraph, a mission statement or a pricing promise gets skimmed, because there is nothing to slow the eye down.',
        'Lighting the words at the reader own scroll rate paces the passage without taking control away — and it is one measurement a frame, not one per word.',
        'An about page, a manifesto section, the paragraph before a pricing table, a long-form product story.',
        ['usePrefersReducedMotion', 'requestAnimationFrame', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'The passage. Split on whitespace, so punctuation stays attached.' },
      { name: 'scrollRef', type: 'RefObject<HTMLElement>', description: 'The scrolling container. Defaults to the window.' },
      { name: 'span', type: 'number', defaultValue: '0.72', description: 'How much of the pass is spent lighting words, 0–1.' },
      { name: 'softness', type: 'number', defaultValue: '6', description: 'How many words are mid-fade at once.' },
      { name: 'as / dimClassName', type: 'ElementType / string', description: 'Element for the passage, and the unreached colour.' },
    ],
  },
}
