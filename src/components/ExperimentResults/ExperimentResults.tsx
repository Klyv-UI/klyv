'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Text } from '../Text'

export interface ExperimentResultsVariant {
  id: string
  name: string
  visitors: number
  conversions: number
  /** The baseline every other variant is compared with. Defaults to the first. */
  control?: boolean
}

export type ExperimentResultsAlpha = 0.1 | 0.05 | 0.01

export interface ExperimentResultsProps {
  variants: ExperimentResultsVariant[]
  /** What a conversion is — “sign-ups”, “purchases”. */
  metric?: string
  /** Significance level, controlled. */
  alpha?: ExperimentResultsAlpha
  /** Initial significance level when uncontrolled. */
  defaultAlpha?: ExperimentResultsAlpha
  /** Called when the reader picks another confidence level. */
  onAlphaChange?: (alpha: ExperimentResultsAlpha) => void
  /** Initial minimum detectable effect, relative (0.1 = a 10% lift). */
  defaultMinimumEffect?: number
  /** Statistical power for the sample size. */
  power?: number
  /** Merged last, so it wins. */
  className?: string
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 on erf, error < 1.5e-7). */
function cdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/** Inverse standard normal CDF (Acklam’s rational approximation, relative error < 1.2e-9). */
function inverse(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const low = 0.02425
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - low) return -inverse(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Wilson score interval — honest at small counts and near 0% or 100%, where p ± z·se is not. */
function wilson(conversions: number, visitors: number, z: number): [number, number] {
  if (!visitors) return [0, 0]
  const p = conversions / visitors
  const z2 = z * z
  const centre = (p + z2 / (2 * visitors)) / (1 + z2 / visitors)
  const half = (z * Math.sqrt((p * (1 - p)) / visitors + z2 / (4 * visitors * visitors))) / (1 + z2 / visitors)
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}

interface Comparison {
  lift: number
  liftInterval: [number, number]
  p: number
  significant: boolean
}

/** Pooled two-proportion z-test, and a log-ratio (delta method) interval for the relative lift. */
function compare(control: ExperimentResultsVariant, variant: ExperimentResultsVariant, alpha: number, z: number): Comparison | null {
  const p1 = control.conversions / control.visitors
  const p2 = variant.conversions / variant.visitors
  if (!control.visitors || !variant.visitors || !p1) return null
  const pooled = (control.conversions + variant.conversions) / (control.visitors + variant.visitors)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / control.visitors + 1 / variant.visitors))
  const p = se ? 2 * (1 - cdf(Math.abs((p2 - p1) / se))) : 1
  const lift = p2 / p1 - 1
  const logSe = p2 ? Math.sqrt((1 - p1) / (control.visitors * p1) + (1 - p2) / (variant.visitors * p2)) : Infinity
  const liftInterval: [number, number] = p2 ? [Math.exp(Math.log(p2 / p1) - z * logSe) - 1, Math.exp(Math.log(p2 / p1) + z * logSe) - 1] : [-1, -1]
  return { lift, liftInterval, p, significant: p < alpha }
}

/** Visitors per variant to detect a relative lift `effect` from rate `base` (two-sided). */
function sampleSize(base: number, effect: number, alpha: number, power: number) {
  const target = base * (1 + effect)
  if (base <= 0 || target >= 1 || effect <= 0) return Infinity
  const mean = (base + target) / 2
  const za = inverse(1 - alpha / 2)
  const zb = inverse(power)
  const top = za * Math.sqrt(2 * mean * (1 - mean)) + zb * Math.sqrt(base * (1 - base) + target * (1 - target))
  return Math.ceil((top * top) / ((target - base) * (target - base)))
}

