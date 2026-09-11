import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface ChartTooltipRow {
  label: string
  value: string
  /** Series swatch colour. Any CSS colour. */
  color?: string
}

export interface ChartTooltipProps {
  /** Category or timestamp for the hovered point. */
  title?: string
  rows: ChartTooltipRow[]
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The panel shown for a hovered data point. It is presentational only — charts
 * own their own hit-testing and positioning, and simply render this where the
 * pointer is.
 *
 * It is aria-hidden: a chart must expose its values through an accessible
 * summary or table, not through a tooltip that only appears on hover.
 */
export function ChartTooltip({ title, rows, className }: ChartTooltipProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none min-w-[132px] rounded-[var(--radius-glyph)] border border-line bg-surface p-2.5',
        'shadow-[var(--shadow-float)]',
        className,
      )}
    >
      {title && (
        <Text size="caption" weight="bold" tone="faint" className="mb-1.5">
          {title}
        </Text>
      )}
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            {row.color && (
              <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
            )}
            <Text as="span" size="caption" weight="medium" tone="soft" className="min-w-0 flex-1 truncate">
              {row.label}
            </Text>
            <Text as="span" size="caption" weight="bold" tabular>
              {row.value}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}
