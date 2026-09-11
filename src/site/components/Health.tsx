import { Check } from 'lucide-react'
import { StatusDot, Text, type StatusDotTone } from 'citrine'
import { STATUS_LABELS, healthOf, type ComponentStatus } from '../data/health'

const STATUS_TONES: Record<ComponentStatus, StatusDotTone> = {
  stable: 'success',
  beta: 'warning',
  experimental: 'accent',
  deprecated: 'danger',
}

/**
 * Status and capabilities, under a component's title.
 *
 * Kept to one quiet line: the page is about the component, and this is a
 * fact about it rather than a headline. Each capability is only here because
 * something measured it, and the evidence is one click away — a claim a reader
 * cannot check is not worth making.
 */
export function HealthSummary({ name }: { name: string }) {
  const health = healthOf(name)
  if (!health) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={STATUS_TONES[health.status]} />
          <Text as="span" size="caption" weight="bold">
            {STATUS_LABELS[health.status]}
          </Text>
        </span>
        <span aria-hidden className="h-3 w-px bg-line-strong" />
        <ul aria-label="Capabilities" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {health.capabilities.map((capability) => (
            <li key={capability.id} className="inline-flex items-center gap-1">
              <Check size={12} strokeWidth={2.5} aria-hidden className="text-ink-faint" />
              <Text as="span" size="caption" weight="semibold" tone="soft">
                {capability.label}
              </Text>
            </li>
          ))}
        </ul>
      </div>

      <details className="group/evidence">
        <summary className="w-fit cursor-pointer list-none rounded-md text-[11.5px] font-bold text-ink-faint transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open/evidence:hidden">How is this measured?</span>
          <span className="hidden group-open/evidence:inline">Hide the evidence</span>
        </summary>
        <dl className="mt-2 flex max-w-[68ch] flex-col gap-1.5 border-l-2 border-line pl-3">
          <div>
            <dt className="inline">
              <Text as="span" size="caption" weight="bold">
                {STATUS_LABELS[health.status]}:{' '}
              </Text>
            </dt>
            <dd className="inline">
              <Text as="span" size="caption" tone="soft" leading="normal">
                {health.status === 'stable'
                  ? 'shipped in the public API of 1.0; nothing has been moved to beta, experimental or deprecated.'
                  : 'set in data/health.ts.'}
              </Text>
            </dd>
          </div>
          {health.capabilities.map((capability) => (
            <div key={capability.id}>
              <dt className="inline">
                <Text as="span" size="caption" weight="bold">
                  {capability.label}:{' '}
                </Text>
              </dt>
              <dd className="inline">
                <Text as="span" size="caption" tone="soft" leading="normal">
                  {capability.evidence}
                </Text>
              </dd>
            </div>
          ))}
          <Text size="caption" tone="faint" leading="normal">
            Responsive behaviour is not measured yet, so it is not claimed for any component.
          </Text>
        </dl>
      </details>
    </div>
  )
}
