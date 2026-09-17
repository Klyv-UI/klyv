'use client'

import { useEffect, useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { DateRangePicker, type DateRange } from '../DateRangePicker'
import { InlineMessage } from '../InlineMessage'
import { SegmentedControl } from '../SegmentedControl'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { StatusPill } from '../internal/StatusPill'

export interface DataExportPanelDataset {
  id: string
  label: string
  /** What is in it — “Every invoice, with line items”. */
  description?: string
}

export type DataExportPanelStatus = 'queued' | 'processing' | 'ready' | 'expired' | 'failed'

export interface DataExportPanelExport {
  id: string
  /** Dataset ids included. */
  datasets: string[]
  format: string
  status: DataExportPanelStatus
  requestedAt: Date
  /** When the download link stops working. */
  expiresAt?: Date
  /** The file, once ready. */
  href?: string
  /** File size, already formatted — “4.2 MB”. */
  size?: string
}

export interface DataExportPanelRequest {
  datasets: string[]
  format: string
  /** ISO dates; both empty means everything. */
  range: DateRange
}

export interface DataExportPanelProps {
  /** What can be exported. */
  datasets: DataExportPanelDataset[]
  /** Previous exports, newest first. */
  exports: DataExportPanelExport[]
  /** Called with the request. A promise shows the pending state; a rejection its message. */
  onRequest: (request: DataExportPanelRequest) => void | Promise<void>
  /** File formats on offer. */
  formats?: { value: string; label: string }[]
  /** “Now”, for tests and previews. The countdown ticks from here each minute. */
  now?: Date
  /** Merged last, so it wins. */
  className?: string
}

const STATUS: Record<DataExportPanelStatus, { tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  processing: { tone: 'warning', label: 'Processing' },
  ready: { tone: 'success', label: 'Ready' },
  expired: { tone: 'neutral', label: 'Expired' },
  failed: { tone: 'danger', label: 'Failed' },
}

const DEFAULT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

function remaining(until: Date, now: number) {
  const minutes = Math.max(0, Math.round((until.getTime() - now) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} days`
}

/**
 * Asking for a copy of your data, and collecting it later.
 *
 * Exports are slow and asynchronous, so the request and its results live on
 * one panel: choose what, in which format and over which dates, then find it
 * in the list below as it moves from queued to ready. Every ready link shows
 * how long it has left, because a link that silently expires after 24 hours
 * turns into a support ticket. Nothing is exported until at least one dataset
 * is chosen, and an empty date range means everything rather than nothing.
 */
export function DataExportPanel({
  datasets,
  exports,
  onRequest,
  formats = DEFAULT_FORMATS,
  now: nowProp,
  className,
}: DataExportPanelProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [format, setFormat] = useState(formats[0]?.value ?? 'csv')
  const [range, setRange] = useState<DateRange>({})
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [tick, setTick] = useState(() => (nowProp ?? new Date()).getTime())
  const headingId = useId()
  const listHeadingId = useId()
  const rangeId = useId()

  // A countdown that updates each minute. Not an animation — the text changes.
  const nowMs = nowProp?.getTime()
  useEffect(() => {
    setTick(nowMs ?? Date.now())
    const timer = window.setInterval(() => setTick((value) => value + 60_000), 60_000)
    return () => window.clearInterval(timer)
  }, [nowMs])

  const labelFor = (id: string) => datasets.find((dataset) => dataset.id === id)?.label ?? id
  const all = selected.length === datasets.length && datasets.length > 0

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => (on ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id)))

  const request = async () => {
    setPending(true)
    setMessage(null)
    try {
      // Keep the caller's dataset order, not the order they were ticked in.
      await onRequest({ datasets: datasets.map((d) => d.id).filter((id) => selected.includes(id)), format, range })
      setMessage({ ok: true, text: 'Export requested. It will appear below, and we’ll email you when it’s ready.' })
      setSelected([])
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'The export could not be requested.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Surface variant="card" className={cn('flex flex-col divide-y divide-line', className)}>
      <section aria-labelledby={headingId} className="flex flex-col gap-4 p-5">
        <Text as="h3" id={headingId} size="heading">
          Request an export
        </Text>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0">
            <Text as="span" size="label" weight="semibold" tone="soft">
              Data to include
            </Text>
          </legend>
          <label className="flex cursor-pointer items-center gap-2.5 pb-1">
            <Checkbox
              boxSize="sm"
              checked={all}
              indeterminate={selected.length > 0 && !all}
              onChange={() => setSelected(all ? [] : datasets.map((dataset) => dataset.id))}
            />
            <Text as="span" size="caption" weight="semibold" tone="faint">
              Select all
            </Text>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {datasets.map((dataset) => {
              const on = selected.includes(dataset.id)
              return (
                <label
                  key={dataset.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-tile)] border p-3 transition-colors',
                    on ? 'border-accent-strong bg-accent-soft/40' : 'border-line hover:border-line-strong',
                  )}
                >
                  <Checkbox className="mt-0.5" checked={on} onChange={(event) => toggle(dataset.id, event.target.checked)} />
                  <span className="min-w-0">
                    <Text as="span" size="body" className="block">
                      {dataset.label}
                    </Text>
                    {dataset.description && (
                      <Text as="span" size="caption" tone="faint" leading="normal" className="block">
                        {dataset.description}
                      </Text>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Text as="span" size="label" weight="semibold" tone="soft">
              Format
            </Text>
            <SegmentedControl label="Format" value={format} onValueChange={setFormat} options={formats} />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor={rangeId} className="text-[12px] font-semibold text-ink-soft">
              Date range
            </label>
            <DateRangePicker id={rangeId} label="Date range" value={range} onValueChange={setRange} placeholder="All time" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {message ? (
            <InlineMessage tone={message.ok ? 'success' : 'danger'} live>
              {message.text}
            </InlineMessage>
          ) : (
            <InlineMessage>{selected.length ? `${selected.length} of ${datasets.length} datasets selected` : 'Choose at least one dataset.'}</InlineMessage>
          )}
          <Button onClick={() => void request()} loading={pending} disabled={selected.length === 0}>
            Request export
          </Button>
        </div>
      </section>

      <section aria-labelledby={listHeadingId} className="flex flex-col gap-3 p-5">
        <Text as="h3" id={listHeadingId} size="heading">
          Past exports
        </Text>
        {exports.length === 0 ? (
          <Text size="body" weight="medium" tone="faint" className="py-4">
            No exports yet. Requested exports appear here and stay downloadable for a limited time.
          </Text>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {exports.map((item) => {
              const expired = item.status === 'expired' || (item.status === 'ready' && item.expiresAt !== undefined && item.expiresAt.getTime() <= tick)
              const status = expired ? STATUS.expired : STATUS[item.status]
              const names = item.datasets.map(labelFor).join(', ')
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Text as="span" size="body" truncate>
                      {names}
                    </Text>
                    <Text as="span" size="caption" tone="faint">
                      {[`${item.format.toUpperCase()}`, `Requested ${formatDate(item.requestedAt)}`, item.size].filter(Boolean).join(' · ')}
                    </Text>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!expired && item.status === 'ready' && item.expiresAt && (
                      <Text as="span" size="caption" tone="faint">{`Expires in ${remaining(item.expiresAt, tick)}`}</Text>
                    )}
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    {!expired && item.status === 'ready' && item.href ? (
                      <Button as="a" href={item.href} download size="sm" variant="outline" aria-label={`Download ${names} (${item.format.toUpperCase()})`}>
                        Download
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Surface>
  )
}
