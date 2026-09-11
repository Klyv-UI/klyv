'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { CodeBlock } from '../CodeBlock'
import { Collapse } from '../Collapse'
import { SegmentedControl } from '../SegmentedControl'
import { ChevronDownIcon } from '../internal/icons'
import { relativeTime } from '../../lib/time'

export interface WebhookDelivery {
  id: string
  /** "invoice.paid". */
  event: string
  at: Date
  /** The receiver's HTTP status. null is a timeout or a refused connection. */
  statusCode: number | null
  durationMs?: number
  /** Which attempt this was — retries count up. */
  attempt?: number
  /** The payload that was sent. */
  request?: string
  /** What came back. */
  response?: string
}

export interface WebhookDeliveriesProps {
  deliveries: WebhookDelivery[]
  onRetry?: (delivery: WebhookDelivery) => void
  label?: string
  className?: string
}

const ok = (delivery: WebhookDelivery) =>
  delivery.statusCode !== null && delivery.statusCode >= 200 && delivery.statusCode < 300

/**
 * The delivery log for one endpoint — what was sent, what came back, and a way
 * to send it again.
 *
 * Every row opens to the exact payload and response, because debugging a
 * webhook without the body is guessing. A timeout is its own outcome, not a
 * status code of zero, and "Failed only" is one tap away since that is the
 * list anyone opens this to read.
 */
export function WebhookDeliveries({ deliveries, onRetry, label = 'Deliveries', className }: WebhookDeliveriesProps) {
  const baseId = useId()
  const [filter, setFilter] = useState<'all' | 'failed'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [retried, setRetried] = useState<string[]>([])

  const failedCount = deliveries.filter((delivery) => !ok(delivery)).length
  const visible = filter === 'failed' ? deliveries.filter((delivery) => !ok(delivery)) : deliveries

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Show deliveries"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'all', label: `All · ${deliveries.length}` },
            { value: 'failed', label: `Failed · ${failedCount}` },
          ]}
        />
      </div>

      <Surface as="ul" aria-label={label} variant="card" className="divide-y divide-line">
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center">
            <Text size="label" tone="faint">
              {filter === 'failed' ? 'No failed deliveries. Everything is arriving.' : 'Nothing has been delivered yet.'}
            </Text>
          </li>
        )}
        {visible.map((delivery) => {
          const success = ok(delivery)
          const expanded = open === delivery.id
          const panelId = `${baseId}-${delivery.id}`
          return (
            <li key={delivery.id}>
              <div className="flex items-center gap-2 pr-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(expanded ? null : delivery.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-12 shrink-0 items-center justify-center rounded-full px-2 font-mono text-[11px] font-bold',
                      success ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger',
                    )}
                  >
                    {delivery.statusCode ?? 'Timeout'}
                    <VisuallyHidden>{success ? ', delivered' : ', failed'}</VisuallyHidden>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <code className="truncate font-mono text-[12px] font-bold text-ink">{delivery.event}</code>
                    <Text as="span" size="caption" tone="faint">
                      {relativeTime(delivery.at)}
                      {delivery.durationMs !== undefined && ` · ${delivery.durationMs} ms`}
                      {delivery.attempt && delivery.attempt > 1 && ` · attempt ${delivery.attempt}`}
                    </Text>
                  </span>
                  <ChevronDownIcon size={14} className={cn('shrink-0 text-ink-faint transition-transform', expanded && 'rotate-180')} />
                </button>
                {!success && onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retried.includes(delivery.id)}
                    onClick={() => {
                      onRetry(delivery)
                      setRetried((current) => [...current, delivery.id])
                    }}
                  >
                    {retried.includes(delivery.id) ? 'Queued' : 'Retry'}
                    <VisuallyHidden> {delivery.event}</VisuallyHidden>
                  </Button>
                )}
              </div>
              <Collapse open={expanded} id={panelId}>
                <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Tag size="sm" className="self-start">
                      Request
                    </Tag>
                    <CodeBlock code={delivery.request ?? '—'} language="json" copyable />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Tag size="sm" className="self-start">
                      Response
                    </Tag>
                    <CodeBlock code={delivery.response ?? (delivery.statusCode === null ? 'No response before the 10 s timeout.' : '—')} copyable />
                  </div>
                </div>
              </Collapse>
            </li>
          )
        })}
      </Surface>
    </div>
  )
}
