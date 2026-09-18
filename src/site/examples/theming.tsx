import { useState } from 'react'
import {
  ACCENT_PRESETS,
  Badge,
  Button,
  CodeBlock,
  Progress,
  SegmentedControl,
  Text,
  THEME_PRESETS,
  ThemeScope,
  serializeTheme,
  themeToCss,
  type BaseId,
  type RadiusId,
  type StyleId,
  type ThemeConfig,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

/* ------------------------------------------------------------------ shared bits */

/** A small slice of product UI, so a theme has something to show on. */
function PreviewCard({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <Text as="p" size="body" weight="bold">
          {title}
        </Text>
        <Badge>Pro</Badge>
      </div>
      <Text as="p" size="caption" tone="soft">
        Storage used this month, across every workspace.
      </Text>
      <Progress label={`${title} storage used`} value={64} />
      <div className="flex items-center justify-between rounded-[var(--radius-tile)] bg-surface-muted px-3 py-2">
        <Text as="span" size="caption" tone="faint">
          Renews on 1 October
        </Text>
        <Text as="span" size="caption" weight="bold">
          64 GB
        </Text>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Upgrade</Button>
        <Button size="sm" variant="outline">
          Details
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ ThemeScope */

function ThreeSections() {
  const presets = THEME_PRESETS.filter((preset) => ['ledger', 'editorial', 'bloom'].includes(preset.id))
  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
      {presets.map((preset) => (
        <ThemeScope
          key={preset.id}
          // The fonts are not loaded here, so each preview uses its fallback
          // stack; everything else is the preset as it ships.
          theme={preset.theme}
          className="flex flex-col gap-2 rounded-[var(--radius-banner)] bg-app p-3"
        >
          <Text as="p" size="micro" weight="bold" tone="faint">
            {preset.name}
          </Text>
          <PreviewCard title={preset.name} />
        </ThemeScope>
      ))}
    </div>
  )
}

const ACCENTS = ACCENT_PRESETS.filter((preset) => ['volt', 'ultraviolet', 'ember', 'kelp'].includes(preset.id))

function Builder() {
  const [accent, setAccent] = useState<string>(ACCENTS[0].id)
  const [base, setBase] = useState<BaseId>('sage')
  const [radius, setRadius] = useState<RadiusId>('default')
  const [style, setStyle] = useState<StyleId>('soft')

  const theme: Partial<ThemeConfig> = {
    accent: ACCENTS.find((preset) => preset.id === accent)?.hex,
    base,
    radius,
    style,
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <SegmentedControl
          label="Accent"
          value={accent}
          onValueChange={setAccent}
          options={ACCENTS.map((preset) => ({ value: preset.id, label: preset.name }))}
        />
        <SegmentedControl<BaseId>
          label="Base colour"
          value={base}
          onValueChange={setBase}
          options={[
            { value: 'sage', label: 'Sage' },
            { value: 'slate', label: 'Slate' },
            { value: 'sand', label: 'Sand' },
            { value: 'mauve', label: 'Mauve' },
            { value: 'tinted', label: 'Tinted' },
          ]}
        />
        <SegmentedControl<RadiusId>
          label="Radius"
          value={radius}
          onValueChange={setRadius}
          options={[
            { value: 'none', label: 'None' },
            { value: 'sm', label: 'Small' },
            { value: 'default', label: 'Default' },
            { value: 'xl', label: 'Large' },
          ]}
        />
        <SegmentedControl<StyleId>
          label="Style"
          value={style}
          onValueChange={setStyle}
          options={[
            { value: 'soft', label: 'Soft' },
            { value: 'flat', label: 'Flat' },
            { value: 'outline', label: 'Outline' },
            { value: 'elevated', label: 'Elevated' },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ThemeScope theme={theme} className="rounded-[var(--radius-banner)] bg-app p-4">
          <PreviewCard title="Team plan" />
        </ThemeScope>
        <div className="flex min-w-0 flex-col gap-2">
          <CodeBlock language="css" code={themeToCss(theme)} copyable />
          <Text as="p" size="caption" tone="faint">
            Share string: <code className="font-mono">{serializeTheme(theme)}</code>
          </Text>
        </div>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'theme-scope': {
    description:
      'Puts one section of a page on a theme of its own. It takes any part of a theme — accent, base colour, radius, font, style — applies it to its own element, and inherits the rest from the page. Because a scoped theme is written as resolved values for the mode in force, it re-applies itself when the mode flips and when the page’s theme changes underneath it.',
    sections: [
      {
        title: 'Three sections, three themes',
        description: 'Ledger, Editorial and Bloom from THEME_PRESETS, side by side on one page.',
        Content: ThreeSections,
      },
      {
        title: 'Build one',
        description:
          'Every choice re-derives the neutrals and re-checks their contrast. The CSS is what themeToCss prints for the same theme: paste it into a stylesheet and the page needs no runtime at all.',
        Content: Builder,
      },
      rationale(
        'The page-wide theme is written on :root and resolved there, so a <section> that sets the same properties changes nothing inside it; and a scoped value that is right in light mode is wrong once the page turns dark.',
        'It writes resolved tokens on its own element and owns the three subscriptions — mode, system preference, page theme — that keep them current.',
        'Marketing blocks on a different accent, a theme customiser’s preview, an embedded widget that has to match its host.',
        ['Button', 'Badge', 'Progress', 'CodeBlock'],
      ),
    ],
    props: [
      { name: 'theme', type: 'Partial<ThemeConfig>', description: 'What differs inside the section. The rest follows the page’s theme.' },
      { name: '...rest', type: 'HTMLAttributes<HTMLDivElement>', description: 'Passed to the wrapping div, including className and ref.' },
    ],
  },
}
