'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { plural } from '../../lib/format'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'
import { Text } from '../Text'

export type DropOverlayScope = 'page' | 'region'

export interface DropOverlayRejection {
  file: File
  reason: string
}

export interface DropOverlayProps {
  /** Called with the files that passed the type and size checks. */
  onDrop: (files: File[]) => void
  /** Called with the files that did not, and why. */
  onReject?: (rejections: DropOverlayRejection[]) => void
  /** Native accept string — "image/*,.pdf". Checked on drop as well as in the file picker. */
  accept?: string
  /** Largest accepted file, in bytes. */
  maxSize?: number
  /** Accept more than one file at a time. */
  multiple?: boolean
  /** page listens on the whole window and covers the viewport; region covers only its children. */
  scope?: DropOverlayScope
  /** Heading on the overlay. */
  title?: string
  /** Plain-language version of `accept`, shown on the overlay — “Images or PDFs”. */
  acceptLabel?: string
  /** Label on the always-visible button that opens the file picker. */
  chooseLabel?: string
  /**
   * The content the overlay covers. A function receives `openFilePicker`, to
   * put the choose-files control somewhere of your own; otherwise a button is
   * drawn after the content.
   */
  children?: ReactNode | ((openFilePicker: () => void) => ReactNode)
  /** Ignore drags and disable the button. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

function matches(file: File, accept: string) {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean)
  if (rules.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((rule) =>
    rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule,
  )
}

const hasFiles = (event: DragEvent) => Boolean(event.dataTransfer?.types && [...event.dataTransfer.types].includes('Files'))

/**
 * A drop target that only exists while files are being dragged.
 *
 * A permanent dashed box spends space on something most people never do.
 * This keeps the page as it is and covers it — the whole window, or one region
 * — the moment files are dragged in from the desktop, then gets out of the way.
 * Drag events fire again for every child the pointer crosses, so a plain
 * enter/leave pair flickers; a counter of enters minus leaves is what decides
 * whether the drag is still inside. Text or links dragged within the page are
 * ignored, because only a drag that carries files shows the overlay.
 *
 * Dragging is never the only way in. The choose-files button is always there,
 * and files are checked against the same type and size rules whichever route
 * they took, with the reason for every refusal said out loud.
 */
export function DropOverlay({
  onDrop,
  onReject,
  accept,
  maxSize,
  multiple = true,
  scope = 'region',
  title = 'Drop files to upload',
  acceptLabel,
  chooseLabel = 'Choose files',
  children,
  disabled = false,
  className,
}: DropOverlayProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const handle = (incoming: File[]) => {
    const rejections: DropOverlayRejection[] = []
    const accepted: File[] = []
    for (const file of incoming) {
      if (accept && !matches(file, accept)) rejections.push({ file, reason: `${file.name} is not an accepted file type` })
      else if (maxSize && file.size > maxSize) {
        rejections.push({ file, reason: `${file.name} is larger than ${formatSize(maxSize)}` })
      } else accepted.push(file)
    }
    if (!multiple && accepted.length > 1) {
      for (const file of accepted.splice(1)) {
        rejections.push({ file, reason: `${file.name} was skipped — one file at a time` })
      }
    }
    if (accepted.length > 0) onDrop(accepted)
    if (rejections.length > 0) onReject?.(rejections)
    setMessage(
      rejections.length > 0
        ? { tone: 'danger', text: rejections.map((rejection) => rejection.reason).join('. ') + '.' }
        : accepted.length > 0
          ? { tone: 'success', text: `${plural(accepted.length, 'file')} added.` }
          : null,
    )
  }
  const handleRef = useRef(handle)
  handleRef.current = handle

  useEffect(() => {
    if (disabled) return
    const target: HTMLElement | Window | null = scope === 'page' ? window : regionRef.current
    if (!target) return
    let depth = 0

    const onEnter = (event: Event) => {
      if (!hasFiles(event as DragEvent)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onOver = (event: Event) => {
      if (!hasFiles(event as DragEvent)) return
      // Without this the browser refuses the drop and opens the file instead.
      event.preventDefault()
      const transfer = (event as DragEvent).dataTransfer
      if (transfer) transfer.dropEffect = 'copy'
    }
    const onLeave = (event: Event) => {
      if (!hasFiles(event as DragEvent)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDropEvent = (event: Event) => {
      if (!hasFiles(event as DragEvent)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      handleRef.current([...((event as DragEvent).dataTransfer?.files ?? [])])
    }

    target.addEventListener('dragenter', onEnter)
    target.addEventListener('dragover', onOver)
    target.addEventListener('dragleave', onLeave)
    target.addEventListener('drop', onDropEvent)
    return () => {
      target.removeEventListener('dragenter', onEnter)
      target.removeEventListener('dragover', onOver)
      target.removeEventListener('dragleave', onLeave)
      target.removeEventListener('drop', onDropEvent)
      setDragging(false)
    }
  }, [scope, disabled])

  const openFilePicker = () => inputRef.current?.click()

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    handle([...(event.target.files ?? [])])
    event.target.value = ''
  }

  const details = [acceptLabel ?? (accept ? `Accepts ${accept}` : null), maxSize ? `up to ${formatSize(maxSize)}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div ref={regionRef} className={cn('relative flex flex-col gap-3', className)}>
      {typeof children === 'function' ? children(openFilePicker) : children}
      {typeof children !== 'function' && (
        <Button variant="outline" size="sm" onClick={openFilePicker} disabled={disabled} className="self-start">
          {chooseLabel}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        aria-label={chooseLabel}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        className="sr-only"
      />
      {message && (
        <InlineMessage tone={message.tone} live>
          {message.text}
        </InlineMessage>
      )}
      <div
        aria-hidden={!dragging}
        className={cn(
          'pointer-events-none flex items-center justify-center p-4 transition-opacity duration-150',
          scope === 'page' ? 'fixed inset-0 z-[var(--z-overlay)]' : 'absolute inset-0 z-10',
          dragging ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        <div
          className={cn(
            'flex size-full flex-col items-center justify-center gap-2 p-6 text-center',
            'rounded-[var(--radius-card)] border-2 border-dashed border-accent-strong',
            'bg-[color-mix(in_oklab,var(--color-surface)_82%,var(--color-accent))] backdrop-blur-sm',
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
            <svg
              viewBox="0 0 24 24"
              width={22}
              height={22}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
          </span>
          <Text size="subtitle">{title}</Text>
          {details && (
            <Text size="label" tone="soft">
              {details}
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}
