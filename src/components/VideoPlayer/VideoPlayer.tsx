'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Menu } from '../Menu'
import { Slider } from '../Slider'
import { VisuallyHidden } from '../VisuallyHidden'
import type { IconComponent } from '../../lib/types'

export interface VideoPlayerTrack {
  src: string
  /** BCP 47 language of the track, e.g. "en". */
  srcLang: string
  /** Name in the track list, e.g. "English". */
  label: string
  kind?: 'captions' | 'subtitles'
  /** Show this track when captions are on. The first track is used otherwise. */
  default?: boolean
}

export interface VideoPlayerProps {
  src: string
  /** Accessible name for the player — the video's title. */
  title: string
  /** Image shown before playback starts. */
  poster?: string
  /** Caption and subtitle files (WebVTT). */
  tracks?: VideoPlayerTrack[]
  /** Speeds offered in the speed menu. */
  rates?: number[]
  /** Seconds that J and L skip. */
  skip?: number
  /** Loop at the end. */
  loop?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const glyph = (body: React.ReactNode, filled = false): IconComponent =>
  function Glyph({ size = 16, className }) {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {body}
      </svg>
    )
  }

const PlayGlyph = glyph(<path d="M4.5 2.8v10.4a.6.6 0 00.9.5l8.2-5.2a.6.6 0 000-1L5.4 2.3a.6.6 0 00-.9.5z" />, true)
const PauseGlyph = glyph(
  <>
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
  </>,
  true,
)
const VolumeGlyph = glyph(<path d="M2.5 6v4h2.5l3.5 3V3L5 6H2.5zM11 5.5a3.5 3.5 0 010 5M12.8 3.5a6 6 0 010 9" />)
const MutedGlyph = glyph(<path d="M2.5 6v4h2.5l3.5 3V3L5 6H2.5zM11 6l3.5 4M14.5 6L11 10" />)
const CaptionsGlyph = glyph(
  <>
    <rect x="1.5" y="3" width="13" height="10" rx="2" />
    <path d="M7 6.8a1.8 1.8 0 100 2.4M11.5 6.8a1.8 1.8 0 100 2.4" />
  </>,
)
const ExpandGlyph = glyph(<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />)
const CollapseGlyph = glyph(<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" />)

/** "1:05", or "1:02:05" past an hour. */
export function formatMediaTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = String(safe % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * A video with controls drawn by the library, so they match the rest of the
 * page and every one of them is a real, labelled control.
 *
 * The controls sit under the picture rather than over it and never auto-hide:
 * controls that fade out after three seconds are controls a keyboard or a
 * magnifier user has to chase.
 *
 * The YouTube shortcuts work — Space and K play, J and L skip, arrows seek and
 * change volume, M mutes, F goes full screen, C toggles captions — but only
 * while focus is inside the player, so a page with two videos, or a video
 * beside a text field, never has a keystroke land in the wrong place. Each
 * shortcut says what it did through a live region.
 */
export function VideoPlayer({
  src,
  title,
  poster,
  tracks = [],
  rates = [0.5, 0.75, 1, 1.25, 1.5, 2],
  skip = 10,
  loop = false,
  className,
}: VideoPlayerProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [captions, setCaptions] = useState(() => tracks.some((track) => track.default))
  const [fullscreen, setFullscreen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const list = video.current?.textTracks
    if (!list) return
    const chosen = Math.max(0, tracks.findIndex((track) => track.default))
    for (let index = 0; index < list.length; index++) {
      list[index].mode = captions && index === chosen ? 'showing' : 'hidden'
    }
  }, [captions, tracks])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    const node = video.current
    if (!node) return
    if (node.paused) node.play()?.catch(() => setPlaying(false))
    else node.pause()
  }
  const seek = (to: number) => {
    const node = video.current
    if (!node) return
    node.currentTime = Math.max(0, Math.min(duration || node.duration || 0, to))
    setTime(node.currentTime)
  }
  const setLevel = (level: number) => {
    const node = video.current
    const next = Math.round(Math.max(0, Math.min(1, level)) * 100) / 100
    setVolume(next)
    setMuted(next === 0)
    if (node) {
      node.volume = next
      node.muted = next === 0
    }
  }
  const toggleMute = () => {
    const node = video.current
    const next = !muted
    setMuted(next)
    if (node) node.muted = next
  }
  const changeRate = (next: number) => {
    setRate(next)
    if (video.current) video.current.playbackRate = next
  }
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void root.current?.requestFullscreen?.()
    } catch {
      // Full screen can be refused (an iframe without allowfullscreen); the player carries on.
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target as HTMLElement
    // Keys from the speed menu bubble here through its portal; they are not ours.
    if (!root.current?.contains(target)) return
    const onRange = target instanceof HTMLInputElement && target.type === 'range'
    const onButton = target.closest('button') !== null
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const actions: Record<string, () => string | void> = {
      k: () => {
        const wasPaused = video.current?.paused
        toggle()
        return wasPaused ? 'Playing' : 'Paused'
      },
      j: () => (seek(time - skip), `Back ${skip} seconds`),
      l: () => (seek(time + skip), `Forward ${skip} seconds`),
      m: () => (toggleMute(), muted ? 'Unmuted' : 'Muted'),
      f: () => toggleFullscreen(),
      c: () => {
        if (!tracks.length) return
        setCaptions(!captions)
        return captions ? 'Captions off' : 'Captions on'
      },
    }
    if (!onButton) actions[' '] = actions.k
    if (!onRange) {
      actions.ArrowLeft = () => (seek(time - 5), 'Back 5 seconds')
      actions.ArrowRight = () => (seek(time + 5), 'Forward 5 seconds')
      actions.ArrowUp = () => (setLevel(volume + 0.1), `Volume ${Math.round(Math.min(1, volume + 0.1) * 100)}%`)
      actions.ArrowDown = () => (setLevel(volume - 0.1), `Volume ${Math.round(Math.max(0, volume - 0.1) * 100)}%`)
    }
    const action = actions[key]
    if (!action) return
    event.preventDefault()
    const said = action()
    if (said) setMessage(said)
  }

  const trackable = tracks.length > 0

  return (
    <div
      ref={root}
      role="group"
      aria-label={title}
      // Focusable by pointer only: a click on the picture puts focus in the
      // player, so the shortcuts work without first tabbing to a control.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface', fullscreen && 'rounded-none border-0', className)}
    >
      <div className={cn('relative bg-surface-sunken', fullscreen && 'flex flex-1 items-center justify-center')}>
        <video
          ref={video}
          src={src}
          poster={poster}
          loop={loop}
          playsInline
          preload="metadata"
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          className={cn('block w-full', fullscreen ? 'max-h-full' : 'aspect-video object-contain')}
        >
          {tracks.map((track) => (
            <track key={track.src} src={track.src} srcLang={track.srcLang} label={track.label} kind={track.kind ?? 'captions'} default={track.default} />
          ))}
        </video>
        {!playing && time === 0 && (
          <button
            type="button"
            onClick={toggle}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-float)] transition-transform hover:scale-105 motion-reduce:transition-none"
          >
            <PlayGlyph size={22} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-2 pt-3">
        <Slider
          aria-label="Seek"
          aria-valuetext={`${formatMediaTime(time)} of ${formatMediaTime(duration)}`}
          value={Math.min(time, duration || 0)}
          min={0}
          max={duration || 0}
          step={0.1}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <div className="flex items-center gap-1">
          <IconButton icon={playing ? PauseGlyph : PlayGlyph} label={playing ? 'Pause' : 'Play'} size="sm" tone="bare" onClick={toggle} />
          <span className="px-1 text-[12px] font-semibold tabular-nums text-ink-soft">
            {formatMediaTime(time)} <span aria-hidden="true">/</span>
            <VisuallyHidden> of </VisuallyHidden> {formatMediaTime(duration)}
          </span>
          <span className="flex-1" />
          <IconButton icon={muted || volume === 0 ? MutedGlyph : VolumeGlyph} label={muted ? 'Unmute' : 'Mute'} size="sm" tone="bare" onClick={toggleMute} />
          <Slider
            aria-label="Volume"
            aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
            value={muted ? 0 : volume}
            min={0}
            max={1}
            step={0.05}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="w-20 max-sm:hidden"
          />
          {trackable && (
            <IconButton icon={CaptionsGlyph} label="Captions" size="sm" tone="bare" selected={captions} aria-pressed={captions} onClick={() => setCaptions(!captions)} />
          )}
          <Menu
            label="Playback speed"
            placement="top"
            align="end"
            items={rates.map((option) => ({
              id: String(option),
              label: `${option}×`,
              selected: option === rate,
              onSelect: () => changeRate(option),
            }))}
            trigger={
              <Button variant="ghost" size="sm" className="px-2.5 tabular-nums">
                {rate}×<VisuallyHidden> playback speed</VisuallyHidden>
              </Button>
            }
          />
          <IconButton
            icon={fullscreen ? CollapseGlyph : ExpandGlyph}
            label={fullscreen ? 'Exit full screen' : 'Full screen'}
            size="sm"
            tone="bare"
            onClick={toggleFullscreen}
          />
        </div>
      </div>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {message}
        </span>
      </VisuallyHidden>
    </div>
  )
}
