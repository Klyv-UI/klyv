import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface LegendSeries {
  label: string
  /** Any CSS colour. Prefer a token, e.g. var(--color-accent-strong). */
  color: string
  /** Optional figure shown after the label. */
  value?: string
}

export interface LegendProps {
  series: LegendSeries[]
  orientation?: 'horizontal' | 'vertical'
  /** Accessible name for the key. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The series key shared by every chart. Swatches are decorative — the label
 * beside each one is what identifies the series, so colour is never the only
 * carrier of meaning.
 */
export function Legend({ series, orientation = 'horizontal', label, className }: LegendProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'flex list-none gap-x-4 gap-y-1.5',
        orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center',
        className,
      )}
    >
      {series.map((entry) => (
        <li key={entry.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: entry.color }}
          />
          <Text as="span" size="caption" weight="medium" tone="soft">
            {entry.label}
          </Text>
          {entry.value && (
            <Text as="span" size="caption" weight="bold" tabular>
              {entry.value}
            </Text>
          )}
        </li>
      ))}
    </ul>
  )
}
