'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { ConfirmDialog } from '../ConfirmDialog'
import { SearchField } from '../SearchField'
import { Slider } from '../Slider'
import { Surface } from '../Surface'
import { Switch } from '../Switch'
import { Text } from '../Text'
import { StatusPill } from '../internal/StatusPill'

export interface FeatureFlagsEnvironment {
  id: string
  /** Short label beside the switch — “Dev”, “Prod”. */
  label: string
  /** Turning the flag on here asks for confirmation first. */
  protected?: boolean
}

export interface FeatureFlagsFlag {
  /** The key code checks — `new-billing-page`. */
  key: string
  description?: string
  /** Environment id → whether the flag is on there. */
  enabled: Record<string, boolean>
  /** Share of traffic that gets the flag where it is on, 0–100. */
  rollout: number
  /** Unchanged for long enough that it is probably dead code. */
  stale?: boolean
}

export interface FeatureFlagsProps {
  flags: FeatureFlagsFlag[]
  onToggle: (key: string, environment: string, enabled: boolean) => void
  onRolloutChange?: (key: string, rollout: number) => void
  /** Columns of switches, in order. Production is protected by default. */
  environments?: FeatureFlagsEnvironment[]
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_ENVIRONMENTS: FeatureFlagsEnvironment[] = [
  { id: 'development', label: 'Dev' },
  { id: 'staging', label: 'Staging' },
  { id: 'production', label: 'Prod', protected: true },
]

/**
 * The flags a team is shipping behind, with a switch per environment and a
 * rollout slider for the share of traffic that sees each one.
 *
 * Turning a flag on in a protected environment asks first, and names the flag
 * and the rollout in the question. Everything else toggles instantly: the point
 * of flags in development is that flipping them is cheap, and a confirmation on
 * every switch trains people to click through the one that matters. Turning a
 * flag off in production never asks — off is how you stop an incident.
 *
 * Flags nobody has touched in a long time get a Stale marker, because a flag
 * that is fully rolled out and forgotten is a branch in the code that no longer
 * does anything but cost a reader.
 */
export function FeatureFlags({ flags, onToggle, onRolloutChange, environments = DEFAULT_ENVIRONMENTS, className }: FeatureFlagsProps) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<{ key: string; environment: FeatureFlagsEnvironment; rollout: number } | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = needle ? flags.filter((flag) => `${flag.key} ${flag.description ?? ''}`.toLowerCase().includes(needle)) : flags

  const toggle = (flag: FeatureFlagsFlag, environment: FeatureFlagsEnvironment, next: boolean) => {
    if (next && environment.protected) setPending({ key: flag.key, environment, rollout: flag.rollout })
    else onToggle(flag.key, environment.id, next)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SearchField label="Search flags" placeholder="Search flags" value={query} onValueChange={setQuery} clearable />
      <Text as="p" size="caption" tone="faint" role="status">
        {needle ? `${visible.length} of ${flags.length} flags` : `${flags.length} flags`}
      </Text>

      {visible.length === 0 ? (
        <Surface variant="sunken" padding="lg" className="text-center">
          <Text size="body" weight="semibold" tone="soft">
            No flags match “{query.trim()}”.
          </Text>
        </Surface>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {visible.map((flag) => (
            <li key={flag.key} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-[13px] font-bold text-ink">{flag.key}</code>
                  {flag.stale && <StatusPill tone="warning">Stale</StatusPill>}
                </div>
                {flag.description && (
                  <Text size="caption" tone="soft" leading="normal">
                    {flag.description}
                  </Text>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {environments.map((environment) => (
                  <label key={environment.id} className="inline-flex cursor-pointer items-center gap-2">
                    <Switch
                      switchSize="sm"
                      checked={flag.enabled[environment.id] ?? false}
                      onChange={(event) => toggle(flag, environment, event.target.checked)}
                      aria-label={`${flag.key} in ${environment.label}`}
                    />
                    <Text as="span" size="label" weight="semibold" tone="soft" aria-hidden="true">
                      {environment.label}
                    </Text>
                  </label>
                ))}
                {onRolloutChange && (
                  <div className="flex w-44 items-center gap-2.5">
                    <Slider
                      value={flag.rollout}
                      min={0}
                      max={100}
                      step={5}
                      aria-label={`Rollout for ${flag.key}`}
                      aria-valuetext={`${flag.rollout}% of traffic`}
                      onChange={(event) => onRolloutChange(flag.key, Number(event.target.value))}
                    />
                    <Text as="span" size="label" weight="bold" tabular className="w-10 text-right">
                      {flag.rollout}%
                    </Text>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onToggle(pending.key, pending.environment.id, true)
          setPending(null)
        }}
        title={`Enable ${pending?.key ?? 'flag'} in ${pending?.environment.label ?? 'production'}?`}
        description={`This reaches real users immediately${pending ? ` — ${pending.rollout}% of traffic` : ''}. You can turn it off again at any time.`}
        confirmLabel="Enable"
      />
    </div>
  )
}