const percent = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`
const pValue = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))

const ALPHAS: { value: string; label: string }[] = [
  { value: '0.1', label: '90%' },
  { value: '0.05', label: '95%' },
  { value: '0.01', label: '99%' },
]

/**
 * An A/B (or A/B/n) test readout that does the statistics and then says what
 * they mean.
 *
 * Each variant’s rate carries a Wilson interval; each challenger is compared
 * with the control by a pooled two-proportion z-test, with the relative lift
 * and its interval. With more than one challenger the significance level is
 * Bonferroni-corrected, because three comparisons at 95% find a false winner
 * one time in seven. The required sample per variant for the chosen minimum
 * detectable effect is worked out from the control’s rate, so “not
 * significant” is split into its two very different meanings: keep going, or
 * there is no effect of that size to find. The recommendation at the top says
 * which, in a sentence.
 */
export function ExperimentResults({
  variants,
  metric = 'conversions',
  alpha: controlledAlpha,
  defaultAlpha = 0.05,
  onAlphaChange,
  defaultMinimumEffect = 0.1,
  power = 0.8,
  className,
}: ExperimentResultsProps) {
  const id = useId()
  const [ownAlpha, setOwnAlpha] = useState<ExperimentResultsAlpha>(defaultAlpha)
  const [effectText, setEffectText] = useState(String(Math.round(defaultMinimumEffect * 1000) / 10))
  const alpha = controlledAlpha ?? ownAlpha
  const control = variants.find((variant) => variant.control) ?? variants[0]
  const challengers = variants.filter((variant) => variant !== control)
  const corrected = alpha / Math.max(1, challengers.length)
  const z = inverse(1 - corrected / 2)
  const effect = Number.parseFloat(effectText) / 100
  const effectValid = Number.isFinite(effect) && effect > 0 && effect < 10

  if (!control) return null

  const baseRate = control.visitors ? control.conversions / control.visitors : 0
  const needed = effectValid ? sampleSize(baseRate, effect, corrected, power) : Infinity
  const smallest = Math.min(...variants.map((variant) => variant.visitors))
  const results = challengers.map((variant) => ({ variant, comparison: compare(control, variant, corrected, z) }))
  const intervals = variants.map((variant) => wilson(variant.conversions, variant.visitors, z))
  const scaleMax = Math.max(...intervals.map(([, high]) => high), 0.0001) * 1.1

  const winners = results.filter((result) => result.comparison?.significant && result.comparison.lift > 0).sort((a, b) => (b.comparison?.lift ?? 0) - (a.comparison?.lift ?? 0))
  const losers = results.filter((result) => result.comparison?.significant && result.comparison.lift < 0)
  const confidence = `${Math.round((1 - alpha) * 100)}%`

  let verdict: { tone: 'success' | 'danger' | 'neutral'; text: string }
  if (winners.length) {
    const best = winners[0]
    verdict = {
      tone: 'success',
      text: `${best.variant.name} wins: ${signed(best.comparison!.lift)} ${metric} against ${control.name} (p = ${pValue(best.comparison!.p)}, ${confidence} confidence).${smallest < needed && Number.isFinite(needed) ? ' It reached significance before the planned sample, so the true lift is likely smaller than this.' : ' Ship it.'}`,
    }
  } else if (losers.length === challengers.length && challengers.length) {
    verdict = { tone: 'danger', text: `${losers.map((result) => result.variant.name).join(' and ')} ${losers.length === 1 ? 'performs' : 'perform'} worse than ${control.name}. Stop the test and keep the control.` }
  } else if (!effectValid || !Number.isFinite(needed)) {
    verdict = { tone: 'neutral', text: 'No significant difference yet. Enter a minimum effect to see how many visitors the test needs.' }
  } else if (smallest < needed) {
    verdict = { tone: 'neutral', text: `No significant difference yet. Keep it running: each variant needs about ${needed.toLocaleString()} visitors to detect a ${percent(effect, 0)} lift — about ${(needed - smallest).toLocaleString()} more for the smallest.` }
  } else {
    verdict = { tone: 'neutral', text: `The test has enough traffic to detect a ${percent(effect, 0)} lift and found none. The variants are equivalent at that size — choose on other grounds.` }
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      <div
        role="status"
        className={cn(
          'rounded-[var(--radius-tile)] px-4 py-3 text-[13px] font-semibold leading-normal',
          verdict.tone === 'success' && 'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-[color-mix(in_oklab,var(--color-success)_55%,var(--color-ink))]',
          verdict.tone === 'danger' && 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger',
          verdict.tone === 'neutral' && 'bg-surface-sunken text-ink',
        )}
      >
        {verdict.text}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Text as="span" size="caption" weight="semibold" tone="soft" aria-hidden="true">Confidence</Text>
          <SegmentedControl
            label="Confidence level"
            size="sm"
            value={String(alpha)}
            options={ALPHAS}
            onValueChange={(value) => {
              const next = Number(value) as ExperimentResultsAlpha
              if (controlledAlpha === undefined) setOwnAlpha(next)
              onAlphaChange?.(next)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-effect`} className="text-[11px] font-semibold text-ink-soft">Minimum detectable lift (%)</label>
          <Input id={`${id}-effect`} inputSize="sm" type="number" min={0.1} step={0.5} value={effectText} invalid={!effectValid} onChange={(event) => setEffectText(event.target.value)} className="w-28" />
        </div>
        <Text size="caption" tone="faint" leading="normal" className="max-w-[260px]">
          {`Needed per variant: ${Number.isFinite(needed) ? needed.toLocaleString() : '—'} at ${Math.round(power * 100)}% power${challengers.length > 1 ? `, α corrected to ${corrected.toFixed(3)} for ${challengers.length} comparisons` : ''}.`}
        </Text>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-tile)] border border-line">
        <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
          <caption className="sr-only">{`Results by variant, compared with ${control.name}`}</caption>
          <thead>
            <tr className="border-b border-line text-ink-faint">
              {['Variant', 'Visitors', metric[0].toUpperCase() + metric.slice(1), 'Rate and interval', 'Lift vs control', 'p-value', ''].map((heading, index) => (
                <th key={index} scope="col" className="px-3 py-2 font-semibold">{heading || <span className="sr-only">Result</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const [low, high] = intervals[index]
              const rate = variant.visitors ? variant.conversions / variant.visitors : 0
              const comparison = results.find((result) => result.variant === variant)?.comparison
              const isControl = variant === control
              return (
                <tr key={variant.id} className="border-b border-line align-middle last:border-b-0">
                  <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                    {variant.name}
                    {isControl && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">control</span>}
                  </th>
                  <td className="px-3 py-2.5 tabular-nums text-ink-soft">{variant.visitors.toLocaleString()}</td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-soft">{variant.conversions.toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 font-semibold tabular-nums text-ink">{percent(rate)}</span>
                      <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="h-3 w-28 shrink-0" aria-hidden="true">
                        <rect x={0} y={5.5} width={100} height={1} className="fill-line" />
                        <rect x={(low / scaleMax) * 100} y={3} width={Math.max(1, ((high - low) / scaleMax) * 100)} height={6} rx={3} className={isControl ? 'fill-ink-faint' : 'fill-accent'} />
                        <rect x={(rate / scaleMax) * 100 - 0.75} y={1} width={1.5} height={10} className="fill-ink" />
                      </svg>
                      <span className="tabular-nums text-ink-faint">{`${percent(low, 1)} – ${percent(high, 1)}`}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {comparison ? (
                      <span className="flex flex-col">
                        <span className={cn('font-semibold', comparison.significant ? (comparison.lift > 0 ? 'text-success' : 'text-danger') : 'text-ink')}>{signed(comparison.lift)}</span>
                        <span className="text-[11px] text-ink-faint">{`${signed(comparison.liftInterval[0])} to ${signed(comparison.liftInterval[1])}`}</span>
                      </span>
                    ) : (
                      <span className="text-ink-faint">{isControl ? 'baseline' : '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-soft">{comparison ? pValue(comparison.p) : '—'}</td>
                  <td className="px-3 py-2.5">
                    {comparison && (
                      <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', comparison.significant ? (comparison.lift > 0 ? 'bg-[color-mix(in_oklab,var(--color-success)_16%,transparent)] text-[color-mix(in_oklab,var(--color-success)_55%,var(--color-ink))]' : 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger') : 'bg-surface-muted text-ink-soft')}>
                        {comparison.significant ? 'Significant' : 'Not significant'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Text size="caption" tone="faint" leading="normal">
        {`Intervals are ${Math.round((1 - corrected) * 1000) / 10}% Wilson intervals; lift intervals use the log of the rate ratio. p-values are two-sided.`}
      </Text>
    </div>
  )
}
