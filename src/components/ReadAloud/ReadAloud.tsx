'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Select } from '../Select'
import { Text } from '../Text'

export interface ReadAloudProps {
  /** Text to read. It is rendered by the component, so the current word can be marked in it. */
  text?: string
  /** Or read the text inside this element, in place. Highlighting needs the CSS Custom Highlight API. */
  targetRef?: RefObject<HTMLElement | null>
  /** Language used to pick a default voice, e.g. `en-GB`. Defaults to the page language. */
  lang?: string
  /** Starting speed, 0.5 to 2. */
  defaultRate?: number
  /** Names the controls. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Status = 'idle' | 'playing' | 'paused'
interface Chunk {
  start: number
  end: number
}

const RATES = ['0.75', '1', '1.25', '1.5', '2']

/** Sentences, because Chrome cuts off utterances that run past about fifteen seconds. */
function chunk(source: string): Chunk[] {
  const chunks: Chunk[] = []
  for (const match of source.matchAll(/[^.!?\n]+[.!?]*\s*|\n+/g)) {
    if (match[0].trim()) chunks.push({ start: match.index!, end: match.index! + match[0].length })
  }
  return chunks
}

/** Maps a character offset in the concatenated text back to a text node. */
function textNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: { node: CharacterData; start: number }[] = []
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node: node as CharacterData, start: text.length })
    text += node.nodeValue ?? ''
  }
  return { text, nodes }
}

const canHighlight = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'

/**
 * Reads text out loud with the browser's own voices, marking each word as it
 * is spoken.
 *
 * Following along is the point for most people who use this — readers with
 * dyslexia, people learning the language — so the highlight is driven by the
 * synthesiser's `boundary` events rather than an estimate from reading speed,
 * which drifts within a sentence. Where the CSS Custom Highlight API exists the
 * word is marked without touching the DOM, which is what makes reading an
 * existing article in place possible; elsewhere a `text` prop is rendered with
 * the current word wrapped in a mark.
 *
 * Changing speed or voice mid-sentence restarts from the current word, because
 * an utterance's settings are fixed once it starts. Voices load asynchronously
 * in Chrome, so the list fills in when the browser says it is ready.
 */
