import { cn } from '../../lib/cn'

export type SignalStrengthSize = 'sm' | 'md' | 'lg'

/** `auto` colours by quality; `neutral` keeps every level in ink, for places where colour would shout. */
export type SignalStrengthTone = 'auto' | 'neutral'

export interface SignalStrengthProps {
  /** Lit bars, 0 to 4. Fractions round to the nearest bar and values outside the range are clamped. */
  value: number
  /** What the bars measure, first word of the accessible text — “Signal”, “Connection”, “Wi-Fi”. */
  label?: string
  /** Print the quality word beside the bars. The accessible text is there either way. */
  showLabel?: boolean
  /** Words for 0 to 4 bars, in order. */
  qualityLabels?: [string, string, string, string, string]
  /** Colour by quality, or keep the bars in ink. */
  tone?: SignalStrengthTone
  /** Bar height: 12, 16 or 20 pixels. */
  size?: SignalStrengthSize
  /** Merged last, so it wins. */
  className?: string
}

const QUALITY: [string, string, string, string, string] = ['no signal', 'poor', 'fair', 'good', 'excellent']

const SIZES: Record<SignalStrengthSize, { height: number; bar: string; gap: string; text: string }> = {
  sm: { height: 12, bar: 'w-[3px]', gap: 'gap-[2px]', text: 'text-[11px]' },
  md: { height: 16, bar: 'w-1', gap: 'gap-[2px]', text: 'text-[12px]' },
  lg: { height: 20, bar: 'w-[5px]', gap: 'gap-[3px]', text: 'text-[13px]' },
}

/* Lit bars take the quality's colour; the word beside them stays ink-soft, so
   colour is never the only thing that says how good the connection is. */
const TONES = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

/**
 * Connection quality as the four rising bars every phone has taught people to
 * read, with the same reading in words for anyone who cannot see them.
 *
 * The whole indicator is one `role="img"` named “Signal: good, 3 of 4 bars”.
 * Bars announced one by one say nothing; the count alone leaves the listener to
 * decide whether three is good. Unlit bars stay drawn as a faint track, so zero
 * bars still looks like a signal indicator rather than a gap in the layout.
 *
 * It holds no state and takes no events — pass a new value as the connection
 * changes, and wrap it in a live region yourself if the change should be spoken.
 */
export function SignalStrength({
  value,
  label = 'Signal',
  showLabel = false,
  qualityLabels = QUALITY,
  tone = 'auto',
  size = 'md',
  className,
}: SignalStrengthProps) {
  const bars = Number.isFinite(value) ? Math.min(4, Math.max(0, Math.round(value))) : 0
  const quality = qualityLabels[bars]
  const spec = SIZES[size]
  const lit = tone === 'neutral' ? 'bg-ink' : TONES[bars]

  return (
    <span
      role="img"
      aria-label={`${label}: ${quality}, ${bars} of 4 bars`}
      className={cn('inline-flex items-center gap-1.5 align-middle', className)}
    >
      <span className={cn('inline-flex items-end', spec.gap)} style={{ height: spec.height }}>
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn('rounded-[var(--radius-hair)] transition-colors', spec.bar, bar <= bars ? lit : 'bg-track')}
            style={{ height: `${25 * bar}%` }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={cn('font-semibold leading-none text-ink-soft', spec.text)}>
          {quality.charAt(0).toUpperCase() + quality.slice(1)}
        </span>
      )}
    </span>
  )
}
