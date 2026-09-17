'use client'

import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Cropper, type CropRect } from '../Cropper'
import { Spinner } from '../Spinner'
import { PencilIcon } from '../internal/icons'

export interface AvatarUploadProps {
  /** The current avatar’s URL. Omit for initials. */
  src?: string
  /** Whose avatar — drives the initials and the accessible names. */
  name: string
  /**
   * Called with the new image, already cropped when `crop` is on, or `null` when it is removed.
   * Return a promise to show progress; a rejection puts the previous avatar back and shows its message.
   */
  onChange?: (file: File | null) => void | Promise<void>
  /** Accepted MIME types, as the file input’s `accept`. */
  accept?: string
  /** Largest accepted file, in bytes. */
  maxSize?: number
  /** Ask for a square crop before handing the image over. */
  crop?: boolean
  /** Diameter in pixels. */
  size?: number
  /** Allow removing the avatar back to initials. */
  removable?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`

/** Draws the cropped square to a canvas. Falls back to the original file where there is no canvas. */
async function cropFile(file: File, url: string, rect: CropRect): Promise<File> {
  const image = new Image()
  image.src = url
  await image.decode().catch(() => undefined)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext?.('2d')
  if (!context || !image.naturalWidth) return file
  const sx = rect.x * image.naturalWidth
  const sy = rect.y * image.naturalHeight
  const side = Math.round(Math.min(rect.width * image.naturalWidth, rect.height * image.naturalHeight, 1024))
  canvas.width = side
  canvas.height = side
  context.drawImage(image, sx, sy, rect.width * image.naturalWidth, rect.height * image.naturalHeight, 0, 0, side, side)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
  return blob ? new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type }) : file
}

/**
 * The profile photo control: the avatar itself is the button.
 *
 * Settings pages usually put a file input next to a picture and leave the
 * reader to connect them. Here the picture is the target — click it, or drop an
 * image on it — and Remove sits beside it. The preview comes from an object URL,
 * so it shows before anything has uploaded, and that URL is revoked when it is
 * replaced so a session of trying photos does not hold every one in memory.
 *
 * Type and size are checked before anything else happens, and the reason is
 * said in words — “PNG, JPG or WebP, up to 5 MB” — rather than a silent no-op.
 * With `crop`, a square Cropper comes first, so a landscape photo is framed by
 * the person in it instead of cut down the middle by a CSS rule.
 */
export function AvatarUpload({
  src,
  name,
  onChange,
  accept = 'image/png,image/jpeg,image/webp,image/gif',
  maxSize = 5 * 1024 * 1024,
  crop = false,
  size = 96,
  removable = true,
  disabled = false,
  className,
}: AvatarUploadProps) {
  const uid = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const [preview, setPreview] = useState<string | null | undefined>(undefined)
  const [pending, setPending] = useState<{ file: File; url: string; aspect?: number } | null>(null)
  const [rect, setRect] = useState<CropRect>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const urls = useRef(new Set<string>())

  const shown = preview === undefined ? src : preview
  const types = accept.split(',').map((type) => type.trim())
  const typeNames = types.map((type) => type.split('/')[1]?.replace('jpeg', 'JPG').toUpperCase()).filter(Boolean)
  const rule = `${typeNames.slice(0, -1).join(', ')}${typeNames.length > 1 ? ' or ' : ''}${typeNames[typeNames.length - 1]}, up to ${megabytes(maxSize)}`

  const makeUrl = (file: File) => {
    const url = URL.createObjectURL(file)
    urls.current.add(url)
    return url
  }
  const revoke = (url?: string | null) => {
    if (url && urls.current.delete(url)) URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const owned = urls.current
    return () => owned.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const hand = async (file: File | null, url: string | null) => {
    const previous = preview
    setPreview(url)
    setError('')
    setBusy(true)
    try {
      await onChange?.(file)
      if (previous !== url) revoke(previous)
      setStatus(file ? 'Photo updated' : 'Photo removed')
    } catch (reason) {
      revoke(url)
      setPreview(previous)
      setError(reason instanceof Error ? reason.message : 'That did not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const accepts = (file: File) =>
    types.some((type) => (type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type))

  const take = (file?: File) => {
    if (!file || disabled || busy) return
    if (!accepts(file)) return setError(`That file is not an image we can use. Choose ${rule}.`)
    if (file.size > maxSize) return setError(`That image is ${megabytes(file.size)}. Choose one up to ${megabytes(maxSize)}.`)
    const url = makeUrl(file)
    if (!crop) return void hand(file, url)
    setError('')
    setRect(undefined)
    setPending({ file, url })
  }

  const confirmCrop = async () => {
    if (!pending) return
    const file = rect ? await cropFile(pending.file, pending.url, rect) : pending.file
    const url = file === pending.file ? pending.url : makeUrl(file)
    if (url !== pending.url) revoke(pending.url)
    focusAvatar.current = true
    setPending(null)
    await hand(file, url)
  }

  // Leaving the crop step puts focus back on the avatar, once it is back on the page.
  const focusAvatar = useRef(false)
  useEffect(() => {
    if (pending || !focusAvatar.current) return
    focusAvatar.current = false
    avatarRef.current?.focus()
  }, [pending])

  const cropRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // The avatar that had focus is gone while cropping; the crop frame takes it.
    if (pending?.aspect !== undefined) cropRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [pending?.aspect])

  const cancelCrop = () => {
    if (pending) revoke(pending.url)
    setPending(null)
    focusAvatar.current = true
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files[0])
  }

  if (pending) {
    return (
      <div ref={cropRef} role="group" aria-label={`Crop photo of ${name}`} className={cn('flex w-full max-w-[320px] flex-col gap-3', className)}>
        {/* The frame is the image's own shape, so crop fractions map straight onto its pixels. */}
        {pending.aspect === undefined ? (
          <img
            src={pending.url}
            alt=""
            className="block w-full rounded-[var(--radius-card)]"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget
              const aspect = naturalWidth ? naturalHeight / naturalWidth : 1
              // Start from the largest centred square, a little inset so the handles show.
              const width = 0.9 * Math.min(1, aspect)
              const height = 0.9 * Math.min(1, 1 / aspect)
              setRect({ x: (1 - width) / 2, y: (1 - height) / 2, width, height })
              setPending((current) => current && { ...current, aspect })
            }}
          />
        ) : (
          <Cropper label="Crop area. Arrow keys move it; each corner handle resizes it." aspect={pending.aspect} value={rect} onChange={setRect}>
            <img src={pending.url} alt={`New photo of ${name}`} className="pointer-events-none block w-full" />
          </Cropper>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancelCrop}>
            Cancel
          </Button>
          <Button size="sm" onClick={confirmCrop}>
            Use photo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-4', disabled && 'opacity-40', className)}>
      <button
        ref={avatarRef}
        type="button"
        disabled={disabled}
        aria-disabled={busy || undefined}
        aria-label={shown ? `Change photo of ${name}` : `Add a photo of ${name}`}
        aria-describedby={`${uid}-rule`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
        className={cn(
          'group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted font-bold text-ink-soft',
          'ring-offset-2 ring-offset-surface transition-shadow disabled:cursor-not-allowed',
          dragging && 'ring-2 ring-accent-strong',
        )}
      >
        {shown ? <img src={shown} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{initials(name)}</span>}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] text-ink-inverse opacity-0 transition-opacity',
            'group-hover:opacity-100 group-focus-visible:opacity-100',
            (dragging || busy) && 'opacity-100',
          )}
        >
          {busy ? <Spinner /> : <PencilIcon size={Math.max(14, Math.round(size / 5))} />}
        </span>
      </button>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
            {shown ? 'Change photo' : 'Upload photo'}
          </Button>
          {removable && shown && (
            <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={() => void hand(null, null)}>
              Remove
            </Button>
          )}
        </div>
        <p id={`${uid}-rule`} className="text-[12px] font-medium text-ink-faint">
          {rule}. Or drop an image on the photo.
        </p>
        {error && (
          <p role="alert" className="text-[12px] font-semibold text-danger">
            {error}
          </p>
        )}
        <span role="status" className="sr-only">
          {status}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          take(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}
