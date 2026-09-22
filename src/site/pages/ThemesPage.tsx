import { useEffect, useId, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Globe, Link2, RotateCcw } from 'lucide-react'
import {
  ACCENT_PRESETS,
  Alert,
  BASE_PRESETS,
  Button,
  CodeBlock,
  ColorPicker,
  CopyButton,
  DEFAULT_THEME,
  FONT_PRESETS,
  RADIUS_PRESETS,
  STYLE_PRESETS,
  SegmentedControl,
  Surface,
  Switch,
  THEME_PRESETS,
  Tabs,
  Text,
  ThemeScope,
  VisuallyHidden,
  cn,
  loadFont,
  parseTheme,
  resolveBase,
  resolveTheme,
  serializeTheme,
  systemMode,
  themeToCss,
  type BaseId,
  type FontId,
  type IconComponent,
  type RadiusId,
  type StyleId,
  type ThemeConfig,
} from 'klyvui'
import { Code } from '../components/Doc'
import { PageIntro } from '../components/PageIntro'
import { ThemeToggle } from '../components/ThemeToggle'
import { useMode } from '../components/useTheme'
import { brand } from '../brand'
import { resetSiteTheme, setSiteTheme, useSiteTheme } from '../lib/theme'
import { OptionGroup } from './themes/OptionGroup'
import { ThemePreview } from './themes/ThemePreview'

/**
 * The theme customiser: five choices, a preview built from the library, and
 * the theme as CSS, as code and as a link.
 *
 * By default every choice is applied to the whole site and saved, because the
 * rest of the documentation is the best preview there is — a reader can pick a
 * theme here and read every component page in it. "Preview only" keeps the
 * choices inside the preview, through ThemeScope, for trying something without
 * losing the theme the site is wearing.
 */
