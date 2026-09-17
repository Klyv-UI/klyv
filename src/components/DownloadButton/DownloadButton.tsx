'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button, type ButtonSize, type ButtonVariant } from '../Button'
import { IconButton } from '../IconButton'
import { Spinner } from '../Spinner'
import { CheckIcon, CrossIcon } from '../internal/icons'

export type DownloadButtonState = 'idle' | 'downloading' | 'done' | 'error'

export interface DownloadButtonContext {
  /** Aborts when the reader cancels. Pass it to `fetch`. */
  signal: AbortSignal
  /** Report progress from 0 to 1. Never calling it shows an indeterminate spinner. */
  onProgress: (fraction: number) => void
}

export interface DownloadButtonProps {
  /** Does the download. Resolve when the file is saved; reject to show the error state. */
  onDownload: (context: DownloadButtonContext) => Promise<void>
  /** Verb and object — "Download report". */
  label?: string
  /** File size in bytes, shown in the label so the reader knows what they are starting. */
  size?: number
  /** File type shown beside the size — "PDF". */
  format?: string
  /** How long "Downloaded" stays before the button resets, in ms. 0 keeps it. */
  resetAfter?: number
  variant?: ButtonVariant
  buttonSize?: ButtonSize
  /** Merged onto the wrapper. */
  className?: string
}

function formatDownloadSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

function Ring({ fraction }: { fraction: number }) {
  const circumference = 2 * Math.PI * 6
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" className="-rotate-90">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v7.5M4.75 7L8 10.25 11.25 7M3 13.5h10" />
    </svg>
  )
}

/**
 * A download that shows it is happening.
 *
 * A plain link gives no sign of a large file until the browser's own tray
 * appears, if it does — so people click again. This stays one control through
 * the whole life of the download: idle with the size in the label, a ring
 * filling with the percentage, a tick when done, and a retry that says what
 * went wrong. A cancel button sits beside it while it runs and aborts the
 * signal passed to `onDownload`.
 *
 * The main button is never removed or disabled between states, so keyboard
 * focus stays where the reader left it. Starts, finishes, failures and
 * cancels are announced; the percentage is not, because a count read out
 * every few seconds drowns everything else.
 */
export function DownloadButton({
  onDownload,
  label = 'Download',
  size,
  format,
  resetAfter = 4000,
  variant = 'accent',
  buttonSize = 'md',
  className,
}: DownloadButtonProps) {
  const [state, setState] = useState<DownloadButtonState>('idle')
  const [fraction, setFraction] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const controller = useRef<AbortController | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => () => controller.current?.abort(), [])

  useEffect(() => {
    if (state !== 'done' || resetAfter <= 0) return
    const timer = setTimeout(() => setState('idle'), resetAfter)
    return () => clearTimeout(timer)
  }, [state, resetAfter])

  const start = async () => {
    if (state === 'downloading') return
    const run = new AbortController()
    controller.current = run
    setState('downloading')
    setFraction(null)
    setAnnouncement(`Downloading ${label.replace(/^download\s*/i, '') || 'file'}`)
    try {
      await onDownload({
        signal: run.signal,
        onProgress: (value) => {
          if (!run.signal.aborted) setFraction(Math.min(1, Math.max(0, value)))
        },
      })
      if (run.signal.aborted) return
      setState('done')
      setAnnouncement('Download complete')
    } catch {
      if (run.signal.aborted) return
      setState('error')
      setAnnouncement('Download failed. Try again.')
    }
  }

  const cancel = () => {
    controller.current?.abort()
    setState('idle')
    setFraction(null)
    setAnnouncement('Download cancelled')
    wrapperRef.current?.querySelector<HTMLElement>('[data-download-main]')?.focus()
  }

  const meta = [format, size !== undefined ? formatDownloadSize(size) : null].filter(Boolean).join(', ')
  const percent = fraction === null ? null : Math.round(fraction * 100)

  const content = {
    idle: (
      <>
        <DownloadIcon />
        {label}
        {meta && <span className="font-medium opacity-70">({meta})</span>}
      </>
    ),
    downloading: (
      <>
        {fraction === null ? <Spinner size="sm" /> : <Ring fraction={fraction} />}
        Downloading
        {percent !== null && <span className="tabular-nums">{percent}%</span>}
      </>
    ),
    done: (
      <>
        <CheckIcon size={16} />
        Downloaded
      </>
    ),
    error: (
      <>
        <DownloadIcon />
        Retry download
      </>
    ),
  }[state]

  return (
    <span ref={wrapperRef} className={cn('inline-flex flex-col items-start gap-1.5', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Button
          data-download-main=""
          variant={variant}
          size={buttonSize}
          aria-busy={state === 'downloading' || undefined}
          onClick={() => void start()}
        >
          {content}
        </Button>
        {state === 'downloading' && (
          <IconButton icon={CrossIcon} label="Cancel download" tone="muted" size={buttonSize === 'sm' ? 'xs' : 'sm'} onClick={cancel} />
        )}
      </span>
      {state === 'error' && (
        <span className="text-[11px] font-semibold text-danger">The download didn’t finish.</span>
      )}
      {state === 'downloading' && percent !== null && (
        <span role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="sr-only" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  )
}
