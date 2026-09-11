'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Progress } from '../Progress'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export interface UploadFile {
  id: string
  name: string
  /** Size in bytes. */
  size: number
  /** 0–100. Omit for a file that is already stored. */
  progress?: number
  error?: string
}

export interface FileUploadProps {
  files: UploadFile[]
  /** Called with the newly chosen files. */
  onFilesAdded: (files: File[]) => void
  onFileRemoved: (id: string) => void
  /** Visible instruction inside the drop zone. */
  label?: string
  /** Native accept string, e.g. "image/*,.pdf". */
  accept?: string
  /** Allow more than one file per selection. */
  multiple?: boolean
  /** Largest accepted file, in bytes. Rejected files are reported inline. */
  maxSize?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A drop zone with a file list and per-file progress.
 *
 * The zone is a real button wrapping a hidden file input, so choosing a file
 * works from the keyboard exactly as it does with a pointer — dragging is an
 * accelerator on top, never the only route. Rejected files stay in the list
 * with their reason rather than vanishing silently.
 */
export function FileUpload({
  files,
  onFilesAdded,
  onFileRemoved,
  label = 'Drop files here, or browse',
  accept,
  multiple = true,
  maxSize,
  disabled = false,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const accept_ = (incoming: File[]) => {
    const tooLarge = maxSize ? incoming.filter((file) => file.size > maxSize) : []
    const allowed = maxSize ? incoming.filter((file) => file.size <= maxSize) : incoming
    setRejected(tooLarge.map((file) => `${file.name} is larger than ${formatSize(maxSize ?? 0)}`))
    if (allowed.length > 0) onFilesAdded(allowed)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    accept_([...event.dataTransfer.files])
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    accept_([...(event.target.files ?? [])])
    event.target.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-[var(--radius-tile)] border-2 border-dashed px-6 py-8 transition-colors',
            'disabled:pointer-events-none disabled:opacity-40',
            over ? 'border-accent-strong bg-accent-soft/40' : 'border-line-strong hover:border-ink-faint',
          )}
        >
          <Text size="body">{label}</Text>
          <Text size="caption" tone="faint">
            {accept ? `Accepts ${accept}` : 'Any file type'}
            {maxSize ? ` · up to ${formatSize(maxSize)}` : ''}
          </Text>
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label={label}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {rejected.length > 0 && (
        <div role="alert" className="flex flex-col gap-1">
          {rejected.map((message) => (
            <Text key={message} size="caption" weight="medium" tone="danger">
              {message}
            </Text>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.id}>
              <Surface variant="tile" padding="sm" className="gap-2 bg-surface">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Text truncate>{file.name}</Text>
                    <Text size="caption" tone={file.error ? 'danger' : 'faint'}>
                      {file.error ?? formatSize(file.size)}
                    </Text>
                  </div>
                  <IconButton
                    icon={CrossIcon}
                    label={`Remove ${file.name}`}
                    size="xs"
                    onClick={() => onFileRemoved(file.id)}
                  />
                </div>
                {file.progress !== undefined && file.progress < 100 && !file.error && (
                  <Progress value={file.progress} size="sm" label={`Uploading ${file.name}`} />
                )}
              </Surface>
            </li>
          ))}
        </ul>
      )}

      {files.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => files.forEach((file) => onFileRemoved(file.id))}
          >
            Remove all
          </Button>
        </div>
      )}
    </div>
  )
}
