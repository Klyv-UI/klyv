import type { CSSProperties, ReactNode } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  CopyButton,
  Divider,
  EmptyState,
  Field,
  InlineMessage,
  Input,
  Kbd,
  Meter,
  Metric,
  PageHeader,
  PasswordInput,
  Progress,
  ProgressRing,
  Rating,
  SectionHeading,
  Skeleton,
  Spinner,
  StatCard,
  StatusDot,
  Surface,
  Switch,
  Tag,
  Text,
  Textarea,
  type AlertTone,
  type AvatarSize,
  type BadgeTone,
  type BannerTone,
  type ButtonSize,
  type ButtonVariant,
  type CheckboxSize,
  type ChipSize,
  type EmptyStateSize,
  type InlineMessageTone,
  type InputSize,
  type MeterVariant,
  type MetricSize,
  type MetricTrend,
  type ProgressRingSize,
  type ProgressSize,
  type RatingSize,
  type SpinnerSize,
  type StatusDotSize,
  type StatusDotTone,
  type SurfacePadding,
  type SurfaceVariant,
  type SwitchSize,
  type TagSize,
  type TagTone,
  type TextSize,
  type TextTone,
  type TextWeight,
} from 'klyv'
import { findBlock } from '../data/blocks'
import { attr, element, styleAttr, text } from './jsx'
import { newNodeId, type ComponentNode, type ComposerNode, type PropValue } from './model'
import type { ComposableName } from './registry'

/**
 * What the Composer knows about each component it can place: the props worth
 * exposing, how to render it on the canvas, and how to print it.
 *
 * The props are chosen, not generated. The API tables list every prop a type
 * declares — 1,700 of them — and most are callbacks, refs and escape hatches
 * that mean nothing in a visual editor. These are the ones a person changes
 * when they are deciding what a screen looks like. Every option list is the
 * component's own union, imported as a type, so a renamed variant fails the
 * build here instead of silently rendering nothing.
 *
 * `default` is the component's own default: a value equal to it is left out of
 * the generated code, exactly as a person would leave it out. `initial` is
 * what a freshly placed instance starts with, where an empty one would be
 * useless on a canvas.
 */
export type Props = Record<string, PropValue>

interface SpecBase {
  name: string
  label: string
  default?: PropValue
  initial?: PropValue
}

export type PropSpec = SpecBase &
  (
    | { kind: 'text' }
    | { kind: 'select'; options: readonly string[] }
    | { kind: 'boolean' }
    | { kind: 'number'; min: number; max: number }
  )

export interface Definition {
  description?: string
  props: PropSpec[]
  /** The prop printed as the element's children rather than as an attribute. */
  textChild?: string
  /** Children a fresh instance starts with. */
  seed?: () => ComposerNode[]
  render: (props: Props, children: ReactNode) => ReactNode
  /** The printed form, when it is not `<Name {...props}>children</Name>`. */
  code?: (props: Props, attrs: string[], children: string[]) => string[]
  /** Other library components the printed form uses. */
  imports?: string[]
}

/* ------------------------------------------------------------- prop helpers */

const s = (props: Props, key: string) => String(props[key] ?? '')
const b = (props: Props, key: string) => props[key] === true
const n = (props: Props, key: string) => Number(props[key] ?? 0)
/** An optional string: empty and "auto" both mean "leave it to the component". */
const o = (props: Props, key: string) => {
  const value = s(props, key)
  return value === '' || value === 'auto' ? undefined : value
}

const text_ = (name: string, label: string, extra: Partial<SpecBase> = {}): PropSpec => ({ name, label, kind: 'text', ...extra })
const select = (name: string, label: string, options: readonly string[], extra: Partial<SpecBase> = {}): PropSpec => ({
  name,
  label,
  kind: 'select',
  options,
  ...extra,
})
const bool = (name: string, label: string, extra: Partial<SpecBase> = {}): PropSpec => ({ name, label, kind: 'boolean', default: false, ...extra })
const num = (name: string, label: string, min: number, max: number, extra: Partial<SpecBase> = {}): PropSpec => ({
  name,
  label,
  kind: 'number',
  min,
  max,
  ...extra,
})

