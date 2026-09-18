import { cn } from '../../lib/cn'

export type TrendDeltaFormat = 'percent' | 'number'
export type TrendDeltaTone = 'auto' | 'positive' | 'negative' | 'neutral'
export type TrendDeltaSize = 'sm' | 'md'
export type TrendDeltaVariant = 'text' | 'pill'

export interface TrendDeltaProps {
  /** The change itself: 12.4 for +12.4%, -3 for −3. Sign carries the direction. */
  value: number
  /** Percent adds a % and reads “percent”; number reads the figure as it is. */
  format?: TrendDeltaFormat
  /** Most fraction digits shown. Trailing zeros are dropped. */
  decimals?: number
  /** Unit after a number delta, such as “pts” or “ms”. Read out as written. */
  unit?: string
  /** Down is good for this metric — churn, latency, cost. Flips the colour, not the arrow. */
  inverse?: boolean
  /** Overrides the colour worked out from the sign. */
  tone?: TrendDeltaTone
  /** Changes whose size is at or below this count as flat. */
  flatThreshold?: number
  /** Comparison shown after the figure and read with it, such as “vs last week”. */
  context?: string
  /** Show the context text. When false it is still read out — for a strip that states the comparison once. */
  showContext?: boolean
  /** Show the arrow glyph. */
  showArrow?: boolean
  /** 12px or 13px text. */
  size?: TrendDeltaSize
  /** Plain coloured text, or a tinted pill. */
  variant?: TrendDeltaVariant
  /** BCP 47 locale for the figure. Defaults to the reader’s. */
  locale?: string
  /** Merged last, so it wins. */
  className?: string
}

const ARROWS = {
  up: 'M8 13V3.5M4 7.5l4-4 4 4',
  down: 'M8 3v9.5M4 8.5l4 4 4-4',
  flat: 'M3 8h10',
} as const

const TONES = {
  positive: {
    text: 'text-success',
    pill: 'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-success',
  },
  negative: {
    text: 'text-danger',
    pill: 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger',
  },
  neutral: { text: 'text-ink-faint', pill: 'bg-surface-muted text-ink-soft' },
} as const

/**
 * A change, as a sign, a figure and an arrow — “+12.4%”, “−3 pts”.
 *
 * Direction and judgement are kept apart. The arrow always follows the sign,
 * because a latency that fell should point down; `inverse` only changes the
 * colour, so falling latency is green. Mixing the two — an up arrow for a good
 * fall — is how dashboards end up misread.
 *
 * The glyphs and the typographic minus are hidden from assistive tech, which
 * hears “down 3.2 percent vs last week” instead of “minus sign three point two”.
 * Colour is never the only signal: the sign and the arrow say it too.
 */
export function TrendDelta({
  value,
  format = 'percent',
  decimals = 1,
  unit,
  inverse = false,
  tone = 'auto',
  flatThreshold = 0,
  context,
  showContext = true,
  showArrow = true,
  size = 'sm',
  variant = 'text',
  locale,
  className,
}: TrendDeltaProps) {
  const magnitude = Math.abs(value)
  const direction = magnitude <= flatThreshold ? 'flat' : value > 0 ? 'up' : 'down'
  const good = direction === 'flat' ? 'neutral' : (direction === 'up') !== inverse ? 'positive' : 'negative'
  const resolved = tone === 'auto' ? good : tone

  const figure = magnitude.toLocaleString(locale, { maximumFractionDigits: decimals })
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  const suffix = format === 'percent' ? '%' : unit ? ` ${unit}` : ''
  const spoken = [
    direction === 'flat' ? 'no change,' : direction,
    figure,
    format === 'percent' ? 'percent' : unit,
    context,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap font-bold leading-none tabular-nums',
        size === 'sm' ? 'text-[12px]' : 'text-[13px]',
        variant === 'pill' ? cn('rounded-full px-2 py-1', TONES[resolved].pill) : TONES[resolved].text,
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {showArrow && (
          <svg
            viewBox="0 0 16 16"
            width={size === 'sm' ? 12 : 14}
            height={size === 'sm' ? 12 : 14}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={ARROWS[direction]} />
          </svg>
        )}
        {sign}
        {figure}
        {suffix}
      </span>
      {context && showContext && (
        <span aria-hidden="true" className="font-medium text-ink-faint">
          {context}
        </span>
      )}
      <span className="sr-only">{spoken}</span>
    </span>
  )
}
