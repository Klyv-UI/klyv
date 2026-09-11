'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface PianoKeysProps {
  /** Lowest note, as a MIDI number. 60 is middle C. */
  from?: number
  /** How many white keys. */
  keys?: number
  /** Bind the home row — z x c v… and s d, g h j for the blacks. */
  keyboard?: boolean
  /** Show the letter on each key. */
  showLetters?: boolean
  /** Oscillator shape. */
  timbre?: OscillatorType
  /** Called with the MIDI number each time a key sounds. */
  onNote?: (midi: number) => void
  /** Keyboard height in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/** Semitone offsets within an octave that are black keys. */
const BLACK = new Set([1, 3, 6, 8, 10])
const LETTERS = 'zsxdcvgbhnjm,l.;/'

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const nameOf = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

/**
 * Keys that actually make a sound.
 *
 * Each note is an oscillator with a short attack and an exponential release,
 * created on press and thrown away on the way down. Reusing one oscillator and
 * changing its frequency is the tempting shortcut and it makes every note
 * slide into the next, because an oscillator's frequency is continuous — a
 * piano's is not.
 *
 * The envelope is the whole difference between an instrument and a beep. A
 * gain that jumps to 1 produces a click, because a discontinuity in amplitude
 * is broadband noise; ramping over a few milliseconds removes it entirely.
 * `exponentialRampToValueAtTime` cannot reach zero, so the release targets a
 * very small number and the node is stopped after it.
 *
 * The keyboard is bound the way a tracker binds it — the home row is the white
 * keys and the row above holds the blacks in the right gaps — so the shape of
 * the layout matches the shape of the instrument.
 */
export function PianoKeys({
  from = 60,
  keys = 10,
  keyboard = true,
  showLetters = true,
  timbre = 'triangle',
  onNote,
  height = 150,
  className,
}: PianoKeysProps) {
  const contextRef = useRef<AudioContext | null>(null)
  const voices = useRef(new Map<number, { osc: OscillatorNode; gain: GainNode }>())
  const [held, setHeld] = useState<number[]>([])

  // Build the note list: white keys plus the blacks that sit between them.
  const notes: { midi: number; black: boolean }[] = []
  let midi = from
  while (notes.filter((note) => !note.black).length < keys) {
    notes.push({ midi, black: BLACK.has(midi % 12) })
    midi += 1
  }

  const press = useCallback(
    (note: number) => {
      if (voices.current.has(note)) return
      const context = (contextRef.current ??= new AudioContext())
      void context.resume()

      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = timbre
      osc.frequency.value = 440 * 2 ** ((note - 69) / 12)

      // A gain that jumps to 1 is a click — a discontinuity is broadband noise.
      const now = context.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.012)

      osc.connect(gain)
      gain.connect(context.destination)
      osc.start()

      voices.current.set(note, { osc, gain })
      setHeld((current) => [...current, note])
      onNote?.(note)
    },
    [onNote, timbre],
  )

  const release = useCallback((note: number) => {
    const voice = voices.current.get(note)
    const context = contextRef.current
    if (!voice || !context) return
    voices.current.delete(note)
    setHeld((current) => current.filter((entry) => entry !== note))

    const now = context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
    // Exponential ramps cannot reach zero, so aim just above it and stop after.
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    voice.osc.stop(now + 0.24)
  }, [])

  useEffect(() => {
    if (!keyboard) return
    const map = new Map<string, number>()
    notes.forEach((note, index) => {
      const letter = LETTERS[index]
      if (letter) map.set(letter, note.midi)
    })

    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const note = map.get(event.key.toLowerCase())
      if (note !== undefined) press(note)
    }
    const up = (event: KeyboardEvent) => {
      const note = map.get(event.key.toLowerCase())
      if (note !== undefined) release(note)
    }

    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  })

  useEffect(
    () => () => {
      for (const note of voices.current.keys()) release(note)
      void contextRef.current?.close()
    },
    [release],
  )

  const whites = notes.filter((note) => !note.black)
  const whiteWidth = 100 / whites.length

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        aria-label="Playable keys"
        className="relative w-full select-none overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface"
        style={{ height }}
      >
        {notes.map((note, index) => {
          const whiteIndex = notes.slice(0, index).filter((entry) => !entry.black).length
          const down = held.includes(note.midi)
          const letter = LETTERS[index]

          if (note.black) {
            return (
              <button
                key={note.midi}
                type="button"
                aria-label={nameOf(note.midi)}
                aria-pressed={down}
                onPointerDown={() => press(note.midi)}
                onPointerUp={() => release(note.midi)}
                onPointerLeave={() => release(note.midi)}
                className={cn(
                  'absolute top-0 z-10 flex items-end justify-center rounded-b-[6px] pb-1.5 transition-colors',
                  down ? 'bg-accent-strong text-accent-ink' : 'bg-[#16181a] text-white/50',
                )}
                style={{
                  left: `calc(${whiteIndex * whiteWidth}% - ${whiteWidth * 0.3}%)`,
                  width: `${whiteWidth * 0.6}%`,
                  height: '62%',
                }}
              >
                {showLetters && letter && (
                  <span className="text-[9px] font-bold uppercase">{letter}</span>
                )}
              </button>
            )
          }

          return (
            <button
              key={note.midi}
              type="button"
              aria-label={nameOf(note.midi)}
              aria-pressed={down}
              onPointerDown={() => press(note.midi)}
              onPointerUp={() => release(note.midi)}
              onPointerLeave={() => release(note.midi)}
              className={cn(
                'absolute bottom-0 top-0 flex items-end justify-center border-r border-line pb-2 transition-colors last:border-r-0',
                down ? 'bg-accent-soft' : 'bg-white hover:bg-surface-muted',
              )}
              style={{ left: `${whiteIndex * whiteWidth}%`, width: `${whiteWidth}%` }}
            >
              {showLetters && letter && (
                <span className="text-[10px] font-bold uppercase text-[#6e7369]">{letter}</span>
              )}
            </button>
          )
        })}
      </div>

      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {held.length === 0
          ? keyboard
            ? 'Press the keys, or use your keyboard.'
            : 'Press the keys.'
          : held.map((note) => nameOf(note)).join(' · ')}
      </Text>
    </div>
  )
}
