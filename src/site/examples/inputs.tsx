import { useState } from 'react'
import {
  MentionInput,
  PinPad,
  ShortcutRecorder,
  Surface,
  Tag,
  Text,
  type MentionOption,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const PEOPLE: MentionOption[] = [
  { id: '1', value: 'sarah', label: 'Sarah Rosewood', hint: 'Finance' },
  { id: '2', value: 'max', label: 'Max Oduya', hint: 'Engineering' },
  { id: '3', value: 'lena', label: 'Lena Fischer', hint: 'Design' },
  { id: '4', value: 'ada', label: 'Ada Winters', hint: 'Support' },
  { id: '5', value: 'noor', label: 'Noor Haddad', hint: 'Operations' },
  { id: '6', value: 'tom', label: 'Tom Bright', hint: 'Finance' },
]

const TAKEN = [
  { parts: ['Meta', 'K'], label: 'Command palette' },
  { parts: ['Meta', 'Shift', 'E'], label: 'Export' },
]

/* ----------------------------------------------------------- specimens */

function MentionExample() {
  const [value, setValue] = useState('Nice work on the September close, ')
  const [mentioned, setMentioned] = useState<string[]>([])

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2">
      <MentionInput
        label="Add a comment"
        placeholder="Type @ to mention someone"
        value={value}
        onChange={setValue}
        options={PEOPLE}
        onMention={(option) => setMentioned((current) => [...current, option.label])}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Text size="caption" tone="faint">
          Mentioned:
        </Text>
        {mentioned.length === 0 ? (
          <Text size="caption" tone="faint">
            nobody yet — type @ and pick a name
          </Text>
        ) : (
          mentioned.map((name, index) => (
            <Tag key={`${name}-${index}`} size="sm" tone="accent">
              {name}
            </Tag>
          ))
        )}
      </div>
    </div>
  )
}

function PinExample() {
  const [state, setState] = useState<'idle' | 'accepted'>('idle')

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Surface variant="card" padding="lg" className="items-center gap-1">
        <PinPad
          label="Card PIN"
          length={4}
          hint={state === 'accepted' ? 'Unlocked' : 'The code is 1234.'}
          onComplete={async (code) => {
            await new Promise((resolve) => window.setTimeout(resolve, 400))
            const ok = code === '1234'
            setState(ok ? 'accepted' : 'idle')
            return ok
          }}
          extra={{ label: 'Forgotten code', glyph: '?', onSelect: () => undefined }}
        />
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        Focus the pad and type on the keyboard instead — digits, Backspace and Escape all land in
        the same buffer. Anything but 1234 is rejected, and the pad clears itself.
      </Text>
    </div>
  )
}

function ShortcutExample() {
  const [search, setSearch] = useState(['Meta', 'F'])
  const [send, setSend] = useState(['Meta', 'Enter'])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            Search transactions
          </Text>
          <ShortcutRecorder
            label="Search transactions"
            value={search}
            onChange={setSearch}
            taken={TAKEN}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            Send money
          </Text>
          <ShortcutRecorder label="Send money" value={send} onChange={setSend} taken={TAKEN} />
        </div>
      </div>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[66ch]">
        Try recording ⌘K — it is already taken by the command palette, and the clash is reported
        rather than silently saved. Holding a modifier on its own only previews; Escape cancels.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'mention-input': {
    description:
      'A textarea where typing @ opens a list, and choosing from it inserts a mention. The list is positioned at the caret, measured through a hidden mirror of the field — the only technique that survives wrapped lines, and the reason most implementations settle for a list pinned to the bottom.',
    sections: [
      {
        title: 'Example',
        description: 'Type @ anywhere. Arrows and Enter drive the list without focus ever leaving the text.',
        bare: true,
        Content: MentionExample,
        note: motionNote('unchanged — the list appears and disappears without a transition.'),
      },
      rationale(
        'Mentions are how a comment reaches a person, and a picker that opens under the field makes the reader lose the sentence they were writing.',
        'The mirror technique puts the list where the eye already is, and the combobox pattern keeps focus in the textarea so typing never stops.',
        'A comment box, a note on a transaction, a support reply, a task description.',
        ['Avatar', 'Surface', 'Text', 'ARIA combobox pattern'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'string / fn', description: 'The whole text. Controlled.' },
      { name: 'options', type: 'MentionOption[]', description: 'id, value inserted after the trigger, label and hint.' },
      { name: 'trigger', type: 'string', defaultValue: "'@'", description: 'Character that opens the list.' },
      { name: 'onMention', type: '(option) => void', description: 'Fires on each insertion — collect ids for the notification.' },
      { name: 'rows / placeholder', type: 'number / string', defaultValue: '4 / —', description: 'Textarea shape.' },
    ],
  },

  'pin-pad': {
    description:
      'A numeric keypad with a masked display. The pad and the physical keyboard are the same control, not two paths: digits typed while it is focused land in the same buffer, Backspace deletes and Escape clears.',
    sections: [
      {
        title: 'Example',
        description: 'The code is 1234. Anything else is rejected — the pad shakes and clears itself.',
        bare: true,
        Content: PinExample,
        note: motionNote('the shake is dropped; the message and the live-region announcement still say what happened.'),
      },
      rationale(
        'A PIN entry built as buttons alone leaves anyone on a laptop clicking at a phone keypad, and one built as a text field is wrong on the device it exists for.',
        'Making rejection the return value of `onComplete` — a boolean, or a promise of one — means the parent never has to reach back in with a ref to clear the field.',
        'Unlocking a card, confirming a transfer, an app lock screen, a step-up check.',
        ['Text', 'VisuallyHidden', 'CSS keyframes', 'status tokens'],
      ),
    ],
    props: [
      { name: 'onComplete', type: '(code) => boolean | void | Promise<…>', description: 'Return false to reject: the pad shakes, clears and refocuses.' },
      { name: 'length', type: 'number', defaultValue: '4', description: 'How many digits.' },
      { name: 'hint / errorMessage', type: 'string / string', description: 'Copy under the dots, before and after a rejection.' },
      { name: 'extra', type: '{ label, onSelect, glyph }', description: 'The bottom-left key — biometrics, "forgot", anything.' },
    ],
  },

  'shortcut-recorder': {
    description:
      'A field that records the next key combination you press. It listens on keydown and stops there — the combination people want is the one their fingers already know, and asking them to spell it introduces mistakes pressing it cannot make.',
    sections: [
      {
        title: 'Two bindings',
        description: 'Press one, then hit a combination. Try ⌘K to see a clash reported.',
        bare: true,
        Content: ShortcutExample,
        note: motionNote('unchanged — there is nothing here that moves.'),
      },
      rationale(
        'Customisable shortcuts are usually skipped because capturing one properly means swallowing every key the browser wanted, including Tab.',
        'Doing that once, with Escape as the single way out, makes the feature cheap everywhere — and checking `taken` turns a silent overwrite into something the person recording it can fix.',
        'A settings page, a power-user preferences panel, a command palette configuration.',
        ['Kbd', 'Text', 'capture-phase key listeners'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'string[] / fn', description: "Parts in order, e.g. ['Meta', 'Shift', 'K']." },
      { name: 'taken', type: '{ parts, label }[]', description: 'Existing bindings, so a clash is reported rather than saved.' },
      { name: 'requireModifier', type: 'boolean', defaultValue: 'true', description: 'Off for a single-key binding.' },
      { name: 'label', type: 'string', description: 'Which command this binds — used in the accessible name.' },
    ],
  },
}