export default function ThemesPage() {
  const site = useSiteTheme()
  const mode = useMode()
  const resolvedMode = mode === 'system' ? systemMode() : mode
  const [previewOnly, setPreviewOnly] = useState(false)
  const [local, setLocal] = useState<ThemeConfig>(site)
  const draft = previewOnly ? local : site
  const [params, setParams] = useSearchParams()
  const [shared, setShared] = useState<'applied' | 'invalid' | null>(null)

  // A shared link applies its theme once, as the page opens.
  useEffect(() => {
    const raw = params.get('theme')
    if (!raw) return
    const parsed = parseTheme(raw)
    if (parsed) {
      setSiteTheme(parsed)
      setShared('applied')
    } else {
      setShared('invalid')
    }
    // Only the link the page was opened with; later changes to the URL are ours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every font's stylesheet, so each name in the list and on the preset cards
  // is drawn in its own face. Only the glyphs on screen are downloaded.
  useEffect(() => {
    for (const font of FONT_PRESETS) loadFont(font)
  }, [])

  const dropShareParam = () => {
    if (!params.has('theme')) return
    const next = new URLSearchParams(params)
    next.delete('theme')
    setParams(next, { replace: true })
  }

  const update = (patch: Partial<ThemeConfig>) => {
    dropShareParam()
    setShared(null)
    if (previewOnly) {
      setLocal((previous) => ({ ...previous, ...patch }))
      if (patch.font) loadFont(patch.font)
    } else {
      setSiteTheme(patch)
    }
  }

  const reset = () => {
    dropShareParam()
    setShared(null)
    if (previewOnly) setLocal(DEFAULT_THEME)
    else resetSiteTheme()
  }

  const togglePreviewOnly = (on: boolean) => {
    // Starting from the site's theme, so the first change is the only change.
    if (on) setLocal(site)
    setPreviewOnly(on)
  }

  const applyDraftToSite = () => {
    setSiteTheme(local)
    setPreviewOnly(false)
  }

  const serialized = serializeTheme(draft)
  const isDefault = serialized === serializeTheme(DEFAULT_THEME)

  return (
    <article className="flex flex-col gap-10">
      <PageIntro
        eyebrow="Design system"
        title="Themes"
        actions={
          <Button variant="outline" size="sm" onClick={reset} disabled={isDefault}>
            <RotateCcw size={13} aria-hidden />
            Reset to default
          </Button>
        }
        meta={
          <span className="inline-flex items-center gap-1.5">
            {previewOnly ? (
              'Preview only: the rest of the site keeps its theme.'
            ) : (
              <>
                <Globe size={12} aria-hidden />
                Applies to the whole site, and is remembered in this browser.
              </>
            )}
          </span>
        }
      >
        Five choices make a theme: an accent, a base colour, a radius, a font and a style. Everything else is derived
        from them, and every text colour is checked for contrast, so no combination here is unreadable. Pick a preset or
        set each one, then copy the CSS or share the link.
      </PageIntro>

      {shared === 'applied' && (
        <Alert tone="success" title="Shared theme applied" live onDismiss={() => setShared(null)}>
          This link’s theme is now on the whole site. Reset to go back to the default.
        </Alert>
      )}
      {shared === 'invalid' && (
        <Alert tone="warning" title="That link’s theme could not be read" live onDismiss={() => setShared(null)}>
          The site kept its current theme.
        </Alert>
      )}

      <PresetRow draft={draft} mode={resolvedMode} onPick={(theme) => update(theme)} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
        <Controls
          draft={draft}
          mode={resolvedMode}
          update={update}
          previewOnly={previewOnly}
          onPreviewOnly={togglePreviewOnly}
          onApply={applyDraftToSite}
        />
        <Preview draft={draft} previewOnly={previewOnly} local={local} />
      </div>

      <Output draft={draft} serialized={serialized} params={params} setParams={setParams} />
    </article>
  )
}

/* ------------------------------------------------------------------ presets */

function PresetRow({
  draft,
  mode,
  onPick,
}: {
  draft: ThemeConfig
  mode: 'light' | 'dark'
  onPick: (theme: ThemeConfig) => void
}) {
  const headingId = useId()
  const current = serializeTheme(draft)
  const selected = THEME_PRESETS.find((preset) => serializeTheme(preset.theme) === current)?.id ?? null

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Text as="h2" id={headingId} size="subtitle" className="tracking-[-0.02em]">
          Presets
        </Text>
        <Text size="body" weight="medium" tone="soft">
          Whole themes, all five choices at once. Adjust any of them afterwards.
        </Text>
      </div>
      <OptionGroup
        labelledBy={headingId}
        value={selected}
        onValueChange={(id) => {
          const preset = THEME_PRESETS.find((entry) => entry.id === id)
          if (preset) onPick(preset.theme)
        }}
        options={THEME_PRESETS.map((preset) => ({ value: preset.id, label: preset.name, description: preset.description }))}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9"
        optionClassName={(on) =>
          cn(
            'group flex flex-col gap-2 rounded-[var(--radius-tile)] border bg-surface p-2 text-left transition-colors',
            on ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong',
          )
        }
        render={(option, on) => {
          const preset = THEME_PRESETS.find((entry) => entry.id === option.value)!
          return <PresetCard theme={preset.theme} name={preset.name} mode={mode} selected={on} />
        }}
      />
    </section>
  )
}

/** A preset drawn in itself: its canvas, a card on it, its accent, its corners and its font. */
function PresetCard({
  theme,
  name,
  mode,
  selected,
}: {
  theme: ThemeConfig
  name: string
  mode: 'light' | 'dark'
  selected: boolean
}) {
  const resolved = resolveTheme(theme)
  const colors = resolved[mode].colors
  const shadow = resolved[mode].shadows.card
  const radius = (px: number) => `${px * resolved.radiusScale}px`
  return (
    <>
      <span
        aria-hidden
        className="flex h-[72px] flex-col justify-end gap-1.5 overflow-hidden border p-2"
        style={{ background: colors.canvas, borderColor: colors.line, borderRadius: radius(10) }}
      >
        <span
          className="flex items-center gap-1.5 border px-1.5 py-1.5"
          style={{ background: colors.surface, borderColor: colors.line, borderRadius: radius(7), boxShadow: shadow }}
        >
          <span className="h-1.5 flex-1 rounded-full" style={{ background: colors.ink }} />
          <span className="h-1.5 w-1/4 rounded-full" style={{ background: colors['ink-faint'] }} />
          <span className="h-3 w-5 rounded-full" style={{ background: resolved.accent.accent }} />
        </span>
      </span>
      <span className="flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-[13px] font-bold text-ink" style={{ fontFamily: resolved.fontStack }}>
          {name}
        </span>
        {selected && <Check size={13} aria-hidden className="shrink-0 text-ink" />}
      </span>
    </>
  )
}

/* ------------------------------------------------------------------ controls */

function Group({ id, title, value, children }: { id: string; title: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <Text as="h3" id={id} size="label" weight="bold">
          {title}
        </Text>
        {value && (
          <Text size="caption" weight="semibold" tone="faint" truncate>
            {value}
          </Text>
        )}
      </div>
      {children}
    </div>
  )
}

/** A corner drawn at a radius step, for the radius control's glyphs. */
function cornerIcon(scale: number): IconComponent {
  const r = Math.min(12, 8 * scale)
  function Corner({ size = 15, className }: { size?: number | string; className?: string }) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
        <path d={`M2.5 14 V${2.5 + r} ${r ? `A${r} ${r} 0 0 1 ${2.5 + r} 2.5` : ''} H14`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return Corner
}

const RADIUS_OPTIONS = RADIUS_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.name,
  icon: cornerIcon(preset.scale),
  iconOnly: true,
}))

