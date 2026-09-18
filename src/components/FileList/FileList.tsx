'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { IconButton } from '../IconButton'
import { Menu, type MenuItem } from '../Menu'
import { Progress } from '../Progress'
import { Text } from '../Text'

export type FileListStatus = 'done' | 'uploading' | 'error'

export interface FileListItem {
  id: string
  /** File name including its extension, which picks the type glyph. */
  name: string
  /** Size in bytes. Shown human formatted — 2.4 MB. */
  size: number
  /** Last modified. */
  modified?: Date
  /** done is a stored file; uploading shows progress; error shows the message and a retry. */
  status?: FileListStatus
  /** Upload progress, 0–100, while uploading. */
  progress?: number
  /** Why the upload failed. */
  error?: string
}

export interface FileListProps {
  files: FileListItem[]
  /** Accessible name for the list. */
  label: string
  /** Row actions for a file — download, rename, delete. Omit for no menu. */
  actions?: (file: FileListItem) => (MenuItem | 'separator')[]
  /** Called from a failed row’s Retry button. */
  onRetry?: (file: FileListItem) => void
  /** Show a checkbox on each row. */
  selectable?: boolean
  /** Controlled selection, as file ids. */
  selected?: string[]
  /** Initial selection when uncontrolled. */
  defaultSelected?: string[]
  /** Called with the new selection. */
  onSelectedChange?: (selected: string[]) => void
  /** Shown when there are no files. */
  empty?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** 999 B, 1.2 KB, 14 MB — one decimal only while it still says something. */
export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit += 1
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${UNITS[unit]}`
}

const KINDS: [RegExp, string][] = [
  [/^(png|jpe?g|gif|webp|svg|avif|heic)$/, 'image'],
  [/^(mp4|mov|webm|mkv|avi)$/, 'video'],
  [/^(mp3|wav|flac|ogg|m4a)$/, 'audio'],
  [/^(zip|rar|7z|tar|gz)$/, 'archive'],
  [/^(xlsx?|csv|numbers|ods)$/, 'sheet'],
  [/^(ts|tsx|js|jsx|json|py|go|rs|css|html|sh|ya?ml)$/, 'code'],
]

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function FileGlyph({ name }: { name: string }) {
  const ext = extensionOf(name)
  const kind = KINDS.find(([pattern]) => pattern.test(ext))?.[1] ?? (ext === 'pdf' ? 'pdf' : 'doc')
  const tint =
    kind === 'pdf'
      ? 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger'
      : kind === 'image' || kind === 'video'
        ? 'bg-accent-soft text-ink'
        : 'bg-surface-muted text-ink-soft'
  return (
    <span aria-hidden="true" className={cn('relative flex h-10 w-9 shrink-0 flex-col items-center justify-end rounded-[var(--radius-8)] pb-1', tint)}>
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" className="absolute top-1.5">
        <path d="M4 1.75h5l3 3v9.5H4z" />
        <path d="M9 1.75v3h3" />
      </svg>
      <span className="text-[8px] font-extrabold uppercase leading-none tracking-wide">{ext.slice(0, 4) || 'file'}</span>
    </span>
  )
}

const DotsIcon = ({ size = 16, className }: { size?: number | string; className?: string }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="12.5" cy="8" r="1.4" />
  </svg>
)

/**
 * Files as rows: what kind, how big, how recent, and what is happening to it.
 *
 * Upload state lives on the row rather than in a separate tray, so a file never
 * moves between two places as it finishes — the progress bar simply gives way
 * to the size and date. A failed row says why in words and offers the retry
 * right there, because an error icon on its own reads as decoration.
 *
 * Sizes are decimal (1 MB = 1,000,000 bytes), matching what operating systems
 * show in their own file browsers on the platforms people upload from most.
 */
export function FileList({
  files,
  label,
  actions,
  onRetry,
  selectable = false,
  selected: controlledSelected,
  defaultSelected = [],
  onSelectedChange,
  empty = 'No files yet',
  className,
}: FileListProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultSelected)
  const selected = controlledSelected ?? uncontrolled

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((entry) => entry !== id)
    if (controlledSelected === undefined) setUncontrolled(next)
    onSelectedChange?.(next)
  }

  if (files.length === 0) {
    return (
      <Text size="body" weight="medium" tone="faint" className={cn('py-6 text-center', className)}>
        {empty}
      </Text>
    )
  }

  return (
    <ul aria-label={label} className={cn('flex flex-col divide-y divide-line', className)}>
      {files.map((file) => {
        const status = file.status ?? 'done'
        const isSelected = selected.includes(file.id)
        return (
          <li
            key={file.id}
            className={cn('flex items-center gap-3 px-2 py-2.5', isSelected && 'bg-surface-sunken')}
          >
            {selectable && (
              <Checkbox
                boxSize="sm"
                checked={isSelected}
                onChange={(event) => toggle(file.id, event.target.checked)}
                aria-label={`Select ${file.name}`}
              />
            )}
            <FileGlyph name={file.name} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Text size="body" weight="semibold" truncate title={file.name}>
                {file.name}
              </Text>
              {status === 'uploading' ? (
                <div className="flex items-center gap-2">
                  <Progress size="sm" value={file.progress ?? 0} label={`Uploading ${file.name}`} className="max-w-[240px]" />
                  <Text as="span" size="caption" tone="faint" tabular>
                    {Math.round(file.progress ?? 0)}%
                  </Text>
                </div>
              ) : status === 'error' ? (
                <Text size="caption" tone="danger" weight="semibold" role="alert">
                  {file.error ?? 'Upload failed'}
                </Text>
              ) : (
                <Text size="caption" tone="faint" tabular>
                  {formatFileSize(file.size)}
                  {file.modified && <> · {formatDate(file.modified)}</>}
                </Text>
              )}
            </div>
            {status === 'error' && onRetry && (
              <Button size="sm" variant="outline" onClick={() => onRetry(file)}>
                Retry
              </Button>
            )}
            {actions && (
              <Menu
                label={`Actions for ${file.name}`}
                align="end"
                items={actions(file)}
                trigger={
                  <IconButton
                    icon={DotsIcon}
                    label={`More actions for ${file.name}`}
                    size="xs"
                    aria-haspopup="menu"
                  />
                }
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
