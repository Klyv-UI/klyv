import { cn } from '../../lib/cn'

export type OdometerSize = 'sm' | 'md' | 'lg'

const SIZES: Record<OdometerSize, { text: string; height: number }> = {
  sm: { text: 'text-[14px]', height: 18 },
  md: { text: 'text-[22px]', height: 26 },
  lg: { text: 'text-[30px]', height: 34 },
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export interface OdometerProps {
  /** Value to display. Digits roll to their new position when it changes. */
  value: number
  /** Fixed decimal places. */
  decimals?: number
  /** Prefix such as a currency symbol. */
  prefix?: string
  /** Digit size, which sets both the type and the roll height. */
  size?: OdometerSize
  /** Accessible text. Defaults to the formatted value. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Digit-roll presentation of a number. Each digit is a strip that translates to
 * its target, so only the digits that actually changed appear to move.
 *
 * The rolling strips are hidden from assistive tech and the plain value is
 * exposed instead, so a screen reader reads one number rather than ten columns.
 */
export function Odometer({
  value,
  decimals = 0,
  prefix,
  size = 'md',
  label,
  className,
}: OdometerProps) {
  const { text, height } = SIZES[size]
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const characters = [...(value < 0 ? `-${formatted}` : formatted)]

  return (
    <span className={cn('inline-flex items-center font-extrabold leading-none', text, className)}>
      <span className="sr-only">{label ?? `${prefix ?? ''}${formatted}`}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {prefix && <span className="mr-0.5">{prefix}</span>}
        {characters.map((character, index) => {
          const digit = DIGITS.indexOf(character)
          if (digit === -1) {
            return (
              <span key={index} className="inline-block">
                {character}
              </span>
            )
          }
          return (
            <span
              key={index}
              className="inline-block overflow-hidden tabular"
              style={{ height }}
            >
              <span
                className="flex flex-col transition-transform duration-[var(--duration-slow)] ease-out"
                style={{ transform: `translateY(-${digit * height}px)` }}
              >
                {DIGITS.map((entry) => (
                  <span key={entry} className="flex items-center justify-center" style={{ height }}>
                    {entry}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
