import { useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Archive,
  Bold,
  Italic,
  Trash2,
  Underline,
} from 'lucide-react'
import {
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  CopyButton,
  Countdown,
  ExpandableText,
  Field,
  InlineEdit,
  Label,
  Lightbox,
  PasswordInput,
  PasswordStrength,
  SplitButton,
  SplitPane,
  Surface,
  Text,
  ToggleGroup,
  type LightboxImage,
  type MenuItem,
} from 'klyvui'
import type { ExampleModule } from './types'

/* ------------------------------------------------------------- copy button */

function ApiKeyExample() {
  const key = 'ctr_live_8f2Kq9xL0vR4mZ7bT1sW'
  return (
    <Surface
      variant="sunken"
      padding="sm"
      className="w-full max-w-[460px] flex-row items-center justify-between gap-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
          Live key
        </Text>
        <span className="truncate font-mono text-[12px] font-semibold text-ink">{key}</span>
      </div>
      <CopyButton value={key} label="Copy key" iconOnly />
    </Surface>
  )
}

/* ------------------------------------------------------------ toggle group */

function FormattingExample() {
  const [marks, setMarks] = useState<string[]>(['bold'])
  const [align, setAlign] = useState<string[]>(['left'])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          label="Text style"
          value={marks}
          onValueChange={setMarks}
          items={[
            { value: 'bold', label: 'Bold', icon: Bold, iconOnly: true },
            { value: 'italic', label: 'Italic', icon: Italic, iconOnly: true },
            { value: 'underline', label: 'Underline', icon: Underline, iconOnly: true },
          ]}
        />
        <ToggleGroup
          label="Alignment"
          type="single"
          value={align}
          onValueChange={setAlign}
          items={[
            { value: 'left', label: 'Align left', icon: AlignLeft, iconOnly: true },
            { value: 'center', label: 'Align centre', icon: AlignCenter, iconOnly: true },
            { value: 'right', label: 'Align right', icon: AlignRight, iconOnly: true },
          ]}
        />
      </div>
      <Surface variant="sunken" padding="md">
        <Text
          size="body"
          leading="normal"
          style={{
            fontWeight: marks.includes('bold') ? 700 : 400,
            fontStyle: marks.includes('italic') ? 'italic' : 'normal',
            textDecoration: marks.includes('underline') ? 'underline' : 'none',
            textAlign: (align[0] as 'left' | 'center' | 'right' | undefined) ?? 'left',
          }}
        >
          The consignment left Rotterdam at 06:10 and is on schedule for Lyon.
        </Text>
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------ split button */

const SAVE_OPTIONS: (MenuItem | 'separator')[] = [
  { id: 'draft', label: 'Save as draft' },
  { id: 'close', label: 'Save and close' },
]

function SaveExample() {
  const [last, setLast] = useState('Nothing yet')
  return (
    <div className="flex flex-col items-start gap-3">
      <SplitButton
        onClick={() => setLast('Saved')}
        menuLabel="More save options"
        items={[
          { id: 'draft', label: 'Save as draft', onSelect: () => setLast('Saved as draft') },
          { id: 'close', label: 'Save and close', onSelect: () => setLast('Saved and closed') },
          'separator',
          { id: 'discard', label: 'Discard changes', destructive: true, onSelect: () => setLast('Discarded') },
        ]}
      >
        Save
      </SplitButton>
      <Text size="caption" tone="faint">
        Last action: <span className="font-bold text-ink">{last}</span>
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------- inline edit */

function WorkspaceExample() {
  const [name, setName] = useState('Northern corridor')
  const [owner, setOwner] = useState('')

  return (
    <Card title="Workspace" className="w-full max-w-[420px]">
      <dl className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <dt>
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
              Name
            </Text>
          </dt>
          <dd>
            <InlineEdit
              label="Workspace name"
              value={name}
              onSave={setName}
              validate={(value) =>
                !value
                  ? 'A workspace needs a name.'
                  : value.length > 40
                    ? 'Keep it under 40 characters.'
                    : undefined
              }
            />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
              Owner
            </Text>
          </dt>
          <dd>
            <InlineEdit label="Workspace owner" value={owner} onSave={setOwner} placeholder="Add an owner" />
          </dd>
        </div>
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------- password strength */

function PasswordExample() {
  const [password, setPassword] = useState('Freight2')
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-2.5">
      <Field label="New password">
        <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
      <PasswordStrength value={password} />
    </div>
  )
}

/* --------------------------------------------------------- expandable text */

const NOTE =
  'The Rotterdam to Lyon lane runs through two customs regimes and three toll networks, and the handover at Luxembourg is where most delays start. Drivers are asked to arrive at the Bettembourg yard before 05:30, when the rail slots open, because a missed slot pushes the whole consignment back by a day. If the yard is full, the fallback is the Dudelange depot, which adds forty minutes but keeps the rail connection. The customs broker is on call from 04:00, and the declaration should already be lodged by the time the truck leaves Antwerp.'

/* -------------------------------------------------------------- split pane */

const MESSAGES = [
  { from: 'Anneke de Vries', subject: 'Night shift handover', time: '06:02' },
  { from: 'Customs desk', subject: 'MF-40182 released', time: '05:47' },
  { from: 'Bettembourg yard', subject: 'Rail slot confirmed', time: '05:12' },
  { from: 'Marc Laurent', subject: 'Signed POD attached', time: 'Yesterday' },
]

function MailExample() {
  const [open, setOpen] = useState(0)
  const message = MESSAGES[open]
  return (
    <SplitPane
      label="Resize the message list"
      defaultSize={40}
      className="h-[260px] w-full rounded-[var(--radius-card)] border border-line bg-surface"
      start={
        <ul className="flex flex-col">
          {MESSAGES.map((entry, index) => (
            <li key={entry.subject}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-current={index === open || undefined}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-line px-4 py-2.5 text-left transition-colors ${index === open ? 'bg-accent-soft' : 'hover:bg-surface-muted'}`}
              >
                <Text as="span" size="caption" weight="bold" truncate>
                  {entry.from}
                </Text>
                <Text as="span" size="micro" tone="faint" truncate>
                  {entry.subject} · {entry.time}
                </Text>
              </button>
            </li>
          ))}
        </ul>
      }
      end={
        <div className="flex flex-col gap-1.5 p-4">
          <Text size="heading">{message.subject}</Text>
          <Text size="caption" tone="faint">
            From {message.from}, {message.time}
          </Text>
          <Text size="caption" tone="soft" leading="normal" className="pt-2">
            Drag the divider, or focus it and use the arrow keys. Shift moves in larger steps, and
            Home and End jump to the limits.
          </Text>
        </div>
      }
    />
  )
}

/* ---------------------------------------------------------- bulk action bar */

const FILES = [
  'Manifest - Rotterdam.pdf',
  'Customs declaration 40182.pdf',
  'Proof of delivery 40211.jpg',
  'Rate card Q3.xlsx',
]

function SelectionExample() {
  const [selected, setSelected] = useState<string[]>([FILES[1]])
  const toggle = (file: string) =>
    setSelected((current) =>
      current.includes(file) ? current.filter((entry) => entry !== file) : [...current, file],
    )

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <ul className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface">
        {FILES.map((file, index) => (
          <li key={file} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <Checkbox
              id={`bulk-file-${index}`}
              checked={selected.includes(file)}
              onChange={() => toggle(file)}
            />
            <Label htmlFor={`bulk-file-${index}`}>
              <Text as="span" size="caption" weight="semibold">
                {file}
              </Text>
            </Label>
          </li>
        ))}
      </ul>
      <BulkActionBar count={selected.length} noun="file" onClear={() => setSelected([])}>
        <Button size="sm" variant="muted">
          <Archive size={13} aria-hidden />
          Archive
        </Button>
        <Button size="sm" variant="outline">
          <Trash2 size={13} aria-hidden />
          Delete
        </Button>
      </BulkActionBar>
    </div>
  )
}

/* --------------------------------------------------------------- countdown */

function LaunchExample() {
  const [target] = useState(() => Date.now() + (2 * 86_400 + 5 * 3_600 + 42 * 60) * 1000)
  return (
    <div className="flex flex-col items-start gap-3">
      <Text size="caption" weight="semibold" tone="soft">
        Early-bird pricing ends in
      </Text>
      <Countdown to={target} label="Early-bird pricing ends" />
    </div>
  )
}

/* ---------------------------------------------------------------- lightbox */

/** Illustrations drawn as SVG, so the demo needs no network and no image files. */
const scene = (top: string, bottom: string, sun: string, hills: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/></linearGradient></defs><rect width='640' height='420' fill='url(#g)'/><circle cx='470' cy='132' r='58' fill='${sun}'/><path d='M0 318 L150 214 L270 292 L402 186 L640 314 L640 420 L0 420Z' fill='${hills}'/></svg>`,
  )}`

const PHOTOS: LightboxImage[] = [
  { src: scene('#f6dcaa', '#e8905f', '#fff4d8', '#b8643c'), alt: 'Dunes at dawn under a warm sky', caption: 'Dawn over the dunes' },
  { src: scene('#c6e6f3', '#4f8fb5', '#fdfbe8', '#2f5f7d'), alt: 'A cold lake beneath a pale sun', caption: 'Lake at noon' },
  { src: scene('#ddcdf2', '#6a5aa8', '#ffe9f2', '#463b7a'), alt: 'Violet hills at dusk', caption: 'Dusk in the hills' },
  { src: scene('#cfeac9', '#3f8a5a', '#f7ffe8', '#2a6040'), alt: 'A green valley in spring', caption: 'The valley in April' },
]

function GalleryExample() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {PHOTOS.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpen(index)}
            className="overflow-hidden rounded-[var(--radius-tile)] border border-line"
          >
            <img src={photo.src} alt={photo.alt} className="aspect-[4/3] w-full object-cover" />
          </button>
        ))}
      </div>
      <Lightbox images={PHOTOS} index={open} onIndexChange={setOpen} label="Photo viewer" />
    </>
  )
}

/* ------------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'copy-button': {
    description:
      'Puts a value on the clipboard and says so — out loud as well as on screen, because a copy glyph turning into a tick is invisible to a screen reader. The confirmation resets itself, and a clipboard that refuses (an insecure origin, a denied permission) is reported as a failure rather than faked.',
    sections: [
      {
        title: 'Variants',
        specimens: [
          { label: 'with label', node: <CopyButton value="npm i klyvui" /> },
          { label: 'iconOnly', hint: 'The label is still the name', node: <CopyButton value="npm i klyvui" label="Copy command" iconOnly /> },
          { label: 'md', node: <CopyButton value="npm i klyvui" size="md" label="Copy command" /> },
        ],
      },
      { title: 'Example', description: 'An API key with its copy action beside it.', stack: true, Content: ApiKeyExample },
    ],
  },

  'toggle-group': {
    description:
      'A row of on/off toggles, each a real button with aria-pressed. Multiple mode lets any combination be on; single mode allows at most one and lets it be switched off again — the difference from SegmentedControl, where one is always chosen.',
    sections: [
      { title: 'Example', description: 'Text style is multiple; alignment is single.', stack: true, Content: FormattingExample },
    ],
  },

  'split-button': {
    description:
      'A primary action with its alternatives one click away. It is two buttons with two names rather than one button with a hot zone, so a keyboard or screen-reader user always knows which half they are on; the menu is the library Menu, with arrow keys, Escape and outside-click.',
    sections: [
      { title: 'Example', description: 'Save, or choose another way to save.', Content: SaveExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'accent', node: <SplitButton onClick={() => {}} menuLabel="More options" items={SAVE_OPTIONS}>Save</SplitButton> },
          { label: 'muted', node: <SplitButton variant="muted" onClick={() => {}} menuLabel="More options" items={SAVE_OPTIONS}>Save</SplitButton> },
          { label: 'outline', node: <SplitButton variant="outline" onClick={() => {}} menuLabel="More options" items={SAVE_OPTIONS}>Save</SplitButton> },
          { label: 'sm', node: <SplitButton size="sm" onClick={() => {}} menuLabel="More options" items={SAVE_OPTIONS}>Save</SplitButton> },
        ],
      },
    ],
  },

  'inline-edit': {
    description:
      'A value that reads as text until someone chooses to change it. Reading mode is a button that names what it edits; editing is a labelled input where Enter saves and Escape restores, and focus returns to the text either way. A value that fails validation keeps the field open and says why.',
    sections: [
      {
        title: 'Example',
        description: 'Click a value, or tab to it and press Enter. Try saving an empty name.',
        bare: true,
        Content: WorkspaceExample,
      },
    ],
  },

  'password-strength': {
    description:
      'How strong a password is, and what would make it stronger. The score is a Meter, so it is announced as a measurement; the level word is spoken only when a rule flips, never per keystroke; and each rule says in words whether it is met.',
    sections: [
      { title: 'Example', description: 'Type to watch the rules and the level change.', stack: true, Content: PasswordExample },
      {
        title: 'Compact',
        specimens: [
          { label: 'compact', hint: 'Meter and level only', fill: true, node: <PasswordStrength value="Tr4ck!ng-Parcels" compact /> },
        ],
      },
    ],
  },

  'expandable-text': {
    description:
      'Long text clamped to a few lines, with a toggle to read the rest. The toggle appears only when the text is actually clamped — a "Show more" that reveals nothing is a broken promise — and the full text stays in the DOM throughout, so find-in-page still reaches it.',
    sections: [
      {
        title: 'Clamped',
        stack: true,
        Content: () => (
          <ExpandableText lines={3} className="max-w-[560px]">
            <Text size="body" tone="soft" leading="normal">
              {NOTE}
            </Text>
          </ExpandableText>
        ),
      },
      {
        title: 'Short text gets no toggle',
        stack: true,
        Content: () => (
          <ExpandableText lines={3} className="max-w-[560px]">
            <Text size="body" tone="soft" leading="normal">
              Bettembourg yard, gate 4. Arrive before 05:30.
            </Text>
          </ExpandableText>
        ),
      },
    ],
  },

  'split-pane': {
    description:
      'Two panes and a divider between them. The divider is a focusable separator with a value, so it is announced with its position and moves with the arrow keys; while dragging, the size is written to a custom property rather than React state, so a drag is not a render per pointer event.',
    sections: [
      { title: 'Horizontal', stack: true, Content: MailExample },
      {
        title: 'Vertical',
        stack: true,
        Content: () => (
          <SplitPane
            orientation="vertical"
            label="Resize the console"
            defaultSize={62}
            className="h-[220px] w-full rounded-[var(--radius-card)] border border-line bg-surface"
            start={<div className="p-4"><Text size="caption" tone="soft">Editor</Text></div>}
            end={<div className="p-4"><Text size="caption" tone="soft">Console</Text></div>}
          />
        ),
      },
    ],
  },

  'bulk-action-bar': {
    description:
      'The bar that appears once items are selected: how many, what can be done to them, and a way out. The count is announced through a live region that stays mounted while the bar is hidden, and the actions are grouped under a name that includes the selection.',
    sections: [
      { title: 'Example', description: 'Tick some files. Clear drops the selection.', stack: true, Content: SelectionExample },
    ],
  },

  countdown: {
    description:
      'Time remaining until a moment, in tiles. It is a timer, not a live region — a region that speaks every second makes a page unusable with a screen reader — and its label spells the remaining time out in words for whoever reads it. The tick is aligned to the wall-clock second.',
    sections: [
      { title: 'Example', Content: LaunchExample },
      {
        title: 'Variants',
        specimens: [
          { label: 'sm, three units', node: <Countdown to={Date.now() + 4 * 3_600_000} units={['hours', 'minutes', 'seconds']} size="sm" label="Cut-off" /> },
          { label: 'ended', hint: 'Past dates settle at zero', node: <Countdown to={Date.now() - 60_000} units={['minutes', 'seconds']} size="sm" label="Offer" /> },
        ],
      },
    ],
  },

  lightbox: {
    description:
      'Full-screen images, one at a time. It is built the way Modal is — Portal, FocusTrap, scroll lock, Escape and backdrop — so it behaves like every other overlay; the arrow keys, Home, End and a swipe move between images, and the position is announced as it changes.',
    sections: [
      { title: 'Example', description: 'Open any image, then use the arrow keys.', stack: true, Content: GalleryExample },
    ],
  },
}