function nearestRadius(radius: ThemeConfig['radius']): RadiusId {
  if (typeof radius === 'string') return radius
  return RADIUS_PRESETS.reduce((best, preset) =>
    Math.abs(preset.scale - radius) < Math.abs(best.scale - radius) ? preset : best,
  ).id
}

function Controls({
  draft,
  mode,
  update,
  previewOnly,
  onPreviewOnly,
  onApply,
}: {
  draft: ThemeConfig
  mode: 'light' | 'dark'
  update: (patch: Partial<ThemeConfig>) => void
  previewOnly: boolean
  onPreviewOnly: (on: boolean) => void
  onApply: () => void
}) {
  const base = useId()
  const ids = {
    heading: `${base}-heading`,
    accent: `${base}-accent`,
    base: `${base}-base`,
    radius: `${base}-radius`,
    font: `${base}-font`,
    style: `${base}-style`,
    mode: `${base}-mode`,
    scope: `${base}-scope`,
  }

  const accent = draft.accent.toLowerCase()
  const accentPreset = ACCENT_PRESETS.find((preset) => preset.hex.toLowerCase() === accent)
  const baseId = typeof draft.base === 'string' ? draft.base : null
  const basePreset = BASE_PRESETS.find((preset) => preset.id === baseId)
  const radiusId = nearestRadius(draft.radius)
  const radiusPreset = RADIUS_PRESETS.find((preset) => preset.id === radiusId)!
  const fontId = typeof draft.font === 'string' ? draft.font : null
  const stylePreset = STYLE_PRESETS.find((preset) => preset.id === draft.style)!

  return (
    <section
      aria-labelledby={ids.heading}
      className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-[89px] xl:max-h-[calc(100dvh-105px)] xl:self-start xl:overflow-y-auto xl:pb-2"
    >
      <Text as="h2" id={ids.heading} size="subtitle" className="tracking-[-0.02em]">
        Customise
      </Text>

      <Surface variant="sunken" padding="md" className="gap-2.5">
        <label className="flex items-start justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <Text as="span" size="label" weight="bold" id={ids.scope}>
              Preview only
            </Text>
            <Text as="span" size="caption" tone="soft" leading="normal">
              {previewOnly
                ? 'Changes stay inside the preview. The site keeps its theme.'
                : 'Off: changes apply to the whole site as you make them.'}
            </Text>
          </span>
          <Switch checked={previewOnly} onChange={(event) => onPreviewOnly(event.target.checked)} switchSize="sm" />
        </label>
        {previewOnly && (
          <Button size="sm" variant="accent" onClick={onApply} className="self-start">
            <Globe size={13} aria-hidden />
            Apply to the whole site
          </Button>
        )}
      </Surface>

      <Surface variant="card" padding="lg" className="gap-4">
        <Group id={ids.accent} title="Theme colour" value={accentPreset?.name ?? draft.accent}>
          <div className="flex flex-wrap items-center gap-1.5">
            <OptionGroup
              labelledBy={ids.accent}
              value={accentPreset?.hex ?? null}
              onValueChange={(hex) => update({ accent: hex })}
              options={ACCENT_PRESETS.map((preset) => ({ value: preset.hex, label: preset.name }))}
              className="flex flex-wrap gap-1.5"
              optionClassName="rounded-full"
              render={(option, on) => (
                <span
                  className={cn(
                    'block size-7 rounded-full border transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100',
                    on ? 'border-ink ring-2 ring-ink/25 ring-offset-2 ring-offset-surface' : 'border-line-strong',
                  )}
                  style={{ background: option.value }}
                />
              )}
            />
          </div>
          <ColorPicker
            label="Custom accent colour"
            value={draft.accent}
            onValueChange={(hex) => update({ accent: hex })}
            swatches={ACCENT_PRESETS.map((preset) => ({ value: preset.hex, label: preset.name }))}
          />
        </Group>

        <Group id={ids.base} title="Base colour" value={basePreset?.name ?? 'Custom'}>
          <OptionGroup
            labelledBy={ids.base}
            value={baseId}
            onValueChange={(id: BaseId) => update({ base: id })}
            options={BASE_PRESETS.map((preset) => ({
              value: preset.id,
              label: preset.name,
              description: preset.hue === 'accent' ? 'takes the accent’s hue' : undefined,
            }))}
            className="grid grid-cols-5 gap-1.5"
            optionClassName={(on) =>
              cn(
                'flex flex-col items-center gap-1 rounded-[var(--radius-8)] p-1 transition-colors',
                on ? 'bg-surface-muted ring-1 ring-ink' : 'hover:bg-surface-muted',
              )
            }
            render={(option) => {
              const colors = resolveBase(option.value, draft.accent)[mode]
              return (
                <>
                  <span
                    aria-hidden
                    className="flex h-9 w-full flex-col justify-center gap-1 overflow-hidden rounded-[var(--radius-6)] border px-1.5"
                    style={{ background: colors.canvas, borderColor: colors['line-strong'] }}
                  >
                    <span className="h-2 rounded-[2px] border" style={{ background: colors.surface, borderColor: colors.line }} />
                    <span className="h-1 w-2/3 rounded-full" style={{ background: colors.ink }} />
                  </span>
                  <span className="max-w-full truncate text-[10px] font-bold text-ink-soft">{option.label}</span>
                </>
              )
            }}
          />
        </Group>

        <Group id={ids.radius} title="Radius" value={`${radiusPreset.name} · ${radiusPreset.scale}×`}>
          <SegmentedControl
            label="Radius"
            size="sm"
            fullWidth
            value={radiusId}
            onValueChange={(id: RadiusId) => update({ radius: id })}
            options={RADIUS_OPTIONS}
          />
          <Text size="caption" tone="faint" leading="normal">
            Cards, fields, menus and checks follow the scale. Pill buttons and badges stay pills.
          </Text>
        </Group>

        <Group id={ids.font} title="Font" value={fontId ? undefined : 'Custom'}>
          <OptionGroup
            labelledBy={ids.font}
            value={fontId}
            onValueChange={(id: FontId) => update({ font: id })}
            options={FONT_PRESETS.map((preset) => ({ value: preset.id, label: preset.name }))}
            className="flex flex-col gap-0.5"
            optionClassName={(on) =>
              cn(
                'flex items-center justify-between gap-2 rounded-[var(--radius-10)] px-2.5 py-1.5 text-left transition-colors',
                on ? 'bg-surface-muted ring-1 ring-line-strong' : 'hover:bg-surface-muted',
              )
            }
            render={(option, on) => {
              const preset = FONT_PRESETS.find((entry) => entry.id === option.value)!
              return (
                <>
                  <span className="truncate text-[14px] font-semibold text-ink" style={{ fontFamily: preset.stack }}>
                    {preset.name}
                  </span>
                  {on ? (
                    <Check size={14} aria-hidden className="shrink-0 text-ink" />
                  ) : (
                    <span aria-hidden className="shrink-0 text-[13px] text-ink-faint" style={{ fontFamily: preset.stack }}>
                      Aa
                    </span>
                  )}
                </>
              )
            }}
          />
          {fontId && fontId !== 'system' && (
            <Text size="caption" tone="faint" leading="normal">
              Served by Google Fonts. The library never loads it by itself: link it, or call <Code>loadFont</Code>.
            </Text>
          )}
        </Group>

        <Group id={ids.style} title="Style" value={stylePreset.name}>
          <OptionGroup
            labelledBy={ids.style}
            value={draft.style}
            onValueChange={(id: StyleId) => update({ style: id })}
            options={STYLE_PRESETS.map((preset) => ({ value: preset.id, label: preset.name, description: preset.description }))}
            className="grid grid-cols-2 gap-1.5"
            optionClassName={(on) =>
              cn(
                'flex flex-col gap-1.5 rounded-[var(--radius-10)] p-1.5 text-left transition-colors',
                on ? 'bg-surface-muted ring-1 ring-ink' : 'hover:bg-surface-muted',
              )
            }
            render={(option) => {
              const resolved = resolveTheme({ ...draft, style: option.value })[mode]
              return (
                <>
                  <span
                    aria-hidden
                    className="grid h-12 place-items-center rounded-[var(--radius-6)]"
                    style={{ background: resolved.colors.app }}
                  >
                    <span
                      className="h-6 w-10 rounded-[var(--radius-4)] border"
                      style={{
                        background: resolved.colors.surface,
                        borderColor: resolved.colors.line,
                        boxShadow: resolved.shadows.card,
                      }}
                    />
                  </span>
                  <span className="px-0.5 text-[11px] font-bold text-ink">{option.label}</span>
                </>
              )
            }}
          />
          <Text size="caption" tone="faint" leading="normal">
            {stylePreset.description}
          </Text>
        </Group>

        <Group id={ids.mode} title="Mode">
          <div role="group" aria-labelledby={ids.mode} className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <Text size="caption" tone="faint">
              Always site-wide
            </Text>
          </div>
        </Group>
      </Surface>
    </section>
  )
}

