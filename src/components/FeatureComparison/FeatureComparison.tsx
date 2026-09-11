'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { SegmentedControl } from '../SegmentedControl'
import { CheckIcon, MinusIcon } from '../internal/icons'

/** true / false for a tick or a dash; a string or number is printed as it is. */
export type ComparisonValue = boolean | string | number | null

export interface ComparisonPlan {
  id: string
  name: string
  /** Tint the column — the recommended plan. */
  highlight?: boolean
  /** A button under the plan name. */
  action?: ReactNode
}

export interface ComparisonRow {
  label: string
  hint?: string
  /** Keyed by plan id. */
  values: Record<string, ComparisonValue>
}

export interface ComparisonGroup {
  title: string
  rows: ComparisonRow[]
}

export interface FeatureComparisonProps {
  plans: ComparisonPlan[]
  groups: ComparisonGroup[]
  /** Caption for the table. */
  label: string
  className?: string
}

/**
 * The full plan-by-feature matrix under the pricing cards.
 *
 * It is a real table — plan names as column headers, features as row headers,
 * groups as `colgroup` headers — because this is precisely the content tables
 * exist for, and a grid of divs cannot answer "what does Team get for SSO?".
 *
 * On a phone a five-column matrix is unreadable at any font size, so below `sm`
 * it becomes one plan at a time, chosen from a segmented control. Scrolling a
 * table sideways with the feature names scrolled off is the usual answer, and
 * it is the one that loses the question being asked.
 */
export function FeatureComparison({ plans, groups, label, className }: FeatureComparisonProps) {
  const [mobilePlan, setMobilePlan] = useState(
    () => plans.find((plan) => plan.highlight)?.id ?? plans[0]?.id ?? '',
  )

  return (
    <div className={cn('w-full', className)}>
      {/* sm and up: the matrix */}
      <Surface variant="card" className="relative hidden overflow-x-auto sm:flex">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line">
              <td className="w-[34%] px-5 py-4" />
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn('px-4 py-4 align-bottom', plan.highlight && 'bg-accent-soft/40')}
                >
                  <div className="flex flex-col items-start gap-3">
                    <Text as="span" size="heading">
                      {plan.name}
                    </Text>
                    {plan.action}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="bg-surface-sunken px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint"
                >
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3.5 align-top font-normal">
                    <span className="flex flex-col gap-0.5">
                      <Text as="span" size="label" weight="semibold">
                        {row.label}
                      </Text>
                      {row.hint && (
                        <Text as="span" size="caption" tone="faint" leading="normal">
                          {row.hint}
                        </Text>
                      )}
                    </span>
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.id} className={cn('px-4 py-3.5 align-top', plan.highlight && 'bg-accent-soft/40')}>
                      <ComparisonCell value={row.values[plan.id] ?? null} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Surface>

      {/* Below sm: one plan at a time */}
      <div className="flex flex-col gap-4 sm:hidden">
        <SegmentedControl
          label="Plan to compare"
          size="sm"
          fullWidth
          value={mobilePlan}
          onValueChange={setMobilePlan}
          options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
        />
        <Surface variant="card" className="divide-y divide-line">
          {groups.map((group) => (
            <Fragment key={group.title}>
              <Text
                as="h3"
                size="caption"
                weight="bold"
                tone="faint"
                className="bg-surface-sunken px-4 py-2.5 uppercase tracking-wider first:rounded-t-[var(--radius-card)]"
              >
                {group.title}
              </Text>
              <dl className="divide-y divide-line">
                {group.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt>
                      <Text as="span" size="label" weight="semibold">
                        {row.label}
                      </Text>
                    </dt>
                    <dd className="m-0 shrink-0">
                      <ComparisonCell value={row.values[mobilePlan] ?? null} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Fragment>
          ))}
        </Surface>
      </div>
    </div>
  )
}

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <span className="inline-flex size-[20px] items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <CheckIcon size={12} strokeWidth={3} />
        <VisuallyHidden>Included</VisuallyHidden>
      </span>
    )
  }
  if (value === false || value === null) {
    return (
      <span className="inline-flex size-[20px] items-center justify-center text-ink-faint">
        <MinusIcon size={12} strokeWidth={2.5} />
        <VisuallyHidden>Not included</VisuallyHidden>
      </span>
    )
  }
  return (
    <Text as="span" size="label" weight="semibold" tabular>
      {value}
    </Text>
  )
}
