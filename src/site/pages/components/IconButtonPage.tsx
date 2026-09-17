import { useState } from 'react'
import {
  ArrowLeftRight,
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  Home,
  Info,
  MoreVertical,
  Search,
  X,
} from 'lucide-react'
import {
  IconButton,
  StatusDot,
  Surface,
  Text,
  type IconButtonShape,
  type IconButtonSize,
  type IconButtonTone,
} from 'klyv'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, SelectControl, ToggleControl } from '../../components/Playground'

const TONES: { value: IconButtonTone; usage: string }[] = [
  { value: 'bare', usage: 'Close · overflow · eye toggle' },
  { value: 'plain', usage: 'The icon rail' },
  { value: 'muted', usage: 'Quick actions' },
  { value: 'accent', usage: 'Currency swap' },
  { value: 'white', usage: 'Carousel chevrons' },
]

const TONE_NAMES = TONES.map((tone) => tone.value)
const SIZES: IconButtonSize[] = ['xs', 'sm', 'md', 'lg']
const SHAPES: IconButtonShape[] = ['circle', 'square']

export default function IconButtonPage() {
  const [tone, setTone] = useState<IconButtonTone>('bare')
  const [size, setSize] = useState<IconButtonSize>('md')
  const [shape, setShape] = useState<IconButtonShape>('circle')
  const [selected, setSelected] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <DocPage
      name="IconButton"
      description="A square-format action carrying one glyph. Separate from Button because the label is never visible, which makes it a required prop rather than an optional one: it becomes both the accessible name and the tooltip."
      propNotes={[
            {
              name: 'icon',
              type: 'IconComponent',
              description:
                'Any component accepting size and strokeWidth — lucide-react icons satisfy this structurally, without the library importing lucide.',
            },
            {
              name: 'label',
              type: 'string',
              description: 'Required. Becomes aria-label and title.',
            },
            {
              name: 'tone',
              type: "'bare' | 'plain' | 'muted' | 'accent' | 'white'",
              defaultValue: "'bare'",
              description: 'Chrome treatment.',
            },
            {
              name: 'shape',
              type: "'circle' | 'square'",
              defaultValue: "'circle'",
              description: 'Square uses radius-tile.',
            },
            {
              name: 'size',
              type: "'xs' | 'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: '28 · 36 · 40 · 44px.',
            },
            {
              name: 'selected',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Accent treatment plus aria-pressed.',
            },
            {
              name: 'loading',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Replaces the glyph with a spinner and blocks interaction.',
            },
          ]}
    >
      <Section title="Default">
        <Preview>
          <IconButton icon={Bell} label="Notifications" />
        </Preview>
      </Section>

      <Section
        title="Tones"
        description="Five chrome treatments, one per place the design puts a glyph-only control."
      >
        <Preview background="app">
          {TONES.map(({ value, usage }) => (
            <Specimen key={value} label={value} hint={usage}>
              <IconButton icon={Search} label="Search" tone={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Shapes"
        description="Circle for floating and inline controls, square for tiles that sit in a grid or rail."
      >
        <Preview>
          {SHAPES.map((value) => (
            <Specimen key={value} label={value} hint={value === 'square' ? 'radius-tile' : 'fully round'}>
              <IconButton icon={Home} label="Home" tone="plain" shape={value} />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section title="Sizes" description="28 · 36 · 40 · 44px. The glyph scales with the box.">
        <Preview>
          {SIZES.map((value) => (
            <Specimen key={value} label={value} hint={`${{ xs: 28, sm: 36, md: 40, lg: 44 }[value]}px`}>
              <IconButton icon={MoreVertical} label="More options" size={value} tone="muted" />
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="States"
        description="Hover and focus are live. Selected applies the accent treatment and sets aria-pressed, so it doubles as a toggle."
      >
        <Preview background="app">
          <Specimen label="default">
            <IconButton icon={Eye} label="Show balance" tone="muted" />
          </Specimen>
          <Specimen label="hover" hint="muted → line-strong">
            <IconButton icon={Eye} label="Show balance" tone="muted" className="bg-line-strong" />
          </Specimen>
          <Specimen label="focus-visible" hint="Tab to this control">
            <IconButton icon={Eye} label="Show balance" tone="muted" />
          </Specimen>
          <Specimen label="selected" hint="aria-pressed=true">
            <IconButton icon={Home} label="Home" tone="plain" shape="square" selected />
          </Specimen>
          <Specimen label="disabled">
            <IconButton icon={Eye} label="Show balance" tone="muted" disabled />
          </Specimen>
          <Specimen label="loading" hint="aria-busy, non-interactive">
            <IconButton icon={Eye} label="Show balance" tone="muted" loading />
          </Specimen>
        </Preview>
        <Note>
          There is no hover-only state that conveys meaning. Anything a hover reveals is also
          reachable by keyboard, because the same rule drives <Code>:focus-visible</Code>.
        </Note>
      </Section>

      <Section title="Examples" description="The four clusters the design builds from it.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Header utility cluster
            </Text>
            <div className="flex items-center gap-0.5 rounded-full bg-white p-1 shadow-[var(--shadow-tile)]">
              <IconButton icon={Search} label="Search" size="sm" className="text-ink" />
              <span className="relative inline-flex">
                <IconButton icon={Bell} label="Notifications" size="sm" className="text-ink" />
                <StatusDot ring className="pointer-events-none absolute right-2 top-2" />
              </span>
              <IconButton icon={Info} label="Help" size="sm" className="text-ink" />
            </div>
          </Surface>

          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Icon rail
            </Text>
            <div className="flex flex-col gap-1.5">
              <IconButton icon={Home} label="Home" tone="plain" shape="square" selected />
              <IconButton icon={CreditCard} label="Cards" tone="plain" shape="square" />
            </div>
          </Surface>

          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Swap control
            </Text>
            <Surface variant="field" padding="md" className="w-full">
              <div className="flex items-center justify-between">
                <Text size="amount" tabular>
                  $ 500
                </Text>
                <IconButton
                  icon={ArrowLeftRight}
                  label="Swap currencies"
                  tone="accent"
                  className="ring-4 ring-surface"
                />
              </div>
            </Surface>
          </Surface>

          <Surface variant="card" padding="lg" className="items-start gap-3 bg-app">
            <Text size="caption" weight="semibold" tone="faint">
              Carousel chevron
            </Text>
            <IconButton icon={ChevronRight} label="Next cards" tone="white" size="lg" />
          </Surface>
        </div>
      </Section>

      <Section title="Playground">
        <Playground
          background={tone === 'white' ? 'app' : 'surface'}
          stage={
            <IconButton
              icon={X}
              label="Close"
              tone={tone}
              size={size}
              shape={shape}
              selected={selected}
              disabled={disabled}
              loading={loading}
            />
          }
          controls={
            <>
              <SelectControl label="tone" value={tone} options={TONE_NAMES} onChange={setTone} />
              <SelectControl label="size" value={size} options={SIZES} onChange={setSize} />
              <SelectControl label="shape" value={shape} options={SHAPES} onChange={setShape} />
              <ToggleControl label="selected" checked={selected} onChange={setSelected} />
              <ToggleControl label="disabled" checked={disabled} onChange={setDisabled} />
              <ToggleControl label="loading" checked={loading} onChange={setLoading} />
            </>
          }
        />
      </Section>
    </DocPage>
  )
}
