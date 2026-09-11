import { cn } from '../../lib/cn'
import { ProgressRing, type ProgressRingSize } from '../ProgressRing'
import { Text } from '../Text'

export interface RadialGaugeProps {
  value: number
  min?: number
  max?: number
  /** What is being measured. Becomes the accessible name. */
  label: string
  /** Unit shown after the figure, e.g. a percent sign. */
  unit?: string
  /** Ring size: 36, 56 or 88px across. */
  size?: ProgressRingSize
  /** Show the min and max under the arc. */
  showScale?: boolean
  /** Format the centre figure. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * ProgressRing with a readout and an optional scale. The ring alone shows the
 * shape; the figure in the middle is what makes it readable to the digit.
 */
export function RadialGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  size = 'lg',
  showScale = true,
  format = (next) => String(Math.round(next)),
  className,
}: RadialGaugeProps) {
  const span = max - min || 1
  const normalised = ((Math.min(max, Math.max(min, value)) - min) / span) * 100

  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <ProgressRing value={normalised} label={label} size={size}>
        <span className="flex items-baseline">
          <Text as="span" size={size === 'sm' ? 'caption' : 'stat'} tabular>
            {format(value)}
          </Text>
          {unit && (
            <Text as="span" size="caption" tone="faint">
              {unit}
            </Text>
          )}
        </span>
      </ProgressRing>
      {showScale && (
        <div className="flex w-full items-center justify-between gap-3">
          <Text as="span" size="caption" tone="faint" tabular>
            {format(min)}
          </Text>
          <Text as="span" size="caption" tone="faint" tabular>
            {format(max)}
          </Text>
        </div>
      )}
    </div>
  )
}
