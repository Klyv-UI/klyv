'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Progress } from '../Progress'
import { Text } from '../Text'
import { CheckIcon, ChevronDownIcon, CrossIcon } from '../internal/icons'

export type UploadQueueStatus = 'queued' | 'uploading' | 'paused' | 'done' | 'error'

export interface UploadQueueFile {
  id: string
  name: string
  /** Size in bytes. */
  size: number
  /** Share uploaded, 0 to 1. */
  progress: number
  status: UploadQueueStatus
  /** Why it failed. Shown in place of the size line. */
  error?: string
}

export interface UploadQueueProps {
  files: UploadQueueFile[]
  /** Heading for the panel. Defaults to a count of what is uploading, failed or complete. */
  title?: string
  /** Accessible name for the region. Give each queue on a page its own. */
  label?: string
  /** Pin the panel to the bottom-right corner of the viewport. */
  floating?: boolean
  /** Controlled: whether the panel is collapsed to a pill. */
  collapsed?: boolean
  /** Whether the panel starts collapsed, when uncontrolled. */
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  /** Removes finished rows. Without it, the button is not shown. */
  onClearCompleted?: () => void
  /** Merged last, so it wins. */
  className?: string
}

function formatUploadBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const glyph = (path: React.ReactNode): IconComponent =>
  function UploadGlyph({ size = 16, strokeWidth = 2, className }) {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    )
  }
const PauseIcon = glyph(<path d="M5.5 3.5v9M10.5 3.5v9" />)
const PlayIcon = glyph(<path d="M5 3.5v9l7-4.5z" />)
const RetryIcon = glyph(<path d="M13 8a5 5 0 11-1.6-3.7M13 2.5V5h-2.5" />)

/**
 * Every upload in flight, in one panel that stays out of the way — per-file
 * progress and controls, the overall figure in the header, and a pill when
 * collapsed.
 *
 * Uploads outlive the screen that started them, so the queue is its own
 * surface rather than a row of progress bars in a form. The header carries the
 * whole-queue percentage weighted by bytes, not by file count: one 2 GB video
 * and nine thumbnails are not 90% done when the thumbnails finish. A failure
 * keeps its row with the reason and a retry, and finished rows stay until they
 * are cleared, so nothing leaves the list without the reader seeing it land.
 */