const BUTTON_VARIANTS: readonly ButtonVariant[] = ['accent', 'muted', 'outline', 'white', 'ghost']
const TWO_SIZES = ['sm', 'md'] as const
const THREE_SIZES = ['sm', 'md', 'lg'] as const
const TEXT_SIZES: readonly TextSize[] = ['display', 'title', 'amount', 'subtitle', 'heading', 'stat', 'body', 'label', 'caption', 'micro']
/** accent-ink and inverse are left out: both are for text on a fill, and read as nothing on a page. */
const TEXT_TONES: readonly TextTone[] = ['default', 'soft', 'faint', 'accent', 'success', 'danger']
const TEXT_WEIGHTS = ['auto', 'medium', 'semibold', 'bold', 'extrabold'] as const
const ALERT_TONES: readonly AlertTone[] = ['neutral', 'accent', 'success', 'warning', 'danger']
const STATUS_TONES: readonly StatusDotTone[] = ['accent', 'success', 'warning', 'danger', 'neutral']
const TRENDS: readonly MetricTrend[] = ['up', 'down', 'flat']
const GAPS = ['4', '8', '12', '16', '24', '32'] as const

const ALIGN: Record<string, CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}
const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

function columnStyle(props: Props): CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: n(props, 'gap'), alignItems: ALIGN[s(props, 'align')] }
}

function rowStyle(props: Props): CSSProperties {
  return {
    display: 'flex',
    flexWrap: b(props, 'wrap') ? 'wrap' : 'nowrap',
    gap: n(props, 'gap'),
    alignItems: ALIGN[s(props, 'align')],
    justifyContent: JUSTIFY[s(props, 'justify')],
  }
}

/** Only what differs from a plain flex box goes into the printed style. */
function printedStyle(style: CSSProperties, defaults: CSSProperties): string {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(style)) {
    if (key === 'display' || key === 'flexDirection' || defaults[key as keyof CSSProperties] !== value) {
      out[key] = value as string | number
    }
  }
  return styleAttr(out)
}

/** A control that has no label prop of its own, printed inside a real label. */
function labelled(control: string[], label: string, props: Props, trailing: boolean): string[] {
  const caption = element('Text', [attr('as', 'span'), attr('size', 'label'), attr('weight', 'semibold')], [text(s(props, 'label'))])
  const style = trailing
    ? "style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}"
    : "style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}"
  void label
  return element('label', [style], trailing ? [...caption, ...control] : [...control, ...caption])
}

/* -------------------------------------------------------------- definitions */