/* ------------------------------------------------------------------ preview */

function Preview({ draft, previewOnly, local }: { draft: ThemeConfig; previewOnly: boolean; local: ThemeConfig }) {
  const headingId = useId()
  const resolved = resolveTheme(draft)
  const fontName = typeof draft.font === 'string' ? FONT_PRESETS.find((font) => font.id === draft.font)?.name : 'Custom font'
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text as="h2" id={headingId} size="subtitle" className="tracking-[-0.02em]">
          Preview
        </Text>
        <Text size="caption" weight="semibold" tone="faint">
          {fontName} · {resolved.radiusScale}× radius · {STYLE_PRESETS.find((style) => style.id === draft.style)?.name}
          {previewOnly && ' · preview only'}
        </Text>
      </div>
      {/* Always a scope, so switching Preview only on and off never remounts
          the screens: with no overrides it simply follows the page. */}
      <ThemeScope
        theme={previewOnly ? local : {}}
        className={cn(
          '@container rounded-[var(--radius-banner)] border border-line bg-app p-3 sm:p-4',
          previewOnly && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        )}
      >
        <ThemePreview />
      </ThemeScope>
    </section>
  )
}

/* ------------------------------------------------------------------ output */

function Output({
  draft,
  serialized,
  params,
  setParams,
}: {
  draft: ThemeConfig
  serialized: string
  params: URLSearchParams
  setParams: ReturnType<typeof useSearchParams>[1]
}) {
  const headingId = useId()
  const [tab, setTab] = useState<'css' | 'code'>('css')
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const css = themeToCss(draft)
  const code = themeCode(draft)
  const shareUrl = typeof window === 'undefined' ? `/themes?theme=${serialized}` : `${window.location.origin}/themes?theme=${serialized}`

  useEffect(() => {
    if (shareState === 'idle') return
    const timer = window.setTimeout(() => setShareState('idle'), 1800)
    return () => window.clearTimeout(timer)
  }, [shareState])

  const share = async () => {
    const next = new URLSearchParams(params)
    next.set('theme', serialized)
    setParams(next, { replace: true })
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }

  const shareLabel = shareState === 'copied' ? 'Link copied' : shareState === 'failed' ? 'Link in the address bar' : 'Share link'

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Text as="h2" id={headingId} size="subtitle" className="tracking-[-0.02em]">
            Use it
          </Text>
          <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[72ch]">
            Paste the CSS after the library’s stylesheet for a theme with no runtime, or call{' '}
            <Code>applyTheme</Code> to switch at runtime. The link opens this page with the theme applied.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={css} label="Copy CSS" copiedLabel="CSS copied" />
          <CopyButton value={code} label="Copy code" copiedLabel="Code copied" />
          <Button variant="outline" size="sm" onClick={share}>
            {shareState === 'copied' ? <Check size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
            {shareLabel}
          </Button>
          <VisuallyHidden>
            <span role="status" aria-live="polite">
              {shareState === 'idle' ? '' : shareLabel}
            </span>
          </VisuallyHidden>
        </div>
      </div>
      <Tabs
        label="Theme output"
        value={tab}
        onValueChange={setTab}
        variant="underline"
        items={[
          { value: 'css', label: 'CSS', content: <CodeBlock language="css" code={css} className="mt-3" /> },
          { value: 'code', label: 'applyTheme', content: <CodeBlock language="ts" code={code} className="mt-3" /> },
        ]}
      />
      <Text size="caption" tone="faint" tabular>
        Theme string: <Code>{serialized}</Code>
      </Text>
    </section>
  )
}

function literal(value: ThemeConfig[keyof ThemeConfig]): string {
  if (typeof value === 'string') return `'${value}'`
  if (typeof value === 'number') return String(value)
  if ('family' in value) return `{ family: ${JSON.stringify(value.family).replace(/^"|"$/g, "'")} }`
  return `{ hue: ${value.hue}, chroma: ${value.chroma} }`
}

function themeCode(theme: ThemeConfig): string {
  const fields = (['accent', 'base', 'radius', 'font', 'style'] as const)
    .map((key) => `  ${key}: ${literal(theme[key])},`)
    .join('\n')
  return `import { applyTheme, loadFont, saveTheme } from '${brand.pkg}'

const theme = {
${fields}
}

applyTheme(theme)     // the whole page; pass an element to theme one section
loadFont(theme.font)  // fonts are not bundled: this links the stylesheet
saveTheme(theme)      // remembered; call restoreTheme() as the app boots
`
}
