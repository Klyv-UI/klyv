import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ACCENT_PRESETS, Button, CodeBlock, Reveal, Surface, Text, deriveAccent, systemMode } from 'klyvui'
import { chooseAccent } from '../../lib/theme'
import { ContrastReadout } from '../../components/ContrastReadout'
import { useAccent, useMode } from '../../components/useTheme'
import { brand } from '../../brand'
import { LandingSection, TokenSwatch } from './primitives'

/**
 * The library's thesis, as a control: pick a hue and read the contrast it
 * produces, with the code that does it beside it. The readout is computed for
 * whichever colour is chosen, so the 4.5:1 claim is checked in front of the
 * reader rather than asserted to them.
 */
export function Theming() {
  const hex = useAccent()
  const mode = useMode()
  const family = deriveAccent(hex)
  const dark = mode === 'dark' || (mode === 'system' && systemMode() === 'dark')

  const pick = (next: string) => chooseAccent(next)

  return (
    <LandingSection
      id="theming"
      eyebrow="Theming"
      index={10}
      title="Pick a hue."
      tail="Everything follows."
      lede="Four custom properties are derived from one colour. Nothing else in the library names a colour, so the whole page repaints — this one included — and the text on the accent is chosen by contrast, not by guesswork."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Reveal className="flex">
          <Surface variant="card" padding="lg" className="landing-card w-full gap-6">
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const active = preset.hex.toLowerCase() === hex.toLowerCase()
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => pick(preset.hex)}
                    aria-pressed={active}
                    className="group flex w-14 flex-col items-center gap-1.5 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className="size-11 rounded-[14px] border border-line-strong transition-transform group-hover:scale-105 motion-reduce:transition-none"
                      style={{
                        background: preset.hex,
                        outline: active ? '2px solid var(--color-ink)' : undefined,
                        outlineOffset: '2px',
                      }}
                    />
                    <Text size="micro" weight="bold" tone={active ? 'default' : 'faint'} truncate className="max-w-full">
                      {preset.name}
                    </Text>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TokenSwatch token="--color-accent" value={family.accent} />
              <TokenSwatch token="--color-accent-strong" value={family.strong} />
              <TokenSwatch token="--color-accent-soft" value={dark ? family.softDark : family.soft} />
              <TokenSwatch token="--color-accent-ink" value={family.ink} />
            </div>

            <ContrastReadout hex={hex} />
          </Surface>
        </Reveal>

        <Reveal delay={80} className="flex">
          <Surface variant="card" padding="lg" className="landing-card w-full justify-center gap-4">
            <Text as="h3" size="heading" className="text-[16px]">
              Derived, not configured
            </Text>
            <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
              The press state is the same hue at a different lightness. The wash is the same hue, desaturated —
              and different on a dark page, where a pale tint would glare. The label colour prefers a tinted
              near-black, then white, whichever clears 4.5:1.
            </Text>
            <CodeBlock
              language="ts"
              code={`import { applyAccent, applyMode } from '${brand.pkg}'\n\napplyAccent('${hex}')\napplyMode('system') // light, dark, or follow the OS`}
            />
            <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
              The accent is one of five choices. Base colour, radius, font and depth are themeable the same way.
            </Text>
            <Button as={Link} to="/themes" variant="outline" size="sm" className="self-start">
              Try the theme customiser
              <ArrowRight size={14} aria-hidden />
            </Button>
          </Surface>
        </Reveal>
      </div>
    </LandingSection>
  )
}