export const definitions: Record<ComposableName, Definition> = {
  Column: {
    description: 'A vertical stack. Printed as a plain div, so it works with or without Tailwind.',
    props: [
      select('gap', 'Gap', GAPS, { initial: '12' }),
      select('align', 'Align', ['stretch', 'start', 'center', 'end'], { default: 'stretch' }),
    ],
    render: (props, children) => <div style={columnStyle(props)}>{children}</div>,
    code: (props, _attrs, children) =>
      element('div', [printedStyle(columnStyle(props), { alignItems: 'stretch' })], children),
  },
  Row: {
    description: 'A horizontal row that wraps. Printed as a plain div, so it works with or without Tailwind.',
    props: [
      select('gap', 'Gap', GAPS, { initial: '12' }),
      select('align', 'Align', ['center', 'start', 'end', 'stretch', 'baseline'], { default: 'center' }),
      select('justify', 'Justify', ['start', 'center', 'end', 'between'], { default: 'start' }),
      bool('wrap', 'Wrap', { default: true }),
    ],
    render: (props, children) => <div style={rowStyle(props)}>{children}</div>,
    code: (props, _attrs, children) =>
      element(
        'div',
        [printedStyle(rowStyle(props), { flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' })],
        children,
      ),
  },
  Card: {
    props: [
      text_('title', 'Title', { default: '', initial: 'Card title' }),
      select('headingLevel', 'Heading level', ['h2', 'h3', 'h4'], { default: 'h2' }),
      bool('padded', 'Padded', { default: true }),
    ],
    render: (props, children) => (
      <Card title={o(props, 'title')} headingLevel={s(props, 'headingLevel') as 'h2' | 'h3' | 'h4'} padded={b(props, 'padded')}>
        {children}
      </Card>
    ),
  },
  Surface: {
    props: [
      select('variant', 'Variant', ['card', 'tile', 'field', 'sunken', 'floating'] satisfies SurfaceVariant[], { default: 'card' }),
      select('padding', 'Padding', ['none', 'sm', 'md', 'lg'] satisfies SurfacePadding[], { default: 'none', initial: 'lg' }),
    ],
    render: (props, children) => (
      <Surface variant={s(props, 'variant') as SurfaceVariant} padding={s(props, 'padding') as SurfacePadding}>
        {children}
      </Surface>
    ),
  },
  Text: {
    textChild: 'children',
    props: [
      text_('children', 'Text', { initial: 'The quick brown fox' }),
      select('size', 'Size', TEXT_SIZES, { default: 'body' }),
      select('weight', 'Weight', TEXT_WEIGHTS, { default: 'auto' }),
      select('tone', 'Tone', TEXT_TONES, { default: 'default' }),
      bool('truncate', 'Truncate'),
    ],
    render: (props) => (
      <Text
        size={s(props, 'size') as TextSize}
        weight={o(props, 'weight') as TextWeight | undefined}
        tone={s(props, 'tone') as TextTone}
        truncate={b(props, 'truncate')}
      >
        {s(props, 'children')}
      </Text>
    ),
  },
  PageHeader: {
    props: [
      text_('title', 'Title', { initial: 'Settings' }),
      text_('description', 'Description', { default: '', initial: 'Manage your workspace and the people in it.' }),
      select('headingLevel', 'Heading level', ['h1', 'h2'], { default: 'h1' }),
    ],
    render: (props) => (
      <PageHeader title={s(props, 'title')} description={o(props, 'description')} headingLevel={s(props, 'headingLevel') as 'h1' | 'h2'} />
    ),
  },
  SectionHeading: {
    props: [
      text_('eyebrow', 'Eyebrow', { default: '', initial: 'Pricing' }),
      text_('title', 'Title', { initial: 'Simple, honest pricing' }),
      text_('description', 'Description', { default: '', initial: 'Start free. Upgrade when your team does.' }),
      select('align', 'Align', ['center', 'start'], { default: 'center' }),
    ],
    render: (props) => (
      <SectionHeading
        eyebrow={o(props, 'eyebrow')}
        title={s(props, 'title')}
        description={o(props, 'description')}
        align={s(props, 'align') as 'center' | 'start'}
      />
    ),
  },
  Divider: {
    props: [select('orientation', 'Orientation', ['horizontal', 'vertical'], { default: 'horizontal' })],
    render: (props) => <Divider orientation={s(props, 'orientation') as 'horizontal' | 'vertical'} />,
  },
  Badge: {
    textChild: 'children',
    props: [text_('children', 'Text', { initial: 'New' }), select('tone', 'Tone', ['accent', 'neutral'] satisfies BadgeTone[], { default: 'accent' })],
    render: (props) => <Badge tone={s(props, 'tone') as BadgeTone}>{s(props, 'children')}</Badge>,
  },
  Tag: {
    textChild: 'children',
    props: [
      text_('children', 'Text', { initial: 'Beta' }),
      select('tone', 'Tone', ['neutral', 'outline', 'accent'] satisfies TagTone[], { default: 'neutral' }),
      select('size', 'Size', TWO_SIZES satisfies readonly TagSize[], { default: 'md' }),
    ],
    render: (props) => (
      <Tag tone={s(props, 'tone') as TagTone} size={s(props, 'size') as TagSize}>
        {s(props, 'children')}
      </Tag>
    ),
  },
  Chip: {
    props: [
      text_('label', 'Label', { initial: 'Design' }),
      select('size', 'Size', TWO_SIZES satisfies readonly ChipSize[], { default: 'md' }),
      bool('selected', 'Selected'),
    ],
    render: (props) => <Chip label={s(props, 'label')} size={s(props, 'size') as ChipSize} selected={b(props, 'selected')} />,
  },
  Kbd: {
    textChild: 'children',
    props: [text_('children', 'Key', { initial: '⌘K' })],
    render: (props) => <Kbd>{s(props, 'children')}</Kbd>,
  },
  Avatar: {
    props: [
      text_('name', 'Name', { initial: 'Ada Lovelace' }),
      select('size', 'Size', ['xs', 'sm', 'md', 'lg'] satisfies AvatarSize[], { default: 'sm' }),
      bool('ring', 'Ring'),
    ],
    render: (props) => <Avatar name={s(props, 'name')} size={s(props, 'size') as AvatarSize} ring={b(props, 'ring')} />,
  },
  Button: {
    textChild: 'children',
    props: [
      text_('children', 'Text', { initial: 'Get started' }),
      select('variant', 'Variant', BUTTON_VARIANTS, { default: 'accent' }),
      select('size', 'Size', TWO_SIZES satisfies readonly ButtonSize[], { default: 'md' }),
      bool('disabled', 'Disabled'),
      bool('loading', 'Loading'),
      bool('fullWidth', 'Full width'),
    ],
    render: (props) => (
      <Button
        variant={s(props, 'variant') as ButtonVariant}
        size={s(props, 'size') as ButtonSize}
        disabled={b(props, 'disabled')}
        loading={b(props, 'loading')}
        fullWidth={b(props, 'fullWidth')}
      >
        {s(props, 'children')}
      </Button>
    ),
  },
  CopyButton: {
    props: [
      text_('value', 'Value to copy', { initial: 'npm install klyv' }),
      text_('label', 'Label', { default: 'Copy' }),
      select('size', 'Size', TWO_SIZES satisfies readonly ButtonSize[], { default: 'sm' }),
      bool('iconOnly', 'Icon only'),
    ],
    render: (props) => (
      <CopyButton value={s(props, 'value')} label={s(props, 'label')} size={s(props, 'size') as ButtonSize} iconOnly={b(props, 'iconOnly')} />
    ),
  },
  Field: {
    props: [
      text_('label', 'Label', { initial: 'Email' }),
      text_('hint', 'Hint', { default: '' }),
      text_('error', 'Error', { default: '' }),
      bool('required', 'Required'),
      bool('hideLabel', 'Hide label'),
    ],
    seed: () => [createNode('Input')],
    render: (props, children) => (
      <Field
        label={s(props, 'label')}
        hint={o(props, 'hint')}
        error={o(props, 'error')}
        required={b(props, 'required')}
        hideLabel={b(props, 'hideLabel')}
      >
        {children}
      </Field>
    ),
  },
  Input: {
    props: [
      text_('placeholder', 'Placeholder', { default: '', initial: 'you@example.com' }),
      select('type', 'Type', ['text', 'email', 'url', 'search', 'tel', 'number'], { default: 'text', initial: 'email' }),
      select('inputSize', 'Size', TWO_SIZES satisfies readonly InputSize[], { default: 'md' }),
      bool('disabled', 'Disabled'),
      bool('invalid', 'Invalid'),
    ],
    render: (props) => (
      <Input
        placeholder={o(props, 'placeholder')}
        type={s(props, 'type')}
        inputSize={s(props, 'inputSize') as InputSize}
        disabled={b(props, 'disabled')}
        invalid={b(props, 'invalid')}
      />
    ),
  },
  PasswordInput: {
    props: [
      text_('placeholder', 'Placeholder', { default: '' }),
      select('inputSize', 'Size', TWO_SIZES satisfies readonly InputSize[], { default: 'md' }),
      bool('revealable', 'Revealable', { default: true }),
    ],
    render: (props) => (
      <PasswordInput placeholder={o(props, 'placeholder')} inputSize={s(props, 'inputSize') as InputSize} revealable={b(props, 'revealable')} />
    ),
  },
  Textarea: {
    props: [
      text_('placeholder', 'Placeholder', { default: '', initial: 'Tell us a little more' }),
      num('rows', 'Rows', 2, 12, { initial: 4 }),
      select('resize', 'Resize', ['vertical', 'none'], { default: 'vertical' }),
      bool('disabled', 'Disabled'),
      bool('invalid', 'Invalid'),
    ],
    render: (props) => (
      <Textarea
        placeholder={o(props, 'placeholder')}
        rows={n(props, 'rows')}
        resize={s(props, 'resize') as 'vertical' | 'none'}
        disabled={b(props, 'disabled')}
        invalid={b(props, 'invalid')}
      />
    ),
  },
  Checkbox: {
    description: 'A checkbox inside its label, so the words are part of the target.',
    props: [
      text_('label', 'Label', { initial: 'Remember me' }),
      bool('defaultChecked', 'Checked'),
      select('boxSize', 'Size', TWO_SIZES satisfies readonly CheckboxSize[], { default: 'md' }),
      bool('disabled', 'Disabled'),
    ],
    imports: ['Text'],
    render: (props) => (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Checkbox
          key={String(props.defaultChecked)}
          defaultChecked={b(props, 'defaultChecked')}
          boxSize={s(props, 'boxSize') as CheckboxSize}
          disabled={b(props, 'disabled')}
        />
        <Text as="span" size="label" weight="semibold">
          {s(props, 'label')}
        </Text>
      </label>
    ),
    code: (props, attrs) => labelled(element('Checkbox', attrs.filter((line) => !line.startsWith('label='))), 'label', props, false),
  },
  Switch: {
    description: 'A switch beside its label, both inside one label element.',
    props: [
      text_('label', 'Label', { initial: 'Email notifications' }),
      bool('defaultChecked', 'On', { initial: true }),
      select('switchSize', 'Size', TWO_SIZES satisfies readonly SwitchSize[], { default: 'md' }),
      bool('disabled', 'Disabled'),
    ],
    imports: ['Text'],
    render: (props) => (
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text as="span" size="label" weight="semibold">
          {s(props, 'label')}
        </Text>
        <Switch
          key={String(props.defaultChecked)}
          defaultChecked={b(props, 'defaultChecked')}
          switchSize={s(props, 'switchSize') as SwitchSize}
          disabled={b(props, 'disabled')}
        />
      </label>
    ),
    code: (props, attrs) => labelled(element('Switch', attrs.filter((line) => !line.startsWith('label='))), 'label', props, true),
  },
  Rating: {
    props: [
      text_('label', 'Accessible name', { initial: 'Rating' }),
      num('value', 'Value', 0, 10, { initial: 4 }),
      num('max', 'Out of', 3, 10, { default: 5 }),
      select('size', 'Size', THREE_SIZES satisfies readonly RatingSize[], { default: 'md' }),
      bool('readOnly', 'Read only', { initial: true }),
    ],
    render: (props) => (
      <Rating
        label={s(props, 'label')}
        value={Math.min(n(props, 'value'), n(props, 'max'))}
        max={n(props, 'max')}
        size={s(props, 'size') as RatingSize}
        readOnly={b(props, 'readOnly')}
      />
    ),
  },
  StatCard: {
    props: [
      text_('title', 'Title', { initial: 'Revenue' }),
      text_('value', 'Value', { initial: '$48,210' }),
      text_('caption', 'Caption', { default: '', initial: 'vs last month' }),
      text_('delta', 'Delta', { default: '', initial: '+12%' }),
      select('trend', 'Trend', TRENDS, { initial: 'up' }),
    ],
    render: (props) => (
      <StatCard
        title={s(props, 'title')}
        value={s(props, 'value')}
        caption={o(props, 'caption')}
        delta={o(props, 'delta')}
        trend={s(props, 'trend') as MetricTrend}
      />
    ),
  },
  Metric: {
    props: [
      text_('label', 'Label', { default: '', initial: 'Active users' }),
      text_('value', 'Value', { initial: '3,904' }),
      text_('delta', 'Delta', { default: '', initial: '+4%' }),
      select('trend', 'Trend', TRENDS, { default: 'flat', initial: 'up' }),
      select('size', 'Size', THREE_SIZES satisfies readonly MetricSize[], { default: 'md' }),
    ],
    render: (props) => (
      <Metric
        label={o(props, 'label')}
        value={s(props, 'value')}
        delta={o(props, 'delta')}
        trend={s(props, 'trend') as MetricTrend}
        size={s(props, 'size') as MetricSize}
      />
    ),
  },
  Progress: {
    props: [
      text_('label', 'Accessible name', { initial: 'Upload progress' }),
      num('value', 'Value', 0, 100, { default: 0, initial: 64 }),
      select('size', 'Size', TWO_SIZES satisfies readonly ProgressSize[], { default: 'md' }),
      bool('indeterminate', 'Indeterminate'),
    ],
    render: (props) => (
      <Progress
        label={s(props, 'label')}
        value={n(props, 'value')}
        size={s(props, 'size') as ProgressSize}
        indeterminate={b(props, 'indeterminate')}
      />
    ),
  },
  ProgressRing: {
    props: [
      text_('label', 'Accessible name', { initial: 'Storage used' }),
      num('value', 'Value', 0, 100, { default: 0, initial: 72 }),
      select('size', 'Size', THREE_SIZES satisfies readonly ProgressRingSize[], { default: 'md' }),
    ],
    render: (props) => <ProgressRing label={s(props, 'label')} value={n(props, 'value')} size={s(props, 'size') as ProgressRingSize} />,
  },
  Meter: {
    props: [
      text_('label', 'Accessible name', { initial: 'Steps done' }),
      num('value', 'Filled', 0, 12, { initial: 3 }),
      num('total', 'Total', 1, 12, { initial: 6 }),
      select('variant', 'Variant', ['segments', 'dots'] satisfies MeterVariant[], { default: 'segments' }),
    ],
    render: (props) => (
      <Meter
        label={s(props, 'label')}
        value={Math.min(n(props, 'value'), n(props, 'total'))}
        total={n(props, 'total')}
        variant={s(props, 'variant') as MeterVariant}
      />
    ),
  },
  Alert: {
    textChild: 'children',
    props: [
      text_('title', 'Title', { default: '', initial: 'Heads up' }),
      text_('children', 'Message', { initial: 'Your trial ends in three days.' }),
      select('tone', 'Tone', ALERT_TONES, { default: 'neutral', initial: 'accent' }),
    ],
    render: (props) => (
      <Alert title={o(props, 'title')} tone={s(props, 'tone') as AlertTone}>
        {s(props, 'children')}
      </Alert>
    ),
  },
  Banner: {
    textChild: 'children',
    props: [
      text_('title', 'Title', { initial: 'New: the Composer' }),
      text_('children', 'Message', { initial: 'Build a screen from the real components.' }),
      select('tone', 'Tone', ['accent', 'neutral', 'ink'] satisfies BannerTone[], { default: 'accent' }),
    ],
    render: (props) => (
      <Banner title={s(props, 'title')} tone={s(props, 'tone') as BannerTone}>
        {o(props, 'children')}
      </Banner>
    ),
  },
  InlineMessage: {
    textChild: 'children',
    props: [
      text_('children', 'Message', { initial: 'We will never share your email.' }),
      select('tone', 'Tone', ['hint', 'success', 'warning', 'danger'] satisfies InlineMessageTone[], { default: 'hint' }),
    ],
    render: (props) => <InlineMessage tone={s(props, 'tone') as InlineMessageTone}>{s(props, 'children')}</InlineMessage>,
  },
  EmptyState: {
    props: [
      text_('title', 'Title', { initial: 'No projects yet' }),
      text_('description', 'Description', { default: '', initial: 'Create one to get started.' }),
      select('size', 'Size', TWO_SIZES satisfies readonly EmptyStateSize[], { default: 'md' }),
    ],
    render: (props) => <EmptyState title={s(props, 'title')} description={o(props, 'description')} size={s(props, 'size') as EmptyStateSize} />,
  },
  Spinner: {
    props: [
      text_('label', 'Accessible name', { default: '', initial: 'Loading' }),
      select('size', 'Size', TWO_SIZES satisfies readonly SpinnerSize[], { default: 'md' }),
    ],
    render: (props) => <Spinner label={o(props, 'label')} size={s(props, 'size') as SpinnerSize} />,
  },
  StatusDot: {
    props: [
      select('tone', 'Tone', STATUS_TONES, { default: 'accent', initial: 'success' }),
      select('size', 'Size', TWO_SIZES satisfies readonly StatusDotSize[], { default: 'sm' }),
      text_('label', 'Accessible name', { default: '', initial: 'Online' }),
    ],
    render: (props) => <StatusDot tone={s(props, 'tone') as StatusDotTone} size={s(props, 'size') as StatusDotSize} label={o(props, 'label')} />,
  },
  Skeleton: {
    props: [num('lines', 'Lines', 1, 8, { default: 1, initial: 3 })],
    render: (props) => <Skeleton lines={n(props, 'lines')} />,
  },
}

/* ------------------------------------------------------------------- nodes */

export function initialProps(definition: Definition): Props {
  const props: Props = {}
  for (const spec of definition.props) {
    const value = spec.initial ?? spec.default
    if (value !== undefined) props[spec.name] = value
  }
  return props
}

export function createNode(type: ComposableName): ComponentNode {
  const definition = definitions[type]
  return { id: newNodeId(), kind: 'component', type, props: initialProps(definition), children: definition.seed?.() ?? [] }
}

/** "Button · Get started" — what a node is called in Layers and on the canvas. */
export function nodeLabel(node: ComposerNode): string {
  if (node.kind === 'block') return `${findBlock(node.slug)?.name ?? node.slug} block`
  const definition = definitions[node.type]
  const key = definition.textChild ?? ['title', 'label', 'name'].find((name) => definition.props.some((spec) => spec.name === name))
  const detail = key ? String(node.props[key] ?? '').trim() : ''
  return detail ? `${node.type} · ${detail.length > 28 ? `${detail.slice(0, 27)}…` : detail}` : node.type
}
