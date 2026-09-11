'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Switch } from '../Switch'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { EmptyState } from '../EmptyState'
import { ConfirmDialog } from '../ConfirmDialog'
import { relativeTime } from '../../lib/time'
import { StatusPill } from '../internal/StatusPill'

export interface WebhookEndpoint {
  id: string
  url: string
  description?: string
  /** Event types delivered here — "invoice.paid". */
  events: string[]
  enabled: boolean
  /** Recent deliveries are failing — the endpoint is live but broken. */
  failing?: boolean
  lastDelivery?: { ok: boolean; at: Date; statusCode?: number }
}

export interface WebhookEndpointsProps {
  endpoints: WebhookEndpoint[]
  onAdd?: () => void
  onToggle?: (id: string, enabled: boolean) => void
  onDelete?: (endpoint: WebhookEndpoint) => void | Promise<void>
  onTest?: (endpoint: WebhookEndpoint) => void
  /** Open the delivery log for an endpoint. */
  onView?: (endpoint: WebhookEndpoint) => void
  /** The endpoint whose deliveries are shown beside the list. */
  selectedId?: string
  title?: string
  description?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The webhook endpoints a workspace sends events to.
 *
 * Three states, not two. "Enabled" says nothing about whether the receiver is
 * answering; an endpoint that has returned 500 for a day is live and broken,
 * and it is shown as failing, with its last response, on its own row. That is
 * the fact that turns "why did the integration stop?" from a support ticket
 * into a glance.
 */
export function WebhookEndpoints({
  endpoints,
  onAdd,
  onToggle,
  onDelete,
  onTest,
  onView,
  selectedId,
  title = 'Webhooks',
  description,
  headingLevel: Heading = 'h2',
  className,
}: WebhookEndpointsProps) {
  const [pending, setPending] = useState<WebhookEndpoint | null>(null)
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState<string | null>(null)

  const remove = async () => {
    if (!pending || !onDelete) return
    setBusy(true)
    try {
      await onDelete(pending)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Heading className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</Heading>
          {description && (
            <Text size="label" weight="medium" tone="soft" leading="normal" className="max-w-[60ch]">
              {description}
            </Text>
          )}
        </div>
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            Add endpoint
          </Button>
        )}
      </div>

      {endpoints.length === 0 ? (
        <EmptyState
          size="sm"
          title="No endpoints yet"
          description="Add a URL and choose which events are sent to it."
          className="rounded-[var(--radius-card)] border border-dashed border-line-strong"
        />
      ) : (
        <Surface as="ul" aria-label={title} variant="card" className="divide-y divide-line">
          {endpoints.map((endpoint) => {
            const state = !endpoint.enabled
              ? { tone: 'neutral' as const, label: 'Disabled' }
              : endpoint.failing
                ? { tone: 'danger' as const, label: 'Failing' }
                : { tone: 'success' as const, label: 'Active' }
            const last = endpoint.lastDelivery

            return (
              <li
                key={endpoint.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4',
                  endpoint.id === selectedId && 'bg-surface-sunken',
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <code className="min-w-0 truncate font-mono text-[12px] font-bold text-ink">{endpoint.url}</code>
                    <StatusPill tone={state.tone}>{state.label}</StatusPill>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {endpoint.events.slice(0, 3).map((event) => (
                      <Tag key={event} size="sm" tone="outline">
                        {event}
                      </Tag>
                    ))}
                    {endpoint.events.length > 3 && <Tag size="sm">+{endpoint.events.length - 3} more</Tag>}
                  </div>
                  <Text size="caption" tone={last && !last.ok ? 'danger' : 'faint'}>
                    {last
                      ? `${last.ok ? 'Last delivery' : 'Last delivery failed'}${last.statusCode ? ` (${last.statusCode})` : last.ok ? '' : ' (no response)'} · ${relativeTime(last.at)}`
                      : 'Nothing delivered yet'}
                    {endpoint.description ? ` · ${endpoint.description}` : ''}
                  </Text>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {onToggle && (
                    <Switch
                      switchSize="sm"
                      checked={endpoint.enabled}
                      onChange={(event) => onToggle(endpoint.id, event.target.checked)}
                      aria-label={`Send events to ${endpoint.url}`}
                      className="mr-2"
                    />
                  )}
                  {onTest && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!endpoint.enabled}
                      onClick={() => {
                        onTest(endpoint)
                        setTested(endpoint.id)
                      }}
                    >
                      {tested === endpoint.id ? 'Test sent' : 'Send test'}
                    </Button>
                  )}
                  {onView && (
                    <Button size="sm" variant="outline" onClick={() => onView(endpoint)}>
                      Deliveries
                      <VisuallyHidden> for {endpoint.url}</VisuallyHidden>
                    </Button>
                  )}
                  {onDelete && (
                    <Button size="sm" variant="ghost" onClick={() => setPending(endpoint)} className="hover:text-danger">
                      Delete
                      <VisuallyHidden> {endpoint.url}</VisuallyHidden>
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </Surface>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void remove()}
        destructive
        busy={busy}
        title="Delete this endpoint?"
        description={`${pending?.url ?? ''} will stop receiving events immediately. Deliveries already queued are dropped.`}
        confirmLabel="Delete endpoint"
      />
    </section>
  )
}