export function ReadAloud({ text, targetRef, lang, defaultRate = 1, label = 'Read aloud', className }: ReadAloudProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const [rate, setRate] = useState(String(defaultRate))
  const [status, setStatus] = useState<Status>('idle')
  const [word, setWord] = useState<Chunk | null>(null)
  const own = useRef<HTMLParagraphElement>(null)
  const run = useRef({ generation: 0, position: 0, active: false })
  const highlightName = `klyv-read-aloud-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const root = () => (text !== undefined ? own.current : targetRef?.current ?? null)

  const mark = (range: Chunk | null) => {
    if (canHighlight()) {
      const element = root()
      if (!range || !element) return CSS.highlights.delete(highlightName)
      const { nodes } = textNodes(element)
      const hit = [...nodes].reverse().find((entry) => entry.start <= range.start)
      if (!hit) return
      const length = hit.node.length
      const from = Math.min(range.start - hit.start, length)
      const dom = new Range()
      dom.setStart(hit.node, from)
      dom.setEnd(hit.node, Math.min(range.end - hit.start, length))
      CSS.highlights.set(highlightName, new Highlight(dom))
    } else if (text !== undefined) setWord(range)
  }

  const stop = () => {
    run.current.generation += 1
    run.current.active = false
    window.speechSynthesis.cancel()
    setStatus('idle')
    mark(null)
  }

  const speakFrom = (position: number, settings = { rate, voice }) => {
    const element = root()
    const source = text ?? (element ? textNodes(element).text : '')
    const chunks = chunk(source)
    const index = chunks.findIndex((entry) => position < entry.end)
    if (index === -1) return stop()
    const generation = (run.current.generation += 1)
    window.speechSynthesis.cancel()

    const say = (at: number, offset: number) => {
      const utterance = new SpeechSynthesisUtterance(source.slice(offset, chunks[at].end))
      utterance.rate = Number(settings.rate)
      utterance.lang = lang ?? document.documentElement.lang ?? ''
      const chosen = window.speechSynthesis.getVoices().find((entry) => entry.voiceURI === settings.voice)
      if (chosen) utterance.voice = chosen
      utterance.onboundary = (event) => {
        if (run.current.generation !== generation || event.name !== 'word') return
        const start = offset + event.charIndex
        const length = event.charLength || (/^\S+/.exec(source.slice(start))?.[0].length ?? 0)
        run.current.position = start
        mark({ start, end: start + length })
      }
      utterance.onend = () => {
        if (run.current.generation !== generation) return
        if (at + 1 < chunks.length) say(at + 1, chunks[at + 1].start)
        else {
          run.current.active = false
          setStatus('idle')
          mark(null)
          run.current.position = 0
        }
      }
      window.speechSynthesis.speak(utterance)
    }

    run.current.active = true
    say(index, Math.max(position, chunks[index].start))
    setStatus('playing')
  }

  const toggle = () => {
    if (status === 'playing') {
      window.speechSynthesis.pause()
      setStatus('paused')
    } else if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
    } else {
      run.current.position = 0
      speakFrom(0)
    }
  }

  /** Settings are fixed per utterance, so a change restarts from the current word. */
  const change = (next: { rate: string; voice: string }) => {
    setRate(next.rate)
    setVoice(next.voice)
    if (status !== 'idle') speakFrom(run.current.position, next)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return setSupported(false)
    setSupported(true)
    const synth = window.speechSynthesis
    const want = (lang ?? (document.documentElement.lang || navigator.language)).toLowerCase()
    const load = () => {
      const list = synth.getVoices()
      const language = (entry: SpeechSynthesisVoice) => entry.lang.toLowerCase()
      const sorted = [...list].sort(
        (a, b) => Number(language(b).startsWith(want.slice(0, 2))) - Number(language(a).startsWith(want.slice(0, 2))) || a.name.localeCompare(b.name),
      )
      setVoices(sorted)
      setVoice((current) => current || (sorted.find((entry) => language(entry) === want) ?? sorted.find((entry) => entry.default) ?? sorted[0])?.voiceURI || '')
    }
    load()
    synth.addEventListener('voiceschanged', load)
    const tracked = run.current
    return () => {
      synth.removeEventListener('voiceschanged', load)
      if (tracked.active) {
        tracked.generation += 1
        synth.cancel()
      }
      if (canHighlight()) CSS.highlights.delete(highlightName)
    }
  }, [lang, highlightName])

  if (supported === false) {
    return (
      <Text size="caption" tone="faint" className={className}>
        Reading aloud is not available in this browser.
      </Text>
    )
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <style>{`::highlight(${highlightName}){background-color:color-mix(in oklab,var(--color-accent) 55%,transparent);color:var(--color-ink)}`}</style>
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={toggle} disabled={!supported}>
          {status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Read aloud'}
        </Button>
        <Button size="sm" variant="outline" onClick={stop} disabled={status === 'idle'}>
          Stop
        </Button>
        <Select size="sm" label="Speed" value={rate} onValueChange={(next) => change({ rate: next, voice })} options={RATES.map((value) => ({ value, label: `${value}×` }))} />
        {voices.length > 0 && (
          <Select
            size="sm"
            label="Voice"
            value={voice}
            onValueChange={(next) => change({ rate, voice: next })}
            options={voices.map((entry) => ({ value: entry.voiceURI, label: entry.name, hint: entry.lang }))}
            className="max-w-[240px]"
          />
        )}
      </div>
      {text !== undefined && (
        <p ref={own} className="text-[15px] font-medium leading-relaxed text-ink">
          {word && !canHighlight() ? (
            <>
              {text.slice(0, word.start)}
              <mark className="rounded-[3px] bg-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] text-ink">{text.slice(word.start, word.end)}</mark>
              {text.slice(word.end)}
            </>
          ) : (
            text
          )}
        </p>
      )}
    </div>
  )
}
