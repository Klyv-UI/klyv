'use client'

import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Menu } from '../Menu'
import { Slider } from '../Slider'
import { VisuallyHidden } from '../VisuallyHidden'
import { Waveform } from '../Waveform'
import { formatMediaTime } from '../VideoPlayer/VideoPlayer'
import type { IconComponent } from '../../lib/types'

export interface AudioPlayerChapter {
  /** Where the chapter starts, in seconds. */
  start: number
  title: string
}

export interface AudioPlayerProps {
  src: string
  /** The episode or track title. Also names the player. */
  title: string
  /** Secondary line — the show, the artist. */
  subtitle?: string
  /** Cover image. Decorative: the title already names the audio. */
  artwork?: string
  /** Bar heights, 0–1, drawn as a waveform that doubles as the seek bar. */
  waveform?: number[]
  /** Chapter marks, listed under the controls and jumped to on click. */
  chapters?: AudioPlayerChapter[]
  /** Speeds offered in the speed menu. */
  rates?: number[]
  /** Merged last, so it wins. */
  className?: string
}

const PlayGlyph: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M4.5 2.8v10.4a.6.6 0 00.9.5l8.2-5.2a.6.6 0 000-1L5.4 2.3a.6.6 0 00-.9.5z" />
  </svg>
)
const PauseGlyph: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
  </svg>
)

/**
 * A podcast episode or a voice note with controls that match the page:
 * play, a seek bar, the time, and a speed menu — the four things people
 * actually use on spoken audio.
 *
 * Given `waveform` data, the waveform is the seek bar. The bars are drawn by
 * Waveform and a real range input lies over them, so the pointer drags the
 * picture while the keyboard and screen readers get a slider that announces
 * "3:12 of 41:05".
 *
 * Chapters are a list of buttons under the controls, with the one playing
 * marked as current, because a long episode is navigated by topic and not by
 * dragging to a guess.
 */
export function AudioPlayer({
  src,
  title,
  subtitle,
  artwork,
  waveform,
  chapters = [],
  rates = [0.75, 1, 1.25, 1.5, 1.75, 2],
  className,
}: AudioPlayerProps) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)

  const toggle = () => {
    const node = audio.current
    if (!node) return
    if (node.paused) node.play()?.catch(() => setPlaying(false))
    else node.pause()
  }
  const seek = (to: number) => {
    const node = audio.current
    if (!node) return
    node.currentTime = Math.max(0, Math.min(duration || node.duration || 0, to))
    setTime(node.currentTime)
  }

  const sortedChapters = [...chapters].sort((a, b) => a.start - b.start)
  const currentChapter = sortedChapters.reduce<number>((found, chapter, index) => (chapter.start <= time ? index : found), -1)

  const seekProps = {
    'aria-label': 'Seek',
    'aria-valuetext': `${formatMediaTime(time)} of ${formatMediaTime(duration)}`,
    value: Math.min(time, duration || 0),
    min: 0,
    max: duration || 0,
    step: 1,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => seek(Number(event.target.value)),
  }

  return (
    <div role="group" aria-label={title} className={cn('flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4', className)}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      />

      <div className="flex items-center gap-3">
        {artwork && <img src={artwork} alt="" className="size-12 shrink-0 rounded-[var(--radius-glyph)] object-cover" />}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-extrabold text-ink">{title}</span>
          {subtitle && <span className="truncate text-[12px] font-medium text-ink-faint">{subtitle}</span>}
        </div>
        <IconButton icon={playing ? PauseGlyph : PlayGlyph} label={playing ? 'Pause' : 'Play'} tone="accent" size="md" onClick={toggle} />
      </div>

      {waveform?.length ? (
        <div className="relative rounded-[6px] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-focus">
          <Waveform label="Waveform" values={waveform} progress={duration ? time / duration : 0} height={40} barWidth={3} gap={2} className="w-full justify-between" />
          <input
            type="range"
            {...seekProps}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          />
        </div>
      ) : (
        <Slider {...seekProps} />
      )}

      <div className="flex items-center gap-2">
        <span className="flex-1 text-[12px] font-semibold tabular-nums text-ink-soft">
          {formatMediaTime(time)}
          <VisuallyHidden> of</VisuallyHidden>
          <span aria-hidden="true"> / </span>
          {formatMediaTime(duration)}
        </span>
        <Menu
          label="Playback speed"
          align="end"
          items={rates.map((option) => ({
            id: String(option),
            label: `${option}×`,
            selected: option === rate,
            onSelect: () => {
              setRate(option)
              if (audio.current) audio.current.playbackRate = option
            },
          }))}
          trigger={
            <Button variant="muted" size="sm" className="h-7 px-2.5 tabular-nums">
              {rate}×<VisuallyHidden> playback speed</VisuallyHidden>
            </Button>
          }
        />
      </div>

      {sortedChapters.length > 0 && (
        <ol aria-label="Chapters" className="-mx-1.5 flex flex-col border-t border-line pt-2">
          {sortedChapters.map((chapter, index) => (
            <li key={`${chapter.start}-${chapter.title}`}>
              <button
                type="button"
                aria-current={index === currentChapter ? 'true' : undefined}
                onClick={() => {
                  seek(chapter.start)
                  if (audio.current?.paused) toggle()
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[10px] px-1.5 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-muted',
                  index === currentChapter ? 'font-bold text-ink' : 'font-medium text-ink-soft',
                )}
              >
                <span className="w-12 shrink-0 tabular-nums text-ink-faint">{formatMediaTime(chapter.start)}</span>
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                {index === currentChapter && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent-strong" />}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
