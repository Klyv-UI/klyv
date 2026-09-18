'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

/* The Web Speech API is not in TypeScript's DOM library, so the slice used here is declared. */
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition

const recognitionConstructor = (): RecognitionConstructor | undefined => {
  if (typeof window === 'undefined') return undefined
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

const ERRORS: Record<string, string> = {
  'no-speech': 'Didn’t hear anything. Press the button and start speaking.',
  'not-allowed': 'Microphone access is blocked. Allow it from the address bar to dictate.',
  'service-not-allowed': 'This browser does not allow speech recognition on this page.',
  'audio-capture': 'No microphone was found.',
  network: 'The speech service could not be reached. Dictation needs a connection in this browser.',
  'language-not-supported': 'That language is not supported for dictation here.',
}

export interface DictationButtonProps {
  /** The field the words go into, at the caret. */
  targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** BCP 47 language of the speech, e.g. `en-GB`. Defaults to the page language. */
  lang?: string
  /** Keep listening across pauses until pressed again. Off stops after one phrase. */
  continuous?: boolean
  /** Called with each finished phrase, after it is inserted. */
  onTranscript?: (text: string) => void
  /** Accessible name of the button. */
  label?: string
  /** Shown instead of the button where speech recognition does not exist. `null` renders nothing. */
  unsupportedMessage?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/** Puts text in a field the way typing would, so React's onChange sees it. */
function insertAtCaret(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? start
  const before = field.value.slice(0, start)
  const after = field.value.slice(end)
  const lead = before && !/\s$/.test(before) ? ' ' : ''
  const trail = after && !/^\s/.test(after) ? ' ' : ''
  const inserted = `${lead}${text.trim()}${trail}`
  // The prototype's setter, not `field.value =`: React overrides the instance
  // setter to track the value, and would treat the change as already seen.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set
  setter?.call(field, before + inserted + after)
  const caret = before.length + inserted.length
  field.setSelectionRange(caret, caret)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * A microphone button that types what you say into a field.
 *
 * Words go in at the caret, not appended at the end, because dictation is
 * mostly used to fill a gap in something already written. Spaces are added
 * only where the text around the caret needs them. What is still being heard
 * shows under the button as a hint, and only final phrases touch the field —
 * so the value a form validates never flickers through guesses.
 *
 * Speech recognition exists in Chromium and Safari only, and in Chrome it
 * sends audio to a server. Where it is missing the button is not rendered at
 * all, with a line saying why, because a control that cannot work should not
 * be offered.
 */
export function DictationButton({
  targetRef,
  lang,
  continuous = true,
  onTranscript,
  label = 'Dictate',
  unsupportedMessage = 'Dictation is not available in this browser. Try Chrome, Edge or Safari.',
  className,
}: DictationButtonProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const latest = useRef(onTranscript)
  latest.current = onTranscript

  useEffect(() => {
    setSupported(Boolean(recognitionConstructor()))
    return () => recognition.current?.abort()
  }, [])

  const start = () => {
    const Constructor = recognitionConstructor()
    if (!Constructor) return
    const next = new Constructor()
    next.lang = lang ?? (document.documentElement.lang || navigator.language)
    next.continuous = continuous
    next.interimResults = true
    next.onresult = (event) => {
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          const field = targetRef.current
          if (field && text.trim()) {
            insertAtCaret(field, text)
            latest.current?.(text.trim())
          }
        } else pending += text
      }
      setInterim(pending)
    }
    next.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERRORS[event.error] ?? 'Dictation stopped unexpectedly.')
    }
    next.onend = () => {
      setListening(false)
      setInterim('')
      recognition.current = null
    }
    recognition.current = next
    setError('')
    try {
      next.start()
      setListening(true)
    } catch {
      setError('Dictation could not start.')
    }
  }

  const toggle = () => (listening ? recognition.current?.stop() : start())

  if (supported === null) return null
  if (!supported) {
    return unsupportedMessage === null ? null : (
      <Text size="caption" tone="faint" className={className}>
        {unsupportedMessage}
      </Text>
    )
  }

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        aria-pressed={listening}
        onClick={toggle}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[12px] font-bold transition-colors',
          listening ? 'bg-danger text-ink-inverse' : 'bg-surface-muted text-ink hover:bg-line-strong',
        )}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
          <path d="M3 7.5a5 5 0 0010 0M8 12.5v2" />
        </svg>
        {label}
        {listening && <span aria-hidden="true" className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />}
      </button>
      <Text as="p" size="caption" tone={error ? 'danger' : 'faint'} role={error ? 'alert' : undefined} aria-live={error ? undefined : 'off'} className="min-h-4 italic">
        {error || interim || (listening ? 'Listening… press again to stop.' : '')}
      </Text>
    </div>
  )
}
