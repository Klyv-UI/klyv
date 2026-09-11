import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface FunnelStep {
  id: string
  label: string
  value: number
}

export interface FunnelChartProps {
  /** The steps, in the order people pass through them. */
  steps: FunnelStep[]
  /** Accessible name for the funnel. */
  label: string
  /** Turns a count into its printed figure. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const plain = (value: number) => value.toLocaleString()
const percent = (ratio: number) => `${Math.round(ratio * 1000) / 10}%`

/**
 * A conversion funnel: how many started, and how many made it through each step.
 *
 * Every bar is measured against the first step, so its length answers "what
 * share of everyone got this far". The line between two steps answers the
 * other question — "of those who reached the last one, how many continued" —
 * which is the number a team can actually move. It is an ordered list of real
 * text, read in sequence and copyable; the bars are decoration.
 */
export function FunnelChart({ steps, label, format = plain, className }: FunnelChartProps) {
  const start = Math.max(steps[0]?.value ?? 0, 1)

  return (
    <ol aria-label={label} className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].value : 0
        const share = step.value / start

        return (
          <li key={step.id} className="flex flex-col gap-1.5">
            {previous > 0 && (
              <div className="flex items-center gap-2 py-1.5 pl-1">
                <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
                <Text as="span" size="micro" weight="semibold" tone="faint" tabular>
                  {percent(step.value / previous)} continued · {format(previous - step.value)} dropped
                </Text>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3">
              <Text as="span" size="label" weight="semibold">
                {step.label}
              </Text>
              <span className="flex items-baseline gap-2">
                <Text as="span" size="label" weight="bold" tabular>
                  {format(step.value)}
                </Text>
                <Text as="span" size="micro" weight="semibold" tone="faint" tabular>
                  {percent(share)}
                </Text>
              </span>
            </div>

            <div aria-hidden="true" className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <span
                className="block h-full rounded-full bg-accent-strong"
                style={{ width: `${Math.min(100, share * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
