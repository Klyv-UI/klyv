import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ACCENT_PRESETS, deriveAccent, Text, Tooltip, cn } from 'klyvui'
import { chooseAccent } from '../lib/theme'
import { useAccent } from './useTheme'
import { ContrastReadout } from './ContrastReadout'

interface AccentPickerProps {
  /** Swatches only, for the header. */
  compact?: boolean
  /** Adds a link to the full theme customiser after the swatches. */
  customiseLink?: boolean
  className?: string
}

/**
 * The accent switcher.
 *
 * It writes four custom properties onto the document and everything in the
 * library follows, because nothing in the library names a colour — every
 * emphasis in 223 components resolves back to this one hue. That is the claim
 * the tokens page makes, and this is the control that proves it.
 */
export function AccentPicker({ compact = false, customiseLink = false, className }: AccentPickerProps) {
  // Shared with every other picker on the page, so choosing a hue anywhere
  // moves this one's selection too.
  const hex = useAccent()

  // Through the theme engine rather than applyAccent, so a base tinted by the
  // accent follows it, and the choice is saved with the rest of the theme.
  const choose = (next: string) => chooseAccent(next)

  const active = hex.toLowerCase()
  const family = deriveAccent(hex)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {ACCENT_PRESETS.map((preset) => {
          const selected = preset.hex.toLowerCase() === active
          return (
            <Tooltip key={preset.id} content={`${preset.name} · ${preset.hex}`}>
              <button
                type="button"
                aria-label={`Accent: ${preset.name}`}
                aria-pressed={selected}
                onClick={() => choose(preset.hex)}
                className={cn(
                  'h-6 w-6 rounded-full border transition-transform duration-[var(--duration-fast)] hover:scale-110',
                  selected
                    ? 'border-ink ring-2 ring-ink/20 ring-offset-2 ring-offset-surface'
                    : 'border-black/10',
                )}
                style={{ background: preset.hex }}
              />
            </Tooltip>
          )
        })}

        {/* Any hue at all — the derivation holds for every one of them. */}
        <label
          className="relative inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-black/10"
          style={{
            background:
              'conic-gradient(#f43f5e,#facc15,#22d3ee,#3b82f6,#8b5cf6,#f472b6,#f43f5e)',
          }}
          title="Any colour"
        >
          <input
            type="color"
            value={hex}
            aria-label="Custom accent colour"
            onChange={(event) => choose(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {customiseLink && (
          <Link
            to="/themes"
            className="ml-1 inline-flex items-center gap-1 rounded-full text-[12px] font-bold text-ink-soft underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Customise theme
            <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          {(
            [
              ['accent', family.accent],
              ['strong', family.strong],
              ['soft', family.soft],
              ['ink', family.ink],
            ] as const
          ).map(([name, value]) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-[4px] border border-black/10"
                style={{ background: value }}
              />
              <Text as="span" size="micro" tone="faint" tabular>
                {name} {value}
              </Text>
            </span>
          ))}
          <Text as="span" size="micro" tone="faint">
            — three of the four are derived, so every hue stays readable.
          </Text>
        </div>
      )}

      {!compact && <ContrastReadout hex={hex} className="max-w-[560px]" />}
    </div>
  )
}
