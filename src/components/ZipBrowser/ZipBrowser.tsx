'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { ChevronRightIcon } from '../internal/icons'
import { zipBrowserExtract, zipBrowserRead, type ZipBrowserEntry } from './zip'

export interface ZipBrowserProps {
  /** The archive, as a Blob/File or its bytes. */
  file: Blob | ArrayBuffer
  /** Shown as the root of the tree. */
  fileName?: string
  /** Called when a file is extracted, with its contents. The browser download still happens. */
  onExtract?: (entry: ZipBrowserEntry, data: Uint8Array) => void
  /** Merged last, so it wins. */
  className?: string
}

interface ZipBrowserNode {
  name: string
  path: string
  depth: number
  children: ZipBrowserNode[]
  entry?: ZipBrowserEntry
}

const TEXT = /\.(txt|md|json|csv|tsv|ts|tsx|js|jsx|css|html|xml|svg|yml|yaml|toml|ini|log|py|rs|go|sh)$/i
const IMAGE: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
/** Bytes of a Blob or buffer. FileReader covers the environments whose Blob predates arrayBuffer(). */
const readBytes = async (file: Blob | ArrayBuffer): Promise<Uint8Array> => {
  if (file instanceof ArrayBuffer) return new Uint8Array(file)
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer())
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function buildTree(entries: ZipBrowserEntry[]): ZipBrowserNode {
  const root: ZipBrowserNode = { name: '', path: '', depth: 0, children: [] }
  for (const entry of entries) {
    const parts = entry.name.split('/').filter(Boolean)
    let node = root
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      let child = node.children.find((candidate) => candidate.name === part)
      if (!child) {
        child = { name: part, path, depth: index + 1, children: [] }
        node.children.push(child)
      }
      if (index === parts.length - 1 && !entry.directory) child.entry = entry
      node = child
    })
  }
  const sort = (node: ZipBrowserNode) => {
    node.children.sort((a, b) => Number(Boolean(a.entry)) - Number(Boolean(b.entry)) || a.name.localeCompare(b.name))
    node.children.forEach(sort)
  }
  sort(root)
  return root
}

/**
 * Opens a ZIP in the browser without uploading it anywhere.
 *
 * The archive is read from its central directory — found by scanning back for
 * the end record, and through the ZIP64 locator for archives past 4 GB or
 * 65,535 entries — so listing a large archive costs only its index. Names
 * honour the UTF-8 flag and fall back to code page 437, which is what older
 * tools wrote, so accented names do not turn into mojibake.
 *
 * Opening a file inflates just that entry with the browser’s own
 * DecompressionStream and checks its CRC-32 against the directory before
 * showing it, so a damaged archive says so instead of showing garbage. The
 * tree is a real tree widget: arrows move and open folders, Enter opens a file.
 */
