'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Select } from '../Select'
import { Text } from '../Text'

export type CameraCaptureStatus = 'idle' | 'starting' | 'live' | 'review' | 'done' | 'denied' | 'unavailable' | 'error'

export interface CameraCaptureResult {
  blob: Blob
  width: number
  height: number
}

export interface CameraCaptureProps {
  /** Called with the still when the person presses “Use photo”. */
  onCapture?: (result: CameraCaptureResult) => void
  /** Which camera to ask for first. The device menu can change it afterwards. */
  facingMode?: 'user' | 'environment'
  /** Mirror the preview. `auto` mirrors front cameras only, as a mirror would. */
  mirror?: boolean | 'auto'
  /** Image format of the still. */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Encoder quality for jpeg and webp, 0 to 1. */
  quality?: number
  /** Resolution to ask the camera for. The camera may deliver less. */
  idealWidth?: number
  /** Names the control and the preview. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const MESSAGES: Record<'idle' | 'denied' | 'unavailable' | 'error', { title: string; body: string }> = {
  idle: {
    title: 'Camera is off',
    body: 'Your browser will ask for permission. Nothing is recorded or uploaded until you choose “Use photo”.',
  },
  denied: {
    title: 'Camera access is blocked',
    body: 'Allow the camera for this site from the icon in the address bar, then press “Try again”.',
  },
  unavailable: {
    title: 'No camera available',
    body: 'This device has no camera, or the page is not served over HTTPS, which browsers require for camera access.',
  },
  error: {
    title: 'The camera could not start',
    body: 'Another app may be using it. Close that app, then press “Try again”.',
  },
}

const stop = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop())

/**
 * Take a photo with the device camera, inside the page.
 *
 * A file input with `capture` hands the job to the operating system and gets
 * a file back, which is fine on a phone and useless on a laptop. This keeps
 * the preview in the layout, and says plainly why it is not working when it
 * is not: a blocked permission, a missing camera and a camera in use by
 * another app are three different fixes, so they are three different
 * messages rather than one “something went wrong”.
 *
 * The front camera is mirrored in the preview because that is what people
 * expect from a mirror, but the still is drawn the right way round so text
 * in the photo reads correctly. Tracks are stopped on unmount and after the
 * photo is used — the camera light going off is the promise that it is off.
 */
export function CameraCapture({
  onCapture,
  facingMode = 'user',
  mirror = 'auto',
  mimeType = 'image/jpeg',
  quality = 0.9,
  idealWidth = 1280,
  label = 'Camera',
  className,
}: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const still = useRef<{ blob: Blob; url: string; width: number; height: number } | null>(null)
  const alive = useRef(true)
  const [status, setStatus] = useState<CameraCaptureStatus>('idle')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [mirrored, setMirrored] = useState(false)
  const [stillUrl, setStillUrl] = useState<string | null>(null)

  const clearStill = () => {
    if (still.current) URL.revokeObjectURL(still.current.url)
    still.current = null
    setStillUrl(null)
  }

  const start = async (device?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable')
    stop(stream.current)
    setStatus('starting')
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: device ? { deviceId: { exact: device }, width: { ideal: idealWidth } } : { facingMode, width: { ideal: idealWidth } },
      })
      if (!alive.current) return stop(next)
      stream.current = next
      const track = next.getVideoTracks()[0]
      const settings = track?.getSettings() ?? {}
      setDeviceId(settings.deviceId ?? device ?? '')
      const front = settings.facingMode ? settings.facingMode === 'user' : !/back|rear|environment/i.test(track?.label ?? '')
      setMirrored(mirror === 'auto' ? front : mirror)
      if (video.current) {
        video.current.srcObject = next
        await video.current.play().catch(() => undefined)
      }
      // Labels are only filled in once permission is granted, so list now.
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((entry) => entry.kind === 'videoinput'))
      setStatus('live')
    } catch (error) {
      const name = (error as DOMException)?.name
      setStatus(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'unavailable'
            : 'error',
      )
    }
  }

  const capture = () => {
    const node = video.current
    if (!node || !node.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = node.videoWidth
    canvas.height = node.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(node, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob || !alive.current) return
        clearStill()
        const url = URL.createObjectURL(blob)
        still.current = { blob, url, width: canvas.width, height: canvas.height }
        setStillUrl(url)
        setStatus('review')
      },
      mimeType,
      quality,
    )
  }

  const use = () => {
    if (!still.current) return
    const { blob, width, height } = still.current
    onCapture?.({ blob, width, height })
    stop(stream.current)
    stream.current = null
    setStatus('done')
  }

  const retake = () => {
    clearStill()
    if (stream.current?.active) setStatus('live')
    else void start(deviceId || undefined)
  }

  useEffect(() => {
    alive.current = true
    // Report a permission that is already blocked before the person tries.
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((result) => alive.current && result.state === 'denied' && setStatus('denied'))
      .catch(() => undefined)
    return () => {
      alive.current = false
      stop(stream.current)
      stream.current = null
      if (still.current) URL.revokeObjectURL(still.current.url)
    }
  }, [])

  const message = status === 'idle' || status === 'denied' || status === 'unavailable' || status === 'error' ? MESSAGES[status] : null
  const showVideo = status === 'live' || status === 'starting'

  return (
    <div role="group" aria-label={label} className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken">
        <video
          ref={video}
          muted
          playsInline
          aria-label={`${label} preview`}
          className={cn('size-full object-cover', mirrored && '-scale-x-100', !showVideo && 'hidden')}
        />
        {stillUrl && (status === 'review' || status === 'done') && (
          <img src={stillUrl} alt="The photo you just took" className="absolute inset-0 size-full object-cover" />
        )}
        {status === 'starting' && (
          <Text size="label" tone="soft" className="absolute inset-0 grid place-items-center">
            Starting camera…
          </Text>
        )}
        {message && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-6 text-center">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-ink-faint" aria-hidden="true">
              <path d="M3 8.5A1.5 1.5 0 014.5 7h2.3l1.6-2h7.2l1.6 2h2.3A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />
              <circle cx="12" cy="13" r="3.5" />
              {status !== 'idle' && <path d="M4 4l16 16" />}
            </svg>
            <Text size="body" weight="bold">
              {message.title}
            </Text>
            <Text size="caption" tone="soft" leading="normal" className="max-w-[36ch]">
              {message.body}
            </Text>
          </div>
        )}
      </div>

      <div role="status" className="sr-only">
        {status === 'live' ? 'Camera on' : status === 'review' ? 'Photo taken. Use it or retake.' : status === 'done' ? 'Photo saved' : message?.title}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(status === 'idle' || status === 'denied' || status === 'error' || status === 'unavailable') && (
          <Button size="sm" onClick={() => start()} disabled={status === 'unavailable'}>
            {status === 'idle' ? 'Start camera' : 'Try again'}
          </Button>
        )}
        {status === 'live' && (
          <Button size="sm" onClick={capture}>
            Take photo
          </Button>
        )}
        {status === 'review' && (
          <>
            <Button size="sm" onClick={use}>
              Use photo
            </Button>
            <Button size="sm" variant="outline" onClick={retake}>
              Retake
            </Button>
          </>
        )}
        {status === 'done' && (
          <Button size="sm" variant="outline" onClick={retake}>
            Take another
          </Button>
        )}
        {status === 'live' && devices.length > 1 && (
          <Select
            size="sm"
            label="Camera device"
            value={deviceId}
            onValueChange={(next) => void start(next)}
            options={devices.map((device, index) => ({ value: device.deviceId, label: device.label || `Camera ${index + 1}` }))}
            className="ml-auto"
          />
        )}
      </div>
    </div>
  )
}