export function UploadQueue({
  files,
  title,
  label = 'Uploads',
  floating = false,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onClearCompleted,
  className,
}: UploadQueueProps) {
  const listId = useId()
  const pillId = useId()
  const collapseId = useId()
  const [collapsedState, setCollapsedState] = useState(defaultCollapsed)
  const collapsed = collapsedProp ?? collapsedState
  const toggled = useRef(false)
  const setCollapsed = (next: boolean) => {
    toggled.current = true
    if (collapsedProp === undefined) setCollapsedState(next)
    onCollapsedChange?.(next)
  }

  // The control that was pressed unmounts, so focus moves to the one that
  // replaced it rather than falling back to the page.
  useEffect(() => {
    if (!toggled.current) return
    toggled.current = false
    document.getElementById(collapsed ? pillId : collapseId)?.focus()
  }, [collapsed, pillId, collapseId])

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const sentBytes = files.reduce((sum, file) => sum + file.size * Math.min(1, Math.max(0, file.progress)), 0)
  const percent = totalBytes === 0 ? 0 : Math.round((sentBytes / totalBytes) * 100)
  const done = files.filter((file) => file.status === 'done').length
  const failed = files.filter((file) => file.status === 'error').length
  const remaining = files.length - done - failed
  const heading =
    title ??
    (remaining > 0
      ? `Uploading ${remaining} ${remaining === 1 ? 'file' : 'files'}`
      : failed > 0
        ? `${failed} ${failed === 1 ? 'upload' : 'uploads'} failed`
        : `${done} ${done === 1 ? 'upload' : 'uploads'} complete`)
  const summary = `${done} of ${files.length} uploaded${failed ? `, ${failed} failed` : ''}`

  const frame = cn(
    floating && 'fixed bottom-4 right-4 z-[var(--z-toast)] max-w-[calc(100vw-2rem)]',
    'shadow-[var(--shadow-float)]',
  )

  return (
    <section aria-label={label} className={cn(floating ? '' : 'w-full', className)}>
      {collapsed ? (
        <button
          id={pillId}
          type="button"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className={cn(
            frame,
            'inline-flex h-10 items-center gap-2.5 rounded-full border border-line bg-surface pl-2 pr-4 text-[12px] font-bold text-ink transition-colors hover:bg-surface-muted',
          )}
        >
          <span
            aria-hidden="true"
            className="relative flex size-7 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-accent-strong) ${percent * 3.6}deg, var(--color-track) 0deg)`,
            }}
          >
            <span className="absolute inset-[3px] rounded-full bg-surface" />
          </span>
          <span>{heading}</span>
          <span className="tabular text-ink-soft">{percent}%</span>
          <span className="sr-only">. Show uploads</span>
        </button>
      ) : (
        <div
          className={cn(
            frame,
            !floating && 'shadow-none',
            'flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface',
            floating && 'w-[360px]',
          )}
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Text size="body" weight="bold" truncate>
                  {heading}
                </Text>
                <Text as="span" size="caption" weight="semibold" tone="soft" tabular>
                  {percent}%
                </Text>
              </div>
              <Progress label="All uploads" value={percent} size="sm" />
            </div>
            <IconButton
              id={collapseId}
              icon={ChevronDownIcon}
              label="Collapse uploads"
              size="xs"
              aria-expanded
              aria-controls={listId}
              onClick={() => setCollapsed(true)}
            />
          </div>

          <ul id={listId} className="flex max-h-[320px] list-none flex-col overflow-y-auto border-t border-line">
            {files.map((file) => {
              const sent = file.size * Math.min(1, Math.max(0, file.progress))
              return (
                <li key={file.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Text size="label" weight="semibold" truncate className="min-w-0 flex-1" title={file.name}>
                        {file.name}
                      </Text>
                      {file.status === 'done' && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink">
                          <CheckIcon size={10} strokeWidth={3} />
                          <span className="sr-only">Uploaded</span>
                        </span>
                      )}
                    </div>
                    {file.status !== 'done' && (
                      <Progress
                        label={`${file.name} upload`}
                        value={Math.round(file.progress * 100)}
                        size="sm"
                        className={cn(
                          file.status === 'error' && '[&>div]:bg-danger',
                          file.status === 'paused' && '[&>div]:bg-ink-faint',
                        )}
                      />
                    )}
                    <Text size="caption" tone={file.status === 'error' ? 'danger' : 'faint'} tabular truncate>
                      {file.status === 'error'
                        ? (file.error ?? 'Upload failed')
                        : file.status === 'done'
                          ? formatUploadBytes(file.size)
                          : `${formatUploadBytes(sent)} of ${formatUploadBytes(file.size)} · ${
                              file.status === 'queued'
                                ? 'Queued'
                                : file.status === 'paused'
                                  ? 'Paused'
                                  : `${Math.round(file.progress * 100)}%`
                            }`}
                    </Text>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {file.status === 'uploading' && onPause && (
                      <IconButton
                        icon={PauseIcon}
                        size="xs"
                        label={`Pause ${file.name}`}
                        onClick={() => onPause(file.id)}
                      />
                    )}
                    {file.status === 'paused' && onResume && (
                      <IconButton
                        icon={PlayIcon}
                        size="xs"
                        label={`Resume ${file.name}`}
                        onClick={() => onResume(file.id)}
                      />
                    )}
                    {file.status === 'error' && onRetry && (
                      <IconButton
                        icon={RetryIcon}
                        size="xs"
                        label={`Retry ${file.name}`}
                        onClick={() => onRetry(file.id)}
                      />
                    )}
                    {file.status !== 'done' && onCancel && (
                      <IconButton
                        icon={CrossIcon}
                        size="xs"
                        label={`Cancel ${file.name}`}
                        onClick={() => onCancel(file.id)}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {onClearCompleted && done > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
              <Text size="caption" tone="faint">
                {summary}
              </Text>
              <Button variant="ghost" size="sm" onClick={onClearCompleted}>
                Clear completed
              </Button>
            </div>
          )}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {files.length ? summary : ''}
      </div>
    </section>
  )
}