export function ZipBrowser({ file, fileName = 'archive.zip', onExtract, className }: ZipBrowserProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState(0)
  const [selected, setSelected] = useState<ZipBrowserNode | null>(null)
  const [preview, setPreview] = useState<{ kind: 'text' | 'image' | 'binary'; text?: string; url?: string; crcOk: boolean; data: Uint8Array } | null>(null)
  const [previewError, setPreviewError] = useState('')
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    setBytes(null)
    setSelected(null)
    readBytes(file).then((read) => !cancelled && setBytes(read))
    return () => {
      cancelled = true
    }
  }, [file])

  const listing = useMemo(() => {
    if (!bytes) return { entries: [] as ZipBrowserEntry[], error: '' }
    try {
      return { entries: zipBrowserRead(bytes), error: '' }
    } catch (error) {
      return { entries: [] as ZipBrowserEntry[], error: (error as Error).message }
    }
  }, [bytes])
  const tree = useMemo(() => buildTree(listing.entries), [listing])

  const visible: ZipBrowserNode[] = []
  const walk = (node: ZipBrowserNode) => {
    for (const child of node.children) {
      visible.push(child)
      if (!child.entry && expanded.has(child.path)) walk(child)
    }
  }
  walk(tree)

  useEffect(() => {
    if (!bytes || !selected?.entry) return
    let cancelled = false
    let url = ''
    setPreview(null)
    setPreviewError('')
    zipBrowserExtract(bytes, selected.entry).then(
      ({ data, crcOk }) => {
        if (cancelled) return
        const extension = selected.name.split('.').pop()?.toLowerCase() ?? ''
        if (IMAGE[extension] && typeof URL.createObjectURL === 'function') {
          url = URL.createObjectURL(new Blob([data as BlobPart], { type: IMAGE[extension] }))
          setPreview({ kind: 'image', url, crcOk, data })
        } else if (TEXT.test(selected.name) || !data.subarray(0, 512).includes(0)) {
          setPreview({ kind: 'text', text: new TextDecoder().decode(data.subarray(0, 8192)), crcOk, data })
        } else setPreview({ kind: 'binary', crcOk, data })
      },
      (reason: Error) => !cancelled && setPreviewError(reason.message),
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [bytes, selected])

  const toggle = (node: ZipBrowserNode, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (open ?? !next.has(node.path)) next.add(node.path)
      else next.delete(node.path)
      return next
    })

  const move = (index: number) => {
    const clamped = Math.max(0, Math.min(visible.length - 1, index))
    setFocus(clamped)
    itemRefs.current[clamped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, node: ZipBrowserNode, index: number) => {
    const folder = !node.entry
    const open = expanded.has(node.path)
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(visible.length - 1)
    else if (event.key === 'ArrowRight') {
      if (folder && !open) toggle(node, true)
      else if (folder) move(index + 1)
    } else if (event.key === 'ArrowLeft') {
      if (folder && open) toggle(node, false)
      else {
        const parent = visible.findIndex((candidate) => candidate.path === node.path.split('/').slice(0, -1).join('/'))
        if (parent >= 0) move(parent)
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (folder) toggle(node)
      else setSelected(node)
    } else return
    event.preventDefault()
  }

  const extract = () => {
    if (!preview || !selected?.entry) return
    onExtract?.(selected.entry, preview.data)
    if (typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([preview.data as BlobPart]))
    const link = document.createElement('a')
    link.href = url
    link.download = selected.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const files = listing.entries.filter((entry) => !entry.directory)
  const total = files.reduce((sum, entry) => sum + entry.size, 0)
  const packed = files.reduce((sum, entry) => sum + entry.compressedSize, 0)
  const entry = selected?.entry

  return (
    <div className={cn('grid w-full gap-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]', className)}>
      <div className="flex min-w-0 flex-col border-b border-line md:border-b-0 md:border-r">
        <div className="flex flex-col gap-0.5 border-b border-line px-4 py-3">
          <span className="truncate text-[13px] font-bold text-ink">{fileName}</span>
          <span className="text-[11px] font-medium text-ink-faint">
            {bytes ? `${files.length} files · ${size(total)} → ${size(packed)}` : 'Reading…'}
          </span>
        </div>
        {listing.error ? (
          <p role="alert" className="m-0 p-4 text-[13px] font-semibold text-danger">
            {listing.error}
          </p>
        ) : (
          <div role="tree" aria-label={`Contents of ${fileName}`} className="flex max-h-[360px] flex-col overflow-y-auto p-1.5">
            {visible.map((node, index) => {
              const folder = !node.entry
              return (
                <div
                  key={node.path}
                  ref={(element) => (itemRefs.current[index] = element)}
                  role="treeitem"
                  aria-level={node.depth}
                  aria-expanded={folder ? expanded.has(node.path) : undefined}
                  aria-selected={selected?.path === node.path}
                  tabIndex={index === Math.min(focus, visible.length - 1) ? 0 : -1}
                  onClick={() => {
                    setFocus(index)
                    if (folder) toggle(node)
                    else setSelected(node)
                  }}
                  onKeyDown={(event) => onKeyDown(event, node, index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-8)] py-1 pr-2 text-[12px] font-semibold outline-none',
                    'hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                    selected?.path === node.path ? 'bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] text-ink' : 'text-ink-soft',
                  )}
                  style={{ paddingLeft: 6 + (node.depth - 1) * 16 }}
                >
                  {folder ? (
                    <ChevronRightIcon size={12} className={cn('shrink-0 transition-transform motion-reduce:transition-none', expanded.has(node.path) && 'rotate-90')} />
                  ) : (
                    <span aria-hidden="true" className="size-3 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {node.name}
                    {folder ? '/' : ''}
                  </span>
                  {node.entry && <span className="shrink-0 text-[11px] font-medium text-ink-faint tabular">{size(node.entry.size)}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-4 md:pl-0">
        {!entry ? (
          <p className="m-0 text-[13px] font-medium text-ink-faint">Choose a file to preview it.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-ink">{entry.name}</span>
              {preview && <Badge tone={preview.crcOk ? 'accent' : 'neutral'}>{preview.crcOk ? 'CRC-32 verified' : 'CRC-32 mismatch'}</Badge>}
              <Button size="sm" variant="outline" disabled={!preview} onClick={extract}>
                Extract
              </Button>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
              {[
                ['Size', size(entry.size)],
                ['Packed', `${size(entry.compressedSize)}${entry.size ? ` (${Math.round((1 - entry.compressedSize / entry.size) * 100)}% saved)` : ''}`],
                ['Method', entry.method === 8 ? 'Deflate' : entry.method === 0 ? 'Stored' : `Method ${entry.method}`],
                ['CRC-32', entry.crc32.toString(16).padStart(8, '0')],
                ['Modified', entry.modified.toLocaleString()],
                ['Name encoding', `${entry.utf8 ? 'UTF-8' : 'CP437'}${entry.zip64 ? ' · ZIP64' : ''}`],
              ].map(([term, detail]) => (
                <div key={term} className="flex min-w-0 flex-col">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
                  <dd className="m-0 truncate font-semibold text-ink tabular">{detail}</dd>
                </div>
              ))}
            </dl>
            <div className="min-h-[140px] overflow-hidden rounded-[var(--radius-glyph)] bg-surface-sunken">
              {previewError ? (
                <p role="alert" className="m-0 p-3 text-[12px] font-semibold text-danger">
                  {previewError}
                </p>
              ) : !preview ? (
                <p className="m-0 p-3 text-[12px] font-medium text-ink-faint">Inflating…</p>
              ) : preview.kind === 'image' ? (
                <img src={preview.url} alt={entry.name} className="mx-auto block max-h-[260px] max-w-full p-3" />
              ) : preview.kind === 'text' ? (
                <pre tabIndex={0} aria-label={`Contents of ${selected!.name}`} className="m-0 max-h-[260px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-ink">
                  {preview.text}
                </pre>
              ) : (
                <p className="m-0 p-3 text-[12px] font-medium text-ink-faint">Binary file — extract it to open.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
