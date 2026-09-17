import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { CopyButton } from '../CopyButton'
import { CheckIcon } from '../internal/icons'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export type OrderTrackerStatus = 'ordered' | 'packed' | 'shipped' | 'out-for-delivery' | 'delivered'

export interface OrderTrackerProps {
  /** The step the shipment has reached. Every earlier step counts as complete. */
  status: OrderTrackerStatus
  /** When each reached step happened. Steps without one show no time. */
  timestamps?: Partial<Record<OrderTrackerStatus, Date>>
  /** Order reference shown in the header — "A-10482". */
  orderNumber?: string
  /** Shipping company — "DHL Express". */
  carrier?: string
  /** Carrier tracking number, with a copy button. */
  trackingNumber?: string
  /** Carrier tracking page. Makes the number a link. */
  trackingUrl?: string
  /** Expected delivery date, shown until the order is delivered. */
  estimatedDelivery?: Date
  /** Override step names, for another language or wording. */
  labels?: Partial<Record<OrderTrackerStatus, string>>
  /** Merged last, so it wins. */
  className?: string
}

const STEPS: OrderTrackerStatus[] = ['ordered', 'packed', 'shipped', 'out-for-delivery', 'delivered']

const LABELS: Record<OrderTrackerStatus, string> = {
  ordered: 'Ordered',
  packed: 'Packed',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Delivered',
}

const timeOf = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/**
 * Where a parcel is, as the five steps every carrier reduces to.
 *
 * It is an ordered list with `aria-current="step"` on the step reached, and
 * each step also says "complete", "current" or "upcoming" in words — the filled
 * dots carry that meaning visually and nothing else would carry it aloud. The
 * tracking number sits beside a copy button because the next thing anyone does
 * with it is paste it into the carrier’s site.
 *
 * The line runs across on wide screens and down on narrow ones, where five
 * labels side by side would wrap into each other.
 */
export function OrderTracker({
  status,
  timestamps = {},
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
  labels,
  className,
}: OrderTrackerProps) {
  const current = STEPS.indexOf(status)
  const delivered = status === 'delivered'

  return (
    <Surface variant="card" padding="lg" className={cn('gap-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Text size="caption" tone="faint">
            {orderNumber ? `Order ${orderNumber}` : 'Your order'}
          </Text>
          <Text size="subtitle">
            {delivered
              ? 'Delivered'
              : estimatedDelivery
                ? `Arriving ${formatDate(estimatedDelivery, false)}`
                : (labels?.[status] ?? LABELS[status])}
          </Text>
        </div>
        {(carrier || trackingNumber) && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-1">
              {carrier && (
                <Text size="caption" tone="faint">
                  {carrier}
                </Text>
              )}
              {trackingNumber && (
                <Text size="label" weight="semibold" tabular className="font-mono">
                  {trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                      {trackingNumber}
                    </a>
                  ) : (
                    trackingNumber
                  )}
                </Text>
              )}
            </div>
            {trackingNumber && <CopyButton value={trackingNumber} label="Copy tracking number" iconOnly />}
          </div>
        )}
      </div>

      <ol aria-label="Shipment progress" className="flex flex-col sm:flex-row">
        {STEPS.map((step, index) => {
          const done = index < current || (delivered && index === current)
          const isCurrent = index === current
          const at = index <= current ? timestamps[step] : undefined
          const state = done ? 'complete' : isCurrent ? 'current' : 'upcoming'
          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex flex-1 gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
            >
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[11px] top-6 h-[calc(100%-24px)] w-0.5 sm:left-[calc(50%+12px)] sm:top-[11px] sm:h-0.5 sm:w-[calc(100%-24px)]',
                    index < current ? 'bg-accent-strong' : 'bg-track',
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full',
                  done && 'bg-accent-strong text-accent-ink',
                  isCurrent && !done && 'bg-accent-soft ring-2 ring-accent-strong',
                  !done && !isCurrent && 'border-2 border-line-strong bg-surface',
                )}
              >
                {done ? <CheckIcon size={12} strokeWidth={3} /> : isCurrent && <span className="size-2 rounded-full bg-accent-strong" />}
              </span>
              <div className="flex flex-col gap-1 pt-0.5 sm:pt-0">
                <Text as="span" size="label" weight={isCurrent ? 'bold' : 'semibold'} tone={index > current ? 'faint' : 'default'}>
                  {labels?.[step] ?? LABELS[step]}
                  <VisuallyHidden>, {state}</VisuallyHidden>
                </Text>
                {at && (
                  <Text as="span" size="caption" tone="faint" tabular>
                    {formatDate(at, false)}, {timeOf(at)}
                  </Text>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Surface>
  )
}
