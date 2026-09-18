'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { exifViewerParse, exifViewerStrip, exifViewerVerify, type ExifViewerGroup, type ExifViewerReport } from './exif'

export interface ExifViewerProps {
  /** The JPEG, as a Blob/File or its bytes. */
  file: Blob | ArrayBuffer
  /** Shown in the header and used for the stripped copy’s download name. */
  fileName?: string
  /** Called with the metadata-free copy after it has been verified. */
  onStrip?: (blob: Blob) => void
  /** Merged last, so it wins. */
  className?: string
}

const GROUPS: ExifViewerGroup[] = ['Camera', 'Exposure', 'Date', 'Location', 'Image']
const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`)
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

/**
 * What a photo says about where and when it was taken — and a way to make it stop.
 *
 * The EXIF block is read directly from the JPEG’s APP1 segment: the TIFF
 * header in either byte order, IFD0, and the Exif and GPS sub-IFDs, with
 * rationals divided and enums named, so the reader sees “1/250 s, f/2.8” and
 * a latitude in decimal degrees rather than tag numbers.
 *
 * Stripping does not re-encode the image, which would cost quality and still
 * might keep an ICC-embedded note. It rewrites the file’s segments without
 * APP1 (EXIF and XMP) and APP13 (IPTC), then parses the result again and
 * compares every remaining segment, image data included, byte for byte —
 * the download is only offered once that check has passed.
 */
export function ExifViewer({ file, fileName = 'photo.jpg', onStrip, className }: ExifViewerProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [stripped, setStripped] = useState<{ url: string; size: number; ok: boolean; message: string } | null>(null)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    let cancelled = false
    setBytes(null)
    setStripped(null)
    readBytes(file).then((read) => !cancelled && setBytes(read))
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    if (!bytes || typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [bytes])

  useEffect(
    () => () => {
      if (stripped?.url) URL.revokeObjectURL(stripped.url)
    },
    [stripped],
  )

  const parsed = useMemo((): { report: ExifViewerReport | null; error: string } => {
    if (!bytes) return { report: null, error: '' }
    try {
      return { report: exifViewerParse(bytes), error: '' }
    } catch (error) {
      return { report: null, error: (error as Error).message }
    }
  }, [bytes])

  const strip = () => {
    if (!bytes) return
    const clean = exifViewerStrip(bytes)
    const check = exifViewerVerify(bytes, clean)
    const blob = new Blob([clean as BlobPart], { type: 'image/jpeg' })
    setStripped({ url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '', size: clean.length, ...check })
    if (check.ok) onStrip?.(blob)
  }

  const report = parsed.report
  const metadata = report?.segments.filter((segment) => segment.marker === 0xe1 || segment.marker === 0xed) ?? []
  const gps = report?.gps
  const coordinates = gps ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` : ''

  return (
    <div className={cn('grid w-full gap-4 md:grid-cols-[220px_minmax(0,1fr)]', className)}>
      <div className="flex flex-col gap-3">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken">
          {preview ? <img src={preview} alt={`Preview of ${fileName}`} className="size-full object-contain" /> : <span className="text-[12px] font-medium text-ink-faint">No preview</span>}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-[13px] font-bold text-ink">{fileName}</span>
          <span className="text-[12px] font-medium text-ink-faint">
            {bytes ? kb(bytes.length) : 'Reading…'}
            {report?.byteOrder ? ` · ${report.byteOrder}` : ''}
          </span>
        </div>
        {report && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
            <span className="text-[12px] font-semibold text-ink-soft">
              {metadata.length ? `${metadata.length} metadata segment${metadata.length > 1 ? 's' : ''}, ${kb(metadata.reduce((sum, segment) => sum + segment.length, 0))}` : 'No metadata segments'}
            </span>
            <Button size="sm" variant="accent" disabled={!metadata.length} onClick={strip}>
              Strip metadata
            </Button>
            {stripped && (
              <div role="status" className="flex flex-col gap-1.5">
                <span className={cn('text-[12px] font-semibold', stripped.ok ? 'text-success' : 'text-danger')}>
                  {stripped.ok ? '✓ Verified. ' : '✗ '}
                  {stripped.message}
                </span>
                <span className="text-[12px] font-medium text-ink-faint">
                  {kb(bytes!.length)} → {kb(stripped.size)}
                </span>
                {stripped.ok && stripped.url && (
                  <a href={stripped.url} download={fileName.replace(/(\.jpe?g)?$/i, '-clean.jpg')} className="text-[12px] font-bold text-ink underline underline-offset-2 hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-focus">
                    Download clean copy
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {parsed.error && (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {parsed.error}
          </p>
        )}
        {report && report.fields.length === 0 && <p className="m-0 text-[13px] font-medium text-ink-soft">This JPEG carries no EXIF metadata.</p>}
        {gps && (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-glyph)] border border-line p-3">
            <Badge tone="accent">Location</Badge>
            <span className="font-mono text-[12px] font-semibold text-ink">{coordinates}</span>
            {gps.altitude !== undefined && <span className="text-[12px] font-medium text-ink-faint">{gps.altitude.toFixed(1)} m</span>}
            <CopyButton value={coordinates} label="Copy coordinates" copiedLabel="Coordinates copied" iconOnly size="sm" className="ml-auto" />
          </div>
        )}
        {GROUPS.map((group) => {
          const fields = report?.fields.filter((field) => field.group === group && !/ ref$/.test(field.name)) ?? []
          if (!fields.length) return null
          return (
            <section key={group} className="flex flex-col gap-1.5">
              <h3 className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{group}</h3>
              <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={`${field.ifd}-${field.tag}`} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line py-1">
                    <dt className="text-[12px] font-medium text-ink-soft">{field.name}</dt>
                    <dd className="m-0 truncate text-right text-[12px] font-semibold text-ink tabular">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
        {report && (
          <section className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">File structure</h3>
            <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {report.segments.map((segment) => (
                <li
                  key={segment.offset}
                  className={cn(
                    'rounded-[var(--radius-6)] px-2 py-0.5 font-mono text-[11px] font-semibold',
                    segment.marker === 0xe1 || segment.marker === 0xed ? 'bg-[color-mix(in_oklab,var(--color-danger)_16%,transparent)] text-ink' : 'bg-surface-muted text-ink-soft',
                  )}
                >
                  {segment.name} · {kb(segment.length)}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
