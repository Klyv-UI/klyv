import { useState } from 'react'
import {
  EmojiSlider,
  FlipBook,
  PixelCanvas,
  Surface,
  Terminal,
  Text,
} from 'klyvui'
import { componentCount } from '../data/catalog'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const COMMANDS = ['help', 'about', 'levels', 'theme', 'clear', 'sudo']

const PAGES = [
  <div key="p1" className="flex h-full flex-col justify-center gap-2 text-center">
    <Text size="micro" tone="faint" className="uppercase tracking-[0.25em]">
      Halogen
    </Text>
    <Text size="title">A field guide</Text>
    <Text size="caption" tone="faint">
      Turn the page
    </Text>
  </div>,
  <div key="p2" className="flex flex-col gap-2">
    <Text size="heading">One</Text>
    <Text size="caption" tone="soft" leading="normal">
      A leaf has two faces and they are not the same page. The front of leaf two is page three; its
      back is page four.
    </Text>
  </div>,
  <div key="p3" className="flex flex-col gap-2">
    <Text size="heading">Two</Text>
    <Text size="caption" tone="soft" leading="normal">
      The back face is mirrored, or its content reads backwards halfway through the turn.
    </Text>
  </div>,
  <div key="p4" className="flex flex-col gap-2">
    <Text size="heading">Three</Text>
    <Text size="caption" tone="soft" leading="normal">
      Stacking order comes from distance to the current spread, or the turning leaf slips behind the
      ones it should be covering.
    </Text>
  </div>,
  <div key="p5" className="flex flex-col gap-2">
    <Text size="heading">Four</Text>
    <Text size="caption" tone="soft" leading="normal">
      Every page is real content in DOM order, so the whole book reads top to bottom for anything
      that ignores transforms.
    </Text>
  </div>,
  <div key="p6" className="flex h-full flex-col justify-center gap-1 text-center">
    <Text size="subtitle">The end</Text>
    <Text size="caption" tone="faint">
      ✦
    </Text>
  </div>,
]

/* ----------------------------------------------------------- specimens */

function PixelExample() {
  const [filled, setFilled] = useState(0)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="items-start">
        <PixelCanvas
          grid={16}
          cell={18}
          onChange={(pixels) => setFilled(pixels.filter((index) => index !== 0).length)}
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        {filled} pixels down. Drag fast across the grid — strokes are interpolated, so a quick
        diagonal is a line rather than a row of dots. Tab into it and press space to draw without a
        pointer.
      </Text>
    </div>
  )
}

function TerminalExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <Terminal
        height={280}
        commands={COMMANDS}
        greeting={
          <>
            <span className="text-[color-mix(in_oklab,var(--color-accent)_75%,#ffffff)]">klyv</span> v1.0 —{' '}
            {componentCount}
            components, 0 dependencies.
            {'\n'}Type <span className="text-white">help</span>, or press Tab to complete.
          </>
        }
        onCommand={async (command, api) => {
          const [name, ...rest] = command.split(/\s+/)
          switch (name) {
            case 'help':
              api.print(`Commands: ${COMMANDS.join(', ')}`)
              break
            case 'about':
              api.print(`An accent-led component library. ${componentCount} components, 2 runtime deps.`)
              api.print('One accent hue drives every emphasis. Try the swatches in the header.')
              break
            case 'levels':
              api.print('12 groups: foundations, layout, navigation, actions, forms, data, charts,')
              api.print('feedback, overlays, motion, interaction, canvas & play.')
              break
            case 'theme':
              api.print(`Current accent: ${getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()}`)
              break
            case 'clear':
              api.clear()
              break
            case 'sudo':
              await new Promise((resolve) => window.setTimeout(resolve, 500))
              api.print(`${rest.join(' ') || 'nice try'}: permission denied`, 'error')
              break
            default:
              api.print(`command not found: ${name}`, 'error')
          }
        }}
      />
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Type something, press up, change your mind, press down — the half-typed draft comes back
        rather than an empty line. That is the part every fake terminal leaves out.
      </Text>
    </div>
  )
}

function RatingExample() {
  const [ease, setEase] = useState(72)
  const [docs, setDocs] = useState(40)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-5">
      <Surface variant="card" padding="lg" className="gap-6">
        <EmojiSlider label="How easy was that?" value={ease} onChange={setEase} />
        <EmojiSlider
          label="How were the docs?"
          value={docs}
          onChange={setDocs}
          faces={['💀', '😬', '🫠', '👌', '🔥']}
          words={['Nonexistent', 'Thin', 'Okay', 'Good', 'Excellent']}
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal">
        The screen reader hears the word, not the number — because “Good” is the value, and 68 is an
        implementation detail nobody rating anything cares about.
      </Text>
    </div>
  )
}

function BookExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <FlipBook pages={PAGES} label="A field guide" width={250} height={320} />
      <Text size="caption" tone="faint">
        Focus the book and use the arrow keys.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'pixel-canvas': {
    description:
      'A grid you draw on, one cell at a time. Strokes are interpolated between pointer samples — painting only the cell under each event turns a fast diagonal into a dotted line.',
    sections: [
      {
        title: 'Sixteen by sixteen',
        description: 'The art is a flat array of palette indices, not colours.',
        bare: true,
        Content: PixelExample,
        note: motionNote('unchanged — nothing here animates.'),
      },
      rationale(
        'A drawing surface is normally a canvas, which is fewer lines and completely unusable without a pointer.',
        'A grid of real buttons gets arrow keys and space for free, and storing indices rather than hex makes undo cheap, a palette swap free, and a sprite serialisable to a short string.',
        'An avatar builder, a game editor, an onboarding toy, a community feature.',
        ['Text', 'VisuallyHidden', 'pointer interpolation'],
      ),
    ],
    props: [
      { name: 'grid / cell', type: 'number / number', defaultValue: '16 / 20', description: 'Cells per side, and their rendered size.' },
      { name: 'palette', type: 'string[]', description: 'Available colours. The first entry is the eraser.' },
      { name: 'value / onChange', type: 'number[] / fn', description: 'A flat array of palette indices.' },
    ],
  },

  terminal: {
    description:
      'A terminal that behaves like one. History is the part everyone leaves out: up and down walk previous commands, and the half-typed draft is preserved — press up, change your mind, press down, and what you were writing comes back.',
    sections: [
      {
        title: 'Try it',
        description: 'help, about, levels, theme, clear — Tab completes, Ctrl+L clears, up walks back.',
        bare: true,
        Content: TerminalExample,
        note: motionNote('unchanged — the caret does not blink here either way.'),
      },
      rationale(
        'A fake terminal is a landing-page cliché and almost all of them are a text input with a monospace font, which falls apart the moment anyone presses up.',
        'A real input laid transparently under the rendered caret keeps IME, paste, selection and autocorrect working — reconstructing a caret from keystrokes breaks on every keyboard that is not US-QWERTY.',
        'A developer tool’s landing page, an admin console, a docs playground, an easter egg.',
        ['controlled input', 'command history', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'onCommand', type: '(command, api) => void | Promise<void>', description: 'Print through the api as you go, rather than returning a string.' },
      { name: 'greeting / prompt / title', type: 'ReactNode / string / string', description: 'Chrome and first line.' },
      { name: 'commands', type: 'string[]', description: 'Tab-completion candidates.' },
      { name: 'height', type: 'number', defaultValue: '320', description: 'Scrollback height.' },
    ],
  },

  'emoji-slider': {
    description:
      'A rating you drag, where the face changes as you go. The emoji is the readout — a number makes people convert a feeling into a scale and then wonder whether their 7 is the same 7 as last time.',
    sections: [
      {
        title: 'Two scales',
        description: 'The face grows as well as changing, because two similar emoji at the same size are hard to tell apart.',
        bare: true,
        Content: RatingExample,
        note: motionNote('the handle moves without easing; the face and the word are identical.'),
      },
      rationale(
        'Response rates on numeric satisfaction scales are terrible, and the reason is that answering one requires a conversion nobody wants to do.',
        'A face is compared to the feeling directly — and it is still a real slider underneath, with arrow keys and an aria-valuetext set to the word rather than the number.',
        'A feedback prompt, a post-task survey, a review, a mood log.',
        ['Text', 'ARIA slider semantics', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'number / fn', description: 'Controlled.' },
      { name: 'faces / words', type: 'string[] / string[]', description: 'Worst to best. The words are what gets announced.' },
      { name: 'min / max', type: 'number / number', defaultValue: '0 / 100', description: 'Range. The scale is split evenly between the faces.' },
      { name: 'scaleWithValue', type: 'boolean', defaultValue: 'true', description: 'Grow the emoji as it improves.' },
    ],
  },

  'flip-book': {
    description:
      'A book whose pages turn. A leaf has two faces and they are not the same page — the front of leaf two is page three, its back is page four, and the back has to be mirrored so it reads correctly once it has swung over.',
    sections: [
      {
        title: 'Six pages',
        description: 'Every leaf is rendered at once and rotated, so turning quickly does not queue.',
        bare: true,
        Content: BookExample,
        note: motionNote('pages change without the turn; the spread and the controls are unchanged.'),
      },
      rationale(
        'A page turn is the one metaphor that makes a sequence feel finite — a carousel could go on forever, a book visibly cannot.',
        'The two things that break hand-rolled versions are an unmirrored back face and a z-index taken from the leaf index rather than its distance to the current spread.',
        'A changelog, a lookbook, an onboarding story, a printed-feeling report.',
        ['CSS 3D transforms', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'pages', type: 'ReactNode[]', description: 'One node per page, rendered two at a time.' },
      { name: 'spread / onSpreadChange', type: 'number / fn', description: 'Which spread is open. Omit for uncontrolled.' },
      { name: 'width / height', type: 'number / number', defaultValue: '300 / 380', description: 'One page. The book is twice the width.' },
    ],
  },
}
